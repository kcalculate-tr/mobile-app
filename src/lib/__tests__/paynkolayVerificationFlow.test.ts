import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CallbackFields,
  VerificationDeps,
  VerificationRow,
  planStart,
  processVerificationCallback,
  toPublicStatus,
  toTrxDate,
  verifyResponseHash,
} from '../../../supabase/functions/_shared/paynkolay-verification-flow';
import { MAX_REFUND_ATTEMPTS } from '../../../supabase/functions/_shared/paynkolay-verification';

const SECRET = 'SECRET_VALUE';
const NOW = new Date('2026-09-18T18:00:00Z');

type Card = { token: string; tranId: string; maskedPan: string };
const legacyHash = (f: Omit<CallbackFields, 'incomingHash'>) =>
  createHash('sha512')
    .update([f.merchantNo, f.referenceCode, f.authCode, f.responseCode, f.use3D, f.rnd, f.installment, f.authorizationAmount, f.currencyCode, SECRET].join('|'))
    .digest('base64');

function fields(over: Partial<CallbackFields> = {}): CallbackFields {
  const base = {
    merchantNo: 'M1', referenceCode: 'IKSIRPF1', authCode: '123456', responseCode: '2', use3D: 'true',
    rnd: '18.09.2026 21:00:00', installment: '1', authorizationAmount: '1.00', currencyCode: '949',
    clientRefCode: 'KCALVERabc12345', responseMessage: 'ok', txnTimestamp: '2026-09-18 21:00:01', tranId: 'tran-new',
    ...over,
  };
  const { incomingHash, ...rest } = base as CallbackFields;
  return { ...rest, incomingHash: over.incomingHash ?? legacyHash(rest as any) } as CallbackFields;
}

function setup(opts: {
  row?: Partial<VerificationRow> | null;
  cards?: Card[] | null;
  listThrows?: boolean;
  refundOk?: boolean;
  refundThrows?: boolean;
  deleteOk?: boolean;
  customerKey?: string;
  claimable?: Array<VerificationRow['status']>;
} = {}) {
  const row: VerificationRow | null = opts.row === null ? null : {
    id: 'v1', user_id: 'u1', client_ref_code: 'KCALVERabc12345', amount: 1, status: 'initiated',
    note: null, refund_attempts: 0, created_at: NOW.toISOString(), ...opts.row,
  };
  const state = { row, calls: [] as string[], refundReqs: [] as any[], saved: [] as Card[], deleted: [] as Card[], audits: [] as string[], patches: [] as Record<string, unknown>[] };
  const claimable = opts.claimable ?? ['initiated', 'failed'];
  const deps: VerificationDeps<Card> = {
    now: () => NOW,
    secretKey: SECRET,
    async getByRef() { return state.row ? { ...state.row } : null; },
    async claimSucceeded(_id, patch) {
      state.calls.push('claim');
      if (!state.row || !claimable.includes(state.row.status)) return false;
      state.row = { ...state.row, ...(patch as any) };
      return true;
    },
    async markFailed(_id, note) {
      state.calls.push('markFailed');
      if (!state.row || state.row.status !== 'initiated') return false;
      state.row = { ...state.row, status: 'failed', note };
      return true;
    },
    async updateRow(_id, patch) { state.calls.push('update'); state.patches.push(patch); if (state.row) state.row = { ...state.row, ...(patch as any) }; },
    async getCustomerKey() { return opts.customerKey ?? '85063455264'; },
    async listCards() {
      state.calls.push('list');
      if (opts.listThrows) throw new Error('list boom');
      return opts.cards === undefined ? [{ token: 'tok-new', tranId: 'tran-new', maskedPan: '515787******1234' }] : opts.cards;
    },
    async saveCard(_u, _k, e) { state.calls.push('save'); state.saved.push(e); },
    async deleteRemoteCard(_k, e) { state.calls.push('delete'); state.deleted.push(e); return opts.deleteOk ?? true; },
    async refund(req) {
      state.calls.push('refund'); state.refundReqs.push(req);
      if (opts.refundThrows) throw new Error('refund boom kart 4111111111111111');
      const ok = opts.refundOk ?? true;
      return { ok, message: ok ? '' : 'İptal edilemez', responseCode: ok ? '2' : '99', fellBack: false, attempts: [{ type: 'cancel', ok, httpStatus: 200, responseCode: ok ? '2' : '99', networkError: false }], raw: {} };
    },
    async audit(reason) { state.calls.push('audit'); state.audits.push(reason); },
  };
  return { deps, state };
}

