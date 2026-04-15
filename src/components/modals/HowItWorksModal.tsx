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
import { X, CaretDown } from 'phosphor-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

const FAQ_DATA = [
  {
    key: 'order',
    category: '📦 Sipariş ve Teslimat',
    items: [
      {
        q: 'Siparişimi ne zaman teslim alırım?',
        a: 'Siparişler genellikle aynı gün veya ertesi gün teslim edilir. Teslimat saatini sipariş onayı sırasında seçebilirsiniz.',
      },
      {
        q: 'Minimum sipariş tutarı var mı?',
        a: 'Evet, minimum sipariş tutarı 150 ₺\'dir. Sepetiniz bu tutara ulaştığında siparişinizi tamamlayabilirsiniz.',
      },
      {
        q: 'Teslimat ücreti ne kadar?',
        a: '300 ₺ ve üzeri siparişlerde teslimat ücretsizdir. Altındaki siparişler için 29 ₺ teslimat ücreti uygulanır.',
      },
      {
        q: 'Siparişimi iptal edebilir miyim?',
        a: 'Siparişiniz hazırlanmaya başlanmadan önce iptal edebilirsiniz. Hazırlandıktan sonra iptal mümkün değildir.',
      },
    ],
  },
  {
    key: 'products',
    category: '🍱 Ürünler ve Isıtma',
    items: [
      {
        q: 'Yemekler nasıl paketleniyor?',
        a: 'Tüm yemekler hijyenik, vakumlu ve soğutuculu özel ambalajlarda teslim edilir. Tazeliği korunur.',
      },
      {
        q: 'Yemekleri nasıl ısıtmalıyım?',
        a: 'Mikrodalgada 2-3 dakika veya fırında 180°C\'de 10 dakika ısıtmanız yeterlidir. Ambalaj üzerinde detaylı talimatlar bulunur.',
      },
      {
        q: 'Yemeklerin raf ömrü ne kadar?',
        a: 'Buzdolabında 3 gün, dondurucuda 30 gün saklayabilirsiniz. Ambalaj üzerindeki son tüketim tarihine dikkat edin.',
      },
    ],
  },
  {
    key: 'tracker',
    category: '🎯 Kalori Takibi ve Puanlar',
    items: [
      {
        q: 'Kalori takibi nasıl çalışır?',
        a: 'Sipariş ettiğiniz ürünler otomatik olarak günlük kalori takibinize eklenir. Tracker ekranından detayları görebilirsiniz.',
      },
      {
        q: 'Puan sistemi nedir?',
        a: 'Her siparişinizde harcadığınız tutarın %5\'i kadar puan kazanırsınız. Biriken puanları sonraki siparişlerinizde kullanabilirsiniz.',
      },
      {
        q: 'Makro besin değerleri nereden görüntülerim?',
        a: 'Her ürün sayfasında karbonhidrat, protein, yağ ve kalori değerleri detaylı olarak belirtilmiştir.',
      },
    ],
  },
  {
    key: 'payment',
    category: '💳 Ödeme ve İade',
    items: [
      {
        q: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
        a: 'Kredi kartı, banka kartı ve dijital cüzdan ile ödeme yapabilirsiniz. Tüm işlemler 3D Secure ile güvence altındadır.',
      },
      {
        q: 'İade politikanız nedir?',
        a: 'Ürün hasarlı veya hatalı geldiyse 24 saat içinde müşteri hizmetlerimize bildirin. Eksiksiz iade yapılır.',
      },
      {
        q: 'Fatura alabilir miyim?',
        a: 'Evet, kurumsal fatura taleplerini sipariş notuna belirtebilirsiniz. Fatura vergi numaranıza düzenlenir.',
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
          {FAQ_DATA.map(section => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.category}</Text>
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
          ))}
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#202020',
    marginBottom: 4,
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
