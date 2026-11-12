// G29-S1 md.1 — Çıkartma (FinMoSticker "Çıkartma kalkar"): tabak fotoğrafından cihazda çıkartma.
// Yerel Expo modülü `modules/subject-lift` (iOS 17+ Vision, Android ML Kit Subject Segmentation).
// TAMAMEN CİHAZDA — sunucuya ek veri gitmez.
//
// Yedek yollar (hepsi sessiz, akış ASLA beklemez): native modül yok (eski derleme / Expo Go /
// web) · iOS 17 altı · modül "yok" diyor · hata (model inmemiş dahil) · 1,5 sn aşımı · geçersiz
// sonuç → `{ ok: false, reason }` → çağıran normal (yuvarlatılmış) fotoğrafı gösterir.
//
// Saf çekirdek: native ve platform enjekte edilebilir (RN importu yok → tsx --test).
// Birim testi: __tests__/g29SubjectLift.test.ts

/** Süre sınırı: aşılırsa çıkartma yok (geç gelen sonuç yok sayılır). */
export const STICKER_TIMEOUT_MS = 1500;
/** Çıktı uzun kenarı en çok (px). */
export const STICKER_MAX_SIZE = 512;
/** WebP kalitesi (0…1) — 512 px'de ~20 KB hedef. */
export const STICKER_QUALITY = 0.6;
/** iOS: Vision ön plan maskesi iOS 17 ile geldi. */
export const STICKER_MIN_IOS = 17;

export interface StickerCrop {
  /** Kaynak fotoğrafa göre 0…1, üst-sol köşeden. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sticker {
  /** Cihazdaki dosya (file://…). */
  uri: string;
  width: number;
  height: number;
  format: 'webp' | 'png';
  bytes: number;
  /** Maskenin üretildiği (dik) kaynak fotoğraf boyutu. */
  sourceWidth: number;
  sourceHeight: number;
  crop: StickerCrop;
}

export type StickerSkip = 'no_native' | 'unsupported' | 'os_too_old' | 'timeout' | 'error' | 'invalid' | 'no_input';

export type StickerOutcome = { ok: true; sticker: Sticker; ms: number } | { ok: false; reason: StickerSkip; ms: number };

export interface SubjectLiftNative {
  isAvailable(): boolean;
  liftAsync(uri: string, maxSize: number, quality: number): Promise<unknown>;
}

export interface PlatformInfo {
  OS: string;
  Version: string | number;
}

/** iOS sürümü destekliyor mu (Android her zaman denenir; model yoksa native reddeder). */
export function platformSupported(p: PlatformInfo | null | undefined): StickerSkip | null {
  if (!p) return 'unsupported';
  if (p.OS === 'android') return null;
  if (p.OS === 'ios') {
    const major = parseInt(String(p.Version), 10);
    return Number.isFinite(major) && major >= STICKER_MIN_IOS ? null : 'os_too_old';
  }
  return 'unsupported';
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const unit = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 1.0001;

/** Native sonucu doğrula (bozuk / boş kutu → null). */
export function parseNativeResult(raw: unknown): Sticker | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.uri !== 'string' || !r.uri) return null;
  if (!isNum(r.width) || !isNum(r.height) || r.width < 1 || r.height < 1) return null;
  if (r.width > STICKER_MAX_SIZE + 1 || r.height > STICKER_MAX_SIZE + 1) return null;
  if (!isNum(r.sourceWidth) || !isNum(r.sourceHeight) || r.sourceWidth < 1 || r.sourceHeight < 1) return null;
  if (!unit(r.cropX) || !unit(r.cropY) || !unit(r.cropWidth) || !unit(r.cropHeight)) return null;
  if ((r.cropWidth as number) <= 0 || (r.cropHeight as number) <= 0) return null;
  const format = r.format === 'png' ? 'png' : r.format === 'webp' ? 'webp' : null;
  if (!format) return null;
  return {
    uri: r.uri,
    width: r.width,
    height: r.height,
    format,
    bytes: isNum(r.bytes) ? r.bytes : 0,
    sourceWidth: r.sourceWidth,
    sourceHeight: r.sourceHeight,
    crop: { x: r.cropX as number, y: r.cropY as number, width: r.cropWidth as number, height: r.cropHeight as number },
  };
}

