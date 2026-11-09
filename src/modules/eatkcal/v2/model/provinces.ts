// eatkcal v2 (G18-S3 md.1, FinCityR1) — Türkiye'nin 81 ili. Hizmet verilen tek il
// İzmir (listenin başında, "Açık"); diğerleri "Çok yakında" → bekleme listesi
// (sipariş akışı başlamaz). Arama Türkçe küçük harfle (İ/ı doğru).

export const IZMIR = 'İzmir';

export const PROVINCES_TR: readonly string[] = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli',
  'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop',
  'Şırnak', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

/** İzmir başta, diğerleri Türkçe alfabe sırasında. */
export function orderedProvinces(): string[] {
  const rest = PROVINCES_TR.filter((p) => p !== IZMIR).slice().sort((a, b) => a.localeCompare(b, 'tr'));
  return [IZMIR, ...rest];
}

const trLower = (s: string) => s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();

export function filterProvinces(list: readonly string[], q: string): string[] {
  const n = trLower(q.trim());
  if (!n) return list.slice();
  return list.filter((p) => trLower(p).includes(n));
}

/** Seçim → hedef: İzmir siparişe (doğrulamayla), diğer il / diğer ülke bekleme listesine. */
export function gateTarget(country: 'TR' | 'OTHER', il: string | null): 'order' | 'waitlist' | null {
  if (country === 'OTHER') return 'waitlist';
  if (!il) return null;
  return il === IZMIR ? 'order' : 'waitlist';
}
