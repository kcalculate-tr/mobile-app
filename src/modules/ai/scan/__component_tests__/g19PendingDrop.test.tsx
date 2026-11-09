// G19-S1 md.4 — çevrimdışı kuyruk: tek bozuk fotoğraf (dosya silindi / çok büyük /
// tekrar tekrar model hatası) kuyruğu SONSUZA DEK kilitlemez; ağ hatası deneme sayılmaz.
import {
  clearPendingScanPhoto,
  getPendingScanQueue,
  setPendingScanPhoto,
  type PendingScanPhoto,
} from '../offlineQueue';
import { PENDING_MAX_ATTEMPTS, processPendingQueue } from '../pendingProcessor';
import type { AiScanClient, ScanEstimate } from '../types';

const est: Omit<ScanEstimate, 'isEstimate'> = {
  name: 'Pilav',
  kcal: 210,
  protein_g: 4,
  carbs_g: 45,
  fat_g: 3,
  portion: 1,
  ingredients: [{ name: 'Pilav', grams: 150, kcal: 210 }],
  photo_url: null,
};

const mk = (id: string, now: number, extra: Partial<PendingScanPhoto> = {}): PendingScanPhoto => ({
  id,
  imageUri: `file://${id}.jpg`,
  mealType: 'lunch',
  queuedAt: new Date(now).toISOString(),
  ...extra,
});

function client(upload: jest.Mock, analyze: jest.Mock): AiScanClient & { releaseScan: jest.Mock } {
  return {
    reserveScan: jest.fn().mockResolvedValue({ ok: true, remaining: 2, reset_at: 'r' }),
    releaseScan: jest.fn().mockResolvedValue(undefined),
    uploadImage: upload,
    analyzeImage: analyze,
  } as unknown as AiScanClient & { releaseScan: jest.Mock };
}

beforeEach(async () => {
  await clearPendingScanPhoto();
});

it('dosyası silinmiş girdi DÜŞER, sıradaki işlenir', async () => {
  const now = Date.now();
  await setPendingScanPhoto(mk('gone', now), now);
  await setPendingScanPhoto(mk('ok', now), now);
  const upload = jest.fn(async ({ localUri }: { localUri: string }) => {
    if (localUri.includes('gone')) throw new Error('scan_upload: file_missing');
    return 'u/scans/ok.jpg';
  });
  const save = jest.fn().mockResolvedValue(undefined);
  const res = await processPendingQueue({ client: client(upload, jest.fn().mockResolvedValue(est)), save, now });
  expect(res.dropped?.map((d) => d.id)).toEqual(['gone']);
  expect(res.processed.map((p) => p.entry.id)).toEqual(['ok']);
  expect(res.stoppedBy).toBe('empty');
  expect(await getPendingScanQueue(now)).toHaveLength(0);
});

it(`model hatası ${PENDING_MAX_ATTEMPTS}. denemede girdiyi düşürür; öncesinde kuyrukta kalır`, async () => {
  const now = Date.now();
  await setPendingScanPhoto(mk('bad', now), now);
  const analyze = jest.fn().mockRejectedValue(new Error('parse'));
  const c = client(jest.fn().mockResolvedValue('u/scans/bad.jpg'), analyze);
  for (let i = 1; i < PENDING_MAX_ATTEMPTS; i++) {
    const r = await processPendingQueue({ client: c, save: jest.fn(), now });
    expect(r.stoppedBy).toBe('failed');
    const q = await getPendingScanQueue(now);
    expect(q[0].attempts).toBe(i);
  }
  const last = await processPendingQueue({ client: c, save: jest.fn(), now });
  expect(last.dropped?.map((d) => d.id)).toEqual(['bad']);
  expect(await getPendingScanQueue(now)).toHaveLength(0);
  expect(c.releaseScan).toHaveBeenCalledTimes(PENDING_MAX_ATTEMPTS); // her başarısızlıkta hak iade
});

it('ağ hatası deneme SAYILMAZ (kuyruk korunur, attempts artmaz)', async () => {
  const now = Date.now();
  await setPendingScanPhoto(mk('a', now), now);
  const c = client(jest.fn().mockRejectedValue(new Error('Network request failed')), jest.fn());
  for (let i = 0; i < PENDING_MAX_ATTEMPTS + 1; i++) {
    const r = await processPendingQueue({ client: c, save: jest.fn(), now });
    expect(r.stoppedBy).toBe('failed');
  }
  const q = await getPendingScanQueue(now);
  expect(q).toHaveLength(1);
  expect(q[0].attempts ?? 0).toBe(0);
});

it('Tara kapalıyken (disabled) kuyruk korunur, deneme sayılmaz', async () => {
  const now = Date.now();
  await setPendingScanPhoto(mk('a', now), now);
  const c = client(jest.fn(), jest.fn());
  (c.reserveScan as jest.Mock).mockResolvedValue({ ok: false, reason: 'disabled', remaining: 2, reset_at: 'r' });
  const r = await processPendingQueue({ client: c, save: jest.fn(), now });
  expect(r.stoppedBy).toBe('unavailable');
  const q = await getPendingScanQueue(now);
  expect(q).toHaveLength(1);
  expect(q[0].attempts ?? 0).toBe(0);
});

it('girdinin dili analize gider (EN cihazda çekilen → EN adlar)', async () => {
  const now = Date.now();
  await setPendingScanPhoto(mk('en', now, { lang: 'en' }), now);
  const analyze = jest.fn().mockResolvedValue(est);
  await processPendingQueue({ client: client(jest.fn().mockResolvedValue('u/x.jpg'), analyze), save: jest.fn(), now, lang: 'tr' });
  expect(analyze.mock.calls[0][0]).toMatchObject({ lang: 'en' });
});
