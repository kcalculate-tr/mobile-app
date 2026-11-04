// FinSignupAI — Kcal AI kayıt/tanıtım giriş ekranı (final tasarım).
// Tam ekran karşılama: sağ üst "Atla", büyük Bricolage başlık, alt yaslı
// yığılmış kimlik butonları (Apple/Google/E-posta). Yeni kimlik doğrulama
// icat edilmez — prop verilmezse mevcut KcalAiSignUp akışının `useAuth()`
// çağrıları (signInWithApple/signInWithGoogle/signInWithOtp) kullanılır.
import React from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';

import {
  FinScreen,
  FinPrimaryButton,
  FinSecondaryButton,
  FinDisplay,
  finExtras,
  body,
} from '../finUi';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { AppleLogo, GoogleLogo, EnvelopeSimple } from '../../../../components/icons';

export default function SignupAIScreen({
  onSkip,
  onApple,
  onGoogle,
  onEmail,
  children,
}: {
  onSkip?: () => void;
  onApple?: () => void;
  onGoogle?: () => void;
  onEmail?: () => void;
  /** E-posta ile devam → inline e-posta alanı (çağıran enjekte eder; mevcut OTP mantığı tekrar yazılmaz). */
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr } = useT();
  const { signInWithApple, signInWithGoogle } = useAuth();

  // Prop verilmezse mevcut KcalAiSignUp ekranının kullandığı `useAuth` çağrılarına düş.
  const handleApple = () => {
    if (onApple) onApple();
    else void signInWithApple?.();
  };
  const handleGoogle = () => {
    if (onGoogle) onGoogle();
    else void signInWithGoogle?.();
  };
  const handleEmail = () => {
    onEmail?.();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <FinScreen contentStyle={{ justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 34 }}>
        <Pressable
          onPress={() => onSkip?.()}
          accessibilityRole="button"
          hitSlop={8}
          style={{
            position: 'absolute',
            top: 59,
            right: 16,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: body, fontSize: 15, color: t.color.secondary }}>
            {tr('profil.signup_skip')}
          </Text>
        </Pressable>

        <FinDisplay size={32} style={{ lineHeight: 38 }}>
          {tr('profil.signup_welcome_title')}
        </FinDisplay>
        <Text
          style={{
            marginTop: 12,
            fontFamily: body,
            fontSize: 15,
            lineHeight: 21,
            color: t.color.secondary,
          }}
        >
          {tr('profil.signup_welcome_subtitle')}
        </Text>

        <View style={{ marginTop: 28, gap: 8 }}>
          <FinPrimaryButton
            label={tr('profil.signup_apple')}
            onPress={handleApple}
            tone="ink"
            icon={<AppleLogo size={18} color={t.color.bg} weight="fill" />}
          />
          <FinSecondaryButton
            label={tr('profil.signup_google')}
            onPress={handleGoogle}
            height={52}
            icon={<GoogleLogo size={18} color={t.color.ink} weight="bold" />}
          />
          <FinSecondaryButton
            label={tr('profil.signup_email')}
            onPress={handleEmail}
            height={52}
            icon={<EnvelopeSimple size={18} color={t.color.ink} weight="bold" />}
          />
        </View>

        {children}

        <Text
          style={{
            marginTop: 16,
            textAlign: 'center',
            fontFamily: body,
            fontSize: 13,
            lineHeight: 18,
            color: t.color.secondary,
          }}
        >
          {tr('profil.signup_terms')}
        </Text>
      </FinScreen>
    </SafeAreaView>
  );
}
