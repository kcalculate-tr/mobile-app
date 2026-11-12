// G28-S1 md.4 — "Loglanan kayıt ekranda gösterilenle BİREBİR aynı" (TestFlight hatası:
// sonuç "Americano (büyük fincan, sütsüz) 8 kcal", günlükte "Amerikano (sade kahve), 1 büyük… 5 kcal").
// Kök neden: çevrimdışı kuyruğa alınan foto "Tekrar dene" ile AYNI anahtarla ön planda
// analiz edilirken bağlantı dönüşü kuyruk da aynı fotoyu ikinci kez analiz edip kendi
// sonucunu aynı source_ref ile yazıyordu; Logla benzersizlik çakışmasında o satırı döndürüyordu.
import {
  claimPendingKey,
  clearPendingScanPhoto,
  getPendingScanQueue,
  releasePendingKey,
  setPendingScanPhoto,
} from '../offlineQueue';
import { processPendingQueue } from '../pendingProcessor';
import type { AiScanClient, ScanEstimate } from '../types';

const queued: Omit<ScanEstimate, 'isEstimate'> = {
  name: 'Amerikano (sade kahve), 1 büyük fincan',
  kcal: 5,
  protein_g: 0,
  carbs_g: 1,
  fat_g: 0,
  portion: 1,
  ingredients: [{ name: 'Amerikano (sade kahve), 1 büyük fincan', grams: 350, kcal: 5 }],
  photo_url: null,
};

function client(analyze: jest.Mock): AiScanClient {
  return {
    reserveScan: jest.fn().mockResolvedValue({ ok: true, remaining: 2, reset_at: 'r' }),
    releaseScan: jest.fn().mockResolvedValue(undefined),
    uploadImage: jest.fn().mockResolvedValue('u/scans/k.jpg'),
    analyzeImage: analyze,
  } as unknown as AiScanClient;
}

beforeEach(async () => {
  await clearPendingScanPhoto();
});

it('ön planda analiz edilen anahtarı kuyruk ATLAR (ikinci analiz + kayıt yok), kilit kalkınca işler', async () => {
  const now = Date.now();
  await setPendingScanPhoto({ id: 'u-file://k.jpg', imageUri: 'file://k.jpg', mealType: 'lunch', queuedAt: new Date(now).toISOString() }, now);
  const analyze = jest.fn().mockResolvedValue(queued);
  const save = jest.fn().mockResolvedValue({ id: 'row' });

  claimPendingKey('u-file://k.jpg');
  const r1 = await processPendingQueue({ client: client(analyze), save, now });
  expect(analyze).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(r1.processed).toHaveLength(0);
  expect(await getPendingScanQueue(now)).toHaveLength(1); // girdi silinmez (ön plan başarısızsa kuyruk sürer)

  releasePendingKey('u-file://k.jpg');
  const r2 = await processPendingQueue({ client: client(analyze), save, now });
  expect(analyze).toHaveBeenCalledTimes(1);
  expect(r2.processed.map((p) => p.entry.id)).toEqual(['u-file://k.jpg']);
});

it('kilitli girdi atlanınca sıradaki kilitsiz girdi yine işlenir', async () => {
  const now = Date.now();
  await setPendingScanPhoto({ id: 'a', imageUri: 'file://a.jpg', mealType: 'lunch', queuedAt: new Date(now).toISOString() }, now);
  await setPendingScanPhoto({ id: 'b', imageUri: 'file://b.jpg', mealType: 'lunch', queuedAt: new Date(now).toISOString() }, now);
  claimPendingKey('a');
  try {
    const save = jest.fn().mockResolvedValue({ id: 'row' });
    const r = await processPendingQueue({ client: client(jest.fn().mockResolvedValue(queued)), save, now });
    expect(r.processed.map((p) => p.entry.id)).toEqual(['b']);
    expect((await getPendingScanQueue(now)).map((e) => e.id)).toEqual(['a']);
  } finally {
    releasePendingKey('a');
  }
});
