import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_ROWS_PER_RUN,
  SweepDeps,
  SweepLookup,
  VerificationRow,
  classifyCandidate,
  isReportCheckDue,
  runVerificationSweep,
} from '../../../supabase/functions/_shared/paynkolay-verification-flow';
import { MAX_REFUND_ATTEMPTS } from '../../../supabase/functions/_shared/paynkolay-verification';
import { buildReportHash, findSale, fetchReportList, lookupSales, reportWindow } from '../../../supabase/functions/_shared/paynkolay-report';

const NOW = new Date('2026-09-18T18:00:00Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString();

const row = (o: Partial<VerificationRow> & { id: string }): VerificationRow => ({
  user_id: 'u1', client_ref_code: `KCALVER${o.id}`, amount: 1, status: 'initiated', note: null, refund_attempts: 0,
  created_at: ago(20), updated_at: ago(20), paynkolay_reference_code: null, paynkolay_trx_date: null,
  charged_amount: null, last_refund_at: null, report_check_count: 0, report_checked_at: null, ...o,
});

type Sale = { kind: 'success' | 'error' | 'pending' | 'unknown'; referenceCode: string; trxDate: string; amountCents: number; rawStatus: string; rawType: string };
const sale = (kind: Sale['kind'], over: Partial<Sale> = {}): Sale => ({
  kind, referenceCode: 'REF1', trxDate: '2026.09.18', amountCents: 100, rawStatus: kind.toUpperCase(), rawType: 'SALES', ...over,
});

function setup(rows: VerificationRow[], o: {
  lock?: boolean; sales?: Record<string, Sale | null>; trusted?: boolean; refundOk?: boolean; claimRefund?: boolean; skipLookup?: string[];
} = {}) {
  const st = { rows: new Map(rows.map((r) => [r.id, { ...r }])), calls: [] as string[], refundReqs: [] as any[], failedNotes: [] as string[], checked: [] as any[], releases: 0, lookedUp: [] as string[][] };
  const byRef = (ref: string) => [...st.rows.values()].find((r) => r.client_ref_code === ref)!;
  const deps: SweepDeps<any> = {
    now: () => NOW, secretKey: 's',
    async acquireLock() { st.calls.push('lock'); return o.lock ?? true; },
    async releaseLock() { st.releases++; },
    async listCandidates() { return [...st.rows.values()].map((r) => ({ ...r })); },
    async lookupSales(rs) {
      st.lookedUp.push(rs.map((r) => r.id));
      const sales = new Map<string, Sale | null>();
      const trusted = new Set<string>();
      for (const r of rs) {
        if (o.skipLookup?.includes(r.id)) continue;
        sales.set(r.client_ref_code, o.sales?.[r.id] ?? null);
        if (o.trusted ?? true) trusted.add(r.client_ref_code);
      }
      const l: SweepLookup = { sales, trustedNotFound: trusted, batchUsed: true, fallbackCalls: 0, skippedByCap: 0, statusCounts: { 'SALES:SUCCESS': 1 } };
      return l;
    },
    async markReportChecked(items) { st.checked.push(...items); },
    async claimRefundAttempt(id) { st.calls.push('claimRefund'); return o.claimRefund ?? true; },
    async getByRef(ref) { return byRef(ref) ?? null; },
    async claimSucceeded(id, patch) {
      const r = st.rows.get(id)!;
      if (!['initiated', 'failed'].includes(r.status)) return false;
      st.rows.set(id, { ...r, ...(patch as any) }); st.calls.push('claim'); return true;
    },
    async markFailed(id, note) {
      const r = st.rows.get(id)!; if (r.status !== 'initiated') return false;
      st.rows.set(id, { ...r, status: 'failed', note }); st.failedNotes.push(note); return true;
    },
    async updateRow(id, patch) { st.rows.set(id, { ...st.rows.get(id)!, ...(patch as any) }); },
    async getCustomerKey() { return 'ck'; }, async listCards() { return null; }, async saveCard() {}, async deleteRemoteCard() { return true; },
    async refund(req) {
      st.refundReqs.push(req); st.calls.push('refund');
      const ok = o.refundOk ?? true;
      return { ok, message: ok ? '' : 'reddedildi', responseCode: ok ? '2' : '99', fellBack: false, attempts: [], raw: {} };
    },
    async audit() {},
  };
  return { deps, st };
}

// ── Aday sınıflandırma / zamanlama ────────────────────────────────────────────
test('sınıflandırma: initiated<15dk atlanır, ≥15dk rapora; failed timeout/cancelled 24 saat içinde', () => {
  assert.equal(classifyCandidate(row({ id: 'a', created_at: ago(14) }), NOW), null);
  assert.equal(classifyCandidate(row({ id: 'a', created_at: ago(15) }), NOW), 'report');
  assert.equal(classifyCandidate(row({ id: 'b', status: 'failed', note: 'timeout' }), NOW), 'report');
  assert.equal(classifyCandidate(row({ id: 'b', status: 'failed', note: 'cancelled' }), NOW), 'report'); // iptal edilenler de
  assert.equal(classifyCandidate(row({ id: 'b', status: 'failed', note: 'declined' }), NOW), null);      // kesin red: para çekilmedi
  assert.equal(classifyCandidate(row({ id: 'b', status: 'failed', note: 'timeout', created_at: ago(25 * 60) }), NOW), null);
});

test('rapor geri çekilmesi: 0,5,15,30,60,120 dk aralıkla, en fazla 6 kontrol', () => {
  assert.equal(isReportCheckDue(row({ id: 'a', report_check_count: 0 }), NOW), true);
  assert.equal(isReportCheckDue(row({ id: 'a', report_check_count: 1, report_checked_at: ago(4) }), NOW), false);
  assert.equal(isReportCheckDue(row({ id: 'a', report_check_count: 1, report_checked_at: ago(5) }), NOW), true);
  assert.equal(isReportCheckDue(row({ id: 'a', report_check_count: 3, report_checked_at: ago(29) }), NOW), false);
  assert.equal(isReportCheckDue(row({ id: 'a', report_check_count: 6, report_checked_at: ago(999) }), NOW), false);
});

test('sınıflandırma: refund_pending saatlik, takılı succeeded 5 dk (yalnız deneme=0)', () => {
  assert.equal(classifyCandidate(row({ id: 'r', status: 'refund_pending', last_refund_at: ago(59) }), NOW), null);
  assert.equal(classifyCandidate(row({ id: 'r', status: 'refund_pending', last_refund_at: ago(60) }), NOW), 'refund');
  assert.equal(classifyCandidate(row({ id: 'r', status: 'refund_pending', last_refund_at: null }), NOW), 'refund');
  assert.equal(classifyCandidate(row({ id: 's', status: 'succeeded', updated_at: ago(4) }), NOW), null);
  assert.equal(classifyCandidate(row({ id: 's', status: 'succeeded', updated_at: ago(5) }), NOW), 'refund');
  assert.equal(classifyCandidate(row({ id: 's', status: 'succeeded', updated_at: ago(30), refund_attempts: 1 }), NOW), null);
  for (const status of ['refunded', 'refund_failed'] as const) assert.equal(classifyCandidate(row({ id: 'x', status }), NOW), null);
});

// ── Kilit ─────────────────────────────────────────────────────────────────────
test('KİLİT: alınamazsa sweep HİÇBİR şey yapmaz (aynı anda ikinci çalışma)', async () => {
  const { deps, st } = setup([row({ id: 'a' })], { lock: false });
  const s = await runVerificationSweep(deps);
  assert.equal(s.skippedLocked, true);
  assert.equal(s.scanned, 0);
  assert.equal(st.lookedUp.length, 0);
  assert.equal(st.releases, 0); // almadığı kilidi bırakmaz
});

test('KİLİT: iş bitince (hata olsa da) bırakılır', async () => {
  const { deps, st } = setup([row({ id: 'a' })]);
  deps.lookupSales = async () => { throw new Error('rapor patladı'); };
  await assert.rejects(() => runVerificationSweep(deps));
  assert.equal(st.releases, 1);
});

// ── Rapor mutabakatı ──────────────────────────────────────────────────────────
for (const [name, r] of [
  ['initiated', row({ id: 'a' })],
  ['failed/timeout', row({ id: 'a', status: 'failed', note: 'timeout' })],
  ['failed/cancelled (kullanıcı iptal etti ama para çekilmişti)', row({ id: 'a', status: 'failed', note: 'cancelled' })],
] as const) {
  test(`raporda SUCCESS (${name}): claim + rapordaki referans/tarih/tutarla iade -> refunded`, async () => {
    const { deps, st } = setup([r], { sales: { a: sale('success', { referenceCode: 'IKSIRPF9', trxDate: '2026.09.18', amountCents: 100 }) } });
    const s = await runVerificationSweep(deps);
    assert.equal(s.recoveredFromReport, 1);
    assert.equal(s.refundSucceeded, 1);
    assert.deepEqual(st.refundReqs, [{ referenceCode: 'IKSIRPF9', trxDate: '2026.09.18', amount: '1.00' }]);
    const final = st.rows.get('a')!;
    assert.equal(final.status, 'refunded');
    assert.equal(final.note, 'report_recovered');
    assert.equal(final.charged_amount, 1);
  });
}

test('raporda SUCCESS ama iade başarısız -> refund_pending; 72. denemede refund_failed sayılır', async () => {
  const a = setup([row({ id: 'a' })], { sales: { a: sale('success') }, refundOk: false });
  const s1 = await runVerificationSweep(a.deps);
  assert.equal(a.st.rows.get('a')!.status, 'refund_pending');
  assert.equal(s1.refundFailed, 1);
  const b = setup([row({ id: 'b', status: 'refund_pending', refund_attempts: MAX_REFUND_ATTEMPTS - 1, last_refund_at: ago(61), paynkolay_reference_code: 'R', paynkolay_trx_date: '2026.09.18' })], { refundOk: false });
  const s2 = await runVerificationSweep(b.deps);
  assert.equal(b.st.rows.get('b')!.status, 'refund_failed');
  assert.equal(s2.refundFailedFinal, 1);
});

test('callback araya girerse (claim alınamaz) ÇİFT İADE yok', async () => {
  const { deps, st } = setup([row({ id: 'a' })], { sales: { a: sale('success') } });
  deps.claimSucceeded = async () => false;
  const s = await runVerificationSweep(deps);
  assert.equal(s.recoveredFromReport, 0);
  assert.equal(st.refundReqs.length, 0);
});

test('raporda ERROR: yalnız açık (initiated) kayıt failed/declined olur', async () => {
  const { deps, st } = setup([row({ id: 'a' }), row({ id: 'b', status: 'failed', note: 'timeout' })], { sales: { a: sale('error'), b: sale('error') } });
  const s = await runVerificationSweep(deps);
  assert.equal(s.markedFailed, 1);
  assert.deepEqual(st.failedNotes, ['declined']);
  assert.equal(st.refundReqs.length, 0);
});

test('bulunamadı (güvenilir): initiated ≥30 dk -> failed/timeout; 20 dk -> dokunulmaz', async () => {
  const old = setup([row({ id: 'a', created_at: ago(31) })], { sales: {} });
  assert.equal((await runVerificationSweep(old.deps)).markedFailed, 1);
  assert.deepEqual(old.st.failedNotes, ['timeout']);
  const young = setup([row({ id: 'a', created_at: ago(20) })], { sales: {} });
  assert.equal((await runVerificationSweep(young.deps)).markedFailed, 0);
});

test('bulunamadı ama rapor GÜVENİLMEZ (toplu boş döndü): satır ASLA failed yapılmaz', async () => {
  const { deps, st } = setup([row({ id: 'a', created_at: ago(90) })], { sales: {}, trusted: false });
  const s = await runVerificationSweep(deps);
  assert.equal(s.markedFailed, 0);
  assert.equal(st.rows.get('a')!.status, 'initiated');
});

test('sorgulanamayan satır (hız/kapak/hata): durum DEĞİŞMEZ ve rapor sayacı artmaz', async () => {
  const { deps, st } = setup([row({ id: 'a', created_at: ago(90) })], { skipLookup: ['a'] });
  const s = await runVerificationSweep(deps);
  assert.equal(s.reportChecked, 0);
  assert.equal(st.checked.length, 0);
  assert.equal(st.rows.get('a')!.status, 'initiated');
});

test('PENDING/NEW: dokunulmaz ama kontrol sayacı ilerler (geri çekilme)', async () => {
  const { deps, st } = setup([row({ id: 'a', report_check_count: 2, report_checked_at: ago(20) })], { sales: { a: sale('pending') } });
  await runVerificationSweep(deps);
  assert.equal(st.rows.get('a')!.status, 'initiated');
  assert.deepEqual(st.checked, [{ id: 'a', nextCount: 3 }]);
});

// ── İade yeniden denemeleri ───────────────────────────────────────────────────
test('refund_pending (saatlik): tutar = charged_amount; başarı -> refunded; card_saved/note EZİLMEZ', async () => {
  const { deps, st } = setup([row({ id: 'r', status: 'refund_pending', refund_attempts: 3, last_refund_at: ago(61),
    paynkolay_reference_code: 'IKS1', paynkolay_trx_date: '2026.09.18', charged_amount: 0.5, note: 'amount_mismatch', card_saved: true } as any)]);
  const s = await runVerificationSweep(deps);
  assert.deepEqual(st.refundReqs, [{ referenceCode: 'IKS1', trxDate: '2026.09.18', amount: '0.50' }]);
  const f = st.rows.get('r')! as any;
  assert.equal(f.status, 'refunded');
  assert.equal(f.refund_attempts, 4);
  assert.equal(f.note, 'amount_mismatch');
  assert.equal(f.card_saved, true);
  assert.equal(s.refundSucceeded, 1);
});

test('takılı succeeded (5 dk+, deneme 0) iade edilir', async () => {
  const { deps, st } = setup([row({ id: 's', status: 'succeeded', updated_at: ago(6), paynkolay_reference_code: 'R', paynkolay_trx_date: '2026.09.18' })]);
  await runVerificationSweep(deps);
  assert.equal(st.rows.get('s')!.status, 'refunded');
});

test('iade satırı referanssız: rapordan çözülür; çözülemezse atlanır (deneme yakılmaz)', async () => {
  const withRef = setup([row({ id: 'r', status: 'refund_pending', last_refund_at: ago(70) })], { sales: { r: sale('success', { referenceCode: 'FROMREPORT' }) } });
  await runVerificationSweep(withRef.deps);
  assert.equal(withRef.st.refundReqs[0].referenceCode, 'FROMREPORT');
  const noRef = setup([row({ id: 'r', status: 'refund_pending', last_refund_at: ago(70) })], { sales: {} });
  const s = await runVerificationSweep(noRef.deps);
  assert.equal(s.refundSkipped, 1);
  assert.equal(noRef.st.refundReqs.length, 0);
  assert.equal(noRef.st.rows.get('r')!.refund_attempts, 0);
});

test('satır düzeyi claim alınamazsa (başka worker) iade denenmez', async () => {
  const { deps, st } = setup([row({ id: 'r', status: 'refund_pending', last_refund_at: ago(70), paynkolay_reference_code: 'R', paynkolay_trx_date: '2026.09.18' })], { claimRefund: false });
  const s = await runVerificationSweep(deps);
  assert.equal(s.refundSkipped, 1);
  assert.equal(st.refundReqs.length, 0);
});

test('ÖZET: taranan/iade denenen/başarılı/başarısız sayıları + rapor bilgisi', async () => {
  const rows = [
    row({ id: 'a' }),                                                                             // rapor: SUCCESS -> iade ok
    row({ id: 'b', status: 'refund_pending', last_refund_at: ago(70), paynkolay_reference_code: 'R', paynkolay_trx_date: '2026.09.18' }), // iade ok
    row({ id: 'c', status: 'refund_pending', last_refund_at: ago(70), paynkolay_reference_code: 'R2', paynkolay_trx_date: '2026.09.18' }),
  ];
  const { deps } = setup(rows, { sales: { a: sale('success') } });
  const s = await runVerificationSweep(deps);
  assert.equal(s.scanned, 3);
  assert.equal(s.refundAttempted, 3);
  assert.equal(s.refundSucceeded, 3);
  assert.equal(s.refundFailed, 0);
  assert.equal(s.errors, 0);
  assert.deepEqual(s.report, { batchUsed: true, fallbackCalls: 0, skippedByCap: 0, statusCounts: { 'SALES:SUCCESS': 1 } });
});

test('tur başına satır üst sınırı', async () => {
  const many = Array.from({ length: MAX_ROWS_PER_RUN + 20 }, (_, i) => row({ id: `k${i}`, status: 'refund_pending', last_refund_at: ago(70), paynkolay_reference_code: 'R', paynkolay_trx_date: '2026.09.18' }));
  const { deps } = setup(many);
  assert.equal((await runVerificationSweep(deps)).scanned, MAX_ROWS_PER_RUN);
});

// ── Gruplu rapor (paynkolay-report) ───────────────────────────────────────────
const CFG = { reportSx: 'REPORT_SX', secretKey: 'SECRET', vposUrl: 'https://vpos.example/Vpos' };
type Call = { url: string; f: Record<string, string> };
function reportFetch(handler: (f: Record<string, string>) => { status?: number; body: unknown } | Error) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init: { method: string; body: any }) => {
    const f: Record<string, string> = {};
    init.body.forEach((v: string, k: string) => { f[k] = v; });
    calls.push({ url, f });
    const r = handler(f);
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status < 300, status, text: async () => JSON.stringify(r.body) };
  };
  return { fetchFn, calls };
}
const T = (ref: string, status: string, extra: Record<string, unknown> = {}) => ({ clientReferenceCode: ref, transactionType: 'SALES', status, referenceCode: `IKS-${ref}`, trxDate: '18.09.2026', amount: '1.00', ...extra });

