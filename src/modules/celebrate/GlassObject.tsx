import React, { useEffect } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CURVE, TIMING, useBreath, useEnter, useFloat, useReducedMotion } from '../../core/design';

/**
 * Kutlama modulunun cam nesnesi (FinMoGlass). Core'daki GlassObject REFERANS
 * alinarak bu modulde yeniden kuruldu (tasarim buradaki bir tik daha
 * "kutlama" odakli: pop + lime hale her zaman mevcut).
 *
 * Hareket katmanlari:
 *  - goIn  : giris — scale .85->1, rotate -6->0, opacity 0->1, 500 ms overshoot (useEnter).
 *  - goPop : giristen sonra BIR kez — scale 1->1.08->1, 360 ms.
 *  - goFloat: surekli ±4 px Y, 3200 ms (useFloat).
 *  - goTilt : surekli ±2°, 4800 ms, bottom origin (useFloat tilt).
 *  - goGlow : lime radial nefes halesi, 2400 ms (useBreath).
 *  - sweep  : giriste bir kez capraz isik bandi, 700 ms.
 *
 * AZALTILMIS HAREKET: giris yalniz opaklik fade; pop/float/tilt/sweep yok;
 * hale sabit (useBreath azaltilmista sabit max opaklikta durur).
 *
 * !!! EKRAN BASINA BIR, LISTEDE ASLA: Bu bilesen en fazla ekran basina bir kez
 * render edilmeli ve HICBIR zaman FlatList/liste ici kullanilmamalidir
 * (surekli donguler + hale her ornek icin maliyetlidir ve kutlama "tekil an"dir).
 *
 * `replayKey` degisince (parent remount ile) giris + pop + sweep tekrar oynar.
 */

const SOURCES: Record<'bowl' | 'drop' | 'flame' | 'foot' | 'trophy', ImageSourcePropType> = {
  bowl: require('../../../assets/glass/bowl.png'),
  drop: require('../../../assets/glass/drop.png'),
  flame: require('../../../assets/glass/flame.png'),
  foot: require('../../../assets/glass/foot.png'),
  trophy: require('../../../assets/glass/trophy.png'),
};

export function GlassObject({
  name,
  size = 160,
  glow = true,
  pop = false,
  style,
  replayKey,
}: {
  name: 'bowl' | 'drop' | 'flame' | 'foot' | 'trophy';
  size?: number;
  glow?: boolean;
  pop?: boolean;
  style?: ViewStyle;
  /** Degisince giris+pop+sweep tekrar oynar (vitrin "Tekrar" / yeniden kutlama). */
  replayKey?: number;
}) {
  const reduced = useReducedMotion();
  const enter = useEnter();
  const floatA = useFloat({ tilt: true });
  const breath = useBreath({ min: 0.14, max: 0.4 });
  const source = SOURCES[name];

  // Pop: giristen sonra bir kez (TIMING.enter sonrasi). Azaltilmista atlanir.
  const popS = useSharedValue(1);
  useEffect(() => {
    if (!pop || reduced) {
      popS.value = 1;
      return;
    }
    popS.value = 1;
    popS.value = withDelay(
      TIMING.enter,
      withSequence(
        withTiming(1.08, { duration: TIMING.pop / 2, easing: CURVE.out }),
        withTiming(1, { duration: TIMING.pop / 2, easing: CURVE.in }),
      ),
    );
  }, [pop, reduced, popS, replayKey]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: popS.value }] }));

  // Isik supurmesi: giris biterken bir kez capraz gecer. Azaltilmista hic.
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
  }, [reduced, sweep, replayKey]);

  const sweepStyle = useAnimatedStyle(() => {
    const translateX = interpolate(sweep.value, [0, 1], [-size * 1.2, size * 1.2]);
    const opacity = interpolate(sweep.value, [0, 0.15, 0.5, 0.85, 1], [0, 0.9, 0.9, 0.9, 0]);
    return { transform: [{ translateX }, { rotate: '18deg' }], opacity };
  });

  return (
    <Animated.View
      // Eğim bottom origin'li dönsün: float tilt alt kenardan kavrar.
      style={[{ transformOrigin: 'bottom' }, enter.style, reduced ? null : floatA.style, popStyle, style]}
    >
      {glow ? (
        <Animated.View
          style={[
            styles.glow,
            { width: size, height: size, borderRadius: size / 2 },
            breath.style,
          ]}
          pointerEvents="none"
        />
      ) : null}

      <View style={[styles.clip, { width: size, height: size, borderRadius: size * 0.18 }]}>
        <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />

        {/* Sabit cam sheen'i: ust-sol aydinlik -> seffaf. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Isik supurmesi bandi (giriste bir kez). */}
        <Animated.View
          style={[styles.sweepWrap, { width: size * 0.5, height: size * 2 }, sweepStyle]}
          pointerEvents="none"
        >
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
  // Lime hale — kutlama vurgusu (tema'dan bagimsiz sabit tasarim rengi).
  glow: { position: 'absolute', alignSelf: 'center', top: '10%', backgroundColor: '#C6F04F' },
  clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sweepWrap: { position: 'absolute', top: '-50%', left: 0 },
});
