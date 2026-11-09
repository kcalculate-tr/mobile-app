// G19-S1 (İlter 9 Kas) — galeri/kamera fotoğrafı uzun kenar ≤ 1600 (expo-image-manipulator).
// Native modül yoksa (eski derleme / jest) fotoğraf aynen kalır, çökme yok.
import { setImageManipulatorLoader, shrinkAction, shrinkForScan } from '../imageResize';

afterEach(() => setImageManipulatorLoader(null));

test('shrinkAction: yalnız uzun kenar > 1600 ise, oran korunarak; büyütme yok', () => {
  expect(shrinkAction({ width: 4032, height: 3024 })).toEqual({ resize: { width: 1600 } });
  expect(shrinkAction({ width: 3024, height: 4032 })).toEqual({ resize: { height: 1600 } });
  expect(shrinkAction({ width: 1600, height: 1200 })).toBeNull();
  expect(shrinkAction({ width: 800, height: 600 })).toBeNull();
  expect(shrinkAction(null)).toBeNull();
  expect(shrinkAction({ width: 0, height: 0 })).toBeNull();
});

test('native modül yok (eski derleme) → aynı URI, çökme yok', async () => {
  expect(await shrinkForScan('file:///big.jpg', { width: 8000, height: 6000 })).toBe('file:///big.jpg');
});

test('modül varsa küçültür (JPEG, sıkıştırma 0.7); gerek yoksa çağırmaz; hata → orijinal', async () => {
  const manipulateAsync = jest.fn(async () => ({ uri: 'file:///small.jpg', width: 1600, height: 1200 }));
  setImageManipulatorLoader(() => ({ manipulateAsync, SaveFormat: { JPEG: 'jpeg' } }) as never);
  expect(await shrinkForScan('file:///big.jpg', { width: 4032, height: 3024 })).toBe('file:///small.jpg');
  expect(manipulateAsync).toHaveBeenCalledWith('file:///big.jpg', [{ resize: { width: 1600 } }], {
    compress: 0.7,
    format: 'jpeg',
  });
  manipulateAsync.mockClear();
  expect(await shrinkForScan('file:///ok.jpg', { width: 1200, height: 1600 })).toBe('file:///ok.jpg');
  expect(manipulateAsync).not.toHaveBeenCalled();
  manipulateAsync.mockRejectedValueOnce(new Error('oom'));
  expect(await shrinkForScan('file:///big.jpg', { width: 4032, height: 3024 })).toBe('file:///big.jpg');
});