test('rapor hash: mevcut kodla (sx|start|end|clientRef|referenceCode|secret) birebir', async () => {
  const exp = createHash('sha512').update(['REPORT_SX', '16.09.2026', '18.09.2026', '', '', 'SECRET'].join('|')).digest('base64');
  assert.equal(await buildReportHash(CFG, '16.09.2026', '18.09.2026', ''), exp);
  assert.deepEqual(reportWindow(NOW, 2), { startDate: '16.09.2026', endDate: '18.09.2026' });
});

test('GRUPLU: N kayıt için TEK rapor çağrısı; ref yerelde eşleşir; tarih yyyy.mm.dd normalize', async () => {
  const { fetchFn, calls } = reportFetch(() => ({ body: { List: [T('A', 'SUCCESS'), T('B', 'ERROR'), T('C', 'NEW'), T('OTHER', 'SUCCESS')] } }));
  const r = await lookupSales({ cfg: CFG, refs: ['A', 'B', 'C', 'D'], now: NOW, expectNonEmpty: true, fetchFn });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].f.clientReferenceCode, ''); // toplu
  assert.equal(r.batchUsed, true);
  assert.equal(r.sales.get('A')!.kind, 'success');
  assert.equal(r.sales.get('A')!.trxDate, '2026.09.18');
  assert.equal(r.sales.get('A')!.amountCents, 100);
  assert.equal(r.sales.get('B')!.kind, 'error');
  assert.equal(r.sales.get('C')!.kind, 'pending');
  assert.equal(r.sales.get('D'), null);
  assert.ok(r.trustedNotFound.has('D'));
  assert.equal(r.statusCounts['SALES:SUCCESS'], 1);
});

