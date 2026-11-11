// G29-S1 md.1 — öğün satırında çıkartma: çıkartma (şeffaf, gri kutu yok) → yoksa fotoğraf → o da
// yoksa kase cam nesnesi. Migration yokken (sütun yok) fotoğraf; az önce loglanan kayıt yerel çıkartma.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockSigned = jest.fn();
const mockSelect = jest.fn();
jest.mock('../../../core/supabase', () => ({
  getSupabaseClient: () => ({
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockSigned(...a) }) },
    from: () => ({ select: () => ({ in: (...a: unknown[]) => mockSelect(...a) }) }),
  }),
}));

import { HomeMealSlots } from '../HomeMealSlots';
import { buildSlots } from '../../../modules/gun/homeData';
import { __resetMealPhotoCache } from '../../../modules/gun/mealPhoto';
import { __resetStickerStore, rememberLocalSticker } from '../../../lib/sticker/stickerStore';

const row = (id: string, photo: string | null) => ({
  id,
  source: 'ai_scan',
  name: 'Tavuk kinoa bowl',
  meal_type: 'ogle',
  calories: 540,
  protein: 42,
  carbs: 48,
  fat: 18,
  consumed_at: '2026-11-11T09:00:00Z',
  photo_path: photo,
});

function mount(rows: ReturnType<typeof row>[]) {
  return render(
    <HomeMealSlots slots={buildSlots(rows)} eaten={540} target={2000} onLog={() => {}} onChangeMeal={() => {}} onRemove={() => {}} />,
  );
}

beforeEach(() => {
  __resetMealPhotoCache();
  __resetStickerStore();
  mockSigned.mockReset();
  mockSelect.mockReset();
  mockSigned.mockImplementation((path: string) => Promise.resolve({ data: { signedUrl: `https://signed/${path}` }, error: null }));
});

test('sticker_path varsa satırda çıkartma (contain, gri zemin yok)', async () => {
  mockSelect.mockResolvedValue({ data: [{ id: 'a', sticker_path: 'u1/stickers/a.webp' }], error: null });
  const ui = mount([row('a', 'u1/scans/a.jpg')]);
  await act(async () => {});
  const img = ui.getByTestId('home-thumb-a-sticker-img', { includeHiddenElements: true });
  expect(img.props.source).toEqual({ uri: 'https://signed/u1/stickers/a.webp' });
  expect(img.props.resizeMode).toBe('contain');
  // G30-S1 md.2: 44 pt satırda 2 pt beyaz kontur (8 yön, beyaz tint) + çok hafif gölge.
  const outline = ui.getAllByTestId('home-thumb-a-sticker-outline', { includeHiddenElements: true });
  expect(outline).toHaveLength(8);
  expect(StyleSheet.flatten(outline[0].props.style).tintColor).toBe('#FFFFFF');
  expect(ui.getByTestId('home-thumb-a-sticker-shadow', { includeHiddenElements: true })).toBeTruthy();
  // kontur kırpılmasın: kap overflow hidden değil
  expect(StyleSheet.flatten(ui.getByTestId('home-thumb-a').props.style).overflow).toBeUndefined();
  const box = StyleSheet.flatten(ui.getByTestId('home-thumb-a').props.style);
  expect(box.backgroundColor).toBeUndefined();
  expect(mockSelect).toHaveBeenCalledWith('id', ['a']);
});

test('çıkartma yoksa fotoğraf (G28 davranışı)', async () => {
  mockSelect.mockResolvedValue({ data: [{ id: 'b', sticker_path: null }], error: null });
  const ui = mount([row('b', 'u1/scans/b.jpg')]);
  await act(async () => {});
  expect(ui.queryByTestId('home-thumb-b-sticker', { includeHiddenElements: true })).toBeNull();
  // G30-S1 md.2: normal fotoğrafa kontur UYGULANMAZ.
  expect(ui.queryByTestId('home-thumb-b-sticker-outline', { includeHiddenElements: true })).toBeNull();
  expect(ui.getByTestId('home-thumb-b-img').props.source).toEqual({ uri: 'https://signed/u1/scans/b.jpg' });
});

test('migration uygulanmamış (sütun yok) → fotoğraf; bir daha sorulmaz', async () => {
  mockSelect.mockResolvedValue({ data: null, error: { code: '42703', message: 'column meal_consumptions.sticker_path does not exist' } });
  const ui = mount([row('c', 'u1/scans/c.jpg')]);
  await act(async () => {});
  expect(ui.getByTestId('home-thumb-c-img')).toBeTruthy();
  ui.unmount();
  const ui2 = mount([row('d', 'u1/scans/d.jpg')]);
  await act(async () => {});
  expect(ui2.getByTestId('home-thumb-d-img')).toBeTruthy();
  expect(mockSelect).toHaveBeenCalledTimes(1);
});

test('fotoğrafsız kayıtta çıkartma sorulmaz → kase cam nesnesi', async () => {
  const ui = mount([row('e', null)]);
  await act(async () => {});
  expect(ui.getByTestId('home-thumb-e-bowl')).toBeTruthy();
  expect(mockSelect).not.toHaveBeenCalled();
});

test('az önce loglanan kayıt: yerel çıkartma ağ beklemeden', () => {
  rememberLocalSticker('f', 'file:///tmp/kcal-sticker-f.webp');
  const ui = mount([row('f', 'u1/scans/f.jpg')]);
  expect(ui.getByTestId('home-thumb-f-sticker-img', { includeHiddenElements: true }).props.source).toEqual({ uri: 'file:///tmp/kcal-sticker-f.webp' });
  expect(mockSelect).not.toHaveBeenCalled();
});

test('çıkartma okunamazsa (ağ) fotoğrafa düşer', async () => {
  mockSelect.mockRejectedValue(new Error('network'));
  const ui = mount([row('g', 'u1/scans/g.jpg')]);
  await act(async () => {});
  expect(ui.getByTestId('home-thumb-g-img')).toBeTruthy();
});
