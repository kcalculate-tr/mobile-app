import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const FAQ_DATA = [
  {
    category: '📦 1. Sipariş ve Teslimat Süreci',
    items: [
      { q: 'Randevulu teslimat nasıl oluyor?', a: "Saat 13:00'a kadar verilen siparişlerde aynı gün 18:00 - 22:00 aralığı seçilebilir. 13:00 sonrası siparişlerde ise ertesi günden itibaren 09:00 - 22:00 arası için randevu oluşturulabilir. Öğünler tazeliğini koruması için soğuk teslim edilir." },
      { q: 'Hemen teslimat nerelere yapılıyor ve ne kadar sürüyor?', a: 'Şu an Konak, Karabağlar, Buca ve Balçova ilçelerine yapılmaktadır. Teslimat süresi ortalama 35-45 dakikadır. (Kesin uygunluk ödeme adımında gösterilir).' },
      { q: 'Gel-Al (Pickup) noktalarınız nerede?', a: 'Siparişlerinizi Karabağlar Basın Sitesi 177/3. Sk. No:3/A adresimizden teslim alabilirsiniz.' },
      { q: 'Teslimat saatleriniz nelerdir?', a: 'Hafta içi her gün 09:00 - 22:00 saatleri arasındadır. Cumartesi ve pazar hizmetimiz bulunmamaktadır şu anda.' },
      { q: 'Seçtiğim teslimat saatinde evde yoksam ne olur?', a: 'Kuryemiz sizi arayarak onayınızı alır ve siparişi kapıya/komşuya bırakabilir (Sorumluluk size aittir). Size ulaşılamazsa ürünler en yakın Gel-Al noktasına bırakılır. Gün içinde teslim alınmayan ürünler için iptal veya iade yapılamaz.' },
    ],
  },
  {
    category: '🍱 2. Ürünler, Tüketim ve Isıtma',
    items: [
      { q: 'Ürünler sıcak mı soğuk mu teslim ediliyor?', a: '"Hemen Teslimat" siparişleri tüketime hazır ve sıcak (isteğe bağlı soğuk), "Randevulu Teslimat" siparişleri ise buzdolabında muhafazaya uygun olması için soğuk teslim edilir.' },
      { q: 'Ürünlerin muhafaza şekilleri nedir? Buzdolabında kaç gün dayanır?', a: 'Ürünlerimiz buzdolabında 3 gün (72 saat) boyunca tazeliğini korur. Toplu siparişlerinizi bu 3 günlük süreye göre planlayabilirsiniz.' },
      { q: 'Yemekleri nasıl ısıtmalıyım? Paketler mikrodalgaya uygun mu?', a: 'Öğünlerimiz standart plastik değil, gıda güvenliğine uygun özel PP kaplarda sunulur. Üst jelatini hafifçe delerek mikrodalgada (360-720W) 1,5 - 2,5 dakika ısıtabilirsiniz. Fırın veya Airfryer kullanacaksanız yemeği kendi ısıya dayanıklı kabınıza aktarınız.' },
      { q: 'Yemeklerinizde alerjen kontrolü yapıyor musunuz?', a: 'Ürünlerimiz temiz ve glutensiz içeriklerle hazırlansa da aynı mutfakta üretildiği için "çapraz bulaşma" riski taşır. Ciddi alerjisi olanlar için %100 alerjen/gluten garantisi veremiyoruz.' },
    ],
  },
  {
    category: '🎯 3. Kalori Takibi ve Sadakat Sistemi',
    items: [
      { q: 'Kalori Takip (Kcal Tracker) ekranı ne işe yarar?', a: 'Uygulamamızdan aldığınız öğünleri "Tükettim" olarak işaretleyerek; günlük aldığınız kalori ve makro (Protein, Karb., Yağ) değerlerini grafiklerle anlık takip etmenizi sağlar.' },
      { q: 'Makro puanlar ve rozetler nedir?', a: 'Sipariş verdikçe puan kazanır ve Bronz, Gümüş, Altın gibi rozetler alırsınız. Bu rozetler size öğün/abonelik indirimleri ve anlaşmalı spor salonlarında özel fırsatlar sunar. (Puanlar 1 yıl geçerlidir).' },
      { q: 'Kendi diyetisyenimin verdiği listeye göre seçim yapabilir miyim?', a: 'Evet. Kalori Takip sayfasındaki profil ayarlarından kendi hedefinize veya diyetisyeninize uygun makro (gram) değerlerini girebilir, grafikleri kişiselleştirebilirsiniz.' },
    ],
  },
  {
    category: '💳 4. Ödeme, İade ve Müşteri Hizmetleri',
    items: [
      { q: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?', a: 'Yalnızca online kredi ve banka/hesap kartı ödemeleri geçerlidir. Kapıda ödeme veya yemek kartı kabul edilmemektedir.' },
      { q: 'Siparişimi nasıl takip edebilirim?', a: 'Uygulamamızdaki "Geçmiş Siparişlerim" ekranından anlık olarak takip edebilirsiniz.' },
      { q: 'Siparişimde iptal veya iade/değişim için ne yapmam gerekli?', a: 'Tüketici kanunları gereği, gıda ürünleri çabuk bozulabilen ve kişiye özel hazırlanan ürünler kapsamında olduğu için standart "Cayma Hakkı" veya keyfi iade işlemleri yapılamamaktadır. Ancak size ulaşan üründe vaat edilenin dışında bir hata, bozulma veya kusur söz konusuysa; siparişi teslim aldığınız anda durumu bize ispatıyla birlikte (fotoğraf vb.) bildirmeniz gerekmektedir. İade veya değişim taleplerinizi "Hesabım" sayfasındaki destek bölümünden oluşturabilirsiniz. Talebiniz 24 saat içerisinde incelenerek size e-posta veya WhatsApp üzerinden mutlaka çözüm sunulacaktır.' },
      { q: 'Destek hattına (Müşteri Hizmetleri) nasıl ulaşabilirim?', a: 'Her türlü soru, görüş ve probleminiz için "Hesabım" menüsünde yer alan "Destek Talebi Oluştur" bölümünden bizimle kolayca iletişime geçebilirsiniz. Destek ekibimiz en kısa sürede talebinizi yanıtlayacaktır.' },
    ],
  },
];

function AccordionItem({ id, question, answer, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-xl bg-brand-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-google text-sm font-medium text-brand-dark">{question}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-brand-dark/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={`faq-answer-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="border-t border-brand-bg px-4 py-3">
              <p className="mb-0 font-google text-xs font-normal leading-relaxed text-brand-dark/80">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HowItWorks() {
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState('');

  const categories = useMemo(() => FAQ_DATA, []);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-dark pb-10">
      <header className="sticky top-0 z-30 border-b border-brand-white/10 bg-brand-bg/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-white shadow-sm"
            aria-label="Geri"
          >
            <ChevronLeft size={18} className="text-brand-dark" />
          </button>
          <h1 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">Nasıl Çalışır / S.S.S.</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[430px] space-y-5 px-4 pt-4">
        {categories.map((category, categoryIndex) => (
          <section key={`faq-category-${categoryIndex}`} className="space-y-2">
            <h2 className="mb-0 px-1 font-zalando text-sm font-semibold text-brand-dark">{category.category}</h2>
            <div className="space-y-2">
              {category.items.map((item, itemIndex) => {
                const itemKey = `${categoryIndex}-${itemIndex}`;
                const isOpen = activeKey === itemKey;

                return (
                  <AccordionItem
                    key={`faq-item-${itemKey}`}
                    id={itemKey}
                    question={item.q}
                    answer={item.a}
                    isOpen={isOpen}
                    onToggle={() => setActiveKey((prev) => (prev === itemKey ? '' : itemKey))}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

