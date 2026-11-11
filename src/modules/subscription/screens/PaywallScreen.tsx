// G33-S1 md.2 — Paywall Fresh / Balance / EN (Tur 26n, 05-profil-paywall-koc). Önceki: G22-S1 FinSubPaywall.
//
// Düzen: hareketli bulanık yeşil zemin (onboarding ışıkları, yavaş kayma) · kapat · küçük "kcalAI" etiketi ·
// BÜYÜK başlık yalnız "Fresh" / "Balance" · özellik karuseli (cam nesne hafif süzülür, ARKASINDA yuvarlak
// yeşil katman YOK; sayfa noktaları + 44 pt duraklat; 3 sn'de bir otomatik, dokununca 6 sn bekler,
// azaltılmış harekette otomatik geçiş ve süzülme KAPALI) · Yıllık kart ("%58 tasarruf" + "7 gün ücretsiz" +
// "ayda N TL") ve Aylık kart (tek seçimli radyo) · Fresh'te "Balance'a yükselt" kartı, Balance'ta
// "‹ Fresh'e dön" · CTA "7 gün ücretsiz başla" · alt metin · yasal metin · Satın alımları geri yükle ·
// Koşullar · Gizlilik. Kademe değişince başlık + şerit + kartlar fast 220 crossfade.
// Fiyatlar YALNIZ RevenueCat yerel fiyatı (demoPrices yalnız test/vitrin yedeği; üretimde fiyat yoksa
// aynı ekranda hata kartı + Tekrar dene). Satın alma sonucu aynı ekranda SubResult.
// Koçlu varyant (`coach: true`, koçtan açılınca): Balance, şeritte "kcalAI Koç" sayfası, kartlarda "kcalAI Koç dahil".
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, DURATION, REDUCED, haptic, useDrift, useLoopFloat, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretRight, Check, Pause, Play, X } from '../../../components/icons';
import { type PlanCard, type PlanKey } from '../../../lib/subscription/plans';
import { purchasePlan, restorePurchases, useSubscriptionStore, useTier, type PurchaseResult } from '../../../lib/subscription/purchases';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import SubResult, { type SubResultState } from '../ui/SubResult';
import SubLegalLinks from '../ui/SubLegalLinks';
import { trackSub } from '../subTrack';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useCoachEnabled } from '../../coach/access';

