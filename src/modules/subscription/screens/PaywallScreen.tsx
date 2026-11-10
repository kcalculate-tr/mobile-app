// G22-S1 md.4 — FinSubPaywall (+Monthly) — kcalAI planları (dalga2 birebir).
//
// Üst: kcalAI çipi + kapat. Özellik şeridi: 4 sayfa, 3 sn'de bir otomatik (yalnız görünürken,
// azaltılmış harekette KAPALI), dokununca 6 sn bekler, 44 pt duraklat düğmesi; Fresh ↔ Balance
// kart grubuna göre şerit fast 200 crossfade, sayfa 1. Plan kartları: yatay dizi, ölçek
// 1 − 0.14·d, opaklık 1 − 0.45·d, çerçeve 1 − d (d = |kart − merkez| / 261), snap ortaya,
// oturunca hafif haptik; VoiceOver'da TEK ayarlanabilir öğe ("Balance Yıllık, 1799 TL, 7 gün
// ücretsiz, 4'ün 4'ü"). Buton etiketi Aylık/Yıllık fast 200 crossfade; zorunlu yenileme metni;
// geri yükle; Koşullar/Gizlilik. Fiyatlar YALNIZ RevenueCat yerel fiyatı; gelmezse FinSubError.
// Satın alma sonucu aynı ekranda FinSubResult.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityActionEvent, AppState, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, DURATION, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Pause, Play, Sparkle, X } from '../../../components/icons';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import {
  CARD_STEP,
  initialCard,
  selectedCard,
  stripFor,
  type PlanCard,
} from '../../../lib/subscription/plans';
import { purchasePlan, restorePurchases, useSubscriptionStore, useTier, type PurchaseResult } from '../../../lib/subscription/purchases';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import SubResult, { type SubResultState } from '../ui/SubResult';
import { trackSub } from '../subTrack';