const count = (calls: string[], name: string) => calls.filter((c) => c === name).length;

test('başarılı akış: claim -> kart kaydı -> iade -> refunded (1.00, cancel için trxDate=2026.09.18)', async () => {
  const { deps, state } = setup();
  const r = await processVerificationCallback(deps, fields());
  assert.deepEqual(r, { kind: 'succeeded', status: 'refunded', cardSaved: true, note: null });
  assert.deepEqual(state.calls.filter((c) => ['claim', 'list', 'save', 'refund', 'update'].includes(c)), ['claim', 'list', 'save', 'refund', 'update']);
  assert.deepEqual(state.refundReqs, [{ referenceCode: 'IKSIRPF1', trxDate: '2026.09.18', amount: '1.00' }]);
  assert.equal(state.row!.status, 'refunded');
  assert.equal(state.row!.refund_attempts, 1);
  assert.ok(state.patches[0].refunded_at);
});

test('ÇİFT CALLBACK: ikincisi no-op — iade ve kart işlemi TEK sefer', async () => {
  const { deps, state } = setup();
  const a = await processVerificationCallback(deps, fields());
  const b = await processVerificationCallback(deps, fields());
  assert.equal(a.kind, 'succeeded');
  assert.deepEqual(b, { kind: 'already_processed', redirectSuccess: true });
  assert.equal(count(state.calls, 'refund'), 1);
  assert.equal(count(state.calls, 'save'), 1);
  assert.equal(count(state.calls, 'list'), 1);
});

test('EŞZAMANLI çift callback (aynı anda başlayan iki işlem): claim yalnız birine verilir', async () => {
  const { deps, state } = setup();
  const [a, b] = await Promise.all([processVerificationCallback(deps, fields()), processVerificationCallback(deps, fields())]);
  assert.equal([a, b].filter((x) => x.kind === 'succeeded').length, 1);
  assert.equal(count(state.calls, 'refund'), 1);
});

test('iade başarısız -> refund_pending (deneme=1, hata kartsız), kart yine kaydedildi', async () => {
  const { deps, state } = setup({ refundOk: false });
  const r = await processVerificationCallback(deps, fields());
  assert.deepEqual(r, { kind: 'succeeded', status: 'refund_pending', cardSaved: true, note: null });
  assert.equal(state.row!.refund_attempts, 1);
  assert.equal(state.patches[0].last_refund_error, 'İptal edilemez');
  assert.equal(state.patches[0].refunded_at, null);
});

test('iade İSTİSNA fırlatırsa: refund_pending, hata metninde kart-benzeri rakam yok', async () => {
  const { deps, state } = setup({ refundThrows: true });
  const r = await processVerificationCallback(deps, fields());
  assert.equal(r.kind === 'succeeded' && r.status, 'refund_pending');
  assert.ok(!String(state.patches[0].last_refund_error).includes('4111111111111111'));
});

test('72. iade denemesi de başarısızsa refund_failed', async () => {
  const { deps } = setup({ refundOk: false, row: { refund_attempts: MAX_REFUND_ATTEMPTS - 1 } });
  const r = await processVerificationCallback(deps, fields());
  assert.equal(r.kind === 'succeeded' && r.status, 'refund_failed');
});

