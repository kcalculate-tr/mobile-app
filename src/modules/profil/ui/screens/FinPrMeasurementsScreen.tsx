// G15-S4 — Ölçüm geçmişi, Final dili (eski MeasurementHistoryScreen'in yeniden
// giydirilmesi; veri AYNI: `body_measurements`, son 90 kayıt). Profil › İlerleme ›
// "Ölçüm ekle" bu ekranı açar (yeni kabuk açıkken).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { Ruler } from '../../../../components/icons';
import { FinScreen, FinHeader, FinCard, body, bodyBold, bodyMedium, bodySemibold, heading } from '../finUi';

type Measurement = {
  id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
};

const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : Math.round((a - b) * 10) / 10);

export default function FinPrMeasurementsScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const { user } = useAuth();
  const [data, setData] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: rows } = await getSupabaseClient()
        .from('body_measurements')
        .select('id,date,weight_kg,waist_cm,hip_cm,chest_cm')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(90);
      setData((rows as Measurement[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const first = data.length > 0 ? data[data.length - 1] : null;
  const last = data.length > 0 ? data[0] : null;

  const Delta = ({ v }: { v: number | null }) =>
    v == null || v === 0 ? (
      <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>—</Text>
    ) : (
      <Text style={{ fontFamily: bodyBold, fontSize: 12, color: v < 0 ? t.color.accentLine : t.color.secondary }}>
        {v > 0 ? '+' : ''}
        {v}
      </Text>
    );

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.measure_history')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.ink} />
          </View>
        ) : data.length === 0 ? (
          <FinCard style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ruler size={22} color={t.color.ink} />
            </View>
            <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.measure_empty_title')}</Text>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>
              {tr('profil.measure_empty_body')}
            </Text>
          </FinCard>
        ) : (
          <>
            {first && last && data.length > 1 ? (
              <FinCard style={{ gap: 10, padding: 16 }}>
                <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.measure_summary')}</Text>
                <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
                  {fmt(first.date)} → {fmt(last.date)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { l: tr('profil.measure_weight'), f: first.weight_kg, v: last.weight_kg, u: 'kg' },
                    { l: tr('profil.measure_waist'), f: first.waist_cm, v: last.waist_cm, u: 'cm' },
                    { l: tr('profil.measure_hip'), f: first.hip_cm, v: last.hip_cm, u: 'cm' },
                    { l: tr('profil.measure_chest'), f: first.chest_cm, v: last.chest_cm, u: 'cm' },
                  ].map((c) => (
                    <View key={c.l} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>{c.l}</Text>
                      <Text style={{ fontFamily: bodyBold, fontSize: 15, color: t.color.ink }}>{c.v != null ? `${c.v} ${c.u}` : '—'}</Text>
                      <Delta v={diff(c.v, c.f)} />
                    </View>
                  ))}
                </View>
              </FinCard>
            ) : null}

            <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.measure_all')}</Text>
            {data.map((item, i) => {
              const prev = data[i + 1] ?? null;
              const parts = [
                item.weight_kg != null ? `${tr('profil.measure_weight')} ${item.weight_kg} kg` : null,
                item.waist_cm != null ? `${tr('profil.measure_waist')} ${item.waist_cm} cm` : null,
                item.hip_cm != null ? `${tr('profil.measure_hip')} ${item.hip_cm} cm` : null,
                item.chest_cm != null ? `${tr('profil.measure_chest')} ${item.chest_cm} cm` : null,
              ].filter(Boolean);
              return (
                <FinCard key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>{fmt(item.date)}</Text>
                    <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{parts.join(' · ')}</Text>
                  </View>
                  <Delta v={diff(item.weight_kg, prev?.weight_kg ?? null)} />
                </FinCard>
              );
            })}
          </>
        )}
      </View>
    </FinScreen>
  );
}
