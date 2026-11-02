/**
 * Tasarım temeli — ham token'lar (TEK KAYNAK).
 *
 * Bu dosya yeni tasarım dilinin değişmez değerlerini tutar. Hiçbir ekran bu
 * değerleri kendi içinde kopyalamaz; her şey buradan okunur. Böylece hareket
 * ve renk dili hâlâ TEST aşamasındayken tek bir yerden ayarlanabilir.
 *
 * ÖNEMLİ: Bu dosya mevcut `src/constants/theme.ts`'in YERİNE geçmez; onun
 * yanında, yeni tasarım için ayrı bir temeldir. Üretim ekranları hâlâ eski
 * token'ları kullanır. Geçiş kararı İlter'de.
 *
 * Renkler ekrana göre değil TEMAYA göre seçilir: ham paleti burada tanımlarız,
 * açık/koyu eşlemesini `theme.ts` yapar. Ekranlar doğrudan hex KULLANMAZ,
 * `useTheme().color.*` okur.
 */

/** Ham renk paleti. Hiçbir ekran bunu doğrudan okumamalı — theme üzerinden gelir. */
export const palette = {
  // Açık tema nötrleri
  lightBg: '#F3F4F6',
  lightSurface: '#FFFFFF',
  lightInk: '#0A0A0A',
  lightSecondary: '#6B6B70',
  lightLine: '#E9EBEE',

  // Koyu tema nötrleri
  darkBg: '#000000',
  darkSurface: '#1C1C1E',
  darkInk: '#F5F5F5',
  darkSecondary: '#A1A1A6',
  darkLine: '#2C2C2E',

  // Vurgu — lime YALNIZCA dolgu olarak kullanılır, üstündeki yazı her zaman siyah.
  lime: '#C6F04F',
  /** Lime'ın üstündeki yazı/ikon rengi — her iki temada da siyah. */
  limeInk: '#0A0A0A',
  /**
   * Açık zeminde lime bir ÇİZGİ/METİN gerektiğinde (lime dolgu değil, lime
   * aidiyeti olan ince çizgi) kullanılacak koyu lime. Saf lime açık zeminde
   * okunmaz; bu aile tonu okunur.
   */
  limeLineOnLight: '#4A6B00',

  // Mutlaklar
  black: '#000000',
  white: '#FFFFFF',

  // Anlamsal — olumlu/bilgi için. Not: koreografi kuralı gereği HATA renkleri
  // animasyonsuz ve sarsıntısız kullanılır; burada yalnızca renk değeri var.
  danger: '#E5484D',
  warning: '#F2A900',
} as const;

/** 4pt tabanlı boşluk ölçeği. */
export const space = {
  none: 0,
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

/** Köşe yarıçapları. `pill` tam yuvarlak uçlu, `circle` daire. */
export const radius = {
  none: 0,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
  circle: 9999,
} as const;

/** Dokunma hedefi ve dokunma geri bildirimi. */
export const touch = {
  /** Apple HIG + Material: en küçük dokunulabilir alan. */
  minTarget: 44,
  activeOpacity: 0.85,
} as const;

/** Kenar/çizgi kalınlıkları (hairline dahil). */
export const stroke = {
  hairline: 1,
  regular: 1.5,
  bold: 2,
} as const;

/**
 * Yükseklik (gölge) — açık temada kullanılır. Koyu temada gölge yerine yüzey
 * tonu farkıyla derinlik verilir (theme.ts bunu ayarlar), bu yüzden gölge
 * değerleri yalnızca referans.
 */
export const elevation = {
  none: {
    shadowColor: palette.black,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sm: {
    shadowColor: palette.black,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  md: {
    shadowColor: palette.black,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export type Space = keyof typeof space;
export type Radius = keyof typeof radius;
