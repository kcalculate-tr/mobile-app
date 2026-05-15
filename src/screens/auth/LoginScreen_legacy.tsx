import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../lib/supabase';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeSlash } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const loginRegisterImage = require('../../assets/login-register.webp');
import { useAuth } from '../../context/AuthContext';
import { registerForPushNotifications } from '../../lib/notifications';
import { AuthRedirectTarget, RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';

type LoginRouteProp = RouteProp<RootStackParamList, 'Login'>;
type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const navigateByTarget = (
  navigation: LoginNavigationProp,
  target?: AuthRedirectTarget,
) => {
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

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavigationProp>();
  const route = useRoute<LoginRouteProp>();
  const insets = useSafeAreaInsets();
  const { user, authLoading, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const redirectTarget = route.params?.redirectTo;

  const goAfterAuth = useCallback(async () => {
    const needs = await AsyncStorage.getItem('@kcal_needs_nutrition_profile');
    if (needs === 'true') {
      navigation.reset({ index: 0, routes: [{ name: 'NutritionSetup' }] });
      return;
    }
    navigateByTarget(navigation, redirectTarget);
  }, [navigation, redirectTarget]);

  useEffect(() => {
    if (authLoading) return;
    if (user) goAfterAuth();
  }, [authLoading, user, goAfterAuth]);

  const handleSubmit = async () => {
    setErrorMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Lütfen e-posta ve şifre girin.');
      return;
    }
    setSubmitting(true);
    const trimmedEmail = email.trim();
    const { error } = await signIn(trimmedEmail, password);
    setSubmitting(false);
    if (error) {
      if (/email not confirmed/i.test(error)) {
        Alert.alert(
          'E-posta Doğrulanmadı',
          'Hesabınız henüz doğrulanmamış. Doğrulama mailini kontrol edin.',
          [
            { text: 'Tamam', style: 'cancel' },
            {
              text: 'Tekrar Gönder',
              onPress: async () => {
                const supabase = getSupabaseClient();
                const { error: resendErr } = await supabase.auth.resend({
                  type: 'signup',
                  email: trimmedEmail,
                });
                Alert.alert(
                  resendErr ? 'Hata' : 'Gönderildi',
                  resendErr ? resendErr.message : 'Doğrulama maili tekrar gönderildi.',
                );
              },
            },
          ],
        );
        return;
      }
      setErrorMessage(error);
      return;
    }
    // Push token register — best-effort, akışı bloklama
    registerForPushNotifications().catch(() => {});
    goAfterAuth();
  };

  return (
    <View style={[s.root, { backgroundColor: '#FFFFFF' }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 24) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={{ width: '100%', height: SCREEN_HEIGHT * 0.28 }}>
            <Image source={loginRegisterImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', '#FFFFFF']}
              pointerEvents="none"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
            />
          </View>
          <View style={[s.scroll, { backgroundColor: '#FFFFFF', marginTop: -1, paddingTop: 24 }]}>
          {/* Hero text */}
          <Text style={s.title}>Tekrar Hoş Geldin</Text>
          <Text style={s.subtitle}>
            Sağlıklı yolculuğuna devam etmek için giriş yap
          </Text>

          {/* Form */}
          <View style={s.form}>
            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>E-posta Adresi</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Mail adresinizi girin"
                placeholderTextColor={COLORS.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Şifre</Text>
              <View style={s.inputWrapper}>
                <TextInput
                  style={[s.input, s.inputWithIcon]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Şifrenizi girin"
                  placeholderTextColor={COLORS.text.tertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={s.eyeBtn}
                  onPress={() => setShowPassword(v => !v)}
                  activeOpacity={0.7}
                >
                  {showPassword
                    ? <EyeSlash size={18} color={COLORS.text.secondary} />
                    : <Eye size={18} color={COLORS.text.secondary} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot password */}
            <View style={s.forgotRow}>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={s.forgotText}>Şifremi Unuttum?</Text>
              </TouchableOpacity>
            </View>

            {/* Error */}
            {errorMessage ? (
              <Text style={s.errorText}>{errorMessage}</Text>
            ) : null}

            {/* Sign in button */}
            <TouchableOpacity
              style={[s.signInBtn, submitting && s.signInBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={s.signInBtnText}>
                {submitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Text>
              {!submitting && <ArrowRight size={18} color="#000000" />}
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>veya şununla devam et</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={s.socialRow}>
              <TouchableOpacity style={s.socialBtn} activeOpacity={0.8}>
                <Text style={s.socialBtnText}>Apple</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.socialBtn} activeOpacity={0.8}>
                <Text style={s.socialBtnText}>Google</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Register link */}
          <View style={s.registerRow}>
            <Text style={s.registerText}>Hesabın yok mu? </Text>
            <TouchableOpacity
              onPress={() => navigation.push('Register', { redirectTo: redirectTarget })}
              activeOpacity={0.7}
            >
              <Text style={s.registerLink}>Kayıt Ol</Text>
            </TouchableOpacity>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },
  scroll: { paddingHorizontal: 24, paddingTop: 20 },

  // Logo
  logoImg: { width: 120, height: 48, marginBottom: 48 },

  // Hero
  title: { fontSize: 30, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginBottom: 8, lineHeight: 36 },
  subtitle: { fontSize: 15, color: COLORS.text.secondary, marginBottom: 36, lineHeight: 22 },

  // Form
  form: { gap: 14 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '500',
fontFamily: 'PlusJakartaSans_500Medium', color: '#000000' },
  input: {
    height: 56,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#000000',
  },
  inputWrapper: { position: 'relative' },
  inputWithIcon: { paddingRight: 52 },
  eyeBtn: {
    position: 'absolute',
    right: 18,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 4,
  },

  // Forgot
  forgotRow: { alignItems: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, fontWeight: '500',
fontFamily: 'PlusJakartaSans_500Medium', color: '#000000' },

  // Error
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },

  // Sign in button
  signInBtn: {
    height: 56,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  signInBtnDisabled: { opacity: 0.7 },
  signInBtnText: { fontSize: 16, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  dividerText: { fontSize: 13, color: COLORS.text.secondary },

  // Social
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1,
    height: 52,
    borderRadius: 100,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnText: { fontSize: 14, fontWeight: '500',
fontFamily: 'PlusJakartaSans_500Medium', color: '#000000' },

  // Register
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  registerText: { fontSize: 14, color: COLORS.text.secondary },
  registerLink: { fontSize: 14, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000' },
});
