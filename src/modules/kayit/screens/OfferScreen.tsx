// G42-S1 md.8 — T1 teklif (yalnız A yolu). MEVCUT abonelik altyapısı: RevenueCat teklif kartları (usePlanCards,
// yerel fiyat), purchasePlan / restorePurchases, SubLegalLinks (Koşullar/EULA + Gizlilik). Yıllık/Aylık segment
// (varsayılan Yıllık); Balance Yıllık önerilen ve seçili, Fresh ikinci; aylıkta deneme yok; deneme sonrası ücret +
// otomatik yenileme metni; geri yükleme. X ilk kareden görünür → HA (Ana sayfa, plan yüklü). Bildirim bandı
// "Planın e-posta adresine gönderildi" üstten iner (330 ms), 4 sn sonra / dokununca kalkar.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { AppText, CURVE, REDUCED, SPRING, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Check, X } from '../../../components/icons';
import type { PlanCard, PlanKey } from '../../../lib/subscription/plans';
import { purchasePlan, restorePurchases } from '../../../lib/subscription/purchases';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import SubLegalLinks from '../../subscription/ui/SubLegalLinks';
import { useCoachEnabled } from '../../coach/access';
import { CircleButton, FONT, KBackdrop, KButton, Mascot, NoticeCard, Segment } from '../ui/parts';
import { K_MOTION, useK } from '../ui/theme';
import { useKayit } from '../store';
import { kTrack } from '../events';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

type Period = 'yearly' | 'monthly';
type Phase = 'idle' | 'buying' | 'success' | 'cancelled' | 'error';

