// G19-S1 md.4 — yerel tarama fotoğrafı yardımcıları (expo-file-system/legacy, tembel).
//  • checkLocalImage: rezervasyondan ÖNCE dosya var mı / ≤ 5 MB mı (hak harcanmaz,
//    büyük dosya belleğe base64 olarak hiç okunmaz — Android düşük bellek).
//  • persistQueuedImage: çevrimdışı kuyruğa giren foto önbellekten (OS silebilir)
//    belge dizinine kopyalanır → uygulama kapanıp açılınca da analiz edilebilir.
//  • deleteQueuedImage: işlenen/düşen kuyruk fotoğrafını siler (yalnız kendi dizini).
// Her işlem hata yutar: dosya sistemi yoksa (test/vitrin) akış eski davranışla sürer.
import { MAX_SCAN_IMAGE_BYTES, scanFileKey } from './scanPath';

type FS = typeof import('expo-file-system/legacy');
function fs(): FS | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system/legacy') as FS;
  } catch {
    return null;
  }
}

export type LocalImageCheck = 'ok' | 'missing' | 'too_large';

/** Saf karar (test eder): dosya bilgisi → sonuç. Bilgi yoksa 'ok' (eski davranış). */
export function judgeLocalImage(info: { exists: boolean; size?: number } | null): LocalImageCheck {
  if (!info) return 'ok';
  if (!info.exists) return 'missing';
  if (typeof info.size === 'number' && info.size > MAX_SCAN_IMAGE_BYTES) return 'too_large';
  return 'ok';
}

export async function checkLocalImage(uri: string): Promise<LocalImageCheck> {
  const F = fs();
  if (!F || !/^file:/.test(uri)) return 'ok';
  try {
    const info = await F.getInfoAsync(uri);
    return judgeLocalImage(info as { exists: boolean; size?: number });
  } catch {
    return 'ok';
  }
}

export const QUEUE_DIR_NAME = 'scan-queue/';

export function isQueuedImageUri(uri: string, documentDirectory: string | null | undefined): boolean {
  return !!documentDirectory && uri.startsWith(documentDirectory + QUEUE_DIR_NAME);
}

export async function persistQueuedImage(uri: string, id: string): Promise<string> {
  const F = fs();
  const docDir = F?.documentDirectory;
  if (!F || !docDir || isQueuedImageUri(uri, docDir)) return uri;
  try {
    const dir = docDir + QUEUE_DIR_NAME;
    await F.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const dest = `${dir}${scanFileKey(id)}.jpg`;
    await F.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri; // kopyalanamazsa önbellek yolu (eski davranış)
  }
}

export async function deleteQueuedImage(uri: string): Promise<void> {
  const F = fs();
  if (!F || !isQueuedImageUri(uri, F.documentDirectory)) return;
  try {
    await F.deleteAsync(uri, { idempotent: true });
  } catch {
    // yut
  }
}
