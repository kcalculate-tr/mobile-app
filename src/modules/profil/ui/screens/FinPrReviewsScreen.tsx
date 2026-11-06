// G15-S4 — Değerlendirmelerim, Final dili (eski MyReviewsScreen'in yeniden giydirilmesi).
// Veri/mantık eski ekranla AYNI: `reviews` (kendi satırlarım, RLS), görülmemiş yanıtları
// açılışta `reply_seen_at` ile damgalar ("YENİ" rozeti açılış anındaki sete bağlı).
// Yalnız `yeni_kabuk` açıkken Profil hub'ından açılır; eski ekran bayrak kapalı yolda kalır.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { ChatCircleDots, Star } from '../../../../components/icons';
import { FinScreen, FinHeader, FinCard, body, bodyBold, bodyMedium, bodySemibold, heading, finExtras } from '../finUi';

type ReviewRow = {
  id: number;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
  admin_reply: string | null;
  admin_reply_at: string | null;
  reply_seen_at: string | null;
  orders: { order_code: string | null } | null;
};

export default function FinPrReviewsScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr, lang } = useT();
  const { user } = useAuth();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  const fmt = (v: string | null) =>
    v ? new Date(v).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

  const fetchRows = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, is_approved, created_at, admin_reply, admin_reply_at, reply_seen_at, orders(order_code)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as ReviewRow[];
    setRows(list);
    setLoading(false);
    const unseen = list.filter((r) => (r.admin_reply ?? '') !== '' && !r.reply_seen_at).map((r) => r.id);
    if (unseen.length > 0) {
      setFresh((prev) => new Set([...prev, ...unseen]));
      await supabase.from('reviews').update({ reply_seen_at: new Date().toISOString() }).in('id', unseen);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const avg = useMemo(
    () => (rows.length ? (rows.reduce((s, r) => s + Number(r.rating ?? 0), 0) / rows.length).toFixed(1) : null),
    [rows],
  );

  return (
    <FinScreen
      scroll
      contentStyle={{ paddingTop: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.color.ink} onRefresh={async () => {
        setRefreshing(true);
        await fetchRows();
        setRefreshing(false);
      }} />}
    >
      <FinHeader title={tr('profil.reviews')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary }}>
          {rows.length > 0
            ? tr('profil.reviews_summary', { n: rows.length, avg: avg ?? '' })
            : tr('profil.reviews_sub')}
        </Text>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.ink} />
          </View>
        ) : rows.length === 0 ? (
          <FinCard style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color.line, alignItems: 'center', justifyContent: 'center' }}>
              <ChatCircleDots size={22} color={t.color.ink} />
            </View>
            <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink, textAlign: 'center' }}>
              {tr('profil.reviews_empty_title')}
            </Text>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>
              {tr('profil.reviews_empty_body')}
            </Text>
          </FinCard>
        ) : (
          rows.map((r) => {
            const reply = (r.admin_reply ?? '').trim();
            return (
              <FinCard key={r.id} style={{ gap: 8, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={16} weight="fill" color={n <= Number(r.rating ?? 0) ? t.color.accentLine : x.line2} />
                    ))}
                  </View>
                  <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{fmt(r.created_at)}</Text>
                </View>
                {r.orders?.order_code ? (
                  <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
                    {tr('profil.reviews_order', { code: r.orders.order_code })}
                  </Text>
                ) : null}
                {r.comment ? (
                  <Text style={{ fontFamily: body, fontSize: 15, lineHeight: 21, color: t.color.ink }}>{r.comment}</Text>
                ) : null}
                {!r.is_approved && r.comment ? (
                  <View style={{ alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: t.color.line, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: bodySemibold, fontSize: 12, color: t.color.ink }}>{tr('profil.reviews_pending')}</Text>
                  </View>
                ) : null}
                {reply ? (
                  <View style={{ backgroundColor: t.color.bg, borderRadius: 14, padding: 12, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: bodyBold, fontSize: 13, color: t.color.ink }}>{tr('profil.reviews_reply')}</Text>
                      {fresh.has(r.id) ? (
                        <View style={{ height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: t.color.accent, justifyContent: 'center' }}>
                          <Text style={{ fontFamily: bodyBold, fontSize: 11, color: t.color.onAccent }}>{tr('profil.reviews_new')}</Text>
                        </View>
                      ) : null}
                      {r.admin_reply_at ? (
                        <Text style={{ fontFamily: body, fontSize: 12, color: t.color.secondary }}>{fmt(r.admin_reply_at)}</Text>
                      ) : null}
                    </View>
                    <Text style={{ fontFamily: body, fontSize: 14, lineHeight: 20, color: t.color.ink }}>{reply}</Text>
                  </View>
                ) : null}
              </FinCard>
            );
          })
        )}
      </View>
    </FinScreen>
  );
}
