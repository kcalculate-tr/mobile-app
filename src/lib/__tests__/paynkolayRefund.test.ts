import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRefundHash,
  cancelOrRefundTransaction,
  chooseRefundType,
  sanitizeErrorText,
  todayTR,
} from '../../../supabase/functions/_shared/paynkolay-refund';

const CFG = { cancelSx: 'CANCEL_SX_VALUE', secretKey: 'SECRET_VALUE', vposUrl: 'https://vpos.example/Vpos' };
const REQ = { referenceCode: 'IKSIRPF335517190', trxDate: '2026.09.18', amount: '1.00' };
// 2026-09-18 21:00 TR = 18:00Z (aynı gün)
const SAME_DAY = new Date('2026-09-18T18:00:00Z');

// Eski paynkolay-refund/index.ts formülünün BAĞIMSIZ kopyası (regresyon referansı).
const legacyHash = (type: string) =>
  createHash('sha512').update([CFG.cancelSx, REQ.referenceCode, type, REQ.amount, REQ.trxDate, CFG.secretKey].join('|')).digest('base64');

type Call = { url: string; fields: Record<string, string> };
function mockFetch(responses: Array<{ status?: number; body: unknown } | Error>) {
  const calls: Call[] = [];
  let i = 0;
  const fetchFn = async (url: string, init: { method: string; body: any }) => {
    const fields: Record<string, string> = {};
    init.body.forEach((v: string, k: string) => { fields[k] = v; });
    calls.push({ url, fields });
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)) };
  };
  return { fetchFn, calls };
}
const OK = { body: { responseCode: 2, responseData: 'Başarılı' } };
const REJECT = { body: { responseCode: 99, responseData: 'İptal edilemez' } };

test('hash: eski formülle BİREBİR (cancel ve refund)', async () => {
  assert.equal(await buildRefundHash(CFG, REQ, 'cancel'), legacyHash('cancel'));
  assert.equal(await buildRefundHash(CFG, REQ, 'refund'), legacyHash('refund'));
});

test('tip seçimi: aynı gün (TR) cancel, değilse refund; TR gece yarısı sınırı', () => {
  assert.equal(chooseRefundType('2026.09.18', SAME_DAY), 'cancel');
  assert.equal(chooseRefundType('2026.09.17', SAME_DAY), 'refund');
  assert.equal(todayTR(new Date('2026-09-18T20:59:59Z')), '2026.09.18'); // TR 23:59:59
  assert.equal(todayTR(new Date('2026-09-18T21:00:00Z')), '2026.09.19'); // TR 00:00
});

test('aynı gün başarılı cancel: tek çağrı, doğru endpoint + form alanları + hash', async () => {
  const { fetchFn, calls } = mockFetch([OK]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, true);
  assert.equal(r.type, 'cancel');
  assert.equal(r.fellBack, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://vpos.example/Vpos/v1/CancelRefundPayment');
  assert.deepEqual(calls[0].fields, {
    sx: CFG.cancelSx, referenceCode: REQ.referenceCode, type: 'cancel',
    amount: '1.00', trxDate: '2026.09.18', hashDatav2: legacyHash('cancel'),
  });
});

test('farklı gün: refund tipiyle tek çağrı', async () => {
  const { fetchFn, calls } = mockFetch([OK]);
  const r = await cancelOrRefundTransaction(CFG, { ...REQ, trxDate: '2026.09.17' }, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, true);
  assert.equal(r.type, 'refund');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fields.type, 'refund');
});

test('YEDEK: aynı gün cancel reddedilirse refund denenir ve başarılıysa ok', async () => {
  const { fetchFn, calls } = mockFetch([REJECT, OK]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, true);
  assert.equal(r.type, 'refund');
  assert.equal(r.fellBack, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].fields.type, 'cancel');
  assert.equal(calls[1].fields.type, 'refund');
  assert.equal(calls[1].fields.hashDatav2, legacyHash('refund')); // yedeğin KENDİ hash'i
  assert.deepEqual(r.attempts.map((a) => [a.type, a.ok]), [['cancel', false], ['refund', true]]);
});

test('YEDEK de reddedilirse: ok=false, iki deneme, son tip refund', async () => {
  const { fetchFn } = mockFetch([REJECT, REJECT]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, false);
  assert.equal(r.attempts.length, 2);
  assert.equal(r.type, 'refund');
  assert.equal(r.responseCode, '99');
});

