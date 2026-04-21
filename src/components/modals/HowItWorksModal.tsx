import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  CaretDown,
  Package as PackageIcon,
  CookingPot as CookingPotIcon,
  ChartLineUp as ChartLineUpIcon,
  CreditCard as CreditCardIcon,
} from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';

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
        a: 'Hemen teslimat siparişlerinde, siparişiniz hazırlandıktan sonra en kısa sürede adresinize teslim edilir. Randevulu siparişlerde ise seçtiğiniz gün ve saat aralığında teslimat yapılır.',
      },
      {
        q: 'Minimum sipariş tutarı var mı?',
        a: 'Evet, minimum sipariş tutarı bulunmaktadır. Güncel minimum tutar sepet ekranında gösterilir. Ücretsiz teslimat için gereken minimum tutara ulaştığınızda teslimat ücreti otomatik olarak kaldırılır.',
      },
      {
        q: 'Teslimat ücreti ne kadar?',
        a: 'Teslimat ücreti sipariş tutarınıza ve teslimat bölgenize göre değişir. Belirli bir sipariş tutarının üzerinde ücretsiz teslimat kazanırsınız. Güncel teslimat ücreti ödeme ekranında gösterilir.',
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
    category: 'Ürünler ve Isıtma',
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
        q: 'Puan sistemi nedir?',
        a: 'Macro Puan sistemi ile verdiğiniz her siparişten puan kazanırsınız. Biriktirdiğiniz puanları indirim kuponu olarak kullanabilirsiniz. Ayrıcalıklı Üye seviyesine ulaştığınızda ekstra avantajlar elde edersiniz.',
      },
      {
        q: 'Makro besin değerleri nereden görüntülerim?',
        a: 'Her ürünün detay sayfasında kalori, protein, karbonhidrat ve yağ değerleri gösterilir. Ayrıca sepet ekranında toplam sepet besin değerlerinizi ve Kcalculate sekmesinde günlük takibinizi görebilirsiniz.',
      },
      {
        q: 'Ayrıcalıklı Üye nedir?',
        a: 'Belirli sayıda sipariş vererek Ayrıcalıklı Üye (Macro Üye) seviyesine ulaşabilirsiniz. 15, 30, 45 ve 60 sipariş basamakları bulunur. Ayrıcalıklı Üyeler özel indirimler, öncelikli teslimat ve ekstra puanlardan yararlanır.',
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
        a: 'Şu anda kredi kartı ve banka kartı ile 3D Secure güvenli ödeme kabul ediyoruz. Yakında Apple Pay, Google Pay ve kayıtlı kart ile ödeme seçenekleri de eklenecektir.',
      },
      {
        q: 'İade politikanız nedir?',
        a: 'Ürünlerimiz kişiye özel hazırlandığından cayma hakkı bulunmamaktadır. Ancak ürün hasarlı veya hatalı teslim edildiyse, teslimattan itibaren 2 saat içinde destek ekibimize bildirmeniz halinde iade veya yeniden gönderim yapılır.',
      },
      {
        q: 'Fatura alabilir miyim?',
        a: 'Evet, tüm siparişleriniz için e-fatura otomatik olarak kayıtlı e-posta adresinize gönderilir. Kurumsal fatura talebiniz varsa destek ekibimizle iletişime geçebilirsiniz.',
      },
    ],
  },
];

export default function HowItWorksModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [openKey, setOpenKey] = useState<string | null>(null);

  function toggle(key: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey(prev => (prev === key ? null : key));
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SSS</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#202020',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    gap: 24,
    paddingBottom: 16,
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
    fontWeight: '700',
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
    fontWeight: '600',
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