test('toplu boş dönerse ve bizde ödenmiş sipariş varsa GÜVENİLMEZ: sınırlı tekil sorguya düşer, aralıklı', async () => {
  const sleeps: number[] = [];
  const { fetchFn, calls } = reportFetch((f) => f.clientReferenceCode === '' ? { body: { List: [] } } : { body: { List: f.clientReferenceCode === 'A' ? [T('A', 'SUCCESS')] : [] } });
  const r = await lookupSales({ cfg: CFG, refs: ['A', 'B', 'C'], now: NOW, expectNonEmpty: true, maxFallback: 2, fetchFn, sleepFn: async (ms) => { sleeps.push(ms); } });
  assert.equal(r.batchUsed, false);
  assert.equal(calls.length, 1 + 2); // 1 toplu + en fazla 2 tekil
  assert.equal(r.fallbackCalls, 2);
  assert.equal(r.skippedByCap, 1);
  assert.equal(r.sales.get('A')!.kind, 'success');
  assert.ok(!r.sales.has('C'));                 // limit dışı: sorgulanmadı -> durum değişmeyecek
  assert.deepEqual(sleeps, [300]);              // tekil sorgular arası bekleme
});

test('toplu boş ama bizde ödenmiş sipariş YOKSA boş liste geçerli (güvenilir)', async () => {
  const { fetchFn, calls } = reportFetch(() => ({ body: { List: [] } }));
  const r = await lookupSales({ cfg: CFG, refs: ['A'], now: NOW, expectNonEmpty: false, fetchFn });
  assert.equal(calls.length, 1);
  assert.equal(r.batchUsed, true);
  assert.ok(r.trustedNotFound.has('A'));
});

