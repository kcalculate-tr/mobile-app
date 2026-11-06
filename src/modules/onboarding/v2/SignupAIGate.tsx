// G15-S1 (Ek karar) — `KcalAiSignUp` rotasının bayrak kapısı. `yeni_onboarding`
// açıksa Final görünümlü v2 akış, kapalıysa MEVCUT `KcalAiSignUpRoute` (bayt bayt
// bugünkü ekran). Rota sarmalayıcısı KcalAiSignUpRoute ile aynı: onDone → Keşfet,
// onBack → geri.

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFeature } from '../../../core/flags';
import type { RootStackParamList } from '../../../navigation/types';
import KcalAiSignUpRoute from '../../profil/ui/signup/KcalAiSignUpRoute';
import SignupAIFlowV2 from './SignupAIFlowV2';

function SignupAIRouteV2() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SignupAIFlowV2
      onDone={() => navigation.replace('Kesfet')}
      onBack={() => navigation.goBack()}
    />
  );
}

export default function SignupAIGate() {
  const on = useFeature('yeni_onboarding');
  return on ? <SignupAIRouteV2 /> : <KcalAiSignUpRoute />;
}
