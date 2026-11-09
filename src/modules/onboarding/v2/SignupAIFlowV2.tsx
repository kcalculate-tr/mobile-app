// G15-S1 (Ek karar) — Kcal AI kayıt akışı, Final görünümü (FinSignupAI 1·2·3, Light+Dark).
// MANTIK `KcalAiSignUpScreen.tsx` ile AYNI: aynı useAuth çağrıları, aynı
// `useKcalculateAiRegistration`, aynı hasProfileHandle sorgusu, aynı
// updatePublicProfile. O dosyaya DOKUNULMAZ; bu yalnız yeni görünüm.
// Adım 1 = mevcut `SignupAIScreen` (profil/ui/screens), e-posta alanı + kod adımı burada.

import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { getSupabaseClient } from '../../../core/supabase';
import { CameraIcon, Check, Plus } from '../../../components/icons';
import { useKcalculateAiRegistration } from '../../profil/useRegistration';
import { pickAndUploadAvatar } from '../../profil/avatarUpload';
import { getProfilClient } from '../../profil/client';
import SignupAIScreen from '../../profil/ui/screens/SignupAIScreen';
import { OnbButton } from '../components/pieces';
import { useOnb } from '../components/onbTheme';
import { FormScreen, OnbField } from './FormScreen';
import {
  BIO_MAX,
  clampBio,
  isValidEmail,
  progressFor,
  socialOutcome,
  stepAfterAuthed,
  stepAfterHandleSubmit,
  stepOnBack,
  type SignupStep,
} from './signupAILogic';

/** KcalAiSignUpScreen.tsx hasProfileHandle ile aynı sorgu. */
async function hasProfileHandle(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return false;
    const { data } = await supabase.from('profiles').select('handle').eq('id', uid).maybeSingle();
    return Boolean(data?.handle);
  } catch {
    return false;
  }
}

export interface SignupAIFlowV2Props {
  /** Akış bitti (ya "Keşfet'e geç" ya da zaten kayıtlı) — çağıran yönlendirir. */
  onDone: () => void;
  onBack?: () => void;
  /** YALNIZ geliştirme vitrini: akışı bu adımda başlat (üretimde yok sayılır). */
  vitrinStep?: 'welcome' | 'handle' | 'profile';
}

export default function SignupAIFlowV2(props: SignupAIFlowV2Props) {
  const reg = useKcalculateAiRegistration();
  if (!reg.enabled) return null;
  return <Flow reg={reg} {...props} />;
}

