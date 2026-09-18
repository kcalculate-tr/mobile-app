import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BackgroundLayer } from '../components/onboarding/BackgroundLayer';
import { TopBar } from '../components/onboarding/TopBar';
import { PrimaryCTA } from '../components/onboarding/PrimaryCTA';
import { GlassButton } from '../components/onboarding/GlassButton';
import { sportive } from '../theme/sportive';
import { RootStackParamList } from '../navigation/types';
import { track } from '../lib/analytics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Oturumsuz kullanıcıya soğuk başlatmada bir kez gösterilen tek ekranlı
// karşılama — eski zorunlu Welcome→ValueProp→AuthGateway zincirinin yerine
// geçmez (o zincir hâlâ OnboardingStack'te duruyor ama buradan tetiklenmiyor);
// bu ekran hiçbir akışı bloklamaz, her iki buton da doğrudan devam ettirir.
// "Aynı oturumda tekrar gösterilmemesi" AppNavigator'daki initialRouteName
// mekanizmasıyla sağlanıyor (bkz. o dosyadaki yorum) — burada ekstra state
// tutmuyoruz.
export default function WelcomeGateScreen() {
  const navigation = useNavigation<NavProp>();

  useEffect(() => {
    track('welcome_view');
  }, []);

  const continueAsGuest = (source: 'top_skip' | 'guest_button') => {
    track('welcome_skip_click', { source });
    navigation.replace('Tabs');
  };

  const goToLogin = () => {
    track('welcome_login_click');
    navigation.navigate('Login');
  };

  return (
    <BackgroundLayer mode="sharp">
      <SafeAreaView style={styles.safe}>
        <TopBar rightAction={{ label: 'Atla', onPress: () => continueAsGuest('top_skip') }} />
        <View style={{ flex: 1 }} />
        <View style={styles.content}>
          <Text style={styles.h1}>Gün boyu ne yiyeceğim diye düşünme.</Text>
          <Text style={styles.sub}>
            KCAL günün temposuna göre premium öğününü hazırlar. Sipariş verdiğin her öğün otomatik
            olarak takibine düşer — manuel giriş yok, sadece sağlıklı beslenmenin keyfini çıkar.
          </Text>
        </View>
        <View style={styles.footer}>
          <PrimaryCTA label="Giriş yap / Hesap oluştur" onPress={goToLogin} />
          <View style={{ marginTop: 12 }}>
            <GlassButton label="Üye olmadan devam et" onPress={() => continueAsGuest('guest_button')} />
          </View>
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
});
