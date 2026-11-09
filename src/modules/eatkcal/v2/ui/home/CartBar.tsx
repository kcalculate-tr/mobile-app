// eatkcal v2 — yüzen lime sepet çubuğu (Tur 26 md.12, FinMoCart). YALNIZ FinEkHome
// ve FinEkStore; ürün sayfasında YOK (orada tek alt katman "Sepete git" olur).
// Yükseklik 56, yan 16, köşe 28, düz lime dolgu (cam yok), metin mürekkep.
// Sol "Sepet (N)", orta toplam (Bricolage 17), sağ "Sepete git ›". Tamamı tek
// bağlantı → EkCart. Konum: sekme çubuğunun üst kenarından 12 yukarıda (Tara
// dairesiyle çakışmaz); sekme çubuğu yoksa güvenli alanın 12 üstü.
// Hareket (FinMoCart): ilk görünme eatkcal yayı 200/28 (y 16 → 0 + opaklık);
// her eklemede ölçek 1 → 1,03 → 1 (300 ms) + sayı/toplam yukarı yuvarlanır;
// sepet boşalınca 200 ms çıkış. Azaltılmış: yalnız 200 ms opaklık.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { CaretRight } from '../../../../../components/icons';
import { DURATION, SPRING, fontFamily, haptic, useReducedMotion } from '../../../../../core/design';
import { useCartStore } from '../../../../../store/cartStore';
import { TAB_BAR_R3, tabBarBottomOffset } from '../../../../shell/layout';
import { ekType, money, useEk } from '../kit';

const EAT_EASE = Easing.bezier(0.25, 0.9, 0.3, 1);
const EXIT_EASE = Easing.bezier(0.3, 0, 0.8, 0.15);
export const CART_BAR_H = 56;
export const CART_BAR_GAP = 12;

/** Çubuğun ekran altına uzaklığı: sekme çubuğu varsa onun üst kenarı + 12, yoksa güvenli alan + 12. */
export function cartBarBottom(insetBottom: number, overTabBar: boolean): number {
  return overTabBar
    ? tabBarBottomOffset(insetBottom) + TAB_BAR_R3.PILL_HEIGHT + CART_BAR_GAP
    : insetBottom + CART_BAR_GAP;
}

/** Çubuk görünürken liste altına bırakılacak pay (son kart çubuğun altında kalmasın). */
export function cartBarContentPad(insetBottom: number, overTabBar: boolean): number {
  return cartBarBottom(insetBottom, overTabBar) + CART_BAR_H + CART_BAR_GAP;
}

/** Sepetteki adet toplamı + ara toplam (cartStore'un kendi hesabı). */
export function useCartSummary(): { count: number; total: number } {
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const count = items.reduce((n, it) => n + (Number(it.quantity) || 0), 0);
  // items değiştikçe yeniden hesaplanır (getSubtotal mevcut sepet formülü).
  const total = count > 0 ? getSubtotal() : 0;
  return { count, total };
}

export function EkCartBar({ bottom, onPress }: { /** Ekran altına uzaklık (cartBarBottom). */ bottom: number; onPress: () => void }) {
  const { c, t, theme } = useEk();
  const reduced = useReducedMotion();
  const { count, total } = useCartSummary();
  const visible = count > 0;
  const [mounted, setMounted] = useState(visible);

  const enter = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const roll = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  // Görünme / gizlenme
  useEffect(() => {
    if (visible) {
      setMounted(true);
      enter.setValue(0);
      if (reduced) {
        Animated.timing(enter, { toValue: 1, duration: DURATION.fast, easing: Easing.linear, useNativeDriver: true }).start();
      } else {
        Animated.spring(enter, { toValue: 1, useNativeDriver: true, ...SPRING.eat }).start();
      }
    } else {
      Animated.timing(enter, { toValue: 0, duration: DURATION.fast, easing: reduced ? Easing.linear : EXIT_EASE, useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Güncelleme: her eklemede kısa ölçek + yuvarlanma
  useEffect(() => {
    const before = prevCount.current;
    prevCount.current = count;
    if (before === 0 || count === 0 || before === count) return;
    roll.setValue(0);
    if (reduced) {
      Animated.timing(roll, { toValue: 1, duration: DURATION.fast, easing: Easing.linear, useNativeDriver: true }).start();
      return;
    }
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.03, duration: 105, easing: EAT_EASE, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1, duration: 195, easing: EAT_EASE, useNativeDriver: true }),
      ]),
      Animated.timing(roll, { toValue: 1, duration: DURATION.base, easing: EAT_EASE, useNativeDriver: true }),
    ]).start();
  }, [count, reduced, pop, roll]);

  if (!mounted) return null;

  const rollStyle = {
    opacity: roll,
    transform: reduced ? [] : [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const label = t('eatkcal.v2.home.cart_n', { count });

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        {
          bottom,
          opacity: enter,
          transform: reduced
            ? []
            : [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: pop }],
        },
      ]}
      testID="ek-cart-bar"
    >
      <Pressable
        onPress={() => {
          haptic('light');
          onPress();
        }}
        accessibilityRole="link"
        accessibilityLabel={`${label}, ${money(total)}, ${t('eatkcal.v2.home.go_cart')}`}
        style={({ pressed }) => [
          styles.bar,
          { shadowColor: theme.isDark ? '#000000' : '#0A0A0A', shadowOpacity: theme.isDark ? 0.5 : 0.16, opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <Animated.View style={[styles.side, rollStyle]}>
          <Text style={[styles.b15, ekType.num, { color: c.onAccent }]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
        <Animated.View style={rollStyle}>
          <Text style={[styles.total, ekType.num, { color: c.onAccent }]} numberOfLines={1} testID="ek-cart-bar-total">
            {money(total)}
          </Text>
        </Animated.View>
        <View style={[styles.side, styles.end]}>
          <Text style={[styles.go, { color: c.onAccent }]} numberOfLines={1}>
            {t('eatkcal.v2.home.go_cart')}
          </Text>
          <CaretRight size={16} color={c.onAccent} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 26 },
  bar: {
    height: CART_BAR_H,
    borderRadius: 28,
    backgroundColor: '#C6F04F',
    paddingLeft: 20,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  side: { flex: 1, minWidth: 0 },
  end: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  b15: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 20 },
  total: { fontFamily: fontFamily.headingBold, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  go: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20 },
});
