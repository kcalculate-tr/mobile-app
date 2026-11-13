// G43-S1 — Kayıt akışı paleti = uygulamanın STANDART token'ları (src/core/design/tokens.ts + theme.ts; finExtras
// yardımcı tonları). Akışa özel şeftali/zeytin degrade, ışık lekesi, cam yüzey ve #0D2617 yeşil zemin YOK.
// Açık: uygulama zemini + beyaz yüzey + ink metin + muted ikincil metin + ince ayraç. Koyu: Ana sayfa koyu ile aynı.
// Lime YALNIZ ana düğme dolgusu, seçili hâlin kenar/işareti ve ilerleme göstergesi.
import { useTheme } from '../../../core/design/ThemeProvider';
import { themes } from '../../../core/design/theme';
import { palette } from '../../../core/design/tokens';

export interface KPalette {
  isDark: boolean;
  /** Ekran zemini (color.bg). */
  bg: string;
  /** Kart/satır yüzeyi (color.surface). */
  surface: string;
  /** Birincil metin/ikon (color.ink). */
  ink: string;
  /** İkincil metin (color.secondary). */
  sec: string;
  /** 1 px ayraç / kenar (color.line). */
  line: string;
  /** Daha belirgin kenar: boş radyo/onay kutusu, alan kenarı (finExtras.line2). */
  line2: string;
  /** İlerleme/segment izi, devre dışı dolgu (finExtras.track). */
  track: string;
  /** Lime dolgu (ana düğme, ilerleme, seçili işaret). */
  accent: string;
  /** Lime üstündeki metin/ikon (siyah). */
  onAccent: string;
  /** Seçili hâlin 2 pt kenarı — ana paywall seçili kartıyla aynı (açıkta koyu lime, koyuda lime). */
  accentLine: string;
  disabled: string;
  disabledText: string;
  danger: string;
  dangerBg: string;
}

const L = themes.light.color;
const D = themes.dark.color;

export const K_LIGHT: KPalette = {
  isDark: false,
  bg: L.bg,
  surface: L.surface,
  ink: L.ink,
  sec: L.secondary,
  line: L.line,
  line2: '#C3C7CC',
  track: '#DCDEE2',
  accent: palette.lime,
  onAccent: palette.limeInk,
  accentLine: L.accentLine,
  disabled: '#DCDEE2',
  disabledText: L.secondary,
  danger: L.danger,
  dangerBg: 'rgba(229,72,77,0.08)',
};

export const K_DARK: KPalette = {
  isDark: true,
  bg: D.bg,
  surface: D.surface,
  ink: D.ink,
  sec: D.secondary,
  line: D.line,
  line2: '#48484A',
  track: '#2C2C2E',
  accent: palette.lime,
  onAccent: palette.limeInk,
  accentLine: D.accentLine,
  disabled: '#2C2C2E',
  disabledText: '#8E8E93',
  danger: D.danger,
  dangerBg: 'rgba(229,72,77,0.16)',
};

export function useK(): KPalette {
  const t = useTheme();
  return t.isDark ? K_DARK : K_LIGHT;
}

/**
 * Hareket (G43 sadeleştirme): yalnız standart yığın geçişi (native push / fade), ilerleme çubuğunun dolması,
 * seçimde hafif seçim titreşimi ve L1'de en çok 2 sn sade ilerleme. Azaltılmış harekette hepsi anlık.
 */
export const K_MOTION = {
  /** Yığın geçişi (fade) ve ilerleme çubuğu dolması. */
  fade: 220,
  /** L1 toplam süre (≤ 2 sn) / geri dönüşte cevap değiştiyse kısa sürüm. */
  calcFull: 1800,
  calcShort: 1200,
  /** Göz kırpma aralığı (4–6 sn; yalnız L1). */
  blinkMin: 4000,
  blinkMax: 6000,
  blinkHold: 140,
  /** T1 bandı kendiliğinden kalkar. */
  bannerHold: 4000,
  /** İptal bilgi kartı kendiliğinden kalkar. */
  infoHold: 6000,
} as const;
