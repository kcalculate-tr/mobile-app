// Sosyal kanıt — onaylı yorumlar ve ürün beğeni oranı.
//
// 26.09.2026 — İKİ DÜRÜSTLÜK KURALI, ikisi de bilinçli:
//
// 1) ALT SINIR. "Deneyenlerin %100'ü beğendi" cümlesi tek oya dayanıyorsa
//    müşteriyi yanıltır. Sunucudaki urun_begeni_oranlari(p_min_oy) eşiğin
//    altındaki ürünü HİÇ döndürmüyor; burada ayrıca oy sayısı da taşınıyor ki
//    arayüz oranı her zaman "kaç kişiden" ile birlikte yazabilsin.
//
// 2) UYDURMA YOK. Veri yoksa bileşen hiç çizilmiyor — yer tutucu, örnek yorum
//    veya "henüz yorum yok" kutusu göstermiyoruz. Boş şerit, sahte şeritten
//    iyidir.
//
// Not (26.09.2026): şu an 0 onaylı yorum var. Boss panel → Yorumlar'dan
// onaylanana kadar şerit görünmez; bu beklenen davranış, hata değil.
//
// Bu dosya SAF: './supabase'i import ETMEZ. (deliveryRules.ts ile aynı sebep —
// supabase modülü import anında gerçek bir auth istemcisi ayağa kaldırıyor ve
// node ortamında 'window is not defined' ile patlıyor. Ağ çağrıları
// socialProof.ts'te.)


/** Ürün sayfasında oranın gösterileceği en az oy sayısı. */
export const EN_AZ_OY = 5;

export interface VitrinYorumu {
  id: number;
  rating: number;
  yorum: string;
  ad: string;
  tarih: string;
}

export interface BegeniOrani {
  productId: number;
  toplam: number;
  begenen: number;
  oran: number;
}

/**
 * Oranı müşteriye gösterilecek cümleye çevirir.
 * Eşiğin altında ya da veri yoksa `null` — çağıran taraf hiçbir şey çizmez.
 */
export function begeniCumlesi(veri: BegeniOrani | null | undefined): string | null {
  if (!veri) return null;
  if (!Number.isFinite(veri.toplam) || veri.toplam < EN_AZ_OY) return null;
  if (!Number.isFinite(veri.oran) || veri.oran <= 0) return null;
  // Oy sayısı HER ZAMAN yazılıyor: küçük örneklem kendini ele versin.
  return `Deneyenlerin %${veri.oran}'i bu öğünü beğendi (${veri.toplam} kişi)`;
}

/** Yorum kartında gösterilecek kısa tarih: "24 Eyl". */
export function yorumTarihi(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const aylar = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  return `${d.getDate()} ${aylar[d.getMonth()]}`;
}
