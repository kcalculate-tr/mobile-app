import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyInsertError,
  enqueue,
  flushQueue,
  isDraftComplete,
  makeQueued,
  QUEUE_MAX,
  toRow,
  type WaitlistDraft,
} from '../model/waitlist';

const add: WaitlistDraft = {
  kind: 'restaurant_add',
  country: 'TR',
  city: 'Ankara',
  restaurant_name: ' Yeşil Tabak ',
  contact_name: 'Ad Soyad',
  phone: '+90 555',
  email: 'a@b.co',
  website: '',
};

test('zorunlu alanlar Final ile aynı (ekle: 5 alan, öner: ad + il)', () => {
  assert.equal(isDraftComplete(add), true);
  assert.equal(isDraftComplete({ ...add, phone: '  ' }), false);
  assert.equal(isDraftComplete({ ...add, email: undefined }), false);
  const sug: WaitlistDraft = { kind: 'restaurant_suggest', country: 'TR', city: 'Bursa', restaurant_name: 'X' };
  assert.equal(isDraftComplete(sug), true);
  assert.equal(isDraftComplete({ ...sug, city: '' }), false);
});

test('satır: kırpılır, boş isteğe bağlı alan null, istemci referansı taşınır', () => {
  const q = makeQueued(add, new Date('2026-11-09T00:00:00Z'), () => 0.5);
  const row = toRow(q);
  assert.equal(row.restaurant_name, 'Yeşil Tabak');
  assert.equal(row.website, null);
  assert.equal(row.reason, null);
  assert.equal(row.client_ref, q.client_ref);
  assert.ok(q.client_ref.length > 3);
});

test('gönderim hatası kullanıcıya yansımaz: başarısız satır kuyrukta kalır, çift satır düşer', async () => {
  const a = makeQueued(add, new Date(1), () => 0.1);
  const b = makeQueued({ ...add, restaurant_name: 'B' }, new Date(2), () => 0.2);
  const c = makeQueued({ ...add, restaurant_name: 'C' }, new Date(3), () => 0.3);
  const left = await flushQueue([a, b, c], async (row) => {
    if (row.restaurant_name === 'B') return 'duplicate';
    if (row.restaurant_name === 'C') throw new Error('ağ');
    return 'failed'; // tablo yok (42P01 / PGRST205)
  });
  assert.deepEqual(left.map((x) => x.restaurant_name.trim()), ['Yeşil Tabak', 'C']);
  assert.equal(classifyInsertError(null), 'sent');
  assert.equal(classifyInsertError({ code: '23505' }), 'duplicate');
  assert.equal(classifyInsertError({ code: '42P01' }), 'failed');
  assert.equal(classifyInsertError({ code: 'PGRST205' }), 'failed');
});

test('kuyruk sınırı: en eskiler düşer, aynı referans tekrarlanmaz', () => {
  let q = [] as ReturnType<typeof makeQueued>[];
  for (let i = 0; i < QUEUE_MAX + 5; i++) q = enqueue(q, makeQueued(add, new Date(i), () => i / 100));
  assert.equal(q.length, QUEUE_MAX);
  const same = enqueue(q, q[q.length - 1]);
  assert.equal(same.length, QUEUE_MAX);
});
