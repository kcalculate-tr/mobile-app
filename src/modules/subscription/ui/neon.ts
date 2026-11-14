// G53-S1 md.4 · G54-S1 md.7 — Paywall / T1 seçili plan kartı "dolaşan neon ışık" SAF kuralları (RN importu YOK →
// node:test). Bileşen: ./NeonBorder.tsx. Burada yalnız geometri (yuvarlak dikdörtgen YOLU ve çevresi, katmanlar,
// kesik çizgi kaydırması) ve kip kuralı (çalış / sabit / kapalı) var.
//
// G54 kök neden (İlter cihaz görüntüsü: ışık kart kenarını izlemiyor, alt kenarın altında ayrı bir şerit gibi kayıyor,
// sağ alt köşeden taşıyor): ışık katmanları `rx`'li `<Rect>` üzerinde reanimated `animatedProps` ile çiziliyordu ve
// SVG kutusu katmanın KENDİ onLayout ölçüsünden (negatif ofsetli mutlak görünüm) geliyordu. Köşe yarıçapı/kutu
// animasyonlu katmanda temel kenarla aynı kalmadı (köşeler düz → köşeden taşma), geniş parlama kart dışına
// taşıp kenardan ayrı ikinci bir çizgi gibi okundu. Düzeltme: geometri tek bir AÇIK yol (`roundRectPath`, köşe
// yayları yolun içinde — kaybolamaz), kutu KARTIN kendi ölçüsü (rozetler hariç), temel kenar + ışık aynı yol.

/** Tur süresi (ms) — sabit hız, kesintisiz döngü (G54: ≈ 7 sn, G53'ün 2,5 katı yavaş). */
export const NEON_PERIOD_MS = 7000;
/** Seçim değişince ışığın eski karttan yeni karta geçişi (ms, opaklık). */
export const NEON_SWITCH_MS = 250;
/** Işığın kuyruğu = çevrenin ~%30'u (uçlar degrade ile söner; baş en parlak). */
export const NEON_TAIL = 0.3;
/** Sabit temel kenar: ince ve sakin. */
export const NEON_STROKE = 1.5;
export const NEON_BASE_OPACITY = 0.35;
/** Dış hale için kartın dışına taşan çizim payı (pt). */
export const NEON_BLEED = 10;

export type NeonMode = 'off' | 'static' | 'run';

/**
 * Seçili değilse kapalı. Azaltılmış harekette dolaşma YOK → sabit kenar + yumuşak hale. Ekran görünmüyorsa
 * (arka plan / başka ekran üstte) yine sabit çizilir ama kare döngüsü durur (pil/CPU harcamaz).
 */
export function neonMode({ selected, reduced, visible }: { selected: boolean; reduced: boolean; visible: boolean }): NeonMode {
  if (!selected) return 'off';
  if (reduced || !visible) return 'static';
  return 'run';
}

/** Yuvarlak dikdörtgenin çevre uzunluğu (r köşe yarıçapı, en/boyun yarısıyla sınırlı). */
export function roundRectPerimeter(w: number, h: number, r: number): number {
  if (w <= 0 || h <= 0) return 0;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return 2 * (w - 2 * rr) + 2 * (h - 2 * rr) + 2 * Math.PI * rr;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Yuvarlak dikdörtgen yolu (saat yönü, üst kenarın sol yay bitiminden başlar). Köşe yayları yolun içinde. */
export function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (w <= 0 || h <= 0) return '';
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const R = x + w;
  const B = y + h;
  return [
    `M${f(x + rr)} ${f(y)}`,
    `H${f(R - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(R)} ${f(y + rr)}`,
    `V${f(B - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(R - rr)} ${f(B)}`,
    `H${f(x + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(B - rr)}`,
    `V${f(y + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}`,
    'Z',
  ].join(' ');
}

/** Kart kutusu (w × h, köşe `radius`) → çizim yolu: çizgi kalınlığının yarısı kadar içe, aynı yarıçap (−yarı). */
export function neonGeometry(w: number, h: number, radius: number, stroke: number = NEON_STROKE, bleed: number = NEON_BLEED) {
  const inset = stroke / 2;
  const pw = Math.max(0, w - stroke);
  const ph = Math.max(0, h - stroke);
  const r = Math.max(0, radius - inset);
  return { svgW: w + bleed * 2, svgH: h + bleed * 2, x: bleed + inset, y: bleed + inset, w: pw, h: ph, r, d: roundRectPath(bleed + inset, bleed + inset, pw, ph, r), perimeter: roundRectPerimeter(pw, ph, r) };
}

/**
 * Işık katmanları — hepsi BAŞTA (aynı noktada) biter, geriye doğru farklı uzunlukta uzanır → üst üste binince baş en
 * parlak, kuyruk degrade ile söner (sert uç / kesik çizgi yok). 3 katman: geniş yumuşak hale (≈10 pt, düşük opaklık),
 * orta parlama (≈5 pt), ince parlak çekirdek (1,75 pt) + baştaki kısa sıcak nokta. `glow` 0..1 (açık temada daha az).
 */
export type NeonLayer = { tone: 'halo' | 'mid' | 'core' | 'hot'; len: number; w: number; opacity: number };

export function neonLayers(glow: number): NeonLayer[] {
  const T = NEON_TAIL;
  return [
    { tone: 'halo', len: T, w: 10, opacity: 0.08 * glow },
    { tone: 'halo', len: T * 0.55, w: 10, opacity: 0.12 * glow },
    { tone: 'mid', len: T * 0.8, w: 5, opacity: 0.14 * (0.5 + glow / 2) },
    { tone: 'mid', len: T * 0.4, w: 5, opacity: 0.22 * (0.5 + glow / 2) },
    { tone: 'core', len: T, w: 1.75, opacity: 0.22 },
    { tone: 'core', len: T * 0.6, w: 1.75, opacity: 0.32 },
    { tone: 'core', len: T * 0.3, w: 1.75, opacity: 0.5 },
    { tone: 'hot', len: T * 0.1, w: 2, opacity: 1 },
  ];
}

/**
 * İlerleme p (0..1) için bir katmanın strokeDashoffset'i: kesik çizgi `[len, L − len]`, BAŞI yol üstünde p·L
 * noktasında (kuyruk geride). SVG'de offset o → çizgi −o'dan başlar → o = len − p·L. [−L, L) aralığına indirgenir.
 */
export function neonDashOffset(p: number, perimeter: number, lenFrac: number): number {
  'worklet';
  if (perimeter <= 0) return 0;
  const raw = lenFrac * perimeter - p * perimeter;
  return raw % perimeter;
}

/** Kare zamanından (ms) ilerleme — sabit hız, kesintisiz (mod periyot). */
export function neonProgressAt(ms: number, period: number = NEON_PERIOD_MS): number {
  'worklet';
  if (period <= 0) return 0;
  const m = ms % period;
  return (m < 0 ? m + period : m) / period;
}