export default function OfferScreen({ vitrinPhase, vitrinPeriod }: { vitrinPhase?: Phase; vitrinPeriod?: Period } = {}) {
  const { t } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const coachOn = useCoachEnabled();
  const { cards, loading, failed, reload } = usePlanCards(true);
  const emailSent = useKayit((s) => s.emailSent);
  const [period, setPeriod] = useState<Period>(__DEV__ && vitrinPeriod ? vitrinPeriod : 'yearly');
  const [tier, setTier] = useState<'balance' | 'fresh'>('balance');
  const [phase, setPhase] = useState<Phase>(__DEV__ && vitrinPhase ? vitrinPhase : 'idle');
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const viewed = useRef<Set<Period>>(new Set());

  useEffect(() => {
    if (viewed.current.has(period)) return;
    viewed.current.add(period);
    kTrack.paywallView(period);
  }, [period]);

  const goHome = () => {
    const root = navigation.getParent?.() ?? navigation;
    root.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
  };

  // Başarı: 2 sn sonra kendiliğinden ana sayfa.
  useEffect(() => {
    if (phase !== 'success' || (__DEV__ && vitrinPhase)) return;
    // HIG: ekran okuyucu açıkken duyuru kesilmesin → otomatik geçiş yok, "Ana sayfaya git" düğmesi kalır.
    let id: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isScreenReaderEnabled().then((sr) => {
      if (!sr) id = setTimeout(goHome, 2000);
    });
    return () => {
      if (id) clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const pick = (tr: 'balance' | 'fresh') => cards?.find((c) => c.tier === tr && c.yearly === (period === 'yearly')) ?? null;
  const balance = pick('balance');
  const fresh = pick('fresh');
  const selected = tier === 'balance' ? balance : fresh;
  const trialDays = period === 'yearly' ? (selected?.trialDays ?? null) : null;

  const buy = async () => {
    if (!selected || phase === 'buying') return;
    setPhase('buying');
    const r = await purchasePlan(selected.key as PlanKey);
    kTrack.trialStart(selected.key, r);
    if (r === 'success') {
      haptic('success');
      setPhase('success');
    } else if (r === 'cancelled') setPhase('cancelled');
    else if (r === 'pending') setPhase('idle');
    else {
      haptic('warning');
      setPhase('error');
    }
  };

  const restore = async () => {
    const r = await restorePurchases();
    if (r === 'restored') goHome();
    else setRestoreMsg(r === 'none' ? t('sub.paywall.restore_none') : t('kayit.offer.failed_sub'));
  };

  if (phase === 'success' && selected) {
    return <SuccessView plan={selected.tier === 'balance' ? 'Balance' : 'Fresh'} trialDays={trialDays} onHome={goHome} />;
  }

  const buying = phase === 'buying';
  return (
    <View style={{ flex: 1 }} testID="kayit-offer">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={30} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 16, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <View style={{ width: 52 }} />
          <Mascot size={110} />
          <CircleButton testID="kayit-offer-close" onPress={goHome} label={t('kayit.offer.close')} disabled={buying}>
            <X size={22} color={P.ink} weight="bold" />
          </CircleButton>
        </View>
        <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, { color: P.ink }]}>
          {t('kayit.offer.title')}
        </AppText>
        <View style={{ marginTop: 18 }}>
          <Segment
            testID="kayit-period"
            label={t('kayit.offer.period_group')}
            width={260}
            value={period}
            onChange={(v) => !buying && setPeriod(v)}
            options={[
              { key: 'yearly', label: t('kayit.offer.yearly') },
              { key: 'monthly', label: t('kayit.offer.monthly') },
            ]}
          />
        </View>
        <View style={{ gap: 14, marginTop: 22 }}>
          {phase === 'error' ? <NoticeCard testID="kayit-offer-failed" tone="error" title={t('kayit.offer.failed_title')} sub={t('kayit.offer.failed_sub')} /> : null}
          {phase === 'cancelled' ? <NoticeCard title={t('kayit.offer.failed_title')} sub={t('kayit.offer.cancelled_sub')} /> : null}
          {loading && !cards ? <ActivityIndicator color={P.ink} style={{ marginVertical: 40 }} /> : null}
          {failed && !cards ? <NoticeCard tone="error" title={t('kayit.offer.prices_error')} action={{ label: t('common.retry'), onPress: () => void reload() }} /> : null}
          {balance ? (
            <PlanRow
              testID="kayit-plan-balance"
              card={balance}
              name="Balance"
              sub={coachOn ? t('kayit.offer.balance_sub') : t('kayit.offer.balance_sub_nocoach')}
              recommended
              selected={tier === 'balance'}
              locked={buying}
              onPress={() => setTier('balance')}
            />
          ) : null}
          {fresh ? <PlanRow testID="kayit-plan-fresh" card={fresh} name="Fresh" sub={t('kayit.offer.fresh_sub')} selected={tier === 'fresh'} locked={buying} onPress={() => setTier('fresh')} /> : null}
        </View>
        {selected ? (
          <View style={{ marginTop: 20, gap: 14 }}>
            <KButton
              testID="kayit-offer-buy"
              label={trialDays ? t('kayit.offer.cta_trial', { n: trialDays }) : t('kayit.offer.cta_sub')}
              onPress={() => void buy()}
              loading={buying}
            />
            <AppText maxFontSizeMultiplier={1.4} style={[styles.after, { color: P.ink }]}>
              {trialDays
                ? t('kayit.offer.after_trial', { n: trialDays, price: selected.priceText })
                : period === 'monthly'
                  ? t('kayit.offer.after_monthly', { price: selected.priceText })
                  : t('kayit.offer.after_yearly', { price: selected.priceText })}
            </AppText>
            <AppText maxFontSizeMultiplier={1.4} style={[styles.renew, { color: P.sec }]}>
              {t('kayit.offer.renew')}
            </AppText>
          </View>
        ) : null}
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <Pressable testID="kayit-offer-restore" onPress={() => void restore()} accessibilityRole="button" accessibilityLabel={t('sub.paywall.restore')} style={styles.restore} disabled={buying}>
            <AppText maxFontSizeMultiplier={1.4} style={[styles.restoreText, { color: P.ink }]}>
              {t('sub.paywall.restore')}
            </AppText>
          </Pressable>
          {restoreMsg ? (
            <AppText accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4} style={[styles.renew, { color: P.sec }]}>
              {restoreMsg}
            </AppText>
          ) : null}
          <SubLegalLinks navigation={navigation} />
        </View>
      </ScrollView>
      {emailSent ? <Banner text={t('kayit.offer.banner')} top={insets.top + 6} /> : null}
    </View>
  );
}

