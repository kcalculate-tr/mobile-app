import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: '#e0e0e0', opacity },
        style,
      ]}
    />
  );
}

export function SkeletonProductCard() {
  return (
    <View style={sk.productCard}>
      <SkeletonLoader height={160} borderRadius={12} />
      <SkeletonLoader height={16} width="70%" />
      <SkeletonLoader height={12} width="40%" />
    </View>
  );
}

export function SkeletonOrderCard() {
  return (
    <View style={sk.orderCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkeletonLoader height={14} width="40%" />
        <SkeletonLoader height={14} width="20%" />
      </View>
      <SkeletonLoader height={12} width="60%" />
      <SkeletonLoader height={12} width="30%" />
    </View>
  );
}

const sk = StyleSheet.create({
  productCard: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 10,
  },
  orderCard: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 8,
  },
});