/* eslint-disable @typescript-eslint/no-require-imports */
// Dosya adları SABİT (İlter ChatGPT ile üretiyor) — şimdilik mevcut cam nesnelerin kopyası.
const FEATURE_IMG = {
  ai: require('../../../../assets/glass/camera.png'),
  voice: require('../../../../assets/glass/mic.png'),
  barcode: require('../../../../assets/glass/barcode.png'),
  manual: require('../../../../assets/glass/infinity.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const CARD_W = 248;
const CARD_GAP = CARD_STEP - CARD_W; // 13

export type PaywallParams = { from?: string; plan?: 'fresh' | 'balance'; yearly?: boolean } | undefined;

export default function PaywallScreen() {
  const t = useTheme();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const navigation = useNavigation();
  const params = (useRoute().params ?? {}) as NonNullable<PaywallParams>;
  const { width: winW } = useWindowDimensions();
  const { cards, loading, failed, reload } = usePlanCards(true);
  const limits = useSubscriptionStore((s) => s.limits);
  const { status } = useTier();

  const [sel, setSel] = useState(() => initialCard(params.plan, params.yearly ?? true));
  const [result, setResult] = useState<SubResultState | null>(null);
  const [buying, setBuying] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  useEffect(() => {
    trackSub('paywall_view', { from: ['limit_ai', 'limit_barcode', 'limit_voice', 'profile', 'pill'].includes(params.from ?? '') ? params.from : 'other' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => navigation.goBack(), [navigation]);

  // ── Kart dizisi ──
  const scrollX = useSharedValue(sel * CARD_STEP);
  const cardsRef = useRef<Animated.ScrollView | null>(null);
  const lastSettled = useRef(sel);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  const side = Math.max(16, (winW - CARD_W) / 2);
  const goTo = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(3, i));
      cardsRef.current?.scrollTo({ x: n * CARD_STEP, animated: !reduced });
      if (reduced) settle(n * CARD_STEP);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduced],
  );
  const settle = (x: number) => {
    const n = selectedCard(x);
    if (n !== lastSettled.current) {
      lastSettled.current = n;
      haptic('light'); // FinMoSub "Oturma": hafif tık
    }
    setSel(n);
  };
  useEffect(() => {
    // İlk konum (Balance Yıllık / hak sheet'inden gelen plan).
    const id = setTimeout(() => cardsRef.current?.scrollTo({ x: sel * CARD_STEP, animated: false }), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  // ── Özellik şeridi ──
  const group = stripFor(sel);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const holdUntil = useRef(0);
  const stripRef = useRef<ScrollView | null>(null);
  const appActive = useRef(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      appActive.current = s === 'active';
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    // Grup değişti → şerit sayfa 1, 3 sn bekle.
    setPage(0);
    stripRef.current?.scrollTo({ x: 0, animated: false });
    holdUntil.current = Date.now() + 3000;
  }, [group]);
  const autoOn = !reduced && !paused && !result;
  useEffect(() => {
    if (!autoOn) return;
    const id = setInterval(() => {
      if (!appActive.current || Date.now() < holdUntil.current) return;
      setPage((p) => {
        const next = (p + 1) % 4;
        stripRef.current?.scrollTo({ x: next * winW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [autoOn, winW]);

  const features = useMemo(() => {
    const fresh = group === 'fresh';
    return [
      { img: FEATURE_IMG.ai, title: fresh ? tr('sub.feature.fresh_ai_title', { n: limits?.ai.fresh ?? '' }) : tr('sub.feature.balance_ai_title'), desc: tr(fresh ? 'sub.feature.fresh_ai_desc' : 'sub.feature.balance_ai_desc') },
      { img: FEATURE_IMG.voice, title: tr(fresh ? 'sub.feature.fresh_voice_title' : 'sub.feature.balance_voice_title'), desc: tr(fresh ? 'sub.feature.fresh_voice_desc' : 'sub.feature.balance_voice_desc') },
      { img: FEATURE_IMG.barcode, title: tr('sub.feature.barcode_title'), desc: tr('sub.feature.barcode_desc') },
      { img: FEATURE_IMG.manual, title: tr('sub.feature.manual_title'), desc: tr('sub.feature.manual_desc') },
    ];
  }, [group, limits?.ai.fresh, tr]);

  const cur: PlanCard | null = cards?.[sel] ?? null;
  const ink = t.color.ink;
  const line2 = t.isDark ? '#48484A' : '#C3C7CC';

  // ── Satın alma ──
  const buy = async () => {
    if (!cur || buying) return;
    setBuying(true);
    const r: PurchaseResult = await purchasePlan(cur.key);
    trackSub('sub_purchase', { product: cur.productId, result: r });
    setBuying(false);
    setResult(r);
  };
  const restore = async () => {
    const r = await restorePurchases();
    trackSub('sub_restore', { result: r });
    if (r === 'restored') {
      setRestoreMsg(tr('sub.paywall.restore_ok'));
      setResult('success');
    } else setRestoreMsg(tr('sub.paywall.restore_none'));
  };

  // ── Sonuç / hata ──
  if (result) {
    return (
      <SubResult
        state={result}
        card={cur}
        expiresAt={useSubscriptionStore.getState().rc?.expiresAt ?? null}
        aiPerDay={limits?.ai.fresh ?? null}
        pendingVerify={result === 'success' && status === 'pending'}
        onClose={close}
        onPrimary={() => {
          if (result === 'success') navigation.goBack();
          else if (result === 'pending') close();
          else setResult(null); // cancelled → planlara dön; error → tekrar dene
        }}
        onSecondary={
          result === 'success'
            ? () => (navigation as unknown as { replace: (n: string) => void }).replace('SubProfile')
            : result === 'cancelled'
              ? close
              : undefined
        }
        onRestore={result === 'pending' || result === 'error' ? () => void restore() : undefined}
      />
    );
  }
  if (!loading && (failed || !cards)) {
    // Fiyat gelmedi → FinSubError (yedek fiyat metni YOK).
    return <SubResult state="error" onClose={close} onPrimary={() => void reload()} onRestore={() => void restore()} />;
  }

  const yearlySel = !!cur?.yearly;
  const trialDays = cur?.trialDays ?? null;
  const ctaLabel = yearlySel && trialDays ? tr('sub.paywall.cta_trial', { days: trialDays }) : tr('sub.paywall.cta');
  const summary = !cur
    ? ''
    : yearlySel && trialDays
      ? tr('sub.paywall.sum_trial', { days: trialDays, price: cur.priceText })
      : yearlySel
        ? tr('sub.paywall.sum_yearly', { price: cur.priceText })
        : tr('sub.paywall.sum_monthly', { price: cur.priceText });
  const valueText = cur
    ? `${tr('sub.paywall.card_a11y', { name: tr(cur.tier === 'balance' ? 'sub.paywall.balance' : 'sub.paywall.fresh'), period: tr(cur.yearly ? 'sub.paywall.yearly' : 'sub.paywall.monthly'), price: cur.priceText })}${
        cur.trialDays ? tr('sub.paywall.card_trial_a11y', { days: cur.trialDays }) : ''
      }, ${tr('sub.paywall.of', { n: sel + 1, total: 4 })}`
    : '';

  const onA11y = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') goTo(sel + 1);
    else if (e.nativeEvent.actionName === 'decrement') goTo(sel - 1);
  };

  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]} testID="sub-paywall">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Math.max(24, insets.bottom + 16) }} showsVerticalScrollIndicator={false}>
        {/* Üst */}
        <View style={styles.top}>
          <View style={styles.brand} accessibilityRole="header" accessibilityLabel={tr('sub.paywall.title')}>
            <Sparkle size={14} color="#0A0A0A" weight="fill" />
            <AppText style={styles.brandText}>{tr('sub.brand')}</AppText>
          </View>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={tr('sub.close')} style={styles.close} testID="sub-paywall-close">
            <X size={22} color={ink} />
          </Pressable>
        </View>

        {/* Özellik şeridi */}
        <Animated.View key={group} entering={FadeIn.duration(DURATION.fast)} exiting={FadeOut.duration(DURATION.fast)}>
          <ScrollView
            ref={stripRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={() => (holdUntil.current = Date.now() + 6000)}
            onTouchStart={() => (holdUntil.current = Date.now() + 6000)}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / winW))}
            accessibilityLabel={tr('sub.paywall.strip_a11y')}
            testID="sub-strip"
          >
            {features.map((f, i) => (
              <View key={i} style={[styles.page, { width: winW }]} accessible accessibilityLabel={`${i + 1} / 4: ${f.title}. ${f.desc}`}>
                <View style={styles.glassWrap}>
                  <View style={styles.glow} />
                  <Image source={f.img} style={styles.glass} resizeMode="contain" />
                </View>
                <AppText style={[styles.fTitle, { color: ink }]}>{f.title}</AppText>
                <AppText tone="secondary" style={styles.fDesc}>
                  {f.desc}
                </AppText>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
        <View style={styles.dotsRow}>
          <View style={styles.dotsSpacer} />
          <Dots n={4} active={page} dark={t.isDark} line2={line2} />
          <View style={styles.dotsSpacer}>
            {!reduced ? (
              <Pressable
                onPress={() => setPaused((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={paused ? tr('sub.paywall.play') : tr('sub.paywall.pause')}
                style={styles.pause}
                testID="sub-strip-pause"
              >
                {paused ? <Play size={16} color={ink} weight="fill" /> : <Pause size={16} color={ink} weight="fill" />}
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Plan kartları — VoiceOver: tek ayarlanabilir öğe */}
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={tr('sub.paywall.plans_a11y')}
          accessibilityValue={{ text: valueText }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onA11y}
          testID="sub-cards"
        >
          <Animated.ScrollView
            ref={cardsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_STEP}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
            onScrollEndDrag={(e) => {
              if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e.nativeEvent.contentOffset.x);
            }}
            contentContainerStyle={{ paddingHorizontal: side, gap: CARD_GAP, paddingVertical: 16 }}
            importantForAccessibility="no-hide-descendants"
          >
            {(cards ?? []).map((c, i) => (
              <PlanCardView key={c.key} c={c} i={i} scrollX={scrollX} reduced={reduced} onPress={() => goTo(i)} />
            ))}
          </Animated.ScrollView>
        </View>
        <View style={styles.dotsCenter}>
          <Dots n={4} active={sel} dark={t.isDark} line2={line2} />
        </View>

        {/* CTA */}
        <View style={styles.pad}>
          <Pressable
            onPress={() => void buy()}
            disabled={!cur || buying}
            accessibilityRole="button"
            accessibilityState={{ busy: buying, disabled: !cur || buying }}
            style={[styles.cta, { opacity: buying || !cur ? 0.6 : 1 }]}
            testID="sub-cta"
          >
            <Animated.View key={ctaLabel} entering={FadeIn.duration(DURATION.fast)}>
              <AppText style={styles.ctaText}>{buying ? tr('sub.paywall.buying') : ctaLabel}</AppText>
            </Animated.View>
          </Pressable>
          <AppText style={styles.summary} testID="sub-summary">
            {summary}
          </AppText>
          <AppText tone="secondary" style={styles.legal}>
            {tr('sub.paywall.legal')}
          </AppText>
          <Pressable onPress={() => void restore()} accessibilityRole="button" style={styles.link} testID="sub-restore">
            <AppText style={styles.linkText}>{tr('sub.paywall.restore')}</AppText>
          </Pressable>
          {restoreMsg ? (
            <AppText tone="secondary" style={styles.restoreMsg} accessibilityLiveRegion="polite">
              {restoreMsg}
            </AppText>
          ) : null}
          <View style={styles.legalLinks}>
            <Pressable onPress={() => (navigation as unknown as { navigate: (n: string, p: object) => void }).navigate('ProfileContracts', { slug: LEGAL_SLUG.terms })} accessibilityRole="link" style={styles.link}>
              <AppText tone="secondary" style={styles.smallLink}>
                {tr('sub.paywall.terms')}
              </AppText>
            </Pressable>
            <Pressable onPress={() => (navigation as unknown as { navigate: (n: string, p: object) => void }).navigate('ProfileContracts', { slug: LEGAL_SLUG.privacy })} accessibilityRole="link" style={styles.link}>
              <AppText tone="secondary" style={styles.smallLink}>
                {tr('sub.paywall.privacy')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Dots({ n, active, dark, line2 }: { n: number; active: number; dark: boolean; line2: string }) {
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[styles.dot, i === active ? { width: 20, backgroundColor: dark ? '#C6F04F' : '#0A0A0A' } : { backgroundColor: line2 }]} />
      ))}
    </View>
  );
}

function PlanCardView({ c, i, scrollX, reduced, onPress }: { c: PlanCard; i: number; scrollX: SharedValue<number>; reduced: boolean; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const ink = t.color.ink;
  const st = useAnimatedStyle(() => {
    // FinMoSub: d = |kart − merkez| / 261 (1'de doyar); ölçek 1 − 0.14·d, opaklık 1 − 0.45·d.
    const d = Math.min(1, Math.abs(i * CARD_STEP - scrollX.value) / CARD_STEP);
    return { opacity: 1 - 0.45 * d, transform: [{ scale: reduced ? 1 : 1 - 0.14 * d }] };
  });
  const frame = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(i * CARD_STEP - scrollX.value) / CARD_STEP);
    return { opacity: interpolate(d, [0, 1], [1, 0]) };
  });
  const band = c.popular ? tr('sub.paywall.popular') : c.trialDays ? tr('sub.paywall.trial', { days: c.trialDays }) : null;
  return (
    <Animated.View style={[styles.card, { backgroundColor: card }, st]}>
      <Pressable onPress={onPress} style={styles.cardIn} testID={`sub-card-${c.key}`}>
        {band ? (
          <View style={[styles.band, { backgroundColor: c.popular ? ink : '#C6F04F' }]}>
            <AppText style={[styles.bandText, { color: c.popular ? t.color.bg : '#0A0A0A' }]} numberOfLines={1}>
              {band}
            </AppText>
            {c.popular && c.trialDays ? (
              <View style={styles.bandChip}>
                <AppText style={styles.bandChipText}>{tr('sub.paywall.trial', { days: c.trialDays })}</AppText>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.bandEmpty} />
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <View style={styles.flex1}>
              <AppText style={styles.cardName}>{tr(c.tier === 'balance' ? 'sub.paywall.balance' : 'sub.paywall.fresh')}</AppText>
              <AppText tone="secondary" style={styles.cardPeriod}>
                {tr(c.yearly ? 'sub.paywall.yearly' : 'sub.paywall.monthly')}
              </AppText>
            </View>
            {c.discountPct ? (
              <View style={[styles.off, { backgroundColor: ink }]}>
                <AppText style={[styles.offText, { color: t.color.bg }]}>{tr('sub.paywall.off', { pct: c.discountPct })}</AppText>
              </View>
            ) : null}
          </View>
          <View style={styles.priceRow}>
            <AppText style={styles.price} numberOfLines={1} adjustsFontSizeToFit>
              {c.priceText}
            </AppText>
            <AppText tone="secondary" style={styles.per}>
              {tr(c.yearly ? 'sub.paywall.per_year' : 'sub.paywall.per_month')}
            </AppText>
          </View>
          <AppText tone="secondary" style={styles.weekly}>
            {tr('sub.paywall.weekly', { price: c.weeklyText })}
          </AppText>
        </View>
      </Pressable>
      {/* Seçili çerçeve: 1 − d */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, { borderColor: t.isDark ? '#C6F04F' : '#4A6B00' }, frame]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#C6F04F', borderRadius: 16, paddingHorizontal: 12, height: 32 },
  brandText: { fontSize: 14, fontWeight: '700', color: '#0A0A0A' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  page: { alignItems: 'center', paddingHorizontal: 24 },
  glassWrap: { width: 170, height: 150, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(198,240,79,0.3)' },
  glass: { width: 140, height: 120 },
  fTitle: { marginTop: 10, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 30, textAlign: 'center' },
  fDesc: { marginTop: 6, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 },
  dotsSpacer: { flex: 1, alignItems: 'flex-end' },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotsCenter: { alignItems: 'center' },
  pause: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { width: CARD_W, borderRadius: 20, overflow: 'hidden', shadowColor: '#0A0A0A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  cardIn: { flex: 1 },
  frame: { borderRadius: 20, borderWidth: 2 },
  band: { height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  bandEmpty: { height: 8 },
  bandText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  bandChip: { backgroundColor: '#C6F04F', borderRadius: 10, paddingHorizontal: 8, height: 20, justifyContent: 'center' },
  bandChipText: { fontSize: 12, fontWeight: '700', color: '#0A0A0A' },
  cardBody: { padding: 16, paddingTop: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, lineHeight: 28 },
  cardPeriod: { fontSize: 14 },
  off: { borderRadius: 14, paddingHorizontal: 10, height: 28, justifyContent: 'center' },
  offText: { fontSize: 14, fontWeight: '700' },
  priceRow: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  price: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 34, lineHeight: 40, flexShrink: 1 },
  per: { fontSize: 15, marginBottom: 6 },
  weekly: { fontSize: 13 },
  pad: { paddingHorizontal: 16, marginTop: 18 },
  cta: { minHeight: 56, borderRadius: 28, backgroundColor: '#C6F04F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ctaText: { fontSize: 17, fontWeight: '700', color: '#0A0A0A' },
  summary: { marginTop: 12, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  legal: { marginTop: 12, fontSize: 12, lineHeight: 18 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  linkText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  restoreMsg: { fontSize: 13, textAlign: 'center' },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  smallLink: { fontSize: 13, textDecorationLine: 'underline' },
});