test('toplu HTTP hatası: tekil yedek; tekil de hata verirse o ref atlanır', async () => {
  const { fetchFn } = reportFetch((f) => f.clientReferenceCode === '' ? { status: 500, body: {} } : { status: 500, body: {} });
  const r = await lookupSales({ cfg: CFG, refs: ['A'], now: NOW, expectNonEmpty: true, fetchFn, sleepFn: async () => {} });
  assert.equal(r.sales.size, 0);
  assert.equal(r.trustedNotFound.size, 0);
});

test('findSale: SALES satırı tercih edilir; ağ hatası ok=false', async () => {
  const list = [T('A', 'SUCCESS', { transactionType: 'CANCEL', referenceCode: 'C1' }), T('A', 'SUCCESS', { referenceCode: 'S1' })];
  assert.equal(findSale(list, 'A')!.referenceCode, 'S1');
  const { fetchFn } = reportFetch(() => new Error('down'));
  assert.equal((await fetchReportList(CFG, { startDate: 'a', endDate: 'b', clientRefCode: '' }, fetchFn)).ok, false);
});

// ── Kaynak taraması ───────────────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(__dirname, '../../../supabase', p), 'utf8');
const sweepIndex = read('functions/paynkolay-verification-sweep/index.ts');
const glue = read('functions/_shared/paynkolay-card-verification.ts');
const migration = read('migrations/20260918160000_card_verification_sweep.sql');

