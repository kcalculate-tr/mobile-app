import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const sections = [
  {
    title: '4) KİŞİSEL VERİLERİN KORUNMASI (KVKK) AYDINLATMA METNİ VE GİZLİLİK POLİTİKASI',
    items: [
      {
        subtitle: 'Madde 4.1. Veri Sorumlusunun Kimliği',
        text:
          '6698 Sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, Basın Sitesi Mahallesi 177/3. Sokak No:3/A Karabağlar İzmir adresinde mukim, 7591148741 vergi kimlik numaralı SEKÜLART SAĞLIKLI GIDA ÜRÜNLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ (KCAL) "Veri Sorumlusu" sıfatıyla, kişisel verilerinizi işbu aydınlatma metninde açıklanan amaçlar, sınırlar ve hukuki şartlar dâhilinde işlemektedir.',
      },
      {
        subtitle: 'Madde 4.2. İşlenen Kişisel Veriler ve Toplama Yöntemleri',
        text:
          'Veri Sorumlusu tarafından elektronik ortamda (mobil uygulama, web sitesi, çağrı merkezi, e-posta) tamamen veya kısmen otomatik yollarla toplanan verileriniz şunlardır:',
        list: [
          'a) Kimlik ve İletişim Verileri: Ad, soyad, telefon numarası, e-posta adresi.',
          'b) İşlem ve Teslimat Verileri: Teslimat/Fatura adresi, sipariş geçmişi, konum bilgisi (izin verilmesi halinde).',
          'c) Kullanım ve Güvenlik Verileri: Cihaz bilgileri, IP adresi, log kayıtları.',
          'd) Özel Nitelikli Veriler (Rızaya Tabi): Tüketici\'nin kendi rızasıyla girdiği yaş, boy, kilo, cinsiyet ve diyet hedefi verileri.',
        ],
      },
      {
        subtitle: 'Madde 4.3. Kişisel Verilerin İşlenme Amaçları',
        text:
          'Toplanan kişisel verileriniz, KVKK\'nın 4. maddesindeki genel ilkelere uygun olarak;',
        list: [
          'Üyelik kayıtlarının oluşturulması ve hesap güvenliğinin sağlanması,',
          'Mesafeli Satış Sözleşmesi\'nin ifası, siparişin hazırlanması ve adrese teslimatının organize edilmesi,',
          'Fatura, e-arşiv fatura düzenlenmesi ve vergi mevzuatından doğan yasal yükümlülüklerin yerine getirilmesi,',
          'Tüketici talep ve şikayetlerinin yönetilmesi,',
          '(Ayrıca Açık Rıza verilmesi halinde) Sadakat programı ("Makro Puanlar") yönetimi, Kcal Tracker kişiselleştirilmiş kalori/makro hesaplamalarının yapılması ve ticari elektronik ileti gönderimi amaçlarıyla işlenmektedir.',
        ],
      },
      {
        subtitle: 'Madde 4.4. İşlemenin Hukuki Sebepleri',
        text:
          'Kişisel verileriniz, KVKK\'nın 5. maddesinin 2. fıkrasında yer alan; (c) bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması kaydıyla, sözleşmenin taraflarına ait kişisel verilerin işlenmesinin gerekli olması, (ç) veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması, (f) ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması hukuki sebeplerine dayanılarak işlenmektedir. Özel nitelikli olarak değerlendirilebilecek fiziksel ölçüm (boy, kilo vb.) verileriniz ise yalnızca KVKK m. 6 uyarınca "Açık Rıza" hukuki sebebine dayanılarak işlenmektedir.',
      },
      {
        subtitle: 'Madde 4.5. Kişisel Verilerin Aktarımı (KVKK m. 8 ve 9)',
        text:
          'KCAL, kişisel verilerinizi kesinlikle ticari amaçla üçüncü kişilere satmaz. Verileriniz, işbu metindeki amaçların gerçekleştirilmesiyle sınırlı olarak; kurye/lojistik firmalarıyla (yalnızca adres ve telefon), ödeme kuruluşlarıyla, bilişim altyapı hizmeti (sunucu, bulut, SMS/e-posta entegratörleri) alınan iş ortaklarıyla ve talep halinde kanunen yetkili kamu kurum ve kuruluşlarıyla, gerekli teknik ve idari tedbirler alınarak paylaşılabilir.',
      },
      {
        subtitle: 'Madde 4.6. İlgili Kişinin Hakları ve Başvuru Usulü',
        text:
          'KVKK\'nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, eksik/yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini talep etme haklarına sahipsiniz. Başvurularınızı, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ\'e uygun olarak info@eatkcal.com e-posta adresine veya Satıcı\'nın resmi posta adresine yazılı olarak iletebilirsiniz.',
      },
    ],
  },
  {
    title: '6) TİCARİ ELEKTRONİK İLETİ ONAYI VE AÇIK RIZA BEYANI',
    note: '(Opsiyonel onay metni)',
    items: [
      {
        subtitle: 'Madde 6.1. Ticari Elektronik İleti Onayı',
        text:
          '6563 Sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili mevzuat uyarınca; SEKÜLART SAĞLIKLI GIDA ÜRÜNLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ ("KCAL") tarafından sunulan mal ve hizmetlerin tanıtımı, pazarlanması, indirim, promosyon, kampanya ve özel tekliflerin tarafıma sunulması, "Makro Puan" sadakat programı avantajları hakkında bilgilendirme yapılması ve müşteri memnuniyet anketlerinin iletilmesi amaçlarıyla; tarafıma SMS (kısa mesaj), e-posta, sesli arama ve mobil uygulama içi bildirim yöntemleriyle ticari elektronik ileti gönderilmesine, iletişim verilerimin bu amaçla işlenmesine ve hizmet sağlayıcı entegratörlerle paylaşılmasına özgür irademle onay veriyorum.',
      },
      {
        subtitle: 'Madde 6.2. Reddetme Hakkı (Opt-Out)',
        text:
          'Tarafıma gönderilecek ticari elektronik iletilerde yer alacak yönlendirmeler (Örn: "İptal için RET yazıp xxxx\'e gönderin") veya İleti Yönetim Sistemi (İYS) e-Devlet kapısı üzerinden dilediğim zaman, hiçbir gerekçe göstermeksizin bu onayı geri çekebileceğimi ve ileti almayı ücretsiz olarak durdurabileceğimi biliyor ve anlıyorum.',
      },
      {
        subtitle: 'Madde 6.3. Kişisel Sağlık/Fiziksel Verilerin İşlenmesine İlişkin Açık Rıza',
        text:
          '"Kcal Tracker" özelliği kapsamında sistemin günlük kalori hedefimi, protein, karbonhidrat ve yağ (makro) dengemi hesaplayabilmesi ve bana özel, kişiselleştirilmiş bir kullanıcı deneyimi sunabilmesi amacıyla; uygulamaya tamamen kendi rızamla gireceğim "yaş, boy, kilo, cinsiyet ve diyet hedefi" verilerimin, 6698 Sayılı KVKK\'nın 6. maddesi kapsamında KCAL tarafından işlenmesine, kaydedilmesine ve bu hesaplamalar için algoritmik olarak analiz edilmesine açık rıza gösteriyorum.',
      },
    ],
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-bg pb-10 text-brand-dark">
      <header className="sticky top-0 z-30 border-b border-brand-white/10 bg-brand-bg/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-white shadow-sm"
            aria-label="Geri Dön"
          >
            <ChevronLeft size={18} className="text-brand-dark" />
          </button>
          <h1 className="mb-0 px-2 text-center font-zalando text-lg font-semibold text-brand-primary">KVKK ve Gizlilik Politikası</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[430px] space-y-4 px-4 pt-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl bg-brand-white p-4 shadow-sm">
            <h2 className="mb-1 font-zalando text-base font-semibold text-brand-primary">{section.title}</h2>
            {section.note ? (
              <p className="mb-3 font-google text-xs text-brand-dark/60">{section.note}</p>
            ) : null}
            <div className="space-y-4">
              {section.items.map((item) => (
                <div key={item.subtitle} className="space-y-2">
                  <h3 className="mb-0 font-zalando text-sm font-semibold text-brand-dark">{item.subtitle}</h3>
                  {item.text ? (
                    <p className="mb-0 font-google text-sm leading-relaxed text-brand-dark/75">{item.text}</p>
                  ) : null}
                  {item.list ? (
                    <ul className="mb-0 list-disc space-y-1 pl-5 font-google text-sm leading-relaxed text-brand-dark/75">
                      {item.list.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
