// G34-S1 · Tur 26o — Bağlamsal paywall (02 panosu "Paywall"; 05 FinPlanPaywall). Ana rakam TOPLAM
// tutar (fiyat sürprizi yok). Fiyatlar YALNIZ RevenueCat'ten (usePlanCards); gelmezse hata kartı
// + Tekrar dene (yedek fiyat yok — G27/G31 kuralı). Satın aldı ya da kapattı → önizlemeye döner
// (önizleme kademe değişince kilitli günleri 550 ms'de açar).
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../core/design/components/AppText';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { Check, X } from '../../../components/icons';
import { purchasePlan, restorePurchases, useTier } from '../../../lib/subscription/purchases';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import type { PlanCard, PlanKey } from '../../../lib/subscription/plans';
import { track } from '../../../lib/analytics';
import SubLegalLinks from '../../subscription/ui/SubLegalLinks';
import type { RootStackParamList } from '../../../navigation/types';
import { GLASS, PpBackdrop, PpButton, usePp } from '../ui/parts';
import { Toast } from '../../../core/design/components/Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanPaywall'>;

export default function PlanPaywallScreen({ navigation, route }: Props) {
  const i18n = useT();
  const P = usePp();
  const insets = useSafeAreaInsets();
  const { tier } = useTier();
  const { cards, loading, failed, reload } = usePlanCards(true);
  const from = route.params?.from ?? 'personal_plan';
  const [sel, setSel] = useState<PlanKey>(route.params?.plan === 'balance' ? 'balance_yearly' : 'fresh_yearly');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'default' | 'error' } | null>(null);

  const byKey = useMemo(() => {
    const m = new Map<PlanKey, PlanCard>();
    for (const c of cards ?? []) m.set(c.key, c);
    return m;
  }, [cards]);
  const selected = byKey.get(sel) ?? null;

  const close = () => {
    track('pp_paywall', { action: 'free', plan: sel });
    navigation.goBack();
  };

  const buy = async () => {
    if (!selected || busy) return;
    setBusy('buy');
    track('pp_paywall', { action: 'purchase', plan: sel });
    const r = await purchasePlan(sel);
    setBusy(null);
    if (r === 'success') {
      haptic('success');
      navigation.goBack();
    } else if (r === 'pending') setToast({ msg: i18n.t('pp.pw_pending'), tone: 'default' });
    else if (r === 'error') setToast({ msg: i18n.t('pp.pw_error'), tone: 'error' });
  };

  const restore = async () => {
    if (busy) return;
    setBusy('restore');
    track('pp_paywall', { action: 'restore', plan: sel });
    const r = await restorePurchases();
    setBusy(null);
    if (r === 'restored') {
      setToast({ msg: i18n.t('pp.pw_restored'), tone: 'default' });
      navigation.goBack();
    } else setToast({ msg: r === 'none' ? i18n.t('pp.pw_none') : i18n.t('pp.pw_error'), tone: r === 'none' ? 'default' : 'error' });
  };

  React.useEffect(() => {
    track('pp_paywall', { action: 'view', plan: from.slice(0, 60) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Option = ({ k, title, sub }: { k: PlanKey; title: string; sub?: string }) => {
    const c = byKey.get(k);
    if (!c) return null;
    const on = sel === k;
    const price = c.yearly ? i18n.t('pp.per_year', { price: c.priceText }) : i18n.t('pp.per_month_label', { price: c.priceText });
    return (
      <Pressable
        onPress={() => {
          haptic('selection');
          setSel(k);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={[title, sub, price, c.monthlyText ? i18n.t('pp.pw_per_month', { price: c.monthlyText }) : null, c.trialDays ? i18n.t('pp.pw_trial') : null].filter(Boolean).join(', ')}
        style={[styles.opt, { backgroundColor: P.surface, borderColor: on ? P.ink : P.surfaceEdge, borderWidth: on ? 2 : 1 }]}
        testID={`pp-pw-${k}`}
      >
        <View style={[styles.radio, { borderColor: on ? P.ink : P.line2, backgroundColor: on ? P.accent : 'transparent' }]}>{on ? <Check size={12} color={P.onAccent} weight="bold" /> : null}</View>
        <View style={{ flex: 1 }}>
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
            {title}
          </AppText>
          {sub ? (
            <AppText textRole="helper" style={{ color: P.sec }}>
              {sub}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {c.yearly && (c.discountPct || c.trialDays) ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {c.discountPct ? (
                <View style={[styles.badge, { backgroundColor: P.accent }]}>
                  <AppText style={[styles.badgeText, { color: P.onAccent }]}>{i18n.t('pp.pw_save', { pct: c.discountPct })}</AppText>
                </View>
              ) : null}
              {c.trialDays ? (
                <View style={[styles.badge, { backgroundColor: P.field }]}>
                  <AppText style={[styles.badgeText, { color: P.ink }]}>{i18n.t('pp.pw_trial')}</AppText>
                </View>
              ) : null}
            </View>
          ) : null}
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '800' }}>
            {price}
          </AppText>
          {c.monthlyText ? (
            <AppText textRole="helper" style={{ color: P.sec }}>
              {i18n.t('pp.pw_per_month', { price: c.monthlyText })}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const after = selected ? (selected.yearly ? i18n.t('pp.per_year', { price: selected.priceText }) : i18n.t('pp.per_month_label', { price: selected.priceText })) : '';

  return (
    <View style={{ flex: 1 }} testID="pp-paywall">
      <PpBackdrop />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={i18n.t('pp.close')} style={styles.close} hitSlop={8} testID="pp-pw-close">
          <X size={20} color={P.ink} />
        </Pressable>
      </View>
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <Image source={GLASS.bowl} style={styles.bowl} resizeMode="contain" />
        <AppText textRole="screenTitle" style={{ color: P.ink, textAlign: 'center' }} accessibilityRole="header">
          {i18n.t('pp.pw_title')}
        </AppText>
        <AppText textRole="bodySm" style={{ color: P.sec, textAlign: 'center', marginTop: 6 }}>
          {i18n.t('pp.pw_sub')}
        </AppText>
        <View style={[styles.feats, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
          {(['1', '2', '3'] as const).map((n) => (
            <View key={n} style={styles.feat}>
              <View style={[styles.featDot, { backgroundColor: P.accent }]}>
                <Check size={12} color={P.onAccent} weight="bold" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                  {i18n.t(`pp.pw_f${n}`)}
                </AppText>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {i18n.t(`pp.pw_f${n}_sub`)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
        {loading ? (
          <View style={[styles.skel, { backgroundColor: P.field }]} accessibilityLabel={i18n.t('sub.paywall.loading')} />
        ) : failed || !cards ? (
          <View style={[styles.err, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]} testID="pp-pw-error">
            <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
              {i18n.t('sub.paywall.load_error_title')}
            </AppText>
            <AppText textRole="helper" style={{ color: P.sec, marginTop: 4 }}>
              {i18n.t('sub.paywall.load_error_body')}
            </AppText>
            <PpButton kind="ghost" label={i18n.t('sub.paywall.retry')} onPress={() => void reload()} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 16 }} accessibilityRole="radiogroup">
            <Option k="fresh_yearly" title={i18n.t('pp.pw_fresh_year')} />
            <Option k="fresh_monthly" title={i18n.t('pp.pw_fresh_month')} />
            <Option k="balance_yearly" title={i18n.t('pp.pw_balance')} sub={i18n.t('pp.pw_balance_sub')} />
          </View>
        )}
        <PpButton kind="lime" label={i18n.t('pp.pw_cta')} onPress={() => void buy()} disabled={!selected || busy !== null || tier === (selected?.tier ?? 'x')} style={{ marginTop: 16 }} testID="pp-pw-buy" />
        {selected ? (
          <AppText textRole="helper" style={{ color: P.ink, textAlign: 'center', marginTop: 8 }}>
            {selected.trialDays ? i18n.t('pp.pw_cta_after', { price: after }) : after}
          </AppText>
        ) : null}
        <PpButton kind="link" label={i18n.t('pp.pw_free')} onPress={close} style={{ marginTop: 6 }} testID="pp-pw-free" />
        <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center' }}>
          {i18n.t('pp.pw_free_foot')}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec, marginTop: 14, fontSize: 11, lineHeight: 15 }}>
          {i18n.t('pp.pw_legal')}
        </AppText>
        <PpButton kind="link" label={busy === 'restore' ? i18n.t('sub.paywall.restoring') : i18n.t('pp.pw_restore')} onPress={() => void restore()} style={{ marginTop: 6 }} />
        <SubLegalLinks navigation={navigation} />
      </ScrollView>
      <Toast visible={!!toast} message={toast?.msg ?? ''} tone={toast?.tone ?? 'default'} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', paddingHorizontal: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bowl: { width: 96, height: 68, alignSelf: 'center', marginBottom: 10 },
  feats: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12, marginTop: 16 },
  feat: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  featDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, minHeight: 64 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  skel: { height: 200, borderRadius: 16, marginTop: 16 },
  err: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginTop: 16 },
});
