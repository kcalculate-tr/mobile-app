// T20Eat — eatkcal ana ekranı (G6-S4 md.1). `restoran_yakinda` bayrağı
// açıkken Home sekmesinde bugünkü ekranın YERİNE gösterilir (bkz.
// src/screens/HomeScreen.tsx tepesindeki sarmalayıcı). Bayrak kapalıyken bu
// dosya hiç mount edilmez.
//
// "Çevrendeki sağlıklı restoranlar": GERÇEK veri olmadığı için sahte restoran
// listesi YOK — tek "Yakında burada" kartı (md.1 açık talimat).
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { bricolageFonts } from '../../../core/design/fonts';
import { SPRING, haptic, useReducedMotion } from '../../../core/design';
import { useTheme } from '../../../core/design/ThemeProvider';
import { useT } from '../../../core/i18n';
import { MapPin, BellRinging } from '../../../components/icons';
import { TAB_BAR_TOTAL } from '../../../constants/layout';
import { fetchBranches, type Branch } from '../../../lib/branches';
import { subeBanneri } from '../../../lib/branchBanner';
import { useAddressStore } from '../../../store/addressStore';
import { RootStackParamList } from '../../../navigation/types';
import { readCityGatePassed, writeCityGatePassed } from '../cityGateStorage';
import CityGateSheet from '../ui/CityGateSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NEARBY_INTEREST_KEY = 'eatkcal-nearby-interest-notified';

export default function EatHomeScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  useFonts(bricolageFonts);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [gateVisible, setGateVisible] = useState(false);
  const [nearbyNotified, setNearbyNotified] = useState(false);

  useEffect(() => {
    fetchBranches().then(setBranches).catch(() => {});
    AsyncStorage.getItem(NEARBY_INTEREST_KEY).then((v) => setNearbyNotified(v === '1'));
  }, []);

  const proceedToOrder = useCallback(() => {
    navigation.navigate('EatCatalog');
  }, [navigation]);

  const handleOrderPress = useCallback(async () => {
    const passed = await readCityGatePassed();
    if (passed) {
      proceedToOrder();
      return;
    }
    setGateVisible(true);
  }, [proceedToOrder]);

  const handleGateConfirmed = useCallback(async () => {
    await writeCityGatePassed();
    setGateVisible(false);
    // İlk kurulum: kayıtlı adres yoksa önce mevcut Adresler ekranına (G6-S4
    // md.2 — "adres ve telefon için MEVCUT adres/telefon ekranlarını kullan").
    const hasAddress = Boolean(useAddressStore.getState().selectedAddress);
    if (hasAddress) {
      proceedToOrder();
    } else {
      navigation.navigate('Addresses');
    }
  }, [navigation, proceedToOrder]);

  const handleNearbyNotify = useCallback(async () => {
    await AsyncStorage.setItem(NEARBY_INTEREST_KEY, '1');
    setNearbyNotified(true);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.color.bg, paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_TOTAL + 24 }}
      >
        <View style={styles.header}>
          <Text style={[styles.brand, { fontFamily: 'BricolageGrotesque_700Bold', color: theme.color.ink }]}>
            eatkcal
          </Text>
          <View style={[styles.cityChip, { borderColor: theme.color.line }]}>
            <MapPin size={14} color={theme.color.ink} weight="fill" />
            <Text style={[styles.cityChipText, { color: theme.color.ink }]}>İzmir ▾</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { fontFamily: 'BricolageGrotesque_700Bold', color: theme.color.ink }]}>
          {t('eatkcal.kitchens_title')}
        </Text>

        {branches.map((branch) => {
          const banner = subeBanneri(branch.slug);
          return (
            <View key={branch.id} style={[styles.branchCard, { backgroundColor: theme.color.surface, borderColor: theme.color.line }]}>
              {banner ? (
                <Image source={banner} style={styles.branchPhoto} resizeMode="cover" />
              ) : (
                <View style={[styles.branchPhoto, { backgroundColor: theme.color.line }]} />
              )}
              <View style={styles.branchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.branchName, { color: theme.color.ink }]}>{branch.name}</Text>
                  <Text style={[styles.branchAddress, { color: theme.color.secondary }]} numberOfLines={1}>
                    {branch.address}
                  </Text>
                </View>
                <OrderButton
                  label={t('eatkcal.order_cta')}
                  bg={theme.color.accent}
                  fg={theme.color.onAccent}
                  onPress={handleOrderPress}
                />
              </View>
            </View>
          );
        })}

        <View style={styles.nearbyHeader}>
          <Text style={[styles.nearbyTitle, { fontFamily: 'BricolageGrotesque_700Bold', color: theme.color.ink }]}>
            {t('eatkcal.nearby_title')}
          </Text>
          <Text style={[styles.nearbySoon, { color: theme.color.secondary }]}>· {t('eatkcal.nearby_soon')}</Text>
        </View>

        <View style={[styles.nearbyCard, { borderColor: theme.color.line }]}>
          <View style={[styles.nearbyIcon, { backgroundColor: theme.color.line }]}>
            <BellRinging size={20} color={theme.color.secondary} />
          </View>
          <Text style={[styles.nearbyCardTitle, { color: theme.color.ink }]}>{t('eatkcal.nearby_card_title')}</Text>
          <TouchableOpacity
            style={[styles.nearbyNotifyBtn, { borderColor: theme.color.line }]}
            onPress={handleNearbyNotify}
            disabled={nearbyNotified}
            activeOpacity={0.8}
          >
            <Text style={[styles.nearbyNotifyText, { color: theme.color.ink }]}>
              {nearbyNotified ? t('eatkcal.nearby_notified') : t('eatkcal.nearby_notify')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footer, { color: theme.color.secondary }]}>{t('eatkcal.footer')}</Text>
      </ScrollView>

      <CityGateSheet
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        onConfirmed={handleGateConfirmed}
      />
    </View>
  );
}

// "Sipariş ver" — sipariş anı eatkcal yayıyla (SPRING.eat, daha yumuşak "teslim"
// hissi; motion.tsx token'ı). Azaltılmış harekette yay yok, yalnız haptik.
function OrderButton({
  label,
  bg,
  fg,
  onPress,
}: {
  label: string;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => {
        if (!reduced) scale.value = withSpring(0.95, SPRING.eat);
      }}
      onPressOut={() => {
        if (!reduced) scale.value = withSpring(1, SPRING.eat);
      }}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.orderBtn, { backgroundColor: bg }, animStyle]}>
        <Text style={[styles.orderBtnText, { color: fg }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  brand: { fontSize: 26 },
  cityChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cityChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  sectionTitle: { fontSize: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  branchCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  branchPhoto: { width: '100%', height: 140 },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  branchName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  branchAddress: { marginTop: 2, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 },
  orderBtn: { height: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  orderBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  nearbyHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  nearbyTitle: { fontSize: 18 },
  nearbySoon: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  nearbyCard: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  nearbyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nearbyCardTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },
  nearbyNotifyBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nearbyNotifyText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  footer: { marginTop: 18, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 },
});
