// G20-S1 — Rıza ve politika akışı metinleri (TR + EN). core/i18n/dictionaries.ts → `consent.*`.
// Reklam/kullanım ölçümü satır metinleri G19-S3 `metrics.consent.*` (aynı kaynak).
// Hukuki son okuma İlter'de (LOG SORULAR).

export const tr = {
  block: {
    accept_pre: '',
    terms: 'Kullanım Koşulları',
    accept_mid: '’nı ve ',
    privacy: 'Gizlilik Politikası',
    accept_post: '’nı okudum, kabul ediyorum.',
    accept_a11y: 'Kullanım Koşulları ve Gizlilik Politikası’nı kabul ediyorum',
    // G20-S3 md.2b + md.6: hesap oluşturma / giriş kutusu 18+ beyanını da içerir.
    accept_age_pre: '18 yaşından büyüğüm; ',
    accept_age_a11y: '18 yaşından büyüğüm; Kullanım Koşulları ve Gizlilik Politikası’nı kabul ediyorum',
    kvkk_pre: 'Kişisel verilerin ',
    kvkk: 'KVKK Aydınlatma Metni',
    kvkk_post: ' kapsamında işlenir.',
    ads_label: 'Reklam ölçümü (Meta)',
    ads_desc: 'Kampanyalarımızın etkisini ölçmek için. Varsayılan kapalı; açarsan istediğin zaman kapatabilirsin.',
    required: 'Devam etmek için koşulları kabul etmelisin.',
  },
  account: {
    ads_on: 'Reklam ölçümü (Meta) açık. ',
    ads_off: 'Reklam ölçümü (Meta) kapalı. ',
    details: 'Ayrıntılar',
  },
  sheet: {
    details_title: 'Politikalar ve izinler',
    details_lead: 'Devam etmek için Kullanım Koşulları ve Gizlilik Politikası’nı kabul etmelisin. Reklam ölçümünü buradan kapatabilirsin.',
    details_ok: 'Tamam',
    notice_title: 'Gizlilik ve izinler',
    notice_lead:
      'Kullanım Koşulları, Gizlilik Politikası ve reklam ölçümü tercihin tek yerde. Uygulamayı kullanmaya devam ederek koşulları kabul edersin.',
    notice_ok: 'Devam et',
    reconsent_title: 'Koşullarımız güncellendi',
    reconsent_lead: 'Devam etmek için güncel Kullanım Koşulları ve Gizlilik Politikası’nı okuyup kabul etmelisin.',
    reconsent_ok: 'Kabul et ve devam et',
    // G20-S3 md.2 (Apple 5.1.2(i)): ilk taramadan önce bir kez.
    // G23-S1 (İlter 10 Kas): metin sürümü 2 (fotoğraf + sesli giriş) — policy AI_PHOTO_TEXT_VERSION.
    ai_photo_title: 'Fotoğraf ve ses analizi',
    ai_photo_lead:
      'Tabak fotoğrafın (ve eklediğin not) ya da sesli girişinin metni, kalori tahmini için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir. Sesli giriş telefonun konuşma tanımasıyla yazıya çevrilir; ses kaydedilmez.',
    ai_photo_hint: 'Vazgeçersen öğününü elle girebilirsin. İzni Profil › Gizlilik › Veri ve reklam izinleri’nden geri alabilirsin.',
    ai_photo_ok: 'Kabul et',
    ai_photo_cancel: 'Vazgeç',
    // G24-S1 — kcalAI Koç ayrı AI izni. METİN İLTER ONAYI BEKLİYOR — tek kaynak burası.
    ai_coach_title: 'kcalAI Koç ve yapay zekâ',
    ai_coach_lead:
      'Koça yazdıkların ve günlük takip özetin, yanıt üretmek için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir.',
    ai_coach_hint: 'Vazgeçersen koça mesaj gönderilmez. İzni Profil › Gizlilik › Veri ve reklam izinleri’nden geri alabilirsin.',
    ai_coach_ok: 'Kabul et',
    ai_coach_cancel: 'Vazgeç',
    privacy_link: 'Gizlilik Politikası',
    close: 'Kapat',
  },
  settings: {
    row: 'Veri ve reklam izinleri',
    row_sub: 'Kullanım ölçümü ve reklam ölçümü',
    title: 'Veri ve reklam izinleri',
    measure_section: 'Ölçüm',
    ai_section: 'Yapay zekâ',
    ai_photo_label: 'Fotoğraf ve ses analizi',
    ai_coach_label: 'kcalAI Koç',
    ai_photo_desc: 'Tabak fotoğrafın (ve eklediğin not) ya da sesli girişinin metni, kalori tahmini için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir. Sesli giriş telefonun konuşma tanımasıyla yazıya çevrilir; ses kaydedilmez.',
    docs_section: 'Metinler',
    footer: 'Tercihlerin hesabına kaydedilir; istediğin zaman değiştirebilirsin.',
    error: 'Tercih kaydedilemedi. Tekrar dene.',
  },
  // G20-S3 md.6 (B-11): pazarlama bildirimi ayrı onay, varsayılan KAPALI.
  marketing: {
    label: 'Kampanya ve fırsat bildirimleri de gelsin',
    hint: 'İstediğin zaman Bildirim ayarlarından kapatabilirsin.',
  },
};

