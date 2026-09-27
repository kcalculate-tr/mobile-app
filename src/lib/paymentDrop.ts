// Ödeme düşüş aşaması — SAF mantık.
//
// 27.09.2026 — NEDEN VAR:
// `orders` tablosunda 167 sipariş `status='expired'` durumunda ve 173'ünde
// `payment_failure_reason` BOŞ. Yani müşteri ödeme ekranına gelip sipariş
// tamamlanmadığında elimizde hiçbir kayıt kalmıyor.
//
// Sebep: PaymentScreen'in `handleFailure`'ı yalnızca analytics olayı
// yazıyordu (`track('payment_failed')`), sipariş SATIRINA dokunmuyordu.
// Kullanıcı ödeme ekranından geri çıktığında ise hiçbir şey yazılmıyordu —
// sipariş `pending_payment` olarak duruyor, 10 dakika sonra bir cron onu
// sessizce `expired` yapıyor. Ne aşamada koptuğu kayboluyor.
//
// Analytics olayları da yetmiyor: `payment_attempt` takibi 16.09.2026'da
// başladı, ondan önceki 142 expired sipariş ölçüm dışı. Ayrıca analytics
// yazımı best-effort bir kuyrukta; sipariş satırına yazmak daha güvenilir.

/** Müşterinin ödeme akışında ulaştığı son nokta. */
export type OdemeAsamasi =
  /** Ödeme başlatma isteği gönderildi, sağlayıcıdan yanıt beklenmiyor. */
  | 'init'
  /** Sağlayıcı formu/3DS sayfası açıldı, müşteri orada. */
  | 'provider_page'
  /** Sağlayıcı dönüş adresine ulaşıldı, sonuç işleniyor. */
  | 'returned';

/** Siparişte neden tamamlanmadığı. */
export type DususSebebi =
  /** Müşteri ekranı terk etti (geri tuşu, uygulamayı kapatma). */
  | 'abandoned'
  /** Sağlayıcı/banka reddetti ya da hata döndü. */
  | 'failed'
  /** Başlatma isteği hiç tamamlanamadı (ağ, zaman aşımı, oturum). */
  | 'init_error';

export interface DususKaydi {
  stage: OdemeAsamasi;
  reason: DususSebebi;
  detay?: string | null;
}

/**
 * Sipariş satırına yazılacak tek satırlık özet.
 * Örn: "abandoned@provider_page" — müşteri 3DS sayfasında vazgeçti.
 */
export function dususEtiketi(kayit: DususKaydi): string {
  return `${kayit.reason}@${kayit.stage}`;
}

/**
 * Panelde/raporda okunabilir Türkçe karşılık.
 * Bilinmeyen etiket olduğu gibi döner — gelecekte yeni bir aşama eklenirse
 * rapor "bilinmiyor"a düşmesin.
 */
export function dususAciklamasi(etiket: string | null | undefined): string {
  if (!etiket) return 'Kayıt yok';
  switch (etiket) {
    case 'init_error@init':        return 'Ödeme başlatılamadı (ağ/oturum/zaman aşımı)';
    case 'failed@init':            return 'Sağlayıcı ödeme başlatmayı reddetti';
    case 'abandoned@init':         return 'Ödeme açılırken vazgeçti';
    case 'abandoned@provider_page':return 'Banka/3DS sayfasında vazgeçti';
    case 'failed@provider_page':   return 'Banka/3DS reddetti';
    case 'abandoned@returned':     return 'Sonuç dönerken çıktı';
    case 'failed@returned':        return 'Ödeme başarısız döndü';
    default:                       return etiket;
  }
}
