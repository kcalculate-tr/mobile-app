import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { TrackerDayHeader } from '../TrackerDayHeader';
import { setGunClient, resetGunClient } from '../../../modules/gun';
import type { DayRing, GunClient } from '../../../modules/gun';

// gun_halkasi açık → şerit/rings çekilir.
jest.mock('../../../core/flags', () => ({ useFeature: () => true }));

function gunClientWithStreak(streak: number): GunClient {
  const ring: DayRing = {
    user: { id: 'me', display_name: 'Ben', avatar_url: null },
    progress: 0.5,
    streak,
    has_new: false,
  };
  return {
    getDayRings: async () => [ring],
    getDayCards: async () => [],
    shareMealToDay: async () => {},
    addDayCardToDay: async () => ({ consumption_id: 'x' }),
  };
}

afterEach(() => resetGunClient());

test('halka dolumu + hedef satırı görünür (kcal / hedef)', async () => {
  setGunClient(gunClientWithStreak(0));
  const { getByText } = render(<TrackerDayHeader kcal={1000} target={2000} />);
  // gun.goal_kcal = '%{kcal} / %{target} kcal'
  expect(getByText('1000 / 2000 kcal')).toBeTruthy();
});

test('seri verisi YOKKEN (streak 0) Seri anı gösterilmez', async () => {
  setGunClient(gunClientWithStreak(0));
  const { queryByText } = render(<TrackerDayHeader kcal={1000} target={2000} />);
  await waitFor(() => {}); // rings yüklensin
  // gun.streak = '%{count} günlük seri'
  expect(queryByText('0 günlük seri')).toBeNull();
});

test('seri verisi VARKEN (streak 5) Seri anı görünür', async () => {
  setGunClient(gunClientWithStreak(5));
  const { findByText } = render(<TrackerDayHeader kcal={1000} target={2000} />);
  expect(await findByText('5 günlük seri')).toBeTruthy();
});

test('gun_halkasi açık + ring varken Gün halkası şeridi görünür', async () => {
  setGunClient(gunClientWithStreak(2));
  const { findByText } = render(<TrackerDayHeader kcal={1000} target={2000} />);
  // GunRingStrip ilk öğe etiketi gun.my_ring = 'Günüm'
  expect(await findByText('Günüm')).toBeTruthy();
});
