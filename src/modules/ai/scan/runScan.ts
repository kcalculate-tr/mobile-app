// AI tarama akışı — reserve → yükle (user-media) → analiz → (başarısızsa) release.
// Bu saf orkestrasyon: istemci enjekte edilir, native bağımlılık yok (test eder).
import type { AiScanClient, AiScanOutcome, AnalyzeParams } from './types';
import { scanFailureInfo, type ScanFailureStage } from './scanError';

export async function runAiScan(
  client: AiScanClient,
  params: AnalyzeParams,
): Promise<AiScanOutcome> {
  // 1) Atomik rezervasyon. Kota bitmişse hiç analiz etme — çağıran barkod/elle
  //    girişe düşer (rezerve edilmediği için iade de gerekmez).
  const reservation = await client.reserveScan({ idempotencyKey: params.idempotencyKey });
  if (!reservation.ok) {
    // G19-S1: acil kapatma / genel tavan → ayrı durum ("Tara şu an kullanılamıyor").
    if (reservation.reason === 'disabled' || reservation.reason === 'global_cap') {
      return {
        status: 'unavailable',
        reason: reservation.reason,
        remaining: reservation.remaining,
        reset_at: reservation.reset_at,
      };
    }
    return {
      status: 'quota_exhausted',
      remaining: reservation.remaining,
      reset_at: reservation.reset_at,
    };
  }

  // 2) Yükleme + analiz. Edge fonksiyonu yerel `file://` URI'sini okuyamaz
  //    (403) — önce fotoğraf kovaya yüklenir, analize KOVA YOLU gider.
  //    Herhangi biri başarısızsa hakkı İADE et (release) ve remaining'i geri yükle.
  let stage: ScanFailureStage = 'upload';
  try {
    const imageRef = client.uploadImage
      ? await client.uploadImage({ idempotencyKey: params.idempotencyKey, localUri: params.imageRef })
      : params.imageRef;
    stage = 'analyze';
    const raw = await client.analyzeImage({ ...params, imageRef });
    return {
      status: 'ok',
      estimate: { ...raw, isEstimate: true }, // her zaman "tahmin"
      remaining: reservation.remaining,
      reset_at: reservation.reset_at,
    };
  } catch (e) {
    // G17-S2 md.6: aşama + edge `error` kodu → LOG + Sentry (kullanıcıya FinErrFailed).
    const failure = scanFailureInfo(e, stage);
    try {
      client.reportFailure?.(failure);
    } catch {
      // teşhis akışı bozmaz
    }
    // G19-S1 md.2: sayaç yalnız iade GERÇEKTEN yapıldıysa +1. Önbellekten dönen
    // (cached) rezervasyon hak düşürmemişti → iade de yok, sayaç aynı kalır.
    let released = false;
    if (!reservation.cached) {
      try {
        await client.releaseScan({ idempotencyKey: params.idempotencyKey });
        released = true;
      } catch {
        // iade de başarısızsa yut — sunucudaki günlük sıfırlama yine de düzeltir
      }
    }
    return {
      status: 'failed',
      failure,
      error: e instanceof Error ? e.message : 'analyze_failed',
      remaining: released ? reservation.remaining + 1 : reservation.remaining,
      reset_at: reservation.reset_at,
    };
  }
}
