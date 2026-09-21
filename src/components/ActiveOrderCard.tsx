import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle, CookingPot, Package, Receipt, Scooter } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { ORDER_STEPS, stepIndexOf, type ActiveOrder } from '../lib/activeOrder';

const STEP_ICONS = [Receipt, CookingPot, Scooter, Package];

const STEP_HEADLINE: Record<string, { title: string; sub: string }> = {
  confirmed: { title: 'Siparişin onaylandı', sub: 'Mutfağa iletildi, birazdan hazırlanmaya başlıyor.' },
  preparing: { title: 'Siparişin hazırlanıyor', sub: 'Mutfağımız senin için çalışıyor.' },
  on_way:    { title: 'Siparişin yolda', sub: 'Kuryemiz siparişinle birlikte yola çıktı.' },
  delivered: { title: 'Afiyet olsun!', sub: 'Siparişin teslim edildi.' },
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
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {isDelivered ? 'TESLİM EDİLDİ' : 'SİPARİŞİN HAZIRLANIYOR'}
            {order.orderCode ? ` · ${order.orderCode}` : ''}
          </Text>
          <Text style={styles.title}>{headline.title}</Text>
          <Text style={styles.sub}>{headline.sub}</Text>
        </View>
        {!isDelivered ? (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
        ) : null}
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
                    <CheckCircle size={16} color="#000000" weight="fill" />
                  ) : (
                    <Icon size={16} color={reached ? '#000000' : 'rgba(255,255,255,0.45)'} weight="bold" />
                  )}
                </Animated.View>
                <Text style={[styles.stepLabel, reached && styles.stepLabelReached]} numberOfLines={2}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footRow}>
        <Text style={styles.footMeta}>
          {order.itemCount} ürün · ₺{order.totalAmount.toFixed(2)}
        </Text>
        <Text style={styles.footLink}>Detay →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#101010',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 4,
  },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sub: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(198,240,79,0.14)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brand.green },
  liveText: {
    fontSize: 9,
    letterSpacing: 0.8,
    color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  stepsWrap: { position: 'relative', justifyContent: 'center' },
  // Çizgi, ilk ve son dairenin MERKEZLERİ arasında durmalı: her iki uçta
  // yarım daire (16px) + yatay iç boşluk kadar geri çekiliyor.
  track: {
    position: 'absolute',
    top: 16,
    left: '12.5%',
    right: '12.5%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  trackFill: {
    position: 'absolute',
    top: 16,
    left: '12.5%',
    maxWidth: '75%',
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.brand.green,
  },
  stepsRow: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 8 },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    fontSize: 10,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.40)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  stepLabelReached: {
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: SPACING.md,
  },
  footMeta: { fontSize: TYPOGRAPHY.size.sm, color: 'rgba(255,255,255,0.55)' },
  footLink: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
