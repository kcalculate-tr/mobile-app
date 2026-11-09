// eatkcal v2 — FinEkProduct TEK yüzen alt katman (Tur 26d/26e, FinMoProductBar).
// Kenar 12, alt 20, köşe 28, iç 10; yüzey %96 opak + bulanık (okunurluk ≥ 4,5:1).
// Üst satır (miktar + ad · kcal + P/K/Y ya da "Zorunlu seçimleri tamamla") 300 ms
// standard eğriyle açılır/kapanır: kapalı 72, açık 124 (10 + 44 + 8 + 52 + 10).
// Alt satır: adet −/+ (44) ve "Sepete ekle ([N] TL)" (52, 15 kalın). Eklenince aynı
// düğme lime "Sepete git" olur (eatkcal yayı: ölçek 1 → 1,04 → 1 500 ms, tik 0,4 → 1
// 300 ms). Seçim/adet değişince "Sepete ekle" 200 ms opaklıkla geri gelir.
// Ürün sayfasında yüzen sepet çubuğu YOK (yalnız FinEkHome ve FinEkStore).
// Azaltılmış hareket: yükseklik/ölçek/tik anında, yalnız 200 ms opaklık.
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { CaretRight, Check, Minus, Plus } from '../../../../../components/icons';
import { DURATION, RN_CURVE, fontFamily, haptic, useReducedMotion } from '../../../../../core/design';
import { ekType, money, useEk } from '../kit';
import type { DisplayMacros } from '../../model/productModel';

/** eatkcal yayı 200/28'in CSS karşılığı (FinMoTokens) — tek kaynak motion.tsx. */
const EAT_EASE = RN_CURVE.eat;
/** FinMoTokens standard (RN Animated karşılığı). */
export const STD_EASE = RN_CURVE.standard;
const TOP_H = 52; // 44 satır + 8 alt boşluk
export const LAYER_CLOSED_H = 72;
export const LAYER_OPEN_H = 124;

/** Final renkleri (FinEkProduct `c`): yüzey, kenar, pasif düğme, ikinci çizgi. */
export function layerColors(isDark: boolean) {
  return isDark
    ? { surf: 'rgba(28,28,30,0.96)', edge: 'rgba(255,255,255,0.12)', shadow: '#000000', nested: '#2C2C2E', line2: '#48484A', dis: '#2C2C2E', disText: '#A1A1A6' }
    : { surf: 'rgba(255,255,255,0.96)', edge: 'rgba(10,10,10,0.08)', shadow: '#0A0A0A', nested: '#E9EBEE', line2: '#C3C7CC', dis: '#DCDEE2', disText: '#45454A' };
}

/** Alt katmanın ekran altına uzaklığı: Final 20; büyük sistem çubuğunda (Android 3 düğme) üstüne çıkar. */
export function layerBottom(insetBottom: number): number {
  return insetBottom > 34 ? insetBottom + 8 : 20;
}

