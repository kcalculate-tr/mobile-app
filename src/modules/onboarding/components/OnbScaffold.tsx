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
  children,
}: {
  /** Süzülen cam nesne görseli (require(...)). */
  glass?: ImageSourcePropType;
  /** Lime ışığın dikey merkez oranı (0 üst, 1 alt). Varsayılan 0.3. */
  glowY?: number;
  /** Sağ üstte eylem (ör. "Atla"). */
  topRight?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const float = useFloat({ amplitude: 6 });
  const cy = H * (glowY ?? 0.3);
  const base = Math.max(W, H);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Bulanık lime ışık — üç sönen daire */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {GLOW_LAYERS.map((layer) => {
          const size = base * layer.scale;
          return (
            <View
              key={layer.scale}
              style={{
                position: 'absolute',
                left: W / 2 - size / 2,
                top: cy - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: '#C6F04F',
                opacity: layer.opacity,
              }}
            />
          );
        })}
      </View>

      {/* Süzülen cam nesne */}
      {glass ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glassWrap,
            { top: cy - base * 0.18, left: W / 2 - base * 0.22 },
            float.style,
          ]}
        >
          <Image source={glass} style={{ width: base * 0.44, height: base * 0.44 }} resizeMode="contain" />
        </Animated.View>
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

const GLOW_LAYERS = [
  { scale: 1.1, opacity: 0.1 },
  { scale: 0.72, opacity: 0.14 },
  { scale: 0.4, opacity: 0.22 },
] as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  glassWrap: { position: 'absolute' },
  content: { flex: 1, paddingHorizontal: 24 },
  topRight: { position: 'absolute', right: 20, zIndex: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  topRightLabel: { color: 'rgba(245,245,245,0.75)' },
});
