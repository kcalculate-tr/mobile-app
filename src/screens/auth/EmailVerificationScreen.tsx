import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EnvelopeSimpleIcon } from 'phosphor-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';

type EmailVerifRoute = RouteProp<RootStackParamList, 'EmailVerification'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function EmailVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EmailVerifRoute>();
  const insets = useSafeAreaInsets();
  const email = route.params?.email || '';

  const [resendCooldown, setResendCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const goNext = async () => {
    const needs = await AsyncStorage.getItem('@kcal_needs_nutrition_profile');
    if (needs === 'true') {
      navigation.reset({ index: 0, routes: [{ name: 'NutritionSetup' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    }
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.email_confirmed_at || session?.user?.confirmed_at) {
          goNext();
        }
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periyodik kontrol — kullanıcı tarayıcıda doğrularsa otomatik algıla
  useEffect(() => {
    const supabase = getSupabaseClient();
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email_confirmed_at || data.user?.confirmed_at) {
          clearInterval(interval);
          goNext();
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = async () => {
    const supabase = getSupabaseClient();
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && (refreshData.session?.user?.email_confirmed_at || refreshData.session?.user?.confirmed_at)) {
        await goNext();
        return;
      }
      // Refresh başarısız ya da session yenilendi ama hâlâ confirmed değil — getUser ile dene
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
        return;
      }
      if (userData.user?.email_confirmed_at || userData.user?.confirmed_at) {
        await goNext();
        return;
      }
      Alert.alert(
        'Uyarı',
        'E-postanız henüz doğrulanmamış görünüyor. Lütfen gelen kutunuzu kontrol edin veya tekrar gönderin.',
      );
    } catch {
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || sending || !email) return;
    setSending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      setSending(false);
      if (error) {
        Alert.alert('Hata', error.message);
        return;
      }
      setResendCooldown(60);
      Alert.alert('Gönderildi', 'Doğrulama maili tekrar gönderildi.');
    } catch {
      setSending(false);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.iconWrap}>
        <EnvelopeSimpleIcon size={64} color={COLORS.brand.green} weight="fill" />
      </View>

      <Text style={s.title}>E-postanızı Doğrulayın</Text>
      <Text style={s.subtitle}>
        <Text style={s.emailBold}>{email}</Text> adresine doğrulama linki gönderdik.
        Lütfen gelen kutunuzu kontrol edin.
      </Text>
      <Text style={s.spamNote}>
        E-posta gelmediyse spam/junk klasörünü kontrol edin.
      </Text>

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.outlineBtn, (resendCooldown > 0 || sending) && s.btnDisabled]}
          onPress={handleResend}
          disabled={resendCooldown > 0 || sending}
          activeOpacity={0.85}
        >
          <Text style={s.outlineBtnText}>
            {resendCooldown > 0
              ? `Tekrar Gönder (${resendCooldown}s)`
              : sending
              ? 'Gönderiliyor...'
              : 'Doğrulama Mailini Tekrar Gönder'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.filledBtn}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={s.filledBtnText}>Doğruladım, Devam Et</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={s.altLink}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Register' }] })}
        activeOpacity={0.7}
      >
        <Text style={s.altLinkText}>Farklı e-posta ile kayıt ol</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  emailBold: {
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1A1A',
  },
  spamNote: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 32,
  },
  actions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  outlineBtn: {
    height: 52,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1A1A1A',
  },
  filledBtn: {
    height: 52,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledBtnText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  altLink: {
    marginTop: 24,
    paddingVertical: 8,
  },
  altLinkText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textDecorationLine: 'underline',
  },
});
