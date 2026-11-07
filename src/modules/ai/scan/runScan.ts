// AI tarama akışı — reserve → yükle (user-media) → analiz → (başarısızsa) release.
// Bu saf orkestrasyon: istemci enjekte edilir, native bağımlılık yok (test eder).
import type { AiScanClient, AiScanOutcome, AnalyzeParams } from './types';

export async function runAiScan(
  client: AiScanClient,
  params: AnalyzeParams,
): Promise<AiScanOutcome> {
  // 1) Atomik rezervasyon. Kota bitmişse hiç analiz etme — çağıran barkod/elle
  //    girişe düşer (rezerve edilmediği için iade de gerekmez).
  const reservation = await client.reserveScan({ idempotencyKey: params.idempotencyKey });
  if (!reservation.ok) {
    return {
      status: 'quota_exhausted',
      remaining: reservation.remaining,
      reset_at: reservation.reset_at,
    };
  }

  // 2) Yükleme + analiz. Edge fonksiyonu yerel `file://` URI'sini okuyamaz
  //    (403) — önce fotoğraf kovaya yüklenir, analize KOVA YOLU gider.
  //    Herhangi biri başarısızsa hakkı İADE et (release) ve remaining'i geri yükle.
  try {
    const imageRef = client.uploadImage
      ? await client.uploadImage({ idempotencyKey: params.idempotencyKey, localUri: params.imageRef })
      : params.imageRef;
    const raw = await client.analyzeImage({ ...params, imageRef });
    return {
      status: 'ok',
      estimate: { ...raw, isEstimate: true }, // her zaman "tahmin"
      remaining: reservation.remaining,
      reset_at: reservation.reset_at,
    };
  } catch (e) {
    try {
      await client.releaseScan({ idempotencyKey: params.idempotencyKey });
    } catch {
      // iade de başarısızsa yut — sunucudaki günlük sıfırlama yine de düzeltir
    }
    return {
      status: 'failed',
      error: e instanceof Error ? e.message : 'analyze_failed',
      remaining: reservation.remaining + 1, // iade sonrası hak geri geldi
      reset_at: reservation.reset_at,
    };
  }
}
