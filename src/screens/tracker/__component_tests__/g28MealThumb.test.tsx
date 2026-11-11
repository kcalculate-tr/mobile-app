// G28-S1 md.2 — Ana sayfa öğün satırı küçük görseli: Tara fotoğrafı (imzalı URL) → yüklenirken
// iskelet → yoksa kase cam nesnesi; sonuç → liste geçişinde aynı yerel kare.
import React from 'react';
import { render, act } from '@testing-library/react-native';

const mockSigned = jest.fn();
jest.mock('../../../core/supabase', () => ({
  getSupabaseClient: () => ({
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockSigned(...a) }) },
  }),
}));

import { HomeMealSlots } from '../HomeMealSlots';
import { buildSlots } from '../../../modules/gun/homeData';
import { __resetMealPhotoCache, rememberLocalMealPhoto } from '../../../modules/gun/mealPhoto';

const row = (id: string, photo: string | null) => ({
  id,
  source: 'ai_scan',
  name: 'Amerikano (sade kahve), 1 büyük fincan',
  meal_type: 'ogle',
  calories: 8,
  protein: 1,
  carbs: 1,
  fat: 0,
  consumed_at: '2026-11-11T09:00:00Z',
  photo_path: photo,
});

function mount(rows: ReturnType<typeof row>[]) {
  return render(
    <HomeMealSlots slots={buildSlots(rows)} eaten={8} target={2000} onLog={() => {}} onChangeMeal={() => {}} onRemove={() => {}} />,
  );
}

beforeEach(() => {
  __resetMealPhotoCache();
  mockSigned.mockReset();
});

test('photo_path → yüklenirken iskelet, sonra imzalı URL görseli', async () => {
  let resolve: (v: unknown) => void = () => {};
  mockSigned.mockReturnValue(new Promise((r) => (resolve = r)));
  const ui = mount([row('a', 'u1/scans/a.jpg')]);
  expect(ui.getByTestId('home-thumb-a-skeleton')).toBeTruthy();
  await act(async () => {
    resolve({ data: { signedUrl: 'https://signed/a' }, error: null });
  });
  expect(ui.getByTestId('home-thumb-a-img').props.source).toEqual({ uri: 'https://signed/a' });
  expect(mockSigned).toHaveBeenCalledWith('u1/scans/a.jpg', 3600);
});

test('fotoğraf yoksa kase cam nesnesi (gri kutu değil)', () => {
  const ui = mount([row('b', null)]);
  expect(ui.getByTestId('home-thumb-b-bowl')).toBeTruthy();
  expect(mockSigned).not.toHaveBeenCalled();
});

test('imzalanamazsa kase nesnesine düşer', async () => {
  mockSigned.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
  const ui = mount([row('c', 'u1/scans/c.jpg')]);
  await act(async () => {});
  expect(ui.getByTestId('home-thumb-c-bowl')).toBeTruthy();
});

test('sonuç → liste: yerel kare ağ beklemeden çizilir', () => {
  rememberLocalMealPhoto('u1/scans/d.jpg', 'file:///scan-d.jpg');
  const ui = mount([row('d', 'u1/scans/d.jpg')]);
  expect(ui.getByTestId('home-thumb-d-img').props.source).toEqual({ uri: 'file:///scan-d.jpg' });
  expect(mockSigned).not.toHaveBeenCalled();
});

test('md.3: ad tek satır (kesilir), 15 pt', () => {
  const ui = mount([row('e', null)]);
  const name = ui.getByText('Amerikano (sade kahve), 1 büyük fincan');
  expect(name.props.numberOfLines).toBe(1);
  const flat = Array.isArray(name.props.style) ? Object.assign({}, ...name.props.style.flat()) : name.props.style;
  expect(flat.fontSize).toBe(15);
});
