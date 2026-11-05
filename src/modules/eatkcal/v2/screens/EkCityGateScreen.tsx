// eatkcal v2 (G13-S2 md.1 + md.11) — il kapısı: ilk "Sipariş ver"de bir kez.
//
// FinSignupEat panel 1 / FinCityR1 / FinWaitlistR1 → G12-S4'ün
// `SignupEatScreen`'i (src/modules/profil/ui/screens/SignupEatScreen.tsx) AYNEN
// mount edilir: şehir listesi, "Çok yakında · Haber ver" ve sunucu doğrulaması
// (`useEatkcalRegistration().checkCity` → checkDeliveryCity RPC) onun mevcut
// mantığı; burada yeni kural YOK. Onaylanınca bugünkü EatHomeScreen
// (handleGateConfirmed) ile aynı: `writeCityGatePassed()` (bir daha sorulmaz),
// kayıtlı adres yoksa önce adres ekranı (FinSignupEat panel 2), varsa
// `next` hedefine devam. FinEatBerlin (mutfak olmayan şehir): sahte restoran
// listesi YOK — Ana sayfadaki `restoran_yakinda` "Yakında burada" kartı.
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import SignupEatScreen from '../../../profil/ui/screens/SignupEatScreen';
import { writeCityGatePassed } from '../../cityGateStorage';
import { useAddressStore } from '../../../../store/addressStore';
import { useEkNav, type EkV2ParamList } from '../nav';
import { useEk } from '../ui/kit';

type R = RouteProp<EkV2ParamList, 'EkCityGate'>;

export default function EkCityGateScreen() {
  const { c, insets } = useEk();
  const navigation = useEkNav();
  const params = useRoute<R>().params;

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
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }} testID="ek-city-gate">
      <SignupEatScreen onBack={onBack} onAllowed={onAllowed} />
    </View>
  );
}
