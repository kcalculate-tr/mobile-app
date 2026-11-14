// G42-S1 md.8 — T1 teklif (yalnız A yolu). MEVCUT abonelik altyapısı: RevenueCat teklif kartları (usePlanCards,
// yerel fiyat), purchasePlan / restorePurchases, SubLegalLinks (Koşullar/EULA + Gizlilik). Yıllık/Aylık segment
// (varsayılan Yıllık); Balance Yıllık önerilen ve seçili, Fresh ikinci; deneme sonrası ücret + otomatik yenileme
// metni; geri yükleme. X ilk kareden görünür. Bildirim bandı "Planın e-posta adresine gönderildi" üstten iner
// (330 ms), 4 sn sonra / dokununca kalkar.
// G46-S1: md.2 aylık planlarda deneme rozeti/metni HİÇ yok (deneme koşulu yalnız denemeli planda). md.3 X → küçük
// onay sayfası (core/design Sheet): "Denemeye başla" → sayfa kapanır, seçili planın denemeli (yıllık) ürünüyle satın
// alma başlar; "Yine de çık" → HA. Seçili planda deneme yoksa onay sayfası açılmaz (deneme metni doğru olmaz) → HA.
// Metin doğruluğu: T1 açıldığında cihaz + hesap "gösterildi" işareti yazılır (offerOnce) → bir daha açılmaz.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, REDUCED, Sheet, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Check, X } from '../../../components/icons';
import type { PlanCard, PlanKey } from '../../../lib/subscription/plans';
import { purchasePlan, restorePurchases } from '../../../lib/subscription/purchases';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import SubLegalLinks from '../../subscription/ui/SubLegalLinks';
import { useCoachEnabled } from '../../coach/access';
import { CircleButton, FONT, KBackdrop, KButton, KText as AppText, Mascot, NoticeCard, Segment } from '../ui/parts';
import { K_MOTION, useK } from '../ui/theme';
import { PressScale, mixColor, useSelectTween } from '../ui/motion';
import { useKayit } from '../store';
import { kTrack } from '../events';
import { markOfferShown } from '../offerOnce';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

type Period = 'yearly' | 'monthly';
type Phase = 'idle' | 'buying' | 'success' | 'cancelled' | 'error';

