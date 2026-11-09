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
import SignupEatGate from '../../../onboarding/v2/SignupEatGate';
import { useFeature } from '../../../../core/flags';
import { writeCityGatePassed } from '../../cityGateStorage';
import { useAddressStore } from '../../../../store/addressStore';
import { useEkNav, type EkV2ParamList } from '../nav';
import { useEk } from '../ui/kit';
import { CityGateView } from '../ui/gate/CityGateView';

type R = RouteProp<EkV2ParamList, 'EkCityGate'>;

export default function EkCityGateScreen() {
  const { c, insets } = useEk();
  const navigation = useEkNav();
  const params = useRoute<R>().params;
  const address = useAddressStore((s) => s.selectedAddress);

  const onBack = useCallback(() => navigation.goBack(), [navigation]);

  // G15-S1 Ek karar: `yeni_onboarding` açıkken Final 3 panel (şehir → adres → telefon)
  // SignupEatGate içinde; adres akışın İÇİNDE kaydedilir → ayrıca EkAddressAdd'e gidilmez.
  const yeniOnboarding = useFeature('yeni_onboarding');

  const onAllowed = useCallback(async () => {
    if (!yeniOnboarding) await writeCityGatePassed();
    const hasAddress = Boolean(useAddressStore.getState().selectedAddress);
    if (!hasAddress && !yeniOnboarding) {
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
  }, [navigation, params?.next, params?.brandKey, yeniOnboarding]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: yeniOnboarding ? insets.top : 0 }} testID="ek-city-gate">
      {yeniOnboarding ? (
        <SignupEatGate onBack={onBack} onAllowed={onAllowed} onCityAllowed={() => void writeCityGatePassed()} />
      ) : (
        <CityGateView
          onAllowed={onAllowed}
          onExit={onBack}
          onPrivacy={() => navigation.navigate('ProfileContracts', { slug: 'kvkk' })}
          otherCityName={address?.city ?? null}
          showTabSpace={false}
        />
      )}
    </View>
  );
}
