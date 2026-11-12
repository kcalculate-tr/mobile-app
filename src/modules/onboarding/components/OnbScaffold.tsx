import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useEnter, useFloat } from '../../../core/design/motion';
import { useOnb } from './onbTheme';

/** Final panolarının tasarım genişliği (iPhone 393×852); ölçüler buna göre ölçeklenir. */
const DESIGN_W = 393;

/** Süzülen cam nesne — Final panosundaki konum/boyut (393 koordinatı). */
export interface OnbGlass {
  source: ImageSourcePropType;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Onboarding + Takibe başla zemini (FinOnb* / FinTb*): temaya bağlı zemin,
 * iki bulanık lime ışık (Final'deki glA/glB), geri oku + sayfa noktaları + "Atla",
 * yarı saydam kart (üstte içerik, altta düğmeler) ve kartın üstünde süzülen cam
 * nesne. Cam nesne `useFloat` ile nazikçe süzülür (azaltılmışta sabit).
 * Light + Dark aynı kodla (G15-S1).
 */
export function OnbScaffold({
  glass,
  glow = true,
  cardTop,
  onBack,
  dots,
  caption,
  topRight,
  footer,
  scroll = false,
  contentStyle,
  cardPad = [36, 20, 20],
  children,
}: {
  glass?: OnbGlass;
  /** Bulanık lime ışık (Underage'de kapalı). */
  glow?: boolean;
  /** Kartın üst kenarı (393 tasarım koordinatı). */
  cardTop: number;
  onBack?: () => void;
  /** Üstte sayfa noktaları — { count, index }. */
  dots?: { count: number; index: number };
  /** Noktaların üstünde küçük başlık (Takibe başla). */
  caption?: string;
  /** Sağ üstte eylem (ör. "Atla"). */
  topRight?: { label: string; onPress: () => void };
  /** Kartın altına sabit düğmeler. */
  footer?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Kart iç boşluğu [üst, yan, alt] — Final panoları: çoğu 36/20/20, Karşılama 28, Sonuç 24, Seni tanıyalım 30/18/18. */
  cardPad?: [number, number, number];
  children: React.ReactNode;
}) {
  const P = useOnb();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const s = W / DESIGN_W;
  const float = useFloat({ amplitude: 6 });
  const enter = useEnter();
  const barTop = insets.top + 3;
  const Body = scroll ? ScrollView : View;

  return (
    <View style={[styles.root, { backgroundColor: P.bg }]}>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />

      {/* İki yumuşak lime ışık: Final glA (sol üst) + glB (sağ alt). */}
      {glow ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={W} height={H}>
            <Defs>
              <RadialGradient id="glA" cx={90 * s} cy={170 * s} rx={300 * s} ry={300 * s} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#C6F04F" stopOpacity={P.glowA} />
                <Stop offset="0.45" stopColor="#C6F04F" stopOpacity={P.glowA * 0.6} />
                <Stop offset="1" stopColor="#C6F04F" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="glB" cx={330 * s} cy={630 * s} rx={290 * s} ry={290 * s} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#C6F04F" stopOpacity={P.glowB} />
                <Stop offset="0.45" stopColor="#C6F04F" stopOpacity={P.glowB * 0.6} />
                <Stop offset="1" stopColor="#C6F04F" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill="url(#glA)" />
            <Rect x={0} y={0} width={W} height={H} fill="url(#glB)" />
          </Svg>
        </View>
      ) : null}

      {/* Üst çubuk: geri · (başlık +) noktalar · Atla */}
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Geri"
          style={[styles.back, { top: barTop }]}
          hitSlop={8}
        >
          <Svg width={24} height={24} viewBox="0 0 256 256">
            <Path
              fill={P.ink}
              d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"
            />
          </Svg>
        </Pressable>
      ) : null}
      {dots ? (
        <View
          style={[styles.dotsBox, { top: barTop }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {caption ? (
            <AppText textRole="helper" style={{ color: P.sec, fontSize: 13, lineHeight: 16 }}>
              {caption}
            </AppText>
          ) : null}
          <View style={styles.dotsRow}>
            {Array.from({ length: dots.count }).map((_, i) => {
              const done = i <= dots.index;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: done ? P.dot : P.dotOff },
                    i === dots.index ? styles.dotActive : null,
                  ]}
                />
              );
            })}
          </View>
        </View>
      ) : null}
      {topRight ? (
        <Pressable
          onPress={topRight.onPress}
          style={[styles.topRight, { top: barTop }]}
          hitSlop={8}
          accessibilityRole="button"
        >
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '600' }}>
            {topRight.label}
          </AppText>
        </Pressable>
      ) : null}

      {/* Kart */}
      <Animated.View
        style={[
          styles.card,
          { top: cardTop * s, backgroundColor: P.card, borderColor: P.cardEdge, paddingTop: cardPad[0], paddingHorizontal: cardPad[1], paddingBottom: cardPad[2] },
          enter.style,
        ]}
      >
        <Body
          style={styles.body}
          {...(scroll
            ? { contentContainerStyle: [{ paddingBottom: 16 }, contentStyle], ...SCROLL_KEYBOARD, showsVerticalScrollIndicator: false }
            : {})}
        >
          {scroll ? children : <View style={[{ flex: 1 }, contentStyle]}>{children}</View>}
        </Body>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>

      {/* Süzülen cam nesne (kartın üstünde) */}
      {glass ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glass,
            { left: glass.x * s, top: glass.y * s, width: glass.w * s, height: glass.h * s },
            float.style,
          ]}
        >
          <Image source={glass.source} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { position: 'absolute', left: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  dotsBox: { position: 'absolute', left: 0, right: 0, height: 44, alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 5 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 22 },
  topRight: { position: 'absolute', right: 8, height: 44, paddingHorizontal: 10, justifyContent: 'center', zIndex: 6 },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 32,
    borderWidth: 1,
    zIndex: 2,
  },
  body: { flex: 1 },
  footer: { paddingTop: 12 },
  glass: { position: 'absolute', zIndex: 3 },
});
