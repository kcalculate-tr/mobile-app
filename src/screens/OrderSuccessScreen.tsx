import React, { useEffect, useRef, useState } from 'react';
import { Animated, ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CheckCircle,
  Package,
  ChartLineUp,
  House,
  Timer,
  Confetti,
  Fire,
  Truck,
  ArrowRight,
} from 'phosphor-react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_MACRO_SETTINGS,
  fetchMacroProfile,
  fetchMacroSettings,
  macroEarnedForOrder,
} from '../lib/macros';
import { useAuth } from '../context/AuthContext';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../constants/theme';

type OrderSuccessRoute = RouteProp<RootStackParamList, 'OrderSuccess'>;
type OrderSuccessNavigation = NativeStackNavigationProp<RootStackParamList>;

export default function OrderSuccessScreen() {
  const navigation = useNavigation<OrderSuccessNavigation>();
  const route = useRoute<OrderSuccessRoute>();
  const { isAuthenticated, loading } = useRequireAuth();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Bu siparişin kazandıracağı Macro. Parametre olarak taşınmıyor: çağrı
  // noktaları (checkout, ödeme, 3DS dönüşü) farklı yerlerde ve hepsinin
  // profili bilmesi gerekmezdi. Ekran siparişin tutarını kendi okuyup
  // sunucuyla AYNI formülü uyguluyor.
  const [kazanilanMacro, setKazanilanMacro] = useState<number | null>(null);
  const macroScale = useRef(new Animated.Value(0.6)).current;
  const macroOpacity = useRef(new Animated.Value(0)).current;

  // Animasyonlar
  const orderCodeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 18 }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      Animated.spring(orderCodeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const orderId = route.params.orderId;
    if (!user?.id || !orderId) return;
    let mounted = true;

    (async () => {
      try {
        const [{ data: order }, profile, settings] = await Promise.all([
          supabase.from('orders').select('total_price').eq('id', orderId).maybeSingle(),
          fetchMacroProfile(user.id),
          fetchMacroSettings().catch(() => DEFAULT_MACRO_SETTINGS),
        ]);
        if (!mounted) return;
        const tutar = Number((order as { total_price?: number } | null)?.total_price ?? 0);
        // Tutar okunamadıysa SESSİZ kal — "kazanamadın" demek yanlış olur.
        if (!(tutar > 0)) return;
        setKazanilanMacro(macroEarnedForOrder(tutar, profile, settings));
      } catch {
        /* sessiz: kazanım bilgisi gösterilmezse sipariş akışı etkilenmez */
      }
    })();

    return () => { mounted = false; };
  }, [user?.id, route.params.orderId]);

  useEffect(() => {
    if (!kazanilanMacro) return;
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.spring(macroScale, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 14 }),
        Animated.timing(macroOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  }, [kazanilanMacro, macroScale, macroOpacity]);

  // 21.09.2026 — Buradaki "orders.macro_points" sorgusu KALDIRILDI.
  // orders tablosunda boyle bir kolon hic olmadi (yalniz macro_quantity ve
  // macro_discount_amount var), dolayisiyla istek her seferinde 400 doneriyor,
  // macroPts 0'a dusuyor ve musteriye HER siparişte "Macro Coin Kazanilamadi
  // / Yeterli siparis tutarina ulasilamadi" yaziliyordu. Uydurma bir gerekce.
  // Siparis basina makro odulu henuz hicbir yerde uretilmiyor
  // (macro_transactions'ta order_id dolu tek satir yok), bu yuzden veri
  // gelene kadar kart hic gosterilmiyor — yanlis bilgi vermektense sessiz kal.

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={COLORS.brand.green} size="large" />
  </View>;
  if (!isAuthenticated) return null;

  const { orderCode, noticeMessage } = route.params;

  const orderCodeScale = orderCodeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const steps = [
    { Icon: CheckCircle, label: 'Onaylandı', active: true },
    // Etiket SABİT: animasyonlu noktalar 60px'lik adım genişliğini taşırıp
    // "Hazırlanıyor.." diye kırpılmasına yol açıyordu. Canlılık, dairenin
    // neon dolgusu ve bağlantı çizgisiyle zaten veriliyor.
    { Icon: Fire, label: 'Hazırlanıyor', active: true },
    { Icon: Truck, label: 'Yolda', active: false },
    { Icon: House, label: 'Teslim', active: false },
  ];

  // Veri YOKSA kart hiç çizilmez; "kazanılamadı" iddiası doğrulanamaz.
  const macroGoster = kazanilanMacro !== null && kazanilanMacro > 0;

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%' }}
        >
          {/* ── Onay şeridi ──
              120px'lik tik dairesi ekranın yarısını yiyordu. Onay tek satıra
              indi; sahne asıl ödüle, Macro kazancına bırakıldı. */}
          <Animated.View
            style={[styles.onayBar, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}
          >
            <View style={styles.onayTik}>
              <Svg width="12" height="12" viewBox="0 0 56 56" fill="none">
                <Path
                  d="M12 28L22 38L44 16"
                  stroke="#B9EF14"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.onayText}>Siparişin alındı, hazırlanmaya başlandı</Text>
          </Animated.View>

          {/* ── Sahne: Macro kazancı ── */}
          {macroGoster ? (
            <Animated.View
              style={[
                styles.sahne,
                { opacity: macroOpacity, transform: [{ scale: macroScale }] },
              ]}
            >
              <Image
                source={require('../../assets/macro-coin.png')}
                style={styles.sahneCoin}
                resizeMode="contain"
              />
              <Text style={styles.sahneSayi}>+{kazanilanMacro}</Text>
              <Text style={styles.sahneBaslik}>MACRO KAZANDIN</Text>
              <Text style={styles.sahneAlt}>Teslimattan sonra hesabına eklenir</Text>
            </Animated.View>
          ) : (
            // Kazanım verisi yoksa sahne boş kalmasın — onay yine de kutlanır.
            <View style={styles.sahne}>
              <View style={styles.sahneKonfeti}>
                <Confetti size={30} color={COLORS.brand.green} weight="fill" />
              </View>
              <Text style={styles.sahneBaslik}>SİPARİŞ VERİLDİ</Text>
              <Text style={styles.sahneAlt}>Mutfak siparişini hazırlamaya başladı</Text>
            </View>
          )}

          {/* ── Sipariş kartı: numara + durum + teslimat tek kartta ── */}
          <View style={styles.kart}>
            <View style={styles.kodSatir}>
              <Text style={styles.kodLabel}>SİPARİŞ NO</Text>
              <Animated.Text
                style={[
                  styles.kod,
                  { opacity: orderCodeAnim, transform: [{ scale: orderCodeScale }] },
                ]}
              >
                {orderCode}
              </Animated.Text>
            </View>

            <View style={styles.kartCizgi} />

            <View style={styles.zamanCizgisi}>
              {steps.map((step, i) => (
                <React.Fragment key={step.label}>
                  <View style={styles.adim}>
                    <View style={[styles.adimDaire, step.active && styles.adimDaireAktif]}>
                      <step.Icon
                        size={13}
                        weight="fill"
                        color={step.active ? '#000000' : COLORS.text.tertiary}
                      />
                    </View>
                    <Text
                      style={[styles.adimLabel, step.active && styles.adimLabelAktif]}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                  </View>
                  {i < steps.length - 1 ? (
                    <View style={[styles.baglanti, i < 1 && styles.baglantiAktif]} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>

            <View style={styles.kartCizgi} />

            <View style={styles.teslimatSatir}>
              <Timer size={16} color={COLORS.text.primary} weight="bold" />
              <Text style={styles.teslimatLabel}>Tahmini teslimat</Text>
              <Text style={styles.teslimatDeger}>35-45 dk</Text>
            </View>
          </View>

          {noticeMessage ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{noticeMessage}</Text>
            </View>
          ) : null}

          {/* ── Aksiyonlar: bir birincil + iki kompakt ikincil ── */}
          <TouchableOpacity
            style={styles.anaBtn}
            onPress={() => navigation.navigate('ProfileOrders')}
            activeOpacity={0.85}
          >
            <Package size={18} color="#ffffff" weight="bold" />
            <Text style={styles.anaBtnText}>Siparişimi Takip Et</Text>
          </TouchableOpacity>

          <View style={styles.ikiliSatir}>
            {macroGoster ? (
              <TouchableOpacity
                style={styles.ikinciBtn}
                onPress={() => navigation.navigate('Tabs', { screen: 'Subscriptions' })}
                activeOpacity={0.8}
              >
                <Image
                  source={require('../../assets/macro-coin.png')}
                  style={styles.ikinciCoin}
                  resizeMode="contain"
                />
                <Text style={styles.ikinciBtnText}>{"Macro'larım"}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.ikinciBtn}
                onPress={() => navigation.navigate('Tabs', { screen: 'Tracker' })}
                activeOpacity={0.8}
              >
                <ChartLineUp size={16} color="#111111" weight="bold" />
                <Text style={styles.ikinciBtnText}>Tracker</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.ikinciBtn}
              onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
              activeOpacity={0.8}
            >
              <House size={16} color="#111111" weight="bold" />
              <Text style={styles.ikinciBtnText}>Anasayfa</Text>
            </TouchableOpacity>
          </View>

          {macroGoster ? (
            <TouchableOpacity
              style={styles.duzLink}
              onPress={() => navigation.navigate('Tabs', { screen: 'Tracker' })}
              activeOpacity={0.7}
            >
              <Text style={styles.duzLinkText}>{"Kcal Tracker'a geç"}</Text>
              <ArrowRight size={12} color={COLORS.text.secondary} weight="bold" />
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f6f6f6',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  // ── Onay şeridi ──
  onayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#000000',
    marginBottom: 20,
  },
  onayTik: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(185,239,20,0.18)',
  },
  onayText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // ── Sahne ──
  sahne: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 20,
  },
  sahneCoin: {
    width: 52,
    height: 52,
    marginBottom: 6,
  },
  sahneKonfeti: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sahneSayi: {
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -3,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  sahneBaslik: {
    marginTop: 2,
    fontSize: 12,
    letterSpacing: 2.6,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  sahneAlt: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
  },

  // ── Sipariş kartı ──
  kart: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  kodSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kodLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.tertiary,
  },
  kod: {
    fontSize: 17,
    letterSpacing: 0.4,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  kartCizgi: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 12,
  },
  zamanCizgisi: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  adim: {
    alignItems: 'center',
    // 4 adım + 3 bağlantı kart genişliğine sığmalı: sabit genişlik büyürse
    // bağlantı çizgileri görünmez hale geliyor.
    width: 60,
  },
  adimDaire: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  adimDaireAktif: {
    backgroundColor: COLORS.brand.green,
  },
  adimLabel: {
    marginTop: 5,
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.tertiary,
  },
  adimLabelAktif: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  baglanti: {
    flex: 1,
    height: 2,
    marginTop: 13,
    borderRadius: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  baglantiAktif: {
    backgroundColor: COLORS.brand.green,
  },
  teslimatSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teslimatLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
  },
  teslimatDeger: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },

  noticeBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF7E6',
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8A6A00',
  },

  // ── Aksiyonlar ──
  anaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 100,
    backgroundColor: '#000000',
    marginTop: 16,
  },
  anaBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  ikiliSatir: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  ikinciBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: '#FFFFFF',
  },
  ikinciCoin: {
    width: 16,
    height: 16,
  },
  ikinciBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111111',
  },
  duzLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    marginTop: 14,
    paddingVertical: 6,
  },
  duzLinkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
  },
});
