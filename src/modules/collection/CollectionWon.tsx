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
import { AppText, CURVE, TIMING, haptic, useReducedMotion, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { CachedImage } from '../../components/CachedImage';
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
      reduced ? 0 : 60,
      withTiming(1, {
        duration: reduced ? 200 : TIMING.enter,
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

  // "tarih · öğün"
  const dateLabel = new Date(card.dateISO).toLocaleDateString(lang);
  const mealLabel = tr(`meal.${card.meal}`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Koyu scrim — fotoğrafın üstünde. */}
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={tr('collection.won_title')}>
        <View style={styles.center} pointerEvents="box-none">
          <AppText variant="title" tone="onAccent" style={styles.heading}>
            {tr('collection.won_title')}
          </AppText>

          <Animated.View style={[styles.cardWrap, cardStyle]}>
            <View style={[styles.card, { backgroundColor: '#FFFFFF' }]}>
              <Animated.View style={flyStyle}>
                <View style={styles.stickerClip}>
                  {card.photoUri ? (
                    <CachedImage uri={card.photoUri} style={styles.stickerImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.stickerImg, styles.stickerEmpty]} />
                  )}
                </View>
              </Animated.View>

              <AppText variant="heading" tone="ink" style={styles.dishName}>
                {card.name}
              </AppText>
              <AppText variant="caption" tone="secondary" style={styles.dateMeal}>
                {`${dateLabel} · ${mealLabel}`}
              </AppText>

              {/* 2 etiket çipi (outline). */}
              <View style={styles.tagRow}>
                <Tag label={`${Math.round(card.protein_g ?? 0)}P`} />
                <Tag label={`${Math.round(card.carbs_g ?? 0)}K`} />
              </View>

              <AppText variant="caption" tone="secondary" style={styles.kcalFoot}>
                {`${Math.round(card.kcal)} kcal.`}
              </AppText>
            </View>

            {/* Lime çip: "No. NNN · İlk kez" (ilk kez değilse yalnız No.). */}
            <View style={[styles.limeChip, { backgroundColor: t.color.accent }]}>
              <AppText variant="caption" tone="onAccent">
                {card.firstTime ? `${formatNo(card.no)} · ${tr('collection.first_time')}` : formatNo(card.no)}
              </AppText>
            </View>
          </Animated.View>

          {/* Alt iki düğme. */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: t.color.accent }]}
              onPress={onViewCard}
              accessibilityRole="button"
            >
              <AppText variant="body" tone="onAccent">
                {tr('collection.view_card')}
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnOutline, { borderColor: t.color.line }]}
              onPress={onShare}
              accessibilityRole="button"
            >
              <AppText variant="body" tone="ink">
                {tr('collection.share')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  heading: { color: '#FFFFFF', marginBottom: 20, textAlign: 'center' },
  cardWrap: { alignItems: 'center' },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
  },
  stickerClip: {
    width: CARD_W - 60,
    height: CARD_W - 60,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
  },
  stickerImg: { width: CARD_W - 60, height: CARD_W - 60 },
  stickerEmpty: { backgroundColor: '#F1F1F1' },
  dishName: { fontSize: 18, textAlign: 'center' },
  dateMeal: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tag: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  kcalFoot: { marginTop: 'auto' },
  limeChip: { marginTop: -14, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  btn: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
});
