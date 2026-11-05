// eatkcal v2 (G13-S2 md.1) — Canlı sipariş kartı (FinEkHome "Canlı sipariş").
// Veri: mevcut aktif sipariş (src/lib/activeOrder.ts fetchActiveOrder +
// subscribeToOrder; ekran sahibi besler). Aşamalar ORDER_STEPS sırası; ilerleme
// noktası eatkcal yayıyla (SPRING.eat) kayar, azaltılmış harekette anında.
// "Tahmini varış [N] dk": siparişe özel ETA verisi YOK → satır gösterilmez,
// yerine güncel aşama yazılır (uydurma süre yok).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Phone } from '../../../../../components/icons';
import { SPRING, haptic, useReducedMotion } from '../../../../../core/design';
import { ekType, useEk } from '../kit';
import { LIVE_ORDER_STATUSES, liveStepIndex } from '../../model/homeData';

export const SUPPORT_TEL = 'tel:02323322100';

const STEP_KEYS: Record<(typeof LIVE_ORDER_STATUSES)[number], string> = {
  confirmed: 'eatkcal.v2.home.step_confirmed',
  preparing: 'eatkcal.v2.home.step_preparing',
  on_way: 'eatkcal.v2.home.step_on_way',
  delivered: 'eatkcal.v2.home.step_delivered',
};

export function LiveOrderCard({
  orderCode,
  status,
  onDetail,
}: {
  orderCode: string | null;
  status: string;
  onDetail: () => void;
}) {
  const { c, t } = useEk();
  const reduced = useReducedMotion();
  const step = liveStepIndex(status);
  const [trackW, setTrackW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step < 0 || trackW <= 0) return;
    const frac = step / (LIVE_ORDER_STATUSES.length - 1);
    if (reduced) {
      x.setValue(frac * trackW);
      fill.setValue(frac * trackW);
      return;
    }
    const cfg = { ...SPRING.eat, useNativeDriver: false };
    Animated.parallel([
      Animated.spring(x, { toValue: frac * trackW, ...cfg }),
      Animated.spring(fill, { toValue: frac * trackW, ...cfg }),
    ]).start();
  }, [step, trackW, reduced, x, fill]);

  if (step < 0) return null;
  const current = LIVE_ORDER_STATUSES[step];

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
      accessibilityLabel={t('eatkcal.v2.home.live_label')}
      testID="ek-live-order"
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          {orderCode ? (
            <Text style={[ekType.c13s, { color: c.secondary }]}>
              {t('eatkcal.v2.home.live_order', { code: orderCode })}
            </Text>
          ) : null}
          <Text style={[styles.headline, { color: c.ink }]} accessibilityLiveRegion="polite">
            {t(STEP_KEYS[current])}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            haptic('light');
            Linking.openURL(SUPPORT_TEL).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel={t('eatkcal.v2.home.call_label')}
          style={[styles.call, { backgroundColor: c.accent }]}
          testID="ek-live-call"
        >
          <Phone size={20} color={c.onAccent} weight="fill" />
        </Pressable>
        <Pressable
          onPress={() => {
            haptic('selection');
            onDetail();
          }}
          accessibilityRole="button"
          style={[styles.detail, { borderColor: c.line }]}
          testID="ek-live-detail"
        >
          <Text style={[ekType.c13s, { color: c.ink, fontSize: 14 }]}>{t('eatkcal.v2.home.detail')}</Text>
        </Pressable>
      </View>

      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <View style={[styles.line, { backgroundColor: c.line }]} />
        <Animated.View style={[styles.line, { backgroundColor: c.accentLine, right: undefined, width: fill }]} />
        {LIVE_ORDER_STATUSES.map((s, i) => (
          <View
            key={s}
            style={[
              styles.stop,
              { left: `${(i / (LIVE_ORDER_STATUSES.length - 1)) * 100}%`, backgroundColor: i <= step ? c.accentLine : c.line },
            ]}
          />
        ))}
        <Animated.View style={[styles.dot, { backgroundColor: c.accentLine, transform: [{ translateX: x }] }]} />
      </View>

      <View style={styles.labels}>
        {LIVE_ORDER_STATUSES.map((s, i) => (
          <Text key={s} style={[ekType.c13s, { color: i <= step ? c.ink : c.secondary }]} numberOfLines={1}>
            {t(STEP_KEYS[s])}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { fontFamily: ekType.h20.fontFamily, fontSize: 17, lineHeight: 22 },
  call: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detail: { height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  track: { height: 10, marginHorizontal: 5, justifyContent: 'center' },
  line: { position: 'absolute', left: 0, right: 0, top: 4, height: 2, borderRadius: 1 },
  stop: { position: 'absolute', top: 2, width: 6, height: 6, marginLeft: -3, borderRadius: 3 },
  dot: { position: 'absolute', left: -5, top: 0, width: 10, height: 10, borderRadius: 5 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
