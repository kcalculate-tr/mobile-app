import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { OTPInput } from '../../components/onboarding/OTPInput';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';
import { useOnboardingStore } from '../../store/onboardingStore';
import { getSupabaseClient } from '../../lib/supabase';

export default function VerifyOtpScreen() {
  const nav = useNavigation();
  const { email } = useOnboardingStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (countdown === 0) return;
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleComplete = async (entered: string) => {
    setCode(entered);
    setLoading(true);
    setError(false);
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: entered,
        type: 'signup',
      });
      if (err) throw err;
      nav.navigate('RegisterIdentity' as never);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(60);
    const supabase = getSupabaseClient();
    await supabase.auth.resend({ type: 'signup', email });
  };

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0');
  const ss = String(countdown % 60).padStart(2, '0');

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack />
        <View style={styles.content}>
          <Text style={styles.h1}>Kodunu gönderdik.</Text>
          <Text style={styles.sub}>
            <Text style={styles.subStrong}>{email}</Text> adresine 6 haneli kod yolladık.
          </Text>

          <View style={{ marginTop: 32 }}>
            <OTPInput onComplete={handleComplete} error={error} />
          </View>

          {error ? <Text style={styles.errorText}>Kod yanlış. Tekrar dene.</Text> : null}

          <Pressable onPress={handleResend} disabled={countdown > 0} style={{ marginTop: 20 }}>
            <Text style={styles.resend}>
              Kodu tekrar gönder{' '}
              {countdown > 0 ? (
                <Text style={styles.resendCounter}>({mm}:{ss})</Text>
              ) : (
                <Text style={styles.resendActive}>Şimdi</Text>
              )}
            </Text>
          </Pressable>
        </View>
        <View style={styles.footer}>
          <PrimaryCTA
            label="Doğrula"
            loading={loading}
            disabled={code.length !== 6}
            onPress={() => handleComplete(code)}
          />
        </View>
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
  errorText: { ...sportive.type.caption, color: sportive.colors.error, marginTop: 14, textAlign: 'center' },
  resend: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, textAlign: 'center' },
  resendCounter: { color: sportive.colors.textTertiary },
  resendActive: { color: sportive.colors.accent, fontFamily: 'PlusJakartaSans_500Medium' },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
});
