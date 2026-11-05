// eatkcal v2 — FinEkProduct seçenek kutusu (136×184, 18 köşe). Seçili: lime
// dolgu + koyu metin + sağ üstte onay rozeti (chkIn: bouncy). Görsel: seçeneğin
// ürün fotoğrafı varsa o; yoksa yer tutucu "çıkartma çerçevesi" + ad (gerçek
// çıkartmalar sonra gelecek).
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from '../../../../../components/icons';
import { CachedImage } from '../../../../../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../../../../../lib/imageUrl';
import { haptic, useReducedMotion } from '../../../../../core/design';
import { ekType, money, useEk } from '../kit';

export interface OptionCardModel {
  key: string;
  name: string;
  /** Fiyat farkı (0 → "—"). */
  priceDelta: number;
  /** Mutlak kcal (bundle/linked kalem) — yoksa null. */
  kcal: number | null;
  /** kcal farkı (template/gramaj modifikatörü) — yoksa null/0. */
  kcalDelta?: number | null;
  imageUrl?: string | null;
  selected: boolean;
  disabled: boolean;
}

export function OptionCard({
  model,
  multi,
  onPress,
}: {
  model: OptionCardModel;
  multi: boolean;
  onPress: () => void;
}) {
  const { c, t, theme } = useEk();
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(model.selected ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      pop.setValue(model.selected ? 1 : 0);
      return;
    }
    if (model.selected) {
      pop.setValue(0.4);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 14, mass: 1 }).start();
    } else {
      pop.setValue(0);
    }
  }, [model.selected, pop, reduced]);

  const fg = model.selected ? c.onAccent : c.ink;
  const priceText = model.priceDelta > 0 ? `+${money(model.priceDelta)}` : model.priceDelta < 0 ? `−${money(-model.priceDelta)}` : t('eatkcal.v2.product.no_diff');
  let kcalText: string | null = null;
  if (model.kcal != null) kcalText = t('eatkcal.v2.product.kcal_n', { n: model.kcal });
  else if (model.kcalDelta) kcalText = `${model.kcalDelta > 0 ? '+' : '−'}${t('eatkcal.v2.product.kcal_n', { n: Math.abs(Math.round(model.kcalDelta)) })}`;
  const uri = model.imageUrl ? transformImageUrl(model.imageUrl, ImagePreset.productCard) ?? model.imageUrl : null;
  const initials = model.name.trim().split(/\s+/)[0] ?? '';

  return (
    <Pressable
      onPress={() => {
        if (model.disabled) return;
        haptic('selection');
        onPress();
      }}
      disabled={model.disabled}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: model.selected, disabled: model.disabled }}
      accessibilityLabel={[model.name, priceText !== '—' ? priceText : null, kcalText].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: model.selected ? c.accent : c.surface,
          borderColor: model.selected ? 'transparent' : c.line,
          opacity: model.disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
      testID={`ek-option-${model.key}`}
    >
      <View style={styles.media}>
        {uri ? (
          <CachedImage uri={uri} style={styles.photo} contentFit="cover" />
        ) : (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.sticker,
              {
                backgroundColor: theme.isDark ? c.surfaceRaised : c.line,
                borderColor: theme.isDark ? c.line : c.surfaceRaised,
              },
            ]}
          >
            <Text style={[ekType.c13s, { color: c.secondary, textAlign: 'center' }]} numberOfLines={2}>
              {initials}
            </Text>
          </View>
        )}
      </View>
      <Text style={[ekType.b15s, { color: fg, lineHeight: 19 }]} numberOfLines={3}>
        {model.name}
      </Text>
      <View style={styles.foot}>
        <Text style={[ekType.c13s, ekType.num, { color: fg }]}>{priceText}</Text>
        {kcalText ? (
          <Text style={[ekType.c13, ekType.num, { color: fg, opacity: 0.72 }]} numberOfLines={1}>
            {kcalText}
          </Text>
        ) : null}
      </View>
      {model.selected ? (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.check, { backgroundColor: c.ink, transform: [{ scale: pop }] }]}
        >
          <Check size={14} color={c.surface} weight="bold" />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 136,
    minHeight: 184,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
  },
  media: { marginTop: 2, marginBottom: 6 },
  photo: { width: 64, height: 64, borderRadius: 14 },
  sticker: {
    width: 64,
    height: 64,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 36,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
  },
  foot: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  check: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
