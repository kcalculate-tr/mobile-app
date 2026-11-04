/**
 * G12-S4 — Destek talepleri (Final FinPrSupport panosu).
 *
 * `support_tickets` tablosu `src/screens/profile/SupportScreen.tsx` ile AYNI
 * kolonlarla okunur/yazılır (user_id/user_email/subject/message/order_code/
 * status) — yalnız Fin kabuğu, yeni mantık yok. Görsel ekleme burada yok
 * (kapsam: metin talebi + arama CTA'sı); mevcut ekran görsel eklemeyi
 * zaten destekliyor, ihtiyaç olursa S6'da birleştirilir.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { PhoneCall } from '../../../../components/icons';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinSectionLabel,
  FinSegmented,
  FinChip,
  FinPrimaryButton,
  FinFieldError,
  useFinShake,
  body,
  bodyMedium,
  bodySemibold,
  bodyBold,
} from '../finUi';

const TOPIC_OPTIONS = [
  'Sipariş Sorunu',
  'İade Talebi',
  'Bozuk/Eksik Ürün',
  'Teslimat Gecikmesi',
  'Fatura Talebi',
  'Diğer',
];

type Ticket = {
  id: string;
  subject: string;
  message: string;
  admin_reply: string | null;
  status: string;
  order_code: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = { open: 'Açık', answered: 'Cevaplandı', closed: 'Kapalı' };

export default function SettingsSupportScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [tab, setTab] = useState(0); // 0: yeni, 1: geçmiş
  const [subject, setSubject] = useState(TOPIC_OPTIONS[0]);
  const [orderCode, setOrderCode] = useState('');
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const messageShake = useFinShake();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return;
    setTicketsLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('id,subject,message,admin_reply,status,order_code,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTickets(Array.isArray(data) ? (data as Ticket[]) : []);
    setTicketsLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    if (tab === 1) fetchTickets();
  }, [tab, fetchTickets]);

  const handleSubmit = async () => {
    setMessageError(null);
    setSent(false);
    const trimmed = message.trim();
    if (!trimmed || !user?.id || !user?.email) {
      setMessageError(tr('profil.support_message'));
      messageShake.shake();
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('support_tickets').insert([
        {
          user_id: user.id,
          user_email: user.email,
          order_code: orderCode.trim() || null,
          subject,
          message: trimmed,
          admin_reply: null,
          status: 'open',
          updated_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
      setMessage('');
      setOrderCode('');
      setSent(true);
      setTab(1);
    } finally {
      setSending(false);
    }
  };

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.support_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <FinCard
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: t.color.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PhoneCall size={18} color={t.color.onAccent} weight="bold" />
          </View>
          <Text style={{ flex: 1, fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
            {tr('profil.support_phone')}
          </Text>
          <FinChip
            label={tr('profil.support_call_cta')}
            onPress={() => Linking.openURL(`tel:${tr('profil.support_phone').replace(/\s/g, '')}`)}
          />
        </FinCard>

        <FinSegmented
          options={[tr('profil.support_new'), tr('profil.support_history')]}
          index={tab}
          onChange={setTab}
        />

        {tab === 0 ? (
          <>
            <View style={{ gap: 8 }}>
              <FinSectionLabel>{tr('profil.support_subject')}</FinSectionLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
              >
                {TOPIC_OPTIONS.map(opt => (
                  <FinChip key={opt} label={opt} selected={opt === subject} onPress={() => setSubject(opt)} />
                ))}
              </ScrollView>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
                {tr('profil.support_order_code')}
              </Text>
              <TextInput
                value={orderCode}
                onChangeText={setOrderCode}
                autoCapitalize="characters"
                placeholderTextColor={t.color.secondary}
                style={{
                  height: 52,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  backgroundColor: t.color.surface,
                  borderWidth: 1,
                  borderColor: t.color.line,
                  fontFamily: bodyMedium,
                  fontSize: 15,
                  color: t.color.ink,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
                {tr('profil.support_message')}
              </Text>
              <TextInput
                value={message}
                onChangeText={text => {
                  setMessage(text);
                  if (messageError) setMessageError(null);
                }}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholderTextColor={t.color.secondary}
                style={{
                  minHeight: 120,
                  borderRadius: 14,
                  padding: 14,
                  backgroundColor: t.color.surface,
                  borderWidth: 1,
                  borderColor: messageError ? t.color.danger : t.color.line,
                  fontFamily: bodyMedium,
                  fontSize: 15,
                  color: t.color.ink,
                }}
              />
              {messageError ? <FinFieldError>{messageError}</FinFieldError> : null}
            </View>

            {sent ? (
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.accent }}>
                {tr('profil.support_sent')}
              </Text>
            ) : null}

            <FinPrimaryButton
              label={tr('profil.support_send')}
              onPress={handleSubmit}
              disabled={sending}
              icon={sending ? <ActivityIndicator color={t.color.bg} /> : undefined}
            />
          </>
        ) : ticketsLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.accent} />
          </View>
        ) : tickets.length === 0 ? (
          <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center', paddingVertical: 24 }}>
            {tr('profil.support_empty')}
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {tickets.map(ticket => (
              <FinCard key={ticket.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: bodyBold, fontSize: 14, color: t.color.ink }}>{ticket.subject}</Text>
                  <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>
                    {STATUS_LABEL[ticket.status] ?? ticket.status}
                  </Text>
                </View>
                <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{ticket.message}</Text>
                {ticket.admin_reply ? (
                  <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.ink, marginTop: 4 }}>
                    {ticket.admin_reply}
                  </Text>
                ) : null}
              </FinCard>
            ))}
          </View>
        )}
      </View>
    </FinScreen>
  );
}
