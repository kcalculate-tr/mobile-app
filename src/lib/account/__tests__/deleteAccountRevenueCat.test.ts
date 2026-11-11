// G31-S1 md.6 — delete-account: RevenueCat müşteri kaydı silinir (best-effort).
// supabase/functions/delete-account/revenuecat.ts saf modül → sahte fetch ile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RC_API_BASE, deleteRevenueCatSubscriber } from '../../../../supabase/functions/delete-account/revenuecat';

const ROOT = join(__dirname, '..', '..', '..', '..');
const U = 'aaaaaaaa-1111-4222-8333-444455556666';

function fakeFetch(status: number) {
  const calls: { url: string; method: string; auth: string }[] = [];
  const fn = async (url: string, init: { method: string; headers: Record<string, string> }) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization });
    return { status, ok: status >= 200 && status < 300 };
  };
  return { fn, calls };
}

test('DELETE /v1/subscribers/{uid}, Bearer gizli anahtar', async () => {
  const f = fakeFetch(200);
  const r = await deleteRevenueCatSubscriber({ appUserId: U, secretKey: 'sk_test', fetchImpl: f.fn });
  assert.deepEqual(r, { ok: true, status: 200, existed: true });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `${RC_API_BASE}${U}`);
  assert.equal(f.calls[0].url, `https://api.revenuecat.com/v1/subscribers/${U}`);
  assert.equal(f.calls[0].method, 'DELETE');
  assert.equal(f.calls[0].auth, 'Bearer sk_test');
});

test('404 → kayıt yok, başarı sayılır', async () => {
  const r = await deleteRevenueCatSubscriber({ appUserId: U, secretKey: 'k', fetchImpl: fakeFetch(404).fn });
  assert.deepEqual(r, { ok: true, status: 404, existed: false });
});

test('anahtar yoksa istek atılmaz, atlanır', async () => {
  const f = fakeFetch(200);
  for (const key of [undefined, null, '', '   ']) {
    const r = await deleteRevenueCatSubscriber({ appUserId: U, secretKey: key, fetchImpl: f.fn });
    assert.deepEqual(r, { ok: false, skipped: true, reason: 'no_key' });
  }
  assert.equal(f.calls.length, 0);
});

test('HTTP hatası / ağ hatası / zaman aşımı ATMAZ, ok:false döner', async () => {
  const r500 = await deleteRevenueCatSubscriber({ appUserId: U, secretKey: 'k', fetchImpl: fakeFetch(500).fn });
  assert.deepEqual(r500, { ok: false, skipped: false, reason: 'http_500', status: 500 });
  const rNet = await deleteRevenueCatSubscriber({
    appUserId: U,
    secretKey: 'k',
    fetchImpl: async () => {
      throw new Error('boom');
    },
  });
  assert.equal(rNet.ok, false);
  assert.match((rNet as { reason: string }).reason, /^network: /);
  const rTo = await deleteRevenueCatSubscriber({
    appUserId: U,
    secretKey: 'k',
    timeoutMs: 10,
    fetchImpl: (_u, init) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
  });
  assert.deepEqual(rTo, { ok: false, skipped: false, reason: 'timeout' });
});

test('index.ts: env REVENUECAT_SECRET_API_KEY, yalnız deleteUser BAŞARILI olduktan sonra çağrılır', () => {
  const s = readFileSync(join(ROOT, 'supabase/functions/delete-account/index.ts'), 'utf8');
  assert.match(s, /Deno\.env\.get\('REVENUECAT_SECRET_API_KEY'\)/);
  const del = s.indexOf('admin.auth.admin.deleteUser(userId)');
  const rc = s.indexOf('deleteRevenueCatSubscriber({');
  assert.ok(del > 0 && rc > del, 'RevenueCat silme auth silmeden SONRA');
  // Sonuç ne olursa olsun yanıt ok:true (silmeyi bozmaz).
  assert.ok(s.indexOf('return jsonResponse({ ok: true })', rc) > rc);
});
