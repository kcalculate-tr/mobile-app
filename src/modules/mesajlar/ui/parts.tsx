// G63-S1 — Mesajlar ortak parçaları: tasarım renkleri (FinInbox / FinChat / FinChatNew `t` nesneleri BİREBİR;
// lime = #B9EF14 uygulama jetonu — tasarımdaki eski açık lime jetona çevrildi), Phosphor ikon, kişi avatarı,
// rol etiketi, giriş solması (220 ms standard; azaltılmış harekette 220 ms doğrusal opaklık).
import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { RN_CURVE, DURATION, useReducedMotion, useTheme } from '../../../core/design';
import { DM_PATHS, type DmIconName } from './paths';
import type { DmPerson } from '../types';

export const LIME = '#B9EF14';
export const INK = '#0A0A0A';

export function dmPalette(isDark: boolean) {
  return isDark
    ? {
        bg: '#000000', text: '#F5F5F5', sec: '#A1A1A6', line: '#2C2C2E', line2: '#48484A', ph: '#2C2C2E', phGlyph: '#8E8E93',
        card: '#1C1C1E', field: '#1C1C1E', ink: '#F5F5F5', onInk: '#0A0A0A', dotRing: 'transparent', inLine: 'transparent',
        chip: '#2C2C2E', thumbBg: '#2C2C2E', group: 'rgba(58,58,60,0.55)', groupSolid: '#2C2C2E', red: '#FF6961',
        scrim: 'rgba(0,0,0,0.6)', glass: '#1C1C1E', switchOff: '#39393D',
        // FinChatNew (sayfa)
        newBg: '#1C1C1E', newPh: '#3A3A3C', newPhGlyph: '#98989D', newCard: '#2C2C2E', newChip: '#3A3A3C',
      }
    : {
        bg: '#F3F4F6', text: '#0A0A0A', sec: '#6B6B70', line: '#E9EBEE', line2: '#C3C7CC', ph: '#DCDEE2', phGlyph: '#8A8A90',
        card: '#FFFFFF', field: '#FFFFFF', ink: '#0A0A0A', onInk: '#FFFFFF', dotRing: '#4A6B00', inLine: '#E9EBEE',
        chip: '#E9EBEE', thumbBg: '#F3F4F6', group: 'rgba(255,255,255,0.9)', groupSolid: '#FFFFFF', red: '#D70015',
        scrim: 'rgba(10,10,10,0.4)', glass: '#FFFFFF', switchOff: '#E3E5E8',
        newBg: '#F3F4F6', newPh: '#DCDEE2', newPhGlyph: '#8A8A90', newCard: '#FFFFFF', newChip: '#E4E6EA',
      };
}
export type DmPalette = ReturnType<typeof dmPalette>;

export function useDmPalette(): DmPalette & { isDark: boolean } {
  const t = useTheme();
  return { ...dmPalette(t.isDark), isDark: t.isDark };
}

export function DmIcon({ name, size = 24, color }: { name: DmIconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={DM_PATHS[name]} fill={color} />
    </Svg>
  );
}

/** Kişi avatarı: foto varsa foto, yoksa tasarımdaki gri daire + kişi glifi. */
export function PersonAvatar({ person, size, bg, glyph }: { person: Pick<DmPerson, 'avatar_url'> | null; size: number; bg: string; glyph: string }) {
  const r = size / 2;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {person?.avatar_url ? (
        <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size }} />
      ) : (
        <DmIcon name="user" size={Math.round(size * 0.46)} color={glyph} />
      )}
    </View>
  );
}

type Tr = (key: string, vars?: Record<string, string | number>) => string;
export function roleLabel(role: string | null | undefined, tr: Tr): string | null {
  if (role === 'diyetisyen' || role === 'pt' || role === 'kurum') return tr(`dm.role.${role}`);
  return null;
}

/** "Dyt. Ad" — diyetisyen ön eki tasarımdaki gibi (FinInbox `rd`). */
export function personName(p: DmPerson | null | undefined, lang: string): string {
  if (!p) return '';
  if (p.role === 'diyetisyen' && !/^(dyt\.?|dr\.?|rd)\s/i.test(p.display_name)) return lang === 'en' ? `RD ${p.display_name}` : `Dyt. ${p.display_name}`;
  return p.display_name;
}

/** İçerik değişiminde 220 ms solma (FinInbox `.fadeIn`, FinChat `.fade`). */
export function FadeIn({ children, style, deps = [] }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; deps?: unknown[] }) {
  const reduced = useReducedMotion();
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    o.setValue(0);
    Animated.timing(o, {
      toValue: 1,
      duration: DURATION.fast,
      easing: reduced ? RN_CURVE.linear : RN_CURVE.standard,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <Animated.View style={[{ opacity: o }, style]}>{children}</Animated.View>;
}

export const dmStyles = StyleSheet.create({
  icon44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
