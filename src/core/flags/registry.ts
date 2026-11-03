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
  gun_halkasi: false, // Gün halkası (paylaşılan öğünler)
  ai_tarama: false, // AI fotoğraf tarama (günlük kota)
  restoran_yakinda: false, // eatkcal "restoran yakında" kapısı
  paylasim_karti: false, // Öğünü güne paylaşma kartı
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

export const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as FlagKey[];

// Yalnız okunabilir varsayılan harita (mutasyona kapalı kopya üretmek için).
export function defaultFlags(): Record<FlagKey, boolean> {
  return { ...FLAG_DEFAULTS };
}
