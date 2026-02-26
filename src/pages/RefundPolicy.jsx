import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const sections = [
  {
    title: "1) İPTAL, İADE VE DEĞİŞİM POLİTİKASI (GIDA ÜRÜNLERİ)",
    items: [
      {
        subtitle: 'Madde 1.1. Kapsam ve Dayanak',
        text: `İşbu Politika; merkezi Basın Sitesi Mahallesi 177/3. Sokak No:3/A Karabağlar İzmir adresinde bulunan, 7591148741 vergi kimlik numaralı SEKÜLART SAĞLIKLI GIDA ÜRÜNLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ (Bundan böyle "KCAL" veya "Satıcı" olarak anılacaktır) ile KCAL mobil uygulaması üzerinden sipariş veren Kullanıcı/Tüketici arasındaki iptal, iade ve değişim süreçlerini, 6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili mevzuat hükümleri çerçevesinde düzenlemektedir. İşbu politika, satışı yapılan tekil öğünler, günlük menüler, ön ödemeli öğün paketleri ve benzeri tüm gıda ürünlerini kapsar.`,
      },
      {
        subtitle: 'Madde 1.2. Cayma Hakkı İstisnası (Yasal Düzenleme)',
        text: `KCAL platformu üzerinden satışı gerçekleştirilen ürünler, sipariş üzerine günlük hazırlanan taze gıda ürünleridir. Bu itibarla, 27.11.2014 tarihli ve 29188 sayılı Resmi Gazete’de yayımlanan Mesafeli Sözleşmeler Yönetmeliği’nin "Cayma Hakkının İstisnaları" başlıklı 15. maddesinin 1. fıkrasının (c) bendi (“Çabuk bozulabilen veya son kullanma tarihi geçebilecek malların teslimine ilişkin sözleşmeler”) amir hükmü gereğince, Tüketici'nin teslim aldığı gıda ürünlerinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin kullanabileceği cayma hakkı bulunmamaktadır. Tüketici, siparişi onayladığı an itibarıyla bu yasal istisnayı bildiğini ve kabul ettiğini beyan eder.`,
      },
      {
        subtitle: 'Madde 1.3. Sipariş İptali Koşulları ve Süreleri',
        list: [
          `a) Tekil Siparişlerde: Tüketici, oluşturduğu siparişi yalnızca uygulama üzerinde sipariş durumu “Hazırlanıyor / Üretimde” aşamasına geçmeden önce iptal etme hakkına sahiptir. Siparişin üretim sürecine girmesiyle birlikte, gıda güvenliği ve stok/üretim planlaması gereği iptal talepleri işleme alınmayacaktır.`,
          `b) Ön Ödemeli Paket Siparişlerinde: Öğün paketleri (halk arasındaki tabiriyle abonelikler), ilk sipariş teslimatı ile aktive olana kadar iptal edilebilir. Paket aktive edildikten ve ilk teslimat ifa edildikten sonra, Tüketici'nin kalan günlere ilişkin keyfi iptal ve iade talebi kabul edilmez (Ayıplı ifa hükümleri saklıdır). Süresi içinde usulüne uygun yapılan iptallerde tahsil edilen bedel, KCAL tarafından ödeme aracısı kurumun prosedürlerine uygun olarak iade edilir.`,
        ],
      },
      {
        subtitle: 'Madde 1.4. Ayıplı Mal İhbarı ve İade/Değişim Prosedürü',
        text: `6502 Sayılı Kanun'un 8. maddesi uyarınca ambalajında, etiketinde veya niteliğinde yer alan eksiklikler nedeniyle vaat edilen özellikleri taşımayan, bozuk veya hatalı ürünler "Ayıplı Mal" statüsündedir. Gıda ürünlerinin doğası gereği Tüketici, ayıplı mal ihbarını kanuni süreler içinde ve aşağıdaki katı ispat kurallarına uygun olarak yapmakla yükümlüdür:`,
        list: [
          `Zorunlu Bildirim Süresi: İhbarın, ürün teslim alındığı anda veya paketin ilk açıldığı saniyelerde (ürün tüketilmeden önce) yapılması zorunludur.`,
          `İspat Yükümlülüğü: Ayıp iddiası; fotoğraf veya video kaydı ile belgelendirilmeli ve derhal uygulama içerisindeki "Hesabım > Destek Talebi Oluştur" sekmesi üzerinden Satıcı'ya iletilmelidir.`,
          `Satıcı tarafından yapılacak inceleme neticesinde ayıp iddiasının haklı bulunması halinde, 6502 Sayılı Kanun'un 11. maddesindeki Tüketici'nin seçimlik hakları uyarınca KCAL; (i) ürünün ayıpsız misli ile değişimi, (ii) bedel iadesi veya (iii) Tüketici'nin rızasıyla müşteri hesabına kredi/bakiye tanımlama işlemlerinden birini derhal ifa eder.`,
        ],
      },
      {
        subtitle: 'Madde 1.5. Muhafaza Yükümlülüğü ve Sorumluluğun Reddi',
        text: `Ürünlerin Tüketici'ye (veya Tüketici'nin yönlendirdiği üçüncü kişiye) fiziki teslimi anından itibaren tüm hasar ve muhafaza sorumluluğu Tüketici'ye geçer. Ürünlerin ambalajı üzerinde yer alan saklama koşullarına (+4°C buzdolabında muhafaza vb.) uyulmaması, ürünün makul süre dışında bekletilmesi veya teslimden sonra tüketici kusuruyla bozulan ürünler için KCAL hiçbir hukuki ve maddi sorumluluk kabul etmez. Lezzet, koku gibi sübjektif damak tadı gerekçeleri "Ayıplı Mal" kapsamında değerlendirilmez ve iade sebebi yapılamaz.`,
      },
    ],
  },
  {
    title: '2) TESLİMAT VE TESLİM ALMA POLİTİKASI',
    items: [
      {
        subtitle: 'Madde 2.1. Teslimat Yöntemleri ve Zaman Çerçevesi',
        text: `KCAL, Tüketici tarafından oluşturulan siparişleri, uygulamada belirtilen sınırlar dâhilinde kurye vasıtasıyla adrese veya Tüketici'nin bizzat teslim alacağı "Gel-Al (Pickup)" noktalarına teslim etmekle yükümlüdür. Teslimat, Tüketici'nin sipariş esnasında seçmiş olduğu zaman penceresi (randevu aralığı) içerisinde ifa edilir.`,
      },
      {
        subtitle: 'Madde 2.2. Alıcının Adreste Bulunamaması (Temerrüt Hali)',
        text: `Tüketici'nin seçtiği randevu saatinde bildirdiği teslimat adresinde bulunmaması ve KCAL sistemlerinde kayıtlı telefon numarasından (en az 2 defa aranmasına rağmen) kendisine ulaşılamaması durumu, Türk Borçlar Kanunu kapsamında "Alacaklının Temerrüdü" (m. 97 vd.) olarak kabul edilir. Bu halde:`,
        list: [
          `a) Kurye, çabuk bozulabilen nitelikteki ürünü güvenli muhafaza amacıyla en yakın KCAL "Gel-Al (Pickup)" noktasına iade eder.`,
          `b) Hasarın ve ürünün muhafaza riskinin Tüketici'ye geçiş anı, kuryenin adrese ulaştığı ve teslimatı gerçekleştiremediği an olarak kabul edilir.`,
          `c) Tüketici, söz konusu ürünü aynı gün saat 22:00'a kadar ilgili Gel-Al noktasından bizzat teslim almakla yükümlüdür. Bu süre zarfında teslim alınmayan gıda ürünleri imha edilir ve Tüketici'ye hiçbir surette bedel iadesi veya yeni ürün gönderimi yapılmaz.`,
        ],
      },
      {
        subtitle: 'Madde 2.3. Teslimat Anında Kontrol Yükümlülüğü',
        text: `Tüketici (veya teslim alan kişi), ürünü kuryeden teslim alırken ambalajın kapalı, sağlam ve hasarsız olduğunu kontrol etmekle yükümlüdür. Ezilmiş, yırtılmış, açılmış veya akmış ambalajlar teslim alınmamalı ve kurye nezaretinde tutanak veya anlık görsel bildirim ile kayıt altına alınmalıdır.`,
      },
      {
        subtitle: 'Madde 2.4. Mücbir Sebepler (Force Majeure)',
        text: `Türk Borçlar Kanunu uyarınca tarafların iradesi dışında gelişen, önceden öngörülemeyen ve borcun ifasını imkânsızlaştıran veya aşırı derecede zorlaştıran afetler, aşırı hava muhalefeti, resmi makam kararları, genel grev ve lokavt gibi haller mücbir sebep sayılır. Bu hallerde KCAL teslimatı erteleme, iptal etme veya telafi günü ekleme hakkını saklı tutar; Tüketici bu gecikmelerden dolayı tazminat talebinde bulunamaz.`,
      },
    ],
  },
];

export default function RefundPolicy() {
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
          <h1 className="mb-0 px-2 text-center font-zalando text-lg font-semibold text-brand-primary">İptal ve İade Politikası</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[430px] space-y-4 px-4 pt-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl bg-brand-white p-4 shadow-sm">
            <h2 className="mb-3 font-zalando text-base font-semibold text-brand-primary">{section.title}</h2>
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
