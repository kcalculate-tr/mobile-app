import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassInput } from '../../components/onboarding/GlassInput';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useNavGate } from '../../store/navGateStore';
import { getSupabaseClient } from '../../lib/supabase';

const isDuplicateEmail = (err: any): boolean => {
  const msg = (err?.message ?? '').toLowerCase();
  return (
    msg.includes('already registered') ||
    msg.includes('user already exists') ||
    msg.includes('already been registered') ||
    err?.code === 'user_already_exists'
  );
};

export default function RegisterEmailScreen() {
  const nav = useNavigation();
  const { setAuth } = useOnboardingStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string; showLoginLink?: boolean }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Geçerli bir e-posta gir.';
    if (password.length < 6) e.password = 'En az 6 karakter olmalı.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: undefined },
      });
      if (error) {
        if (isDuplicateEmail(error)) {
          setErrors({ email: 'Bu e-posta ile zaten bir hesap var.', showLoginLink: true });
        } else if (/rate limit/i.test(error.message)) {
          setErrors({ general: 'Çok fazla deneme. Birkaç dakika sonra tekrar dene.' });
        } else if (/invalid email/i.test(error.message)) {
          setErrors({ email: 'Geçerli bir e-posta gir.' });
        } else if (/password/i.test(error.message)) {
          setErrors({ password: 'Şifre en az 6 karakter olmalı.' });
        } else {
          setErrors({ general: error.message || 'Bir hata oluştu.' });
        }
        return;
      }
      setAuth(email.trim(), password);
      // Kayıt alt-akışı başladı: VerifyOtp session yaratıp user'ı set
      // edince AppNavigator gate'i kullanıcıyı OnboardingStack'te tutsun
      // (aksi halde bayat onboarding bayrağıyla MainStack'e atılıyordu).
      useNavGate.getState().setRegistering(true);
      nav.navigate('VerifyOtp' as never);
    } catch (err: any) {
      if (isDuplicateEmail(err)) {
        setErrors({ email: 'Bu e-posta ile zaten bir hesap var.', showLoginLink: true });
      } else {
        setErrors({ general: err?.message ?? 'Bir hata oluştu.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="01 / 03" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.h1}>E-posta ve şifre.</Text>
            <Text style={styles.sub}>Hesabını oluşturmak için yeter.</Text>

            <View style={{ marginTop: 28 }}>
              <GlassInput
                label="E-POSTA"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
              />
              <GlassInput
                label="ŞİFRE"
                value={password}
                onChangeText={setPassword}
                secure
                autoCapitalize="none"
                autoComplete="password-new"
                error={errors.password}
              />
              {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}
              {errors.showLoginLink && (
                <Pressable onPress={() => nav.navigate('Login' as never)} style={styles.loginLink}>
                  <Text style={styles.loginLinkText}>Giriş yapmak ister misin? →</Text>
                </Pressable>
              )}
            </View>
          </View>
          <View style={styles.footer}>
            <PrimaryCTA label="Devam" showArrow loading={loading} onPress={handleNext} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BackgroundLayer>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, flex: 1 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 8 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  errorText: { ...sportive.type.caption, color: sportive.colors.error, marginTop: 8, textAlign: 'center' },
  loginLink: { marginTop: 12, alignSelf: 'center' },
  loginLinkText: { ...sportive.type.bodySm, color: sportive.colors.accent, fontFamily: 'PlusJakartaSans_600SemiBold' },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
});
