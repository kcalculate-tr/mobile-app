// G59-S1 — Hikâye ekranlarının tasarım değerleri (docs/g59/design/FinStory*.dc.html `t` / `k` nesneleri birebir).
// Lime: tasarımdaki eski soluk lime yerine G40 tek marka yeşili `palette.lime` (repo kuralı); açık zeminde
// lime çizgi/metin `limeLineOnLight` (#4A6B00, tasarım `acc`).
import { palette } from '../../../core/design/tokens';
import type { StickerSkin } from '../types';

export const LIME = palette.lime;
export const LIME_INK = palette.limeInk;
export const WHITE = '#FFFFFF';
export const HEART = '#E5484D';

/** Medya üstü yüzen kontroller `.om` (Reduce Transparency: #1C1C1E). */
export const OM_BG = 'rgba(0,0,0,0.42)';
export const OM_SOLID = '#1C1C1E';

export interface StoryTheme {
  bg: string;
  card: string;
  text: string;
  sec: string;
  line: string;
  line2: string;
  ph: string;
  phIcon: string;
  chip: string;
  field: string;
  acc: string;
  scrim: string;
  edge: string;
  shadow: number;
  closeBg: string;
  danger: string;
  pill: string;
  seg: string;
  segOn: string;
  off: string;
  offFg: string;
  swOff: string;
  glass: string;
}

export function storyTheme(dark: boolean): StoryTheme {
  return dark
    ? {
        bg: '#000000', card: '#1C1C1E', text: '#F5F5F5', sec: '#A1A1A6', line: '#2C2C2E', line2: '#48484A',
        ph: '#3A3A3C', phIcon: '#8E8E93', chip: '#2C2C2E', field: 'rgba(118,118,128,0.24)', acc: LIME,
        scrim: 'rgba(0,0,0,0.55)', edge: 'rgba(255,255,255,0.14)', shadow: 0.4, closeBg: 'rgba(255,255,255,0.12)',
        danger: '#FF6961', pill: 'rgba(255,255,255,0.14)', seg: 'rgba(118,118,128,0.24)', segOn: '#636366',
        off: '#3A3A3C', offFg: '#8E8E93', swOff: '#48484A', glass: 'rgba(28,28,30,0.96)',
      }
    : {
        bg: '#F3F4F6', card: '#FFFFFF', text: '#0A0A0A', sec: '#6B6B70', line: '#E9EBEE', line2: '#C3C7CC',
        ph: '#DCDEE2', phIcon: '#6B6B70', chip: '#F3F4F6', field: 'rgba(118,118,128,0.12)', acc: palette.limeLineOnLight,
        scrim: 'rgba(10,10,10,0.32)', edge: 'rgba(255,255,255,0.9)', shadow: 0.1, closeBg: 'rgba(10,10,10,0.06)',
        danger: '#C62828', pill: 'rgba(10,10,10,0.08)', seg: 'rgba(118,118,128,0.12)', segOn: '#FFFFFF',
        off: '#E9EBEE', offFg: '#6B6B70', swOff: '#C3C7CC', glass: 'rgba(255,255,255,0.97)',
      };
}

/** Çıkartma görünümü (FinStorySticker `k`). Cam: rgba(20,20,22,0.58) + blur; Reduce Transparency → #1C1C1E. */
export interface SkinTokens {
  bg: string;
  text: string;
  sec: string;
  chip: string;
  track: string;
  acc: string;
  m2: string;
  m3: string;
  glass: boolean;
}
export function skinTokens(skin: StickerSkin, reduceTransparency = false): SkinTokens {
  if (skin === 'dark') {
    return { bg: '#1C1C1E', text: '#F5F5F5', sec: '#A1A1A6', chip: '#2C2C2E', track: '#3A3A3C', acc: LIME, m2: 'rgba(245,245,245,0.7)', m3: 'rgba(245,245,245,0.35)', glass: false };
  }
  if (skin === 'glass') {
    return {
      bg: reduceTransparency ? '#1C1C1E' : 'rgba(20,20,22,0.58)', text: '#FFFFFF', sec: 'rgba(255,255,255,0.82)', chip: 'rgba(255,255,255,0.16)',
      track: 'rgba(255,255,255,0.22)', acc: LIME, m2: 'rgba(255,255,255,0.75)', m3: 'rgba(255,255,255,0.4)', glass: !reduceTransparency,
    };
  }
  return { bg: '#FFFFFF', text: '#0A0A0A', sec: '#6B6B70', chip: '#F3F4F6', track: '#E9EBEE', acc: palette.limeLineOnLight, m2: 'rgba(10,10,10,0.6)', m3: 'rgba(10,10,10,0.28)', glass: false };
}

/** Tasarım tuvali: 393 × 699 (iPhone 15/16; tüm konumlar orana çevrilir). */
export const CANVAS_W = 393;
export const CANVAS_H = 699;
export const STICKER_SHADOW = { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 } as const;
