import React from 'react';
import { render } from '@testing-library/react-native';
import { ProfileSocialHeader } from '../ProfileSocialHeader';

// useAuth → sabit kullanıcı (supabase jest.setup'ta mock'lu → handle boş döner,
// sayaç satırı render olmaz; Macro satırı her durumda görünmeli).
jest.mock('../../../../core/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));

test('yeni kabuk Profil başlığı: "Macro aboneliğim" satırı görünür', () => {
  const { getByText } = render(
    <ProfileSocialHeader name="İlter" avatarUrl={null} onOpenSubscriptions={() => {}} />,
  );
  expect(getByText('Macro aboneliğim')).toBeTruthy();
  expect(getByText('İlter')).toBeTruthy();
});
