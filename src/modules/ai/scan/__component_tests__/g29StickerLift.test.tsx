// G29-S1 md.1 — FinMoSticker "Çıkartma kalkar": çıkartma fotoğrafın üstüne birebir oturur (cover
// kutusu), karartma + gölge + kalkış, haptik light; çıkartma yoksa hiçbir şey çizilmez (normal foto).
// Logla izi: çıkartma uçarken kırpılmaz (cutout).
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockHaptic = jest.fn();
let mockReduced = false;
jest.mock('../../../../core/design', () => ({
  ...jest.requireActual('../../../../core/design'),
  haptic: (k: string) => mockHaptic(k),
  useReducedMotion: () => mockReduced,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import FinPhotoResult from '../ui/FinPhotoResult';
import StickerLift, { LIFT_HAPTIC_MS } from '../ui/StickerLift';
import type { Sticker } from '../../../../lib/sticker/subjectLift';

const STICKER: Sticker = {
  uri: 'file:///tmp/kcal-sticker-1.webp',
  width: 512,
  height: 512,
  format: 'webp',
  bytes: 20000,
  sourceWidth: 1200,
  sourceHeight: 1600,
  crop: { x: 0.1, y: 0.25, width: 0.8, height: 0.6 },
};

const single = {
  name: 'Tavuk kinoa bowl',
  kcal: 540,
  protein_g: 42,
  carbs_g: 48,
  fat_g: 18,
  portion: 1,
  photo_url: null,
  ingredients: [{ name: 'Tavuk kinoa bowl', grams: 380, kcal: 540 }],
};
const base = {
  estimate: single,
  photoUri: 'file:///scan.jpg',
  mealType: 'lunch' as const,
  saving: false,
  saved: false,
  lang: 'tr' as const,
  onChangeMealType: () => {},
  onSave: () => {},
  onRetry: () => {},
};

beforeEach(() => {
  mockHaptic.mockReset();
  mockReduced = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

function layout(tree: ReturnType<typeof render>, width: number, height: number) {
  // kompakt sonucun kökü (tam ekran foto kabı) onLayout ile ölçülür
  const root = tree.UNSAFE_root.findAll((n: any) => typeof n.props?.onLayout === 'function' && n.props?.style && StyleSheet.flatten(n.props.style)?.backgroundColor === '#2A2622')[0];
  fireEvent(root, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

test('çıkartma yoksa kalkış katmanı hiç yok (normal fotoğraf)', () => {
  const tree = render(<FinPhotoResult {...base} sticker={null} />);
  expect(tree.queryByTestId('sticker-lift', { includeHiddenElements: true })).toBeNull();
  expect(tree.getByText('Fotoğraf sonucu')).toBeTruthy();
});

test('çıkartma fotoğrafın üstüne birebir oturur (cover kutusu) ve kalkar; haptik light', () => {
  const tree = render(<FinPhotoResult {...base} sticker={STICKER} />);
  layout(tree, 390, 844);
  const el = tree.getByTestId('sticker-lift-sticker', { includeHiddenElements: true });
  const st = StyleSheet.flatten(el.props.style);
  // 1200×1600 foto 390×844 kapta cover: ölçek max(390/1200, 844/1600)=0.5275 → 633×844, ox = −121.5
  const s = Math.max(390 / 1200, 844 / 1600);
  const dw = 1200 * s;
  const ox = (390 - dw) / 2;
  expect(st.left).toBeCloseTo(ox + 0.1 * dw, 3);
  expect(st.top).toBeCloseTo(0.25 * 844, 3);
  expect(st.width).toBeCloseTo(0.8 * dw, 3);
  expect(st.height).toBeCloseTo(0.6 * 844, 3);
  expect(tree.getByTestId('sticker-lift-dim', { includeHiddenElements: true })).toBeTruthy();
  expect(tree.getByTestId('sticker-lift-shadow', { includeHiddenElements: true })).toBeTruthy();
  // dekoratif: VoiceOver'a kapalı, dokunmayı engellemez
  const layer = tree.getByTestId('sticker-lift', { includeHiddenElements: true });
  expect(layer.props.pointerEvents).toBe('none');
  expect(layer.props.accessible).toBe(false);
  expect(mockHaptic).not.toHaveBeenCalledWith('light');
  act(() => {
    jest.advanceTimersByTime(LIFT_HAPTIC_MS + 10);
  });
  expect(mockHaptic).toHaveBeenCalledWith('light');
});

test('azaltılmış hareket: çıkartma yine görünür (opaklık), çökme yok', () => {
  mockReduced = true;
  const tree = render(<FinPhotoResult {...base} sticker={STICKER} />);
  layout(tree, 390, 844);
  expect(tree.getByTestId('sticker-lift-sticker', { includeHiddenElements: true })).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(1500);
  });
});

test('kap ölçülmeden çıkartma çizilmez (yanlış konum yok)', () => {
  const tree = render(<StickerLift sticker={STICKER} container={null} reduced={false} />);
  expect(tree.queryByTestId('sticker-lift', { includeHiddenElements: true })).toBeNull();
});

test('fotoğraf yoksa (ses sonucu vb.) çıkartma çizilmez', () => {
  const tree = render(<FinPhotoResult {...base} photoUri={null} sticker={STICKER} />);
  expect(tree.queryByTestId('sticker-lift', { includeHiddenElements: true })).toBeNull();
});
