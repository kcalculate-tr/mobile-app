// Navigator kabuğu — `KcalAiSignUpScreen` saf `onDone`/`onBack` prop'ları alır
// (test edilebilirlik için navigasyona bağlı değil); bu dosya o prop'ları
// gerçek navigasyona bağlar. Hedef: `Tabs` (Home) — Keşfet sekmesi bu dalda
// henüz yok (bkz. G6-S3-LOG.md "Rota notu"); night6/kesfet-ui birleşince
// `onDone` Keşfet'e yönlendirilmeli.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../../../navigation/types';
import KcalAiSignUpScreen from './KcalAiSignUpScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function KcalAiSignUpRoute() {
  const navigation = useNavigation<Nav>();
  return (
    <KcalAiSignUpScreen
      onDone={() => navigation.replace('Tabs', { screen: 'Home' })}
      onBack={() => navigation.goBack()}
    />
  );
}
