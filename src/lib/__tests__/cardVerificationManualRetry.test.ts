import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ManualRetryDeps,
  VerificationRow,
  retryRefundManually,
} from '../../../supabase/functions/_shared/paynkolay-verification-flow';
import { MAX_REFUND_ATTEMPTS } from '../../../supabase/functions/_shared/paynkolay-verification';

const NOW = new Date('2026-09-19T10:00:00Z');
const row = (o: Partial<VerificationRow> = {}): VerificationRow => ({
  id: 'r1', user_id: 'u1', client_ref_code: 'KCALVERr1', amount: 1, status: 'refund_pending', note: 'duplicate_card',
  refund_attempts: 5, created_at: '2026-09-18T10:00:00Z', paynkolay_reference_code: 'IKS1', paynkolay_trx_date: '2026-09-18'.replace(/-/g, '.'),
  charged_amount: 1, last_refund_at: '2026-09-19T08:00:00Z', ...o,
});

function setup(initial: VerificationRow | null, o: { refundOk?: boolean; claim?: boolean } = {}) {
  const st = { row: initial ? { ...initial } : null as VerificationRow | null, refunds: [] as any[], audits: [] as any[], claims: [] as any[] };
  const deps = {
    now: () => NOW,
    secretKey: 's',
    async getById() { return st.row ? { ...st.row } : null; },
    async claimManualRetry(id: string, status: string, observed: string | null) { st.claims.push({ id, status, observed }); return o.claim ?? true; },
    async refund(req: any) {
      st.refunds.push(req);
      const ok = o.refundOk ?? true;
      return { ok, message: ok ? '' : 'reddedildi', responseCode: ok ? '2' : '99', fellBack: false, attempts: [], raw: {} };
    },
    async updateRow(_id: string, patch: any) { st.row = { ...st.row!, ...patch }; },
    async audit(reason: string, data: any) { st.audits.push({ reason, data }); },
  } as unknown as ManualRetryDeps<any>;
  return { deps, st };
}

test('refund_pending: başarı -> refunded; charged_amount ile iade; card_saved/note EZİLMEZ; audit yazılır', async () => {
  const { deps, st } = setup(row({ charged_amount: 0.5 }));
  const r = await retryRefundManually(deps, 'r1', 'admin-1');
  assert.deepEqual(r, { kind: 'done', status: 'refunded' });
  assert.deepEqual(st.refunds, [{ referenceCode: 'IKS1', trxDate: '2026.09.18', amount: '0.50' }]);
  assert.equal(st.row!.status, 'refunded');
  assert.equal(st.row!.refund_attempts, 6);
  assert.equal(st.row!.note, 'duplicate_card');
  assert.equal(st.audits[0].reason, 'manual_refund_retry');
  assert.deepEqual(st.audits[0].data, { verificationId: 'r1', actor: 'admin-1', previousStatus: 'refund_pending', result: 'refunded' });
});

test('refund_failed (72 deneme bitti) elle yeniden denenebilir; başarısızsa refund_failed KALIR, başarılıysa refunded', async () => {
  const failed = row({ status: 'refund_failed', refund_attempts: MAX_REFUND_ATTEMPTS });
  const ok = await retryRefundManually(setup(failed).deps, 'r1', 'a');
  assert.deepEqual(ok, { kind: 'done', status: 'refunded' });
  const bad = setup(failed, { refundOk: false });
  assert.deepEqual(await retryRefundManually(bad.deps, 'r1', 'a'), { kind: 'done', status: 'refund_failed' });
  assert.equal(bad.st.row!.refund_attempts, MAX_REFUND_ATTEMPTS + 1);
  assert.match(String((bad.st.row as unknown as Record<string, unknown>).last_refund_error), /reddedildi/);
});

test('başarısız iade refund_pending kalır (sweep saatlik devam eder)', async () => {
  const { deps, st } = setup(row(), { refundOk: false });
  assert.deepEqual(await retryRefundManually(deps, 'r1', 'a'), { kind: 'done', status: 'refund_pending' });
  assert.equal(st.row!.status, 'refund_pending');
});

