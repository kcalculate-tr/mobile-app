import React, { useEffect } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { CURVE, TIMING, useBreath, useEnter, useFloat, useReducedMotion } from '../motion';

/**
 * GlassObject — sahnede süzülen "cam" nesne (PNG).
 *
 * Girişte useEnter (scale/rotate/opacity), ardından sürekli süzülme + hafif
 * eğim (useFloat tilt) ve arka parıltı halesi (useBreath).
 *
 * ✅ IŞIK SÜPÜRMESİ (G3-S3, item 5): girişte bir kez, TIMING.sweep (700 ms)
 * içinde nesnenin üstünden geçen eğik bir ışık bandı (expo-linear-gradient
 * maske). Band `overflow:hidden` kutu içinde UI thread'de (worklet) kayar.
 * ✅ İÇ PARILTI (item 5): nesnenin üstünde sabit, yumuşak diagonal cam sheen'i
 * (üst-sol aydınlık → şeffaf), temadan bağımsız beyaz, düşük opaklık.
 *
 * Azaltılmış hareket: giriş opaklığa iner, süzülme/eğim döngüleri kapanır
 * (hook'lar halleder), ışık süpürmesi hiç oynamaz (tek statik sheen kalır).
 *
 * Görsel verilmezse yer tutucu bir kutu çizer — görsel sonradan eklenebilsin.
 * `replayKey` değişince bileşen yeniden kurulur (giriş + süpürme tekrar oynar);
 * vitrindeki "Tekrar" düğmesi bunu kullanır.
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
  const reduced = useReducedMotion();
  const enter = useEnter();
  const floatA = useFloat({ tilt: true });
  const breath = useBreath({ min: 0.15, max: 0.4 });

  // Işık süpürmesi: 0→1, girişten hemen sonra bir kez.
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      sweep.value = 0;
      return;
    }
    sweep.value = 0;
    sweep.value = withDelay(
      TIMING.enter - 200,
      withTiming(1, { duration: TIMING.sweep, easing: CURVE.move }),
    );
  }, [reduced, sweep]);

  const sweepStyle = useAnimatedStyle(() => {
    // Band nesnenin solundan sağına geçer; ortada en parlak.
    const translateX = interpolate(sweep.value, [0, 1], [-size * 1.2, size * 1.2]);
    const opacity = interpolate(sweep.value, [0, 0.15, 0.5, 0.85, 1], [0, 0.9, 0.9, 0.9, 0]);
    return { transform: [{ translateX }, { rotate: '18deg' }], opacity };
  });

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
            },
            breath.style,
          ]}
        />
      ) : null}

      <View
        style={[
          styles.clip,
          {
            width: size,
            height: size,
            borderRadius: source ? t.radius.lg : t.radius.xl,
          },
        ]}
      >
        {source ? (
          <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
        ) : (
          <View
            style={[
              styles.placeholder,
              {
                width: size,
                height: size,
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

        {/* İç parıltı (sabit cam sheen'i): üst-sol aydınlık → şeffaf. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Işık süpürmesi bandı (girişte bir kez geçer). */}
        <Animated.View style={[styles.sweepWrap, { width: size * 0.5, height: size * 2 }, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', alignSelf: 'center', top: '10%' },
  clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 28,
  },
  sweepWrap: { position: 'absolute', top: '-50%', left: 0 },
});
