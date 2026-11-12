// G15-S2 — FinPhotoR1 / FinCollectCut: Final öğeleri render oluyor ve gerçek
// işlevlere bağlı (Planıma ekle, Bu öğünü kaydet, eşleşme yüzdesi).
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import FinPhotoResult from '../ui/FinPhotoResult';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const base = {
  photoUri: null,
  mealType: 'lunch' as const,
  saving: false,
  saved: false,
  lang: 'tr' as const,
  onChangeMealType: () => {},
  onSave: () => {},
  onRetry: () => {},
};

const multi = {
  name: 'Ezogelin çorbası, pilav, ayran',
  kcal: 460,
  protein_g: 24,
  carbs_g: 62,
  fat_g: 13,
  portion: 1,
  photo_url: null,
  ingredients: [
    { name: 'Ezogelin çorbası', grams: 250, kcal: 180 },
    { name: 'Pilav', grams: 150, kcal: 210 },
    { name: 'Ayran', grams: 200, kcal: 70 },
  ],
};

test('FinPhotoR1: toplam, öğeler, Eksik besin ekle, Planıma ekle + Bu öğünü kaydet bağlı', async () => {
  const onAddToPlan = jest.fn(async () => true);
  const onSaveMeal = jest.fn(async () => {});
  const tree = render(<FinPhotoResult {...base} estimate={multi} onAddToPlan={onAddToPlan} onSaveMeal={onSaveMeal} />);
  expect(tree.getByText('3 öğe bulundu')).toBeTruthy();
  expect(tree.getByText('Ezogelin çorbası')).toBeTruthy();
  expect(tree.getByText('Eksik besin ekle')).toBeTruthy();
  fireEvent.press(tree.getByText('Planıma ekle'));
  await waitFor(() => expect(tree.getByText('Yarına planlandı')).toBeTruthy());
  expect(onAddToPlan).toHaveBeenCalledTimes(1);
  fireEvent.press(tree.getByText('Bu öğünü kaydet'));
  await waitFor(() => expect(tree.getByText('Koleksiyona kaydedildi')).toBeTruthy());
  expect(onSaveMeal).toHaveBeenCalledTimes(1);
  expect(tree.getByText('Öğle’ye logla')).toBeTruthy();
});

test('FinCollectCut: tek tabak → kompakt sonuç, hapta "%92 eşleşme"', () => {
  const single = { ...multi, name: 'Tavuk kinoa bowl', kcal: 540, protein_g: 42, carbs_g: 48, fat_g: 18, ingredients: [{ name: 'Tavuk kinoa bowl', grams: 380, kcal: 540 }] };
  const tree = render(<FinPhotoResult {...base} estimate={single} match={92} />);
  expect(tree.getByText('Tavuk kinoa bowl, %92 eşleşme')).toBeTruthy();
  expect(tree.getByText('Fotoğraf sonucu')).toBeTruthy();
});
