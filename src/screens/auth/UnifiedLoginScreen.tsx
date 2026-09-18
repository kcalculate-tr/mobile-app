import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Pressable } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassInput } from '../../components/onboarding/GlassInput';
import { OTPInput } from '../../components/onboarding/OTPInput';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { SocialAuthButtons } from '../../components/onboarding/SocialAuthButtons';
import { sportive } from '../../theme/sportive';
import { useAuth } from '../../context/AuthContext';
import { AuthRedirectTarget, RootStackParamList } from '../../navigation/types';

type LoginRouteProp = RouteProp<RootStackParamList, 'Login'>;
type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const navigateByTarget = (navigation: LoginNavigationProp, target?: AuthRedirectTarget) => {
  if (target === 'Checkout') {
    navigation.replace('Checkout');
    return;
  }
  if (target === 'Addresses') {
    navigation.replace('Addresses');
    return;
  }
  navigation.replace('Tabs', { screen: 'Home' });
};

// FAZ G — kayıtsız gezinme: uygulama zorunlu onboarding zinciri olmadan açılır,
// bu ekran Checkout'ta ve Tracker/Profile sekmelerinde oturum gerektiğinde
// tek noktadan giriş sağlar. Apple/Google zaten hazır (AuthContext); e-posta
// şifresiz — signInWithOtp + 6 haneli kod. Aynı e-posta varsa mevcut hesaba
// girer, yoksa Supabase otomatik yeni hesap açar (ayrı bir "kayıt" ekranı yok).
export default function UnifiedLoginScreen() {
  const navigation = useNavigation<LoginNavigationProp>();
  const route = useRoute<LoginRouteProp>();
  const { user, signInWithOtp, verifyEmailOtp } = useAuth();
  const redirectTarget = route.params?.redirectTo;

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [socialError, setSocialError] = useState('');

  useEffect(() => {
    if (countdown === 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // Sosyal girişte AuthContext session'ı senkron set etmez (onAuthStateChange
  // async); user değişince (bu ekran hâlâ mount'ken) hedefe geç.
  useEffect(() => {
    if (user) finishLogin();
  }, [user]);

  const finishLogin = async () => {
    await AsyncStorage.multiSet([
      ['@kcal_onboarding_done', 'true'],
    ]);
    navigateByTarget(navigation, redirectTarget);
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Geçerli bir e-posta gir.');
      return;
    }
    setError('');
    setSending(true);
    const { error: err } = await signInWithOtp(trimmed);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setStep('code');
    setCountdown(60);
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(60);
    await signInWithOtp(email.trim());
  };

  const handleVerify = async (entered: string) => {
    setCode(entered);
    if (entered.length !== 6) return;
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

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack />
        <KeyboardAvoidingView behavior={undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            {step === 'email' ? (
              <>
                <Text style={styles.h1}>Devam etmek için giriş yap.</Text>
                <Text style={styles.sub}>Hesabın yoksa e-postanla 30 saniyede açılır.</Text>

                <View style={{ marginTop: 28 }}>
                  <GlassInput
                    label="E-POSTA"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    error={error}
                  />
                </View>

                <View style={{ marginTop: 8 }}>
                  <PrimaryCTA label="Kod Gönder" showArrow loading={sending} onPress={handleSendCode} />
                </View>

                <SocialAuthButtons
                  onNewUser={finishLogin}
                  onReturningUser={finishLogin}
                  onError={setSocialError}
                />
                {socialError ? <Text style={styles.errorText}>{socialError}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.h1}>Kodunu gönderdik.</Text>
                <Text style={styles.sub}>
                  <Text style={styles.subStrong}>{email.trim()}</Text> adresine 6 haneli kod yolladık.
                </Text>

                <View style={{ marginTop: 32 }}>
                  <OTPInput onComplete={handleVerify} error={codeError} />
                </View>

                {codeError ? <Text style={styles.errorText}>Kod yanlış. Tekrar dene.</Text> : null}

                <Pressable onPress={handleResend} disabled={countdown > 0} style={{ marginTop: 20 }}>
                  <Text style={styles.resend}>
                    Kodu tekrar gönder{' '}
                    {countdown > 0 ? (
                      <Text style={styles.resendCounter}>
                        ({String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')})
                      </Text>
                    ) : (
                      <Text style={styles.resendActive}>Şimdi</Text>
                    )}
                  </Text>
                </Pressable>
                <Pressable onPress={() => { setStep('email'); setCode(''); setCodeError(false); }} style={{ marginTop: 8 }}>
                  <Text style={styles.resend}>E-postayı değiştir</Text>
                </Pressable>

                <View style={{ marginTop: 20 }}>
                  <PrimaryCTA
                    label="Doğrula"
                    loading={verifying}
                    disabled={code.length !== 6}
                    onPress={() => handleVerify(code)}
                  />
                </View>
              </>
            )}
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
  subStrong: { color: sportive.colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' },
  errorText: { ...sportive.type.caption, color: sportive.colors.error, marginTop: 12, textAlign: 'center' },
  resend: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, textAlign: 'center' },
  resendCounter: { color: sportive.colors.textTertiary },
  resendActive: { color: sportive.colors.accent, fontFamily: 'PlusJakartaSans_500Medium' },
});
