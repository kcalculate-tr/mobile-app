// G19-S3 md.5 — Kuyruk: toplu yazım, çevrimdışı kalıcılık, yeniden deneme, oturum.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_SIZE,
  EventQueue,
  MAX_ATTEMPTS,
  MAX_QUEUE,
  QUEUE_KEY,
  SESSION_IDLE_MS,
  SessionClock,
  backoffMs,
  isRetryableError,
  type AnalyticsRow,
  type SendResult,
} from '../queue';

function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
  };
}

const row = (i: number, user: string | null = null): AnalyticsRow => ({
  event_name: 'app_open',
  props: { i },
  user_id: user,
  anon_id: 'anon-1',
  session_id: 's-1',
  platform: 'ios',
  app_version: '1.0.8',
  created_at: new Date(1700000000000 + i).toISOString(),
});

function harness(opts: { results?: SendResult[]; uid?: string | null; storage?: ReturnType<typeof memStorage> } = {}) {
  const storage = opts.storage ?? memStorage();
  const sent: AnalyticsRow[][] = [];
  const results = [...(opts.results ?? [])];
  let t = 0;
  const timers: { fn: () => void; ms: number }[] = [];
  const q = new EventQueue({
    storage,
    currentUserId: async () => (opts.uid === undefined ? null : opts.uid),
    send: async (rows) => {
      sent.push(rows);
      return results.length ? results.shift()! : { ok: true };
    },
    now: () => t,
    schedule: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    cancel: () => {},
  });
  return { q, storage, sent, timers, advance: (ms: number) => (t += ms) };
}

test('çevrimdışı: gönderim başarısızken olaylar kalıcı depoda durur, uygulama yeniden açılınca gönderilir', async () => {
  const offline = harness({ results: [{ ok: false, retryable: true, message: 'Network request failed' }] });
  await offline.q.enqueue(row(1));
  await offline.q.enqueue(row(2));
  await offline.q.flush();
  assert.equal(offline.q.size(), 2);
  const persisted = JSON.parse(offline.storage.m.get(QUEUE_KEY)!);
  assert.equal(persisted.length, 2);

  // "Yeniden açılış": aynı depo, yeni kuyruk.
  const reopened = harness({ storage: offline.storage });
  await reopened.q.flushNow();
  assert.equal(reopened.sent.length, 1);
  assert.equal(reopened.sent[0].length, 2);
  assert.equal(reopened.q.size(), 0);
  assert.equal(JSON.parse(reopened.storage.m.get(QUEUE_KEY)!).length, 0);
});

test('toplu yazım: tek insert en çok BATCH_SIZE satır; kalan sonraki partide', async () => {
  const h = harness();
  for (let i = 0; i < BATCH_SIZE + 7; i++) await h.q.enqueue(row(i));
  await h.q.flush();
  const sizes = h.sent.map((b) => b.length);
  assert.ok(sizes.every((s) => s <= BATCH_SIZE));
  assert.equal(sizes.reduce((a, b) => a + b, 0), BATCH_SIZE + 7);
  assert.equal(h.q.size(), 0);
});

test('küçük kuyruk hemen değil gecikmeli gönderilir (zamanlayıcı kurulur)', async () => {
  const h = harness();
  await h.q.enqueue(row(1));
  assert.equal(h.sent.length, 0);
  assert.equal(h.timers.length, 1);
  h.timers[0].fn();
  await h.q.flush();
  assert.equal(h.sent.length, 1);
});

test('yeniden denenebilir hata: üstel bekleme; süre dolmadan tekrar denemez', async () => {
  const h = harness({ results: [{ ok: false, retryable: true }, { ok: false, retryable: true }, { ok: true }] });
  await h.q.enqueue(row(1));
  await h.q.flush();
  assert.equal(h.sent.length, 1);
  await h.q.flush(); // bekleme süresi içinde
  assert.equal(h.sent.length, 1);
  h.advance(backoffMs(1));
  await h.q.flush();
  assert.equal(h.sent.length, 2);
  h.advance(backoffMs(2));
  await h.q.flush();
  assert.equal(h.sent.length, 3);
  assert.equal(h.q.size(), 0);
  assert.equal(backoffMs(1), 5000);
  assert.equal(backoffMs(2), 10000);
  assert.equal(backoffMs(30), 5 * 60 * 1000);
});

