// G22-S1 md.4 — Profil › Abonelik (FinSubProfileFree / Trial / Balance).
// Mevcut plan kartı (ad, fiyat, hak hapı, deneme günü), deneme/yenileme satırları, "Planında neler
// var" (AI/gün · Barkod/gün · Elle giriş — değerler app_settings/my_entitlement'tan), eylemler:
// Planları gör / Planı değiştir (paywall), Aboneliği yönet (mağaza), Satın alımları geri yükle.
// G25-S1 md.2 (A2): altta "Kullanım Koşulları (EULA)" + "Gizlilik Politikası"; md.5: geri yükleme meşgul hâli.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { ArrowLeft, ArrowSquareOut, CaretRight } from '../../../components/icons';
import { pillA11y, pillLabel } from '../../../lib/subscription/limits';
import { planFromProductId, planYearly, type PlanCard } from '../../../lib/subscription/plans';
import { manageSubscription, refreshEntitlement, restorePurchases, useSubscriptionStore, useTier } from '../../../lib/subscription/purchases';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import SubPill from '../ui/SubPill';
import SubLegalLinks from '../ui/SubLegalLinks';
import { formatSubDate } from '../ui/SubResult';
import { trackSub } from '../subTrack';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

/** Kalan deneme günü (yukarı yuvarlanır; geçmişse 0). SAF. */
export function trialDaysLeft(expiresAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 864e5));
}