for (const [name, cards, listThrows] of [
  ['liste boş', [], false],
  ['liste alınamadı (null)', null, false],
  ['TranId eşleşmedi', [{ token: 't', tranId: 'baska', maskedPan: '515787******1234' }], false],
  ['liste İSTİSNA', undefined, true],
] as const) {
  test(`kart kaydedilemedi (${name}): note=card_not_listed, 1 TL YİNE iade edilir`, async () => {
    const { deps, state } = setup({ cards: cards as any, listThrows });
    const r = await processVerificationCallback(deps, fields());
    assert.deepEqual(r, { kind: 'succeeded', status: 'refunded', cardSaved: false, note: 'card_not_listed' });
    assert.equal(count(state.calls, 'refund'), 1);
    assert.equal(count(state.calls, 'save'), 0);
  });
}

test('yinelenen kart: yeni token SİLİNİR, kayıt yazılmaz, note=duplicate_card, iade YAPILIR', async () => {
  const cards: Card[] = [
    { token: 'tok-old', tranId: 'tran-old', maskedPan: '515787******1234' },
    { token: 'tok-new', tranId: 'tran-new', maskedPan: '515787******1234' },
  ];
  const { deps, state } = setup({ cards });
  const r = await processVerificationCallback(deps, fields());
  assert.deepEqual(r, { kind: 'succeeded', status: 'refunded', cardSaved: false, note: 'duplicate_card' });
  assert.deepEqual(state.deleted.map((c) => c.token), ['tok-new']); // eski kart DOKUNULMADI
  assert.equal(count(state.calls, 'save'), 0);
  assert.equal(count(state.calls, 'refund'), 1);
});

test('yinelenen kart ama silinemedi: note=duplicate_card_delete_failed (Boss görür), iade yine yapılır', async () => {
  const cards: Card[] = [
    { token: 'tok-old', tranId: 'tran-old', maskedPan: '515787******1234' },
    { token: 'tok-new', tranId: 'tran-new', maskedPan: '515787******1234' },
  ];
  const { deps } = setup({ cards, deleteOk: false });
  const r = await processVerificationCallback(deps, fields());
  assert.equal(r.kind === 'succeeded' && r.note, 'duplicate_card_delete_failed');
});

test('aynı son 4 haneli FARKLI kart yinelenen sayılmaz (meşru yeni kart kaydedilir)', async () => {
  const cards: Card[] = [
    { token: 'tok-old', tranId: 'tran-old', maskedPan: '454360******1234' },
    { token: 'tok-new', tranId: 'tran-new', maskedPan: '515787******1234' },
  ];
  const { deps, state } = setup({ cards });
  const r = await processVerificationCallback(deps, fields());
  assert.equal(r.kind === 'succeeded' && r.cardSaved, true);
  assert.equal(state.deleted.length, 0);
});

test('reddedilen ödeme (RESPONSE_CODE≠2): failed/declined, iade ve kart işlemi YOK', async () => {
  const { deps, state } = setup();
  const r = await processVerificationCallback(deps, fields({ responseCode: '1', authCode: '' }));
  assert.deepEqual(r, { kind: 'failed', note: 'declined' });
  assert.equal(state.row!.status, 'failed');
  for (const c of ['refund', 'save', 'list', 'delete', 'claim']) assert.equal(count(state.calls, c), 0, c);
});

test('AUTH_CODE 0/00/boş ise ödeme alınmamış sayılır', async () => {
  for (const authCode of ['', '0', '00']) {
    const { deps, state } = setup();
    const r = await processVerificationCallback(deps, fields({ authCode }));
    assert.equal(r.kind, 'failed');
    assert.equal(count(state.calls, 'refund'), 0);
  }
});

test('SAHTE callback (hash uyuşmaz): satıra dokunulmaz, iade/kart yok, audit', async () => {
  const { deps, state } = setup();
  const r = await processVerificationCallback(deps, fields({ incomingHash: 'sahte' }));
  assert.deepEqual(r, { kind: 'hash_invalid' });
  assert.equal(state.row!.status, 'initiated');
  assert.deepEqual(state.audits, ['hash_mismatch']);
  for (const c of ['refund', 'save', 'claim', 'markFailed']) assert.equal(count(state.calls, c), 0, c);
  assert.deepEqual(await processVerificationCallback(deps, fields({ incomingHash: '' })), { kind: 'hash_invalid' });
});

