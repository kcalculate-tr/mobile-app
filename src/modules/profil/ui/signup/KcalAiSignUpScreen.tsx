// T20SignupAI — Kcal AI kaydı, 3 ekran (1 bileşen içinde adım durumu).
// `useFeature('kesfet')` arkasında; UnifiedLoginScreen'e DOKUNMAZ, aynı
// kimlik doğrulama çağrılarını (`useAuth`) doğrudan kullanır. Kalori/kilo
// sorusu YOK — "Takibe başla" ayrı, isteğe bağlı bir akış (bkz. ../TakibeBaslaCTA).
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { AppleLogo, CaretLeft, Check, EnvelopeSimple, GoogleLogo, User } from '../../../../components/icons';
import { useKcalculateAiRegistration } from '../../useRegistration';
import { pickAndUploadAvatar } from '../../avatarUpload';
import { getProfilClient } from '../../client';

type Step = 'welcome' | 'email' | 'handle' | 'profile';

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

export interface KcalAiSignUpScreenProps {
  /** Akış bitti (ya "Keşfet'e geç" ya da zaten kayıtlı) — çağıran yönlendirir. */
  onDone: () => void;
  onBack?: () => void;
}

export default function KcalAiSignUpScreen({ onDone, onBack }: KcalAiSignUpScreenProps) {
  const reg = useKcalculateAiRegistration();
  if (!reg.enabled) return null;
  return <SignUpFlow reg={reg} onDone={onDone} onBack={onBack} />;
}

