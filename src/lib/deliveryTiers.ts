// Teslimat katmanları — saf mantık, Supabase istemcisine DOKUNMAZ.
//
// 25.09.2026 — neden bu dosya var:
// Müşterilerin "nereye teslimat yapıyorsunuz" kafa karışıklığının asıl kaynağı
// coğrafya değil, İKİ KATMANLI sistem. Kayıtlı adreslerin %52'si hem hızlı hem
// planlı teslimat alan ilçelerde (Konak, Karabağlar, Balçova, Narlıdere), %45'i
// ise SADECE planlı teslimat alan ilçelerde (Karşıyaka, Bornova, Buca,
// Bayraklı…). Yani düz bir "İzmir'e teslimat yapıyoruz" mesajı müşterilerin
// neredeyse yarısı için yanlış olur.
//
// KRİTİK: burada `is_active` HER ZAMAN kontrol edilir. Eski DeliveryZonesSheet
// yalnızca allow_immediate/allow_scheduled'a bakıyordu; Çeşme'nin 25 mahallesi
// is_active=false olmasına rağmen allow_scheduled=true olduğu için listede
// görünüyor ve müşteriye "Çeşme'ye teslimat var" deniyordu. Üç müşterinin
// Çeşme adresi kayıtlı.
//
// Kolon varsayılanları veritabanında `false` — null "izin yok" demektir,
// bu yüzden her yerde `=== true` ile karşılaştırılır, coalesce(x, true) ile
// DEĞİL.

/** Bir adresin / ilçenin teslimat durumu. */
export type TeslimatKatmani = 'hizli' | 'planli' | 'yok';

/** delivery_zones satırından bu modülün ihtiyaç duyduğu alanlar. */
export interface KatmanBolgeSatiri {
  district?: string | null;
  /** Veritabanındaki kolon ABD yazımı; UK yazımı da tolere edilir. */
  neighborhood?: string | null;
  neighbourhood?: string | null;
  is_active?: boolean | null;
  allow_immediate?: boolean | null;
  allow_scheduled?: boolean | null;
}

export interface KatmanliIlceler {
  /** Hem hızlı hem planlı teslimat yapılan ilçeler (alfabetik). */
  hizli: string[];
  /** Yalnızca planlı teslimat yapılan ilçeler (alfabetik). */
  planli: string[];
}

/**
 * Türkçe duyarlı karşılaştırma anahtarı.
 * 'İ'/'i' ve 'I'/'ı' çiftleri İngilizce toLowerCase ile bozulur:
 * 'İZMİR'.toLowerCase() → 'i̇zmir' (birleşik nokta kalır). Bu yüzden
 * toLocaleLowerCase('tr') kullanılıyor ve kalan birleştirici noktalar
 * ayıklanıyor.
 */
export function kiyasAnahtari(deger: unknown): string {
  if (typeof deger !== 'string') return '';
  return deger
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/̇/g, '') // birleştirici üst nokta
    .replace(/\s+/g, ' ');
}

function mahalle(satir: KatmanBolgeSatiri): string {
  return kiyasAnahtari(satir.neighborhood ?? satir.neighbourhood);
}

/** Satır müşteriye gösterilebilir mi: aktif VE en az bir teslimat tipi açık. */
export function satirYayinda(satir: KatmanBolgeSatiri): boolean {
  if (satir.is_active !== true) return false;
  return satir.allow_immediate === true || satir.allow_scheduled === true;
}

/**
 * İlçeleri iki katmana ayırır. Bir ilçenin HERHANGİ bir aktif mahallesinde
 * hızlı teslimat varsa ilçe "hızlı" sayılır — müşteriye "burada hızlı teslimat
 * mümkün" demek, hiç bahsetmemekten doğru; mahalle ayrıntısı adres seçiminde
 * zaten netleşiyor.
 */
export function ilceleriKatmanlaAyir(satirlar: KatmanBolgeSatiri[]): KatmanliIlceler {
  const hizli = new Set<string>();
  const planli = new Set<string>();

  for (const satir of satirlar) {
    if (!satirYayinda(satir)) continue;
    const ilce = typeof satir.district === 'string' ? satir.district.trim() : '';
    if (!ilce) continue;
    if (satir.allow_immediate === true) hizli.add(ilce);
    else planli.add(ilce);
  }

  // Bir ilçe her iki kümeye de girdiyse (bazı mahalleleri hızlı, bazıları
  // planlı) yalnızca hızlı listesinde kalır — aksi hâlde aynı ad iki başlık
  // altında görünür ve müşteri için daha kafa karıştırıcı olur.
  for (const ilce of hizli) planli.delete(ilce);

  const sirala = (kume: Set<string>) =>
    Array.from(kume).sort((a, b) => a.localeCompare(b, 'tr'));

  return { hizli: sirala(hizli), planli: sirala(planli) };
}

/**
 * Belirli bir adresin katmanı.
 *
 * Mahalle bilinirse ONA göre karar verilir; bilinmiyorsa ilçedeki aktif
 * satırların en iyisi alınır. Eşleşme yoksa 'yok' — uydurup "teslimat var"
 * demektense yok demek doğru, çünkü yanlış "var" cevabı müşteriyi ödeme
 * ekranına kadar boşuna götürüyor.
 */
export function adresKatmani(
  satirlar: KatmanBolgeSatiri[],
  ilce: string | null | undefined,
  mahalleAdi?: string | null,
): TeslimatKatmani {
  const ilceAnahtar = kiyasAnahtari(ilce);
  if (!ilceAnahtar) return 'yok';

  const ilceSatirlari = satirlar.filter(
    (s) => kiyasAnahtari(s.district) === ilceAnahtar && satirYayinda(s),
  );
  if (ilceSatirlari.length === 0) return 'yok';

  const mahalleAnahtar = kiyasAnahtari(mahalleAdi);
  const aday = mahalleAnahtar
    ? ilceSatirlari.filter((s) => mahalle(s) === mahalleAnahtar)
    : ilceSatirlari;

  // Mahalle verildi ama o mahalle için aktif satır yok → o adrese teslimat yok.
  // (İlçede başka mahalleler açık olsa bile; müşterinin adresi orada değil.)
  if (mahalleAnahtar && aday.length === 0) return 'yok';

  return aday.some((s) => s.allow_immediate === true) ? 'hizli' : 'planli';
}

/** Adres çubuğunda / rozette gösterilecek kısa metin. */
export function katmanEtiketi(katman: TeslimatKatmani): string {
  switch (katman) {
    case 'hizli':
      return 'Bugün teslimat var';
    case 'planli':
      return 'Gün seçerek teslimat';
    case 'yok':
      return 'Bu adrese teslimat yok';
  }
}
