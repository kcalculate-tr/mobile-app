// eatkcal v2 — konum kapısı rotası (sekme dışından sipariş eylemiyle gelinirse; ör. Ana sayfa vitrini).
//
// G48-S1: eski il kapısı görünümü / SignupEatGate yerine tek ekran `EkLocationGate` (eatkcal sekmesindekiyle aynı).
// Hizmet verilen İzmir ilçesi: oturum varsa adres ekleme (ilçe dolu) → kaydedince `next` hedefi
// (mağaza / sepet) ya da geri; oturum yoksa oturumsuz gezinme işareti → `next` hedefi.
// Diğer her seçim kapının "Çok yakında" durumunda kalır; sipariş akışı başlamaz.
import React, { useCallback } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useAuth } from '../../../../core/AuthContext';
import { writeCityGatePassed } from '../../cityGateStorage';
import { useEkNav, type EkV2ParamList } from '../nav';
import { EkLocationGate } from '../../gate/EkLocationGate';
import type { GateSelection } from '../../gate/gateRule';

type R = RouteProp<EkV2ParamList, 'EkCityGate'>;

export default function EkCityGateScreen() {
  const navigation = useEkNav();
  const params = useRoute<R>().params;
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const onBack = useCallback(() => navigation.goBack(), [navigation]);

  const goNext = useCallback(() => {
    if (params?.next === 'EkStore' && params.brandKey) navigation.replace('EkStore', { brandKey: params.brandKey });
    else if (params?.next === 'EkCart') navigation.replace('EkCart');
    else navigation.goBack();
  }, [navigation, params?.next, params?.brandKey]);

  const onServed = useCallback(
    async (sel: GateSelection) => {
      if (!userId) {
        await writeCityGatePassed();
        goNext();
        return;
      }
      navigation.replace('EkAddressAdd', {
        gateDistrict: sel.district ?? undefined,
        afterGate: { next: params?.next, brandKey: params?.brandKey },
      });
    },
    [userId, goNext, navigation, params?.next, params?.brandKey],
  );

  return (
    <EkLocationGate
      onServed={onServed}
      onExit={onBack}
      showTabSpace={false}
      onPrivacy={() => navigation.navigate('ProfileContracts', { slug: 'kvkk' })}
    />
  );
}
