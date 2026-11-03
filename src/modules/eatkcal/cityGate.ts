// eatkcal ilk sipariş şehir kapısı — saf katalog (G6-S4 md.2, G5-CONTRACT.md
// "Kayıt: iki şablon"). Teslimat yalnız İzmir; diğerleri yerel "Haber ver"
// tercihiyle kaydedilir (sunucuya gitmez). `key` ascii/küçük harf — Türkçe
// "İ" harfinin locale-bağımsız küçük harf sorununu (bkz. modules/profil/
// __tests__) baştan önler; `checkDeliveryCity` çağrısında bu kullanılır.
export interface CityOption {
  key: string;
  labelTr: string;
  labelEn: string;
  active: boolean;
}

export const CITY_CATALOG: CityOption[] = [
  { key: 'izmir', labelTr: 'İzmir', labelEn: 'İzmir', active: true },
  { key: 'istanbul', labelTr: 'İstanbul', labelEn: 'Istanbul', active: false },
  { key: 'ankara', labelTr: 'Ankara', labelEn: 'Ankara', active: false },
  { key: 'antalya', labelTr: 'Antalya', labelEn: 'Antalya', active: false },
];

export function findCity(key: string): CityOption | undefined {
  return CITY_CATALOG.find((c) => c.key === key);
}

export function isActiveCity(key: string): boolean {
  return findCity(key)?.active === true;
}
