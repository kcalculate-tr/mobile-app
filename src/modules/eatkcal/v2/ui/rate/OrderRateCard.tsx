// G62-S1 — Değerlendirme giriş kartı (Ana sayfa + sipariş detayı).
// Brif "FinEkRateNew = giriş kartı" diyor; ancak docs/g62/design/FinEkRateNew.dc.html "puan ve Yeni rozeti
// kuralı" açıklama panosu (giriş kartı çizimi yok). Kart bu yüzden FinEkRateSheet'in arka planındaki "teslim
// edilen sipariş" kartının ölçüleriyle kuruldu (14 iç boşluk · 20 köşe · 56 görsel / 14 köşe · 15 kalın + 13
// ikincil) + mevcut eatkcal düğme dili (44 pt mürekkep düğme). Görsel yoksa cam kase (kase = öğün/sipariş).
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { fontFamily, haptic } from '../../../../../core/design';
import { X } from '../../../../../components/icons';
import { useEk } from '../kit';

const BOWL = require('../../../../../../assets/glass/bowl.png');

export function OrderRateCard({
  orderLabel,
  imageUrl,
  onRate,
  onDismiss,
  testID = 'order-rate-card',
}: {
  orderLabel: string;
  imageUrl?: string | null;
  onRate: () => void;
  /** Yalnız Ana sayfada (sipariş detayında kapatma yok). */
  onDismiss?: () => void;
  testID?: string;
}) {
  const { c, t } = useEk();
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]} testID={testID}>
      <View style={styles.row}>
        <Image
          source={imageUrl ? { uri: imageUrl } : BOWL}
          style={[styles.img, !imageUrl && { backgroundColor: c.bg }]}
          resizeMode={imageUrl ? 'cover' : 'contain'}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <View style={styles.texts} accessible accessibilityLabel={`${t('order_rate.card_eyebrow')}. ${t('order_rate.card_title')} ${t('order_rate.card_body', { order: orderLabel })}`}>
          <Text style={[styles.eyebrow, { color: c.secondary }]}>{t('order_rate.card_eyebrow')}</Text>
          <Text style={[styles.title, { color: c.ink }]}>{t('order_rate.card_title')}</Text>
          <Text style={[styles.body, { color: c.secondary }]}>{t('order_rate.card_body', { order: orderLabel })}</Text>
        </View>
        {onDismiss ? (
          <Pressable
            onPress={() => {
              haptic('selection');
              onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('order_rate.card_dismiss')}
            style={styles.x}
            testID={`${testID}-dismiss`}
          >
            <X size={20} color={c.secondary} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => {
          haptic('light');
          onRate();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('order_rate.card_a11y', { order: orderLabel })}
        style={({ pressed }) => [styles.cta, { backgroundColor: c.ink }, pressed && { opacity: 0.85 }]}
        testID={`${testID}-cta`}
      >
        <Text style={[styles.ctaText, { color: c.surface }]}>{t('order_rate.card_cta')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  img: { width: 56, height: 56, borderRadius: 14 },
  texts: { flex: 1, gap: 1 },
  eyebrow: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 17 },
  title: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8, alignSelf: 'flex-start', marginTop: -8 },
  cta: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  ctaText: { fontFamily: fontFamily.headingBold, fontSize: 15, lineHeight: 20 },
});
