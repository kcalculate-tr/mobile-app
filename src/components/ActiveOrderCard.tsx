import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CaretRight, CheckCircle, CookingPot, Package, Receipt, Scooter } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { ORDER_STEPS, stepIndexOf, type ActiveOrder } from '../lib/activeOrder';

const STEP_ICONS = [Receipt, CookingPot, Scooter, Package];

// Kompakt kartta tek satır başlık — açıklama satırı kaldırıldı (yer kaplıyordu).
const STEP_HEADLINE: Record<string, { title: string }> = {
  confirmed: { title: 'Siparişin onaylandı' },
  preparing: { title: 'Siparişin hazırlanıyor' },
  on_way:    { title: 'Siparişin yolda' },
  delivered: { title: 'Siparişin teslim edildi' },
};

interface ActiveOrderCardProps {
  order: ActiveOrder;
  onPress?: () => void;
}

/**
 * Anasayfanın en üstünde duran canlı sipariş takip kartı.
 * Kademeler orders.status'tan geliyor (Realtime ile anlık güncelleniyor);
 * teslim edildikten kısa süre sonra kart kendiliğinden kayboluyor.
 */
export default function ActiveOrderCard({ order, onPress }: ActiveOrderCardProps) {
  const current = stepIndexOf(order.status);
  const isDelivered = order.status === 'delivered';
  const headline = STEP_HEADLINE[order.status] ?? STEP_HEADLINE.confirmed;

  // Dolum çizgisi: adım değiştikçe yumuşak ilerler.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: current / (ORDER_STEPS.length - 1),
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [current, progress]);

  // Aktif adımın ikonunda yavaş bir nabız — kartın "canlı" olduğunu belli eder.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isDelivered) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isDelivered, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.92 : 1} onPress={onPress} style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title} numberOfLines={1}>{headline.title}</Text>
        <Text style={styles.meta}>₺{order.totalAmount.toFixed(2)}</Text>
        <CaretRight size={13} color="rgba(255,255,255,0.45)" weight="bold" />
      </View>

      {/* Kademeler */}
      <View style={styles.stepsWrap}>
        <View style={styles.track} />
        <Animated.View style={[styles.trackFill, { width: fillWidth }]} />

        <View style={styles.stepsRow}>
          {ORDER_STEPS.map((step, i) => {
            const Icon = STEP_ICONS[i];
            const done = i < current;
            const active = i === current;
            const reached = done || active;
            return (
              <View key={step.key} style={styles.step}>
                <Animated.View
                  style={[
                    styles.stepCircle,
                    reached && styles.stepCircleReached,
                    active && !isDelivered && { transform: [{ scale: pulseScale }] },
                  ]}
                >
                  {done ? (
                    <CheckCircle size={12} color="#000000" weight="fill" />
                  ) : (
                    <Icon size={12} color={reached ? '#000000' : 'rgba(255,255,255,0.45)'} weight="bold" />
                  )}
                </Animated.View>
                <Text style={[styles.stepLabel, reached && styles.stepLabelReached]} numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Kompakt kart — duyuru şeridinin hemen üstünde, anasayfada yer kaplamasın.
  card: {
    backgroundColor: '#101010',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  meta: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  stepsWrap: { position: 'relative', justifyContent: 'center' },
  // Çizgi ilk ve son dairenin MERKEZLERİ arasında durur (her uçta 1/8 kolon).
  track: {
    position: 'absolute',
    top: 12,
    left: '12.5%',
    right: '12.5%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  trackFill: {
    position: 'absolute',
    top: 12,
    left: '12.5%',
    maxWidth: '75%',
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.brand.green,
  },
  stepsRow: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 5 },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d1d1d',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stepCircleReached: {
    backgroundColor: COLORS.brand.green,
    borderColor: COLORS.brand.green,
  },
  stepLabel: {
    fontSize: 9,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.40)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  stepLabelReached: {
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
