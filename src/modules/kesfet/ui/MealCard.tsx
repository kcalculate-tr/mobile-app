// Keşfet MealCard — gönderiye bağlı tarif/öğün kartı. Tasarım: Final FinFeed /
// FinActivityCard. Görsel + ad + "kcal · protein" + P/K/Y çipleri + "N kişi
// logladı" + lime "⟨Öğün⟩'ye logla ⌄" düğmesi.
//
// Düğme iki parçalı (Final): asıl etiket DOKUN = saate göre öğüne doğrudan
// loglar (hızlı logla); sağdaki ⌄ (bölücüyle ayrılmış) ya da UZUN BAS = porsiyon/
// öğün seçici sayfasını (FinAddSheet) açar. Lime YALNIZ dolgu; üstündeki metin
// koyu (onAccent). Hızlı loglarken görselin ekrandaki karesi ölçülüp uçuş
// (`kcal:logFlight`) için çağırana verilir.
import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, fontFamily, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Icon } from './icons';
import type { MealCard as MealCardData } from '../types';

export interface LogOriginFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function MealCard({
  meal,
  loggedCount,
  quickMealLabel,
  onQuickLog,
  onOpenSheet,
  logLabel,
}: {
  meal: MealCardData;
  /** G15 — düğmenin tam metni (doğru yönelme ekiyle, "Kahvaltı’ya logla"). */
  logLabel?: string;
  /** "N kişi logladı" sayacı (gerçek veri; 0 ise gizlenir). */
  loggedCount: number;
  /** Hızlı loglanacak öğünün etiketi (saate göre), örn. "Öğle". */
  quickMealLabel: string;
  /** Dokun = saate göre öğüne doğrudan logla; görselin ekran karesini döner. */
  onQuickLog: (frame: LogOriginFrame) => void;
  /** ⌄ / uzun bas = porsiyon + öğün seçici sayfası. */
  onOpenSheet: () => void;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const thumbRef = useRef<View>(null);
  const logText = logLabel ?? tr('kesfet.ui.meal_card.log_to_meal', { meal: quickMealLabel });

  const chip = (label: string, value: number) => (
    <View style={[styles.chip, { backgroundColor: t.color.line }]}>
      <AppText variant="caption" style={styles.chipText}>
        {label} {fmt(Math.round(value))}
      </AppText>
    </View>
  );

  const quickLog = () => {
    const node = thumbRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, w, h) => onQuickLog({ x, y, w, h }));
    } else {
      onQuickLog({ x: 0, y: 0, w: 0, h: 0 });
    }
  };

  return (
    <View
      style={[
        styles.card,
        // Final: açık #FFFFFF, koyu #1C1C1E (çipler #2C2C2E üstünde seçilsin).
        { backgroundColor: t.color.surface, borderColor: t.color.line },
      ]}
    >
      <View style={styles.top}>
        <View ref={thumbRef} style={[styles.thumb, { backgroundColor: t.color.line }]}>
          {meal.photo_url ? (
            <Image
              source={{ uri: meal.photo_url }}
              style={styles.thumbImg}
              contentFit="cover"
              transition={120}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View style={styles.info}>
          <AppText variant="caption" style={styles.name} numberOfLines={1}>
            {meal.name}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {tr('kesfet.ui.meal_card.macro', {
              kcal: fmt(meal.kcal),
              protein: fmt(Math.round(meal.protein_g)),
            })}
          </AppText>
          <View style={styles.chips}>
            {chip('P', meal.protein_g)}
            {chip('K', meal.carbs_g)}
            {chip('Y', meal.fat_g)}
          </View>
        </View>
      </View>

      <View style={[styles.actionRow, { borderTopColor: t.color.line }]}>
        {loggedCount > 0 ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.added}>
            {tr('kesfet.ui.meal_card.logged_count', { count: loggedCount })}
          </AppText>
        ) : (
          <View style={styles.added} />
        )}
        {/* Lime "⟨Öğün⟩'ye logla ⌄" — iki parçalı: etiket (hızlı logla) + ⌄ (seçici). */}
        <View style={[styles.logBtn, { backgroundColor: t.color.accent }]}>
          <Pressable
            onPress={quickLog}
            onLongPress={onOpenSheet}
            accessibilityRole="button"
            accessibilityLabel={logText}
            accessibilityHint={tr('kesfet.ui.meal_card.log_hint')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={({ pressed }) => [styles.logLabelTouch, pressed && { opacity: 0.85 }]}
          >
            <AppText variant="caption" style={[styles.logText, { color: t.color.onAccent }]} numberOfLines={1}>
              {logText}
            </AppText>
          </Pressable>
          <View style={[styles.logDivider, { backgroundColor: 'rgba(10,10,10,0.28)' }]} />
          <Pressable
            onPress={onOpenSheet}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.ui.meal_card.pick_meal')}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={({ pressed }) => [styles.logCaret, pressed && { opacity: 0.85 }]}
          >
            <Icon name="caretDown" size={14} color={t.color.onAccent} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, paddingHorizontal: 8, paddingTop: 8, borderRadius: 16, borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 52, height: 52, borderRadius: 10 },
  info: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  chips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  chip: { minHeight: 20, paddingHorizontal: 6, borderRadius: 6, justifyContent: 'center' },
  chipText: { fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  actionRow: {
    marginTop: 6,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  added: { flex: 1 },
  // Final: h 32, radius 16, etiket pad 0 8 0 12, ayraç 1x16, ⌄ yuvası 32 geniş.
  // Görsel yükseklik 32'de sabit kalır (Final birebir); dokunma ≥44 hitSlop ile.
  logBtn: { height: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  logLabelTouch: { paddingLeft: 12, paddingRight: 8, justifyContent: 'center' },
  logText: { fontFamily: fontFamily.headingSemibold, fontSize: 13 },
  logDivider: { width: 1, height: 16 },
  logCaret: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