test('sweep function: yalnız service_role çağırabilir; kilit + özet log', () => {
  assert.match(sweepIndex, /!== 'service_role'[\s\S]*?403/);
  assert.match(glue, /acquire_sweep_lock/);
  assert.match(glue, /console\.log\('\[paynkolay-verification-sweep\] summary', summary\)/);
});

test('cron migration: 5 dk, yalnız iş varsa; sweep\'in ele aldığı kümenin üst kümesi', () => {
  assert.match(migration, /'\*\/5 \* \* \* \*'/);
  for (const cond of ["status = 'initiated'", "note IN ('timeout','cancelled')", "status = 'refund_pending'", "status = 'succeeded' AND v.refund_attempts = 0"]) {
    assert.ok(migration.includes(cond), cond);
  }
  assert.match(migration, /revoke all on function public\.acquire_sweep_lock/);
});

test('LOG güvenliği: sweep/rapor log satırlarında secret/token/kart yok', () => {
  const logs = [glue.slice(glue.indexOf('SWEEP (aşama 4)')), sweepIndex, read('functions/_shared/paynkolay-report.ts')]
    .join('\n').split('\n').filter((l) => /console\.(log|error|warn)/.test(l)).join('\n');
  assert.doesNotMatch(logs, /SECRET_KEY|secretKey|cancelSx|reportSx|card_token|maskedPan|customerKey|hashDatav2|\.token/);
});
