// eatkcal v2 (G15-S5 md.5) — "Siparişin alındı" (FinMoPay son karesi).
//
// `yeni_siparis` açıkken `OrderSuccess` rotası bu bileşenle kaydolur
// (routes.tsx v2ScreenFor); kapalıyken bugünkü OrderSuccessScreen AYNEN.
// Parametreler aynı: { orderCode, orderId?, noticeMessage? }.
// Veri bugünkü ekranla aynı (yalnız OKUR): orders.total_price + fetchMacroProfile
// + fetchMacroSettings → macroEarnedForOrder (OrderSuccessScreen.tsx:96-118).
// Final: ✓ (bouncy) · "Siparişin alındı" · alt satır · "Siparişi takip et".
// Korunan özellikler (Final'de ayrı yeri yok, yeni dille): sipariş no, kazanılan
// Macro, uyarı notu, Macro'larım / Bugün / Ana sayfa geçişleri.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { haptic, SPRING, useReducedMotion, DURATION } from '../../../../core/design';
import { Check } from '../../../../components/icons';
import { useRequireAuth } from '../../../../hooks/useRequireAuth';
import { supabase } from '../../../../core/supabase';
import { DEFAULT_MACRO_SETTINGS, fetchMacroProfile, fetchMacroSettings, macroEarnedForOrder } from '../../../../lib/macros';
import type { RootStackParamList } from '../../../../navigation/types';
import { ekType, useEk } from '../ui/kit';
import { EkInkButton } from '../ui/orders/OrdersParts';
import { useEkNav } from '../nav';

type R = RouteProp<RootStackParamList, 'OrderSuccess'>;

export default function EkOrderSuccessScreen() {
  const { c, t, insets } = useEk();
  const navigation = useEkNav();
  const { orderCode, orderId, noticeMessage } = useRoute<R>().params;
  const { session, isAuthenticated } = useRequireAuth();
  const userId = session?.user?.id;
  const reduced = useReducedMotion();
  const [macro, setMacro] = useState<number | null>(null);

  const check = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const body = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    haptic('success');
    if (reduced) return;
    Animated.sequence([
      Animated.spring(check, { toValue: 1, useNativeDriver: true, ...SPRING.bouncy }),
      Animated.timing(body, { toValue: 1, duration: DURATION.slow, useNativeDriver: true }),
    ]).start();
  }, [check, body, reduced]);

  useEffect(() => {
    if (!userId || !orderId) return;
    let mounted = true;
    (async () => {
      try {
        const [{ data: order }, profile, settings] = await Promise.all([
          supabase.from('orders').select('total_price').eq('id', orderId).maybeSingle(),
          fetchMacroProfile(userId),
          fetchMacroSettings().catch(() => DEFAULT_MACRO_SETTINGS),
        ]);
        if (!mounted) return;
        const tutar = Number((order as { total_price?: number } | null)?.total_price ?? 0);
        if (!(tutar > 0)) return;
        setMacro(macroEarnedForOrder(tutar, profile, settings));
      } catch {
        /* sessiz: kazanım gösterilmezse akış etkilenmez (bugünkü ekranla aynı) */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, orderId]);

  if (!isAuthenticated) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const numericId = orderId != null && /^\d+$/.test(String(orderId)) ? Number(orderId) : null;
  const track = () => {
    if (numericId != null) navigation.replace('EkOrderDetail', { orderId: numericId });
    else navigation.replace('EkOrders');
  };
  const scale = check.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const showMacro = macro != null && macro > 0;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]} testID="ek-order-success">
      <View style={styles.center}>
        <Animated.View style={[styles.check, { backgroundColor: c.ink, opacity: check, transform: [{ scale }] }]}>
          <Check size={36} color={c.bg} weight="bold" />
        </Animated.View>
        <Animated.View style={[styles.texts, { opacity: body }]}>
          <Text style={[ekType.h24, styles.title, { color: c.ink }]} accessibilityRole="header">
            {t('eatkcal.v2.success.title')}
          </Text>
          <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center' }]}>{t('eatkcal.v2.success.sub')}</Text>
          {orderCode ? (
            <Text style={[ekType.c13s, ekType.num, { color: c.secondary, textAlign: 'center' }]}>
              {t('eatkcal.v2.success.code', { code: orderCode })}
            </Text>
          ) : null}
          {showMacro ? (
            <View style={[styles.macro, { backgroundColor: c.line }]}>
              <View style={[styles.dot, { backgroundColor: c.accentLine }]} />
              <Text style={[ekType.b15, { color: c.ink }]}>{t('eatkcal.v2.checkout.macro_earn')}</Text>
              <Text style={[ekType.b15s, ekType.num, { color: c.ink }]}>+{macro}</Text>
            </View>
          ) : null}
          {noticeMessage ? (
            <View style={[styles.notice, { backgroundColor: c.surface }]} accessibilityRole="alert">
              <Text style={[ekType.c13, { color: c.ink }]}>{noticeMessage}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <EkInkButton label={t('eatkcal.v2.success.track')} onPress={track} testID="ek-success-track" />
        <View style={styles.links}>
          {showMacro ? (
            <LinkBtn label={t('eatkcal.v2.success.macros')} onPress={() => navigation.navigate('Tabs', { screen: 'Subscriptions' })} />
          ) : null}
          <LinkBtn label={t('eatkcal.v2.success.today')} onPress={() => navigation.navigate('Tabs', { screen: 'Tracker' })} />
          <LinkBtn label={t('eatkcal.v2.success.home')} onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} />
        </View>
      </View>
    </View>
  );
}

function LinkBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useEk();
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      style={styles.link}
    >
      <Text style={[ekType.b15s, { color: c.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  check: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  texts: { alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  title: { fontSize: 28, lineHeight: 34, textAlign: 'center' },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  notice: { padding: 14, borderRadius: 16, alignSelf: 'stretch', marginTop: 4 },
  actions: { paddingHorizontal: 16, gap: 4 },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  link: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
