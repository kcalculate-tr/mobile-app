// eatkcal v2 i18n — ortak + hata kartları (FinEkErrors).
// Her alan dosyası `tr` ve `en` verir; G13-S2 sonunda
// `src/core/i18n/dictionaries.ts` içindeki `eatkcal.v2.<alan>` bloğuna AYNEN
// kopyalanır (scripts: docs/night/G13-S2-LOG.md "i18n"). Anahtar adları
// `t('eatkcal.v2.<alan>.<anahtar>')`.
export const tr = {
  common: {
    back: 'Geri',
    close: 'Kapat',
    retry: 'Tekrar dene',
    see_all: 'Tümü',
    kcal: 'kcal',
    protein: 'Protein',
    carbs: 'Karb',
    fat: 'Yağ',
    p: 'P',
    k: 'K',
    y: 'Y',
    grams: '%{n} g',
    loading: 'Yükleniyor',
    call: 'Ara',
  },
  errors: {
    coupon_title: 'Kupon geçersiz',
    coupon_body: 'Kodun süresi dolmuş ya da yanlış yazılmış.',
    coupon_action: 'Kuponlarımı gör',
    stock_title: 'Bu seçenek az önce tükendi',
    stock_body: '%{names} bu adrese hizmet veren şubede tükendi. Sepetten çıkarıp devam edebilirsin.',
    stock_action: 'Alternatifi seç',
    price_title: 'Fiyat değişti',
    price_body: '%{before} → %{after} · siparişe bu fiyatla devam edilir.',
    price_action: 'Onayla',
    address_title: 'Adres kaydedilemedi',
    address_body: 'Bağlantını kontrol edip tekrar dene.',
    address_action: 'Tekrar dene',
  },
};

export const en: typeof tr = {
  common: {
    back: 'Back',
    close: 'Close',
    retry: 'Try again',
    see_all: 'All',
    kcal: 'kcal',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    p: 'P',
    k: 'C',
    y: 'F',
    grams: '%{n} g',
    loading: 'Loading',
    call: 'Call',
  },
  errors: {
    coupon_title: 'Coupon not valid',
    coupon_body: 'The code has expired or was mistyped.',
    coupon_action: 'See my coupons',
    stock_title: 'This option just sold out',
    stock_body: '%{names} sold out at the branch serving this address. Remove it from the cart to continue.',
    stock_action: 'Pick an alternative',
    price_title: 'Price changed',
    price_body: '%{before} → %{after} · your order continues at this price.',
    price_action: 'Confirm',
    address_title: 'Address couldn’t be saved',
    address_body: 'Check your connection and try again.',
    address_action: 'Try again',
  },
};
