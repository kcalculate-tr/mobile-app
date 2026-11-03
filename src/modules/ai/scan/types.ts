// AI tarama tipleri — G5-CONTRACT.md "AI tarama kotası (S2)".
// İlke: sonuç HER ZAMAN "tahmin" etiketli ve kaydetmeden önce düzeltilebilir
// (porsiyon/malzeme). Kota bitince barkod ve elle giriş çalışmaya devam eder.

export interface ReserveResult {
  ok: boolean;
  remaining: number;
  reset_at: string; // ISO; Europe/Istanbul gece yarısı
}

export interface ScanIngredient {
  name: string;
  grams: number;
  // Bileşen başına kalori — sunucu döndürmezse paylaşım kartı etiketi yalnız
  // adı gösterir (uydurma sayı yok, bkz. PlateXRayShareCard).
  kcal?: number;
}

export interface ScanEstimate {
  // Her zaman true — kullanıcıya "tahmin" olarak sunulur, asla kesin değer değil.
  isEstimate: true;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  // Kaydetmeden önce düzeltilebilir alanlar:
  portion: number;
  ingredients: ScanIngredient[];
  photo_url: string | null;
}

// Tarama sonucu — çağıran bu duruma göre davranır:
// ok           → tahmini göster, düzeltmeye izin ver, sonra kaydet
// quota_exhausted → barkod/elle girişe yönlendir (hak iadesi yok, zaten rezerve edilmedi)
// failed       → analiz patladı, hak İADE edildi; tekrar denemeye izin ver
export type AiScanOutcome =
  | { status: 'ok'; estimate: ScanEstimate; remaining: number; reset_at: string }
  | { status: 'quota_exhausted'; remaining: number; reset_at: string }
  | { status: 'failed'; error: string; remaining: number; reset_at: string };

export interface AnalyzeParams {
  idempotencyKey: string;
  // Yerel dosya URI'si veya yüklenmiş görsel referansı (EXIF istemcide temizlenir).
  imageRef: string;
}

// İstemci arayüzü — gerçek RPC/edge (client.ts) ve mock (mock.ts) uygular.
export interface AiScanClient {
  // reserve_ai_scan(p_idempotency_key) — atomik; günde 3.
  reserveScan(params: { idempotencyKey: string }): Promise<ReserveResult>;
  // release_ai_scan(p_idempotency_key) — başarısız analizde hakkı iade eder.
  releaseScan(params: { idempotencyKey: string }): Promise<void>;
  // Görsel → besin tahmini (analiz adımı). Hata fırlatırsa hak iade edilir.
  analyzeImage(params: AnalyzeParams): Promise<Omit<ScanEstimate, 'isEstimate'>>;
}
