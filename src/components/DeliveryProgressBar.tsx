import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Truck as TruckIcon,
  CheckCircle as CheckCircleIcon,
  ArrowRight as ArrowRightIcon,
} from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

interface DeliveryProgressBarProps {
  cartTotal: number;
  minOrderAmount?: number;
  freeDeliveryThreshold?: number;
}

const NEON = '#B9EF14';
const CARD_BG = '#000000';
const TRACK_COLOR = 'rgba(255,255,255,0.14)';
const BAR_HEIGHT = 10;
const TRUCK = 18;

const lira = (v: number) => `₺${Math.ceil(v).toLocaleString('tr-TR')}`;

export default function DeliveryProgressBar({
  cartTotal,
  minOrderAmount = 150,
  freeDeliveryThreshold = 300,
}: DeliveryProgressBarProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Eşik 0 ise (teslimat her zaman ücretsiz) ilerleme kavramı yok: bar DOLU
  // gösterilir. Eski davranış 0% bırakıp "Ücretsiz teslimat kazandınız!"
  // yazıyordu -> boş bar + sola yapışık kamyon (21.09.2026 tasarım notu).
  const hasFreeThreshold = freeDeliveryThreshold > 0;

  const belowMin = minOrderAmount > 0 && cartTotal < minOrderAmount;
  const belowFree = hasFreeThreshold && !belowMin && cartTotal < freeDeliveryThreshold;
  const isFree = !belowMin && !belowFree;

  /** O anki hedef — bar'ın sağ ucunda gösterilen tutar. */
  const hedef = belowMin ? minOrderAmount : freeDeliveryThreshold;
  const kalan = Math.max(hedef - cartTotal, 0);

  const progressPercentage = isFree ? 100 : Math.min((cartTotal / Math.max(hedef, 1)) * 100, 100);

  const baslik = belowMin
    ? 'Minimum sipariş tutarına'
    : belowFree
      ? 'Ücretsiz teslimata'
      : hasFreeThreshold
        ? 'Ücretsiz teslimat kazandınız'
        : 'Teslimat ücretsiz';

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercentage,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progressPercentage, progressAnim]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      <View style={styles.ustSatir}>
        <View style={[styles.ikonKutu, isFree && styles.ikonKutuBasarili]}>
          {isFree ? (
            <CheckCircleIcon weight="fill" color="#000000" size={20} />
          ) : (
            <TruckIcon weight="fill" color={NEON} size={20} />
          )}
        </View>

        <View style={styles.metinStack}>
          <Text style={styles.baslik}>{baslik}</Text>
          {isFree ? (
            <Text style={styles.altBilgiBasarili}>Bu sipariş için teslimat ücreti alınmayacak.</Text>
          ) : (
            // Beyin doğrudan RAKAMA odaklansın: kalan tutar en büyük öge.
            <Text style={styles.kalanSatir}>
              <Text style={styles.kalanTutar}>{lira(kalan)}</Text>
              <Text style={styles.kalanEk}> kaldı</Text>
            </Text>
          )}
        </View>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: animatedWidth }]}>
          {!isFree ? (
            <View style={styles.truckWrap}>
              <TruckIcon size={TRUCK} color="#000000" weight="fill" />
            </View>
          ) : null}
        </Animated.View>
      </View>

      <View style={styles.altSatir}>
        <Text style={styles.tutarSol}>{lira(cartTotal)}</Text>
        {isFree ? (
          <View style={styles.rozet}>
            <Text style={styles.rozetText}>TAMAMLANDI</Text>
          </View>
        ) : (
          <Text style={styles.tutarSag}>{lira(hedef)}</Text>
        )}
      </View>

      {!isFree ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
          style={styles.devamBtn}
        >
          <Text style={styles.devamText}>Alışverişe devam et</Text>
          <ArrowRightIcon size={13} color={NEON} weight="bold" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  ustSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  ikonKutu: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(185,239,20,0.14)',
  },
  ikonKutuBasarili: {
    backgroundColor: NEON,
  },
  metinStack: {
    flex: 1,
    gap: 2,
  },
  baslik: {
    fontSize: 12,
    letterSpacing: 0.2,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.62)',
  },
  kalanSatir: {
    color: '#FFFFFF',
  },
  kalanTutar: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: NEON,
  },
  kalanEk: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#FFFFFF',
  },
  altBilgiBasarili: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  track: {
    height: BAR_HEIGHT,
    backgroundColor: TRACK_COLOR,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    minWidth: BAR_HEIGHT,
    backgroundColor: NEON,
    borderRadius: BAR_HEIGHT / 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // Kamyon dolgunun İÇİNDE, sağ ucunda durur: bar taşmaz, ilerledikçe
  // ucu iter. (Eskiden dolgunun dışına taşıp kart zeminiyle maskeleniyordu.)
  truckWrap: {
    marginRight: 2,
  },
  altSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tutarSol: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  tutarSag: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.5)',
  },
  rozet: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: 'rgba(185,239,20,0.16)',
  },
  rozetText: {
    fontSize: 10,
    letterSpacing: 0.8,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: NEON,
  },
  devamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 14,
  },
  devamText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: NEON,
  },
});
