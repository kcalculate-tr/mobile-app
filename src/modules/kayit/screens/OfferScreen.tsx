// G42-S1 md.8 / G43-S1 — T1 teklif (yalnız A yolu). MEVCUT abonelik altyapısı: RevenueCat teklif kartları
// (usePlanCards, yerel fiyat), purchasePlan / restorePurchases, SubLegalLinks (Koşullar/EULA + Gizlilik).
// Görünüm ana paywall ile BİREBİR: zemin (PaywallGlow), kart (beyaz/koyu yüzey, yarıçap 20, seçili = 2 pt lime
// kenar + lime radyo işareti, zemin dolmaz), rozet (ink zemin), fiyat tipografisi, yasal metin, bağlantılar.
// Yıllık/Aylık segment (varsayılan Yıllık; standart segment) + Balance önerilen ve seçili, Fresh ikinci; aylıkta
// deneme yok. X → HA (Ana sayfa, plan yüklü). "Planın e-posta adresine gönderildi" bandı 4 sn sonra / dokununca
// kalkar (220 ms fade; azaltılmışta anında). Maskot başlıkta, paywall üst görseliyle aynı boyutta, sabit.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { palette } from '../../../core/design/tokens';
import { useT } from '../../../core/i18n';
import { Check, X } from '../../../components/icons';
import type { PlanCard, PlanKey } from '../../../lib/subscription/plans';
import { purchasePlan, restorePurchases } from '../../../lib/subscription/purchases';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import SubLegalLinks from '../../subscription/ui/SubLegalLinks';
import { PaywallGlow } from '../../subscription/screens/PaywallScreen';
import { useCoachEnabled } from '../../coach/access';
import { FONT, IconButton, KButton, KFooter, Mascot, NoticeCard, Segment } from '../ui/parts';
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
    <View style={{ flex: 1, backgroundColor: P.bg }} testID="kayit-offer">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <PaywallGlow dark={P.isDark} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 16) + 16, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <IconButton testID="kayit-offer-close" onPress={goHome} label={t('kayit.offer.close')} disabled={buying}>
            <X size={22} color={P.ink} />
          </IconButton>
        </View>
        <View style={styles.head}>
          <Mascot size={104} />
          <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, { color: P.ink }]}>
            {t('kayit.offer.title')}
          </AppText>
        </View>
        <View style={{ marginTop: 18, paddingHorizontal: 40 }}>
          <Segment
            testID="kayit-period"
            label={t('kayit.offer.period_group')}
            value={period}
            onChange={(v) => !buying && setPeriod(v)}
            options={[
              { key: 'yearly', label: t('kayit.offer.yearly') },
              { key: 'monthly', label: t('kayit.offer.monthly') },
            ]}
          />
        </View>
        <View style={{ gap: 12, marginTop: 24 }}>
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
          <View style={{ marginTop: 16 }}>
            <KButton
              testID="kayit-offer-buy"
              label={trialDays ? t('kayit.offer.cta_trial', { n: trialDays }) : t('kayit.offer.cta_sub')}
              onPress={() => void buy()}
              loading={buying}
            />
            <AppText maxFontSizeMultiplier={1.4} style={[styles.summary, { color: P.ink }]}>
              {trialDays
                ? t('kayit.offer.after_trial', { n: trialDays, price: selected.priceText })
                : period === 'monthly'
                  ? t('kayit.offer.after_monthly', { price: selected.priceText })
                  : t('kayit.offer.after_yearly', { price: selected.priceText })}
            </AppText>
            <AppText maxFontSizeMultiplier={1.4} style={[styles.legal, { color: P.sec }]}>
              {t('kayit.offer.renew')}
            </AppText>
          </View>
        ) : null}
        <View style={{ marginTop: 4, alignItems: 'center' }}>
          <Pressable testID="kayit-offer-restore" onPress={() => void restore()} accessibilityRole="button" accessibilityLabel={t('sub.paywall.restore')} style={styles.link} disabled={buying}>
            <AppText maxFontSizeMultiplier={1.4} style={[styles.linkText, { color: P.ink }]}>
              {t('sub.paywall.restore')}
            </AppText>
          </Pressable>
          {restoreMsg ? (
            <AppText accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4} style={[styles.restoreMsg, { color: P.sec }]}>
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

/** Ana paywall PlanRow ile aynı kart: yüzey, yarıçap 20, 2 pt seçili çerçeve, lime radyo, ink rozet, fiyat sütunu. */
function PlanRow({ card, name, sub, recommended, selected, locked, onPress, testID }: { card: PlanCard; name: string; sub: string; recommended?: boolean; selected: boolean; locked: boolean; onPress: () => void; testID?: string }) {
  const { t, lang } = useT();
  const th = useTheme();
  const P = useK();
  const surface = th.isDark ? '#1C1C1E' : '#FFFFFF';
  const frame = th.isDark ? palette.lime : '#4A6B00';
  const priceLine = card.yearly ? t('kayit.offer.per_year', { price: card.priceText }) : t('kayit.offer.per_month', { price: card.priceText });
  const trial = card.yearly && card.trialDays ? t('kayit.offer.trial', { n: card.trialDays }) : null;
  const save = recommended && card.yearly && card.discountPct ? t('kayit.offer.save_pct', { pct: lang === 'en' ? `${card.discountPct}%` : `%${card.discountPct}` }) : null;
  return (
    <Pressable
      testID={testID}
      disabled={locked}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: locked }}
      accessibilityLabel={[name, sub, priceLine, card.monthlyText ? t('sub.paywall.per_month_equiv', { price: card.monthlyText }) : null, trial, !card.yearly ? t('kayit.offer.no_trial') : null, recommended ? t('kayit.offer.recommended') : null, save].filter(Boolean).join(', ')}
      style={[styles.card, { backgroundColor: surface, borderColor: selected ? frame : 'transparent', opacity: locked ? 0.6 : 1 }]}
    >
      {recommended ? (
        <View style={styles.badges}>
          {[t('kayit.offer.recommended'), save].filter(Boolean).map((b) => (
            <View key={b as string} style={[styles.save, { backgroundColor: th.color.ink }]}>
              <AppText maxFontSizeMultiplier={1.2} style={[styles.saveText, { color: th.color.bg }]}>
                {b}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.cardRow}>
        <View style={[styles.radio, selected ? { backgroundColor: palette.lime, borderColor: palette.lime } : { borderColor: th.isDark ? '#48484A' : '#C3C7CC' }]}>
          {selected ? <Check size={14} color="#0A0A0A" weight="bold" /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.planName, { color: th.color.ink }]}>
            {name}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.planSub, { color: P.sec }]}>
            {sub}
          </AppText>
        </View>
        <View style={styles.priceCol}>
          {trial ? (
            <View style={styles.trialChip}>
              <AppText maxFontSizeMultiplier={1.2} style={styles.trialText}>
                {trial}
              </AppText>
            </View>
          ) : !card.yearly ? (
            <AppText maxFontSizeMultiplier={1.3} style={[styles.monthly, { color: P.sec, marginBottom: 2 }]}>
              {t('kayit.offer.no_trial')}
            </AppText>
          ) : null}
          <AppText maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit style={[styles.price, { color: th.color.ink }]}>
            {priceLine}
          </AppText>
          {card.monthlyText ? (
            <AppText maxFontSizeMultiplier={1.3} style={[styles.monthly, { color: P.sec }]}>
              {t('sub.paywall.per_month_equiv', { price: card.monthlyText })}
            </AppText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function Banner({ text, top }: { text: string; top: number }) {
  const P = useK();
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 1 : 0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!reduced) o.value = withTiming(1, { duration: K_MOTION.fade });
    const id = setTimeout(hide, K_MOTION.bannerHold);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hide = () => {
    if (reduced) {
      setGone(true);
      return;
    }
    o.value = withTiming(0, { duration: K_MOTION.fade });
    setTimeout(() => setGone(true), K_MOTION.fade);
  };
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  if (gone) return null;
  return (
    <Animated.View style={[styles.banner, { top, backgroundColor: P.surface, borderColor: P.line }, st]}>
      <Pressable testID="kayit-email-banner" onPress={hide} accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={text} style={styles.bannerIn}>
        <View style={[styles.bannerDot, { backgroundColor: P.accent }]}>
          <Check size={14} color={P.onAccent} weight="bold" />
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
  return (
    <View style={{ flex: 1, backgroundColor: P.bg }} testID="kayit-offer-success">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 12 }}>
        <View style={[styles.okBadge, { backgroundColor: P.accent }]}>
          <Check size={30} color={P.onAccent} weight="bold" />
        </View>
        <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, { color: P.ink, marginTop: 8 }]}>
          {trialDays ? t('kayit.offer.success_title', { plan }) : t('kayit.offer.success_title_sub', { plan })}
        </AppText>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.planName, { color: P.ink }]}>
          {t('kayit.offer.success_hello')}
        </AppText>
        {trialDays ? (
          <AppText maxFontSizeMultiplier={1.4} style={[styles.summary, { color: P.sec, fontFamily: FONT.body, fontSize: 15, lineHeight: 21 }]}>
            {t('kayit.offer.success_sub', { n: trialDays })}
          </AppText>
        ) : null}
      </View>
      <KFooter bottom={insets.bottom}>
        <KButton testID="kayit-offer-home" label={t('kayit.offer.success_cta')} onPress={onHome} />
      </KFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -8 },
  head: { alignItems: 'center', marginTop: -8, gap: 6 },
  title: { fontFamily: FONT.display, fontSize: 28, lineHeight: 34, textAlign: 'center', letterSpacing: -0.4 },
  card: { borderRadius: 20, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 14, minHeight: 64, shadowColor: '#0A0A0A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 16, fontWeight: '600' },
  planSub: { fontSize: 12, lineHeight: 16 },
  priceCol: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '55%' },
  trialChip: { backgroundColor: palette.lime, borderRadius: 8, paddingHorizontal: 8, minHeight: 20, justifyContent: 'center', marginBottom: 4 },
  trialText: { fontSize: 12, fontWeight: '700', color: '#0A0A0A' },
  price: { fontSize: 18, fontWeight: '800' },
  monthly: { fontSize: 12, marginTop: 2 },
  badges: { position: 'absolute', top: -12, right: 14, flexDirection: 'row', gap: 6, zIndex: 2 },
  save: { borderRadius: 10, paddingHorizontal: 10, minHeight: 22, justifyContent: 'center' },
  saveText: { fontSize: 12, fontWeight: '700' },
  summary: { marginTop: 12, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  legal: { marginTop: 12, fontSize: 12, lineHeight: 17 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  linkText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  restoreMsg: { fontSize: 13, textAlign: 'center' },
  banner: { position: 'absolute', left: 16, right: 16, borderRadius: 16, borderWidth: 1 },
  bannerIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56 },
  bannerDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bannerText: { fontFamily: FONT.semi, fontSize: 15, flex: 1 },
  okBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
