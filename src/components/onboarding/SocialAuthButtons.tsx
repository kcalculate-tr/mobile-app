import React, { useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { AppleLogo, GoogleLogo } from 'phosphor-react-native';
import { GlassButton } from './GlassButton';
import { sportive } from '../../theme/sportive';
import { useAuth } from '../../context/AuthContext';
import { resolvePostSocialAuth } from '../../lib/postSocialAuth';

interface Props {
  onNewUser: () => void;
  onReturningUser?: () => void;
  onError: (message: string) => void;
}

// Apple ve Google girişini tek yerde topluyoruz: LoginScreen (dönen kullanıcı)
// ve AuthGatewayScreen (yeni kayıt) aynı bileşeni, aynı yönlendirme mantığıyla
// kullanır. Apple butonu sadece iOS'ta gösterilir (Android'de native Sign in
// with Apple yok); Google her iki platformda.
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
            label={loadingApple ? 'Bağlanıyor…' : 'Apple ile devam et'}
            icon={<AppleLogo size={18} color={sportive.colors.textPrimary} weight="fill" />}
            onPress={handleApple}
            disabled={loadingApple || loadingGoogle}
          />
        </View>
      )}

      <GlassButton
        label={loadingGoogle ? 'Bağlanıyor…' : 'Google ile devam et'}
        icon={<GoogleLogo size={18} color={sportive.colors.textPrimary} weight="bold" />}
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
});
