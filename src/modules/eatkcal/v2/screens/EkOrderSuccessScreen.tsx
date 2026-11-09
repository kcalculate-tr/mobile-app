// eatkcal v2 — "Siparişin alındı" (FinEkOrderSuccess, Tur 26 md.15; FinMoPay son karesi).
//
// `yeni_siparis` açıkken `OrderSuccess` rotası bu bileşenle kaydolur
// (routes.tsx v2ScreenFor); kapalıyken bugünkü OrderSuccessScreen AYNEN.
// Parametreler aynı: { orderCode, orderId?, noticeMessage? }.
// Veri (yalnız OKUR): orders satırı (doğrulama + teslim türü), fetchMacroProfile +
// fetchMacroSettings → macroEarnedForOrder (OrderSuccessScreen.tsx:96-118 ile aynı).
//
// Kutlama YALNIZ doğrulanmış siparişte (model/orderSuccess.isVerifiedOrder):
// cam kase 900 ms (y 24 → 0, ölçek 0,7 → 1,05 → 1, eatkcal eğrisi) + 14 lime nokta
// yağmuru 900 ms + 400 ms'de parıltı ve metin/kart (500 ms) — tek sefer, döngü yok.
// Sonra kalıcı durum: sipariş no + "Siparişi takip et". Doğrulanamazsa kutlama
// oynamaz, kalıcı durum doğrudan görünür. Tahmini süre yalnız gerçek veriyle.
// Azaltılmış hareket: nokta yok; kase/metin 200 ms opaklık.
// Korunan (Final'de ayrı yeri yok, yeni dille): kazanılan Macro (kartta satır →
// Macro'larım), uyarı notu (kart altında).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { DURATION, RN_CURVE, fontFamily, haptic, useReducedMotion } from '../../../../core/design';
import { CaretRight, X } from '../../../../components/icons';
import { useRequireAuth } from '../../../../hooks/useRequireAuth';
import { supabase } from '../../../../core/supabase';
import { DEFAULT_MACRO_SETTINGS, fetchMacroProfile, fetchMacroSettings, macroEarnedForOrder } from '../../../../lib/macros';
import type { RootStackParamList } from '../../../../navigation/types';
import { ekType, useEk } from '../ui/kit';
import { useEkNav } from '../nav';
import { useDeliveryChip } from '../ui/home/useDeliveryChip';
import { MONTHS_SHORT, RAIN_DOTS, isVerifiedOrder, successEta, type SuccessOrderRow } from '../model/orderSuccess';

type R = RouteProp<RootStackParamList, 'OrderSuccess'>;

const BOWL = require('../../../../../assets/glass/bowl.png');
const EAT_EASE = RN_CURVE.eat;
const STD_EASE = RN_CURVE.standard;
/** Nokta yağmuru düşüşü hızlanarak biter → kanonik exit (FinMoTokens; Final 0.4,0,1,1 yerel eğrisi yerine). */
const RAIN_EASE = RN_CURVE.exit;
const GLOW_RINGS = Array.from({ length: 12 }, (_, i) => Math.round(115 - i * 9.5));
/** Doğrulama sorgusu en fazla bu kadar beklenir; sonra kutlamasız kalıcı durum. */
const VERIFY_TIMEOUT_MS = 4000;

type Phase = 'checking' | 'celebrate' | 'static';

