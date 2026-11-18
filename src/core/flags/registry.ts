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
  // G19-S2 md.5 — öğün saatinde kayıt yoksa yerel hatırlatma (fin_reminder_*).
  // Yalnız yeni kabukta etkili. Sunucu satırı: 20261109200100_g19_s2_track.sql (kapalı).
  ogun_hatirlatma: false, // Öğün hatırlatmaları (yerel bildirim)
  abonelik: false, // G22-S1: kcalAI abonelikleri (paywall, hak sheet'leri, Profil › Abonelik); RevenueCat anahtarı da gerekir
  // G24-S1 — kcalAI Koç (sohbet + girişler). Sunucu satırı 20261111100100_g24_coach.sql (kapalı,
  // min_app_version 1.1.0). Native modül istemez → OTA. `coach-chat` 404 ise girişler yine gizli.
  koc: false,
  // G25-S1 — 1.1.0 inceleme öncesi. Sunucu satırları 20261111200100_g25_flags.sql (ikisi KAPALI).
  yakinda_satirlari: false, // Profil "Yakında" satırları + FinPrMacro "Öğün aboneliği" sekmesi (A4)
  paylasim_baglanti: false, // Keşfet gönderi/profil "Bağlantıyı kopyala / Paylaş" (A10; l.eatkcal.com hazır olunca)
  // G33-S1 — Öğün planı + alışveriş listesi (Tur 26m). Sunucu satırı 20261112100100_g33_meal_plan.sql
  // (KAPALI, min_app_version 1.1.0). Native modül yok → OTA. Kapalıyken Profil satırları ve rotalar yok.
  ogun_plani: false,
  // G34-S1 — Kişisel plan akışı (Tur 26o): 4 giriş noktası, Kişisel planım, haftalık check-in.
  // Sunucu satırı 20261112110100_g34_personal_plan.sql (KAPALI, min_app_version 1.1.0). Native yok → OTA.
  kisisel_plan: false,
  // G42-S1 — Yeni onboarding (5 ekran) + kayıt (A: kişisel plan · B: kısa profil). Sunucu satırı
  // 20261113120100_g42_yeni_kayit.sql (KAPALI, min_app_version 1.1.0). Kapalıyken bugünkü onboarding
  // bayt bayt aynı (rotalar kayıtlı değil). A yolu ayrıca `kisisel_plan` ister. Native yok → OTA.
  yeni_kayit: false,
  // G56-S1 — Arkadaşını davet et (ana sayfa kartı, Invite banner'ı, Davet ekranı, Profil satırı, sepette kod satırı).
  // Sunucu satırı 20261116200100_g56_eatkcal_growth.sql (KAPALI, min_app_version 1.1.0). Native yok → OTA.
  davet: false,
  // G59-S1 — Hikâye (müziksiz; tepsi, kamera → düzenleyici → paylaş, görüntüleyici, görenler, öne çıkanlar).
  // Sunucu satırı 20261117220100_g59_hikaye.sql (KAPALI, min_app_version 1.1.0). Video hikâye ayrıca `kesfet_video`.
  // Native yok → OTA. Kapalıyken giriş YOK (tepsi, profil halkası, öne çıkanlar, rotalar kayıtlı değil).
  hikaye: false,
  // G60-S1 — Keşfet sekmesi sıralaması v2 (get_feed_ranked: dil + yerellik + etkileşim) + görüntülenme ölçümü.
  // Sunucu satırı 20261117230300_g60_get_feed_ranked.sql (KAPALI, min_app_version 1.1.0). Kapalıyken get_feed
  // (kronolojik, dil 'tr') bayt bayt aynı; "Sana Özel" her durumda kronolojik. Geri alma = kapat. Native yok → OTA.
  kesfet_siralama: false,
  // G62-S1 — eatkcal siparişi değerlendir v2 (FinEkRateSheet: Teslimat / Kalori uyumu / Lezzet + ürün oyu +
  // yorum + fotoğraf; Ana sayfa ve sipariş detayında giriş kartı). Sunucu satırı 20261118120100_g62_order_rating.sql
  // (KAPALI, min_app_version 1.1.0). Kapalıyken v1 akışı (EkOrderDetail ReviewCard, eski HomeScreen modalı) AYNEN.
  siparis_degerlendirme: false,
  // G63-S1 — Mesajlar (DM): Keşfet başlığında mesaj simgesi (okunmamış rozeti), gelen kutusu + istekler, 1:1 sohbet,
  // PublicProfile "Mesaj", paylaş sayfasında "Mesajla gönder", hikâye görüntüleyicide serbest metin yanıtı.
  // Sunucu satırı 20261118140100_g63_mesajlar.sql (KAPALI, min_app_version 1.1.0). Kapalıyken HİÇBİR giriş yok
  // (rotalar kayıtlı değil, sorgu yok), sunucu RPC'leri 'kapali' döner, push gitmez. Native yok → OTA.
  mesajlar: false,
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

export const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as FlagKey[];

/**
 * 16 Kas — YAYIN YEDEĞİ: sunucuya ulaşılamadığında (ilk açılış, yavaş ağ, zaman aşımı) ve geçerli önbellek
 * yokken kullanılan değerler = bu sürümde %100 açık bayraklar. Önceden bu durumda tüm bayraklar false
 * (1.0.7 davranışı) dönüyordu → ilk açılışta eski kabuk/eski onboarding açılıyor, sonra yeniye geçiyordu.
 * Sunucu cevabı geldiğinde her zaman sunucu kazanır; varsayılanlar (FLAG_DEFAULTS) değişmedi.
 */
export const RELEASE_FALLBACK: Partial<Record<FlagKey, boolean>> = {
  yeni_kabuk: true,
  yeni_onboarding: true,
  yeni_kayit: true,
  yeni_siparis: true,
  kesfet: true,
  kesfet_takip: true,
  kesfet_paylasim: true,
  kesfet_yorum: true,
  gun_halkasi: true,
  ai_tarama: true,
  restoran_yakinda: true,
  su_takibi: true,
  ogun_hatirlatma: true,
  abonelik: true,
  koc: true,
  kisisel_plan: true,
};

// Yalnız okunabilir varsayılan harita (mutasyona kapalı kopya üretmek için).
export function defaultFlags(): Record<FlagKey, boolean> {
  return { ...FLAG_DEFAULTS };
}
