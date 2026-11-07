// G15-S1 (Ek karar) — Giriş v2: UnifiedLoginScreen'in Final (FinSignupAI 1. adım)
// görünümü. MANTIK AYNEN: e-posta OTP (signInWithOtp/verifyEmailOtp, 60 sn tekrar
// gönder), Apple/Google (useAuth + resolvePostSocialAuth), 18+ onayı, redirectTo,
// hedefiVarMi → NutritionProfile. Saf kısım `loginLogic.ts`. `yeni_onboarding`
// arkasında (LoginGate). UnifiedLoginScreen'e DOKUNULMAZ.

import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { useFeature } from '../../../core/flags';
import { getSupabaseClient } from '../../../core/supabase';
import { resolvePostSocialAuth } from '../../../lib/postSocialAuth';
import { Check } from '../../../components/icons';
import type { RootStackParamList } from '../../../navigation/types';
import { AuthButton, OnbButton } from '../components/pieces';
import { useOnb } from '../components/onbTheme';
import { FormScreen, OnbField } from './FormScreen';
import {
  AGE_CONFIRMED_KEY,
  CODE_LENGTH,
  ONBOARDING_DONE_KEY,
  RESEND_SECONDS,
  checkSendCode,
  formatCountdown,
  hasNutritionGoal,
  interpretSocialResult,
  isCodeComplete,
  needsAgeGate as computeNeedsAgeGate,
  resolveLoginTarget,
  sanitizeCode,
  type GoalClient,
} from './loginLogic';

type LoginRouteProp = RouteProp<RootStackParamList, 'Login'>;
type LoginNav = NativeStackNavigationProp<RootStackParamList>;

/** kcal. işareti (FinSignupAI): siyah daire + lime nokta. */
function KcalMark() {
  return (
    <View accessibilityElementsHidden style={styles.mark}>
      <AppText style={styles.markText}>kcal</AppText>
      <AppText style={[styles.markText, { color: '#C6F04F' }]}>.</AppText>
    </View>
  );
}

