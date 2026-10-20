import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  CaretDown,
  Package as PackageIcon,
  CookingPot as CookingPotIcon,
  ChartLineUp as ChartLineUpIcon,
  CreditCard as CreditCardIcon,
} from '../icons';
import type { IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import BottomSheet from '../BottomSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

type FaqSection = {
  key: string;
  category: string;
  Icon: ComponentType<IconProps>;
  items: { q: string; a: string }[];
};

const FAQ_DATA: FaqSection[] = [
  {
    key: 'order',
    category: 'Sipariş ve Teslimat',
    Icon: PackageIcon,
    items: [
      {
        q: 'Siparişimi ne zaman teslim alırım?',
        a: 'Hemen teslimat siparişleri, mahallenize göre ortalama 30-55 dakika içinde adresinize ulaşır. Randevulu siparişlerde seçtiğiniz gün ve saat aralığında teslimat yapılır.',
      },
      {
        q: 'Hangi saatlerde sipariş verebilirim?',
        a: 'Pazartesi-Cumartesi 09:00-21:30 arasında sipariş alıyoruz. Pazar günleri kapalıyız. Randevulu siparişlerinizi kapalı olduğumuz saatlerde de oluşturabilirsiniz; teslimat seçtiğiniz gün yapılır.',
      },
      {
        q: 'Minimum sipariş tutarı var mı?',
        a: 'Evet. Hemen teslimatta minimum sepet tutarı 350 TL, randevulu teslimatta mahallenize göre 500-750 TL arasındadır. Adresinize ait güncel tutar sepet ekranında gösterilir.',
      },
      {
        q: 'Teslimat ücreti ne kadar?',
        a: 'Teslimat ücreti mahallenize göre 0-50 TL arasında değişir; şubelerimizin kendi bölgelerinde teslimat ücretsizdir. Belirli bir sepet tutarının üzerinde (mahalleye göre 600 TL\'ye kadar) ücret tamamen kalkar. Adresinize ait güncel ücret ödeme ekranında gösterilir.',
      },
      {
        q: 'Hangi bölgelere teslimat yapıyorsunuz?',
        a: 'İzmir\'in belirli ilçe ve mahallelerine teslimat yapıyoruz. Teslimat bölgelerini ana sayfadaki "Teslimat bölgelerini görüntüle" bağlantısından kontrol edebilirsiniz.',
      },
      {
        q: 'Siparişimi iptal edebilir miyim?',
        a: 'Randevulu siparişlerde teslimat zamanına 48 saatten fazla varsa uygulamadan iptal talebi oluşturabilirsiniz. Talebiniz KCAL tarafından onaylandığında bildirim alırsınız. Anlık siparişlerde iptal mümkün değildir, sorun yaşarsanız destek ekibimizle iletişime geçebilirsiniz.',
      },
      {
        q: 'Sipariş tarihimi veya adresimi değiştirebilir miyim?',
        a: 'Randevulu siparişlerde teslimatına 48 saatten fazla varsa tarih ve adres değişikliği talebi oluşturabilirsiniz. 48 saatten az kaldıysa sadece adres değişikliği talep edebilirsiniz. Anlık siparişlerde sipariş oluşturulduktan sonra 30 dakika içinde adres değişikliği talep edebilirsiniz. Tüm talepler KCAL onayına tabidir.',
      },
    ],
  },
  {
    key: 'products',
    category: 'Ürünler ve Tüketim',
    Icon: CookingPotIcon,
    items: [
      {
        q: 'Yemekler nasıl paketleniyor?',
        a: 'Tüm yemeklerimiz hijyenik koşullarda, gıdaya uygun özel polipropilen kaplarda hazırlanıp paketlenir. Her porsiyon ayrı kapta, makro besin değerleri etiketlenmiş şekilde teslim edilir.',
      },
      {
        q: 'Yemekleri nasıl ısıtmalıyım?',
        a: 'Yemeklerinizi doğrudan size gelen kap ile mikrodalga fırında 2-3 dakika ısıtabilirsiniz. Jelatini sökerek veya birkaç delik oluşturarak ısıtmanızı öneririz. Bazı ürünler soğuk tüketilebilir (salata, smoothie vb.).',
      },
      {
        q: 'Yemeklerin raf ömrü ne kadar?',
        a: 'Taze hazırlanan yemeklerimizin buzdolabında 3 gün raf ömrü vardır. Teslim aldığınız gün dahil olmak üzere 3 gün içinde tüketmenizi öneririz. Dondurucuda saklamayınız.',
      },
    ],
  },
  {
    key: 'tracker',
    category: 'Kalori Takibi ve Puanlar',
    Icon: ChartLineUpIcon,
    items: [
      {
        q: 'Kalori takibi nasıl çalışır?',
        a: 'Kcalculate özelliğimiz ile günlük kalori, protein, karbonhidrat ve yağ alımınızı otomatik olarak takip edebilirsiniz. KCAL\'dan sipariş verdiğiniz ürünler otomatik olarak günlük takibinize eklenir. Beslenme profilinizi oluşturarak kişisel hedeflerinizi belirleyebilirsiniz.',
      },
      {
        q: 'Macro nedir, nasıl kazanırım?',
        a: 'Her 500 TL\'lik harcamanız 1 Macro kazandırır. Tutarın küsuratı kaybolmaz: bir sonraki Macro\'ya doğru puan olarak birikir, yani 350 TL\'lik bir sipariş de sizi hedefe yaklaştırır. Kazandığınız Macro\'ları ve bir sonraki Macro\'ya ne kadar kaldığını profilinizden takip edebilirsiniz.',
      },
      {
        q: 'Makro besin değerleri nereden görüntülerim?',
        a: 'Her ürünün detay sayfasında kalori, protein, karbonhidrat ve yağ değerleri gösterilir. Ayrıca sepet ekranında toplam sepet besin değerlerinizi ve Kcalculate sekmesinde günlük takibinizi görebilirsiniz.',
      },
      {
        q: 'Macro\'larımı nasıl kullanırım?',
        a: '5 Macro = 1 bedava öğün. Yeterli Macro\'nuz olduğunda bedava öğün hakkınız kupon olarak hesabınıza tanımlanır ve sepette seçebilirsiniz. Kuponun geçerlilik süresi tanımlandığı tarihten itibaren 90 gündür.',
      },
    ],
  },
  {
    key: 'payment',
    category: 'Ödeme ve İade',
    Icon: CreditCardIcon,
    items: [
      {
        q: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
        a: 'Kredi kartı ve banka kartı ile 3D Secure güvenli ödeme kabul ediyoruz. Kartınızı dilerseniz güvenle kaydedebilir, sonraki siparişlerinizde tekrar kart bilgisi girmeden ödeyebilirsiniz.',
      },
      {
        q: 'İade politikanız nedir?',
        a: 'Ürünlerimiz kişiye özel hazırlandığından cayma hakkı bulunmamaktadır. Ancak ürün hasarlı veya hatalı teslim edildiyse, teslimattan itibaren 2 saat içinde destek ekibimize bildirmeniz halinde iade veya yeniden gönderim yapılır.',
      },
      {
        q: 'Fatura alabilir miyim?',
        a: 'Siparişinizin yazar kasa fişi ürünlerle birlikte teslim edilir; ayrıca fatura düzenlenmez. Fatura isterseniz uygulamadan destek talebi oluşturup vergi kimlik numarası, vergi dairesi, adres ve isim/unvan bilgilerinizi iletmeniz yeterlidir — faturanız bu bilgilere göre düzenlenir.',
      },
    ],
  },
];

export default function HowItWorksModal({ visible, onClose }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  function toggle(key: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey(prev => (prev === key ? null : key));
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="SSS"
      showCloseButton
      containerStyle={styles.container}
    >
      <View style={styles.scrollContent}>
        {FAQ_DATA.map(section => {
          const SectionIcon = section.Icon;
          return (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <SectionIcon size={20} color="#000000" weight="bold" />
                <Text style={styles.sectionTitle}>{section.category}</Text>
              </View>
              {section.items.map((item, idx) => {
                const itemKey = `${section.key}-${idx}`;
                const isOpen = openKey === itemKey;
                return (
                  <TouchableOpacity
                    key={itemKey}
                    style={styles.accordionItem}
                    activeOpacity={0.85}
                    onPress={() => toggle(itemKey)}
                  >
                    <View style={styles.accordionHeader}>
                      <Text style={styles.question}>{item.q}</Text>
                      <View style={[styles.caretWrap, isOpen && styles.caretOpen]}>
                        <CaretDown size={16} color="#6B7280" weight="bold" />
                      </View>
                    </View>
                    {isOpen && (
                      <Text style={styles.answer}>{item.a}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f6f6f6',
  },
  scrollContent: {
    gap: 24,
    paddingBottom: 16,
    paddingTop: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  accordionItem: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  question: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#111827',
    lineHeight: 20,
  },
  caretWrap: {
    transform: [{ rotate: '0deg' }],
  },
  caretOpen: {
    transform: [{ rotate: '180deg' }],
  },
  answer: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 12,
  },
});
