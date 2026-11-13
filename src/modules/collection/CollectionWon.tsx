// CollectionWon (FinCollectWon) — "Kart kazandın!" tam ekran kaplama.
// Taranan fotoğrafın üstünde koyu scrim; başlık; 260×400 beyaz kart (çıkartma +
// yemek adı + "tarih · öğün" + 2 etiket çipi + "kcal." altbilgisi); lime
// "No. NNN · İlk kez" çipi; altta "Kartı gör" (lime) + "Paylaş" (outline).
// Gösterilince bir kez haptic('success'); çıkartma karta uçar. Azaltılmış
// harekette uçuş yok, kart yalnız solarak belirir.
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AppText, BrandLogo, CURVE, DURATION, REDUCED, TIMING, haptic, useReducedMotion, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { CachedImage } from '../../components/CachedImage';
import { StatusBar } from 'expo-status-bar';
import { formatNo } from './StickerCard';
import type { CollectionCard } from './types';

const CARD_W = 260;
const CARD_H = 400;

export function CollectionWon({
  visible,
  card,
  onViewCard,
  onShare,
  onClose,
}: {
  visible: boolean;
  card: CollectionCard;
  onViewCard: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const ct = t.isDark
    ? { card: '#1C1C1E', empty: '#2C2C2E', ink: '#F5F5F5', sec: '#A1A1A6', line: '#48484A' }
    : { card: '#FFFFFF', empty: '#F1F2F4', ink: '#0A0A0A', sec: '#6B6B70', line: '#C3C7CC' };
  const { t: tr, lang } = useT();
  const reduced = useReducedMotion();

  // Giriş ilerlemesi: 0 → 1. Azaltılmışta kısa solma; normalde çıkartma uçuşu.
  const p = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      p.value = 0;
      return;
    }
    haptic('success'); // gösterimde bir kez (success günde 3 ile sınırlı)
    p.value = 0;
    p.value = withDelay(
      reduced ? 0 : DURATION.instant,
      withTiming(1, {
        duration: reduced ? REDUCED.duration : TIMING.enter,
        easing: reduced ? CURVE.out : CURVE.enter,
      }),
    );
  }, [visible, reduced, p]);

  // Çıkartma: uzaktan/büyükten karta iner (uçuş). Azaltılmışta yalnız opaklık.
  const flyStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: p.value };
    const scale = interpolate(p.value, [0, 1], [1.6, 1]);
    const translateY = interpolate(p.value, [0, 1], [-120, 0]);
    const rotate = interpolate(p.value, [0, 1], [-10, 0]);
    return { opacity: p.value, transform: [{ translateY }, { scale }, { rotate: `${rotate}deg` }] };
  });

  const cardStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  // G15-S2 (FinCollectWon): "2 Kas · Öğle".
  const dateLabel = new Date(card.dateISO).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  const mealLabel = tr(`meal.${card.meal}`);
  const tags = cardTags(card).map((k) => tr(`collection.tag_${k}`));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar style="light" />
      {/* Zemin: taranan foto (varsa) + koyu scrim. */}
      <View style={styles.root}>
        {card.photoUri ? <CachedImage uri={card.photoUri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={tr('collection.won_title')} />

        <View style={styles.top} pointerEvents="box-none">
          <AppText variant="title" style={styles.heading} accessibilityRole="header">
            {tr('collection.won_title')}
          </AppText>

          <Animated.View style={[styles.cardWrap, cardStyle]}>
            {/* G15-S2 (FinCollectWon-Dark): koyu temada kart koyu yüzey. */}
            <View style={[styles.card, { backgroundColor: ct.card }]}>
              <Animated.View style={flyStyle}>
                <View style={styles.stickerClip}>
                  {card.photoUri ? (
                    <CachedImage uri={card.photoUri} style={styles.stickerImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.stickerImg, { backgroundColor: ct.empty }]} />
                  )}
                </View>
              </Animated.View>

              <AppText style={[styles.dishName, { color: ct.ink }]} numberOfLines={2}>
                {card.name}
              </AppText>
              <AppText style={[styles.dateMeal, { color: ct.sec }]}>{`${dateLabel}, ${mealLabel}`}</AppText>

              {tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {tags.map((l) => (
                    <View key={l} style={[styles.tag, { borderColor: ct.line }]}>
                      <AppText style={[styles.tagText, { color: ct.ink }]}>{l}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}

              <BrandLogo name="kcal" height={14} color={ct.sec} style={styles.brand} />
            </View>

            {/* Lime çip: "No. NNN · İlk kez" — kartın sol üst köşesinde. */}
            <View style={[styles.limeChip, { backgroundColor: t.color.accent }]}>
              <AppText tone="onAccent" style={styles.limeText}>
                {card.firstTime ? `${formatNo(card.no)} (${tr('collection.first_time')})` : formatNo(card.no)}
              </AppText>
            </View>
          </Animated.View>
        </View>

        {/* Alt düğmeler — tam genişlik, alt alta. */}
        <View style={styles.actions}>
          <Pressable style={[styles.btn, { backgroundColor: t.color.accent }]} onPress={onViewCard} accessibilityRole="button">
            <AppText tone="onAccent" style={styles.btnText}>
              {tr('collection.view_card')}
            </AppText>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={onShare} accessibilityRole="button">
            <AppText style={[styles.btnText, { color: '#FFFFFF' }]}>{tr('collection.share')}</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Kart etiketleri — YALNIZ mevcut veriden: proteinden gelen enerji ≥ %25 →
 * "Yüksek protein"; karbonhidrat ≤ %25 → "Düşük karbonhidrat". Lif verisi
 * yok → "Lifli" gösterilmez (uydurma yok). SAF.
 */
export function cardTags(card: Pick<CollectionCard, 'kcal' | 'protein_g' | 'carbs_g'>): string[] {
  const kcal = card.kcal > 0 ? card.kcal : 0;
  if (!kcal) return [];
  const out: string[] = [];
  if (card.protein_g != null && (card.protein_g * 4) / kcal >= 0.25) out.push('high_protein');
  if (card.carbs_g != null && (card.carbs_g * 4) / kcal <= 0.25) out.push('low_carb');
  return out;
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A2622' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  top: { alignItems: 'center', paddingTop: 76, paddingHorizontal: 24 },
  heading: { color: '#FFFFFF', marginBottom: 24, textAlign: 'center', fontSize: 28, lineHeight: 34 },
  cardWrap: { alignItems: 'flex-start' },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    padding: 18,
  },
  stickerClip: {
    width: CARD_W - 36,
    height: CARD_W - 50,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  stickerImg: { width: CARD_W - 36, height: CARD_W - 50 },
  stickerEmpty: { backgroundColor: '#F1F2F4' },
  dishName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, lineHeight: 23, color: '#0A0A0A' },
  dateMeal: { fontSize: 13, marginTop: 2, color: '#6B6B70' },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  tag: { borderWidth: 1, borderColor: '#C3C7CC', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 13, fontWeight: '500', color: '#0A0A0A' },
  brand: { marginTop: 'auto' },
  limeChip: { position: 'absolute', top: -14, left: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  limeText: { fontSize: 13, fontWeight: '700' },
  actions: { position: 'absolute', left: 16, right: 16, bottom: 40, gap: 12 },
  btn: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
});
