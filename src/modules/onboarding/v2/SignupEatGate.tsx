// G15-S1 (Ek karar) — FinSignupEat kapısı: `yeni_onboarding` AÇIKSA yeni 3 panel
// akışı (SignupEatFlowV2), KAPALIYSA mevcut SignupEatScreen AYNEN (bayrak kapalı
// = bugünkü ekran). EkCityGateScreen bu bileşeni SignupEatScreen yerine mount eder
// (entegrasyon üst katmanda).
import React from 'react';
import { useFeature } from '../../../core/flags';
import SignupEatScreen from '../../profil/ui/screens/SignupEatScreen';
import SignupEatFlowV2, { type SignupEatFlowV2Props } from './SignupEatFlowV2';

export default function SignupEatGate(props: SignupEatFlowV2Props) {
  const yeni = useFeature('yeni_onboarding');
  if (!yeni) {
    return <SignupEatScreen onBack={props.onBack} onAllowed={props.onAllowed} />;
  }
  return <SignupEatFlowV2 {...props} />;
}
