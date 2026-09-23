import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { ShoppingCart, ForkKnife, Ticket, CalendarX } from 'phosphor-react-native';

import { MacroProfile, MacroSettings, DEFAULT_MACRO_SETTINGS, macroProgress } from '../../lib/macros';
import BottomSheet from '../BottomSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigateToProfile: () => void;
  macroProfile?: MacroProfile | null;
  macroSettings?: MacroSettings;
};

export default function MacroPointModal({
  visible, onClose, macroProfile, macroSettings = DEFAULT_MACRO_SETTINGS,
}: Props) {
  const p = macroProgress(macroProfile ?? null, macroSettings);
  const esik = macroSettings.earnThreshold.toLocaleString('tr-TR');

  const BENEFITS = [
    {
      Icon: ShoppingCart, color: '#B9EF14', bg: 'rgba(198,240,79,0.1)',
      title: `Her ${esik}₺ Harcama ile 1 Macro Kazan`,
      desc: 'Birikimin küsuratlı bile olsa sistem toplam bakiyeni devamlı hesaplar. Harcamaların her zaman MACRO\u2019ya dönüşür.',
    },
    {
      Icon: ForkKnife, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',
      title: `${macroSettings.mealCost} MACRO = 1 Ücretsiz Öğün`,
      desc: 'Biriken MACRO sepetindeki \u201Ckupon ekle\u201D bölümüne otomatik düşer.',
    },
    {
      Icon: Ticket, color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',
      title: 'Sepette 1 Ücretsiz Öğün',
      desc: 'Dilediğin bir adet tekil öğünü ücretsiz olarak sepetine ekleyebilirsin.',
    },
    {
      Icon: CalendarX, color: '#34D399', bg: 'rgba(52,211,153,0.1)',
      title: `${macroSettings.rewardValidDays} Gün Geçerli`,
      desc: `Biriktirdiğin MACRO ${macroSettings.rewardValidDays} gün boyunca kaybolmaz.`,
    },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      showCloseButton
      containerStyle={styles.container}
      handleColor="rgba(255,255,255,0.15)"
      titleColor="#FFFFFF"
      titleSeparatorColor="rgba(255,255,255,0.1)"
    >
      <View style={styles.header}>
        <Image
          source={require('../../../assets/macro-coin.png')}
          style={styles.headerCoin}
          resizeMode="contain"
        />
        <Text style={styles.title}>Macro Nedir?</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroNumber}>{esik}₺</Text>
          <Text style={styles.heroSub}>= 1 Macro</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroRight}>
          <Text style={styles.heroNumber}>{macroSettings.mealCost}</Text>
          <Text style={styles.heroSub}>Macro = 1 Ücretsiz Öğün</Text>
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
          <View style={[styles.progressHintFill, { width: `${Math.round(p.mealProgress * 100)}%` as any }]} />
        </View>
        <Text style={styles.progressHintText}>
          {macroProfile
            ? `${p.balance % p.mealCost} / ${p.mealCost} Macro — ücretsiz öğüne ${p.macrosToNextMeal} macro, bir sonraki macro'ya ₺${p.liraToNextMacro}`
            : `0 / ${macroSettings.mealCost} Macro — ilk siparişinle biriktirmeye başla`}
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 20, marginTop: 8,
  },
  headerCoin: { width: 32, height: 32 },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  heroCard: {
    flexDirection: 'row', backgroundColor: '#E8431A',
    borderRadius: 18, padding: 20, marginBottom: 20, alignItems: 'center',
  },
  heroLeft: { flex: 1, alignItems: 'center' },
  heroRight: { flex: 1, alignItems: 'center' },
  heroDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroNumber: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', letterSpacing: -1 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 },
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
  benefitTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#ffffff', marginBottom: 2 },
  benefitDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'PlusJakartaSans_400Regular'},
  progressHint: { gap: 8, paddingBottom: 8 },
  progressHintBar: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  progressHintFill: { height: '100%', borderRadius: 2, backgroundColor: '#E8431A' },
  progressHintText: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium',
  },
});