export default function SubProfileScreen() {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { tier, status } = useTier();
  const rc = useSubscriptionStore((s) => s.rc);
  const server = useSubscriptionStore((s) => s.server);
  const limits = useSubscriptionStore((s) => s.limits);
  const ai = useSubscriptionStore((s) => s.ai);
  const available = useSubscriptionStore((s) => s.available);
  const { cards } = usePlanCards(available);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    void refreshEntitlement();
  }, []);

  const ink = t.color.ink;
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const nested = t.isDark ? '#2C2C2E' : '#F3F4F6';
  const line = t.isDark ? '#2C2C2E' : '#E9EBEE';
  const isAndroid = Platform.OS === 'android';

  const paid = tier !== 'free';
  const productId = rc?.productId ?? server?.product_id ?? null;
  const plan = planFromProductId(productId);
  const yearly = plan ? planYearly(plan) : false;
  const planCard: PlanCard | null = cards?.find((c) => c.key === plan) ?? null;
  const expiresAt = rc?.expiresAt ?? server?.expires_at ?? null;
  const trial = paid && (rc?.trial ?? server?.trial ?? false);
  const date = formatSubDate(expiresAt, lang);
  const daysLeft = trial ? trialDaysLeft(expiresAt) : null;
  const priceText = planCard?.priceText ?? null;

  // G26-S1: büyük ad YALNIZ "Fresh" / "Balance"; "kcalAI" üst satırda küçük etiket.
  const name = paid
    ? tr('sub.profile.paid_name', { plan: tr(tier === 'balance' ? 'sub.paywall.balance' : 'sub.paywall.fresh') })
    : tr('sub.profile.free_name');
  const priceLine = !paid
    ? tr('sub.profile.free_price')
    : priceText
      ? trial
        ? tr('sub.profile.price_after_trial', { price: priceText })
        : tr(yearly ? 'sub.profile.price_year' : 'sub.profile.price_month', { price: priceText })
      : null;
  // G23-S1: Balance da sayılı (günde 50) → hap her kademede "Bugün N/cap".
  const tierCap = limits?.ai[tier] ?? null;
  const pill = pillLabel(ai, tr, tierCap);
  const pillLbl = pillA11y(ai, tr, tierCap);

  const aiVal = String(tierCap ?? '—');
  const bcVal = tier === 'free' ? String(limits?.barcode.free ?? '—') : tr('sub.profile.unlimited');
  const feats: [string, string][] = [
    [tr('sub.profile.ai'), aiVal],
    [tr('sub.profile.barcode'), bcVal],
    [tr('sub.profile.manual'), tr('sub.profile.unlimited')],
  ];
  const rows: [string, string][] = [];
  if (paid && date) {
    if (trial) {
      rows.push([tr('sub.profile.trial_end'), date]);
      if (priceText) rows.push([tr('sub.profile.first_payment'), tr('sub.profile.first_payment_v', { date, price: priceText })]);
    } else {
      rows.push([rc?.willRenew === false || server?.will_renew === false ? tr('sub.profile.ends') : tr('sub.profile.renews'), date]);
      if (plan) rows.push([tr('sub.profile.period'), tr(yearly ? 'sub.profile.yearly' : 'sub.profile.monthly')]);
    }
  }
  const foot = !paid
    ? tr(isAndroid ? 'sub.profile.foot_free_android' : 'sub.profile.foot_free_ios')
    : trial
      ? tr(isAndroid ? 'sub.profile.foot_trial_android' : 'sub.profile.foot_trial_ios')
      : tr(isAndroid ? 'sub.profile.foot_paid_android' : 'sub.profile.foot_paid_ios', { date: date ?? '' });

  const openPaywall = () =>
    (navigation as unknown as { navigate: (n: string, p?: object) => void }).navigate('SubPaywall', {
      from: 'profile',
      ...(paid ? { plan: tier, yearly } : {}),
    });

  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]} testID="sub-profile">
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={tr('sub.profile.back')} style={styles.back}>
          <ArrowLeft size={22} color={ink} />
        </Pressable>
        <AppText textRole="sheetTitle" accessibilityRole="header" style={styles.hTitle}>
          {tr('sub.profile.title')}
        </AppText>
        <View style={styles.back} />
      </View>
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={styles.planHead}>
            <View style={styles.flex1}>
              <AppText tone="secondary" style={styles.cap} testID="sub-profile-cap">
                {tr(paid ? 'sub.profile.current_paid' : 'sub.profile.current')}
              </AppText>
              <AppText style={styles.planName} testID="sub-profile-name">
                {name}
              </AppText>
              {priceLine ? (
                <AppText tone="secondary" style={styles.planPrice}>
                  {priceLine}
                </AppText>
              ) : null}
            </View>
            {pill ? <SubPill label={pill} a11y={pillLbl} bg={nested} /> : null}
          </View>
          {daysLeft != null ? (
            <View style={styles.trialChip}>
              <AppText style={styles.trialChipText}>{tr('sub.profile.trial_left', { count: daysLeft })}</AppText>
            </View>
          ) : null}
          {status === 'pending' ? (
            <AppText tone="secondary" style={styles.cap}>
              {tr('sub.profile.pending')}
            </AppText>
          ) : null}
          {rows.map(([k, v]) => (
            <View key={k} style={[styles.row, { borderTopColor: line, borderTopWidth: 1 }]}>
              <AppText tone="secondary" style={styles.rowK}>
                {k}
              </AppText>
              <AppText style={styles.rowV}>{v}</AppText>
            </View>
          ))}
        </View>

        <AppText tone="secondary" style={styles.section}>
          {tr('sub.profile.includes')}
        </AppText>
        <View style={[styles.card, styles.cardList, { backgroundColor: card }]}>
          {feats.map(([k, v], i) => (
            <View key={k} style={[styles.row, i ? { borderTopColor: line, borderTopWidth: 1 } : null]}>
              <AppText style={styles.rowK}>{k}</AppText>
              <AppText style={styles.rowV}>{v}</AppText>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.cardList, { backgroundColor: card }]}>
          {available ? (
            <Pressable onPress={openPaywall} accessibilityRole="button" style={styles.action} testID="sub-profile-plans">
              <AppText style={styles.actionText}>{paid ? tr('sub.profile.change') : tr('sub.profile.see_plans')}</AppText>
              <CaretRight size={16} color={t.color.secondary} />
            </Pressable>
          ) : null}
          {paid ? (
            <Pressable onPress={() => void manageSubscription()} accessibilityRole="button" style={[styles.action, { borderTopColor: line, borderTopWidth: 1 }]} testID="sub-profile-manage">
              <View style={styles.flex1}>
                <AppText style={styles.actionText}>{tr('sub.profile.manage')}</AppText>
                <AppText tone="secondary" style={styles.cap}>
                  {tr(isAndroid ? 'sub.profile.manage_sub_android' : 'sub.profile.manage_sub_ios')}
                </AppText>
              </View>
              <ArrowSquareOut size={18} color={t.color.secondary} />
            </Pressable>
          ) : null}
          {available ? (
            <Pressable
              onPress={async () => {
                if (restoring) return;
                setRestoring(true);
                setRestoreMsg(null);
                try {
                  const r = await restorePurchases();
                  trackSub('sub_restore', { result: r });
                  setRestoreMsg(tr(r === 'restored' ? 'sub.paywall.restore_ok' : 'sub.paywall.restore_none'));
                } finally {
                  setRestoring(false);
                }
              }}
              disabled={restoring}
              accessibilityRole="button"
              accessibilityState={{ busy: restoring, disabled: restoring }}
              style={[styles.action, { borderTopColor: line, borderTopWidth: 1 }]}
              testID="sub-profile-restore"
            >
              <AppText style={[styles.actionText, restoring ? styles.dim : null]}>{restoring ? tr('sub.paywall.restoring') : tr('sub.profile.restore')}</AppText>
              {restoring ? <ActivityIndicator size="small" color={ink} /> : null}
            </Pressable>
          ) : null}
        </View>
        {restoreMsg ? (
          <AppText tone="secondary" style={styles.foot} accessibilityLiveRegion="polite">
            {restoreMsg}
          </AppText>
        ) : null}
        <AppText tone="secondary" style={styles.foot}>
          {foot}
        </AppText>
        <SubLegalLinks navigation={navigation} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hTitle: { flex: 1, textAlign: 'center' },
  card: { borderRadius: 20, padding: 14 },
  cardList: { paddingVertical: 2 },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cap: { fontSize: 13 },
  planName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 30 },
  planPrice: { fontSize: 15, marginTop: 2 },
  trialChip: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#C6F04F', borderRadius: 14, paddingHorizontal: 12, minHeight: 28, justifyContent: 'center' },
  trialChipText: { fontSize: 14, fontWeight: '700', color: '#0A0A0A' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  rowK: { fontSize: 15, flexShrink: 1 },
  rowV: { fontSize: 15, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 4, marginLeft: 4 },
  action: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  actionText: { fontSize: 16, fontWeight: '600', flex: 1 },
  foot: { fontSize: 13, lineHeight: 18, marginHorizontal: 4 },
  dim: { opacity: 0.6 },
});
