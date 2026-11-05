// eatkcal v2 — FinEkProduct canlı makro halkaları (kcal · P · K · Y, 60 px)
// ve kaydırınca beliren canlı makro şeridi (yüzen cam katman, 200 ms opaklık
// — DURATION.fast; azaltılmış harekette anında). Değerler seçim değiştikçe
// güncellenir; halka dolumu ortak ProgressRing (UI thread).
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { DURATION, ProgressRing, fontFamily, useReducedMotion } from '../../../../../core/design';
import { ekType, useEk } from '../kit';
import { ringProgress, type DisplayMacros } from '../../model/productModel';

const num = { fontFamily: fontFamily.headingBold, fontSize: 15, lineHeight: 19, fontVariant: ['tabular-nums' as const] };

function useCells(m: DisplayMacros) {
  const { t } = useEk();
  const p = ringProgress(m);
  return [
    { key: 'kcal', value: String(Math.round(m.kcal)), label: t('eatkcal.v2.common.kcal'), short: t('eatkcal.v2.common.kcal'), progress: p.kcal },
    { key: 'p', value: t('eatkcal.v2.common.grams', { n: m.protein }), label: t('eatkcal.v2.common.protein'), short: t('eatkcal.v2.common.p'), progress: p.protein },
    { key: 'k', value: t('eatkcal.v2.common.grams', { n: m.carbs }), label: t('eatkcal.v2.common.carbs'), short: t('eatkcal.v2.common.k'), progress: p.carbs },
    { key: 'y', value: t('eatkcal.v2.common.grams', { n: m.fats }), label: t('eatkcal.v2.common.fat'), short: t('eatkcal.v2.common.y'), progress: p.fats },
  ];
}

export function MacroRings({ macros }: { macros: DisplayMacros }) {
  const { c, t } = useEk();
  const cells = useCells(macros);
  return (
    <View
      style={[styles.card, { backgroundColor: c.surface }]}
      accessibilityRole="summary"
      accessibilityLabel={`${t('eatkcal.v2.product.macros')}: ${cells.map((x) => `${x.label} ${x.value}`).join(', ')}`}
      testID="ek-product-macros"
    >
      {cells.map((cell) => (
        <View key={cell.key} style={styles.cell} importantForAccessibility="no-hide-descendants">
          <ProgressRing progress={cell.progress} size={60} strokeWidth={6} color={c.accentLine} trackColor={c.line} />
          <Text style={[num, { color: c.ink }]}>{cell.value}</Text>
          <Text style={[ekType.c13, { color: c.secondary }]}>{cell.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function LiveMacroStrip({ macros, visible, bottom }: { macros: DisplayMacros; visible: boolean; bottom: number }) {
  const { c, t, theme } = useEk();
  const reduced = useReducedMotion();
  const cells = useCells(macros);
  const o = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      o.setValue(visible ? 1 : 0);
      return;
    }
    Animated.timing(o, { toValue: visible ? 1 : 0, duration: DURATION.fast, useNativeDriver: true }).start();
  }, [visible, o, reduced]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      accessibilityRole="summary"
      accessibilityLabel={`${t('eatkcal.v2.product.live_macros')}: ${cells.map((x) => `${x.label} ${x.value}`).join(', ')}`}
      style={[styles.strip, { bottom, opacity: o, borderColor: c.line }]}
      testID="ek-product-live-strip"
    >
      <BlurView intensity={40} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.isDark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.72)' }]}
      />
      {cells.map((cell) => (
        <View key={cell.key} style={styles.stripCell}>
          <ProgressRing progress={cell.progress} size={22} strokeWidth={3} color={c.accentLine} trackColor={c.line} />
          <View>
            <Text style={[ekType.c13, { color: c.secondary }]}>{cell.short}</Text>
            <Text style={[num, { color: c.ink }]} numberOfLines={1}>
              {cell.value}
            </Text>
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 4, padding: 12, borderRadius: 20 },
  cell: { flex: 1, alignItems: 'center', gap: 4 },
  strip: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 21,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stripCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
});
