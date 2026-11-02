import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { useBreath } from '../motion';

/**
 * GlowDot — nefes alan lime nokta. Uygulamanın "yükleniyor" göstergesi.
 *
 * Nefes = opacity 0.5→0.9 döngüsü (useBreath). Azaltılmışta sabit durur
 * (useBreath zaten azaltılmışta döngüyü kapatır).
 *
 * Kullanım notu: yalnız 400 ms'yi aşan beklemelerde göster (bkz.
 * motion.useDelayedPending) — kısa beklemede titreme yaratmasın.
 */
export function GlowDot({
  size = 12,
  color,
  style,
}: {
  size?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const breath = useBreath();
  const dotColor = color ?? t.color.accent;

  return (
    <View style={[styles.wrap, style]} accessibilityRole="progressbar" accessibilityLabel="Yükleniyor">
      {/* Dış hale — aynı nefesle, daha büyük ve soluk. */}
      <Animated.View
        style={[
          styles.halo,
          {
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: dotColor,
          },
          breath.style,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dotColor,
          },
          breath.style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', opacity: 0.2 },
});
