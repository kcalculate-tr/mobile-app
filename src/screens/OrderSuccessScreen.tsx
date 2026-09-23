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
  const [dots, setDots] = useState(1);
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
    const interval = setInterval(() => {
      setDots(d => d < 3 ? d + 1 : 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

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
    { icon: <CheckCircle size={22} color="#000000" weight="fill" />, label: 'Onaylandı', active: true },
    { icon: <Fire size={22} color="#000000" weight="fill" />, label: 'Hazırlanıyor' + '.'.repeat(dots), active: true },
    { icon: <Truck size={22} color={COLORS.text.tertiary} weight="fill" />, label: 'Yolda', active: false },
    { icon: <House size={22} color={COLORS.text.tertiary} weight="fill" />, label: 'Teslim', active: false },
  ];

  // Veri YOKSA kart hiç çizilmez; "kazanılamadı" iddiası doğrulanamaz.
  const macroGoster = kazanilanMacro !== null && kazanilanMacro > 0;

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%', alignItems: 'center' }}>
          {/* Success Checkmark */}
          <Animated.View style={[styles.successCircle, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}>
            <Svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <Path
                d="M12 28L22 38L44 16"
                stroke="#000000"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>

          {/* Başlık */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>Sipariş Verildi!</Text>
            <Confetti size={28} color={COLORS.brand.green} weight="fill" />
          </View>
          <Text style={styles.subtitle}>
            Siparişiniz başarıyla alındı ve hazırlanmaya başlandı
          </Text>

          {/* Order Code Card */}
          <View style={styles.orderCard}>
            <Text style={styles.orderLabel}>SİPARİŞ NUMARASI</Text>
            <Animated.Text style={[styles.orderCode, {
              opacity: orderCodeAnim,
              transform: [{ scale: orderCodeScale }],
            }]}>
              {orderCode}
            </Animated.Text>

            {/* Timeline */}
            <View style={styles.timeline}>
              {steps.map((step, i) => (
                <React.Fragment key={i}>
                  <View style={styles.timelineStep}>
                    <View style={[styles.stepCircle, step.active && styles.stepCircleActive]}>
                      {step.icon}
                    </View>
                    <Text style={[styles.stepLabel, step.active && styles.stepLabelActive]}>
                      {step.label}
                    </Text>
                  </View>
                  {i < 3 && (
                    <View style={[styles.timelineConnector, i < 1 && styles.timelineConnectorActive]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Delivery Time */}
          <View style={styles.deliveryCard}>
            <View style={styles.deliveryIcon}>
              <Timer size={28} color="#000000" weight="fill" />
            </View>
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryLabel}>Tahmini Teslimat</Text>
              <Text style={styles.deliveryTime}>35-45 dakika</Text>
            </View>
          </View>

          {/* Notice */}
          {noticeMessage ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{noticeMessage}</Text>
            </View>
          ) : null}

          {/* ── Macro kazancı — yalnızca gerçek veri varken ── */}
          {macroGoster ? (
            <Animated.View
              style={[
                styles.macroHero,
                { opacity: macroOpacity, transform: [{ scale: macroScale }] },
              ]}
            >
              <Image
                source={require('../../assets/macro-coin.png')}
                style={styles.macroHeroCoin}
                resizeMode="contain"
              />
              <Text style={styles.macroHeroSayi}>+{kazanilanMacro}</Text>
              <Text style={styles.macroHeroBaslik}>MACRO KAZANDIN</Text>
              <Text style={styles.macroHeroAlt}>
                Teslimattan sonra hesabına eklenir.
              </Text>

              <TouchableOpacity
                style={styles.macroHeroLink}
                onPress={() => navigation.navigate('Tabs', { screen: 'Subscriptions' })}
                activeOpacity={0.75}
              >
                <Text style={styles.macroHeroLinkText}>{"Macro'larım"}</Text>
                <ArrowRight size={13} color={COLORS.brand.green} weight="bold" />
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {/* Buton 1 — Siparişimi Takip Et (siyah) */}
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => navigation.navigate('ProfileOrders')}
            activeOpacity={0.8}
          >
            <Package size={20} color="#ffffff" weight="bold" />
            <Text style={styles.trackButtonText}>Siparişimi Takip Et</Text>
          </TouchableOpacity>

          {/* Buton 2 — Kcal Tracker'a Geç (outline) */}
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => navigation.navigate('Tabs', { screen: 'Tracker' })}
            activeOpacity={0.8}
          >
            <ChartLineUp size={20} color="#111111" weight="bold" />
            <Text style={styles.outlineButtonText}>{"Kcal Tracker'a Geç"}</Text>
          </TouchableOpacity>

          {/* Buton 3 — Anasayfaya Dön (outline) */}
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
            activeOpacity={0.8}
          >
            <House size={20} color="#111111" weight="bold" />
            <Text style={styles.outlineButtonText}>Anasayfaya Dön</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: COLORS.brand.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  orderCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  orderLabel: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  orderCode: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 16,
    letterSpacing: 2,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  timelineStep: {
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.brand.green,
  },
  stepLabel: {
    fontSize: 9,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    borderRadius: 100,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
    marginBottom: 20,
  },
  timelineConnectorActive: {
    backgroundColor: COLORS.brand.green,
  },
  deliveryCard: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deliveryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryInfo: {
    gap: 2,
  },
  deliveryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  deliveryTime: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.brand.green,
  },
  noticeBox: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noticeText: {
    color: '#9A3412',
    fontSize: 13,
    lineHeight: 18,
  },
  // Macro Coin Card — siyah, her zaman gösterilir
  // Kazanım sipariş başarı ekranının ikinci ödülü: küçük bir satır değil,
  // kendi sahnesi olan bir blok.
  macroHero: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  macroHeroCoin: {
    width: 56,
    height: 56,
    marginBottom: 10,
  },
  macroHeroSayi: {
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.brand.green,
  },
  macroHeroBaslik: {
    marginTop: 2,
    fontSize: 13,
    letterSpacing: 2.2,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  macroHeroAlt: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.55)',
  },
  macroHeroLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(185,239,20,0.14)',
  },
  macroHeroLinkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.brand.green,
  },
  // Buton 1 — siyah (distinguish)
  trackButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#ffffff',
  },
  // Butonlar 2 & 3 — outline
  outlineButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#111111',
  },
});