function Flow({
  reg,
  onDone,
  onBack,
  vitrinStep,
}: SignupAIFlowV2Props & { reg: ReturnType<typeof useKcalculateAiRegistration> }) {
  const P = useOnb();
  const { t: tt } = useT();
  const { user, signInWithApple, signInWithGoogle, signInWithOtp, verifyEmailOtp } = useAuth();

  const [step, setStep] = useState<SignupStep>(__DEV__ && vitrinStep ? vitrinStep : 'welcome');
  const [socialBusy, setSocialBusy] = useState<'apple' | 'google' | null>(null);
  const [socialError, setSocialError] = useState('');
  const [emailFieldOpen, setEmailFieldOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const afterAuthed = async () => {
    const next = stepAfterAuthed(await hasProfileHandle());
    if (next === 'done') onDone();
    else setStep(next);
  };

  const runSocial = async (kind: 'apple' | 'google') => {
    if (socialBusy) return;
    setSocialBusy(kind);
    setSocialError('');
    try {
      const res = await (kind === 'apple' ? signInWithApple() : signInWithGoogle());
      const out = socialOutcome(res);
      if (out === 'cancelled') return;
      if (out === 'error') {
        setSocialError(res.error ?? '');
        return;
      }
      await afterAuthed();
    } finally {
      setSocialBusy(null);
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setEmailError(tt('profil.email_invalid'));
      return;
    }
    setEmailError('');
    setEmailBusy(true);
    const { error } = await signInWithOtp(trimmed);
    setEmailBusy(false);
    if (error) {
      setEmailError(error);
      return;
    }
    setCode('');
    setStep('email');
  };

  const handleVerifyCode = async (entered: string) => {
    const digits = entered.replace(/[^0-9]/g, '');
    setCode(digits);
    if (digits.length !== 6) return;
    setEmailBusy(true);
    setEmailError('');
    const { error } = await verifyEmailOtp(email.trim(), digits);
    setEmailBusy(false);
    if (error) {
      setEmailError(tt('profil.code_invalid'));
      return;
    }
    await afterAuthed();
  };

  const handlePickAvatar = async () => {
    if (!user?.id) return;
    const url = await pickAndUploadAvatar(user.id);
    if (url) setAvatarUrl(url);
  };

  const finishProfile = async (skip: boolean) => {
    setSavingProfile(true);
    try {
      if (!skip) {
        await getProfilClient().updatePublicProfile({
          displayName: reg.displayName.trim(),
          bio: bio.trim() || null,
          avatarUrl,
        });
      }
      onDone();
    } finally {
      setSavingProfile(false);
    }
  };

  const goBack = () => {
    const next = stepOnBack(step);
    if (next === 'exit') onBack?.();
    else setStep(next);
  };

  // ── Adım 1: karşılama + giriş (mevcut Final kabuğu) ────────────────────────
  if (step === 'welcome') {
    return (
      <SignupAIScreen
        onApple={() => runSocial('apple')}
        onGoogle={() => runSocial('google')}
        onEmail={() => setEmailFieldOpen(true)}
        onSkip={() => finishProfile(true)}
      >
        {emailFieldOpen ? (
          <View style={styles.inline}>
            <OnbField
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@eposta.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={emailError}
              style={{ marginTop: 0 }}
              accessibilityLabel="E-posta"
            />
            <View style={{ marginTop: 8 }}>
              <OnbButton
                label={tt('profil.signup_continue')}
                onPress={handleSendCode}
                disabled={emailBusy}
              />
            </View>
          </View>
        ) : null}
        {socialError ? (
          <AppText textRole="helper" style={{ color: '#E5484D', textAlign: 'center' }}>
            {socialError}
          </AppText>
        ) : null}
      </SignupAIScreen>
    );
  }

  // ── Kod adımı ──────────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      // G18-S4 md.2 (gezinme kuralı): itilen adım YALNIZ sol geri — sağdaki "Vazgeç" kalktı (FinSignupAI 2).
      <FormScreen
        onBack={goBack}
        title={tt('profil.signup_code_title')}
        subtitle={email.trim()}
      >
        <OnbField
          label={tt('onboarding.v2.signupAi.code_label')}
          hint={emailError ? undefined : tt('onboarding.v2.signupAi.code_hint')}
          error={emailError}
          value={code}
          onChangeText={handleVerifyCode}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          right={emailBusy ? <ActivityIndicator size="small" color={P.sec} /> : undefined}
        />
      </FormScreen>
    );
  }

  // ── Adım 2: ad + kullanıcı adı ─────────────────────────────────────────────
  if (step === 'handle') {
    const available = reg.handle.status === 'available';
    return (
      // G18-S4 md.2: FinSignupAI 2 — yalnız sol geri (sağda "Vazgeç" yok).
      <FormScreen
        onBack={goBack}
        progress={progressFor('handle') ?? undefined}
        title={tt('profil.signup_name_title')}
        footer={
          <OnbButton
            label={tt('profil.signup_continue')}
            disabled={!reg.canSubmit}
            onPress={async () => {
              const res = await reg.submit();
              setStep(stepAfterHandleSubmit(res.ok));
            }}
          />
        }
      >
        <OnbField
          label={tt('profil.display_name')}
          value={reg.displayName}
          onChangeText={reg.setDisplayName}
          placeholder={tt('profil.display_name')}
          style={{ marginTop: 28 }}
        />
        <OnbField
          label={tt('profil.handle_label')}
          prefix="@"
          value={reg.handle.value}
          onChangeText={reg.handle.setValue}
          placeholder="kullanici_adi"
          autoCapitalize="none"
          autoCorrect={false}
          focusedOverride={available ? true : undefined}
          error={reg.handle.messageKey ? tt(reg.handle.messageKey) : reg.error ? tt(reg.error) : undefined}
          hint={tt('profil.handle_hint')}
          right={
            reg.handle.status === 'checking' ? (
              <ActivityIndicator size="small" color={P.sec} />
            ) : available ? (
              <View style={styles.avail}>
                <View style={[styles.availDot, { backgroundColor: P.isDark ? P.accent : '#4A6B00' }]}>
                  <Check size={10} color={P.isDark ? '#0A0A0A' : '#FFFFFF'} weight="bold" />
                </View>
                <AppText textRole="helper" style={{ color: P.isDark ? P.accent : '#4A6B00', fontWeight: '700' }}>
                  {tt('profil.handle_available')}
                </AppText>
              </View>
            ) : undefined
          }
        />
      </FormScreen>
    );
  }

  // ── Adım 3: fotoğraf + bio ─────────────────────────────────────────────────
  return (
    <FormScreen
      onBack={goBack}
      topRight={{ label: tt('profil.signup_skip'), onPress: () => finishProfile(true) }}
      progress={progressFor('profile') ?? undefined}
      title={tt('profil.signup_photo_title')}
      subtitle={tt('profil.signup_photo_subtitle')}
      footer={
        <OnbButton
          label={tt('profil.signup_go_discover')}
          disabled={savingProfile}
          onPress={() => finishProfile(false)}
        />
      }
    >
      <Pressable
        onPress={handlePickAvatar}
        accessibilityRole="button"
        accessibilityLabel={tt('onboarding.v2.signupAi.avatar_add')}
        style={[styles.avatar, { backgroundColor: P.isDark ? P.chip : P.track }]}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
        ) : (
          <CameraIcon size={30} color={P.sec} />
        )}
        <View style={[styles.avatarPlus, { backgroundColor: P.accent }]}>
          <Plus size={16} color={P.onAccent} weight="bold" />
        </View>
      </Pressable>
      <OnbField
        label={tt('profil.bio')}
        value={bio}
        onChangeText={(v) => setBio(clampBio(v))}
        placeholder={tt('profil.bio_placeholder')}
        multiline
        style={{ marginTop: 24 }}
        hint={`${bio.length} / ${BIO_MAX}`}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  inline: { marginBottom: 12 },
  avail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  availDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    alignSelf: 'center',
    marginTop: 36,
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 112, height: 112, borderRadius: 56 },
  avatarPlus: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