// ── Varsayılan native + platform (uygulamada) ────────────────────────────────
type NativeLoader = () => SubjectLiftNative | null;
type PlatformLoader = () => PlatformInfo | null;

const defaultNative: NativeLoader = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo') as typeof import('expo');
    const m = requireOptionalNativeModule('SubjectLift') as SubjectLiftNative | null;
    return m && typeof m.liftAsync === 'function' ? m : null;
  } catch {
    return null;
  }
};

const defaultPlatform: PlatformLoader = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    return { OS: Platform.OS, Version: Platform.Version };
  } catch {
    return null;
  }
};

let nativeLoader: NativeLoader = defaultNative;
let platformLoader: PlatformLoader = defaultPlatform;

/** Test: native / platform yükleyicisini değiştir (`null` → varsayılan). */
export function setSubjectLiftNative(next: NativeLoader | null): void {
  nativeLoader = next ?? defaultNative;
}
export function setSubjectLiftPlatform(next: PlatformLoader | null): void {
  platformLoader = next ?? defaultPlatform;
}

/** Bu cihazda çıkartma denenebilir mi (senkron; UI ön kontrolü). */
export function canLiftSticker(): boolean {
  if (platformSupported(platformLoader())) return false;
  const native = nativeLoader();
  if (!native) return false;
  try {
    return native.isAvailable() === true;
  } catch {
    return false;
  }
}

export interface LiftOptions {
  timeoutMs?: number;
  maxSize?: number;
  quality?: number;
  now?: () => number;
}

/**
 * Fotoğraftan çıkartma. ASLA reddetmez / fırlatmaz; en geç `timeoutMs` içinde döner.
 * Süre aşımında native işi arka planda bitse bile sonucu yok sayılır.
 */
export async function liftSticker(uri: string | null | undefined, opts: LiftOptions = {}): Promise<StickerOutcome> {
  const now = opts.now ?? Date.now;
  const started = now();
  const done = (o: { ok: true; sticker: Sticker } | { ok: false; reason: StickerSkip }): StickerOutcome => ({ ...o, ms: now() - started });
  if (!uri) return done({ ok: false, reason: 'no_input' });
  const blocked = platformSupported(platformLoader());
  if (blocked) return done({ ok: false, reason: blocked });
  const native = nativeLoader();
  if (!native) return done({ ok: false, reason: 'no_native' });
  try {
    if (native.isAvailable() !== true) return done({ ok: false, reason: 'unsupported' });
  } catch {
    return done({ ok: false, reason: 'unsupported' });
  }

  const timeoutMs = opts.timeoutMs ?? STICKER_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  let work: Promise<unknown>;
  try {
    work = Promise.resolve(native.liftAsync(uri, opts.maxSize ?? STICKER_MAX_SIZE, opts.quality ?? STICKER_QUALITY));
  } catch {
    if (timer) clearTimeout(timer);
    return done({ ok: false, reason: 'error' });
  }
  const guarded = work.then(
    (raw) => ({ raw }),
    () => 'error' as const,
  );
  try {
    const first = await Promise.race([guarded, timeout]);
    if (first === 'timeout') return done({ ok: false, reason: 'timeout' });
    if (first === 'error') return done({ ok: false, reason: 'error' });
    const sticker = parseNativeResult(first.raw);
    return sticker ? done({ ok: true, sticker }) : done({ ok: false, reason: 'invalid' });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Ekran yerleşimi (saf) ────────────────────────────────────────────────────
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Fotoğraf kapta `cover` ile çizilirken çıkartmanın kaptaki kutusu — çıkartma fotoğrafın
 * üstüne birebir oturur (kalkış oradan başlar).
 */
export function coverRect(container: { width: number; height: number }, sticker: Pick<Sticker, 'sourceWidth' | 'sourceHeight' | 'crop'>): Box | null {
  const { width: W, height: H } = container;
  const { sourceWidth: sw, sourceHeight: sh, crop } = sticker;
  if (!(W > 0) || !(H > 0) || !(sw > 0) || !(sh > 0)) return null;
  const s = Math.max(W / sw, H / sh);
  const dw = sw * s;
  const dh = sh * s;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;
  return {
    x: ox + crop.x * dw,
    y: oy + crop.y * dh,
    width: crop.width * dw,
    height: crop.height * dh,
  };
}
