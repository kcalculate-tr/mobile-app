// Çevrimdışı bekleyen fotoğraf kuyruğu — "tek kayıt" dedup kuralı.
// AsyncStorage native modülü test ortamında yok; jest.setup.js resmi mock'u
// mock'luyor (component test olarak __component_tests__ altında, tsx ile).
import { getPendingScanPhoto, setPendingScanPhoto, clearPendingScanPhoto } from '../offlineQueue';

describe('offlineQueue', () => {
  it('başlangıçta bekleyen fotoğraf yok', async () => {
    await clearPendingScanPhoto();
    expect(await getPendingScanPhoto()).toBeNull();
  });

  it('kuyruğa alınan fotoğraf okunabilir', async () => {
    await setPendingScanPhoto({ id: 'k1', imageUri: 'file://a.jpg', mealType: 'breakfast', queuedAt: '2026-11-04T00:00:00.000Z' });
    const pending = await getPendingScanPhoto();
    expect(pending).toEqual({ id: 'k1', imageUri: 'file://a.jpg', mealType: 'breakfast', queuedAt: '2026-11-04T00:00:00.000Z' });
  });

  it('elle giriş (veya bağlantı dönüşü) kuyruğu temizler — "tek kayıt" dedup', async () => {
    await setPendingScanPhoto({ id: 'k2', imageUri: 'file://b.jpg', mealType: 'lunch', queuedAt: '2026-11-04T00:00:00.000Z' });
    await clearPendingScanPhoto();
    expect(await getPendingScanPhoto()).toBeNull();
  });
});
