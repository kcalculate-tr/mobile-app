// G42-S1 — Kayıt akışı paleti (docs/tur27/kayit/ekranlar *-acik / *-koyu panolarından ölçüldü).
// Açık: şeftali → krem zemin, koyu yeşil yazı; Koyu: zeytin → orman yeşili zemin, beyaz yazı. Lime yalnız dolgu.
import { useTheme } from '../../../core/design/ThemeProvider';
import { palette } from '../../../core/design/tokens';

export interface KPalette {
  isDark: boolean;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  blobA: string;
  blobB: string;
  ink: string;
  sec: string;
  card: string;
  cardEdge: string;
  bubble: string;
  bubbleEdge: string;
  circle: string;
  ringTrack: string;
  ringFill: string;
  accent: string;
  onAccent: string;
  /** G44: tam lime dolgulu seçili öğenin üstündeki ikon/metin (tokens.palette.limeInk, her temada siyah). */
  limeInk: string;
  /** limeInk'in ikincil metin tonu (seçili kart alt satırı). */
  limeInkSec: string;
  accentSoft: string;
  disabled: string;
  disabledText: string;
  danger: string;
  dangerBg: string;
  infoBg: string;
  field: string;
  tick: string;
  tickMajor: string;
}

export const K_LIGHT: KPalette = {
  isDark: false,
  bgTop: '#FCCDB0',
  bgMid: '#FCE7D6',
  bgBottom: '#FDF5EC',
  blobA: '#F4F6B8',
  blobB: '#FFB98F',
  ink: '#10301D',
  sec: 'rgba(16,48,29,0.68)',
  card: 'rgba(255,252,246,0.82)',
  cardEdge: 'rgba(255,255,255,0.95)',
  bubble: 'rgba(255,251,242,0.88)',
  bubbleEdge: 'rgba(255,255,255,0.9)',
  circle: 'rgba(255,255,255,0.6)',
  ringTrack: 'rgba(16,48,29,0.10)',
  ringFill: '#2E5B12',
  accent: palette.lime,
  onAccent: '#10301D',
  limeInk: palette.limeInk,
  limeInkSec: 'rgba(10,10,10,0.72)',
  accentSoft: 'rgba(185,239,20,0.35)',
  disabled: '#E7DCCF',
  disabledText: 'rgba(16,48,29,0.45)',
  danger: '#B42318',
  dangerBg: 'rgba(180,35,24,0.08)',
  infoBg: 'rgba(16,48,29,0.06)',
  field: 'rgba(255,255,255,0.9)',
  tick: 'rgba(16,48,29,0.28)',
  tickMajor: 'rgba(16,48,29,0.75)',
};

export const K_DARK: KPalette = {
  isDark: true,
  bgTop: '#3A5C1B',
  bgMid: '#173A20',
  bgBottom: '#0D2617',
  blobA: '#6E9A08',
  blobB: '#24553A',
  ink: '#FFFFFF',
  sec: 'rgba(255,255,255,0.74)',
  card: 'rgba(255,255,255,0.08)',
  cardEdge: 'rgba(185,239,20,0.22)',
  bubble: 'rgba(255,255,255,0.12)',
  bubbleEdge: 'rgba(255,255,255,0.16)',
  circle: 'rgba(255,255,255,0.12)',
  ringTrack: 'rgba(255,255,255,0.14)',
  ringFill: palette.lime,
  accent: palette.lime,
  onAccent: '#10301D',
  limeInk: palette.limeInk,
  limeInkSec: 'rgba(10,10,10,0.72)',
  accentSoft: 'rgba(185,239,20,0.22)',
  disabled: 'rgba(255,255,255,0.14)',
  disabledText: 'rgba(255,255,255,0.5)',
  danger: '#FF8A80',
  dangerBg: 'rgba(255,138,128,0.12)',
  infoBg: 'rgba(255,255,255,0.08)',
  field: 'rgba(255,255,255,0.1)',
  tick: 'rgba(255,255,255,0.3)',
  tickMajor: 'rgba(255,255,255,0.85)',
};