test('bilinmeyen ref kodu: not_found, hiçbir işlem yok', async () => {
  const { deps, state } = setup({ row: null });
  assert.deepEqual(await processVerificationCallback(deps, fields()), { kind: 'not_found' });
  assert.equal(state.calls.length, 0);
});

test('tutar uyuşmazlığı (0.50 çekildi): yine claim + ÇEKİLEN tutar iade edilir, note=amount_mismatch', async () => {
  const { deps, state } = setup();
  const r = await processVerificationCallback(deps, fields({ authorizationAmount: '0.50' }));
  assert.equal(r.kind === 'succeeded' && r.note, 'amount_mismatch');
  assert.equal(state.refundReqs[0].amount, '0.50');
});

test('zaman aşımına uğramış (failed) satıra GEÇ gelen "ödeme alındı" callback\'i iade edilir', async () => {
  const { deps, state } = setup({ row: { status: 'failed', note: 'timeout' } });
  const r = await processVerificationCallback(deps, fields());
  assert.equal(r.kind === 'succeeded' && r.status, 'refunded');
  assert.equal(count(state.calls, 'refund'), 1);
});

test('referenceCode yoksa iade denenmez ama refund_pending kalır (sweep çözer)', async () => {
  const { deps, state } = setup();
  const r = await processVerificationCallback(deps, fields({ referenceCode: '' }));
  assert.equal(r.kind === 'succeeded' && r.status, 'refund_pending');
  assert.equal(count(state.calls, 'refund'), 0);
  assert.equal(state.patches[0].last_refund_error, 'referenceCode yok');
});

test('hesabı silinmiş kullanıcı (user_id null): kart işlemi yok, iade yine yapılır', async () => {
  const { deps, state } = setup({ row: { user_id: null } });
  const r = await processVerificationCallback(deps, fields());
  assert.deepEqual(r, { kind: 'succeeded', status: 'refunded', cardSaved: false, note: 'card_not_listed' });
  assert.equal(count(state.calls, 'list'), 0);
});

test('hash yardımcısı completePaynkolayResult formülüyle birebir; toTrxDate', async () => {
  const f = fields();
  assert.equal(await verifyResponseHash(f, SECRET), true);
  assert.equal(await verifyResponseHash({ ...f, authorizationAmount: '9.99' }, SECRET), false);
  assert.equal(toTrxDate('2026-09-18 21:00:01', NOW), '2026.09.18');
  assert.equal(toTrxDate('garip', NOW), '2026.09.18'); // TR bugünü
});

// ── verify_start planı ────────────────────────────────────────────────────────
const ago = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString();

test('başlatma: açık kayıt yoksa ve limit dolmadıysa proceed', () => {
  assert.deepEqual(planStart([], 2, NOW), { decision: 'proceed', timeoutIds: [] });
});

test('başlatma: açık (<15 dk) kayıt varsa YENİSİ başlatılmaz (in_progress, kalan süreyle)', () => {
  const p = planStart([{ id: 'a', created_at: ago(5) }], 1, NOW);
  assert.equal(p.decision, 'in_progress');
  assert.equal(p.decision === 'in_progress' && p.activeId, 'a');
  assert.equal(p.decision === 'in_progress' && p.retryAfterSeconds, 600);
});

test('başlatma: 15 dk\'yı geçen açık kayıt zaman aşımına uğratılır ve yeni deneme açılabilir', () => {
  assert.deepEqual(planStart([{ id: 'old', created_at: ago(15) }], 1, NOW), { decision: 'proceed', timeoutIds: ['old'] });
});

test('başlatma: günlük 3 limit (başarısızlar dahil) -> limit; açık kayıt limitten önce değerlendirilir', () => {
  assert.equal(planStart([], 3, NOW).decision, 'limit');
  assert.equal(planStart([{ id: 'a', created_at: ago(1) }], 3, NOW).decision, 'in_progress');
});

