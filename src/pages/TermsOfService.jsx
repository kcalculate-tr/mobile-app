import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const sections = [
  {
    title: '3) MESAFELİ SATIŞ SÜRECİ VE ÖN BİLGİLENDİRME SÖZLEŞMESİ ONAYI',
    items: [
      {
        subtitle: 'Madde 3.1. Ön Bilgilendirme Yükümlülüğünün İfası',
        text:
          'İşbu uygulama üzerinden sipariş oluşturan Kullanıcı/Tüketici, 29188 Sayılı Mesafeli Sözleşmeler Yönetmeliği\'nin 5. maddesi gereğince; Satıcı\'ya ait unvan, açık adres, iletişim ve MERSİS/Vergi numarası bilgilerini, sözleşme konusu malın temel niteliklerini, vergiler dahil Türk Lirası cinsinden toplam peşin satış fiyatını, teslimat ve kargo masraflarını ve Yönetmeliğin 15/1-c maddesi gereği "Cayma Hakkı"nın bulunmadığına ilişkin hususları siparişin onaylanması ve ödeme yükümlülüğü altına girmeden hemen önce açık, anlaşılır ve elektronik ortama uygun şekilde okuduğunu, anladığını ve elektronik onayı ile teyit ettiğini gayrikabili rücu kabul, beyan ve taahhüt eder.',
      },
      {
        subtitle: 'Madde 3.2. Sözleşmenin Kurulması',
        text:
          'Tüketici\'nin ödeme sayfasında yer alan "Mesafeli Satış Sözleşmesi\'ni okudum, onaylıyorum" (veya türevi) ibareli kutucuğu işaretlemesi ve "Siparişi Tamamla / Öde" butonuna basmasıyla birlikte taraflar arasında 6502 Sayılı Kanun m. 48 uyarınca Mesafeli Satış Sözleşmesi hukuken geçerli olarak kurulmuş sayılır.',
      },
    ],
  },
  {
    title: '5) KULLANIM KOŞULLARI VE HİZMET SÖZLEŞMESİ',
    items: [
      {
        subtitle: 'Madde 5.1. Sözleşmenin Konusu ve Taraflar',
        text:
          'İşbu Kullanım Koşulları ve Hizmet Sözleşmesi ("Sözleşme"), SEKÜLART SAĞLIKLI GIDA ÜRÜNLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ ("KCAL") ile uygulamanın sunduğu hizmetlerden faydalanmak üzere kayıt olan veya ziyaretçi olarak platformu kullanan gerçek kişi ("Kullanıcı/Tüketici") arasındaki karşılıklı hak ve yükümlülükleri düzenler.',
      },
      {
        subtitle: 'Madde 5.2. Yaş Sınırı ve Ehliyet',
        text:
          'Türk Medeni Kanunu uyarınca tam ehliyetli olmayan kişilerin platform üzerinden alışveriş yapması ve sözleşme akdetmesi yasaktır. Platforma üye olan ve ödeme adımlarını tamamlayan Kullanıcı, 18 yaşını doldurmuş olduğunu gayrikabili rücu kabul, beyan ve taahhüt eder. Reşit olmayan kişilerin veli/vasi onayı olmaksızın platformu kullanımı sonucunda doğacak hukuki ve cezai uyuşmazlıklardan KCAL sorumlu tutulamaz.',
      },
      {
        subtitle: 'Madde 5.3. Hizmet Modeli (Abonelik Kapsamı) ve Ödemeler',
        text:
          'Platform üzerinde "Abonelik" veya "Paket" olarak adlandırılan sistem, Tüketici\'nin kendi rızasıyla ve manuel onayıyla satın aldığı “Ön Ödemeli Toplu Öğün Paketleri”ni ifade eder. KCAL sistemleri, 6502 Sayılı Kanun kapsamındaki Abonelik Sözleşmeleri Yönetmeliği hükümlerine tabi olacak şekilde Kullanıcı\'nın kredi veya banka kartından otomatik ve tekrarlayan (recurring) tahsilat işlemi gerçekleştirmez. Her paket yenilemesi Kullanıcı\'nın anlık aktif onayı ve şifreli (3D Secure) onayı ile gerçekleşir. KCAL, Tüketici\'nin kredi kartı numarası, CVV veya son kullanma tarihi gibi hassas ödeme verilerini kendi sistemlerinde depolamaz.',
      },
      {
        subtitle: 'Madde 5.4. Sorumluluğun Sınırlandırılması (Tıbbi/Alerjen Beyanları)',
        text:
          'Platform içerisinde sunulan "Kcal Tracker", makro besin hesaplamaları, kalori açığı oluşturma grafikleri tamamen algoritmik ve genel bilgilendirme amaçlıdır; hiçbir surette tıbbi tavsiye, teşhis veya profesyonel diyetisyen/hekim hizmeti niteliği taşımaz. Üretilen tüm gıdalar aynı mutfak tesislerinde hazırlanmakta olup, her ne kadar hijyen standartlarına uyulsa da "çapraz bulaşma" (cross-contamination) riski barındırmaktadır. Gluten, laktoz, yer fıstığı vb. ciddi gıda anafilaksisi ve ileri seviye çölyak gibi rahatsızlıkları bulunan kullanıcıların platformdan sipariş vermeden önce kendi hekimlerine danışmaları zorunludur. Tüketici tarafından beyan edilmeyen veya çapraz bulaşma riski bilindiği halde sipariş verilmesi sonucu oluşabilecek alerjik reaksiyonlar ve sağlık problemlerinden KCAL hiçbir hukuki sorumluluk kabul etmez.',
      },
      {
        subtitle: 'Madde 5.5. Uyuşmazlıkların Çözümü ve Yetkili Merci',
        text:
          'İşbu Sözleşme\'nin uygulanmasından ve yorumlanmasından doğacak her türlü hukuki uyuşmazlıkta Türkiye Cumhuriyeti kanunları uygulanacaktır. Uyuşmazlık halinde, her yıl Ticaret Bakanlığı tarafından ilan edilen parasal sınırlar dâhilinde Tüketici\'nin yerleşim yerindeki veya işlemin yapıldığı yerdeki Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir.',
      },
    ],
  },
];

export default function TermsOfService() {
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
          <h1 className="mb-0 px-2 text-center font-zalando text-lg font-semibold text-brand-primary">Kullanım Koşulları</h1>
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
                  <p className="mb-0 font-google text-sm leading-relaxed text-brand-dark/75">{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