export default function OfferScreen({ vitrinPhase, vitrinPeriod, vitrinConfirm, vitrin }: { vitrinPhase?: Phase; vitrinPeriod?: Period; vitrinConfirm?: boolean; vitrin?: boolean } = {}) {
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
  const [confirm, setConfirm] = useState(__DEV__ && !!vitrinConfirm);
  const viewed = useRef<Set<Period>>(new Set());

  // G46 md.3: T1 göründü → cihaz + hesap işareti (bir daha gösterilmez). YALNIZ __DEV__ vitrininde yazılmaz.
  useEffect(() => {
    if (__DEV__ && (vitrin || vitrinPhase || vitrinPeriod || vitrinConfirm)) return;
    void markOfferShown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Onay sayfası: seçili planın denemeli ürünü (deneme yalnız yıllıkta) — aylık sekmedeyken de aynı plan (tier).
  const trialCard = cards?.find((c) => c.tier === tier && c.yearly && (c.trialDays ?? 0) > 0) ?? null;

  const buy = async (card: PlanCard | null = selected) => {
    if (!card || phase === 'buying') return;
    setPhase('buying');
    const r = await purchasePlan(card.key as PlanKey);
    kTrack.trialStart(card.key, r);
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

  // G46 md.3: X → onay sayfası (deneme varsa); yoksa doğrudan HA.
  const close = () => {
    if (phase === 'buying') return;
    if (!trialCard) {
      goHome();
      return;
    }
    haptic('selection');
    setConfirm(true);
  };
  const stay = (startTrial: boolean) => {
    kTrack.dismissConfirm('stay');
    setConfirm(false);
    if (!startTrial || !trialCard) return;
    setPeriod('yearly');
    void buy(trialCard);
  };
  const leave = () => {
    kTrack.dismissConfirm('leave');
    setConfirm(false);
    goHome();
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
          <CircleButton testID="kayit-offer-close" onPress={close} label={t('kayit.offer.close')} disabled={buying}>
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
      <DismissConfirm
        visible={confirm}
        days={trialCard?.trialDays ?? 7}
        terms={trialCard ? t('kayit.offer.after_trial', { n: trialCard.trialDays ?? 7, price: trialCard.priceText }) : ''}
        onStart={() => stay(true)}
        onDismiss={() => stay(false)}
        onLeave={leave}
      />
    </View>
  );
}

/**
 * G46 md.3 — T1 kapatma onayı (alttan sayfa; uygulamanın ortak `Sheet`i: 28 üst köşe, tutamaç, 44 pt kapat, scrim).
 * Metin yalnız "bu ekran" için konuşur (T1 bir kez gösterilir — offerOnce); süre baskısı ifadesi YOK.
 * Ana: lime "Denemeye başla"; ikincil metin düğmesi "Yine de çık" (≥ 44 pt). Scrim / kapat / Android geri = kal.
 * HIG (apple-in-app-purchase › Clearly describe how a free trial works): "Denemeye başla" aylık sekmeden de yıllık
 * denemeli ürünü başlatır → düğmenin altında deneme süresi + deneme sonrası ücret (mevcut `after_trial` metni).
 */
function DismissConfirm({ visible, days, terms, onStart, onDismiss, onLeave }: { visible: boolean; days: number; terms: string; onStart: () => void; onDismiss: () => void; onLeave: () => void }) {
  const { t } = useT();
  const P = useK();
  return (
    <Sheet visible={visible} onClose={onDismiss} testID="kayit-offer-confirm">
      <View style={{ gap: 10, paddingBottom: 4 }}>
        <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.confirmTitle, { color: P.ink }]}>
          {t('kayit.offer.confirm_title', { n: days })}
        </AppText>
        <AppText maxFontSizeMultiplier={1.5} style={[styles.confirmBody, { color: P.sec }]}>
          {t('kayit.offer.confirm_body')}
        </AppText>
        <View style={{ marginTop: 12, gap: 4 }}>
          <KButton testID="kayit-offer-confirm-stay" label={t('kayit.offer.confirm_stay')} onPress={onStart} />
          {terms ? (
            <AppText testID="kayit-offer-confirm-terms" maxFontSizeMultiplier={1.5} style={[styles.confirmTerms, { color: P.sec }]}>
              {terms}
            </AppText>
          ) : null}
          <Pressable testID="kayit-offer-confirm-leave" onPress={onLeave} accessibilityRole="button" accessibilityLabel={t('kayit.offer.confirm_leave')} style={styles.leave}>
            <AppText maxFontSizeMultiplier={1.4} style={[styles.leaveText, { color: P.ink }]}>
              {t('kayit.offer.confirm_leave')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

function PlanRow({ card, name, sub, recommended, selected, locked, onPress, testID }: { card: PlanCard; name: string; sub: string; recommended?: boolean; selected: boolean; locked: boolean; onPress: () => void; testID?: string }) {
  const { t, lang } = useT();
  const P = useK();
  // G44: seçili = tam lime dolgu + limeInk metin; seçilmeyen tam opaklıkta cam yüzey (satın alınırken de
  // soluklaşmaz, yalnız dokunma kilitlenir); 160 ms renk geçişi; basışta 0,98 + 120 ms (yay yok).
  const k = useSelectTween(selected);
  const ink = mixColor(P.ink, P.limeInk, k);
  const sec = mixColor(P.sec, P.limeInkSec, k);
  const priceLine = card.yearly ? t('kayit.offer.per_year', { price: card.priceText }) : t('kayit.offer.per_month', { price: card.priceText });
  const trial = card.yearly && card.trialDays ? t('kayit.offer.trial', { n: card.trialDays }) : null;
  // G45 md.9: rozet zemini lime; kart lime dolguluyken (seçili) aynı saatle beyaza döner → lime üstünde okunur. Yazı siyah.
  const tagBg = mixColor(P.accent, '#FFFFFF', k);
  return (
    <PressScale
        testID={testID}
        disabled={locked}
        onPress={() => {
          haptic('selection');
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled: locked }}
        accessibilityLabel={[name, sub, priceLine, card.monthlyText ? t('sub.paywall.per_month_equiv', { price: card.monthlyText }) : null, trial, recommended ? t('kayit.offer.recommended') : null].filter(Boolean).join(', ')}
        style={[styles.plan, { backgroundColor: mixColor(P.card, P.accent, k), borderColor: mixColor(P.cardEdge, P.accent, k) }]}
      >
        <View style={[styles.radio, { borderColor: mixColor(P.sec, P.limeInk, k), backgroundColor: mixColor('transparent', P.limeInk, k) }]}>
          {k > 0 ? (
            <View style={{ opacity: k }}>
              <Check size={16} color={P.accent} weight="bold" />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.planName, { color: ink }]}>
            {name}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.planSub, { color: sec }]}>
            {sub}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: '52%' }}>
          {/* G46 md.2: deneme rozeti yalnız denemeli planda; aylıkta hiçbir şey çizilmez (boşluk kalmaz). */}
          {trial ? (
            <View testID="kayit-offer-trial-badge" style={[styles.badgeSoft, { backgroundColor: mixColor(P.infoBg, 'rgba(255,255,255,0.6)', k) }]}>
              <AppText maxFontSizeMultiplier={1.3} style={[styles.badgeText, { color: ink }]}>
                {trial}
              </AppText>
            </View>
          ) : null}
          <AppText maxFontSizeMultiplier={1.25} style={[styles.price, { color: ink }]}>
            {priceLine}
          </AppText>
          {card.monthlyText ? (
            <AppText maxFontSizeMultiplier={1.3} style={[styles.planSub, { color: sec }]}>
              {t('sub.paywall.per_month_equiv', { price: card.monthlyText })}
            </AppText>
          ) : null}
          {/* G45 md.9: "%… tasarruf" kartın İÇİNDE, fiyatın altında (alt kenara taşmaz); dolgulu, kenarsız, düz. */}
          {recommended && card.yearly && card.discountPct ? (
            <View testID="kayit-offer-save" style={[styles.tagInline, { backgroundColor: tagBg }]}>
              <AppText maxFontSizeMultiplier={1.2} style={[styles.tagText, { color: P.limeInk }]}>
                {t('kayit.offer.save_pct', { pct: lang === 'en' ? `${card.discountPct}%` : `%${card.discountPct}` })}
              </AppText>
            </View>
          ) : null}
        </View>
        {recommended ? (
          <View testID="kayit-offer-recommended" style={[styles.tag, { backgroundColor: tagBg }]}>
            <AppText maxFontSizeMultiplier={1.2} style={[styles.tagText, { color: P.limeInk }]}>
              {t('kayit.offer.recommended')}
            </AppText>
          </View>
        ) : null}
    </PressScale>
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
    else y.value = withTiming(0, { duration: K_MOTION.banner, easing: CURVE.enter });
    const id = setTimeout(hide, K_MOTION.bannerHold);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hide = () => {
    if (reduced) o.value = withTiming(0, { duration: REDUCED.duration });
    else y.value = withTiming(-140, { duration: K_MOTION.fast, easing: CURVE.exit });
    setTimeout(() => setGone(true), K_MOTION.banner);
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
  // G44: onay rozeti yaysız — 240 ms fade + 0,9 → 1 (azaltılmışta anlık).
  const s = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) s.value = withTiming(1, { duration: K_MOTION.enter, easing: CURVE.enter });
  }, [reduced, s]);
  const st = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: 0.9 + 0.1 * s.value }] }));
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
  title: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, textAlign: 'center', letterSpacing: -0.6, marginTop: 6 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 26, borderWidth: 1, padding: 18, paddingTop: 22, minHeight: 104 },
  radio: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  planName: { fontFamily: FONT.display, fontSize: 21, lineHeight: 26 },
  planSub: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19 },
  price: { fontFamily: FONT.bold, fontSize: 19, lineHeight: 24, textAlign: 'right' },
  badgeSoft: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: FONT.semi, fontSize: 12, lineHeight: 16 },
  // G45 md.9: kenar çizgisi ve eğiklik yok (düz, dolgulu).
  tag: { position: 'absolute', right: 22, top: -12, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  tagInline: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  tagText: { fontFamily: FONT.bold, fontSize: 13, lineHeight: 18 },
  after: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  renew: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  restore: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  restoreText: { fontFamily: FONT.semi, fontSize: 14, lineHeight: 19, textDecorationLine: 'underline' },
  banner: { position: 'absolute', left: 16, right: 16, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  bannerIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56 },
  bannerDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bannerText: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 20, flex: 1 },
  confirmTitle: { fontFamily: FONT.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  confirmBody: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21 },
  confirmTerms: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  leave: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  leaveText: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 21 },
  okBadge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
});

void useMemo;
