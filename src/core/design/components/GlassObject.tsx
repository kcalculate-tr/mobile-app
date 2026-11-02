import React from 'react';
import { Animated, Image, ImageSourcePropType, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { useBreath, useEnter, useFloat } from '../motion';

/**
 * GlassObject — sahnede süzülen "cam" nesne (PNG).
 *
 * Girişte useEnter (scale/rotate/opacity), ardından sürekli süzülme + hafif
 * eğim (useFloat tilt) ve isteğe bağlı parıltı (useBreath, arka hale).
 * Görsel verilmezse yer tutucu bir kutu çizer — görsel sonradan eklenebilsin.
 *
 * "Işık süpürmesi" (700 ms, yalnız girişte) ayrı bir maske/gradient katmanı
 * gerektirir; bu gece expo-linear-gradient yok (yeni paket yasak), bu yüzden
 * burada süpürme UYGULANMADI — FOUNDATION raporundaki "eksikler"e yazıldı.
 *
 * Azaltılmış hareket: giriş opaklığa iner, süzülme/eğim döngüleri kapanır
 * (hook'lar kendileri halleder).
 */
export function GlassObject({
  source,
  size = 160,
  float = true,
  glow = true,
  style,
}: {
  source?: ImageSourcePropType;
  size?: number;
  float?: boolean;
  glow?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const enter = useEnter();
  const floatA = useFloat({ tilt: true });
  const breath = useBreath({ min: 0.15, max: 0.4 });

  return (
    <Animated.View style={[enter.style, float ? floatA.style : null, style]}>
      {glow ? (
        <Animated.View
          style={[
            styles.glow,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: t.color.accent,
              opacity: breath.style.opacity,
            },
          ]}
        />
      ) : null}
      {source ? (
        <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: size,
              height: size,
              borderRadius: t.radius.xl,
              borderColor: t.color.line,
              backgroundColor: t.color.surface,
            },
          ]}
        >
          <AppText variant="caption" tone="secondary">
            görsel yok
          </AppText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', alignSelf: 'center', top: '10%' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
