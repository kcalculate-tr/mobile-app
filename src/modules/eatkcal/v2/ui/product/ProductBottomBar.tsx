// eatkcal v2 — FinEkProduct alt sabit bar (cam): adet ± (44×44) · fiyat
// (indirimliyse eski fiyat üstü çizili + rozet) · alt satır "Toplam · N kcal"
// ya da "Zorunlu seçimleri tamamla" · "Sepete ekle" (52). Eksik seçimde
// buton pasif görünür ama dokunulabilir: dokununca eksik gruplar vurgulanır.
// FinMoCart: dokun 0.97 → "Sepette ✓" (eatkcal yayı); azaltılmış harekette ölçek yok.
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { Check, Minus, Plus } from '../../../../../components/icons';
import { SPRING, haptic, useReducedMotion } from '../../../../../core/design';
import { EkStickyBar, ekType, money, useEk } from '../kit';

export function ProductBottomBar({
  quantity,
  onQuantity,
  price,
  originalPrice,
  discountBadge,
  subline,
  ready,
  added,
  onAdd,
}: {
  quantity: number;
  onQuantity: (q: number) => void;
  price: number;
  originalPrice: number | null;
  discountBadge: string | null;
  subline: string;
  ready: boolean;
  added: boolean;
  onAdd: () => void;
}) {
  const { c, t } = useEk();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) => {
    if (reduced) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, ...SPRING.eat }).start();
  };
  const step = (d: number) => {
    const next = Math.max(1, Math.min(99, quantity + d));
    if (next === quantity) return;
    haptic('selection');
    onQuantity(next);
  };
  const ctaBg = ready ? c.ink : c.line;
  const ctaFg = ready ? c.surface : c.secondary;
  return (
    <EkStickyBar testID="ek-product-bar">
      <View style={styles.row}>
        <View style={[styles.stepper, { borderColor: c.line }]}>
          <Pressable
            onPress={() => step(-1)}
            disabled={quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.product.decrease')}
            accessibilityState={{ disabled: quantity <= 1 }}
            style={[styles.stepBtn, quantity <= 1 && { opacity: 0.4 }]}
            testID="ek-product-qty-minus"
          >
            <Minus size={18} color={c.ink} />
          </Pressable>
          <Text style={[ekType.b17, ekType.num, styles.qty, { color: c.ink }]} accessibilityLabel={String(quantity)}>
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
        <View style={styles.priceCol}>
          <View style={styles.priceRow}>
            {originalPrice != null ? (
              <Text style={[ekType.c13, ekType.num, { color: c.secondary, textDecorationLine: 'line-through' }]}>
                {money(originalPrice)}
              </Text>
            ) : null}
            <Text style={[ekType.b17, ekType.num, { color: c.ink }]} numberOfLines={1}>
              {money(price)}
            </Text>
            {discountBadge ? (
              <View style={[styles.badge, { backgroundColor: c.accent }]}>
                <Text style={[ekType.c13s, { color: c.onAccent }]}>{discountBadge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
            {subline}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={onAdd}
            onPressIn={() => springTo(0.97)}
            onPressOut={() => springTo(1)}
            accessibilityRole="button"
            accessibilityLabel={added ? t('eatkcal.v2.product.added_a11y') : t('eatkcal.v2.product.add_to_cart')}
            accessibilityState={{ disabled: !ready }}
            style={[styles.cta, { backgroundColor: added ? c.accent : ctaBg }]}
            testID="ek-product-add"
          >
            {added ? (
              <View style={styles.addedRow}>
                <Text style={[ekType.b15s, { color: c.onAccent }]}>{t('eatkcal.v2.product.in_cart')}</Text>
                <Check size={16} color={c.onAccent} weight="bold" />
              </View>
            ) : (
              <Text style={[ekType.b15s, { color: ctaFg }]} numberOfLines={1}>
                {t('eatkcal.v2.product.add_to_cart')}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </EkStickyBar>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { height: 44, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 20, textAlign: 'center' },
  priceCol: { flex: 1, minWidth: 0 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  badge: { minHeight: 22, paddingHorizontal: 6, borderRadius: 11, justifyContent: 'center' },
  cta: { height: 52, paddingHorizontal: 20, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