function PlanRow({ card, name, sub, recommended, selected, locked, onPress, testID }: { card: PlanCard; name: string; sub: string; recommended?: boolean; selected: boolean; locked: boolean; onPress: () => void; testID?: string }) {
  const { t, lang } = useT();
  const P = useK();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const priceLine = card.yearly ? t('kayit.offer.per_year', { price: card.priceText }) : t('kayit.offer.per_month', { price: card.priceText });
  const trial = card.yearly && card.trialDays ? t('kayit.offer.trial', { n: card.trialDays }) : null;
  return (
    <Animated.View style={[st, { opacity: locked ? 0.6 : 1 }]}>
      <Pressable
        testID={testID}
        disabled={locked}
        onPressIn={() => {
          if (!reduced) s.value = withTiming(0.96, { duration: K_MOTION.stagger });
        }}
        onPressOut={() => {
          if (!reduced) s.value = withSpring(1, SPRING.bouncy);
        }}
        onPress={() => {
          haptic('selection');
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled: locked }}
        accessibilityLabel={[name, sub, priceLine, card.monthlyText ? t('sub.paywall.per_month_equiv', { price: card.monthlyText }) : null, trial, !card.yearly ? t('kayit.offer.no_trial') : null, recommended ? t('kayit.offer.recommended') : null].filter(Boolean).join(', ')}
        style={[styles.plan, { backgroundColor: selected ? P.accent : P.card, borderColor: selected ? P.accent : P.cardEdge }, recommended && card.yearly && card.discountPct ? { paddingBottom: 30 } : null]}
      >
        <View style={[styles.radio, { borderColor: selected ? '#10301D' : P.sec, backgroundColor: selected ? 'rgba(255,255,255,0.5)' : 'transparent' }]}>{selected ? <Check size={16} color="#10301D" weight="bold" /> : null}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.planName, { color: selected ? '#10301D' : P.ink }]}>
            {name}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.planSub, { color: selected ? 'rgba(16,48,29,0.72)' : P.sec }]}>
            {sub}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: '52%' }}>
          {trial ? (
            <View style={[styles.badgeSoft, { backgroundColor: selected ? 'rgba(255,255,255,0.6)' : P.infoBg }]}>
              <AppText maxFontSizeMultiplier={1.3} style={[styles.badgeText, { color: '#10301D' }, !selected && { color: P.ink }]}>
                {trial}
              </AppText>
            </View>
          ) : !card.yearly ? (
            <AppText maxFontSizeMultiplier={1.3} style={[styles.planSub, { color: selected ? 'rgba(16,48,29,0.72)' : P.sec }]}>
              {t('kayit.offer.no_trial')}
            </AppText>
          ) : null}
          <AppText maxFontSizeMultiplier={1.25} style={[styles.price, { color: selected ? '#10301D' : P.ink }]}>
            {priceLine}
          </AppText>
          {card.monthlyText ? (
            <AppText maxFontSizeMultiplier={1.3} style={[styles.planSub, { color: selected ? 'rgba(16,48,29,0.72)' : P.sec }]}>
              {t('sub.paywall.per_month_equiv', { price: card.monthlyText })}
            </AppText>
          ) : null}
        </View>
        {recommended ? (
          <View style={[styles.tag, { backgroundColor: P.accent, borderColor: selected ? '#10301D' : P.accent }]}>
            <AppText maxFontSizeMultiplier={1.2} style={styles.tagText}>
              {t('kayit.offer.recommended')}
            </AppText>
          </View>
        ) : null}
        {recommended && card.yearly && card.discountPct ? (
          <View style={[styles.tag, { top: undefined, bottom: -12, backgroundColor: P.accent }]}>
            <AppText maxFontSizeMultiplier={1.2} style={styles.tagText}>
              {t('kayit.offer.save_pct', { pct: lang === 'en' ? `${card.discountPct}%` : `%${card.discountPct}` })}
            </AppText>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function Banner({ text, top }: { text: string; top: number }) {
  const P = useK();
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : -120);
  const o = useSharedValue(reduced ? 0 : 1);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (reduced) o.value = withTiming(1, { duration: REDUCED.duration });
    else y.value = withTiming(0, { duration: K_MOTION.shared, easing: CURVE.enter });
    const id = setTimeout(hide, K_MOTION.bannerHold);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hide = () => {
    if (reduced) o.value = withTiming(0, { duration: REDUCED.duration });
    else y.value = withTiming(-140, { duration: K_MOTION.fast, easing: CURVE.exit });
    setTimeout(() => setGone(true), K_MOTION.shared);
  };
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  if (gone) return null;
  return (
    <Animated.View style={[styles.banner, { top, backgroundColor: P.isDark ? '#1E3A24' : '#FFFFFF' }, st]}>
      <Pressable testID="kayit-email-banner" onPress={hide} accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={text} style={styles.bannerIn}>
        <View style={[styles.bannerDot, { backgroundColor: P.accent }]}>
          <Check size={14} color="#10301D" weight="bold" />
        </View>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.bannerText, { color: P.ink }]}>
          {text}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

function SuccessView({ plan, trialDays, onHome }: { plan: string; trialDays: number | null; onHome: () => void }) {
  const { t } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.4);
  useEffect(() => {
    if (!reduced) s.value = withSpring(1, SPRING.bouncy);
  }, [reduced, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={{ flex: 1 }} testID="kayit-offer-success">
      <KBackdrop shift={31} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 14 }}>
        <Mascot size={130} react="ok" />
        <Animated.View style={[styles.okBadge, { backgroundColor: P.accent }, st]}>
          <Check size={30} color="#10301D" weight="bold" />
        </Animated.View>
        <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, { color: P.ink }]}>
          {trialDays ? t('kayit.offer.success_title', { plan }) : t('kayit.offer.success_title_sub', { plan })}
        </AppText>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.planName, { color: P.ink }]}>
          {t('kayit.offer.success_hello')}
        </AppText>
        {trialDays ? (
          <AppText maxFontSizeMultiplier={1.4} style={[styles.after, { color: P.sec }]}>
            {t('kayit.offer.success_sub', { n: trialDays })}
          </AppText>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <KButton testID="kayit-offer-home" label={t('kayit.offer.success_cta')} onPress={onHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontFamily: FONT.display, fontSize: 30, lineHeight: 34, textAlign: 'center', letterSpacing: -0.6, marginTop: 6 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 26, borderWidth: 1, padding: 18, paddingTop: 22, minHeight: 104 },
  radio: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  planName: { fontFamily: FONT.display, fontSize: 21 },
  planSub: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19 },
  price: { fontFamily: FONT.bold, fontSize: 19, textAlign: 'right' },
  badgeSoft: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: FONT.semi, fontSize: 12 },
  tag: { position: 'absolute', right: 22, top: -12, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, transform: [{ rotate: '2deg' }] },
  tagText: { fontFamily: FONT.bold, fontSize: 13, color: '#10301D' },
  after: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  renew: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  restore: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  restoreText: { fontFamily: FONT.semi, fontSize: 14, textDecorationLine: 'underline' },
  banner: { position: 'absolute', left: 16, right: 16, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  bannerIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56 },
  bannerDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bannerText: { fontFamily: FONT.semi, fontSize: 15, flex: 1 },
  okBadge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
});

void useMemo;
