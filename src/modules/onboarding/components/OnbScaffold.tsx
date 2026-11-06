import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { useFloat } from '../../../core/design/motion';

/**
 * Onboarding zemini (FinOnb*): koyu zemin + bulanık lime ışık + (isteğe bağlı)
 * süzülen cam nesne. "Bulanık lime ışık" üç iç içe, gittikçe sönen lime daireyle
 * yaklaşıklanır (RN'de ucuz ve güvenilir yumuşak parıltı). Cam nesne S3'ten
 * gelen görsellerden biridir (bowl/drop/flame/foot/trophy) ve `useFloat` ile
 * nazikçe süzülür (azaltılmışta sabit durur).
 */
export function OnbScaffold({
  glass,
  glowY,
  topRight,
  dots,
  children,
}: {
  /** Süzülen cam nesne görseli (require(...)). */
  glass?: ImageSourcePropType;
  /** Lime ışığın dikey merkez oranı (0 üst, 1 alt). Varsayılan 0.3. */
  glowY?: number;
  /** Sağ üstte eylem (ör. "Atla"). */
  topRight?: { label: string; onPress: () => void };
  /** G14-S1 (FinOnb*): üstte sayfa noktaları — { count, index }. */
  dots?: { count: number; index: number };
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const float = useFloat({ amplitude: 6 });
  const cy = H * (glowY ?? 0.3);
  const glassSize = W * 0.66;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* G14-S1 — Final: yumuşak radyal lime ışık (sert iç içe daireler "dev yeşil
          daire" gibi görünüyordu) + ekran genişliğine oranlı cam nesne. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="onbGlow" cx={W / 2} cy={cy} rx={W * 0.95} ry={W * 0.95} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#C6F04F" stopOpacity={0.3} />
              <Stop offset="0.45" stopColor="#C6F04F" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#C6F04F" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="url(#onbGlow)" />
        </Svg>
      </View>

      {/* Süzülen cam nesne */}
      {glass ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glassWrap,
            { top: cy - glassSize * 0.5, left: W / 2 - glassSize / 2 },
            float.style,
          ]}
        >
          <Image source={glass} style={{ width: glassSize, height: glassSize }} resizeMode="contain" />
        </Animated.View>
      ) : null}

      {dots ? (
        <View style={[styles.dots, { top: insets.top + 12 }]} accessibilityElementsHidden>
          {Array.from({ length: dots.count }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === dots.index ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>
      ) : null}

      {topRight ? (
        <Pressable
          onPress={topRight.onPress}
          style={[styles.topRight, { top: insets.top + 8 }]}
          hitSlop={12}
          accessibilityRole="button"
        >
          <AppText textRole="bodySm" style={styles.topRightLabel}>
            {topRight.label}
          </AppText>
        </Pressable>
      ) : null}

      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  glassWrap: { position: 'absolute' },
  content: { flex: 1, paddingHorizontal: 24 },
  topRight: { position: 'absolute', right: 20, zIndex: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  topRightLabel: { color: 'rgba(245,245,245,0.75)' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, zIndex: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(245,245,245,0.35)' },
  dotActive: { width: 22, backgroundColor: '#F5F5F5' },
});
