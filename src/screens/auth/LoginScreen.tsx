import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppleLogo, GoogleLogo } from 'phosphor-react-native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassInput } from '../../components/onboarding/GlassInput';
import { GlassButton } from '../../components/onboarding/GlassButton';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useNavGate } from '../../store/navGateStore';

export default function LoginScreen() {
  const nav = useNavigation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Geçerli bir e-posta gir.';
    if (password.length < 6) e.password = 'En az 6 karakter olmalı.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setErrors({ general: error });
      return;
    }
    // ROOT CAUSE: AppNavigator gate'i
    //   inOnboardingStack = registering || !onboardingDone || !user || needsNutrition
    // `@kcal_onboarding_done` false iken auth olmuş kullanıcıyı bile
    // OnboardingStack'te kilitliyordu. Bu bayrak fresh install'da yok,
    // ve logout (BUG A multiRemove) onu siliyor → dönen kullanıcı login
    // olduğunda signIn BAŞARILI ama gate hiç açılmıyor, ekran Login'de
    // kalıyor → "Giriş Yap'a basınca hiçbir şey olmuyor". Buton bind
    // sorunu DEĞİL (aynı stack'teki diğer PrimaryCTA'lar çalışıyor);
    // sorun success sonrası state-driven geçişin hiç tetiklenmemesi.
    //
    // Onboarding intro AUTH ÖNCESİ yeni kullanıcı içindir; hesabı olup
    // login olan biri için bitmiştir. Bayrakları kalıcılaştır, kayıt
    // alt-akışı bayrağını temizle, AppNavigator'ı yeniden değerlendir.
    // Imperative nav YOK (FIX 7 prensibi) — gate state-driven MainStack'e
    // geçer.
    await AsyncStorage.multiSet([
      ['@kcal_onboarding_done', 'true'],
      ['@kcal_needs_nutrition_profile', 'false'],
    ]);
    useNavGate.getState().setRegistering(false);
    useNavGate.getState().refresh();
  };

  const handleSocialStub = (provider: string) => {
    Alert.alert(`${provider} ile giriş`, 'Yakında.', [{ text: 'Tamam' }]);
  };

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.h1}>Tekrar hoş geldin.</Text>
            <Text style={styles.sub}>E-posta ve şifrenle devam et.</Text>

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
                autoComplete="password"
                error={errors.password}
              />
              <Pressable onPress={() => nav.navigate('ForgotPasswordEmail' as never)} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                <Text style={styles.forgot}>Şifremi unuttum?</Text>
              </Pressable>
              {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}
            </View>

            <View style={{ marginTop: 20 }}>
              <PrimaryCTA label="Giriş Yap" showArrow loading={loading} onPress={handleLogin} />
            </View>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>VEYA</Text>
              <View style={styles.line} />
            </View>

            <View style={{ gap: 10 }}>
              <GlassButton
                label="Apple ile giriş yap"
                icon={<AppleLogo size={16} color="#FFF" weight="fill" />}
                onPress={() => handleSocialStub('Apple')}
              />
              <GlassButton
                label="Google ile giriş yap"
                icon={<GoogleLogo size={16} color="#FFF" weight="bold" />}
                onPress={() => handleSocialStub('Google')}
              />
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.bottomLink}>
              Hesabın yok mu?{' '}
              <Text style={styles.bottomLinkStrong} onPress={() => nav.navigate('AuthGateway' as never)}>
                Kayıt ol
              </Text>
            </Text>
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
  forgot: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' },
  errorText: { ...sportive.type.caption, color: sportive.colors.error, marginTop: 8, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: sportive.colors.glassBorder },
  dividerText: { ...sportive.type.tactical, color: sportive.colors.textTertiary },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  bottomLink: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, textAlign: 'center' },
  bottomLinkStrong: { color: sportive.colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' },
});
