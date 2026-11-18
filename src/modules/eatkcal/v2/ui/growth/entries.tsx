// G56-S1 md.6 — davet girişleri (ana sayfa dışı): Profil satırı (EkScr scr="profil") ve sepetteki
// "Davet kodun var mı?" satırı (mevcut kupon satırının yanında, aynı satır dili).
// Hepsi `davet` bayrağı + oturum + ödül ayarı ister; biri eksikse hiç çizilmez.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { Gift, CaretRight, Check } from '../../../../../components/icons';
import { fontFamily, haptic, useTheme } from '../../../../../core/design';
import { useT } from '../../../../../core/i18n';
import { useAuth } from '../../../../../core/AuthContext';
import { useFeature } from '../../../../../core/flags';
import { track } from '../../../../../lib/analytics';
import { FinRow } from '../../../../profil/ui/finUi';
import { inviteVisible } from '../../growth/rules';
import { applyReferralCode, fetchCanApplyReferral, fetchReferralSettings } from '../../growth/growthApi';
import { referralCodeLooksValid, type ApplyError } from '../../growth/referral';
import { clearPendingInvite, readPendingInvite } from '../../../../../lib/share/pendingInvite';

/** Ödül tutarı (settings.referral_reward_tl) — bayrak açık + oturum varken bir kez okunur. */
export function useInviteReward(): { visible: boolean; rewardTl: number | null } {
  const { session } = useAuth();
  const flag = useFeature('davet');
  const [reward, setReward] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    if (!flag || !session) {
      setReward(null);
      return;
    }
    fetchReferralSettings().then((r) => alive && setReward(r?.rewardTl ?? null));
    return () => {
      alive = false;
    };
  }, [flag, session]);
  return { visible: inviteVisible({ signedIn: !!session, flag, rewardTl: reward }), rewardTl: reward };
}

/** Profil › eatkcal: "Arkadaşını davet et" + "1 öğün bizden" hapı (Siparişlerim ile Adreslerim arasında). */
export function ProfileInviteRow({ onOpen }: { onOpen: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { visible } = useInviteReward();
  if (!visible) return null;
  // G58-S2 md.4: ödül "1 öğün bizden" (TL tutarı yok).
  const pill = tr('ek56.invite.profile_pill');
  return (
    <FinRow
      icon={<Gift size={18} color={t.color.ink} />}
      label={tr('ek56.invite.title')}
      value={pill}
      right={
        <View style={[styles.pill, { backgroundColor: t.color.accent }]}>
          <Text style={[styles.pillText, { color: t.color.onAccent }]} maxFontSizeMultiplier={1.3}>
            {pill}
          </Text>
        </View>
      }
      onPress={onOpen}
      testID="profile-invite-row"
    />
  );
}

/**
 * Sepet: "Davet kodun var mı?" — yalnız hiç siparişi olmayan ve henüz kod girmemiş kullanıcıda.
 * Satıra dokununca aynı kart içinde kod alanı + "Uygula" açılır (kupon satırıyla aynı ölçüler: 56 / 18).
 */
export function CartInviteCodeRow({ onMessage }: { onMessage: (text: string) => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { session } = useAuth();
  const { visible } = useInviteReward();
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let alive = true;
    if (!visible || !userId) {
      setEligible(false);
      return;
    }
    fetchCanApplyReferral(userId).then((ok) => alive && setEligible(ok));
    // G61-S1: l.eatkcal.com/i/<kod> ile gelen kod → satır açık + dolu.
    readPendingInvite().then((pending) => {
      if (!alive || !pending) return;
      setCode(pending);
      setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, [visible, userId]);

  if (!visible || (!eligible && !done)) return null;

  const submit = async () => {
    if (!referralCodeLooksValid(code)) {
      track('referral_apply', { result: 'invalid_code', where: 'cart' });
      onMessage(tr('ek56.invite.err_invalid_code'));
      return;
    }
    setBusy(true);
    const r = await applyReferralCode(code);
    setBusy(false);
    track('referral_apply', { result: r.ok ? 'ok' : r.error, where: 'cart' });
    if (r.ok || (r as { error: ApplyError }).error !== 'error') void clearPendingInvite();
    if (r.ok) {
      haptic('success');
      setDone(true);
      setOpen(false);
      onMessage(tr('ek56.invite.applied'));
    } else {
      onMessage(tr(`ek56.invite.err_${(r as { error: ApplyError }).error}`));
    }
  };

  if (done) {
    return (
      <View style={[styles.row, { backgroundColor: t.color.surface }]} testID="ek56-cart-invite-done">
        <Check size={20} color={t.color.accentLine} weight="bold" />
        <Text style={[styles.label, { color: t.color.ink, flex: 1 }]} maxFontSizeMultiplier={1.3}>
          {tr('ek56.invite.applied')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: t.color.surface }]} testID="ek56-cart-invite">
      <Pressable
        onPress={() => {
          haptic('selection');
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.row}
      >
        <Gift size={20} color={t.color.ink} />
        <Text style={[styles.label, { color: t.color.ink, flex: 1 }]} maxFontSizeMultiplier={1.3}>
          {tr('ek56.invite.have_code')}
        </Text>
        <CaretRight size={18} color={t.color.secondary} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
      </Pressable>
      {open ? (
        <View style={styles.inputRow}>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder={tr('ek56.invite.placeholder')}
            placeholderTextColor={t.color.secondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel={tr('ek56.invite.placeholder')}
            style={[styles.input, { color: t.color.ink, borderColor: t.color.line }]}
            testID="ek56-cart-invite-input"
          />
          <Pressable
            onPress={submit}
            disabled={busy || code.trim().length === 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || code.trim().length === 0, busy }}
            style={[styles.apply, { backgroundColor: code.trim() ? t.color.accent : t.color.line }]}
            testID="ek56-cart-invite-apply"
          >
            {busy ? (
              <ActivityIndicator size="small" color={t.color.onAccent} />
            ) : (
              <Text style={[styles.applyText, { color: code.trim() ? t.color.onAccent : t.color.secondary }]} maxFontSizeMultiplier={1.3}>
                {tr('ek56.invite.apply')}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  pillText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  card: { borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 56, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, fontFamily: fontFamily.bodySemibold, fontSize: 15, letterSpacing: 1 },
  apply: { minHeight: 44, minWidth: 88, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  applyText: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