test('ağ geri gelince flushNow beklemeyi atlar', async () => {
  const h = harness({ results: [{ ok: false, retryable: true }] });
  await h.q.enqueue(row(1));
  await h.q.flush();
  await h.q.flushNow();
  assert.equal(h.sent.length, 2);
  assert.equal(h.q.size(), 0);
});

test('kalıcı ret (RLS/şema): MAX_ATTEMPTS sonra zehirli satır atılır, kuyruk kilitlenmez', async () => {
  const results: SendResult[] = Array.from({ length: MAX_ATTEMPTS }, () => ({ ok: false, retryable: false }));
  const h = harness({ results });
  await h.q.enqueue(row(1));
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await h.q.flushNow();
  }
  assert.equal(h.q.size(), 0);
  await h.q.enqueue(row(2));
  await h.q.flushNow();
  assert.equal(h.q.size(), 0);
  assert.deepEqual(h.sent.at(-1)!.map((r) => r.props.i), [2]);
});

test('anon_id → user_id: oturum değişince eski user_id NULL + _user_mismatch, anon_id korunur', async () => {
  const h = harness({ uid: 'user-B' });
  await h.q.enqueue(row(1, 'user-A'));
  await h.q.enqueue(row(2, 'user-B'));
  await h.q.enqueue(row(3, null));
  await h.q.flushNow();
  const [a, b, c] = h.sent[0];
  assert.equal(a.user_id, null);
  assert.equal(a.props._user_mismatch, true);
  assert.equal(a.anon_id, 'anon-1');
  assert.equal(b.user_id, 'user-B');
  assert.equal(b.props._user_mismatch, undefined);
  assert.equal(c.user_id, null);
  assert.equal(c.props._user_mismatch, undefined);
});

test('kuyruk sınırı: taşarsa en eski satırlar atılır', async () => {
  const h = harness({ results: Array.from({ length: 1000 }, () => ({ ok: false, retryable: true }) as SendResult) });
  for (let i = 0; i < MAX_QUEUE + 20; i++) await h.q.enqueue(row(i));
  assert.equal(h.q.size(), MAX_QUEUE);
  assert.equal(h.q.snapshot()[0].props.i, 20);
});

test('eski sürüm kuyruğu (attempts alanı yok) okunur ve gönderilir; bozuk JSON kuyruğu kilitlemez', async () => {
  const legacy = memStorage({ [QUEUE_KEY]: JSON.stringify([row(1), row(2)]) });
  const h = harness({ storage: legacy });
  await h.q.flushNow();
  assert.equal(h.sent[0].length, 2);
  assert.equal('attempts' in h.sent[0][0], false);

  const broken = harness({ storage: memStorage({ [QUEUE_KEY]: '{bozuk' }) });
  await broken.q.enqueue(row(9));
  await broken.q.flushNow();
  assert.equal(broken.sent[0].length, 1);
});

test('eşzamanlı flush tek gönderim yapar', async () => {
  const h = harness();
  await h.q.enqueue(row(1));
  await Promise.all([h.q.flush(), h.q.flush(), h.q.flush()]);
  assert.equal(h.sent.length, 1);
});

test('gönderici istisna fırlatırsa yeniden denenebilir sayılır (satır kaybolmaz)', async () => {
  const storage = memStorage();
  const q = new EventQueue({
    storage,
    currentUserId: async () => null,
    send: async () => {
      throw new Error('Network request failed');
    },
  });
  await q.enqueue(row(1));
  await q.flush();
  assert.equal(q.size(), 1);
});

test('isRetryableError: ağ/5xx/429 evet; RLS/4xx/kısıt hayır', () => {
  assert.equal(isRetryableError({ message: 'Network request failed' }), true);
  assert.equal(isRetryableError({ status: 503 }), true);
  assert.equal(isRetryableError({ status: 429 }), true);
  assert.equal(isRetryableError({ status: 401, code: '42501' }), false);
  assert.equal(isRetryableError({ code: '42501' }), false);
  assert.equal(isRetryableError({ code: '23514' }), false);
  assert.equal(isRetryableError({ code: 'PGRST204' }), false);
});

test('oturum kimliği: 30 dk sessizlikte yenilenir, arada aynı kalır', () => {
  let t = 0;
  let n = 0;
  const c = new SessionClock(() => t, () => `s${++n}`);
  const first = c.touch();
  assert.equal(first.id, 's1');
  t += SESSION_IDLE_MS - 1;
  assert.deepEqual(c.touch(), { id: 's1', isNew: false });
  t += SESSION_IDLE_MS + 1;
  assert.deepEqual(c.touch(), { id: 's2', isNew: true });
});
