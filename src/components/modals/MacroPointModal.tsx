import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ShoppingCart, Crown, Lightning, CurrencyCircleDollar } from 'phosphor-react-native';

import { MacroProfile, MACRO_PRICE, MEMBERSHIP_THRESHOLD, ORDER_EARN_THRESHOLD, isPrivileged, privilegedDaysLeft } from '../../lib/macros';

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigateToProfile: () => void;
  macroProfile?: MacroProfile | null;
};

const BENEFITS = [
  { Icon: ShoppingCart,         color: '#C6F04F', bg: 'rgba(198,240,79,0.1)',  title: `Her ${ORDER_EARN_THRESHOLD.toLocaleString('tr-TR')}₺ harcama`, desc: '1 Macro kazanırsın (birikimli)' },
  { Icon: Crown,                color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', title: `${MEMBERSHIP_THRESHOLD} Macro → Ayrıcalıklı Üye`, desc: '30 gün boyunca tüm ayrıcalıklardan yararlan' },
  { Icon: Lightning,            color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', title: 'Ayrıcalıklı üye avantajları', desc: 'Öncelikli teslimat & özel indirimler' },
  { Icon: CurrencyCircleDollar, color: '#34D399', bg: 'rgba(52,211,153,0.1)', title: 'Macro satın al', desc: `${MACRO_PRICE.toLocaleString('tr-TR')}₺/adet — anında bakiye yükle` },
];

export default function MacroPointModal({ visible, onClose, onNavigateToProfile, macroProfile }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../../../assets/macro-coin.png')}
                style={styles.headerCoin}
                resizeMode="contain"
              />
              <Text style={styles.title}>Macro Nedir?</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroNumber}>{ORDER_EARN_THRESHOLD.toLocaleString('tr-TR')}₺</Text>
              <Text style={styles.heroSub}>= 1 Macro</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroRight}>
              <Text style={styles.heroNumber}>{MEMBERSHIP_THRESHOLD}</Text>
              <Text style={styles.heroSub}>Macro = Ayrıcalıklı Üye</Text>
            </View>
          </View>

          <View style={styles.benefitsContainer}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={[styles.benefitIconWrap, { backgroundColor: b.bg }]}>
                  <b.Icon size={20} color={b.color} weight="bold" />
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.progressHint}>
            <View style={styles.progressHintBar}>
              <View style={[styles.progressHintFill, { width: `${Math.min(((macroProfile?.macro_balance ?? 0) / MEMBERSHIP_THRESHOLD) * 100, 100)}%` as any }]} />
            </View>
            <Text style={styles.progressHintText}>
              {macroProfile
                ? isPrivileged(macroProfile)
                  ? `Ayrıcalıklı Üye • ${privilegedDaysLeft(macroProfile)} gün kaldı`
                  : `${macroProfile.macro_balance} / ${MEMBERSHIP_THRESHOLD} Macro — ${Math.max(0, MEMBERSHIP_THRESHOLD - macroProfile.macro_balance)} tane daha al, Ayrıcalıklı Üye ol`
                : `0 / ${MEMBERSHIP_THRESHOLD} Macro — Macro satın al, Ayrıcalıklı Üye ol`}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: '#0D0D0D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCoin: { width: 32, height: 32 },
  title: { fontSize: 20, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroCard: {
    flexDirection: 'row', backgroundColor: '#E8431A',
    borderRadius: 18, padding: 20, marginBottom: 20, alignItems: 'center',
  },
  heroLeft: { flex: 1, alignItems: 'center' },
  heroRight: { flex: 1, alignItems: 'center' },
  heroDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroNumber: { fontSize: 26, fontWeight: '900',
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', letterSpacing: -1 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500',
fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 },
  benefitsContainer: { gap: 4, marginBottom: 20 },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  benefitIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#ffffff', marginBottom: 2 },
  benefitDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '400',
fontFamily: 'PlusJakartaSans_400Regular'},
  progressHint: { gap: 8 },
  progressHintBar: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  progressHintFill: { height: '100%', borderRadius: 2, backgroundColor: '#E8431A' },
  progressHintText: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
