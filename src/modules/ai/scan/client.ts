// AI tarama gerçek istemcisi. reserve/release RPC; analiz edge fonksiyonu.
// Kota SUNUCUDA denetlenir. `core/supabase` tembel require (Node testleri için).
//
// G6: analiz adımı `analyze-ai-scan` edge fonksiyonudur (G6-CONTRACT.md); gövde
// { reservation_id, image_path }. reservation_id = rezervasyonun idempotency
// anahtarı; image_path = user-media kovasındaki kendi yolu. Yanıt (items+total)
// istemcinin düz ScanEstimate biçimine maplenir.
import type { AiScanClient, ReserveResult, ScanEstimate } from './types';
import {
  MAX_SCAN_IMAGE_BYTES,
  base64Bytes,
  isStoragePath,
  scanImagePath,
  sniffImageType,
} from './scanPath';
import { ScanStageError, analyzeErrorFromInvoke } from './scanError';

type SupabaseModule = typeof import('../../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../core/supabase') as SupabaseModule).getSupabaseClient();
}

function rpcError(name: string, error: { message: string }): never {
  throw new Error(`${name}: ${error.message}`);
}

export const realAiScanClient: AiScanClient = {
  async reserveScan({ idempotencyKey }): Promise<ReserveResult> {
    const { data, error } = await sb().rpc('reserve_ai_scan', {
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('reserve_ai_scan', error);
    return data as ReserveResult;
  },

  async releaseScan({ idempotencyKey }): Promise<void> {
    const { error } = await sb().rpc('release_ai_scan', {
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('release_ai_scan', error);
  },

  async uploadImage({ idempotencyKey, localUri }): Promise<string> {
    // G17-S1 md.1: edge fonksiyonu yalnız `<uid>/…` kova yolunu kabul eder.
    // Yerel fotoğraf → base64 (expo-file-system/legacy) → user-media'ya yükle.
    const client = sb();
    const { data: sess } = await client.auth.getSession();
    const userId = sess.session?.user?.id ?? '';
    if (!userId) throw new Error('scan_upload: no_user');
    if (isStoragePath(localUri, userId)) return localUri; // zaten yüklü
    /* eslint-disable @typescript-eslint/no-require-imports */
    const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    const { decode } = require('base64-arraybuffer') as typeof import('base64-arraybuffer');
    /* eslint-enable @typescript-eslint/no-require-imports */
    // G19-S1 md.4 (Android düşük bellek): 5 MB üstü dosya base64'e HİÇ okunmaz —
    // önce dosya bilgisi; yoksa (önbellek temizlendi) açık kod.
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) throw new Error('scan_upload: file_missing');
    if (typeof info.size === 'number' && info.size > MAX_SCAN_IMAGE_BYTES) throw new Error('scan_upload: image_too_large');
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    if (base64Bytes(base64) > MAX_SCAN_IMAGE_BYTES) throw new Error('scan_upload: image_too_large');
    const path = scanImagePath(userId, idempotencyKey);
    const { error } = await client.storage.from('user-media').upload(path, decode(base64), {
      contentType: sniffImageType(base64),
      upsert: true, // aynı anahtar yeniden denenirse (kuyruk) üzerine yaz
    });
    if (error) throw new Error(`scan_upload: ${error.message}`);
    return path;
  },

  async analyzeImage({ idempotencyKey, imageRef, hint, lang }): Promise<Omit<ScanEstimate, 'isEstimate'>> {
    // Edge fonksiyonu adı ve gövdesi G6-CONTRACT.md ile birebir:
    // reservation_id = rezervasyon anahtarı (idempotencyKey), image_path = user-media yolu.
    const { data, error } = await sb().functions.invoke('analyze-ai-scan', {
      body: buildAnalyzeBody({ idempotencyKey, imageRef, hint, lang }),
      // G19-S1 md.4: zayıf ağda sonsuz "analiz ediliyor" yok — edge model sınırı
      // 20 sn + indirme/yükleme payı. Aşılırsa FunctionsFetchError → 'network'.
      timeout: ANALYZE_CLIENT_TIMEOUT_MS,
    });
    // G17-S2 md.6: edge gövdesindeki `error` kodu (config/server/timeout/…) korunur.
    if (error) throw await analyzeErrorFromInvoke(error);
    return mapAnalyzeResponse(data, lang);
  },

  async analyzeText({ idempotencyKey, text, lang }): Promise<Omit<ScanEstimate, 'isEstimate'>> {
    // G22-S1 md.1: yalnız METİN gider (ses telefonda kalır). Gövde: { reservation_id, mode:'text', text, lang }.
    const { data, error } = await sb().functions.invoke('analyze-ai-scan', {
      body: buildTextAnalyzeBody({ idempotencyKey, text, lang }),
      timeout: ANALYZE_CLIENT_TIMEOUT_MS,
    });
    if (error) throw await analyzeErrorFromInvoke(error);
    return mapAnalyzeResponse(data, lang);
  },

  reportFailure(info) {
    // G17-S2 md.6: LOG (konsol/cihaz günlüğü) + Sentry. Kişisel veri YOK —
    // yalnız aşama, edge kodu, HTTP durumu (yol/uid/foto gönderilmez).
    const tags = { stage: info.stage, code: info.code, http_status: info.httpStatus };
    console.warn('[ai-scan] başarısız', tags);
    try {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      const { captureError } = require('../../../lib/sentry') as typeof import('../../../lib/sentry');
      captureError(new ScanStageError(info.stage, info.code, info.httpStatus), { ai_scan: tags });
    } catch {
      // Sentry yoksa (test/vitrin) sessiz geç
    }
  },
};

/** İstemci tarafı analiz zaman aşımı (ms). Edge model sınırı 20 sn (+ indirme). */
export const ANALYZE_CLIENT_TIMEOUT_MS = 45_000;

/** Edge gövdesi — not (`hint`, ≤ 160) yalnız doluysa; `lang` her zaman (varsayılan tr). */
export function buildAnalyzeBody(p: { idempotencyKey: string; imageRef: string; hint?: string; lang?: 'tr' | 'en' }) {
  const body: { reservation_id: string; image_path: string; lang: 'tr' | 'en'; hint?: string } = {
    reservation_id: p.idempotencyKey,
    image_path: p.imageRef,
    lang: p.lang === 'en' ? 'en' : 'tr',
  };
  if (p.hint) body.hint = p.hint;
  return body;
}

/** G22-S1: metin kipi gövdesi — döküm sadeleşir, ≤ 500 karakter (edge de kırpar). */
export function buildTextAnalyzeBody(p: { idempotencyKey: string; text: string; lang?: 'tr' | 'en' }) {
  return {
    reservation_id: p.idempotencyKey,
    mode: 'text' as const,
    text: normalizeTranscript(p.text),
    lang: p.lang === 'en' ? ('en' as const) : ('tr' as const),
  };
}

/** Konuşma dökümü: kontrol karakterleri atılır, boşluk sadeleşir, 500'e kırpılır. */
export function normalizeTranscript(v: string): string {
  // eslint-disable-next-line no-control-regex
  return (v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/**
 * Edge yanıtı (items + total) → düz ScanEstimate. G19-S1 md.3: öğe başına kcal ve
 * makrolar KORUNUR (önceden yalnız ad+gram alınıyordu → sonuçta satırlar "0 kcal"
 * görünüyor, gram düzeltmesi/öğe silme toplamı değiştirmiyordu).
 */
export function mapAnalyzeResponse(data: unknown, lang?: 'tr' | 'en'): Omit<ScanEstimate, 'isEstimate'> {
  const res = (data ?? {}) as {
    items?: { name?: unknown; grams?: unknown; kcal?: unknown; protein_g?: unknown; carb_g?: unknown; fat_g?: unknown }[];
    total?: { kcal?: unknown; protein_g?: unknown; carb_g?: unknown; fat_g?: unknown };
    lang?: string;
  };
  const en = (res.lang ?? lang) === 'en';
  const items = Array.isArray(res.items) ? res.items : [];
  const ingredients = items.map((i) => ({
    name: typeof i.name === 'string' && i.name.trim() ? i.name.trim() : en ? 'Food' : 'Yemek',
    grams: n(i.grams),
    kcal: n(i.kcal),
    protein_g: n(i.protein_g),
    carbs_g: n(i.carb_g),
    fat_g: n(i.fat_g),
  }));
  const total = res.total ?? {};
  return {
    // Ad = öğelerin birleşimi.
    name: ingredients.length ? ingredients.map((i) => i.name).join(', ') : en ? 'Food' : 'Yemek',
    kcal: n(total.kcal),
    protein_g: n(total.protein_g),
    carbs_g: n(total.carb_g),
    fat_g: n(total.fat_g),
    portion: 1,
    ingredients,
    photo_url: null,
  };
}

let activeClient: AiScanClient = realAiScanClient;

export function getAiScanClient(): AiScanClient {
  return activeClient;
}

export function setAiScanClient(client: AiScanClient): void {
  activeClient = client;
}

export function resetAiScanClient(): void {
  activeClient = realAiScanClient;
}
