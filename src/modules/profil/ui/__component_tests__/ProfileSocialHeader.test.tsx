import React from 'react';
import { render } from '@testing-library/react-native';
import { ProfileSocialHeader } from '../ProfileSocialHeader';

// useAuth → sabit kullanıcı (supabase jest.setup'ta mock'lu → handle boş döner,
// sayaç kartı render olmaz — uydurma sayı yok).
jest.mock('../../../../core/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));

test('yeni kabuk Profil başlığı (FinPrProfile): ad + baş harf + açık hesap çipi', () => {
  const { getByText, queryByText } = render(
    <ProfileSocialHeader name="İlter" avatarUrl={null} onOpenSubscriptions={() => {}} />,
  );
  expect(getByText('İlter')).toBeTruthy();
  expect(getByText('İ')).toBeTruthy();
  expect(getByText('Herkese açık hesap')).toBeTruthy();
  // G14-S1: "Macro aboneliğim" satırı Final'de yok (eatkcal › Macro ve Abonelik var).
  expect(queryByText('Macro aboneliğim')).toBeNull();
  // Veri yoksa sayaç kartı yok.
  expect(queryByText('takipçi')).toBeNull();
});
