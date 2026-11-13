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

/** Hareket tablosu (kayit-final-notlar "Geçiş/Mikro" satırları; FinMoTokens ×1,1 bantları). */
export const K_MOTION = {
  /** Onboarding panorama kayması (Devam). */
  pan: 450,
  /** Sahne geçişi / kart aşağıdan gelir / O5 → P1 açılma. */
  scene: 550,
  /** Paylaşılan öğe (seçilen öğe sonraki başlığa uçar), push. */
  shared: 330,
  /** Çapraz geçiş, segment kayması, tarih kartı. */
  fast: 220,
  /** Kart sıralı yükselme kademesi. */
  stagger: 110,
  /** Soru balonu harf harf (ms/karakter). */
  typeChar: 30,
  /** L2 kalori sayımı. */
  count: 990,
  /** Maskot süzülme döngüsü (±7 pt). */
  floatPeriod: 3200,
  floatAmp: 7,
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
  /** İptal bilgi kartı kendiliğinden kalkar. */
  infoHold: 6000,
  /** Seçimde büyüme / diğerleri. */
  pickScale: 1.02,
  dimScale: 0.97,
  dimOpacity: 0.62,
} as const;