test('YALNIZ refund_pending/refund_failed: refunded, failed, initiated, succeeded ASLA (çift iade koruması)', async () => {
  for (const status of ['refunded', 'failed', 'initiated', 'succeeded'] as const) {
    const { deps, st } = setup(row({ status }));
    assert.deepEqual(await retryRefundManually(deps, 'r1', 'a'), { kind: 'not_retryable', status });
    assert.equal(st.refunds.length, 0);
    assert.equal(st.claims.length, 0);
  }
});

test('bulunamadı / referans yok / meşgul: iade ÇAĞRILMAZ', async () => {
  const none = setup(null);
  assert.deepEqual(await retryRefundManually(none.deps, 'r1', 'a'), { kind: 'not_found' });
  for (const patch of [{ paynkolay_reference_code: null }, { paynkolay_reference_code: '' }, { paynkolay_trx_date: null }]) {
    const s = setup(row(patch as Partial<VerificationRow>));
    assert.deepEqual(await retryRefundManually(s.deps, 'r1', 'a'), { kind: 'no_reference' });
    assert.equal(s.st.refunds.length, 0);
  }
  const busy = setup(row(), { claim: false });
  assert.deepEqual(await retryRefundManually(busy.deps, 'r1', 'a'), { kind: 'busy' });
  assert.equal(busy.st.refunds.length, 0);
});

test('claim: gözlenen durum + last_refund_at ile (sweep/başka admin ile yarışta tek kazanan)', async () => {
  const s = setup(row({ last_refund_at: null }));
  await retryRefundManually(s.deps, 'r1', 'a');
  assert.deepEqual(s.st.claims, [{ id: 'r1', status: 'refund_pending', observed: null }]);
  const s2 = setup(row({ status: 'refund_failed', last_refund_at: '2026-09-19T08:00:00Z' }));
  await retryRefundManually(s2.deps, 'r1', 'a');
  assert.deepEqual(s2.st.claims, [{ id: 'r1', status: 'refund_failed', observed: '2026-09-19T08:00:00Z' }]);
});

// ── Kaynak taramaları ─────────────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(__dirname, '../../../supabase', p), 'utf8');
const fn = read('functions/card-verification-refund-retry/index.ts');
const glue = read('functions/_shared/paynkolay-card-verification.ts');
const cfg = read('config.toml');

test('edge function: verify_jwt + getUser + admin_allowlist, iade çağrısından ÖNCE; yalnız durum döner', () => {
  assert.match(cfg, /\[functions\.card-verification-refund-retry\][\s\S]*?verify_jwt = true/);
  const iAuth = fn.indexOf('auth.getUser()');
  const iAllow = fn.indexOf('isAllowlistedAdmin(');
  const iRun = fn.indexOf('runManualRefundRetry(');
  assert.ok(iAuth !== -1 && iAuth < iAllow && iAllow < iRun);
  assert.match(fn, /status: 403|, 403\)/);
  assert.doesNotMatch(fn, /card_token|tran_id|paynkolay_reference_code|client_ref_code/);
});

test('edge function: orders/refunds tablolarına DOKUNMAZ; loglarda secret/token yok', () => {
  assert.doesNotMatch(fn, /from\('orders'\)|from\('refunds'\)/);
  const logs = fn.split('\n').filter((l) => /console\.(log|error)/.test(l)).join('\n');
  assert.doesNotMatch(logs, /SECRET_KEY|CANCEL_SX|SX\b|token|hashDatav2/);
});

test('glue: claim koşullu UPDATE (status + last_refund_at); yalnız card_verifications', () => {
  const g = glue.slice(glue.indexOf('export async function runManualRefundRetry'));
  assert.match(g, /\.eq\('status', status\)/);
  assert.match(g, /is\('last_refund_at', null\)/);
  assert.match(g, /eq\('last_refund_at', observedLastRefundAt\)/);
  assert.doesNotMatch(g, /from\('orders'\)|from\('refunds'\)/);
});
