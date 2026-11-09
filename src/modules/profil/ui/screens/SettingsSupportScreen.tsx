/**
 * G12-S4 — Destek talepleri (Final FinPrSupport panosu); G15-S4 ince ayar.
 *
 * `support_tickets` tablosu `src/screens/profile/SupportScreen.tsx` ile AYNI
 * kolonlarla okunur/yazılır (user_id/user_email/subject/message/order_code/
 * status). G15-S4: "Görsel ekle" geri geldi — eski ekranla AYNI mekanik
 * (en fazla 3 görsel, 5 MB sınırı, `support-attachments` kovası); özellik kaybı yok.
 * G20-S3 md.4 (B-08): kova ÖZEL — talepte yalnız nesne yolu (`attachments`),
 * geçmişte "Ek N" → kısa ömürlü imzalı URL (createSignedUrl) ile açılır.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, TextInput, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { signedAttachmentUrl, ticketMessage, ticketView, uploadSupportImages } from '../../../../lib/support/attachments';
import { Phone, ImageSquare, X as XIcon } from '../../../../components/icons';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinSegmented,
  FinChip,
  FinPrimaryButton,
  FinSecondaryButton,
  FinFieldError,
  useFinShake,
  body,
  bodyMedium,
  bodySemibold,
  bodyBold,
} from '../finUi';
import { SectionSlide } from '../../../../core/design/sectionSlide';

const TOPIC_OPTIONS = [
  'Sipariş Sorunu',
  'İade Talebi',
  'Bozuk/Eksik Ürün',
  'Teslimat Gecikmesi',
  'Fatura Talebi',
  'Diğer',
];

const MAX_IMAGES = 3;

type Ticket = {
  id: string;
  subject: string;
  message: string;
  attachments?: unknown;
  admin_reply: string | null;
  status: string;
  order_code: string | null;
  created_at: string;
};

type Picked = { uri: string; fileName: string; type: string };

const STATUS_LABEL: Record<string, string> = { open: 'Açık', answered: 'Cevaplandı', closed: 'Kapalı' };

/**
 * G20-S3 md.4: talep metni + ekler. Ek → dokununca kısa ömürlü imzalı URL alınır ve
 * açılır (kova özel; herkese açık URL yok). Eski talepteki URL bölümü metinden atılır.
 */
function TicketBody({ ticket }: { ticket: { message: string; attachments?: unknown } }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { body: text, paths } = ticketView(ticket);
  const [failed, setFailed] = useState(false);
  const open = async (path: string) => {
    setFailed(false);
    const url = await signedAttachmentUrl(getSupabaseClient() as never, path);
    if (!url) {
      setFailed(true);
      return;
    }
    Linking.openURL(url).catch(() => setFailed(true));
  };
  return (
    <>
      <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{text}</Text>
      {paths.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} testID="support-ticket-attachments">
          {paths.map((p, i) => (
            <Pressable key={p} onPress={() => void open(p)} accessibilityRole="link" hitSlop={8} testID={`support-attachment-${i}`}>
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.ink, textDecorationLine: 'underline' }}>
                {tr('profil.support_attachment', { n: i + 1 })}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {failed ? (
        <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: '#E5484D' }} accessibilityLiveRegion="polite">
          {tr('profil.support_attachment_error')}
        </Text>
      ) : null}
    </>
  );
}