export default function EkOrderSuccessScreen() {
  const { c, t, lang, insets, theme } = useEk();
  const navigation = useEkNav();
  const routeParams = useRoute<R>().params;
  const { orderCode, orderId, noticeMessage } = routeParams;
  // YALNIZ __DEV__ vitrini (FinEkOrderSuccess): doğrulanmış sipariş hâli, sorgu/sipariş YOK.
  const vitrinVerified = __DEV__ ? (routeParams as { vitrinVerified?: boolean }).vitrinVerified === true : false;
  const { session, isAuthenticated } = useRequireAuth();
  const userId = session?.user?.id;
  const reduced = useReducedMotion();
  const [macro, setMacro] = useState<number | null>(null);
  const [row, setRow] = useState<SuccessOrderRow | null>(null);
  const [phase, setPhase] = useState<Phase>(vitrinVerified ? 'celebrate' : orderId ? 'checking' : 'static');
  const { chip } = useDeliveryChip();

  // ── Sipariş satırı: doğrulama + teslim türü + Macro (yalnız okuma) ─────────
  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    const timer = setTimeout(() => mounted && setPhase((p) => (p === 'checking' ? 'static' : p)), VERIFY_TIMEOUT_MS);
    (async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('total_price,status,payment_status,delivery_method,delivery_time_type,delivery_type,scheduled_date,scheduled_slot,scheduled_time')
          .eq('id', orderId)
          .maybeSingle();
        if (!mounted) return;
        const r = (data ?? null) as (SuccessOrderRow & { total_price?: number }) | null;
        setRow(r);
        setPhase((p) => (p === 'checking' ? (isVerifiedOrder(r) ? 'celebrate' : 'static') : p));
        const tutar = Number(r?.total_price ?? 0);
        if (!userId || !(tutar > 0)) return;
        const [profile, settings] = await Promise.all([
          fetchMacroProfile(userId),
          fetchMacroSettings().catch(() => DEFAULT_MACRO_SETTINGS),
        ]);
        if (mounted) setMacro(macroEarnedForOrder(tutar, profile, settings));
      } catch {
        /* sessiz: doğrulanamazsa kutlama yok, kalıcı durum (bugünkü ekran gibi akış etkilenmez) */
        if (mounted) setPhase((p) => (p === 'checking' ? 'static' : p));
      }
    })();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [userId, orderId]);

  // ── Hareket ───────────────────────────────────────────────────────────────
  const bowl = useRef(new Animated.Value(0)).current; // 0 → 1 (900 ms)
  const glow = useRef(new Animated.Value(0)).current;
  const up = useRef(new Animated.Value(0)).current;
  const rain = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'checking') return;
    if (phase === 'static' || reduced) {
      const fade = (v: Animated.Value) =>
        Animated.timing(v, { toValue: 1, duration: DURATION.fast, easing: RN_CURVE.linear, useNativeDriver: true });
      Animated.parallel([fade(bowl), fade(glow), fade(up)]).start();
      if (phase === 'celebrate') haptic('success');
      return;
    }
    haptic('success');
    Animated.parallel([
      Animated.timing(bowl, { toValue: 1, duration: DURATION.story, easing: EAT_EASE, useNativeDriver: true }),
      Animated.timing(rain, { toValue: 1, duration: DURATION.story, easing: RAIN_EASE, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(glow, { toValue: 1, duration: DURATION.slow, easing: STD_EASE, useNativeDriver: true }),
          Animated.timing(up, { toValue: 1, duration: DURATION.slow, easing: EAT_EASE, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [phase, reduced, bowl, glow, up, rain]);

  const eta = useMemo(
    () => successEta(row, chip?.estimate ?? null, lang === 'en' ? MONTHS_SHORT.en : MONTHS_SHORT.tr),
    [row, chip?.estimate, lang],
  );

  if (!isAuthenticated) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const numericId = orderId != null && /^\d+$/.test(String(orderId)) ? Number(orderId) : null;
  const track = () => {
    haptic('selection');
    if (numericId != null) navigation.replace('EkOrderDetail', { orderId: numericId });
    else navigation.replace('EkOrders');
  };
  const close = () => {
    haptic('selection');
    navigation.navigate('Tabs', { screen: 'Home' });
  };
  const showMacro = macro != null && macro > 0;
  const celebrating = phase === 'celebrate' && !reduced;

  // Kase: 0–60 % → y 24 → 0, ölçek 0,7 → 1,05, opaklık 0 → 1; 60–100 % → ölçek 1.
  const bowlStyle = reduced || phase !== 'celebrate'
    ? { opacity: bowl }
    : {
        opacity: bowl.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: bowl.interpolate({ inputRange: [0, 0.6, 1], outputRange: [24, 0, 0] }) },
          { scale: bowl.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.7, 1.05, 1] }) },
        ],
      };
  const upStyle = reduced || phase !== 'celebrate'
    ? { opacity: up }
    : { opacity: up, transform: [{ translateY: up.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };

  return (
    <View
      style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}
      accessibilityViewIsModal
      testID="ek-order-success"
    >
      {celebrating ? (
        <View style={styles.rainBox} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {RAIN_DOTS.map((d, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: `${(d.x / 393) * 100}%`,
                top: d.y,
                width: d.d,
                height: d.d,
                borderRadius: d.d / 2,
                backgroundColor: '#C6F04F',
                opacity: rain.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
                transform: [{ translateY: rain.interpolate({ inputRange: [0, 1], outputRange: [0, d.fall] }) }],
              }}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.header}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('eatkcal.v2.success.close')} style={styles.closeBtn} testID="ek-success-close">
          <X size={22} color={c.ink} />
        </Pressable>
      </View>

      <View style={styles.bowlBox}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { opacity: glow }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* Final radial-gradient (lime 0,55 → 0,22 @%35 → 0 @%68): 12 üst üste saydam halka. */}
          {GLOW_RINGS.map((r) => (
            <View
              key={r}
              style={{
                position: 'absolute',
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: `rgba(198,240,79,${theme.isDark ? 0.055 : 0.07})`,
              }}
            />
          ))}
        </Animated.View>
        <Animated.View style={[styles.bowl, bowlStyle]} accessibilityRole="image" accessibilityLabel={t('eatkcal.v2.success.bowl_a11y')}>
          <Image source={BOWL} style={styles.bowlImg} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.View style={[styles.texts, upStyle]} accessibilityLiveRegion="polite">
        <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={t('eatkcal.v2.success.title')}>
          <Text style={[styles.title, { color: c.ink }]}>{t('eatkcal.v2.success.title_a')}</Text>
          <View style={styles.titleMark}>
            <Text style={[styles.title, { color: '#0A0A0A' }]}>{t('eatkcal.v2.success.title_b')}</Text>
          </View>
        </View>
        <Text style={[styles.sub, { color: c.ink }]}>
          {phase === 'celebrate' ? t('eatkcal.v2.success.sub_paid') : t('eatkcal.v2.success.sub')}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.card, { backgroundColor: c.surface }, upStyle]} testID="ek-success-card">
        {orderCode ? (
          <View style={styles.row}>
            <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.success.code_label')}</Text>
            <Text style={[styles.code, ekType.num, { color: c.ink }]} selectable>
              {orderCode}
            </Text>
          </View>
        ) : null}
        {eta ? (
          <View style={[styles.row, styles.rowSm, { borderTopColor: c.line, borderTopWidth: orderCode ? 1 : 0 }]} testID="ek-success-eta">
            <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.success.eta_label')}</Text>
            <Text style={[styles.val, ekType.num, { color: c.ink }]}>{eta}</Text>
          </View>
        ) : null}
        {showMacro ? (
          <Pressable
            onPress={() => navigation.navigate('Tabs', { screen: 'Subscriptions' })}
            accessibilityRole="button"
            style={[styles.row, styles.rowSm, { borderTopColor: c.line, borderTopWidth: 1 }]}
          >
            <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.success.macro_label')}</Text>
            <View style={styles.macroVal}>
              <Text style={[styles.val, ekType.num, { color: c.ink }]}>+{macro}</Text>
              <CaretRight size={16} color={c.secondary} />
            </View>
          </Pressable>
        ) : null}
      </Animated.View>
      {noticeMessage ? (
        <Animated.View style={[styles.notice, upStyle]} accessibilityRole="alert">
          <Text style={[ekType.c13, { color: c.secondary, textAlign: 'center' }]}>{noticeMessage}</Text>
        </Animated.View>
      ) : null}

      <View style={styles.spacer} />
      <View style={styles.actions}>
        <Pressable
          onPress={track}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.9 : 1 }]}
          testID="ek-success-track"
        >
          <Text style={styles.ctaText}>{t('eatkcal.v2.success.track')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  rainBox: { position: 'absolute', top: 0, left: 0, right: 0, height: 560, overflow: 'hidden' },
  header: { height: 44, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 4, zIndex: 2 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bowlBox: { marginTop: 37, alignSelf: 'center', width: 216, height: 200, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', left: -12, top: -16, width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  bowl: { width: 216, height: 160 },
  bowlImg: { width: 216, height: 160 },
  texts: { marginTop: 32, paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontFamily: fontFamily.headingBold, fontSize: 32, lineHeight: 37 },
  titleMark: { backgroundColor: '#C6F04F', borderRadius: 8, paddingHorizontal: 6 },
  sub: { fontFamily: ekType.b15.fontFamily, fontSize: 16, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  card: { marginTop: 31, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 64, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowSm: { minHeight: 56 },
  code: { fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 27 },
  val: { fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 21, flexShrink: 1, textAlign: 'right' },
  macroVal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notice: { marginTop: 12, paddingHorizontal: 24 },
  spacer: { flex: 1 },
  actions: { paddingHorizontal: 16, paddingBottom: 18 },
  cta: { height: 52, borderRadius: 26, backgroundColor: '#C6F04F', alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 21, color: '#0A0A0A' },
});
