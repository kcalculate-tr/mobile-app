// G22-S1 md.4 — FinSubResult: satın alma sonucu (success · cancelled · pending · error).
// Hareket (FinMoSub "Satın alma"): sonuç fast 200 fade; başarıda kupa base→bouncy 220/14
// (tek sahne, döngü yok), metin base enter, buton base. Azaltılmışta yalnız 200 ms opaklık.
// Uyarı haptiği yalnız hata durumunda; başarıda success.
import React, { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, DURATION, SPRING, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Hourglass, Warning, X, XCircle } from '../../../components/icons';
import type { PlanCard } from '../../../lib/subscription/plans';

export type SubResultState = 'success' | 'cancelled' | 'pending' | 'error';

export function formatSubDate(iso: string | null | undefined, lang: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default function SubResult({
  state,
  card,
  expiresAt,
  aiPerDay,
  pendingVerify,
  onPrimary,
  onSecondary,
  onRestore,
  onClose,
}: {
  state: SubResultState;
  card?: PlanCard | null;
  expiresAt?: string | null;
  /** Fresh günlük AI hakkı (app_settings). */
  aiPerDay?: number | null;
  /** Sunucu henüz doğrulamadı (webhook gecikmesi). */
  pendingVerify?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  onRestore?: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const ink = t.color.ink;
  const card2 = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const line = t.isDark ? '#2C2C2E' : '#E9EBEE';
  const line2 = t.isDark ? '#48484A' : '#C3C7CC';

  useEffect(() => {
    if (state === 'success') haptic('success');
    else if (state === 'error') haptic('warning');
  }, [state]);

  const fade = FadeIn.duration(reduced ? DURATION.fast : DURATION.fast);
  const date = formatSubDate(expiresAt, lang);
  const planName = card ? tr(card.tier === 'balance' ? 'sub.paywall.balance' : 'sub.paywall.fresh') : '';
  const priceLine = card ? `${card.priceText}${tr(card.yearly ? 'sub.paywall.per_year' : 'sub.paywall.per_month')}` : '';

  if (state === 'success') {
    const trial = !!card?.trialDays;
    const rows: [string, string][] = [
      [tr('sub.result.row_ai'), aiPerDay != null ? tr('sub.result.v_per_day', { n: aiPerDay }) : '—'],
      [tr('sub.result.row_barcode_manual'), tr('sub.result.v_unlimited')],
    ];
    if (date) rows.push([trial ? tr('sub.result.row_trial_end') : tr('sub.result.row_renews'), date]);
    return (
      <Animated.View entering={fade} style={[styles.fill, { backgroundColor: t.color.bg }]} testID="sub-result-success">
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
          <View style={styles.closeRow}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('sub.close')} style={styles.close}>
              <X size={22} color={ink} />
            </Pressable>
          </View>
          <View style={styles.trophy} accessible accessibilityLabel={tr('sub.result.trophy')}>
            <TrophyPop />
          </View>
          <Animated.View entering={FadeIn.duration(reduced ? DURATION.fast : DURATION.base)} style={styles.center}>
            <AppText style={[styles.okTitle, { color: ink }]} accessibilityRole="header">
              {tr('sub.result.ok_title', { plan: planName })}{' '}
              <AppText style={[styles.okTitle, styles.mark]}>{tr('sub.result.ok_mark')}</AppText>
            </AppText>
            <AppText style={styles.okBody}>
              {trial && date
                ? tr('sub.result.ok_body_trial', { days: card?.trialDays ?? '', date, price: priceLine })
                : date
                  ? tr('sub.result.ok_body', { date, price: priceLine })
                  : ''}
            </AppText>
            {pendingVerify ? (
              <AppText tone="secondary" style={styles.small}>
                {tr('sub.result.ok_pending_verify')}
              </AppText>
            ) : null}
          </Animated.View>
          <View style={[styles.rows, { backgroundColor: card2 }]}>
            {rows.map(([k, v], i) => (
              <View key={k} style={[styles.row, i ? { borderTopWidth: 1, borderTopColor: line } : null]}>
                <AppText tone="secondary" style={styles.rowK}>
                  {k}
                </AppText>
                <AppText style={styles.rowV}>{v}</AppText>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={[styles.actions, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <Pressable onPress={onPrimary} accessibilityRole="button" style={[styles.btn, { backgroundColor: '#C6F04F' }]} testID="sub-result-primary">
            <AppText style={[styles.btnText, { color: '#0A0A0A' }]}>{tr('sub.result.ok_primary')}</AppText>
          </Pressable>
          {onSecondary ? (
            <Pressable onPress={onSecondary} accessibilityRole="button" style={[styles.btn, styles.next, { borderWidth: 1, borderColor: line2 }]}>
              <AppText style={styles.btnText}>{tr('sub.result.ok_secondary')}</AppText>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    );
  }

  const M = {
    cancelled: { icon: <XCircle size={28} color={ink} />, title: tr('sub.result.cancelled_title'), body: tr('sub.result.cancelled_body'), note: null, primary: tr('sub.result.cancelled_primary'), lime: true, secondary: tr('sub.result.cancelled_secondary') },
    pending: { icon: <Hourglass size={28} color={ink} />, title: tr('sub.result.pending_title'), body: tr('sub.result.pending_body'), note: tr('sub.result.pending_note'), primary: tr('sub.result.pending_primary'), lime: false, secondary: null },
    error: {
      icon: <Warning size={28} color={ink} />,
      title: tr('sub.result.error_title'),
      body: tr(Platform.OS === 'android' ? 'sub.result.error_body_android' : 'sub.result.error_body_ios'),
      note: null,
      primary: tr('sub.result.error_primary'),
      lime: false,
      secondary: null,
    },
  }[state];

  return (
    <Animated.View entering={fade} style={[styles.fill, { backgroundColor: t.color.bg }]} testID={`sub-result-${state}`}>
      <View style={[styles.closeRow, { paddingTop: insets.top + 12, paddingHorizontal: 16 }]}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('sub.close')} style={styles.close}>
          <X size={22} color={ink} />
        </Pressable>
      </View>
      <View style={styles.msg}>
        <View style={[styles.disc, { backgroundColor: card2 }]}>{M.icon}</View>
        <AppText style={[styles.msgTitle, { color: ink }]} accessibilityRole="header">
          {M.title}
        </AppText>
        <AppText tone="secondary" style={styles.msgBody}>
          {M.body}
        </AppText>
        {M.note ? (
          <View style={[styles.note, { backgroundColor: card2 }]}>
            <AppText style={styles.noteText}>✓ {M.note}</AppText>
          </View>
        ) : null}
      </View>
      <View style={[styles.actions, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <Pressable
          onPress={onPrimary}
          accessibilityRole="button"
          style={[styles.btn, { backgroundColor: M.lime ? '#C6F04F' : ink }]}
          testID="sub-result-primary"
        >
          <AppText style={[styles.btnText, { color: M.lime ? '#0A0A0A' : t.color.bg }]}>{M.primary}</AppText>
        </Pressable>
        {M.secondary && onSecondary ? (
          <Pressable onPress={onSecondary} accessibilityRole="button" style={[styles.btn, styles.next, { borderWidth: 1, borderColor: line2 }]}>
            <AppText style={styles.btnText}>{M.secondary}</AppText>
          </Pressable>
        ) : onRestore ? (
          <Pressable onPress={onRestore} accessibilityRole="button" style={[styles.btn, styles.next, { borderWidth: 1, borderColor: line2 }]} testID="sub-result-restore">
            <AppText style={styles.btnText}>{tr('sub.paywall.restore')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const TROPHY = require('../../../../assets/glass/trophy.png');

/** Kupa: base giriş + bouncy 220/14 tek sahne (döngü yok); azaltılmışta yalnız opaklık. */
function TrophyPop() {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.85);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(1, { duration: reduced ? DURATION.fast : DURATION.base });
    if (!reduced) s.value = withSpring(1, SPRING.bouncy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.trophyWrap, st]}>
      <View style={styles.glow} />
      <Image source={TROPHY} style={styles.trophyImg} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  trophyWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(198,240,79,0.28)' },
  trophyImg: { width: 190, height: 190 },
  fill: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  trophy: { alignItems: 'center', marginTop: 4 },
  center: { alignItems: 'center', marginTop: 8 },
  okTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, lineHeight: 38, textAlign: 'center' },
  mark: { backgroundColor: '#C6F04F', color: '#0A0A0A' },
  okBody: { marginTop: 8, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  small: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  rows: { marginTop: 32, borderRadius: 20, paddingHorizontal: 14 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  rowK: { fontSize: 15, flexShrink: 1 },
  rowV: { fontSize: 15, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  actions: { paddingHorizontal: 16 },
  btn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 16, fontWeight: '700' },
  next: { marginTop: 10 },
  msg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: -80 },
  disc: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  msgTitle: { marginTop: 18, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, lineHeight: 32, textAlign: 'center' },
  msgBody: { marginTop: 10, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  note: { marginTop: 14, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  noteText: { fontSize: 13, fontWeight: '600' },
});
