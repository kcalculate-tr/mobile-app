// G53-S1 md.4 — Paywall / T1 seçili plan kartı "dolaşan neon ışık" SAF kuralları (RN importu YOK → node:test).
// Bileşen: ./NeonBorder.tsx. Burada yalnız geometri (yuvarlak dikdörtgen çevresi, katman uzunlukları, kesik
// çizgi kaydırması) ve kip kuralı (çalış / sabit / kapalı) var.

/** Tur süresi (ms) — sabit hız, kesintisiz döngü. */
export const NEON_PERIOD_MS = 2800;
/** Seçim değişince ışığın eski karttan yeni karta geçişi (ms, opaklık). */
export const NEON_SWITCH_MS = 200;
/** Işık parçası = kenar uzunluğunun ~%25'i. */
export const NEON_SEGMENT = 0.25;
/** Temel kenar kalınlığı (pt). */
export const NEON_STROKE = 2;
/** Dış parlama için kartın dışına taşan pay (pt). */
export const NEON_BLEED = 8;

export type NeonMode = 'off' | 'static' | 'run';

/**
 * Seçili değilse kapalı. Azaltılmış harekette dolaşma YOK → sabit kenar + hafif glow. Ekran görünmüyorsa
 * (arka plan / başka ekran üstte) yine sabit çizilir ama kare döngüsü durur (pil/CPU harcamaz).
 */
export function neonMode({ selected, reduced, visible }: { selected: boolean; reduced: boolean; visible: boolean }): NeonMode {
  if (!selected) return 'off';
  if (reduced || !visible) return 'static';
  return 'run';
}

/** Yuvarlak dikdörtgenin çevre uzunluğu (rx köşe yarıçapı, en/boyun yarısıyla sınırlı). */
export function roundRectPerimeter(w: number, h: number, r: number): number {
  if (w <= 0 || h <= 0) return 0;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return 2 * (w - 2 * rr) + 2 * (h - 2 * rr) + 2 * Math.PI * rr;
}

/**
 * Işık katmanları — aynı merkezde, uzunluğu kısaldıkça opaklığı artan üst üste kesik çizgiler → parçanın uçları
 * yumuşak biter; geniş + soluk katmanlar dış parlamayı verir. `len` çevrenin kesri, `w` kalınlık (pt).
 * `tone`: glow = parlama rengi, edge = koyu kontur (yalnız açık temada, lime'ı açık zeminde okutmak için),
 * core = ana lime, hot = merkezdeki en parlak ton.
 */
export type NeonLayer = { tone: 'glow' | 'edge' | 'core' | 'hot'; len: number; w: number; opacity: number };

export function neonLayers(glowOpacity: number, withEdge: boolean): NeonLayer[] {
  const layers: NeonLayer[] = [
    { tone: 'glow', len: NEON_SEGMENT, w: 10, opacity: 0.22 * glowOpacity },
    { tone: 'glow', len: NEON_SEGMENT * 0.8, w: 6, opacity: 0.45 * glowOpacity },
  ];
  // Katman SAYISI sabit (bileşende katman başına bir hook): kontur yoksa opaklık 0.
  layers.push({ tone: 'edge', len: NEON_SEGMENT * 0.9, w: 3.5, opacity: withEdge ? 0.55 : 0 });
  layers.push(
    { tone: 'core', len: NEON_SEGMENT, w: NEON_STROKE, opacity: 0.35 },
    { tone: 'core', len: NEON_SEGMENT * 0.7, w: NEON_STROKE, opacity: 0.7 },
    { tone: 'core', len: NEON_SEGMENT * 0.45, w: NEON_STROKE, opacity: 1 },
    { tone: 'hot', len: NEON_SEGMENT * 0.18, w: NEON_STROKE, opacity: 1 },
  );
  return layers;
}

/**
 * İlerleme p (0..1) için bir katmanın strokeDashoffset'i: kesik çizgi `[len, L − len]`, merkezi yol üstünde
 * p·L noktasında. SVG'de offset pozitif yönde deseni geri kaydırır → başlangıç = merkez − len/2.
 * Sonuç [−L, L) aralığına indirgenir (desen L ile periyodik; değer büyümez).
 */
export function neonDashOffset(p: number, perimeter: number, lenFrac: number): number {
  'worklet';
  if (perimeter <= 0) return 0;
  const len = lenFrac * perimeter;
  const raw = len / 2 - p * perimeter;
  return raw % perimeter;
}

/** Kare zamanından (ms) ilerleme — sabit hız, kesintisiz (mod periyot). */
export function neonProgressAt(ms: number, period: number = NEON_PERIOD_MS): number {
  'worklet';
  if (period <= 0) return 0;
  const m = ms % period;
  return (m < 0 ? m + period : m) / period;
}
