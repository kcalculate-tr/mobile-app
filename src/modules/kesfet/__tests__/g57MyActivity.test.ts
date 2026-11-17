// G57 — Etkinliğim saf çekirdeği: RPC eşlemesi, ilk satır, ilk eylem bildirimi (bir kez), uzun metin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMyActivity, firstLine, isLongBody, takeFirstActionTip, firstTipKey, TAB_KIND, KIND_TAB } from '../myActivity';

test('fetchMyActivity: doğru RPC + medya yolu adrese çevrilir', async () => {
  let called: unknown = null;
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      called = { fn, args };
      return { data: { items: [{ id: 'p1', media_url: 'posts/u/a.jpg', body: 'x' }, { id: 'p2', media_url: null, body: 'y' }] }, error: null };
    },
  };
  const items = await fetchMyActivity(client, 'save', (p) => `https://cdn/${p}`);
  assert.deepEqual(called, { fn: 'get_my_post_activity', args: { p_kind: 'save', p_limit: 50 } });
  assert.equal(items[0].media_url, 'https://cdn/posts/u/a.jpg');
  assert.equal(items[1].media_url, null);
});

test('fetchMyActivity: hata fırlatır', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'x' } }) };
  await assert.rejects(() => fetchMyActivity(client, 'like', (p) => p));
});

test('firstLine: ilk dolu satır, uzunsa kısaltılır', () => {
  assert.equal(firstLine('\n  Menemen kaç kalori?\n\nMalzemeler'), 'Menemen kaç kalori?');
  assert.equal(firstLine('a'.repeat(100), 10).length, 10);
});

test('takeFirstActionTip: yalnız ilk seferde true', async () => {
  const m = new Map<string, string>();
  const st = { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };
  assert.equal(await takeFirstActionTip(st, 'like'), true);
  assert.equal(await takeFirstActionTip(st, 'like'), false);
  assert.equal(await takeFirstActionTip(st, 'save'), true);
  assert.equal(m.get(firstTipKey('like')), '1');
});

test('isLongBody: 280 karakter ya da 6 satırdan uzun', () => {
  assert.equal(isLongBody('kısa'), false);
  assert.equal(isLongBody('a\nb\nc\nd\ne\nf\ng'), true);
  assert.equal(isLongBody('x'.repeat(281)), true);
  assert.equal(TAB_KIND[KIND_TAB.comment], 'comment');
});
