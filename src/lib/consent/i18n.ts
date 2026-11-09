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
    kvkk_pre: 'Kişisel verilerin ',
    kvkk: 'KVKK Aydınlatma Metni',
    kvkk_post: ' kapsamında işlenir.',
    ads_label: 'Reklam ölçümü (Meta)',
    ads_desc: 'Kampanyalarımızın etkisini ölçmek için. İstediğin zaman kapatabilirsin.',
    required: 'Devam etmek için koşulları kabul etmelisin.',
  },
  account: {
    ads_on: 'Reklam ölçümü (Meta) açık · ',
    ads_off: 'Reklam ölçümü (Meta) kapalı · ',
    details: 'Ayrıntılar',
  },
  sheet: {
    details_title: 'Politikalar ve izinler',
    details_lead: 'Devam ederek Kullanım Koşulları ve Gizlilik Politikası’nı kabul edersin. Reklam ölçümünü buradan kapatabilirsin.',
    details_ok: 'Tamam',
    notice_title: 'Gizlilik ve izinler',
    notice_lead:
      'Kullanım Koşulları, Gizlilik Politikası ve reklam ölçümü tercihin tek yerde. Uygulamayı kullanmaya devam ederek koşulları kabul edersin.',
    notice_ok: 'Devam et',
    reconsent_title: 'Koşullarımız güncellendi',
    reconsent_lead: 'Devam etmek için güncel Kullanım Koşulları ve Gizlilik Politikası’nı okuyup kabul etmelisin.',
    reconsent_ok: 'Kabul et ve devam et',
    close: 'Kapat',
  },
  settings: {
    row: 'Veri ve reklam izinleri',
    row_sub: 'Kullanım ölçümü ve reklam ölçümü',
    title: 'Veri ve reklam izinleri',
    measure_section: 'Ölçüm',
    docs_section: 'Metinler',
    att_denied: 'iPhone’da izleme izni verilmediği için reklam ölçümü kapalı. Açmak için iPhone Ayarları’na git.',
    att_open: 'iPhone Ayarları’nı aç',
    footer: 'Tercihlerin hesabına kaydedilir; istediğin zaman değiştirebilirsin.',
    error: 'Tercih kaydedilemedi. Tekrar dene.',
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
    kvkk_pre: 'Your personal data is processed as described in the ',
    kvkk: 'KVKK Privacy Notice',
    kvkk_post: '.',
    ads_label: 'Ad measurement (Meta)',
    ads_desc: 'To measure how our campaigns perform. You can turn it off any time.',
    required: 'Please accept the terms to continue.',
  },
  account: {
    ads_on: 'Ad measurement (Meta) on · ',
    ads_off: 'Ad measurement (Meta) off · ',
    details: 'Details',
  },
  sheet: {
    details_title: 'Policies and permissions',
    details_lead: 'By continuing you accept the Terms of Use and the Privacy Policy. You can turn ad measurement off here.',
    details_ok: 'Done',
    notice_title: 'Privacy and permissions',
    notice_lead:
      'Your Terms of Use, Privacy Policy and ad measurement choice, all in one place. By continuing to use the app you accept the terms.',
    notice_ok: 'Continue',
    reconsent_title: 'Our terms have been updated',
    reconsent_lead: 'To continue, please read and accept the updated Terms of Use and Privacy Policy.',
    reconsent_ok: 'Accept and continue',
    close: 'Close',
  },
  settings: {
    row: 'Data and ad permissions',
    row_sub: 'Usage analytics and ad measurement',
    title: 'Data and ad permissions',
    measure_section: 'Measurement',
    docs_section: 'Documents',
    att_denied: 'Ad measurement is off because tracking isn’t allowed on this iPhone. Go to iPhone Settings to turn it on.',
    att_open: 'Open iPhone Settings',
    footer: 'Your choices are saved to your account; you can change them any time.',
    error: 'Couldn’t save your choice. Try again.',
  },
};