export function ProductBottomBar({
  quantity,
  onQuantity,
  price,
  ready,
  missing,
  open,
  added,
  infoAmount,
  infoName,
  macros,
  onAdd,
  onGoCart,
}: {
  quantity: number;
  onQuantity: (q: number) => void;
  /** Adet × birim — düğmede "Sepete ekle ([N] TL)". */
  price: number;
  ready: boolean;
  /** Eksik zorunlu seçimle eklemeye çalışıldı → üst satır "Zorunlu seçimleri tamamla". */
  missing: boolean;
  /** Üst satır açık mı (kaydırma > 500, seçim yapıldı ya da eksik uyarısı). */
  open: boolean;
  added: boolean;
  infoAmount: string;
  infoName?: string | null;
  /** Adet × makrolar; ürünün makro kartı yoksa null (kcal/P/K/Y gizli). */
  macros: DisplayMacros | null;
  onAdd: () => void;
  onGoCart: () => void;
}) {
  const { c, t, theme, insets } = useEk();
  const reduced = useReducedMotion();
  const lc = layerColors(theme.isDark);

  // ── Üst satır aç/kapa (yükseklik 300 standard, içerik 200 opaklık) ─────────
  const h = useRef(new Animated.Value(open ? TOP_H : 0)).current;
  const o = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      h.setValue(open ? TOP_H : 0);
      Animated.timing(o, { toValue: open ? 1 : 0, duration: DURATION.fast, easing: RN_CURVE.linear, useNativeDriver: false }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(h, { toValue: open ? TOP_H : 0, duration: DURATION.base, easing: STD_EASE, useNativeDriver: false }),
      Animated.timing(o, { toValue: open ? 1 : 0, duration: DURATION.fast, easing: STD_EASE, useNativeDriver: false }),
    ]).start();
  }, [open, reduced, h, o]);

  // ── Değer yuvarlanması (fiyat 300, makro 500) ─────────────────────────────
  const roll = useRef(new Animated.Value(1)).current;
  const firstRoll = useRef(true);
  useEffect(() => {
    if (firstRoll.current) {
      firstRoll.current = false;
      return;
    }
    roll.setValue(0);
    Animated.timing(roll, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.base, easing: reduced ? RN_CURVE.linear : EAT_EASE, useNativeDriver: true }).start();
  }, [price, reduced, roll]);
  const mroll = useRef(new Animated.Value(1)).current;
  const macroKey = macros ? `${Math.round(macros.kcal)}-${macros.protein}-${macros.carbs}-${macros.fats}` : '';
  const firstM = useRef(true);
  useEffect(() => {
    if (firstM.current) {
      firstM.current = false;
      return;
    }
    mroll.setValue(0);
    Animated.timing(mroll, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.slow, easing: reduced ? RN_CURVE.linear : STD_EASE, useNativeDriver: true }).start();
  }, [macroKey, reduced, mroll]);

  // ── Eklendi / geri dönüş ─────────────────────────────────────────────────
  const pop = useRef(new Animated.Value(1)).current;
  const chk = useRef(new Animated.Value(added ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const wasAdded = useRef(added);
  useEffect(() => {
    if (added && !wasAdded.current) {
      if (reduced) {
        fade.setValue(0);
        chk.setValue(1);
        Animated.timing(fade, { toValue: 1, duration: DURATION.fast, easing: RN_CURVE.linear, useNativeDriver: true }).start();
      } else {
        fade.setValue(1);
        pop.setValue(0);
        chk.setValue(0.4);
        Animated.parallel([
          // 1 → 1,04 → 1 tek slow 500 içinde (zirve %30'da).
          Animated.timing(pop, { toValue: 1, duration: DURATION.slow, easing: EAT_EASE, useNativeDriver: true }),
          Animated.timing(chk, { toValue: 1, duration: DURATION.base, easing: EAT_EASE, useNativeDriver: true }),
        ]).start();
      }
    } else if (!added && wasAdded.current) {
      // Geri dönüş: "Sepete ekle ([N] TL)" 200 ms opaklık.
      pop.setValue(1);
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: DURATION.fast, easing: reduced ? RN_CURVE.linear : STD_EASE, useNativeDriver: true }).start();
    }
    wasAdded.current = added;
  }, [added, reduced, pop, chk, fade]);

  const step = (d: number) => {
    const next = Math.max(1, Math.min(99, quantity + d));
    if (next === quantity) return;
    haptic('selection');
    onQuantity(next);
  };

  const rollStyle = {
    opacity: roll,
    transform: reduced ? [] : [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const mrollStyle = {
    opacity: mroll,
    transform: reduced ? [] : [{ translateY: mroll.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const chip = (label: string, v: number) => (
    <View style={[styles.chip, { backgroundColor: lc.nested }]}>
      <Text style={[styles.chipText, ekType.num, { color: c.ink }]}>{`${label} ${Math.round(v)}`}</Text>
    </View>
  );

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={t('eatkcal.v2.product.add_to_cart')}
      style={[
        styles.layer,
        {
          bottom: layerBottom(insets.bottom),
          backgroundColor: Platform.OS === 'android' ? lc.surf : 'transparent',
          borderColor: lc.edge,
          shadowColor: lc.shadow,
          shadowOpacity: theme.isDark ? 0.5 : 0.16,
        },
      ]}
      testID="ek-product-bar"
    >
      {Platform.OS === 'ios' ? (
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
          <BlurView intensity={24} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: lc.surf }]} />
        </View>
      ) : null}

      <Animated.View style={{ height: h, overflow: 'hidden' }}>
        <Animated.View
          accessibilityLiveRegion="polite"
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
          style={[styles.top, { opacity: o, borderBottomColor: c.line }]}
          testID="ek-product-layer-top"
        >
          {missing ? (
            <Text style={[styles.b15, { color: c.ink }]} numberOfLines={1}>
              {t('eatkcal.v2.product.complete_required')}
            </Text>
          ) : (
            <>
              <View style={styles.infoCol}>
                <Text style={[styles.b15, ekType.num, { color: c.ink }]} numberOfLines={1}>
                  {infoAmount}
                </Text>
                {infoName ? (
                  <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
                    {infoName}
                  </Text>
                ) : null}
              </View>
              {macros ? (
                <Animated.View style={[styles.macroRow, mrollStyle]} testID="ek-product-layer-macros">
                  <Text style={[styles.b15, ekType.num, { color: c.ink, marginRight: 2 }]}>
                    {t('eatkcal.v2.product.kcal_n', { n: Math.round(macros.kcal) })}
                  </Text>
                  {chip(t('eatkcal.v2.common.p'), macros.protein)}
                  {chip(t('eatkcal.v2.common.k'), macros.carbs)}
                  {chip(t('eatkcal.v2.common.y'), macros.fats)}
                </Animated.View>
              ) : null}
            </>
          )}
        </Animated.View>
      </Animated.View>

      <View style={styles.row}>
        <View style={[styles.stepper, { borderColor: lc.line2 }]} accessibilityRole="none" accessibilityLabel={t('eatkcal.v2.product.qty')}>
          <Pressable
            onPress={() => step(-1)}
            disabled={quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.product.decrease')}
            accessibilityState={{ disabled: quantity <= 1 }}
            style={styles.stepBtn}
            testID="ek-product-qty-minus"
          >
            <Minus size={18} color={quantity <= 1 ? c.secondary : c.ink} />
          </Pressable>
          <Text style={[styles.qty, ekType.num, { color: c.ink }]} accessibilityLiveRegion="polite">
            {quantity}
          </Text>
          <Pressable
            onPress={() => step(1)}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.product.increase')}
            style={styles.stepBtn}
            testID="ek-product-qty-plus"
          >
            <Plus size={18} color={c.ink} />
          </Pressable>
        </View>

        {added ? (
          <Animated.View style={[styles.ctaWrap, { opacity: fade, transform: [{ scale: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.04, 1] }) }] }]}>
            <Pressable
              onPress={onGoCart}
              accessibilityRole="link"
              accessibilityLabel={t('eatkcal.v2.product.go_cart')}
              accessibilityHint={t('eatkcal.v2.product.added_a11y')}
              style={[styles.cta, { backgroundColor: c.accent, gap: 8 }]}
              testID="ek-product-go-cart"
            >
              <Animated.View style={[styles.chk, { opacity: chk, transform: [{ scale: chk }] }]}>
                <Check size={13} color="#C6F04F" weight="bold" />
              </Animated.View>
              <Text style={[styles.ctaText, { color: c.onAccent }]} numberOfLines={1}>
                {t('eatkcal.v2.product.go_cart')}
              </Text>
              <CaretRight size={16} color={c.onAccent} />
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.ctaWrap, { opacity: fade }]}>
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={t('eatkcal.v2.product.add_with_price', { amount: money(price) })}
              accessibilityState={{ disabled: !ready }}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: ready ? c.ink : lc.dis, transform: [{ scale: pressed && ready && !reduced ? 0.97 : 1 }] },
              ]}
              testID="ek-product-add"
            >
              <Text style={[styles.ctaText, ekType.num, { color: ready ? c.surface : lc.disText }]} numberOfLines={1}>
                {`${t('eatkcal.v2.product.add_to_cart')} (`}
              </Text>
              <Animated.View style={rollStyle}>
                <Text style={[styles.ctaText, ekType.num, { color: ready ? c.surface : lc.disText }]} numberOfLines={1}>
                  {money(price)}
                </Text>
              </Animated.View>
              <Text style={[styles.ctaText, { color: ready ? c.surface : lc.disText }]}>)</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    padding: 10,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  clip: { borderRadius: 28, overflow: 'hidden' },
  top: {
    height: 44,
    marginBottom: 8,
    paddingHorizontal: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoCol: { flexShrink: 1, minWidth: 0 },
  b15: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  chip: { height: 22, paddingHorizontal: 6, borderRadius: 11, justifyContent: 'center' },
  chipText: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 17 },
  row: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: { height: 44, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 20, textAlign: 'center', fontFamily: fontFamily.bodyBold, fontSize: 16 },
  ctaWrap: { flex: 1, minWidth: 0 },
  cta: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  ctaText: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 20 },
  chk: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
});
