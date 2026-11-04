/**
 * G12-S4 — Öneri ve görüş (Final FinPrFeedback panosu).
 *
 * `feedback` tablosu `src/screens/FeedbackScreen.tsx` ile AYNI kolonlarla
 * yazılır (user_id/user_email/category/rating/message/status) — yalnız Fin
 * kabuğu, yeni mantık yok.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  bodyMedium,
  bodySemibold,
} from '../finUi';

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

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.feedback_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
            {tr('profil.feedback_prompt')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
          >
            {CATEGORIES.map(c => (
              <FinChip key={c.key} label={c.label} selected={c.key === category} onPress={() => setCategory(c.key)} />
            ))}
          </ScrollView>
        </View>

        <FinCard style={{ alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Pressable key={i} onPress={() => setRating(i)} accessibilityRole="button" hitSlop={6}>
                <Star
                  size={32}
                  color={i <= rating ? t.color.accent : t.color.line}
                  weight={i <= rating ? 'fill' : 'regular'}
                />
              </Pressable>
            ))}
          </View>
        </FinCard>

        <View style={{ gap: 6 }}>
          <TextInput
            value={message}
            onChangeText={text => {
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
              backgroundColor: t.color.surface,
              borderWidth: 1,
              borderColor: error ? t.color.danger : t.color.line,
              fontFamily: bodyMedium,
              fontSize: 15,
              color: t.color.ink,
            }}
          />
          {error ? <FinFieldError>{error}</FinFieldError> : null}
        </View>

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
