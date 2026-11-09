// Bayrak kayıt defteri — TÜM bayrak anahtarları ve YEREL VARSAYILANLARI tek yerde.
//
// KURAL: her bayrağın yerel varsayılanı `false`. Bugün canlıda AÇIK olan hiçbir
// özelliği bayrağa çevirmiyoruz; bu altyapı yalnızca "dalga dalga açılacak yeni
// özellikler" içindir. Yeni anahtar eklerken bu dosyaya `false` ile ekle ve
// sunucuda feature_flags tablosunda aynı key ile bir satır oluştur (bkz.
// docs/night/G4-S2-FLAGS.md).
//
// Buradaki anahtarlar yalnız kayıt amaçlıdır; HİÇBİR canlı ekran henüz
// useFeature() ile bunlara bağlı değildir (davranış değişmez).

export const FLAG_DEFAULTS = {
  // Kcalculate AI (takip tarafı)
  kcalculate_ai_tracking: false, // Kalori/makro AI takip
  log_meal: false, // "Logla" — öğün kaydı
  barcode_scan: false, // "Tara" — barkod/ürün tarama
  discover: false, // "Keşfet"
  ai_coach: false, // AI koç
  dietitian: false, // Diyetisyen
  inbox: false, // Mesaj kutusu
  // eatkcal (sipariş tarafı)
  eatkcal_ordering: false, // eatkcal öğün siparişi
  // G5 — Keşfet / Gün halkası / AI tarama (G5-CONTRACT.md "Bayrak anahtarları")
  kesfet: false, // Keşfet editoryal akış (Dalga 1)
  kesfet_takip: false, // Keşfet "Takip" sekmesi
  kesfet_video: false, // Keşfet video (G8-CONTRACT) — yerel paketler onaylı (G8-S3)
  gun_halkasi: false, // Gün halkası (paylaşılan öğünler)
  ai_tarama: false, // AI fotoğraf tarama (günlük kota)
  restoran_yakinda: false, // eatkcal "restoran yakında" kapısı
  paylasim_karti: false, // Öğünü güne paylaşma / Tabak Röntgeni kartı (cihazda görsel üretimi + sistem paylaşımı)
  // G8 — Açık paylaşım / yorum / etkinlik / bildirim (G8-CONTRACT.md "Bayraklar")
  kesfet_paylasim: false, // Keşfet'te HERKES paylaşır (composer + create_post yetkisi)
  kesfet_yorum: false, // Gönderi yorumları (tek seviye yanıt)
  etkinlik: false, // Etkinlik kartı + Tracker'da etkinlik kaydı
  sosyal_bildirim: false, // Sosyal bildirimler (Keşfet zili + liste)
  // G11 — Yeni kabuk (TabBarR3: cam hap + Tara). Açıkken AppNavigator R3 tab
  // navigatörünü kurar; kapalıyken (varsayılan) bugünkü CustomTabBar AYNEN.
  // Sunucu satırı: enabled false, rollout_percent 0, min_app_version '1.1.0'.
  yeni_kabuk: false, // Yeni uygulama kabuğu (sekme çubuğu + Tara)
  // G12 — Final tasarımla giydirme (Dalga 1). Hepsi kapalı; sunucu satırlarını
  // S6 migration dosyası olarak yazar. Kapalıyken uygulama bugünküyle AYNI.
  yeni_onboarding: false, // Onboarding + Takibe başla + mevcut müşteriye tanıtım (G12-S1)
  yeni_siparis: false, // eatkcal yeni arayüzü: ana sayfa, mağaza, ürün, sepet, özet, adres, siparişler (G12-S5)
  // G15-S2 — Ana sayfa Su halkası + hızlı su ekleme (water_daily + log_water).
  // Sunucu satırı: 20261106000100_g15_water.sql (kapalı, min_app_version 1.1.0).
  su_takibi: false, // Su takibi (Ana sayfa Su halkası)
  // G18-S1 — Karşılama başlığı varyantı (`onb_welcome_variant`, SON_HAL Tur 26).
  // Bayraklar boolean olduğundan iki anahtar: _b → B, _c → C, ikisi kapalı → A
  // (varsayılan). Sunucu satırları: 20261108000100_g18_onboarding_state.sql (kapalı).
  onb_welcome_variant_b: false, // Karşılama başlığı B
  onb_welcome_variant_c: false, // Karşılama başlığı C
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

export const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as FlagKey[];

// Yalnız okunabilir varsayılan harita (mutasyona kapalı kopya üretmek için).
export function defaultFlags(): Record<FlagKey, boolean> {
  return { ...FLAG_DEFAULTS };
}
