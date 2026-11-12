// AI tarama tipleri — G5-CONTRACT.md "AI tarama kotası (S2)".
// İlke: sonuç HER ZAMAN "tahmin" etiketli ve kaydetmeden önce düzeltilebilir
// (porsiyon/malzeme). Kota bitince barkod ve elle giriş çalışmaya devam eder.
import type { ScanFailureInfo } from './scanError';

export interface ReserveResult {
  ok: boolean;
  remaining: number;
  reset_at: string; // ISO; Europe/Istanbul gece yarısı
  /** G19-S1 md.2: anahtar zaten 'consumed' → hak DÜŞMEDİ, edge önbellekteki sonucu döner. */
  cached?: boolean;
  /** G19-S1 (İlter 9 Kas): ok:false nedeni — 'disabled' (acil kapatma) | 'global_cap'
   *  (günlük genel tavan). Yoksa kullanıcının kendi hakkı bitti. */
  reason?: 'disabled' | 'global_cap';
  /** G22-S1: kademeli hak (migration 20261110100100). G19 sunucusunda yok → undefined. */
  tier?: 'free' | 'fresh' | 'balance';
  limit?: number | null;
  unlimited?: boolean;
}

/** G22-S1: sonuçla birlikte taşınan hak bilgisi (hak hapı N/2 · N/15 · Sınırsız). */
export interface OutcomeQuota {
  tier?: 'free' | 'fresh' | 'balance';
  limit?: number | null;
  unlimited?: boolean;
}

export interface ScanIngredient {
  name: string;
  grams: number;
  // Bileşen başına kalori — sunucu döndürmezse paylaşım kartı etiketi yalnız
  // adı gösterir (uydurma sayı yok, bkz. PlateXRayShareCard).
  kcal?: number;
  /** G19-S1 md.3: öğe başına makro (sunucu verirse) — öğe silme/gram düzeltmesi
   *  toplamı öğe öğe yeniden hesaplar. Yoksa toplam kcal oranıyla ölçeklenir. */
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
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
  | { status: 'ok'; estimate: ScanEstimate; remaining: number; reset_at: string; quota?: OutcomeQuota }
  | { status: 'quota_exhausted'; remaining: number; reset_at: string; quota?: OutcomeQuota }
  // unavailable → Tara geçici kapalı (acil anahtar / genel tavan): "hakkını kullandın" DEĞİL
  | { status: 'unavailable'; reason: 'disabled' | 'global_cap'; remaining: number; reset_at: string; quota?: OutcomeQuota }
  | {
      status: 'failed';
      quota?: OutcomeQuota;
      error: string;
      remaining: number;
      reset_at: string;
      /** G17-S2 md.6: teşhis — aşama + edge `error` kodu + HTTP durumu. */
      failure?: ScanFailureInfo;
    };

export interface AnalyzeParams {
  idempotencyKey: string;
  // Yerel dosya URI'si veya yüklenmiş görsel referansı (EXIF istemcide temizlenir).
  imageRef: string;
  /** G18-S4 md.5: isteğe bağlı kullanıcı notu (≤ 160) → edge `hint`. Boşsa gönderilmez. */
  hint?: string;
  /** G19-S1 md.3: cihaz dili → edge `lang` (yiyecek adları bu dilde). */
  lang?: 'tr' | 'en';
}

// İstemci arayüzü — gerçek RPC/edge (client.ts) ve mock (mock.ts) uygular.
export interface AiScanClient {
  // reserve_ai_scan(p_idempotency_key) — atomik; günde 3.
  reserveScan(params: { idempotencyKey: string }): Promise<ReserveResult>;
  // release_ai_scan(p_idempotency_key) — başarısız analizde hakkı iade eder.
  releaseScan(params: { idempotencyKey: string }): Promise<void>;
  // G17-S1: yerel fotoğrafı `user-media/<uid>/scans/<anahtar>.jpg` yoluna yükler,
  // kova yolunu döner. Analizden ÖNCE çağrılır; hata fırlatırsa hak iade edilir.
  // İsteğe bağlı: yoksa (mock/vitrin) imageRef olduğu gibi analize gider.
  uploadImage?(params: { idempotencyKey: string; localUri: string }): Promise<string>;
  // Görsel → besin tahmini (analiz adımı). imageRef = kova yolu. Hata fırlatırsa hak iade edilir.
  analyzeImage(params: AnalyzeParams): Promise<Omit<ScanEstimate, 'isEstimate'>>;
  // G17-S2 md.6: yükleme/analiz hatası teşhisi → LOG + Sentry (gerçek istemci).
  // İsteğe bağlı; mock/vitrin uygulamayabilir. Asla fırlatmamalı.
  reportFailure?(info: ScanFailureInfo): void;
  // G22-S1 md.1: sesle ekleme — telefonda yazıya dökülen METİN (ses gönderilmez) → edge
  // `mode:'text'`. Hak fotoğrafla ORTAK (aynı reserveScan). Yoksa (eski mock) ses kipi kapalı.
  analyzeText?(params: { idempotencyKey: string; text: string; lang?: 'tr' | 'en' }): Promise<Omit<ScanEstimate, 'isEstimate'>>;
}
