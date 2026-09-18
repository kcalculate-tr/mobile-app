import React, { useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GlassButton } from './GlassButton';
import { sportive } from '../../theme/sportive';
import { useAuth } from '../../context/AuthContext';
import { resolvePostSocialAuth } from '../../lib/postSocialAuth';

interface Props {
  onNewUser: () => void;
  onReturningUser?: () => void;
  onError: (message: string) => void;
}

// Google marka kurallarının istediği resmi 4 renkli "G" logosu (Google'ın
// kendi sign-in buton üreticisinin kullandığı standart 18x18 path'ler).
const GoogleGLogo = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path
      fill="#4285F4"
      d="M17.64 9.20455c0-.63864-.05727-1.25182-.16363-1.84091H9v3.48181h4.84364c-.20864 1.125-.84273 2.07819-1.79637 2.71592v2.25878h2.90862c1.70274-1.56802 2.68407-3.87668 2.68407-6.5142z"
    />
    <Path
      fill="#34A853"
      d="M9 18c2.43 0 4.46727-.80591 5.95682-2.17545l-2.90862-2.25878c-.80591.54-1.83674.86182-3.0482.86182-2.34273 0-4.32819-1.58318-5.03728-3.71014H.95728v2.33182C2.43818 15.9825 5.48182 18 9 18z"
    />
    <Path
      fill="#FBBC05"
      d="M3.96273 10.71c-.18-.54-.28091-1.11682-.28091-1.71s.10091-1.17.28091-1.71V4.95818H.95728C.34773 6.17318 0 7.54773 0 9s.34773 2.82682.95727 4.04182L3.96273 10.71z"
    />
    <Path
      fill="#EA4335"
      d="M9 3.57955c1.32136 0 2.50727.45409 3.44045 1.34590l2.58136-2.58135C13.46318.891818 11.4245 0 9 0 5.48182 0 2.43818 2.0175.95727 4.95818l3.00546 2.33182C4.67182 5.16273 6.65727 3.57955 9 3.57955z"
    />
  </Svg>
);

// Apple'ın resmi siyah logosu (elma silueti + yaprak + ısırık), Apple'ın
// marka kılavuzunun izin verdiği tek renkli tam-siyah çizim. 24x24 viewBox
// içinde normalize — GlassButton'ın icon kutusu bu yüzden dikdörtgen değil
// kare `iconSize` alıyor, oran bozulmuyor.
const AppleLogo = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#000000"
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.9-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"
    />
  </Svg>
);

// Apple ve Google girişini tek yerde topluyoruz: LoginScreen (dönen kullanıcı)
// ve AuthGatewayScreen (yeni kayıt) aynı bileşeni, aynı yönlendirme mantığıyla
// kullanır. Apple butonu sadece iOS'ta gösterilir (Android'de native Sign in
// with Apple yok); Google her iki platformda.
//
// Apple ve Google ikisi de aynı GlassButton primitive'i kullanıyor (yükseklik/
// köşe/boşluk/font TEK kaynaktan, üç butonda — Kod Gönder dahil — birebir
// aynı) — native AppleAuthenticationButton'ın fontu özelleştirilemediği için
// (Apple kısıtı) tipografi uyumu ancak kendi çizimimizle sağlanabiliyordu.
// Apple'ın App Store kuralları hâlâ karşılanıyor: onaylı metin ("Apple ile
// Giriş Yap"), resmi tek-renk logo, onaylı Beyaz varyant (beyaz zemin/siyah
// metin), Google'dan küçük/daha az belirgin değil (aynı GlassButton). Asıl
// `AppleAuthentication.signInAsync` çağrısı (nonce dahil) AuthContext'teki
// signInWithApple()'da DEĞİŞMEDEN duruyor — burada sadece görsel katman var.
// Google: GlassButton + resmi 4 renkli "G" logosu + onaylı metinlerden biri
// ("Google ile devam et") — Google, Apple'ın aksine kendi native bileşenini
// (varsayılan light/gray pill, özelleştirilemez metin) zorunlu kılmıyor;
// marka kılavuzu doğru logo + onaylı metin şartıyla özel buton stiline izin
// veriyor, bu app'in koyu "glass" temasıyla tutarlı kalması için bu seçildi.
export const SocialAuthButtons: React.FC<Props> = ({ onNewUser, onReturningUser, onError }) => {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [loadingApple, setLoadingApple] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleResult = async (result: { error: string | null; cancelled?: boolean; email?: string; givenName?: string; familyName?: string }) => {
    if (result.cancelled) return;
    if (result.error) {
      onError(result.error);
      return;
    }
    const post = await resolvePostSocialAuth({
      email: result.email,
      givenName: result.givenName,
      familyName: result.familyName,
    });
    if (post.outcome === 'error') {
      onError(post.error ?? 'Bir hata oluştu.');
      return;
    }
    if (post.outcome === 'new_user') {
      onNewUser();
    } else {
      onReturningUser?.();
    }
  };

  const handleApple = async () => {
    if (loadingApple || loadingGoogle) return;
    setLoadingApple(true);
    try {
      const result = await signInWithApple();
      await handleResult(result);
    } finally {
      setLoadingApple(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const result = await signInWithGoogle();
      await handleResult(result);
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>VEYA</Text>
        <View style={styles.line} />
      </View>

      {Platform.OS === 'ios' && (
        <View style={{ marginBottom: 10 }}>
          <GlassButton
            label={loadingApple ? 'Bağlanıyor…' : 'Apple ile Giriş Yap'}
            icon={<AppleLogo size={18} />}
            onPress={handleApple}
            disabled={loadingApple || loadingGoogle}
            style={styles.appleButton}
            textStyle={styles.appleButtonText}
            pressedBackgroundColor="#F0F0F0"
          />
        </View>
      )}

      <GlassButton
        label={loadingGoogle ? 'Bağlanıyor…' : 'Google ile devam et'}
        icon={<GoogleGLogo size={16} />}
        onPress={handleGoogle}
        disabled={loadingApple || loadingGoogle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: sportive.colors.glassBorder },
  dividerText: { ...sportive.type.tactical, color: sportive.colors.textTertiary },
  // Apple'ın App Store kuralı: "Sign in with Apple" özel bir bileşenle
  // çizildiğinde de onaylı renk varyantlarından biri (Beyaz/BeyazContur/
  // Siyah) kullanılmalı — burada Beyaz (zemin beyaz, metin/logo siyah).
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  appleButtonText: {
    color: '#000000',
  },
});
