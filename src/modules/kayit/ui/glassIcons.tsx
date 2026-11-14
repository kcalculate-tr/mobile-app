// G49-S1 md.5 — Kayıt akışı cam ikonları (docs/tur28/cam-ikonlar, 22 × 192 px şeffaf PNG + `_sel` beyaz buzlu cam).
// Seçilmemiş kartta normal PNG, seçili (lime dolgu) kartta `_sel`; 150 ms çapraz geçiş (K_MOTION.iconCross, standart
// eğri yaklaşığı; azaltılmış harekette anlık). Arkada daire/zemin YOK (G45). Açık ve koyu temada aynı PNG.
// Yalnız kayıt soruları (P1 · P2 · P8 · P10 · P13 · P14); onboarding 1–5 ve kayıt dışı ekranlar kullanmaz.
import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { K_MOTION } from './theme';
import { useSelectTween } from './motion';

export const KAYIT_GLASS = {
  down: { normal: require('../../../../assets/kayit/icons/down.png'), selected: require('../../../../assets/kayit/icons/down_sel.png') },
  eq: { normal: require('../../../../assets/kayit/icons/eq.png'), selected: require('../../../../assets/kayit/icons/eq_sel.png') },
  up: { normal: require('../../../../assets/kayit/icons/up.png'), selected: require('../../../../assets/kayit/icons/up_sel.png') },
  bell: { normal: require('../../../../assets/kayit/icons/bell.png'), selected: require('../../../../assets/kayit/icons/bell_sel.png') },
  apple: { normal: require('../../../../assets/kayit/icons/apple.png'), selected: require('../../../../assets/kayit/icons/apple_sel.png') },
  venus: { normal: require('../../../../assets/kayit/icons/venus.png'), selected: require('../../../../assets/kayit/icons/venus_sel.png') },
  mars: { normal: require('../../../../assets/kayit/icons/mars.png'), selected: require('../../../../assets/kayit/icons/mars_sel.png') },
  desk: { normal: require('../../../../assets/kayit/icons/desk.png'), selected: require('../../../../assets/kayit/icons/desk_sel.png') },
  walk: { normal: require('../../../../assets/kayit/icons/walk.png'), selected: require('../../../../assets/kayit/icons/walk_sel.png') },
  stand: { normal: require('../../../../assets/kayit/icons/stand.png'), selected: require('../../../../assets/kayit/icons/stand_sel.png') },
  bolt: { normal: require('../../../../assets/kayit/icons/bolt.png'), selected: require('../../../../assets/kayit/icons/bolt_sel.png') },
  omni: { normal: require('../../../../assets/kayit/icons/omni.png'), selected: require('../../../../assets/kayit/icons/omni_sel.png') },
  sprout: { normal: require('../../../../assets/kayit/icons/sprout.png'), selected: require('../../../../assets/kayit/icons/sprout_sel.png') },
  leaf: { normal: require('../../../../assets/kayit/icons/leaf.png'), selected: require('../../../../assets/kayit/icons/leaf_sel.png') },
  fish: { normal: require('../../../../assets/kayit/icons/fish.png'), selected: require('../../../../assets/kayit/icons/fish_sel.png') },
  pan: { normal: require('../../../../assets/kayit/icons/pan.png'), selected: require('../../../../assets/kayit/icons/pan_sel.png') },
  clock: { normal: require('../../../../assets/kayit/icons/clock.png'), selected: require('../../../../assets/kayit/icons/clock_sel.png') },
  bag: { normal: require('../../../../assets/kayit/icons/bag.png'), selected: require('../../../../assets/kayit/icons/bag_sel.png') },
  moon: { normal: require('../../../../assets/kayit/icons/moon.png'), selected: require('../../../../assets/kayit/icons/moon_sel.png') },
  shop: { normal: require('../../../../assets/kayit/icons/shop.png'), selected: require('../../../../assets/kayit/icons/shop_sel.png') },
  glass: { normal: require('../../../../assets/kayit/icons/glass.png'), selected: require('../../../../assets/kayit/icons/glass_sel.png') },
  cake: { normal: require('../../../../assets/kayit/icons/cake.png'), selected: require('../../../../assets/kayit/icons/cake_sel.png') },
} satisfies Record<string, { normal: ImageSourcePropType; selected: ImageSourcePropType }>;

export type GlassName = keyof typeof KAYIT_GLASS;

// Dosya → seçenek eşlemesi (anlam tablosu `_anlam-tablosu.png`).
export const GOAL_GLASS = { lose: 'down', maintain: 'eq', gain: 'up', muscle: 'bell', balanced: 'apple' } as const satisfies Record<string, GlassName>;
export const GENDER_GLASS = { female: 'venus', male: 'mars' } as const satisfies Record<string, GlassName>;
export const ACT_GLASS = { sedentary: 'desk', light: 'walk', moderate: 'stand', active: 'bolt' } as const satisfies Record<string, GlassName>;
export const DIET_GLASS = { all: 'omni', vegetarian: 'sprout', vegan: 'leaf', pescatarian: 'fish' } as const satisfies Record<string, GlassName>;
export const COOK_GLASS = { daily: 'pan', sometimes: 'clock', ready: 'bag' } as const satisfies Record<string, GlassName>;
export const STRUGGLE_GLASS = { evening_snack: 'moon', eating_out: 'shop', no_time: 'glass', sweet: 'cake' } as const satisfies Record<string, GlassName>;

/** Kart tipine göre ikon boyutu (pt): 2×2 / geniş kart 44 · liste kartı 36 · hareket galerisi 52 · hap/çip 24. */
export const GLASS_SIZE = { tile: 44, option: 36, carousel: 52, chip: 24 } as const;

/** Normal ↔ seçili cam ikon; iki katman çapraz geçer (150 ms). */
export function GlassIcon({ name, selected, size, testID }: { name: GlassName; selected: boolean; size: number; testID?: string }) {
  const k = useSelectTween(selected, K_MOTION.iconCross);
  const src = KAYIT_GLASS[name];
  return (
    <View testID={testID} style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Image testID={testID ? `${testID}-normal` : undefined} source={src.normal} style={[styles.img, { width: size, height: size, opacity: 1 - k }]} resizeMode="contain" />
      <Image testID={testID ? `${testID}-sel` : undefined} source={src.selected} style={[styles.img, { width: size, height: size, opacity: k }]} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  img: { position: 'absolute', top: 0, left: 0 },
});
