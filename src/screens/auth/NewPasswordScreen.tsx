import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassInput } from '../../components/onboarding/GlassInput';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';
import { getSupabaseClient } from '../../lib/supabase';

export default function NewPasswordScreen() {
  const nav = useNavigation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const e: typeof errors = {};
    if (password.length < 6) e.password = 'En az 6 karakter olmalı.';
    if (password !== confirm) e.confirm = 'Şifreler eşleşmiyor.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Başarılı', 'Şifren güncellendi.', [
        { text: 'Tamam', onPress: () => nav.navigate('Login' as never) },
      ]);
    } catch (err: any) {
      setErrors({ general: err?.message ?? 'Şifre güncellenemedi.' });
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
            <Text style={styles.h1}>Yeni şifre belirle.</Text>
            <Text style={styles.sub}>En az 6 karakter.</Text>

            <View style={{ marginTop: 28 }}>
              <GlassInput
                label="YENİ ŞİFRE"
                value={password}
                onChangeText={setPassword}
                secure
                autoCapitalize="none"
                autoComplete="password-new"
                error={errors.password}
              />
              <GlassInput
                label="YENİ ŞİFRE (TEKRAR)"
                value={confirm}
                onChangeText={setConfirm}
                secure
                autoCapitalize="none"
                autoComplete="password-new"
                error={errors.confirm}
              />
              {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}
            </View>
          </View>
          <View style={styles.footer}>
            <PrimaryCTA label="Şifreyi güncelle" loading={loading} onPress={handleSubmit} />
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
