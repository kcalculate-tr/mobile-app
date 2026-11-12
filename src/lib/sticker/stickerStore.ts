// G29-S1 md.1 — Çıkartmanın kaydı: `user-media` kovasına yükleme + `meal_consumptions.sticker_path`,
// satır görseli için okuma (toplu, önbellekli) ve yerel eşleme (log → satır, ağ beklemeden).
//
// Yol: `<uid>/stickers/<kayıt id>.webp` — kovanın sahiplik politikası (ilk klasör = auth.uid())
// ve hesap silmenin `<uid>/` temizliği değişmeden kapsar (KARAR, LOG).
//
// Her şey best-effort, ASLA fırlatmaz: Logla kaydı çıkartmayı beklemez; yükleme/güncelleme
// olmazsa satır fotoğrafa düşer. Migration (sticker_path) canlıda yokken: güncelleme/okuma
// "sütun yok" hatası verir → bu oturumda bir daha denenmez, yüklenen dosya geri silinir.
//
// Saf çekirdek (istemci + dosya okuyucu enjekte) — birim testi: __tests__/g29StickerStore.test.ts
import type { Sticker } from './subjectLift';

export const STICKER_BUCKET = 'user-media';
/** Yükleme üst sınırı (bayt) — 512 px WebP ~20 KB; PNG yedeği daha büyük olabilir. */
export const STICKER_MAX_BYTES = 600 * 1024;

type Res<T = unknown> = PromiseLike<{ data?: T | null; error: { code?: string; message?: string } | null }>;

export interface StickerClient {
  storage: {
    from(bucket: string): {
      upload(path: string, body: ArrayBuffer, opts: { contentType: string; upsert: boolean }): Res;
      remove(paths: string[]): Res;
    };
  };
  from(table: string): {
    update(values: Record<string, unknown>): { eq(col: string, val: string): Res };
    select(cols: string): { in(col: string, vals: string[]): Res<{ id: string; sticker_path: string | null }[]> };
  };
}

export type ReadBytes = (uri: string) => Promise<ArrayBuffer | null>;

export function stickerFileKey(rowId: string): string {
  return rowId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 96) || 'x';
}

/** `<uid>/stickers/<kayıt id>.<webp|png>` */
export function stickerStoragePath(userId: string, rowId: string, format: Sticker['format'] = 'webp'): string {
  if (!userId) throw new Error('sticker: no_user');
  return `${userId}/stickers/${stickerFileKey(rowId)}.${format === 'png' ? 'png' : 'webp'}`;
}

/** Migration uygulanmamış: PostgREST "sütun yok" (42703 / PGRST204 / mesajda sticker_path). */
export function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42703' || err.code === 'PGRST204') return true;
  return /sticker_path/i.test(err.message ?? '');
}

// ── Oturum durumu ────────────────────────────────────────────────────────────
type ColumnState = 'unknown' | 'present' | 'missing';
let column: ColumnState = 'unknown';
const local = new Map<string, string>(); // kayıt id → cihazdaki çıkartma
const paths = new Map<string, string | null>(); // kayıt id → kova yolu (null = yok)
let queue = new Set<string>();
let pending: Promise<void> | null = null;
let waiters = new Map<string, ((p: string | null | undefined) => void)[]>();

export function stickerColumnState(): ColumnState {
  return column;
}

/** Log yazıldı: bu kaydın satırı şimdilik cihazdaki çıkartmayı gösterir (ağ yok). */
export function rememberLocalSticker(rowId: string | null | undefined, uri: string | null | undefined): void {
  if (rowId && uri) local.set(rowId, uri);
}

export function peekLocalSticker(rowId: string | null | undefined): string | null {
  return rowId ? local.get(rowId) ?? null : null;
}

/** Geri al / silme: bu kaydın çıkartması unutulur. */
export function forgetSticker(rowId: string | null | undefined): void {
  if (!rowId) return;
  local.delete(rowId);
  paths.delete(rowId);
}

/** Önbellekteki yol: string = var · null = yok · undefined = bilinmiyor. */
export function peekStickerPath(rowId: string | null | undefined): string | null | undefined {
  if (!rowId) return null;
  if (column === 'missing') return null;
  return paths.has(rowId) ? paths.get(rowId) ?? null : undefined;
}

