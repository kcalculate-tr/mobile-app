import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ShoppingCart } from 'phosphor-react-native';

import { useCartStore } from '../store/cartStore';
import AnimatedNumberText from './AnimatedNumberText';
import {
  FLOATING_PILL_GAP,
  FLOATING_PILL_HEIGHT,
  TAB_BAR_TOTAL,
} from '../constants/layout';

type Props = {
  /** true: pill tab bar'ın üstüne konumlanır (Home gibi tab screen'ler). */
  aboveTabBar?: boolean;
  /** Ek alt boşluk (örn. ProductDetail sticky bar varsa). */
  bottomOffset?: number;
};

export default function FloatingCartPill({ aboveTabBar = false, bottomOffset = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const items = useCartStore((s) => s.items);

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const translateY = useRef(new Animated.Value(140)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (totalQty > 0) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 140,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [totalQty, translateY, opacity]);

  if (totalQty === 0) return null;

  const bottom =
    insets.bottom
    + (aboveTabBar ? TAB_BAR_TOTAL : 0)
    + FLOATING_PILL_GAP
    + bottomOffset;

  const priceLabel = totalPrice.toLocaleString('tr-TR', {
    minimumFractionDigits: totalPrice % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom, transform: [{ translateY }], opacity }]}
    >
      <Pressable
        onPress={() => {
          try {
            navigation.navigate('Tabs', { screen: 'Cart' });
          } catch {
            navigation.navigate('Cart');
          }
        }}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
        style={({ pressed }) => [
          styles.pill,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={styles.left}>
          <View style={styles.iconBadge}>
            <ShoppingCart size={16} color="#0A1F0F" weight="bold" />
          </View>
          <AnimatedNumberText style={styles.label} value={`${totalQty} ürün`} />
          <Text style={styles.labelSeparator}>—</Text>
          <AnimatedNumberText style={styles.label} value={`₺${priceLabel}`} />
        </View>
        <View style={styles.right}>
          <Text style={styles.cta}>Sepete Git</Text>
          <ArrowRight size={16} color="#0A1F0F" weight="bold" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    zIndex: 50,
  },
  pill: {
    height: FLOATING_PILL_HEIGHT,
    borderRadius: 999,
    backgroundColor: '#C6F04F',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  labelSeparator: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#0A1F0F',
    opacity: 0.5,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(10,31,15,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#0A1F0F',
    flexShrink: 1,
  },
  cta: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#0A1F0F',
  },
});
