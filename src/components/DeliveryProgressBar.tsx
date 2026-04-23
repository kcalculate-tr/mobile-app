import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Truck as TruckIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

interface DeliveryProgressBarProps {
  cartTotal: number;
  minOrderAmount?: number;
  freeDeliveryThreshold?: number;
}

const SUCCESS_GREEN = '#C6F04F';
const TRACK_COLOR = '#333333';
const CARD_BG = '#000000';
const TRUCK_SIZE = 22;
const BAR_HEIGHT = 6;
const TRUCK_OFFSET_TOP = -((TRUCK_SIZE - BAR_HEIGHT) / 2);

export default function DeliveryProgressBar({
  cartTotal,
  minOrderAmount = 150,
  freeDeliveryThreshold = 300,
}: DeliveryProgressBarProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const progressAnim = useRef(new Animated.Value(0)).current;

  const progressPercentage = freeDeliveryThreshold > 0
    ? Math.min((cartTotal / freeDeliveryThreshold) * 100, 100)
    : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercentage,
      duration: 420,
      useNativeDriver: false,
    }).start();
  }, [progressPercentage, progressAnim]);

  const belowMin = cartTotal < minOrderAmount;
  const belowFree = cartTotal >= minOrderAmount && cartTotal < freeDeliveryThreshold;
  const isFree = cartTotal >= freeDeliveryThreshold;

  const mainText = belowMin
    ? `Minimum sipariş tutarı için ₺${Math.ceil(minOrderAmount - cartTotal)} kaldı!`
    : belowFree
      ? `Ücretsiz teslimat için ₺${Math.ceil(freeDeliveryThreshold - cartTotal)} kaldı!`
      : 'Ücretsiz teslimat kazandınız!';

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {isFree ? (
          <CheckCircleIcon weight="fill" color={SUCCESS_GREEN} size={20} />
        ) : (
          <InfoIcon weight="duotone" color="#FFFFFF" size={20} />
        )}
        <Text style={[styles.mainLine, isFree && styles.mainLineSuccess]}>
          {mainText}
        </Text>
      </View>

      {!isFree ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
          style={styles.continueLinkWrap}
        >
          <Text style={styles.continueLinkText}>Alışverişe devam etmek için tıkla</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.freeStateSpacer} />
      )}

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: animatedWidth }]}>
          <View style={styles.truckWrap}>
            <TruckIcon size={TRUCK_SIZE} color={SUCCESS_GREEN} weight="duotone" />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  mainLine: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  mainLineSuccess: {
    color: SUCCESS_GREEN,
  },
  // Used only in the isFree state to preserve the pre-link gap between
  // title and bar now that the link (with its own margins) is gone.
  freeStateSpacer: {
    height: 16,
  },
  continueLinkWrap: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 10,
  },
  continueLinkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: 'rgba(255,255,255,0.65)',
    textDecorationLine: 'underline',
  },
  track: {
    height: BAR_HEIGHT,
    backgroundColor: TRACK_COLOR,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    backgroundColor: SUCCESS_GREEN,
    borderRadius: BAR_HEIGHT / 2,
    justifyContent: 'center',
  },
  truckWrap: {
    position: 'absolute',
    right: -14,
    top: TRUCK_OFFSET_TOP,
    backgroundColor: CARD_BG,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
