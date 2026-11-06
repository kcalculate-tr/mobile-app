// eatkcal v2 (G13-S2 md.1 + md.11; G15-S5 md.2) — il kapısı rotası.
//
// G15-S5: şehir listesi (SignupEatScreen) yerine Final'deki fotoğraflı kapı
// (`ui/gate/CityGateView`: FinCityR1 / FinWaitlistR1 / FinEatBerlin). Asıl giriş
// artık eatkcal sekmesinin kendisi (EkHomeScreen); bu rota, sekme dışından
// sipariş eylemiyle gelinirse (geçilmemiş kapı) aynı görünümü açar.
// MANTIK AYNI: doğrulama `useEatkcalRegistration().checkCity` (checkDeliveryCity
// RPC); onaylanınca `writeCityGatePassed()` (bir daha sorulmaz), kayıtlı adres
// yoksa önce adres ekranı, varsa `next` hedefine devam.
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { writeCityGatePassed } from '../../cityGateStorage';
import { useAddressStore } from '../../../../store/addressStore';
import { useEkNav, type EkV2ParamList } from '../nav';
import { useEk } from '../ui/kit';
import { CityGateView } from '../ui/gate/CityGateView';

type R = RouteProp<EkV2ParamList, 'EkCityGate'>;

export default function EkCityGateScreen() {
  const { c } = useEk();
  const navigation = useEkNav();
  const params = useRoute<R>().params;
  const address = useAddressStore((s) => s.selectedAddress);

  const onBack = useCallback(() => navigation.goBack(), [navigation]);

  const onAllowed = useCallback(async () => {
    await writeCityGatePassed();
    const hasAddress = Boolean(useAddressStore.getState().selectedAddress);
    if (!hasAddress) {
      navigation.replace('EkAddressAdd', { selectMode: true });
      return;
    }
    if (params?.next === 'EkStore' && params.brandKey) {
      navigation.replace('EkStore', { brandKey: params.brandKey });
    } else if (params?.next === 'EkCart') {
      navigation.replace('EkCart');
    } else {
      navigation.goBack();
    }
  }, [navigation, params?.next, params?.brandKey]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} testID="ek-city-gate">
      <CityGateView onAllowed={onAllowed} onExit={onBack} otherCityName={address?.city ?? null} showTabSpace={false} />
    </View>
  );
}
