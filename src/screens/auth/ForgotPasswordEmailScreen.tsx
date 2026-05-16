import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassInput } from '../../components/onboarding/GlassInput';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';
import { getSupabaseClient } from '../../lib/supabase';

export default function ForgotPasswordEmailScreen() {
  const nav = useNavigation();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Geçerli bir e-posta gir.' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      (nav as any).navigate('ResetPasswordOtp', { email: email.trim() });
    } catch (err: any) {
      setErrors({ general: err?.message ?? 'Bir hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.h1}>Şifreni sıfırla.</Text>
            <Text style={styles.sub}>E-posta adresini gir, 6 haneli sıfırlama kodu gönderelim.</Text>

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
              {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}
            </View>
          </View>
          <View style={styles.footer}>
            <PrimaryCTA label="Kod gönder" showArrow loading={loading} onPress={handleSend} />
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
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
});
