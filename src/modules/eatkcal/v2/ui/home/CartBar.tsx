// eatkcal v2 — yüzen lime sepet çubuğu (Tur 26 md.12, FinMoCart). YALNIZ FinEkHome
// ve FinEkStore; ürün sayfasında YOK (orada tek alt katman "Sepete git" olur).
// 16 Kas: sağda sabit 56 yuvarlak (çanta + adet rozeti); dokununca sola açılır (toplam), tekrar dokununca sepet, düz lime dolgu (cam yok), metin mürekkep.
// Sol "Sepet (N)", orta toplam (Bricolage 17), sağ "Sepete git ›". Tamamı tek
// bağlantı → EkCart. Konum: sekme çubuğunun üst kenarından 12 yukarıda (Tara
// dairesiyle çakışmaz); sekme çubuğu yoksa güvenli alanın 12 üstü.
// Hareket (FinMoCart): ilk görünme eatkcal yayı 200/28 (y 16 → 0 + opaklık);
// her eklemede ölçek 1 → 1,03 → 1 (300 ms) + sayı/toplam yukarı yuvarlanır;
// sepet boşalınca 200 ms çıkış. Azaltılmış: yalnız 200 ms opaklık.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { formatCount } from '../../../../../core/design/components/CountPill';
import { CaretRight, ShoppingBag } from '../../../../../components/icons';
import { DURATION, RN_CURVE, SPRING, fontFamily, haptic, useReducedMotion } from '../../../../../core/design';
import { useCartStore } from '../../../../../store/cartStore';
import { TAB_BAR_R3, tabBarBottomOffset } from '../../../../shell/layout';
import { ekType, money, useEk } from '../kit';
import { palette } from '../../../../../core/design/tokens';

const EAT_EASE = RN_CURVE.eat;
const EXIT_EASE = RN_CURVE.exit;
export const CART_BAR_H = 56;
/** 16 Kas: açılınca toplam alanının en geniş hâli (pt). */
const OPEN_W = 150;
/** Açık hâl bu süre sonra kendiliğinden kapanır (ms). */
const AUTO_CLOSE_MS = 4000;
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
  // 16 Kas (İlter): sağda yuvarlak düğme. 1. dokunuş → sola açılır, toplamı gösterir;
  // açıkken 2. dokunuş → sepete gider. Ekran okuyucu açıkken tek dokunuş doğrudan sepete.
  const [open, setOpen] = useState(false);
  const openAnim = useRef(new Animated.Value(0)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const srOn = useRef(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled?.()
      .then((v) => {
        if (alive) srOn.current = !!v;
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);
  useEffect(() => {
    if (reduced) openAnim.setValue(open ? 1 : 0);
    else Animated.timing(openAnim, { toValue: open ? 1 : 0, duration: DURATION.fast, easing: open ? EAT_EASE : EXIT_EASE, useNativeDriver: false }).start();
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open) closeTimer.current = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
  }, [open, reduced, openAnim]);
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

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
        Animated.timing(enter, { toValue: 1, duration: DURATION.fast, easing: RN_CURVE.linear, useNativeDriver: true }).start();
      } else {
        Animated.spring(enter, { toValue: 1, useNativeDriver: true, ...SPRING.eat }).start();
      }
    } else {
      Animated.timing(enter, { toValue: 0, duration: DURATION.fast, easing: reduced ? RN_CURVE.linear : EXIT_EASE, useNativeDriver: true }).start(
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
      Animated.timing(roll, { toValue: 1, duration: DURATION.fast, easing: RN_CURVE.linear, useNativeDriver: true }).start();
      return;
    }
    pop.setValue(0);
    Animated.parallel([
      // (pop 0 → 1 ilerleme; ölçek interpolasyonla)
      // 1 → 1,03 → 1 tek base 300 içinde (zirve %35'te).
      Animated.timing(pop, { toValue: 1, duration: DURATION.base, easing: EAT_EASE, useNativeDriver: true }),
      Animated.timing(roll, { toValue: 1, duration: DURATION.base, easing: EAT_EASE, useNativeDriver: true }),
    ]).start();
  }, [count, reduced, pop, roll]);

  if (!mounted) return null;

  const rollStyle = {
    opacity: roll,
    transform: reduced ? [] : [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
    const a11yCount = t('eatkcal.v2.home.cart_count', { count });

  const totalW = openAnim.interpolate({ inputRange: [0, 1], outputRange: [0, OPEN_W] });

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
            : [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: pop.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.06, 1] }) }],
        },
      ]}
      testID="ek-cart-bar"
    >
      <Pressable
        onPress={() => {
          haptic('light');
          if (open || srOn.current) {
            setOpen(false);
            onPress();
          } else {
            setOpen(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`${a11yCount}, ${money(total)}`}
        accessibilityHint={t('eatkcal.v2.home.go_cart')}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.bar,
          { shadowColor: theme.isDark ? '#000000' : '#0A0A0A', shadowOpacity: theme.isDark ? 0.5 : 0.18, opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <Animated.View style={[styles.totalBox, { width: totalW, opacity: openAnim }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Animated.View style={[styles.totalRow, rollStyle]}>
            <Text style={[styles.total, ekType.num, { color: c.onAccent }]} numberOfLines={1} testID="ek-cart-bar-total">
              {money(total)}
            </Text>
            <CaretRight size={16} color={c.onAccent} weight="bold" />
          </Animated.View>
        </Animated.View>
        <View style={styles.iconBox}>
          <ShoppingBag size={24} color={c.onAccent} weight="bold" />
          <View style={[styles.badge, { backgroundColor: c.onAccent }]} testID="ek-cart-bar-count" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text style={[styles.badgeText, { color: palette.lime }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {formatCount(count)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, zIndex: 26, alignItems: 'flex-end' },
  bar: {
    height: CART_BAR_H,
    minWidth: CART_BAR_H,
    borderRadius: CART_BAR_H / 2,
    backgroundColor: palette.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  totalBox: { overflow: 'hidden', height: CART_BAR_H, justifyContent: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 18, width: OPEN_W },
  total: { fontFamily: fontFamily.headingBold, fontSize: 16, lineHeight: 21 },
  iconBox: { width: CART_BAR_H, height: CART_BAR_H, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, right: 7, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fontFamily.bodyBold, fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
});
