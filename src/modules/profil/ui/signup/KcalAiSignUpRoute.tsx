// Navigator kabuğu — `KcalAiSignUpScreen` saf `onDone`/`onBack` prop'ları alır
// (test edilebilirlik için navigasyona bağlı değil); bu dosya o prop'ları
// gerçek navigasyona bağlar. G7-S1: `onDone` artık Keşfet'e yönlendiriyor
// (bu ekran zaten yalnız `kesfet` bayrağı açıkken açılabildiğinden Kesfet
// rotası AppNavigator'da kayıtlıdır).
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
      onDone={() => navigation.replace('Kesfet')}
      onBack={() => navigation.goBack()}
    />
  );
}
