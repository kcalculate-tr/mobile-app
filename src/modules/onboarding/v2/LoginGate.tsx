// G15-S1 (Ek karar) — `Login` rotası kapısı: `yeni_onboarding` açıksa Final
// görünümü (LoginV2), kapalıysa mevcut UnifiedLoginScreen AYNEN. AppNavigator
// `Login` rotasında bu bileşeni kullanır (eski dosyalar değişmez).
import React from 'react';
import { useFeature } from '../../../core/flags';
import UnifiedLoginScreen from '../../../screens/auth/UnifiedLoginScreen';
import LoginV2 from './LoginV2';

export default function LoginGate() {
  const yeni = useFeature('yeni_onboarding');
  return yeni ? <LoginV2 /> : <UnifiedLoginScreen />;
}
