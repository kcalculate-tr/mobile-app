import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassInput } from '../../components/onboarding/GlassInput';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';
import { useOnboardingStore } from '../../store/onboardingStore';

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
};

const phoneDigits = (raw: string): string => raw.replace(/\D/g, '');

export default function RegisterIdentityScreen() {
  const nav = useNavigation();
  const { setIdentity } = useOnboardingStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string }>({});

  const handleNext = () => {
    const e: typeof errors = {};
    if (!firstName.trim()) e.firstName = 'Ad zorunlu.';
    if (!lastName.trim()) e.lastName = 'Soyad zorunlu.';
    const digits = phoneDigits(phone);
    if (digits.length !== 11 || !digits.startsWith('05')) e.phone = '05 ile başlayan 11 hane gir.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setIdentity(firstName.trim(), lastName.trim(), digits);
    nav.navigate('RegisterAddress' as never);
  };

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="02 / 03" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.h1}>Bize biraz kendinden bahset.</Text>
            <Text style={styles.sub}>Sipariş ve teslimat için bu bilgilere ihtiyacımız var.</Text>

            <View style={{ marginTop: 28 }}>
              <GlassInput
                label="AD"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                error={errors.firstName}
              />
              <GlassInput
                label="SOYAD"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                error={errors.lastName}
              />
              <GlassInput
                label="TELEFON"
                value={formatPhone(phone)}
                onChangeText={(t) => setPhone(phoneDigits(t))}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="05XX XXX XX XX"
                error={errors.phone}
              />
            </View>
          </View>
          <View style={styles.footer}>
            <PrimaryCTA label="Devam" showArrow onPress={handleNext} />
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
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
});