export const en: typeof tr = {
  block: {
    accept_pre: 'I have read and accept the ',
    terms: 'Terms of Use',
    accept_mid: ' and the ',
    privacy: 'Privacy Policy',
    accept_post: '.',
    accept_a11y: 'I accept the Terms of Use and the Privacy Policy',
    accept_age_pre: 'I am 18 or older and I have read and accept the ',
    accept_age_a11y: 'I am 18 or older and accept the Terms of Use and the Privacy Policy',
    kvkk_pre: 'Your personal data is processed as described in the ',
    kvkk: 'KVKK Privacy Notice',
    kvkk_post: '.',
    ads_label: 'Ad measurement (Meta)',
    ads_desc: 'To measure how our campaigns perform. Off by default; if you turn it on, you can turn it off any time.',
    required: 'Please accept the terms to continue.',
  },
  account: {
    ads_on: 'Ad measurement (Meta) is on. ',
    ads_off: 'Ad measurement (Meta) is off. ',
    details: 'Details',
  },
  sheet: {
    details_title: 'Policies and permissions',
    details_lead: 'To continue, please accept the Terms of Use and the Privacy Policy. You can turn ad measurement off here.',
    details_ok: 'Done',
    notice_title: 'Privacy and permissions',
    notice_lead:
      'Your Terms of Use, Privacy Policy and ad measurement choice, all in one place. By continuing to use the app you accept the terms.',
    notice_ok: 'Continue',
    reconsent_title: 'Our terms have been updated',
    reconsent_lead: 'To continue, please read and accept the updated Terms of Use and Privacy Policy.',
    reconsent_ok: 'Accept and continue',
    ai_photo_title: 'Photo and voice analysis',
    ai_photo_lead:
      'Your plate photo (and any note you add), or the text of your voice entry, is sent to our AI service provider (USA) to estimate calories. Voice entry is converted to text by your phone’s speech recognition; audio is not recorded.',
    ai_photo_hint: 'If you cancel, you can enter your meal manually. You can withdraw this in Profile › Privacy › Data and ad permissions.',
    ai_photo_ok: 'Accept',
    ai_photo_cancel: 'Cancel',
    ai_coach_title: 'kcalAI Coach and AI',
    ai_coach_lead:
      'What you write to the coach and a summary of your daily tracking are sent to our AI service provider (USA) to generate replies.',
    ai_coach_hint: 'If you cancel, nothing is sent to the coach. You can withdraw this in Profile › Privacy › Data and ad permissions.',
    ai_coach_ok: 'Accept',
    ai_coach_cancel: 'Cancel',
    privacy_link: 'Privacy Policy',
    close: 'Close',
  },
  settings: {
    row: 'Data and ad permissions',
    row_sub: 'Usage analytics and ad measurement',
    title: 'Data and ad permissions',
    measure_section: 'Measurement',
    ai_section: 'AI',
    ai_photo_label: 'Photo and voice analysis',
    ai_coach_label: 'kcalAI Coach',
    ai_photo_desc: 'Your plate photo (and any note you add), or the text of your voice entry, is sent to our AI service provider (USA) to estimate calories. Voice entry is converted to text by your phone’s speech recognition; audio is not recorded.',
    docs_section: 'Documents',
    footer: 'Your choices are saved to your account; you can change them any time.',
    error: 'Couldn’t save your choice. Try again.',
  },
  marketing: {
    label: 'Also send me offers and campaign notifications',
    hint: 'You can turn this off any time in notification settings.',
  },
};