test('HTTP 5xx cancel yanıtı da yedeğe düşer (PaynKolay cevap verdi, başarı değil)', async () => {
  const { fetchFn, calls } = mockFetch([{ status: 500, body: 'oops' }, OK]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
});

test('BELİRSİZ durum (ağ hatası/zaman aşımı): yedek DENENMEZ', async () => {
  const { fetchFn, calls } = mockFetch([new Error('timeout')]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 1);
  assert.equal(r.attempts[0].networkError, true);
});

test('farklı gün refund reddedilirse yedek yok (zaten refund)', async () => {
  const { fetchFn, calls } = mockFetch([REJECT]);
  const r = await cancelOrRefundTransaction(CFG, { ...REQ, trxDate: '2026.09.17' }, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 1);
});

test('allowFallback=false ise yedek yok', async () => {
  const { fetchFn, calls } = mockFetch([REJECT, OK]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn, allowFallback: false });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 1);
});

test('başarı kuralı: HTTP ok VE responseCode==="2" (kod 2 ama HTTP 500 = başarısız)', async () => {
  const { fetchFn } = mockFetch([{ status: 500, body: { responseCode: 2 } }, { status: 500, body: { responseCode: 2 } }]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, false);
});

test('JSON olmayan gövde -> {raw}, başarısız sayılır', async () => {
  const { fetchFn } = mockFetch([{ body: 'plain text' }, { body: 'plain text' }]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  assert.equal(r.ok, false);
  assert.deepEqual(r.raw, { raw: 'plain text' });
});

test('GÜVENLİK: sonuçta secret/sx/hash yok; hata metninde kart-benzeri rakam dizisi maskelenir', async () => {
  const { fetchFn } = mockFetch([{ body: { responseCode: 99, responseData: 'kart 4111111111111111 reddedildi' } }, REJECT]);
  const r = await cancelOrRefundTransaction(CFG, REQ, { now: SAME_DAY, fetchFn });
  const dump = JSON.stringify(r);
  assert.ok(!dump.includes(CFG.secretKey));
  assert.ok(!dump.includes(CFG.cancelSx));
  assert.ok(!dump.includes(legacyHash('cancel')));
  assert.equal(r.attempts[0].message.includes('4111111111111111'), false);
  assert.equal(sanitizeErrorText('x'.repeat(500)).length, 300);
});

// ── paynkolay-refund/index.ts (Boss panel akışı) korumaları — kaynak taraması ──
const src = readFileSync(join(__dirname, '../../../supabase/functions/paynkolay-refund/index.ts'), 'utf8');

test('Boss iade akışı: ortak servisi kullanır, kendi CancelRefund çağrısı/hash kopyası KALMADI', () => {
  assert.match(src, /cancelOrRefundTransaction\(/);
  assert.match(src, /chooseRefundType\(trxDate\)/);
  assert.doesNotMatch(src, /v1\/CancelRefundPayment/);
  assert.doesNotMatch(src, /crypto\.subtle/);
});

test('Boss iade akışı: tüm guard\'lar yerinde ve iade çağrısından ÖNCE', () => {
  const call = src.indexOf('cancelOrRefundTransaction(');
  for (const g of ['GUARD 1', 'GUARD 2', 'GUARD 3', 'GUARD 4', 'AUTH 3']) {
    const i = src.indexOf(g);
    assert.ok(i !== -1 && i < call, `${g} bulunamadı ya da çağrıdan sonra`);
  }
});

test('Boss iade akışı: başarısızda order\'a dokunulmaz, başarıda refunded yazılır', () => {
  const fail = src.slice(src.indexOf('if (!isSuccess)'), src.indexOf('// ── BAŞARILI'));
  assert.doesNotMatch(fail, /from\('orders'\)/);
  assert.match(src, /status: 'refunded'/);
});

test('Boss iade akışı: dry-run çağrıdan ve DB yazımından ÖNCE döner', () => {
  const dry = src.indexOf('body?.dryRun === true');
  assert.ok(dry !== -1 && dry < src.indexOf('cancelOrRefundTransaction('));
  assert.ok(dry < src.indexOf(".from('refunds').insert"));
  assert.ok(dry < src.indexOf("update({\n        status: 'refunded'"));
});

test('Boss iade akışı: loglara secret/sx yazılmaz', () => {
  const logs = src.split('\n').filter((l) => /console\.(log|error|warn)/.test(l)).join('\n');
  assert.doesNotMatch(logs, /SECRET_KEY|CANCEL_SX|hashDatav2|cancelHash/);
});
