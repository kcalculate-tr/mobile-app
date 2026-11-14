// G22-S1 md.4 — FinSubResult: satın alma sonucu (success · cancelled · pending · error).
// Hareket (FinMoSub "Satın alma"): sonuç fast 200 fade; başarıda kupa base→bouncy 220/14
// (tek sahne, döngü yok), metin base enter, buton base. Azaltılmışta yalnız 200 ms opaklık.
// Uyarı haptiği yalnız hata durumunda; başarıda success.
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, DURATION, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Hourglass, Warning, X, XCircle } from '../../../components/icons';
import type { PlanCard } from '../../../lib/subscription/plans';
import { PurchasePlanRow } from '../../personalPlan/ui/entries';
import SubWelcome, { welcomeRights } from './SubWelcome';
import { useCoachEnabled } from '../../coach/access';
import { palette } from '../../../core/design/tokens';

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
  const coachOn = useCoachEnabled();
  const ink = t.color.ink;
  const card2 = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const line2 = t.isDark ? '#48484A' : '#C3C7CC';

  useEffect(() => {
    if (state === 'success') haptic('success');
    else if (state === 'error') haptic('warning');
  }, [state]);

  const fade = FadeIn.duration(reduced ? DURATION.fast : DURATION.fast);
  const date = formatSubDate(expiresAt, lang);

  if (state === 'success') {
    // G54-S1 md.1: başarı hâli = ortak tebrik ekranı (kayıt görsel dili: degrade zemin, cam yüzey, kupa kutlaması).
    const trial = !!card?.trialDays;
    const tier = card?.tier === 'balance' ? 'balance' : 'fresh';
    const trialIso = trial ? (expiresAt ?? new Date(Date.now() + (card?.trialDays ?? 0) * 86_400_000).toISOString()) : null;
    return (
      <SubWelcome
        testID="sub-result-success"
        tier={tier}
        rights={welcomeRights({ tier, aiPerDay, coachOn }, tr)}
        trialUntil={trialIso ? formatSubDate(trialIso, lang) : null}
        renewsOn={!trial ? date : null}
        note={pendingVerify ? tr('sub.result.ok_pending_verify') : null}
        extra={<PurchasePlanRow />}
        onStart={onPrimary}
        secondary={onSecondary ? { label: tr('sub.result.ok_secondary'), onPress: onSecondary } : null}
      />
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
          style={[styles.btn, { backgroundColor: M.lime ? palette.lime : ink }]}
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
