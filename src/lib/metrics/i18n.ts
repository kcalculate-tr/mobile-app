// G19-S3 — Ölçüm/rıza metinleri (TR + EN). core/i18n/dictionaries.ts → `metrics.*`.
// Ekran tasarımı bu gece YOK: metinler ayar ekranı (Gizlilik › Ölçüm) ve
// ilk açılış bilgilendirmesi bağlandığında kullanılacak. Hukuki son okuma: LOG SORULAR.

export const tr = {
  kvkk: {
    title: 'Kullanım ölçümü hakkında aydınlatma',
    body:
      'KCAL, uygulamanın nasıl kullanıldığını anlamak ve hizmeti iyileştirmek için birinci taraf kullanım ölçümü yapar. ' +
      'Bu kapsamda açılan ekranlar, sepete ekleme, ödeme adımları, tarama ve kayıt gibi uygulama içi olaylar; ' +
      'cihazına özel rastgele bir kimlik, oturum kimliği, platform ve uygulama sürümüyle birlikte KCAL sunucularında işlenir. ' +
      'Adın, telefonun, e-postan, adresin, konumun ve beslenme kayıtlarının içeriği bu ölçüme eklenmez. ' +
      'Veriler 6698 sayılı KVKK md. 5/2-f (meşru menfaat) kapsamında işlenir ve işleme amacının gerektirdiği süre boyunca saklanır. ' +
      'Kullanım ölçümünü Ayarlar › Gizlilik bölümünden istediğin zaman kapatabilir, KVKK md. 11 kapsamındaki haklarını ' +
      'info@eatkcal.com adresine yazarak kullanabilirsin.',
    more: 'Aydınlatma metninin tamamı',
  },
  consent: {
    section: 'Ölçüm ve reklam',
    analytics_label: 'Kullanım ölçümü',
    analytics_desc: 'Uygulamayı iyileştirmek için anonim kullanım olayları (birinci taraf).',
    ads_label: 'Reklam ölçümü (Meta)',
    ads_desc:
      'Reklamlarımızın etkisini ölçmek için ürün görüntüleme, sepete ekleme ve satın alma olayları Meta ile paylaşılır. ' +
      'Açık rızana dayanır; istediğin zaman kapatabilirsin.',
    ads_att_off: 'iPhone ayarlarında "Uygulamaların İzlemeyi İstemesine İzin Ver" kapalı olduğu için reklam ölçümü kapalı.',
    saved: 'Tercihin kaydedildi',
  },
};

export const en: typeof tr = {
  kvkk: {
    title: 'Notice on usage analytics',
    body:
      'KCAL uses first-party usage analytics to understand how the app is used and to improve the service. ' +
      'In-app events such as screens opened, add to cart, checkout steps, scans and logs are processed on KCAL servers ' +
      'together with a random device-specific ID, a session ID, the platform and the app version. ' +
      'Your name, phone, email, address, location and the content of your nutrition logs are not included. ' +
      'Data is processed under Article 5/2-f of Turkish Law No. 6698 (legitimate interest) and stored only as long as that purpose requires. ' +
      'You can turn usage analytics off any time in Settings › Privacy, and exercise your rights under Article 11 ' +
      'by writing to info@eatkcal.com.',
    more: 'Full privacy notice',
  },
  consent: {
    section: 'Analytics and ads',
    analytics_label: 'Usage analytics',
    analytics_desc: 'Anonymous usage events to improve the app (first party).',
    ads_label: 'Ad measurement (Meta)',
    ads_desc:
      'Product views, add to cart and purchase events are shared with Meta to measure our ads. ' +
      'Based on your explicit consent; you can turn it off any time.',
    ads_att_off: 'Ad measurement is off because "Allow Apps to Request to Track" is turned off in iPhone settings.',
    saved: 'Preference saved',
  },
};