export function useK(): KPalette {
  const t = useTheme();
  return t.isDark ? K_DARK : K_LIGHT;
}

/**
 * Hareket tablosu. G44-S1 (14 Kas): kayıt ekranlarında "modern, ölçülü" hareket — seçim hâli 160 ms renk/kenar
 * geçişi (yay/zıplama yok), basış 0,98 + 120 ms geri dönüş, girişler tek seferlik 10 pt + fade 240 ms (toplam
 * kademe ≤ 150 ms), soru balonu 200 ms fade (harf harf yok), sayaç ≤ 600 ms ease-out, maskot süzülmesi yarı
 * genlik + cevapta tek baş sallama (≤ 300 ms), ışık paralaksı yarı genlik + yavaş. Azaltılmış harekette hepsi
 * anlık. Paylaşılan öğe taklidi (seçilenin başlığa uçması) kaldırıldı.
 * `pan`, `floatAmp`, `floatHalf`, `blink*` onboarding 1–5 ile ortaktır → G42 değerleri AYNI kalır.
 */
export const K_MOTION = {
  /** Onboarding panorama kayması (Devam) — onboarding, G42 ile aynı. */
  pan: 450,
  /** Soru → soru / E1 → E2 yığın geçişi (native iOS push hissi). */
  push: 330,
  /** Yığın geçişi: ileri — giden katman ilk ~%45'te kaybolur; geri — alttaki önceki adım ~%60'ta belirir. */
  pushFadeOut: 150,
  pushFadeIn: 200,
  /** O5 → P1, L1 → L2 (ve P14 → L1) çapraz geçiş. */
  cross: 250,
  /** Kart/öğe girişi: tek seferlik yukarı kayma + fade. */
  enter: 240,
  enterDy: 10,
  /** Kademe adımı; 5 öğede toplam 4 × 35 = 140 ms (≤ 150). */
  stagger: 35,
  staggerMax: 150,
  /** Soru balonu metni fade. */
  bubbleFade: 200,
  /** Seçim hâli renk/kenar geçişi (150–180 ms bandı). */
  select: 160,
  /** Basış geri bildirimi: 0,98 ölçeğe iniş + 120 ms geri dönüş. */
  pressScale: 0.98,
  pressIn: 80,
  pressOut: 120,
  /** Cevapta maskot baş sallaması (toplam ≤ 300 ms = nodIn + nodMid + nodOut). */
  nod: 290,
  nodIn: 90,
  nodMid: 110,
  nodOut: 90,
  /** Çapraz geçiş (tarih kartı), düğme yükleme daralması, bant çıkışı. */
  fast: 220,
  /** İlerleme halkası dolumu. */
  ring: 330,
  /** Işık katmanı paralaksı (yavaş). */
  parallax: 700,
  /** L1/L2 kalori sayımı (≤ 600 ms, ease-out). */
  count: 600,
  /** Maskot süzülme döngüsü (onboarding ±7 pt; kayıt ekranlarında yarı genlik). */
  floatPeriod: 3200,
  floatAmp: 7,
  floatAmpKayit: 3.5,
  /** Süzülme yarım döngüsü (ileri / geri). */
  floatHalf: 1600,
  /** Göz kırpma aralığı (4–6 sn). */
  blinkMin: 4000,
  blinkMax: 6000,
  blinkHold: 140,
  /** L1 en az / geri dönüşte kısa sürüm. */
  calcFull: 3200,
  calcShort: 1500,
  /** T1 bandı kendiliğinden kalkar. */
  bannerHold: 4000,
  /** T1 bandı iner. */
  banner: 330,
  /** İptal bilgi kartı kendiliğinden kalkar. */
  infoHold: 6000,
} as const;
