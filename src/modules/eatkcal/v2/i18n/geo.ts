// eatkcal v2 i18n (G22-S2 md.3) — konum: ülke seçici + şehir araması (Avrupa + Amerika).
// `eatkcal.v2.geo.*` (dictionaries.ts'e bağlanır). Fiyat yok.
export const tr = {
  country_search: 'Ülke ara',
  country_no_match: 'Bu adla bir ülke bulamadık.',
  city_label: 'Şehir',
  city_search: 'Şehir ara',
  city_hint: 'Şehrinin adını yaz.',
  city_loading: 'Şehirler aranıyor',
  city_no_match: 'Bu adla bir şehir bulamadık.',
  city_error: 'Şehirler yüklenemedi. Bağlantını kontrol edip tekrar dene.',
  retry: 'Tekrar dene',
  use_typed: '“%{q}” ile devam et',
  pick_city: 'Şehir seç',
  results: { one: '1 şehir bulundu', other: '%{count} şehir bulundu' },
  soon_city: 'Çok yakında %{city_ki} restoranlar burada listelenecek.',
  attribution: 'Şehir verisi: GeoNames (CC BY 4.0)',
};

export const en: typeof tr = {
  country_search: 'Search countries',
  country_no_match: 'We couldn’t find a country with that name.',
  city_label: 'City',
  city_search: 'Search cities',
  city_hint: 'Type the name of your city.',
  city_loading: 'Searching cities',
  city_no_match: 'We couldn’t find a city with that name.',
  city_error: 'Couldn’t load cities. Check your connection and try again.',
  retry: 'Try again',
  use_typed: 'Continue with “%{q}”',
  pick_city: 'Choose a city',
  results: { one: '1 city found', other: '%{count} cities found' },
  soon_city: 'Restaurants in %{city} will be listed here soon.',
  attribution: 'City data: GeoNames (CC BY 4.0)',
};
