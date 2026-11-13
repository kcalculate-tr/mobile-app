// G18-S1 — FinHomeR3 `tokens(th)` (Light + Dark) birebir; profil kartı, boş hâl ve
// "Profil hazır" sahnesi bu paletle çizilir (Ana sayfa yüzeyleriyle aynı renkler).
import { useTheme } from '../../../core/design/ThemeProvider';
import { palette } from '../../../core/design/tokens';

export interface HomeTokens {
  isDark: boolean;
  bg: string;
  card: string;
  line: string;
  line2: string;
  text: string;
  sec: string;
  ink: string;
  onInk: string;
  ph: string;
  phText: string;
  track: string;
  limeLine: string;
}

export const HOME_LIGHT: HomeTokens = {
  isDark: false,
  bg: '#F3F4F6',
  card: '#FFFFFF',
  line: '#E9EBEE',
  line2: '#C3C7CC',
  text: '#0A0A0A',
  sec: '#6B6B70',
  ink: '#0A0A0A',
  onInk: '#FFFFFF',
  ph: '#DCDEE2',
  phText: '#45454A',
  track: '#E3E5E9',
  limeLine: '#4A6B00',
};

export const HOME_DARK: HomeTokens = {
  isDark: true,
  bg: '#000000',
  card: '#1C1C1E',
  line: '#2C2C2E',
  line2: '#48484A',
  text: '#F5F5F5',
  sec: '#A1A1A6',
  ink: '#F5F5F5',
  onInk: '#0A0A0A',
  ph: '#3A3A3C',
  phText: '#C7C7CC',
  track: '#2C2C2E',
  limeLine: palette.lime,
};

export function useHomeTokens(): HomeTokens {
  return useTheme().isDark ? HOME_DARK : HOME_LIGHT;
}

export const LIME = palette.lime;
export const LIME_INK = '#0A0A0A';
export const BRICOLAGE_SEMI = 'BricolageGrotesque_600SemiBold';
export const BRICOLAGE_BOLD = 'BricolageGrotesque_700Bold';