/* eslint-disable @typescript-eslint/no-require-imports */
// Dosya adları SABİT (İlter ChatGPT ile üretiyor) — şimdilik mevcut cam nesnelerin kopyası.
const FEATURE_IMG = {
  ai: require('../../../../assets/glass/camera.png'),
  voice: require('../../../../assets/glass/mic.png'),
  barcode: require('../../../../assets/glass/barcode.png'),
  manual: require('../../../../assets/glass/infinity.png'),
  coach: require('../../../../assets/glass/bowl.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export type PaywallParams = { from?: string; plan?: 'fresh' | 'balance'; yearly?: boolean; coach?: boolean } | undefined;
type Group = 'fresh' | 'balance';

/** Koç günlük mesaj hakkı sunucudan gelmezse şeritte gösterilen sayı (README: günde 30). */
const COACH_DAILY_FALLBACK = 30;

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
  const { tier, status } = useTier();

  const coach = params.coach === true;
  // Koç yalnız `koc` açık + uç nokta hazırken anlatılır (kapalıyken Balance şeridinde/yükselt kartında koç YOK).
  const coachOn = useCoachEnabled() || coach;
  const [group, setGroup] = useState<Group>(() => (coach ? 'balance' : params.plan ?? (tier === 'fresh' ? 'balance' : 'fresh')));
  const [yearly, setYearly] = useState(() => (coach ? true : params.yearly ?? true));
  const [result, setResult] = useState<SubResultState | null>(null);
  const [buying, setBuying] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    trackSub('paywall_view', { from: ['limit_ai', 'limit_barcode', 'limit_voice', 'profile', 'pill', 'coach'].includes(params.from ?? '') ? params.from : 'other' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => navigation.goBack(), [navigation]);
  const switchGroup = (g: Group) => {
    haptic('selection');
    setGroup(g);
  };

  // ── Özellik şeridi ──
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
    setPage(0);
    stripRef.current?.scrollTo({ x: 0, animated: false });
    holdUntil.current = Date.now() + 3000;
  }, [group]);
  const autoOn = !reduced && !paused && !result;

  const coachDaily = limits?.coach?.daily ?? COACH_DAILY_FALLBACK;
  const features = useMemo(() => {
    const fresh = group === 'fresh';
    const aiN = (fresh ? limits?.ai.fresh : limits?.ai.balance) ?? '';
    const list = [
      { img: FEATURE_IMG.voice, title: tr(fresh ? 'sub.feature.fresh_voice_title' : 'sub.feature.balance_voice_title'), desc: tr(fresh ? 'sub.feature.fresh_voice_desc' : 'sub.feature.balance_voice_desc', { n: aiN }) },
      { img: FEATURE_IMG.ai, title: tr(fresh ? 'sub.feature.fresh_ai_title' : 'sub.feature.balance_ai_title', { n: aiN }), desc: tr(fresh ? 'sub.feature.fresh_ai_desc' : 'sub.feature.balance_ai_desc') },
      { img: FEATURE_IMG.barcode, title: tr('sub.feature.barcode_title'), desc: tr('sub.feature.barcode_desc') },
      { img: FEATURE_IMG.manual, title: tr('sub.feature.manual_title'), desc: tr('sub.feature.manual_desc') },
    ];
    if (!fresh && coachOn) list.unshift({ img: FEATURE_IMG.coach, title: tr('sub.feature.coach_title'), desc: tr('sub.feature.coach_desc', { n: coachDaily }) });
    return list;
  }, [group, limits?.ai.fresh, limits?.ai.balance, tr, coachDaily, coachOn]);
  const pageCount = useRef(features.length);
  pageCount.current = features.length;
  useEffect(() => {
    if (!autoOn) return;
    const id = setInterval(() => {
      if (!appActive.current || Date.now() < holdUntil.current) return;
      setPage((p) => {
        const next = (p + 1) % pageCount.current;
        stripRef.current?.scrollTo({ x: next * winW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [autoOn, winW]);

  const keyOf = (g: Group, y: boolean) => `${g}_${y ? 'yearly' : 'monthly'}` as PlanKey;
  const cur: PlanCard | null = cards?.find((c) => c.key === keyOf(group, yearly)) ?? null;
  const yearCard = cards?.find((c) => c.key === keyOf(group, true)) ?? null;
  const monthCard = cards?.find((c) => c.key === keyOf(group, false)) ?? null;
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
    if (restoring) return;
    setRestoring(true);
    setRestoreMsg(null);
    let r: Awaited<ReturnType<typeof restorePurchases>>;
    try {
      r = await restorePurchases();
    } finally {
      setRestoring(false);
    }
    trackSub('sub_restore', { result: r });
    if (r === 'restored') {
      setRestoreMsg(tr('sub.paywall.restore_ok'));
      setResult('success');
    } else setRestoreMsg(tr('sub.paywall.restore_none'));
  };

  if (result) {
    return (
      <SubResult
        state={result}
        card={cur}
        expiresAt={useSubscriptionStore.getState().rc?.expiresAt ?? null}
        aiPerDay={cur ? (cur.tier === 'balance' ? limits?.ai.balance : limits?.ai.fresh) ?? null : null}
        pendingVerify={result === 'success' && status === 'pending'}
        onClose={close}
        onPrimary={() => {
          if (result === 'success') navigation.goBack();
          else if (result === 'pending') close();
          else setResult(null);
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
  const loadFailed = !loading && (failed || !cards);
  const pricesLoading = loading && !cards;

  const trialDays = cur?.yearly ? cur.trialDays : null;
  const ctaLabel = trialDays ? tr('sub.paywall.cta_trial', { days: trialDays }) : tr('sub.paywall.cta');
  const summary = !cur
    ? ''
    : cur.yearly && trialDays
      ? tr('sub.paywall.sum_trial', { days: trialDays, price: cur.priceText })
      : cur.yearly
        ? tr('sub.paywall.sum_yearly', { price: cur.priceText })
        : tr('sub.paywall.sum_monthly', { price: cur.priceText });
  const fade = reduced ? FadeIn.duration(REDUCED.duration) : FadeIn.duration(DURATION.fast);
  const groupName = tr(group === 'balance' ? 'sub.paywall.balance' : 'sub.paywall.fresh');

  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]} testID="sub-paywall">
      <PaywallGlow dark={t.isDark} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: Math.max(24, insets.bottom + 16) }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={tr('sub.close')} style={styles.close} testID="sub-paywall-close">
            <X size={22} color={ink} />
          </Pressable>
        </View>

        <Animated.View key={`head-${group}`} entering={fade} style={styles.head}>
          <AppText style={[styles.brand, { color: t.color.secondary }]} testID="sub-brand">
            {tr('sub.brand')}
          </AppText>
          <AppText style={[styles.title, { color: ink }]} accessibilityRole="header" accessibilityLabel={`${tr('sub.brand')} ${groupName}`} testID="sub-title">
            {groupName}
          </AppText>
        </Animated.View>

        <Animated.View key={`strip-${group}`} entering={fade}>
          <ScrollView
            {...SCROLL_KEYBOARD}
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
              <View key={i} style={[styles.page, { width: winW }]} accessible accessibilityLabel={`${i + 1} / ${features.length}: ${f.title}. ${f.desc}`}>
                <FloatingGlass source={f.img} active={i === page} />
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
          <Dots n={features.length} active={page} dark={t.isDark} line2={line2} />
          <View style={styles.dotsSpacer}>
            {!reduced ? (
              <Pressable
                onPress={() => setPaused((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={paused ? tr('sub.paywall.play') : tr('sub.paywall.pause')}
                style={styles.pause}
                testID="sub-strip-pause"
              >
                {paused ? <Play size={14} color={ink} weight="fill" /> : <Pause size={14} color={ink} weight="fill" />}
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.pad}>
          {pricesLoading ? <PlanSkeleton /> : null}
          {loadFailed ? <LoadError onRetry={() => void reload()} /> : null}
          {cards && yearCard && monthCard ? (
            <Animated.View key={`cards-${group}`} entering={fade} style={styles.cards} accessibilityRole="radiogroup" testID="sub-cards">
              <PlanRow c={yearCard} selected={yearly} coach={coach && group === 'balance'} onPress={() => { haptic('selection'); setYearly(true); }} />
              <PlanRow c={monthCard} selected={!yearly} coach={coach && group === 'balance'} onPress={() => { haptic('selection'); setYearly(false); }} />
              {group === 'fresh' ? (
                <Pressable
                  onPress={() => switchGroup('balance')}
                  accessibilityRole="button"
                  style={[styles.upgrade, { backgroundColor: t.isDark ? '#1C1C1E' : '#FFFFFF' }]}
                  testID="sub-upgrade-balance"
                >
                  <Image source={FEATURE_IMG.coach} style={styles.upgradeImg} resizeMode="contain" accessibilityIgnoresInvertColors />
                  <View style={styles.flex1}>
                    <AppText style={[styles.upgradeTitle, { color: ink }]}>{tr('sub.paywall.upgrade')}</AppText>
                    <AppText tone="secondary" style={styles.upgradeSub}>
                      {coachOn
                        ? limits?.ai.balance
                          ? tr('sub.paywall.upgrade_sub', { n: limits.ai.balance })
                          : tr('sub.paywall.upgrade_sub_plain')
                        : limits?.ai.balance
                          ? tr('sub.feature.balance_ai_title', { n: limits.ai.balance })
                          : tr('sub.paywall.balance')}
                    </AppText>
                  </View>
                  <CaretRight size={16} color={t.color.secondary} />
                </Pressable>
              ) : (
                <Pressable onPress={() => switchGroup('fresh')} accessibilityRole="button" style={styles.backFresh} testID="sub-back-fresh">
                  {/* Yerinde kademe geçişi (gezinme DEĞİL) — modalda geri oku kullanılmaz; tasarımdaki "‹" yalnız glif. */}
                  <AppText style={[styles.backFreshText, { color: ink }]} accessibilityElementsHidden importantForAccessibility="no">
                    {'‹'}
                  </AppText>
                  <AppText style={[styles.backFreshText, { color: ink }]}>{tr('sub.paywall.back_fresh')}</AppText>
                </Pressable>
              )}
            </Animated.View>
          ) : null}

          {!loadFailed ? (
            <Pressable
              onPress={() => void buy()}
              disabled={!cur || buying}
              accessibilityRole="button"
              accessibilityState={{ busy: buying || pricesLoading, disabled: !cur || buying }}
              style={[styles.cta, { opacity: buying || !cur ? 0.6 : 1 }]}
              testID="sub-cta"
            >
              <Animated.View key={ctaLabel} entering={fade}>
                <AppText style={styles.ctaText}>{buying ? tr('sub.paywall.buying') : pricesLoading ? tr('sub.paywall.loading') : ctaLabel}</AppText>
              </Animated.View>
            </Pressable>
          ) : null}
          {summary ? (
            <AppText style={[styles.summary, { color: ink }]} testID="sub-summary">
              {summary}
            </AppText>
          ) : null}
          <AppText tone="secondary" style={styles.legal}>
            {tr('sub.paywall.legal')}
          </AppText>
          <Pressable
            onPress={() => void restore()}
            disabled={restoring}
            accessibilityRole="button"
            accessibilityState={{ busy: restoring, disabled: restoring }}
            style={[styles.link, styles.restoreRow]}
            testID="sub-restore"
          >
            {restoring ? <ActivityIndicator size="small" color={ink} testID="sub-restore-busy" /> : null}
            <AppText style={[styles.linkText, restoring ? styles.dim : null]}>{restoring ? tr('sub.paywall.restoring') : tr('sub.paywall.restore')}</AppText>
          </Pressable>
          {restoreMsg ? (
            <AppText tone="secondary" style={styles.restoreMsg} accessibilityLiveRegion="polite">
              {restoreMsg}
            </AppText>
          ) : null}
          <SubLegalLinks navigation={navigation} />
        </View>
      </ScrollView>
    </View>
  );
}

/** Onboarding'deki iki bulanık lime ışık; yavaş kayar (azaltılmışta sabit). Dokunmayı engellemez. */
function PaywallGlow({ dark }: { dark: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const a = useDrift(0);
  const b = useDrift(1);
  const oA = dark ? 0.38 : 0.3;
  const oB = dark ? 0.3 : 0.24;
  const R = Math.max(W, 360) * 0.85;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="sub-glow">
      <Animated.View style={[StyleSheet.absoluteFill, a.style]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="pwA" cx={W * 0.22} cy={H * 0.2} rx={R} ry={R} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#C6F04F" stopOpacity={oA} />
              <Stop offset="0.45" stopColor="#C6F04F" stopOpacity={oA * 0.55} />
              <Stop offset="1" stopColor="#C6F04F" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="url(#pwA)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, b.style]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="pwB" cx={W * 0.85} cy={H * 0.62} rx={R * 0.9} ry={R * 0.9} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#C6F04F" stopOpacity={oB} />
              <Stop offset="0.45" stopColor="#C6F04F" stopOpacity={oB * 0.55} />
              <Stop offset="1" stopColor="#C6F04F" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="url(#pwB)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Cam nesne — arkasında yuvarlak yeşil katman YOK; görünür sayfada hafif süzülür. */
function FloatingGlass({ source, active }: { source: number; active: boolean }) {
  const f = useLoopFloat();
  return (
    <Animated.View style={[styles.glassWrap, active ? f.style : null]}>
      <Image source={source} style={styles.glass} resizeMode="contain" accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

function PlanRow({ c, selected, coach, onPress }: { c: PlanCard; selected: boolean; coach?: boolean; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const frame = t.isDark ? '#C6F04F' : '#4A6B00';
  const ink = t.color.ink;
  const period = tr(c.yearly ? 'sub.paywall.yearly' : 'sub.paywall.monthly');
  const priceLine = `${c.priceText}${tr(c.yearly ? 'sub.paywall.per_year' : 'sub.paywall.per_month')}`;
  const a11y = `${tr('sub.paywall.plan_a11y', { period, price: priceLine })}${c.trialDays ? tr('sub.paywall.card_trial_a11y', { days: c.trialDays }) : ''}${
    c.discountPct ? `, ${tr('sub.paywall.save', { pct: c.discountPct })}` : ''
  }${coach ? `, ${tr('sub.feature.coach_card')}` : ''}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={a11y}
      style={[styles.card, { backgroundColor: card, borderColor: selected ? frame : 'transparent' }]}
      testID={`sub-card-${c.key}`}
    >
      {c.yearly && c.discountPct ? (
        <View style={[styles.save, { backgroundColor: ink }]} testID={`sub-save-${c.key}`}>
          <AppText style={[styles.saveText, { color: t.color.bg }]}>{tr('sub.paywall.save', { pct: c.discountPct })}</AppText>
        </View>
      ) : null}
      <View style={styles.cardRow}>
        <View style={[styles.radio, selected ? { backgroundColor: '#C6F04F', borderColor: '#C6F04F' } : { borderColor: t.isDark ? '#48484A' : '#C3C7CC' }]}>
          {selected ? <Check size={14} color="#0A0A0A" weight="bold" /> : null}
        </View>
        <AppText style={[styles.period, { color: ink }]}>{period}</AppText>
        <View style={styles.flex1} />
        <View style={styles.priceCol}>
          {c.trialDays ? (
            <View style={styles.trialChip}>
              <AppText style={styles.trialText}>{tr('sub.paywall.trial', { days: c.trialDays })}</AppText>
            </View>
          ) : null}
          <AppText style={[styles.price, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {priceLine}
          </AppText>
          {c.monthlyText ? (
            <AppText tone="secondary" style={styles.monthly}>
              {tr('sub.paywall.per_month_equiv', { price: c.monthlyText })}
            </AppText>
          ) : null}
        </View>
      </View>
      {coach ? (
        <View style={[styles.coachRow, { borderTopColor: t.color.line }]} testID={`sub-card-coach-${c.key}`}>
          <Image source={FEATURE_IMG.coach} style={styles.coachImg} resizeMode="contain" accessibilityIgnoresInvertColors />
          <AppText style={[styles.coachText, { color: ink }]}>{tr('sub.feature.coach_card')}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Fiyat yüklenirken: 2 kart iskeleti (kart ölçüsünde, hareketsiz) + canlı bölge metni. */
function PlanSkeleton() {
  const t = useTheme();
  const { t: tr } = useT();
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const bar = t.isDark ? '#2C2C2E' : '#ECEEF1';
  return (
    <View testID="sub-cards-loading" accessible accessibilityRole="progressbar" accessibilityLabel={tr('sub.paywall.loading')} accessibilityState={{ busy: true }} style={styles.cards}>
      {[0, 1].map((i) => (
        <View key={i} style={[styles.card, styles.skelCard, { backgroundColor: card, borderColor: 'transparent' }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.skelBar, { backgroundColor: bar, width: 80, height: 18 }]} />
          <View style={styles.flex1} />
          <View style={[styles.skelBar, { backgroundColor: bar, width: 110, height: 22 }]} />
        </View>
      ))}
      <AppText tone="secondary" style={styles.skelText} accessibilityLiveRegion="polite">
        {tr('sub.paywall.loading')}
      </AppText>
    </View>
  );
}

/** Fiyat gelmedi: kart yerinde hata kartı + Tekrar dene (≥ 44 pt). */
function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  return (
    <View style={[styles.errCard, { backgroundColor: card }]} testID="sub-load-error" accessibilityLiveRegion="polite">
      <AppText style={[styles.errTitle, { color: t.color.ink }]} accessibilityRole="header">
        {tr('sub.paywall.load_error_title')}
      </AppText>
      <AppText tone="secondary" style={styles.errBody}>
        {tr('sub.paywall.load_error_body')}
      </AppText>
      <Pressable onPress={onRetry} accessibilityRole="button" style={[styles.errBtn, { backgroundColor: t.color.ink }]} testID="sub-load-retry">
        <AppText style={[styles.errBtnText, { color: t.color.bg }]}>{tr('sub.paywall.retry')}</AppText>
      </Pressable>
    </View>
  );
}

function Dots({ n, active, dark, line2 }: { n: number; active: number; dark: boolean; line2: string }) {
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[styles.dot, i === active ? { width: 18, backgroundColor: dark ? '#C6F04F' : '#0A0A0A' } : { backgroundColor: line2 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginTop: -4 },
  brand: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 36, lineHeight: 42, textAlign: 'center' },
  page: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 8 },
  glassWrap: { width: 140, height: 112, alignItems: 'center', justifyContent: 'center' },
  glass: { width: 120, height: 104 },
  fTitle: { marginTop: 8, fontSize: 19, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  fDesc: { marginTop: 4, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 6 },
  dotsSpacer: { flex: 1, alignItems: 'flex-end' },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pause: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: 16, marginTop: 10 },
  cards: { gap: 12, marginBottom: 16 },
  card: { borderRadius: 20, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 14, minHeight: 64, shadowColor: '#0A0A0A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  period: { fontSize: 16, fontWeight: '600' },
  priceCol: { alignItems: 'flex-end', flexShrink: 1 },
  trialChip: { backgroundColor: '#C6F04F', borderRadius: 8, paddingHorizontal: 8, minHeight: 20, justifyContent: 'center', marginBottom: 4 },
  trialText: { fontSize: 12, fontWeight: '700', color: '#0A0A0A' },
  price: { fontSize: 18, fontWeight: '800' },
  monthly: { fontSize: 12, marginTop: 2 },
  save: { position: 'absolute', top: -12, right: 14, borderRadius: 10, paddingHorizontal: 10, minHeight: 22, justifyContent: 'center', zIndex: 2 },
  saveText: { fontSize: 12, fontWeight: '700' },
  coachRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachImg: { width: 24, height: 24 },
  coachText: { flexShrink: 1, fontSize: 13, fontWeight: '600', lineHeight: 17 },
  upgrade: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  upgradeImg: { width: 44, height: 30 },
  upgradeTitle: { fontSize: 15, fontWeight: '700' },
  upgradeSub: { fontSize: 12, marginTop: 2 },
  backFresh: { alignSelf: 'center', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  backFreshText: { fontSize: 14, fontWeight: '600' },
  cta: { minHeight: 56, borderRadius: 28, backgroundColor: '#C6F04F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ctaText: { fontSize: 17, fontWeight: '700', color: '#0A0A0A' },
  summary: { marginTop: 12, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  legal: { marginTop: 12, fontSize: 12, lineHeight: 17 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  linkText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  restoreMsg: { fontSize: 13, textAlign: 'center' },
  restoreRow: { flexDirection: 'row', gap: 8 },
  dim: { opacity: 0.6 },
  skelCard: { flexDirection: 'row', alignItems: 'center' },
  skelBar: { borderRadius: 8 },
  skelText: { textAlign: 'center', fontSize: 15 },
  errCard: { marginBottom: 16, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  errTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, lineHeight: 26, textAlign: 'center' },
  errBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  errBtn: { marginTop: 8, minHeight: 48, borderRadius: 24, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  errBtnText: { fontSize: 16, fontWeight: '700' },
});
