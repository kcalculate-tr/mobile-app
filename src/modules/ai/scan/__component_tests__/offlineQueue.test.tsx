// Çevrimdışı bekleyen fotoğraf kuyruğu — sıralı, en çok 10, 24 saat.
// AsyncStorage jest.setup.js'te mock'lu.
import {
  getPendingScanPhoto,
  getPendingScanQueue,
  setPendingScanPhoto,
  removePendingScanPhoto,
  clearPendingScanPhoto,
  PENDING_QUEUE_MAX,
} from '../offlineQueue';
import { processPendingQueue } from '../pendingProcessor';
import type { AiScanClient } from '../types';

const NOW = Date.parse('2026-11-06T12:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const H = 3600_000;
const mk = (id: string, msAgo = 0) => ({ id, imageUri: `file://${id}.jpg`, mealType: 'lunch', queuedAt: iso(msAgo) });

describe('offlineQueue', () => {
  beforeEach(async () => {
    await clearPendingScanPhoto();
  });

  it('başlangıçta bekleyen fotoğraf yok', async () => {
    expect(await getPendingScanPhoto(NOW)).toBeNull();
  });

  it('kuyruğa alınanlar sırayla okunur', async () => {
    await setPendingScanPhoto(mk('a', 2 * H), NOW);
    await setPendingScanPhoto(mk('b', H), NOW);
    expect((await getPendingScanQueue(NOW)).map((e) => e.id)).toEqual(['a', 'b']);
    expect((await getPendingScanPhoto(NOW))?.id).toBe('a');
  });

  it('en fazla 10: dolunca en eski düşer', async () => {
    for (let i = 0; i < PENDING_QUEUE_MAX + 2; i++) await setPendingScanPhoto(mk(`p${i}`, 1000), NOW);
    const q = await getPendingScanQueue(NOW);
    expect(q).toHaveLength(10);
    expect(q[0].id).toBe('p2');
    expect(q[9].id).toBe('p11');
  });

  it('24 saatten eski girdi silinir', async () => {
    await setPendingScanPhoto(mk('old', 25 * H), NOW - 25 * H + 1);
    await setPendingScanPhoto(mk('new', H), NOW);
    expect((await getPendingScanQueue(NOW)).map((e) => e.id)).toEqual(['new']);
  });

  it('elle giriş kuyruğu boşaltır — "tek kayıt" dedup', async () => {
    await setPendingScanPhoto(mk('k2'), NOW);
    await clearPendingScanPhoto();
    expect(await getPendingScanPhoto(NOW)).toBeNull();
  });
});

describe('processPendingQueue', () => {
  const est = { name: 'x', kcal: 1, protein: 0, carbs: 0, fat: 0, ingredients: [], confidence: 0.9 };
  const client = (analyze: jest.Mock, reserveOk = true): AiScanClient =>
    ({
      reserveScan: jest
        .fn()
        .mockResolvedValue(reserveOk ? { ok: true, remaining: 2, reset_at: 'r' } : { ok: false, remaining: 0, reset_at: 'r' }),
      releaseScan: jest.fn().mockResolvedValue(undefined),
      analyzeImage: analyze,
    }) as unknown as AiScanClient;
  const fresh = (id: string, now: number) => ({ ...mk(id), queuedAt: new Date(now).toISOString() });

  beforeEach(async () => {
    await clearPendingScanPhoto();
  });

  it('sırayla işler, kaydeder, kuyruğu boşaltır', async () => {
    const now = Date.now();
    await setPendingScanPhoto(fresh('a', now), now);
    await setPendingScanPhoto(fresh('b', now), now);
    const order: string[] = [];
    const res = await processPendingQueue({
      client: client(jest.fn().mockResolvedValue(est)),
      save: async (e) => void order.push(e.id),
      now,
    });
    expect(order).toEqual(['a', 'b']);
    expect(res.processed).toHaveLength(2);
    expect(res.stoppedBy).toBe('empty');
    expect(await getPendingScanQueue(now)).toHaveLength(0);
  });

  it('analiz başarısızsa hak iade edilir, girdi kuyrukta kalır, döngü durur', async () => {
    const now = Date.now();
    await setPendingScanPhoto(fresh('a', now), now);
    await setPendingScanPhoto(fresh('b', now), now);
    const c = client(jest.fn().mockRejectedValue(new Error('boom')));
    const save = jest.fn();
    const res = await processPendingQueue({ client: c, save, now });
    expect(res.stoppedBy).toBe('failed');
    expect(c.releaseScan).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(await getPendingScanQueue(now)).toHaveLength(2);
  });

  it('kota bitmişse analiz çağrılmaz, kuyruk korunur', async () => {
    const now = Date.now();
    await setPendingScanPhoto(fresh('a', now), now);
    const analyze = jest.fn();
    const res = await processPendingQueue({ client: client(analyze, false), save: jest.fn(), now });
    expect(res.stoppedBy).toBe('quota_exhausted');
    expect(analyze).not.toHaveBeenCalled();
    expect(await getPendingScanQueue(now)).toHaveLength(1);
    await removePendingScanPhoto('a');
    expect(await getPendingScanQueue(now)).toHaveLength(0);
  });
});