function SignUpFlow({
  reg,
  onDone,
  onBack,
}: {
  reg: ReturnType<typeof useKcalculateAiRegistration>;
  onDone: () => void;
  onBack?: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const insets = useSafeAreaInsets();
  const { signInWithApple, signInWithGoogle, signInWithOtp, verifyEmailOtp } = useAuth();

  const [step, setStep] = useState<Step>('welcome');
  const [socialBusy, setSocialBusy] = useState<'apple' | 'google' | null>(null);
  const [socialError, setSocialError] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const afterAuthed = async () => {
    if (await hasProfileHandle()) {
      onDone();
      return;
    }
    setStep('handle');
  };

  const handleApple = async () => {
    if (socialBusy) return;
    setSocialBusy('apple');
    setSocialError('');
    try {
      const res = await signInWithApple();
      if (res.cancelled) return;
      if (res.error) {
        setSocialError(res.error);
        return;
      }
      await afterAuthed();
    } finally {
      setSocialBusy(null);
    }
  };

  const handleGoogle = async () => {
    if (socialBusy) return;
    setSocialBusy('google');
    setSocialError('');
    try {
      const res = await signInWithGoogle();
      if (res.cancelled) return;
      if (res.error) {
        setSocialError(res.error);
        return;
      }
      await afterAuthed();
    } finally {
      setSocialBusy(null);
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
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
    setCode(entered);
    if (entered.length !== 6) return;
    setEmailBusy(true);
    const { error } = await verifyEmailOtp(email.trim(), entered);
    setEmailBusy(false);
    if (error) {
      setEmailError(tt('profil.code_invalid'));
      return;
    }
    await afterAuthed();
  };

  const handlePickAvatar = async (userId: string | undefined) => {
    if (!userId) return;
    const url = await pickAndUploadAvatar(userId);
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

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.color.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {step !== 'welcome' ? (
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === 'email') setStep('welcome');
              else if (step === 'handle') setStep('welcome');
              else onBack?.();
            }}
            style={styles.backBtn}
            accessibilityRole="button"
          >
            <CaretLeft size={22} color={t.color.ink} weight="bold" />
          </Pressable>
          {step !== 'profile' ? (
            <Pressable onPress={() => finishProfile(true)} style={styles.skipBtn}>
              <AppText variant="body" style={{ fontWeight: '600' }}>
                {tt('common.cancel')}
              </AppText>
            </Pressable>
          ) : (
            <Pressable onPress={() => finishProfile(true)} style={styles.skipBtn} accessibilityRole="button">
              <AppText variant="body" style={{ fontWeight: '600' }}>
                {tt('profil.signup_skip')}
              </AppText>
            </Pressable>
          )}
        </View>
      ) : null}

      {step === 'welcome' ? (
        <View style={styles.content}>
          <View style={[styles.logoCircle, { backgroundColor: t.color.ink }]}>
            <AppText variant="heading" style={styles.logoText}>
              kcal
            </AppText>
            <View style={[styles.logoDot, { backgroundColor: t.color.accent }]} />
          </View>
          <AppText variant="title" style={styles.centerText}>
            {tt('profil.signup_welcome_title')}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.centerText}>
            {tt('profil.signup_welcome_subtitle')}
          </AppText>

          <View style={styles.spacer} />

          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={handleApple}
              disabled={socialBusy !== null}
              style={[styles.authBtn, { backgroundColor: t.color.ink }]}
              accessibilityRole="button"
            >
              {socialBusy === 'apple' ? <ActivityIndicator color="#FFFFFF" /> : <AppleLogo size={18} color="#FFFFFF" weight="fill" />}
              <AppText variant="body" style={styles.authBtnTextOnDark}>
                {tt('profil.signup_apple')}
              </AppText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleGoogle}
            disabled={socialBusy !== null}
            style={[styles.authBtn, { borderColor: t.color.line }]}
            accessibilityRole="button"
          >
            {socialBusy === 'google' ? <ActivityIndicator /> : <GoogleLogo size={18} color={t.color.ink} weight="bold" />}
            <AppText variant="body" style={styles.authBtnText}>
              {tt('profil.signup_google')}
            </AppText>
          </Pressable>

          <Pressable
            onPress={handleSendCode}
            disabled={socialBusy !== null}
            style={[styles.authBtn, { borderColor: t.color.line }]}
            accessibilityRole="button"
          >
            <EnvelopeSimple size={18} color={t.color.ink} weight="bold" />
            <AppText variant="body" style={styles.authBtnText}>
              {tt('profil.signup_email')}
            </AppText>
          </Pressable>

          {step === 'welcome' ? (
            <View style={styles.emailInline}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@eposta.com"
                placeholderTextColor={t.color.secondary}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.emailInput, { borderColor: t.color.line, color: t.color.ink }]}
              />
            </View>
          ) : null}

          {socialError ? (
            <AppText variant="caption" style={{ color: t.color.danger, textAlign: 'center' }}>
              {socialError}
            </AppText>
          ) : null}
          {emailError ? (
            <AppText variant="caption" style={{ color: t.color.danger, textAlign: 'center' }}>
              {emailError}
            </AppText>
          ) : null}

          <AppText variant="caption" tone="secondary" style={styles.terms}>
            {tt('profil.signup_terms')}
          </AppText>
        </View>
      ) : null}

      {step === 'email' ? (
        <View style={styles.content}>
          <AppText variant="title" style={styles.centerText}>
            {tt('profil.signup_code_title')}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.centerText}>
            {email.trim()}
          </AppText>
          <TextInput
            value={code}
            onChangeText={handleVerifyCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.codeInput, { borderColor: t.color.line, color: t.color.ink }]}
          />
          {emailBusy ? <ActivityIndicator /> : null}
          {emailError ? (
            <AppText variant="caption" style={{ color: t.color.danger, textAlign: 'center' }}>
              {emailError}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {step === 'handle' ? (
        <View style={styles.content}>
          <View style={styles.progressRow}>
            <View style={[styles.progressSeg, { backgroundColor: t.color.ink }]} />
            <View style={[styles.progressSeg, { backgroundColor: t.color.line }]} />
          </View>
          <AppText variant="title" style={styles.title}>
            {tt('profil.signup_name_title')}
          </AppText>

          <AppText variant="caption" tone="secondary" style={styles.label}>
            {tt('profil.display_name')}
          </AppText>
          <TextInput
            value={reg.displayName}
            onChangeText={reg.setDisplayName}
            placeholder={tt('profil.display_name')}
            placeholderTextColor={t.color.secondary}
            style={[styles.textField, { borderColor: t.color.line, color: t.color.ink }]}
          />

          <AppText variant="caption" tone="secondary" style={styles.label}>
            {tt('profil.handle_label')}
          </AppText>
          <View
            style={[
              styles.textField,
              styles.handleField,
              { borderColor: reg.handle.status === 'available' ? t.color.accentLine : t.color.ink },
            ]}
          >
            <AppText variant="body" tone="secondary">
              @
            </AppText>
            <TextInput
              value={reg.handle.value}
              onChangeText={reg.handle.setValue}
              placeholder="kullanici_adi"
              placeholderTextColor={t.color.secondary}
              autoCapitalize="none"
              style={[styles.handleInput, { color: t.color.ink }]}
            />
            {reg.handle.status === 'checking' ? <ActivityIndicator size="small" /> : null}
            {reg.handle.status === 'available' ? (
              <View style={styles.availableBadge}>
                <Check size={14} color={t.color.accentLine} weight="bold" />
                <AppText variant="caption" style={{ color: t.color.accentLine, fontWeight: '700' }}>
                  {tt('profil.handle_available')}
                </AppText>
              </View>
            ) : null}
          </View>
          {reg.handle.messageKey ? (
            <AppText variant="caption" style={{ color: t.color.danger }}>
              {tt(reg.handle.messageKey)}
            </AppText>
          ) : (
            <AppText variant="caption" tone="secondary">
              {tt('profil.handle_hint')}
            </AppText>
          )}
          {reg.error ? (
            <AppText variant="caption" style={{ color: t.color.danger }}>
              {tt(reg.error)}
            </AppText>
          ) : null}

          <View style={styles.spacer} />

          <Pressable
            onPress={async () => {
              const res = await reg.submit();
              if (res.ok) setStep('profile');
            }}
            disabled={!reg.canSubmit}
            style={[styles.authBtn, { backgroundColor: t.color.ink, opacity: reg.canSubmit ? 1 : 0.4 }]}
            accessibilityRole="button"
          >
            {reg.submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppText variant="body" style={styles.authBtnTextOnDark}>
                {tt('profil.signup_continue')}
              </AppText>
            )}
          </Pressable>
        </View>
      ) : null}

      {step === 'profile' ? (
        <View style={styles.content}>
          <View style={styles.progressRow}>
            <View style={[styles.progressSeg, { backgroundColor: t.color.ink }]} />
            <View style={[styles.progressSeg, { backgroundColor: t.color.ink }]} />
          </View>
          <AppText variant="title" style={styles.title}>
            {tt('profil.signup_photo_title')}
          </AppText>
          <AppText variant="body" tone="secondary">
            {tt('profil.signup_photo_subtitle')}
          </AppText>

          <Pressable
            onPress={() => handlePickAvatar(undefined)}
            style={[styles.avatarPicker, { backgroundColor: t.color.line }]}
            accessibilityRole="button"
          >
            <User size={32} color={t.color.secondary} weight="fill" />
            <View style={[styles.avatarPlus, { backgroundColor: t.color.accent }]}>
              <Check size={14} color={t.color.onAccent} weight="bold" />
            </View>
          </Pressable>

          <AppText variant="caption" tone="secondary" style={styles.label}>
            {tt('profil.bio')}
          </AppText>
          <TextInput
            value={bio}
            onChangeText={(v) => setBio(v.slice(0, 150))}
            placeholder={tt('profil.bio_placeholder')}
            placeholderTextColor={t.color.secondary}
            multiline
            style={[styles.textField, styles.bioField, { borderColor: t.color.line, color: t.color.ink }]}
          />
          <AppText variant="caption" tone="secondary">
            {bio.length} / 150
          </AppText>

          <View style={styles.spacer} />

          <Pressable
            onPress={() => finishProfile(false)}
            disabled={savingProfile}
            style={[styles.authBtn, { backgroundColor: t.color.ink }]}
            accessibilityRole="button"
          >
            {savingProfile ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppText variant="body" style={styles.authBtnTextOnDark}>
                {tt('profil.signup_go_discover')}
              </AppText>
            )}
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24, gap: 10 },
  logoCircle: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#FFFFFF' },
  logoDot: { position: 'absolute', right: 20, bottom: 18, width: 6, height: 6, borderRadius: 3 },
  centerText: { textAlign: 'center' },
  title: { marginTop: 8 },
  spacer: { flex: 1, minHeight: 12 },
  authBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  authBtnText: { fontWeight: '600' },
  authBtnTextOnDark: { color: '#FFFFFF', fontWeight: '600' },
  emailInline: { marginTop: -2 },
  emailInput: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  terms: { textAlign: 'center', marginTop: 8 },
  codeInput: {
    marginTop: 16,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 4,
  },
  progressRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  label: { marginTop: 14, marginBottom: 6 },
  textField: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  handleField: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2 },
  handleInput: { flex: 1, fontSize: 16, height: '100%' },
  availableBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarPicker: {
    alignSelf: 'center',
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  avatarPlus: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioField: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
});
