import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppleLogo, GoogleLogo } from 'phosphor-react-native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassButton } from '../../components/onboarding/GlassButton';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';

export default function AuthGatewayScreen() {
  const nav = useNavigation();

  const handleSocialStub = (provider: string) => {
    Alert.alert(`${provider} ile giriş`, 'Yakında.', [{ text: 'Tamam' }]);
  };

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack />
        <View style={styles.content}>
          <Text style={styles.h1}>Başlayalım.</Text>
          <Text style={styles.sub}>30 saniyede hesabını oluştur.</Text>

          <View style={{ marginTop: 28, gap: 10 }}>
            <GlassButton
              label="Apple ile devam et"
              icon={<AppleLogo size={16} color="#FFF" weight="fill" />}
              onPress={() => handleSocialStub('Apple')}
            />
            <GlassButton
              label="Google ile devam et"
              icon={<GoogleLogo size={16} color="#FFF" weight="bold" />}
              onPress={() => handleSocialStub('Google')}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>VEYA</Text>
            <View style={styles.line} />
          </View>

          <PrimaryCTA
            label="E-posta ile devam et"
            showArrow
            onPress={() => nav.navigate('RegisterEmail' as never)}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.terms}>
            Devam ederek <Text style={styles.termsLink}>Şartlar</Text> ve <Text style={styles.termsLink}>Gizlilik</Text>'i kabul ediyorsun.
          </Text>
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
  content: { paddingHorizontal: 24, paddingTop: 12, flex: 1 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 8 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: sportive.colors.glassBorder },
  dividerText: { ...sportive.type.tactical, color: sportive.colors.textTertiary },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  terms: { ...sportive.type.caption, color: sportive.colors.textMuted, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  termsLink: { color: sportive.colors.textSecondary, textDecorationLine: 'underline' },
  loginLink: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, textAlign: 'center' },
  loginLinkStrong: { color: sportive.colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' },
});
