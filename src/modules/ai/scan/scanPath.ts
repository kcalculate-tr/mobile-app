// G17-S1 md.1 — Tara fotoğrafının `user-media` kovasındaki yolu.
// `analyze-ai-scan` yalnız `<uid>/` ile başlayan ve `..` içermeyen yolu kabul eder.
// Rezervasyon anahtarı yerel URI içerebildiği için (`<uid>-file:///…/x.jpg`)
// klasör/nokta karakterleri `_` olur; çok uzun anahtar kısa bir özetle kısaltılır.
// SAF (native yok) — birim testi: __tests__/scanUpload.test.ts

const MAX_KEY_LEN = 96;

function hash32(s: string): string {
  // FNV-1a 32 bit — yalnız çakışmasız kısa ad için, güvenlik amaçlı değil.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Rezervasyon anahtarını dosya adına güvenli hale getirir. */
export function scanFileKey(idempotencyKey: string): string {
  const safe = idempotencyKey.replace(/[^A-Za-z0-9_-]/g, '_');
  if (safe.length <= MAX_KEY_LEN) return safe;
  return `${hash32(idempotencyKey)}_${safe.slice(-(MAX_KEY_LEN - 9))}`;
}

/** `<uid>/scans/<anahtar>.jpg` */
export function scanImagePath(userId: string, idempotencyKey: string): string {
  if (!userId) throw new Error('scan_upload: no_user');
  return `${userId}/scans/${scanFileKey(idempotencyKey)}.jpg`;
}

/** Zaten kovaya yüklenmiş bir yol mu (yerel URI değil)? */
export function isStoragePath(ref: string, userId: string): boolean {
  return !!userId && ref.startsWith(`${userId}/`) && !ref.includes('..');
}

/** base64 başından görsel türü (yol `.jpg` kalır; edge önce blob türüne bakar). */
export function sniffImageType(base64: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

/** Edge sınırı 5 MB — base64 uzunluğundan bayt sayısı. */
export function base64Bytes(base64: string): number {
  const pad = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - pad;
}

export const MAX_SCAN_IMAGE_BYTES = 5 * 1024 * 1024;