export interface UploadResult {
  ok: boolean;
  path: string | null;
  reason?: 'no_user' | 'no_row' | 'column_missing' | 'read_failed' | 'too_large' | 'upload_failed' | 'update_failed';
}

/**
 * Çıkartmayı yükle + kayda yaz. Logla'dan SONRA arka planda çağrılır (beklenmez).
 * Sütun yoksa (migration uygulanmamış) dosya geri silinir, oturumda bir daha denenmez.
 */
export async function uploadSticker(
  client: StickerClient,
  params: { userId: string | null | undefined; rowId: string | null | undefined; sticker: Sticker; readBytes: ReadBytes },
): Promise<UploadResult> {
  const { userId, rowId, sticker, readBytes } = params;
  if (!userId) return { ok: false, path: null, reason: 'no_user' };
  if (!rowId) return { ok: false, path: null, reason: 'no_row' };
  if (column === 'missing') return { ok: false, path: null, reason: 'column_missing' };
  const path = stickerStoragePath(userId, rowId, sticker.format);
  try {
    const body = await readBytes(sticker.uri);
    if (!body || body.byteLength === 0) return { ok: false, path: null, reason: 'read_failed' };
    if (body.byteLength > STICKER_MAX_BYTES) return { ok: false, path: null, reason: 'too_large' };
    const up = await client.storage
      .from(STICKER_BUCKET)
      .upload(path, body, { contentType: sticker.format === 'png' ? 'image/png' : 'image/webp', upsert: true });
    if (up.error) return { ok: false, path: null, reason: 'upload_failed' };
    const upd = await client.from('meal_consumptions').update({ sticker_path: path }).eq('id', rowId);
    if (upd.error) {
      if (isMissingColumnError(upd.error)) column = 'missing';
      // Kayda bağlanamayan dosya kovada kalmasın.
      try {
        await client.storage.from(STICKER_BUCKET).remove([path]);
      } catch {
        // best-effort
      }
      return { ok: false, path: null, reason: column === 'missing' ? 'column_missing' : 'update_failed' };
    }
    column = 'present';
    paths.set(rowId, path);
    return { ok: true, path };
  } catch {
    return { ok: false, path: null, reason: 'upload_failed' };
  }
}

/**
 * Kaydın çıkartma yolu (toplu: aynı karede istenen kayıtlar tek sorguda). Sütun yoksa null
 * (oturumda bir daha sorulmaz). Ağ hatası kalıcı sayılmaz (undefined → sonra yeniden).
 */
export function loadStickerPath(client: StickerClient, rowId: string | null | undefined): Promise<string | null | undefined> {
  const known = peekStickerPath(rowId);
  if (known !== undefined || !rowId) return Promise.resolve(known ?? null);
  return new Promise((resolve) => {
    const list = waiters.get(rowId) ?? [];
    list.push(resolve);
    waiters.set(rowId, list);
    queue.add(rowId);
    if (!pending) {
      pending = Promise.resolve().then(() => flush(client));
    }
  });
}

async function flush(client: StickerClient): Promise<void> {
  const ids = Array.from(queue);
  const w = waiters;
  queue = new Set();
  waiters = new Map();
  pending = null;
  const settle = (id: string, v: string | null | undefined) => (w.get(id) ?? []).forEach((r) => r(v));
  if (ids.length === 0) return;
  try {
    const { data, error } = await client.from('meal_consumptions').select('id,sticker_path').in('id', ids);
    if (error) {
      if (isMissingColumnError(error)) {
        column = 'missing';
        ids.forEach((id) => settle(id, null));
      } else {
        ids.forEach((id) => settle(id, undefined));
      }
      return;
    }
    column = 'present';
    const found = new Map((data ?? []).map((r) => [String(r.id), r.sticker_path ? String(r.sticker_path) : null]));
    for (const id of ids) {
      const p = found.has(id) ? found.get(id) ?? null : null;
      paths.set(id, p);
      settle(id, p);
    }
  } catch {
    ids.forEach((id) => settle(id, undefined));
  }
}

/** Yalnız testler. */
export function __resetStickerStore(): void {
  column = 'unknown';
  local.clear();
  paths.clear();
  queue = new Set();
  waiters = new Map();
  pending = null;
}
