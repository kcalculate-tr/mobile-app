import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { StepDots } from '../../components/onboarding/StepDots';
import { sportive } from '../../theme/sportive';

export default function ValuePropOrderScreen() {
  const nav = useNavigation();
  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="02 / 03" />
        <View style={{ flex: 1 }} />
        <View style={styles.content}>
          <Text style={styles.h1}>Öğünler kapında, makrolar cebinde.</Text>
          <Text style={styles.sub}>Sipariş verdiğin her öğün KCalculate sayfasında otomatik olarak dolabına düşer. Manuel takip yok. Hesap yok. Sadece beslen ve kalorilerini analiz et.</Text>
        </View>
        <View style={styles.footer}>
          <PrimaryCTA label="Devam" onPress={() => nav.navigate('ValuePropTracker' as never)} />
          <View style={{ marginTop: 16 }}>
            <StepDots total={3} current={1} />
          </View>
          <Text style={styles.loginLink}>
            Hesabın var mı?{' '}
            <Text style={styles.loginLinkStrong} onPress={() => nav.navigate('Login' as never)}>
              Giriş yap
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    </BackgroundLayer>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 24, marginBottom: 24 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 10 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  loginLink: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, textAlign: 'center', marginTop: 14 },
  loginLinkStrong: { color: sportive.colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' },
});
