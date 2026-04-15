import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, Truck, Calendar, Storefront, Thermometer, Snowflake, Package, Leaf,
} from 'phosphor-react-native';

type Props = { visible: boolean; onClose: () => void };

const SECTIONS = [
  {
    Icon: Storefront,
    color: '#000000', bg: '#f6f6f6',
    title: 'Gel-Al Teslim',
    desc: 'Şubemizden dilediğiniz saatte siparişinizi teslim alabilirsiniz. Çalışma saatlerimiz dahilinde her gün mevcuttur.',
  },
  {
    Icon: Truck,
    color: '#000000', bg: '#f6f6f6',
    title: 'Hemen Teslim',
    desc: 'Pzt–Cuma 10:00–21:00 arasında Konak, Karabağlar, Balçova ve Narlıdere\'ye sunulmaktadır.',
  },
  {
    Icon: Calendar,
    color: '#000000', bg: '#f6f6f6',
    title: 'Randevulu Teslim',
    desc: 'Hafta içi her gün, en erken ertesi gün 09:30–21:30 arasında İzmir\'in birçok ilçesine belirli sipariş tutarına göre gerçekleşir.',
  },
  {
    Icon: Thermometer,
    color: '#DC2626', bg: '#FEF2F2',
    title: 'Hemen Teslimde Sıcak',
    desc: 'Siparişleriniz sıcak olarak, anında tüketim için hazırlanmış şekilde teslim edilir.',
  },
  {
    Icon: Snowflake,
    color: '#2563EB', bg: '#EFF6FF',
    title: 'Randevuluda Soğuk Zincir',
    desc: 'Siparişler +4°C\'de muhafaza edilebilecek şekilde soğuk teslim edilir. Tazelik 72 saate kadar korunur.',
  },
  {
    Icon: Package,
    color: '#16A34A', bg: '#F0FDF4',
    title: 'Hijyenik Ambalaj',
    desc: 'Ürünleriniz havayla temas etmeden, bozulmadan ve bakteri üretmeden özel ambalajlanır.',
  },
  {
    Icon: Leaf,
    color: '#15803D', bg: '#F0FDF4',
    title: 'Sağlıklı Yaşam Taahhüdü',
    desc: 'Sağlıklı beslenmek bir zorunluluktur. Her siparişinizde kalite ve tazelik garantisi veriyoruz.',
  },
];

export default function DeliveryInfoModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Truck size={18} color="#000" weight="bold" />
            <Text style={styles.title}>Teslimat Seçenekleri</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={16} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {SECTIONS.map((s, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: s.bg }]}>
                <s.Icon size={18} color={s.color} weight="bold" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{s.title}</Text>
                <Text style={styles.rowValue}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.closeActionBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.closeActionText}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { gap: 10, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#f9f9f9', borderRadius: 14,
    padding: 14, gap: 12,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 13, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginBottom: 3 },
  rowValue: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  closeActionBtn: {
    marginTop: 12, borderRadius: 14, minHeight: 50,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000000',
  },
  closeActionText: { color: '#C6F04F', fontSize: 15, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold'},
});
