import { useColorScheme } from 'react-native';
import { palette, space, radius, touch, stroke, elevation } from './tokens';

/**
 * Tema — açık/koyu eşlemesi.
 *
 * Ham palet `tokens.ts`'te; burada her tema için ANLAMSAL renk adlarını
 * (bg, surface, ink...) üretiriz. Ekranlar renk seçerken temaya değil role
 * bakar: `color.surface`, `color.ink`, `color.line`. Böylece aynı kod iki
 * temada da doğru çalışır.
 *
 * Kaynak: telefonun sistem ayarı (`useColorScheme`, Appearance API üzerinden).
 * Context GEREKMEZ; hook tek başına sistemi izler ve değişiminde yeniden
 * render eder. Yine de ileride "uygulama içi tema seçimi" eklenebilsin diye
 * `ThemeProvider`/`useTheme` arayüzünü de dışa veriyoruz (bkz. ThemeProvider.tsx).
 */

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  /** Ekranın en alt zemini. */
  bg: string;
  /** Kart/panel yüzeyi. */
  surface: string;
  /** Yüzeyin bir üstü — koyu temada hafif ayrışma için. */
  surfaceRaised: string;
  /** Birincil yazı/ikon. */
  ink: string;
  /** İkincil yazı. */
  secondary: string;
  /** Ayırıcı çizgi / kenarlık. */
  line: string;
  /** Vurgu dolgusu (lime). Üstüne her zaman `onAccent` yazılır. */
  accent: string;
  /** Vurgu dolgusunun üstündeki yazı (siyah). */
  onAccent: string;
  /** Lime aidiyeti olan ÇİZGİ/METİN (dolgu değil) — temaya göre okunaklı ton. */
  accentLine: string;
  /** Olumsuz durum rengi (animasyonsuz kullanılır). */
  danger: string;
  warning: string;
}

const lightColors: ThemeColors = {
  bg: palette.lightBg,
  surface: palette.lightSurface,
  surfaceRaised: palette.white,
  ink: palette.lightInk,
  secondary: palette.lightSecondary,
  line: palette.lightLine,
  accent: palette.lime,
  onAccent: palette.limeInk,
  accentLine: palette.limeLineOnLight,
  danger: palette.danger,
  warning: palette.warning,
};

const darkColors: ThemeColors = {
  bg: palette.darkBg,
  surface: palette.darkSurface,
  // Koyu temada gölge yerine yüzey tonuyla derinlik: raised biraz daha açık.
  surfaceRaised: '#2C2C2E',
  ink: palette.darkInk,
  secondary: palette.darkSecondary,
  line: palette.darkLine,
  accent: palette.lime,
  onAccent: palette.limeInk,
  // Koyu zeminde saf lime zaten okunur, çizgi için de onu kullanırız.
  accentLine: palette.lime,
  danger: palette.danger,
  warning: palette.warning,
};

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  color: ThemeColors;
  space: typeof space;
  radius: typeof radius;
  touch: typeof touch;
  stroke: typeof stroke;
  elevation: typeof elevation;
}

export function buildTheme(scheme: ColorScheme): Theme {
  const isDark = scheme === 'dark';
  return {
    scheme,
    isDark,
    color: isDark ? darkColors : lightColors,
    space,
    radius,
    touch,
    stroke,
    // Koyu temada gölgeler görünmez; yine de API aynı kalsın diye paylaşıyoruz.
    elevation,
  };
}

export const themes = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
} as const;

/**
 * Sistemin açık/koyu ayarını izleyen düşük seviye hook.
 * `ThemeProvider` bunu sarmalar; provider olmadan da çalışır.
 */
export function useSystemTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? themes.dark : themes.light;
}