export default function SettingsSupportScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [tab, setTab] = useState(0); // 0: yeni, 1: geçmiş
  const [subject, setSubject] = useState(TOPIC_OPTIONS[0]);
  const [orderCode, setOrderCode] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Picked[]>([]);
  const [messageError, setMessageError] = useState<string | null>(null);
  const messageShake = useFinShake();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const phone = tr('profil.support_phone');

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return;
    setTicketsLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('id,subject,message,attachments,admin_reply,status,order_code,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTickets(Array.isArray(data) ? (data as Ticket[]) : []);
    setTicketsLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    if (tab === 1) fetchTickets();
  }, [tab, fetchTickets]);

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(tr('profil.support_title'), tr('profil.support_image_max'));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(tr('profil.support_title'), tr('profil.support_image_permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert(tr('profil.support_title'), tr('profil.support_image_size'));
        return;
      }
      setImages((prev) => [
        ...prev,
        {
          uri: asset.uri,
          fileName: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        },
      ]);
    }
  };

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
      // Tek görsel yüklenemezse talep yine gönderilir (eski ekranla aynı).
      const paths = await uploadSupportImages(supabase as never, user.id, images);
      const finalMessage = ticketMessage(trimmed, paths.length);

      const { error } = await supabase.from('support_tickets').insert([
        {
          user_id: user.id,
          user_email: user.email,
          order_code: orderCode.trim() || null,
          subject,
          message: finalMessage,
          attachments: paths.length > 0 ? paths : null,
          admin_reply: null,
          status: 'open',
          updated_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
      setMessage('');
      setOrderCode('');
      setImages([]);
      setSent(true);
      setTab(1);
    } finally {
      setSending(false);
    }
  };

  const grayField = {
    borderRadius: 14,
    backgroundColor: t.color.line,
    fontFamily: bodyMedium,
    fontSize: 15,
    color: t.color.ink,
  } as const;

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.support_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {/* Destek hattı: ad + numara solda, lime "Ara" hapı sağda. */}
        <FinCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: bodyBold, fontSize: 15, color: t.color.ink }}>
              {tr('profil.support_line')}
            </Text>
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{phone}</Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
            accessibilityRole="button"
            style={{
              height: 48,
              paddingHorizontal: 20,
              borderRadius: 24,
              backgroundColor: t.color.accent,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Phone size={18} color={t.color.onAccent} />
            <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.onAccent }}>
              {tr('profil.support_call_cta')}
            </Text>
          </Pressable>
        </FinCard>

        <FinSegmented
          options={[tr('profil.support_new'), tr('profil.support_history')]}
          index={tab}
          onChange={setTab}
        />

        <SectionSlide index={tab}>
        {tab === 0 ? (
          <FinCard style={{ gap: 14, padding: 16 }}>
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
                {tr('profil.support_subject')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {TOPIC_OPTIONS.map((opt) => (
                  <FinChip key={opt} label={opt} selected={opt === subject} onPress={() => setSubject(opt)} />
                ))}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
                {tr('profil.support_order_code')}
              </Text>
              <TextInput
                value={orderCode}
                onChangeText={setOrderCode}
                autoCapitalize="characters"
                placeholder="KCAL-XXXX"
                placeholderTextColor={t.color.secondary}
                style={{ ...grayField, height: 52, paddingHorizontal: 14 }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
                {tr('profil.support_message')}
              </Text>
              <TextInput
                value={message}
                onChangeText={(text) => {
                  setMessage(text);
                  if (messageError) setMessageError(null);
                }}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholder={tr('profil.support_message_ph')}
                placeholderTextColor={t.color.secondary}
                style={{
                  ...grayField,
                  minHeight: 120,
                  padding: 14,
                  borderWidth: messageError ? 1 : 0,
                  borderColor: t.color.danger,
                }}
              />
              {messageError ? <FinFieldError>{messageError}</FinFieldError> : null}
            </View>

            {images.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {images.map((img, i) => (
                  <View key={`${img.uri}-${i}`} style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden' }}>
                    <Image source={{ uri: img.uri }} style={{ width: 72, height: 72 }} />
                    <Pressable
                      onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      accessibilityRole="button"
                      hitSlop={6}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: 'rgba(10,10,10,0.6)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <XIcon size={10} color="#FFFFFF" weight="bold" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <FinSecondaryButton
              label={tr('profil.support_add_image')}
              onPress={pickImage}
              height={52}
              icon={<ImageSquare size={18} color={t.color.ink} />}
            />

            {sent ? (
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.accentLine }}>
                {tr('profil.support_sent')}
              </Text>
            ) : null}

            <FinPrimaryButton
              label={tr('profil.support_send')}
              onPress={handleSubmit}
              disabled={sending}
              icon={sending ? <ActivityIndicator color={t.color.bg} /> : undefined}
            />
          </FinCard>
        ) : ticketsLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.accent} />
          </View>
        ) : tickets.length === 0 ? (
          <Text
            style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center', paddingVertical: 24 }}
          >
            {tr('profil.support_empty')}
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {tickets.map((ticket) => (
              <FinCard key={ticket.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: bodyBold, fontSize: 14, color: t.color.ink }}>{ticket.subject}</Text>
                  <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>
                    {STATUS_LABEL[ticket.status] ?? ticket.status}
                  </Text>
                </View>
                <TicketBody ticket={ticket} />
                {ticket.admin_reply ? (
                  <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.ink, marginTop: 4 }}>
                    {ticket.admin_reply}
                  </Text>
                ) : null}
              </FinCard>
            ))}
          </View>
        )}
        </SectionSlide>
      </View>
    </FinScreen>
  );
}
