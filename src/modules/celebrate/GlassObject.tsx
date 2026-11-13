import React, { useEffect } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CURVE, DURATION, SPRING, TIMING, useBreath, useEnter, useFloat, useReducedMotion } from '../../core/design';
import { palette } from '../../core/design/tokens';

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
  const breath = useBreath({ min: 0.14, max: 0.4, loop: false });
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
        withTiming(1.08, { duration: DURATION.instant, easing: CURVE.standard }),
        withSpring(1, SPRING.bouncy),
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
      DURATION.base, // girişin son fast 200 diliminde başlar
      withTiming(1, { duration: DURATION.slow, easing: CURVE.standard }),
    );
  }, [reduced, sweep, replayKey]);

  // Işık süpürmesi — Final'de nesne şekliyle maskeli (mask-image). Maske
  // paketi kullanılmıyor: görselin kendi alfa kanalı (tintColor beyaz) ile
  // kısa parlama → ışık YALNIZ nesnenin üstünde; zemin (koyu tema) etkilenmez.
  // (Önce kare kırpma + kare sheen koyu temada nesnenin arkasında gri kare
  // gösteriyordu — FinHomeEmptyR1-Dark.)
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.4, 1], [0, 0.32, 0]),
  }));

  return (
    <Animated.View
      // Eğim bottom origin'li dönsün: float tilt alt kenardan kavrar.
      style={[{ transformOrigin: 'bottom' }, enter.style, reduced ? null : floatA.style, popStyle, style]}
    >
      {glow ? (
        <View pointerEvents="none" style={[styles.glowWrap, { width: size, height: size }]}>
          <Animated.View
            style={[styles.glow, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35 }, breath.style]}
          />
        </View>
      ) : null}

      <View style={[styles.clip, { width: size, height: size }]}>
        <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
        <Animated.Image
          source={source}
          resizeMode="contain"
          style={[StyleSheet.absoluteFill, { width: size, height: size, tintColor: '#FFFFFF' }, sweepStyle]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Lime hale — kutlama vurgusu (tema'dan bağımsız sabit tasarım rengi). Final
  // go-glow bulanık radyal; RN'de bulanıklık yok → küçük + düşük opaklık.
  glowWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center', opacity: 0.45 },
  glow: { backgroundColor: palette.lime },
  clip: { alignItems: 'center', justifyContent: 'center' },
});
