// i18n sözlükleri — YALNIZ G5 veri modülleri (Keşfet, Gün halkası, profil kaydı,
// AI tarama) için TR/EN metinleri. Mevcut ekranların metinlerine DOKUNULMAZ;
// onlar hâlâ kendi yerlerindeki string'leri kullanır. Buraya yalnız bu gece
// kurulan veri katmanının kullanıcıya görünecek metinleri girer.
//
// Varsayılan dil 'tr'. 'en' eksik bir anahtar taşırsa i18n çekirdeği 'tr'ye
// geri döner (enableFallback). Çoğul anahtarlar { one, other } biçimindedir ve
// `{ count }` ile çağrılır.

export type Lang = 'tr' | 'en';

export const SUPPORTED_LANGS: readonly Lang[] = ['tr', 'en'] as const;
export const DEFAULT_LANG: Lang = 'tr';

// Not: i18n-js iç içe nesneyi noktayla adresler ("kesfet.tab.for_you").
export const translations: Record<Lang, Record<string, unknown>> = {
  tr: {
    common: {
      undo: 'Geri al',
      cancel: 'Vazgeç',
      save: 'Kaydet',
      retry: 'Tekrar dene',
      close: 'Kapat',
      estimate: 'tahmin',
    },
    kesfet: {
      title: 'Keşfet',
      tab: { for_you: 'Senin için', following: 'Takip' },
      empty: 'Henüz gönderi yok.',
      empty_following: 'Takip ettiklerinden henüz gönderi yok.',
      loadError: 'Akış yüklenemedi.',
      liked: 'Beğenildi',
      saved: 'Kaydedildi',
      add_to_day: 'Günüme ekle',
      added_toast: '%{meal}’ye loglandı',
      stats: {
        likes: { one: '%{count} beğeni', other: '%{count} beğeni' },
        saves: { one: '%{count} kayıt', other: '%{count} kayıt' },
        adds: { one: '%{count} eklenme', other: '%{count} eklenme' },
      },
    },
    gun: {
      title: 'Gün',
      rings_empty: 'Bugün paylaşılan öğün yok.',
      share: 'Güne paylaş',
      streak: { one: '%{count} günlük seri', other: '%{count} günlük seri' },
      card_expired: 'Bu kartın süresi doldu.',
    },
    meal: {
      breakfast: 'Kahvaltı',
      lunch: 'Öğle',
      dinner: 'Akşam',
      snack: 'Ara öğün',
      portion: { one: '%{count} porsiyon', other: '%{count} porsiyon' },
    },
    profil: {
      handle_label: 'Kullanıcı adı',
      handle_taken: 'Bu kullanıcı adı alınmış.',
      handle_invalid: 'Yalnız küçük harf, rakam, alt çizgi ve nokta.',
      handle_too_short: 'En az 3 karakter.',
      handle_too_long: 'En fazla 20 karakter.',
      handle_available: 'Kullanılabilir',
      display_name: 'Ad soyad',
      bio: 'Kısa bio',
      private_account: 'Gizli hesap',
      follow: 'Takip et',
      following: 'Takiptesin',
      requested: 'İstek gönderildi',
      start_tracking: 'Takibe başla',
      city_gate_title: 'Teslimat şehri',
      city_gate_only_izmir: 'Şu an yalnız İzmir’e teslimat var.',
    },
    ai_scan: {
      scanning: 'Analiz ediliyor…',
      result_estimate: 'Bu bir tahmin — kaydetmeden düzeltebilirsin.',
      quota_left: { one: 'Bugün %{count} tarama hakkın kaldı', other: 'Bugün %{count} tarama hakkın kaldı' },
      quota_empty: 'Günlük tarama hakkın bitti. Barkod veya elle giriş kullanabilirsin.',
      failed: 'Analiz başarısız oldu, hakkın iade edildi.',
      reset_at: 'Hakların %{time} sıfırlanır.',
    },
  },
  en: {
    common: {
      undo: 'Undo',
      cancel: 'Cancel',
      save: 'Save',
      retry: 'Retry',
      close: 'Close',
      estimate: 'estimate',
    },
    kesfet: {
      title: 'Discover',
      tab: { for_you: 'For you', following: 'Following' },
      empty: 'No posts yet.',
      empty_following: 'No posts from people you follow yet.',
      loadError: 'Could not load the feed.',
      liked: 'Liked',
      saved: 'Saved',
      add_to_day: 'Add to my day',
      added_toast: 'Logged to %{meal}',
      stats: {
        likes: { one: '%{count} like', other: '%{count} likes' },
        saves: { one: '%{count} save', other: '%{count} saves' },
        adds: { one: '%{count} add', other: '%{count} adds' },
      },
    },
    gun: {
      title: 'Day',
      rings_empty: 'No meals shared today.',
      share: 'Share to day',
      streak: { one: '%{count}-day streak', other: '%{count}-day streak' },
      card_expired: 'This card has expired.',
    },
    meal: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
      portion: { one: '%{count} portion', other: '%{count} portions' },
    },
    profil: {
      handle_label: 'Username',
      handle_taken: 'This username is taken.',
      handle_invalid: 'Only lowercase letters, digits, underscore and dot.',
      handle_too_short: 'At least 3 characters.',
      handle_too_long: 'At most 20 characters.',
      handle_available: 'Available',
      display_name: 'Full name',
      bio: 'Short bio',
      private_account: 'Private account',
      follow: 'Follow',
      following: 'Following',
      requested: 'Requested',
      start_tracking: 'Start tracking',
      city_gate_title: 'Delivery city',
      city_gate_only_izmir: 'We currently deliver only to İzmir.',
    },
    ai_scan: {
      scanning: 'Analyzing…',
      result_estimate: 'This is an estimate — you can fix it before saving.',
      quota_left: { one: '%{count} scan left today', other: '%{count} scans left today' },
      quota_empty: 'No scans left today. Use barcode or manual entry.',
      failed: 'Analysis failed, your scan was refunded.',
      reset_at: 'Resets at %{time}.',
    },
  },
};
