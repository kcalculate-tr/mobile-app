/**
 * G12-S4 — Öneri ve görüş (Final FinPrFeedback panosu); G15-S4 ince ayar.
 *
 * `feedback` tablosu `src/screens/FeedbackScreen.tsx` ile AYNI kolonlarla
 * yazılır (user_id/user_email/category/rating/message/status) — yalnız Fin
 * kabuğu, yeni mantık yok.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { Star, Check } from '../../../../components/icons';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinChip,
  FinPrimaryButton,
  FinFieldError,
  useFinShake,
  body,
  bodyMedium,
  bodySemibold,
  finExtras,
} from '../finUi';
import { FIN_SCROLL_KEYBOARD } from '../finUi';

const CATEGORIES = [
  { key: 'general', label: 'Genel' },
  { key: 'food', label: 'Yemek Kalitesi' },
  { key: 'delivery', label: 'Teslimat' },
  { key: 'app', label: 'Uygulama' },
  { key: 'service', label: 'Müşteri Hizmetleri' },
  { key: 'price', label: 'Fiyat / Ürün' },
];

export default function SettingsFeedbackScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const x = finExtras(t);
  const insets = useSafeAreaInsets();
  const { t: tr } = useT();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const shake = useFinShake();
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = message.trim();
    if (rating === 0 || trimmed.length < 10 || !user?.id) {
      setError(tr('profil.feedback_field_required'));
      shake.shake();
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('feedback').insert({
        user_id: user.id,
        user_email: user.email,
        category,
        rating,
        message: trimmed,
        status: 'new',
      });
      if (insertError) throw insertError;
      setSent(true);
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <FinScreen contentStyle={{ paddingTop: 0 }}>
        <FinHeader title={tr('profil.feedback_title')} onBack={onBack} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: t.color.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={32} color={t.color.onAccent} weight="bold" />
          </View>
          <Text style={{ fontFamily: bodySemibold, fontSize: 17, color: t.color.ink, textAlign: 'center' }}>
            {tr('profil.feedback_sent')}
          </Text>
        </View>
      </FinScreen>
    );
  }

  const label = { fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary } as const;

  return (
    <FinScreen contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.feedback_title')} onBack={onBack} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 14 }}
        {...FIN_SCROLL_KEYBOARD}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: body, fontSize: 15, color: t.color.secondary }}>
          {tr('profil.feedback_prompt')}
        </Text>

        <FinCard style={{ gap: 12, padding: 16 }}>
          <Text style={label}>{tr('profil.feedback_topic')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <FinChip key={c.key} label={c.label} selected={c.key === category} onPress={() => setCategory(c.key)} />
            ))}
          </View>

          <Text style={[label, { marginTop: 4 }]}>{tr('profil.feedback_rating')}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} accessibilityRole="button" hitSlop={6}>
                <Star size={36} color={i <= rating ? t.color.accentLine : x.line2} weight="fill" />
              </Pressable>
            ))}
          </View>

          <Text style={[label, { marginTop: 4 }]}>{tr('profil.feedback_message')}</Text>
          <TextInput
            value={message}
            onChangeText={(text) => {
              setMessage(text);
              if (error) setError(null);
            }}
            placeholder={tr('profil.feedback_placeholder')}
            placeholderTextColor={t.color.secondary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
            style={{
              minHeight: 120,
              borderRadius: 14,
              padding: 14,
              backgroundColor: t.color.line,
              borderWidth: error ? 1 : 0,
              borderColor: t.color.danger,
              fontFamily: bodyMedium,
              fontSize: 15,
              color: t.color.ink,
            }}
          />
          {error ? <FinFieldError>{error}</FinFieldError> : null}
        </FinCard>
      </ScrollView>

      {/* Alta yapışık "Gönder" çubuğu (FinPrFeedback). */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12) + 8,
          backgroundColor: t.color.bg,
          borderTopWidth: 1,
          borderTopColor: t.color.line,
        }}
      >
        <FinPrimaryButton
          label={tr('profil.feedback_send')}
          onPress={handleSubmit}
          disabled={saving}
          icon={saving ? <ActivityIndicator color={t.color.bg} /> : undefined}
        />
      </View>
    </FinScreen>
  );
}
