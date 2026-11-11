// G29-S1 md.1 — Logla'dan sonra çıkartmayı ARKA PLANDA kaydet (beklenmez; hata sessiz).
// Dosya okuma: expo-file-system/legacy + base64-arraybuffer (Tara yüklemesiyle aynı, yeni paket yok).
import { getSupabaseClient } from '../../core/supabase';
import type { Sticker } from './subjectLift';
import { rememberLocalSticker, uploadSticker, type StickerClient, type UploadResult } from './stickerStore';

export async function readStickerBytes(uri: string): Promise<ArrayBuffer | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { decode } = require('base64-arraybuffer') as typeof import('base64-arraybuffer');
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return base64 ? decode(base64) : null;
  } catch {
    return null;
  }
}

/**
 * Kayıt yazıldı: satır hemen cihazdaki çıkartmayı gösterir; yükleme + sticker_path arka planda.
 * Döndürülen söz yalnız testler içindir — çağıran BEKLEMEZ.
 */
export function saveStickerInBackground(params: {
  userId: string | null | undefined;
  rowId: string | null | undefined;
  sticker: Sticker | null | undefined;
}): Promise<UploadResult | null> {
  const { userId, rowId, sticker } = params;
  if (!sticker || !rowId || !userId) return Promise.resolve(null);
  rememberLocalSticker(rowId, sticker.uri);
  return uploadSticker(getSupabaseClient() as unknown as StickerClient, {
    userId,
    rowId,
    sticker,
    readBytes: readStickerBytes,
  }).catch(() => null);
}