/** 6 kutulu kod alanı: görünmez TextInput + kutular; 6. hanede otomatik doğrular. */
function CodeBoxes({
  value,
  onChange,
  error,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  error: boolean;
  label: string;
}) {
  const P = useOnb();
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={label} style={styles.codeRow}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => {
        const active = i === Math.min(value.length, CODE_LENGTH - 1);
        return (
          <View
            key={i}
            style={[
              styles.codeBox,
              {
                backgroundColor: P.isDark ? P.chip : '#FFFFFF',
                borderColor: error ? '#E5484D' : active ? P.ink : P.isDark ? P.chipEdge : P.line,
                borderWidth: active || error ? 1.5 : 1,
              },
            ]}
          >
            <AppText style={[styles.codeDigit, { color: P.ink }]}>{value[i] ?? ''}</AppText>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        testID="login-code-input"
        value={value}
        onChangeText={(v) => onChange(sanitizeCode(v))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        style={styles.codeHidden}
        caretHidden
      />
    </Pressable>
  );
}

export default function LoginV2({ vitrinStep }: { /** YALNIZ geliştirme vitrini. */ vitrinStep?: 'email' | 'code' }) {
  const i18n = useT();
  const P = useOnb();
  const navigation = useNavigation<LoginNav>();
  const route = useRoute<LoginRouteProp>();
  const { user, signInWithApple, signInWithGoogle, signInWithOtp, verifyEmailOtp } = useAuth();
  const redirectTarget = route.params?.redirectTo;
  // G17-S1 md.4: yeni kabukta giriş sonrası ilk hedef Ana sayfa (Tracker).
  const yeniKabuk = useFeature('yeni_kabuk');
  const tv = (k: string, p?: Record<string, string | number>) => i18n.t(`onboarding.v2.login.${k}`, p);

  const dev = __DEV__ ? vitrinStep : undefined;
  const [step, setStep] = useState<'email' | 'code'>(dev ?? 'email');
  const [email, setEmail] = useState(dev ? 'ilter@ornek.com' : '');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [countdown, setCountdown] = useState(dev === 'code' ? 42 : 0);
  const [socialError, setSocialError] = useState('');
  const [socialBusy, setSocialBusy] = useState(false);
  const [needsAgeGate, setNeedsAgeGate] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  // 18+ onayı yalnız yeni kayıtlarda (cihazda onboarding/yaş onayı yoksa).
  useEffect(() => {
    let gecerli = true;
    (async () => {
      const [[, done], [, age]] = await AsyncStorage.multiGet([ONBOARDING_DONE_KEY, AGE_CONFIRMED_KEY]);
      if (gecerli && computeNeedsAgeGate(done, age)) setNeedsAgeGate(true);
    })();
    return () => {
      gecerli = false;
    };
  }, []);

  useEffect(() => {
    if (countdown === 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const finishLogin = async () => {
    await AsyncStorage.multiSet([
      [ONBOARDING_DONE_KEY, 'true'],
      [AGE_CONFIRMED_KEY, 'true'],
    ]);
    const hasGoal = await hasNutritionGoal(
      async () => getSupabaseClient() as unknown as GoalClient,
      user?.id,
    );
    const target = resolveLoginTarget(redirectTarget, hasGoal, yeniKabuk);
    if (target.name === 'Checkout') navigation.replace('Checkout');
    else if (target.name === 'Addresses') navigation.replace('Addresses');
    else if (target.name === 'NutritionProfile') navigation.replace('NutritionProfile', target.params);
    else navigation.replace('Tabs', target.params);
  };

  // Sosyal girişte session async gelir: user değişince (ekran mount'ken) hedefe geç.
  useEffect(() => {
    if (user) finishLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSendCode = async () => {
    const check = checkSendCode({ needsAgeGate, ageConfirmed, email });
    if (check === 'age') {
      setError(tv('err_age'));
      return;
    }
    if (check === 'email') {
      setError(tv('err_email'));
      return;
    }
    setError('');
    setSending(true);
    const { error: err } = await signInWithOtp(email.trim());
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setStep('code');
    setCountdown(RESEND_SECONDS);
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(RESEND_SECONDS);
    await signInWithOtp(email.trim());
  };

  const handleVerify = async (entered: string) => {
    setCode(entered);
    if (!isCodeComplete(entered)) {
      if (codeError) setCodeError(false);
      return;
    }
    setVerifying(true);
    setCodeError(false);
    const { error: err } = await verifyEmailOtp(email.trim(), entered);
    setVerifying(false);
    if (err) {
      setCodeError(true);
      return;
    }
    await finishLogin();
  };

  const runSocial = async (provider: 'apple' | 'google') => {
    if (socialBusy || (needsAgeGate && !ageConfirmed)) return;
    setSocialBusy(true);
    setSocialError('');
    try {
      const result = await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
      const out = await interpretSocialResult(result, resolvePostSocialAuth);
      if (out.kind === 'error') setSocialError(out.message);
      else if (out.kind === 'done') await finishLogin();
    } finally {
      setSocialBusy(false);
    }
  };

  const socialDisabled = socialBusy || (needsAgeGate && !ageConfirmed);

  if (step === 'code') {
    return (
      <FormScreen
        onBack={() => {
          setStep('email');
          setCode('');
          setCodeError(false);
        }}
        title={tv('code_title')}
        subtitle={tv('code_sub', { email: email.trim() })}
        footer={
          <OnbButton
            label={tv('verify')}
            onPress={() => handleVerify(code)}
            disabled={!isCodeComplete(code) || verifying}
          />
        }
      >
        <View style={{ marginTop: 28 }}>
          <CodeBoxes value={code} onChange={handleVerify} error={codeError} label={tv('code_label')} />
        </View>
        {codeError ? (
          <AppText textRole="helper" style={styles.err} accessibilityLiveRegion="polite">
            {tv('code_wrong')}
          </AppText>
        ) : null}
        <Pressable
          onPress={handleResend}
          disabled={countdown > 0}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <AppText textRole="bodySm" style={{ color: P.sec, textAlign: 'center' }}>
            {tv('resend')}{' '}
            {countdown > 0 ? (
              <AppText textRole="bodySm" style={{ color: P.sec }}>
                ({formatCountdown(countdown)})
              </AppText>
            ) : (
              <AppText textRole="bodySm" style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold' }}>
                {tv('resend_now')}
              </AppText>
            )}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            setStep('email');
            setCode('');
            setCodeError(false);
          }}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <AppText textRole="bodySm" style={{ color: P.ink, textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            {tv('change_email')}
          </AppText>
        </Pressable>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      onBack={() => navigation.goBack()}
      fixedFooter={
        <View>
          <View style={styles.socials}>
            {Platform.OS === 'ios' ? (
              <AuthButton kind="apple" label={i18n.t('onboarding.account.apple')} disabled={socialDisabled} onPress={() => runSocial('apple')} />
            ) : null}
            <AuthButton kind="google" label={i18n.t('onboarding.account.google')} disabled={socialDisabled} onPress={() => runSocial('google')} />
          </View>
          {socialError ? (
            <AppText textRole="helper" style={styles.err} accessibilityLiveRegion="polite">
              {socialError}
            </AppText>
          ) : null}
        </View>
      }
    >
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <KcalMark />
      </View>
      <AppText
        style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, lineHeight: 33, letterSpacing: -0.4, color: P.ink, marginTop: 28 }}
      >
        {tv('title')}
      </AppText>
      <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 8 }}>
        {tv('sub')}
      </AppText>
      <OnbField
        label={tv('email_label')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError('');
        }}
        placeholder={tv('email_placeholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        error={error}
        testID="login-email-input"
        style={{ marginTop: 24 }}
      />
      {needsAgeGate ? (
        <Pressable
          onPress={() => setAgeConfirmed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ageConfirmed }}
          style={styles.ageRow}
          testID="login-age-check"
        >
          <View
            style={[
              styles.ageBox,
              { borderColor: ageConfirmed ? P.accent : P.line2, backgroundColor: ageConfirmed ? P.accent : 'transparent' },
            ]}
          >
            {ageConfirmed ? <Check size={14} color={P.onAccent} weight="bold" /> : null}
          </View>
          <AppText textRole="bodySm" style={{ color: P.sec, flex: 1 }}>
            {tv('age')}
          </AppText>
        </Pressable>
      ) : null}
      {/* G17-S1 md.3: "Kod gönder" formun içinde (klavye üst çubuğuna bağlanmaz). */}
      <View style={styles.sendWrap}>
        <OnbButton label={tv('send')} onPress={handleSendCode} disabled={sending} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  markText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: '#FFFFFF' },
  socials: { gap: 10 },
  sendWrap: { marginTop: 20 },
  err: { color: '#E5484D', marginTop: 10, textAlign: 'center' },
  linkRow: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, minHeight: 44 },
  ageBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  codeRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  codeBox: { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 28 },
  codeHidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
