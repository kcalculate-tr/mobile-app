// G18-S2 md.2 — FinMoPopover: "<Öğün>'e logla ⌄" çentiği alttan sheet AÇMAZ;
// çentiğe bağlı YERİNDE menü (MLMealMenu).
//   Boyut 240 × 293, köşe 20, iç pay 6; satır ve porsiyon çipi 44.
//   Yüzey #FFFFFF / #1C1C1E + 1 pt çizgi + gölge 0 8 24 (cam değil, düz yüzen katman).
//   Açılış 200 ms opaklık 0→1 + ölçek 0.98→1, kapanış 200 ms ters; eğri standard;
//   köken chevron merkezi. Karartma YOK (şeffaf tam ekran yakalayıcı; dokunuş
//   alttakine geçmez). Öğün seçince etiket güncellenir + 200 ms'de kapanır;
//   porsiyon değişince AÇIK kalır. Altta yer yoksa yukarı açılır, sağa taşarsa
//   sola kayar (16 pt pay). Azaltılmış: yalnız opaklık 200 ms. Haptik: seçim.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { CURVE, DURATION, REDUCED, haptic, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { useHomeTokens } from '../../onboarding/first/homeTokens';
import type { SlotKey } from '../homeData';
import { placePopover, POP_W, POP_H, PORTIONS, type Rect } from './popoverGeometry';

const MEALS: SlotKey[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const CHECK_D =
  'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';

export interface MealMenuPopoverProps {
  /** Açıkken çentiğin pencere koordinatları (measureInWindow). null → kapalı. */
  anchor: Rect | null;
  meal: SlotKey;
  portion: number;
  onPickMeal: (m: SlotKey) => void;
  onPickPortion: (p: number) => void;
  /** Kapanış animasyonu bitince (dışarı dokunma / öğün seçimi). */
  onClosed: () => void;
  /** Yalnız vitrin (__DEV__): açıldıktan N ms sonra kendiliğinden kapanır (kare dizisi çekimi). */
  autoCloseMs?: number;
}

export function MealMenuPopover({ anchor, meal, portion, onPickMeal, onPickPortion, onClosed, autoCloseMs }: MealMenuPopoverProps) {
  const k = useHomeTokens();
  const { t: tt } = useT();
  const reduced = useReducedMotion();
  const win = useWindowDimensions();
  const op = useSharedValue(0);
  const sc = useSharedValue(reduced ? 1 : 0.98);
  const [closing, setClosing] = useState(false);
  const visible = anchor != null;

  useEffect(() => {
    if (!visible) return;
    setClosing(false);
    const d = reduced ? REDUCED.duration : DURATION.fast;
    sc.value = reduced ? 1 : 0.98;
    op.value = 0;
    op.value = withTiming(1, { duration: d, easing: reduced ? undefined : CURVE.standard });
    if (!reduced) sc.value = withTiming(1, { duration: d, easing: CURVE.standard });
  }, [visible, reduced, op, sc]);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const d = reduced ? REDUCED.duration : DURATION.fast;
    if (!reduced) sc.value = withTiming(0.98, { duration: d, easing: CURVE.standard });
    op.value = withTiming(0, { duration: d, easing: reduced ? undefined : CURVE.standard }, (fin) => {
      if (fin) runOnJS(onClosed)();
    });
  }, [closing, reduced, op, sc, onClosed]);

  useEffect(() => {
    if (!__DEV__ || !visible || !autoCloseMs) return;
    const id = setTimeout(close, autoCloseMs);
    return () => clearTimeout(id);
  }, [visible, autoCloseMs, close]);

  const anim = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  if (!anchor) return null;
  const place = placePopover(anchor, { width: win.width, height: win.height });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      {/* Şeffaf yakalayıcı — karartma yok; dokunuş alttakine geçmez. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityElementsHidden importantForAccessibility="no" testID="meal-menu-catcher" />
      <Animated.View
        accessibilityRole="menu"
        accessibilityLabel={tt('home.menu_aria')}
        pointerEvents={closing ? 'none' : 'auto'}
        style={[
          styles.menu,
          {
            left: place.left,
            top: place.top,
            backgroundColor: k.card,
            borderColor: k.line,
            shadowOpacity: k.isDark ? 0.5 : 0.12,
            transformOrigin: [place.originX, place.up ? POP_H : 0, 0],
          },
          anim,
        ]}
        testID="meal-menu"
      >
        <View accessibilityRole="radiogroup" accessibilityLabel={tt('home.menu_meal')}>
          <AppText style={[styles.groupLabel, { color: k.sec }]} importantForAccessibility="no">
            {tt('home.menu_meal')}
          </AppText>
          {MEALS.map((m) => {
            const on = m === meal;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  haptic('selection');
                  onPickMeal(m);
                  close();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={styles.row}
                testID={`meal-menu-${m}`}
              >
                <AppText style={[styles.rowText, { color: k.text, fontFamily: on ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' }]}>
                  {tt(`meal.${m}`)}
                </AppText>
                {on ? (
                  <Svg width={18} height={18} viewBox="0 0 256 256">
                    <Path d={CHECK_D} fill={k.text} />
                  </Svg>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.sep, { backgroundColor: k.line }]} />
        <View accessibilityRole="radiogroup" accessibilityLabel={tt('home.menu_portion')}>
          <AppText style={[styles.groupLabel, { color: k.sec }]} importantForAccessibility="no">
            {tt('home.menu_portion')}
          </AppText>
          <View style={styles.chips}>
            {PORTIONS.map((p) => {
              const on = p.value === portion;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => {
                    haptic('selection');
                    onPickPortion(p.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={tt(`home.portion_${p.key}`)}
                  style={[styles.chip, { backgroundColor: on ? k.ink : 'transparent', borderColor: on ? k.ink : k.line2 }]}
                  testID={`meal-menu-portion-${p.key}`}
                >
                  <AppText style={[styles.chipText, { color: on ? k.onInk : k.text }]}>{p.label}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

/** Çentiğin konumunu ölçmek için ref + ölç yardımcısı. */
export function useAnchorMeasure() {
  const ref = useRef<View>(null);
  const measure = useCallback(
    () =>
      new Promise<Rect | null>((resolve) => {
        const node = ref.current;
        if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
        node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
      }),
    [],
  );
  return { ref, measure };
}

export { POP_W };

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: POP_W,
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
  },
  groupLabel: { height: 24, paddingHorizontal: 10, fontSize: 13, lineHeight: 24, fontFamily: 'PlusJakartaSans_600SemiBold' },
  row: { height: 44, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowText: { fontSize: 15, lineHeight: 20 },
  sep: { height: 1, marginVertical: 6, marginHorizontal: 4 },
  chips: { flexDirection: 'row', gap: 4 },
  chip: { flex: 1, minWidth: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, lineHeight: 18, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