test('verify_status yanıtı YALNIZ durum alanlarını içerir (token/kart/referans yok)', () => {
  const pub = toPublicStatus({ status: 'refunded', card_saved: true, note: null, ...{ tran_id: 'x', paynkolay_reference_code: 'y', user_id: 'u' } } as any);
  assert.deepEqual(pub, { status: 'refunded', card_saved: true, note: null, refunded: true });
  assert.equal(toPublicStatus({ status: 'refund_pending', card_saved: false, note: 'duplicate_card' }).refunded, false);
});

// ── Kaynak taraması: regresyon / güvenlik ─────────────────────────────────────
const read = (p: string) => readFileSync(join(__dirname, '../../../supabase/functions', p), 'utf8');
const callback = read('paynkolay-callback/index.ts');
const cards = read('paynkolay-cards/index.ts');
const flow = read('_shared/paynkolay-verification-flow.ts');
const glue = read('_shared/paynkolay-card-verification.ts');

test('CALLBACK REGRESYONU: KCALVER dalı sipariş akışından ÖNCE ve ayrı; sipariş çağrısı BİREBİR aynı', () => {
  const branch = callback.indexOf('isVerificationRefCode(');
  const orderCall = callback.indexOf('await completePaynkolayResult(');
  assert.ok(branch !== -1 && branch < orderCall);
  const branchBlock = callback.slice(branch, orderCall);
  assert.match(branchBlock, /return htmlResponse\(/); // dal kendi yanıtını döner, siparişe düşmez
  assert.doesNotMatch(branchBlock, /completePaynkolayResult/);
  // mevcut sipariş callback'inin alan eşlemesi değişmedi
  for (const line of [
    "merchantNo: pick(data, 'MERCHANT_NO', 'merchantNo'),",
    "clientRefCode: pick(data, 'clientRefCode', 'CLIENT_REFERENCE_CODE', 'clientReferenceCode'),",
    "tranId: pick(data, 'TRAN_ID', 'TranId', 'tranId', 'csTranId', 'CS_TRAN_ID'),",
    'if (!result.hashValid || !result.matched) {',
    'return htmlResponse(redirectHtml(result.isSuccess || result.alreadyPaid ? SUCCESS_REDIRECT : FAIL_REDIRECT))',
  ]) assert.ok(callback.includes(line), `sipariş callback satırı değişmiş: ${line}`);
});

test('doğrulama kodu orders/refunds tablolarına YAZMAZ', () => {
  for (const [name, src] of [['flow', flow], ['glue', glue]] as const) {
    assert.doesNotMatch(src, /from\('orders'\)/, name);
    assert.doesNotMatch(src, /from\('refunds'\)/, name);
  }
});

test('verify_start/verify_status: kapı (featureAllowed) sonrasında, kullanıcı filtreli, form/token sızmaz', () => {
  const gate = cards.indexOf('if (!featureAllowed)');
  assert.ok(gate !== -1 && gate < cards.indexOf("action === 'verify_start'") && gate < cards.indexOf("action === 'verify_status'"));
  const status = cards.slice(cards.indexOf('async function handleVerifyStatus'), cards.indexOf('async function handleSetDefault'));
  assert.match(status, /\.eq\('user_id', userId\)/);
  assert.match(status, /toPublicStatus\(row\)/);
  assert.doesNotMatch(status, /card_token|tran_id|paynkolay_reference_code/);
});

test('verify_start: 409 (açık kayıt) ve 429 (limit) dalları var', () => {
  assert.match(cards, /inProgress: true[\s\S]*?409/);
  assert.match(cards, /limitReached: true[\s\S]*?429/);
});

test('LOG güvenliği: flow/glue/verify_start log satırlarında secret/token/kart alanı yok', () => {
  const logs = [flow, glue, cards.slice(cards.indexOf('async function handleVerifyStart'), cards.indexOf('async function handleSetDefault'))]
    .join('\n').split('\n').filter((l) => /console\.(log|error|warn)/.test(l)).join('\n');
  assert.doesNotMatch(logs, /SECRET_KEY|secretKey|cancelSx|CANCEL_SX|card_token|maskedPan|\.token|customerKey|hashDatav2/);
});
