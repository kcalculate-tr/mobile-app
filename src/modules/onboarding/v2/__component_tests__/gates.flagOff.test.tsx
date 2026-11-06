// G15-S1 — bayrak kapalı parite: `yeni_onboarding` KAPALIYKEN üç kapı da ESKİ ekranı
// (UnifiedLoginScreen / KcalAiSignUpRoute / SignupEatScreen) render eder, v2'yi
// render ETMEZ; açıkken tersi. Eski ekranlar ve v2'ler mock bileşenlerle ayırt edilir.
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

const mockFlags: Record<string, boolean> = { yeni_onboarding: false };
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));

jest.mock('../../../../screens/auth/UnifiedLoginScreen', () => {
  const { Text: T } = require('react-native');
  return { __esModule: true, default: () => <T>OLD_LOGIN</T> };
});
jest.mock('../../../profil/ui/signup/KcalAiSignUpRoute', () => {
  const { Text: T } = require('react-native');
  return { __esModule: true, default: () => <T>OLD_SIGNUP_AI</T> };
});
jest.mock('../../../profil/ui/screens/SignupEatScreen', () => {
  const { Text: T } = require('react-native');
  return { __esModule: true, default: () => <T>OLD_SIGNUP_EAT</T> };
});
jest.mock('../LoginV2', () => {
  const { Text: T } = require('react-native');
  return { __esModule: true, default: () => <T>NEW_LOGIN</T> };
});
jest.mock('../SignupAIFlowV2', () => {
  const { Text: T } = require('react-native');
  return { __esModule: true, default: () => <T>NEW_SIGNUP_AI</T> };
});
jest.mock('../SignupEatFlowV2', () => {
  const { Text: T } = require('react-native');
  return { __esModule: true, default: () => <T>NEW_SIGNUP_EAT</T> };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn(), goBack: jest.fn() }),
}));

import LoginGate from '../LoginGate';
import SignupAIGate from '../SignupAIGate';
import SignupEatGate from '../SignupEatGate';

void Text;

describe('yeni_onboarding KAPALI → eski ekranlar aynen', () => {
  beforeEach(() => {
    mockFlags.yeni_onboarding = false;
  });
  test('Login', () => {
    const r = render(<LoginGate />);
    expect(r.queryByText('OLD_LOGIN')).toBeTruthy();
    expect(r.queryByText('NEW_LOGIN')).toBeNull();
  });
  test('Kcal AI kayıt', () => {
    const r = render(<SignupAIGate />);
    expect(r.queryByText('OLD_SIGNUP_AI')).toBeTruthy();
    expect(r.queryByText('NEW_SIGNUP_AI')).toBeNull();
  });
  test('eatkcal il kapısı', () => {
    const r = render(<SignupEatGate onBack={() => {}} onAllowed={() => {}} />);
    expect(r.queryByText('OLD_SIGNUP_EAT')).toBeTruthy();
    expect(r.queryByText('NEW_SIGNUP_EAT')).toBeNull();
  });
});

describe('yeni_onboarding AÇIK → v2', () => {
  beforeEach(() => {
    mockFlags.yeni_onboarding = true;
  });
  test('üç kapı da v2', () => {
    expect(render(<LoginGate />).queryByText('NEW_LOGIN')).toBeTruthy();
    expect(render(<SignupAIGate />).queryByText('NEW_SIGNUP_AI')).toBeTruthy();
    expect(
      render(<SignupEatGate onBack={() => {}} onAllowed={() => {}} />).queryByText('NEW_SIGNUP_EAT'),
    ).toBeTruthy();
  });
});
