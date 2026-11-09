// G18-S2 md.4 — Ana sayfa bölgesi (SAF). Çözüm sırası: kayıtlı adres → seçilen
// il → izinli konum. İlk kesin cevap kazanır; hiçbiri yoksa 'unknown'.
//   izmir   → FinHomeIzmir (tek eatkcal öneri kartı + İzmir kampanyası banner'ı)
//   other   → FinHomeOutside ("Restoranını eatkcal'a ekle" + "Bize … öner")
//   unknown → Ana sayfa 'other' görünümünü çizer (metni her yerde doğru:
//             "Şimdilik yalnız İzmir'de"); İzmir kampanyası gösterilmez. (SORULAR)
export type HomeRegion = 'izmir' | 'other' | 'unknown';

export interface RegionInputs {
  /** Seçili / kayıtlı teslimat adresinin ili (addressStore.selectedAddress.city). */
  addressCity?: string | null;
  /** İl kapısında seçilen: 'izmir' (kapı geçildi) ya da 'other' ("Haber ver" listesi). */
  chosenCity?: 'izmir' | 'other' | null;
  /** İzin VERİLMİŞSE cihaz konumu (izin istemi açılmaz). */
  coords?: { latitude: number; longitude: number } | null;
}

/** "İzmir", "IZMIR", "izmir " → 'izmir' (Türkçe İ/ı güvenli, locale'siz). */
export function normalizeCity(city: string | null | undefined): string {
  return String(city ?? '')
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// İzmir ili kaba sınır kutusu (Bergama/Aliağa kuzey → Selçuk/Tire güney,
// Karaburun/Çeşme batı → Kiraz/Kemalpaşa doğu). Yalnız Ana sayfa içeriği seçer;
// teslimat kararı her zaman sunucudaki bölge kuralıyla verilir (değişmedi).
const IZMIR_BOX = { minLat: 37.8, maxLat: 39.4, minLon: 26.2, maxLon: 28.5 };

export function isIzmirCoords(c: { latitude: number; longitude: number }): boolean {
  return (
    c.latitude >= IZMIR_BOX.minLat &&
    c.latitude <= IZMIR_BOX.maxLat &&
    c.longitude >= IZMIR_BOX.minLon &&
    c.longitude <= IZMIR_BOX.maxLon
  );
}

export function resolveHomeRegion({ addressCity, chosenCity, coords }: RegionInputs): HomeRegion {
  const a = normalizeCity(addressCity);
  if (a) return a === 'izmir' ? 'izmir' : 'other';
  if (chosenCity) return chosenCity;
  if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
    return isIzmirCoords(coords) ? 'izmir' : 'other';
  }
  return 'unknown';
}
