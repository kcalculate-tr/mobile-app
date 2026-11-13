import { useTheme } from '../../../core/design/ThemeProvider';
import { palette } from '../../../core/design/tokens';

/**
 * Onboarding + Takibe başla paleti (G15-S1). Final panolarındaki `T` nesnesi
 * (Light + Dark) birebir; ekranlar bu hook'la temaya bağlanır (eski sabit koyu
 * `ONB` sabiti yerine). Yalnız yeni bayrak yolunda kullanılır.
 */
export interface OnbPalette {
  isDark: boolean;
  bg: string;
  ink: string;
  onInk: string;
  sec: string;
  line: string;
  line2: string;
  track: string;
  /** Aktif sayfa noktası / hap. */
  dot: string;
  dotOff: string;
  card: string;
  cardEdge: string;
  chip: string;
  chipEdge: string;
  glowA: number;
  glowB: number;
  dis: string;
  disText: string;
  accent: string;
  onAccent: string;
  /** Seçili lime satırda ikinci metin / ikon dairesi. */
  accentSub: string;
  accentIcon: string;
}

export const ONB_LIGHT: OnbPalette = {
  isDark: false,
  bg: '#F3F4F6',
  ink: '#0A0A0A',
  onInk: '#FFFFFF',
  sec: '#6B6B70',
  line: '#E9EBEE',
  line2: '#C3C7CC',
  track: '#DCDEE2',
  dot: '#0A0A0A',
  dotOff: '#C3C7CC',
  card: 'rgba(255,255,255,0.58)',
  cardEdge: 'rgba(255,255,255,0.9)',
  chip: 'rgba(255,255,255,0.62)',
  chipEdge: 'rgba(10,10,10,0.06)',
  glowA: 0.28,
  glowB: 0.22,
  dis: '#DCDEE2',
  disText: '#6B6B70',
  accent: palette.lime,
  onAccent: '#0A0A0A',
  accentSub: 'rgba(10,10,10,0.72)',
  accentIcon: 'rgba(10,10,10,0.08)',
};

export const ONB_DARK: OnbPalette = {
  isDark: true,
  bg: '#000000',
  ink: '#F5F5F5',
  onInk: '#0A0A0A',
  sec: '#A1A1A6',
  line: '#2C2C2E',
  line2: '#48484A',
  track: '#2C2C2E',
  dot: '#F5F5F5',
  dotOff: '#48484A',
  card: 'rgba(28,28,30,0.55)',
  cardEdge: 'rgba(255,255,255,0.14)',
  chip: 'rgba(44,44,46,0.55)',
  chipEdge: 'rgba(255,255,255,0.10)',
  glowA: 0.38,
  glowB: 0.32,
  dis: '#2C2C2E',
  disText: '#8E8E93',
  accent: palette.lime,
  onAccent: '#0A0A0A',
  accentSub: 'rgba(10,10,10,0.72)',
  accentIcon: 'rgba(10,10,10,0.08)',
};

export function useOnb(): OnbPalette {
  return useTheme().isDark ? ONB_DARK : ONB_LIGHT;
}
