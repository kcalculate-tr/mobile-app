// 🎨 Kcal Design System - Liquid Glass Aesthetic
// Apple Design Award Standartları

export const COLORS = {
  // Brand
  // MARKA YEŞİLİ — tek kaynak. Eylül 2026'da #B9EF14'ten daha doygun/neon
  // #B9EF14'e çekildi (referans: Mac sRGB ekran görüntüsü). Tüm UI bu
  // token'ları kullanır; koddaki düz hex'ler de aynı değere güncellendi.
  brand: {
    green: '#B9EF14',
    greenLight: '#D2F55E',
    greenBright: '#B9EF14',
    // Kayan kampanya bandı referansta yarım ton daha yeşil ölçüldü.
    greenTicker: '#BAF112',
  },
  
  // Neutrals
  black: '#000000',
  white: '#ffffff',
  background: '#f6f6f6',
  
  // Grays (8-step scale)
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  
  // Text
  text: {
    primary: '#000000',
    secondary: '#878787',
    tertiary: '#9d9d9d',
    disabled: '#c4c4c4',
    inverse: '#ffffff',
  },
  
  // Semantic
  success: '#4ade80',
  error: '#ef4444',
  warning: '#fbbf24',
  info: '#60a5fa',
  
  // Overlays (Glassmorphism)
  overlay: {
    dark: 'rgba(0,0,0,0.5)',
    light: 'rgba(255,255,255,0.1)',
    glass: 'rgba(255,255,255,0.15)',
  },
  
  // Borders
  border: {
    light: 'rgba(0,0,0,0.05)',
    medium: 'rgba(0,0,0,0.08)',
    strong: 'rgba(0,0,0,0.12)',
  },
} as const;

/**
 * Seçilebilir yüzeylerin PASİF hali.
 *
 * Eski dil gri dolgu (#f0f0f0 / #f5f5f5) + soluk yazı (text.secondary
 * #878787) idi. İki sorunu vardı:
 *   1. Kontrast 2.9:1 — WCAG AA eşiği 4.5:1'in altında.
 *   2. Seçenek "devre dışı" gibi okunuyordu. Oysa seçili olmayan bir
 *      seçenek devre dışı DEĞİL, sadece henüz seçilmemiş.
 *
 * Yeni dil: beyaz zemin + net kenarlık + tam güçte yazı. Gri yalnızca
 * GERÇEKTEN kullanılamayan yüzeylere (Kapalı, Dolu, Hemen yok) ayrıldı —
 * böylece gri tekrar anlam taşıyor.
 */
export const SURFACE = {
  unselectedBg: COLORS.white,
  unselectedBorder: 'rgba(0,0,0,0.12)',
  /** Beyaz üzerinde 10.4:1 */
  unselectedText: COLORS.gray[700],
  /** Açıklama/ikincil satır — beyaz üzerinde 5.7:1 */
  unselectedMutedText: COLORS.gray[500],
  disabledBg: COLORS.gray[100],
  disabledBorder: COLORS.border.medium,
  disabledText: COLORS.gray[400],
  inputBg: COLORS.white,
  inputBorder: 'rgba(0,0,0,0.12)',
} as const;

export const SPACING = {
  // Base 4px grid
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const RADIUS = {
  // Consistent border radius
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  pill: 100,
  circle: 9999,
} as const;

export const TYPOGRAPHY = {
  // Font sizes (type scale)
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 36,
  },
  
  // Font families
  fontFamily: {
    regular:   'PlusJakartaSans_400Regular',
    medium:    'PlusJakartaSans_500Medium',
    semibold:  'PlusJakartaSans_600SemiBold',
    bold:      'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
  },

  // Font weights
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;

export const SHADOWS = {
  // Elevation system
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

export const TOUCH = {
  // Minimum touch target (Apple HIG)
  minSize: 44,
  
  // Active opacity
  opacity: {
    light: 0.8,
    medium: 0.7,
    strong: 0.6,
  },
} as const;

export const ANIMATION = {
  // Timing
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  
  // Spring config
  spring: {
    damping: 15,
    stiffness: 150,
  },
} as const;
