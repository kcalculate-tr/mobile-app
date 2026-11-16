// G55-S1 md.0 + md.1 — send-notification toplu gönderim: parçalı sorgular, hata loglama,
// kampanya sonucu, token diline göre metin seçimi ve geri düşme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  sendToUsers,
  campaignOutcome,
  IN_CHUNK,
  INSERT_CHUNK,
  EXPO_BATCH,
} from '../../../../supabase/functions/send-notification/batch';
import {
  normalizePushLocale,
  pickLocalized,
  templateText,
  campaignText,
} from '../../../../supabase/functions/send-notification/locale';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ── Sahte Supabase istemcisi ────────────────────────────────────────────────
type Row = Record<string, unknown>;
type Call = { table: string; op: 'select' | 'insert' | 'update'; inCol?: string; inVals?: unknown[]; rows?: Row[]; patch?: Row; cols?: string };

function uid(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
}

function fakeDb(opts: {
  prefs: Row[];
  tokens: Row[];
  /** Bu kadar değerden uzun `.in()` → 400 (PostgREST GET adres sınırı benzetimi). */
  inLimit?: number;
  failTable?: { table: string; op: Call['op'] };
  noLocaleColumn?: boolean;
}) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const c: Call = { table, op: 'select' };
      const filters: Array<(r: Row) => boolean> = [];
      const q = {
        select(cols: string) { c.op = 'select'; c.cols = cols; return q; },
        insert(rows: Row[]) { c.op = 'insert'; c.rows = rows; return q; },
        update(patch: Row) { c.op = 'update'; c.patch = patch; return q; },
        in(col: string, vals: unknown[]) {
          if (col === 'user_id' || col === 'id') { c.inCol = col; c.inVals = vals; }
          filters.push((r) => vals.includes(r[col]));
          return q;
        },
        eq(col: string, v: unknown) { filters.push((r) => r[col] === v || r[col] === undefined); return q; },
        gte() { return q; },
        then(res: (v: { data: Row[] | null; error: { message: string; code?: string } | null }) => void) {
          calls.push({ ...c });
          if (opts.inLimit && c.inVals && c.inVals.length > opts.inLimit) {
            return res({ data: null, error: { message: 'Bad Request', code: '400' } });
          }
          if (opts.failTable && opts.failTable.table === table && opts.failTable.op === c.op) {
            return res({ data: null, error: { message: 'boom', code: 'XX000' } });
          }
          if (c.op !== 'select') return res({ data: null, error: null });
          if (table === 'push_tokens' && opts.noLocaleColumn && c.cols?.includes('locale')) {
            return res({ data: null, error: { message: 'column push_tokens.locale does not exist', code: '42703' } });
          }
          const src = table === 'notification_preferences' ? opts.prefs : table === 'push_tokens' ? opts.tokens : [];
          const rows = src.filter((r) => filters.every((f) => f(r)));
          // PostgREST gibi yalnız seçilen kolonlar döner (select('*') → hepsi).
          const cols = c.cols && c.cols !== '*' ? c.cols.split(',').map((x) => x.trim()) : null;
          return res({ data: cols ? rows.map((r) => Object.fromEntries(cols.map((k) => [k, r[k]]))) : rows, error: null });
        },
      };
      return q;
    },
  };
  return { db, calls };
}

function fakeFetch() {
  const bodies: Array<Array<{ to: string; title: string; body: string }>> = [];
  const fn = (async (_url: string, init: { body: string }) => {
    const msgs = JSON.parse(init.body) as Array<{ to: string; title: string; body: string }>;
    bodies.push(msgs);
    return { ok: true, status: 200, json: async () => ({ data: msgs.map(() => ({ status: 'ok' })) }) };
  }) as unknown as typeof fetch;
  return { fn, bodies };
}

const silentLog = () => {
  const errors: string[] = [];
  return { log: { error: (m: string) => errors.push(String(m)), warn: () => {} }, errors };
};

let seq = 0;
const uuid = () => `send-${++seq}`;

const N = 829;
const USERS = Array.from({ length: N }, (_, i) => uid(i));
// 14 Kas'a benzer: herkesin tercih satırı var, pazarlama açık; 368'inin aktif token'ı var.
const PREFS = USERS.map((u) => ({ user_id: u, marketing_enabled: true, transactional_enabled: true }));
const TOKENS = USERS.slice(0, 368).map((u, i) => ({
  id: `tok-${i}`, user_id: u, expo_push_token: `ExponentPushToken[${i}]`, is_active: true,
  locale: i % 4 === 0 ? 'en' : 'tr',
}));

const CAMPAIGN = { templateKey: null, deepLink: null, category: 'marketing' as const, data: { campaign_id: 'c1' } };

// ── md.0 ────────────────────────────────────────────────────────────────────
test('829 kullanıcı: tercih/token sorguları ≤100 değerlik parçalarla çağrılır, kimse yanlışlıkla atlanmaz', async () => {
  // 100'den uzun `.in()` 400 döner → eski kod 829 kişiyi "marketing disabled" sayardı.
  const { db, calls } = fakeDb({ prefs: PREFS, tokens: TOKENS, inLimit: IN_CHUNK });
  const { fn, bodies } = fakeFetch();
  const { log, errors } = silentLog();
  const r = await sendToUsers({ db, fetchFn: fn, expoHeaders: {}, log, uuid }, USERS, {
    ...CAMPAIGN, text: { title: 'Merhaba', body: 'Yeni menü' },
  });

  const prefCalls = calls.filter((c) => c.table === 'notification_preferences');
  const tokenCalls = calls.filter((c) => c.table === 'push_tokens' && c.op === 'select');
  assert.equal(prefCalls.length, Math.ceil(N / IN_CHUNK)); // 9
  assert.equal(tokenCalls.length, Math.ceil(N / IN_CHUNK));
  for (const c of [...prefCalls, ...tokenCalls]) assert.ok(c.inVals!.length <= IN_CHUNK);
  // parçaların birleşimi = bütün hedefler (tekrarsız)
  assert.deepEqual(prefCalls.flatMap((c) => c.inVals), USERS);

  assert.equal(r.sent, 368);
  assert.equal(r.skipped, N - 368); // token yok
  assert.equal(r.failed, 0);
  assert.deepEqual(errors, []);
  for (const b of bodies) assert.ok(b.length <= EXPO_BATCH);

  // insert'ler ≤500 satır; skipped satırları "no active tokens" (pazarlama kapalı DEĞİL)
  const inserts = calls.filter((c) => c.table === 'notification_sends' && c.op === 'insert');
  for (const c of inserts) assert.ok(c.rows!.length <= INSERT_CHUNK);
  const skippedRows = inserts.flatMap((c) => c.rows!).filter((x) => x.status === 'skipped');
  assert.equal(skippedRows.length, N - 368);
  assert.ok(skippedRows.every((x) => x.error_message === 'no active tokens'));
  assert.equal(inserts.flatMap((c) => c.rows!).filter((x) => x.status === 'queued').length, 368);
  // durum güncellemeleri de ≤100 id'lik parçalarla (PATCH adresi de sınırlı)
  for (const c of calls.filter((x) => x.op === 'update')) assert.ok(c.inVals!.length <= IN_CHUNK);
});

test('tercih sorgusu hata verirse sessiz yutma yok: loglanır ve gönderim durur (throw)', async () => {
  const { db } = fakeDb({ prefs: PREFS, tokens: TOKENS, failTable: { table: 'notification_preferences', op: 'select' } });
  const { fn, bodies } = fakeFetch();
  const { log, errors } = silentLog();
  await assert.rejects(
    sendToUsers({ db, fetchFn: fn, expoHeaders: {}, log, uuid }, USERS, { ...CAMPAIGN, text: { title: 'a', body: 'b' } }),
    /tercih sorgusu başarısız \(parça 1\/9\)/,
  );
  assert.equal(errors.length, 1);
  assert.equal(bodies.length, 0, 'hiç push gitmez — yanlış "kapalı" atlaması da yazılmaz');
});

test('notification_sends insert hatası loglanır ve sonuçta görünür (gönderim sürer)', async () => {
  const { db } = fakeDb({ prefs: PREFS, tokens: TOKENS, failTable: { table: 'notification_sends', op: 'insert' } });
  const { fn } = fakeFetch();
  const { log, errors } = silentLog();
  const r = await sendToUsers({ db, fetchFn: fn, expoHeaders: {}, log, uuid }, USERS, { ...CAMPAIGN, text: { title: 'a', body: 'b' } });
  assert.equal(r.sent, 368);
  assert.ok(r.errors.length >= 2); // skipped (1 parça: 461 satır) + queued (1 parça)
  assert.ok(errors.every((m) => /insert başarısız/.test(m)));
});

test('kampanya sonucu: hedef > 0 ve 0 gönderim → failed + hata; aksi hâlde sent', () => {
  assert.deepEqual(campaignOutcome(829, { sent: 0, skipped: 829, failed: 0, errors: [] }), {
    status: 'failed', error_message: '0/829 gönderildi — 829 hedefin tamamı atlandı',
  });
  assert.equal(campaignOutcome(829, { sent: 0, skipped: 0, failed: 5, errors: [] }).status, 'failed');
  assert.deepEqual(campaignOutcome(829, { sent: 368, skipped: 461, failed: 0, errors: [] }), { status: 'sent', error_message: null });
  assert.deepEqual(campaignOutcome(0, { sent: 0, skipped: 0, failed: 0, errors: [] }), { status: 'sent', error_message: null });
});

test('index.ts: by_campaign skipped_count + error_message yazar; okuma hatası failed olur', () => {
  const idx = read('supabase/functions/send-notification/index.ts');
  assert.match(idx, /skipped_count: results\.skipped,/);
  assert.match(idx, /const sonuc = campaignOutcome\(userIds\.length, results\)/);
  assert.match(idx, /status: 'failed', error_message: msg\.slice\(0, 500\)/);
  // eski tek parça `.in('user_id', hedefKullanicilar)` kalmadı
  assert.doesNotMatch(idx + read('supabase/functions/send-notification/batch.ts'), /\.in\('user_id', hedefKullanicilar\)/);
});

// ── md.1 ────────────────────────────────────────────────────────────────────
test('dil: normalize — en/en-US → en, diğer her şey (null, eski sürüm, de) → tr', () => {
  assert.equal(normalizePushLocale('en'), 'en');
  assert.equal(normalizePushLocale('en-US'), 'en');
  assert.equal(normalizePushLocale('tr'), 'tr');
  assert.equal(normalizePushLocale(null), 'tr');
  assert.equal(normalizePushLocale(undefined), 'tr');
  assert.equal(normalizePushLocale('de'), 'tr');
});

test('dil: seçim + alan bazında geri düşme', () => {
  const t = { title: 'Merhaba', body: 'Gövde', en: { title: 'Hello', body: 'Body' } };
  assert.deepEqual(pickLocalized(t, 'tr'), { title: 'Merhaba', body: 'Gövde' });
  assert.deepEqual(pickLocalized(t, 'en'), { title: 'Hello', body: 'Body' });
  assert.deepEqual(pickLocalized({ title: 'Merhaba', body: 'Gövde' }, 'en'), { title: 'Merhaba', body: 'Gövde' });
  assert.deepEqual(pickLocalized({ title: 'Merhaba', body: 'Gövde', en: { title: 'Hello', body: '  ' } }, 'en'), { title: 'Hello', body: 'Gövde' });
  assert.deepEqual(pickLocalized({ title: 'Merhaba', body: 'Gövde', en: { title: null, body: 'Body' } }, 'en'), { title: 'Merhaba', body: 'Body' });
});

test('dil: şablon değişkenleri iki dilde aynı doldurulur', () => {
  const tx = templateText(
    { title_template: 'Serin {{n}}. günde 🔥', body_template: 'Bugün bir öğün logla.', title_template_en: 'Day {{n}} of your streak 🔥', body_template_en: null },
    { n: '7' },
  );
  assert.deepEqual(pickLocalized(tx, 'tr'), { title: 'Serin 7. günde 🔥', body: 'Bugün bir öğün logla.' });
  assert.deepEqual(pickLocalized(tx, 'en'), { title: 'Day 7 of your streak 🔥', body: 'Bugün bir öğün logla.' });
  const c = campaignText({ title: 'Yeni', body: 'Menü', title_en: 'New', body_en: '' });
  assert.deepEqual(pickLocalized(c, 'en'), { title: 'New', body: 'Menü' });
});

test('dil: toplu gönderim token diline göre iki gruba ayrılır; satırlar kendi dilinde yazılır', async () => {
  const { db, calls } = fakeDb({ prefs: PREFS, tokens: TOKENS });
  const { fn, bodies } = fakeFetch();
  const { log } = silentLog();
  const r = await sendToUsers({ db, fetchFn: fn, expoHeaders: {}, log, uuid }, USERS, {
    ...CAMPAIGN, text: { title: 'Merhaba', body: 'Yeni menü', en: { title: 'Hello', body: 'New menu' } },
  });
  const enCount = TOKENS.filter((t) => t.locale === 'en').length; // 92
  assert.deepEqual(r.by_locale, { tr: 368 - enCount, en: enCount });
  // her parti tek dilli
  for (const b of bodies) assert.equal(new Set(b.map((m) => m.title)).size, 1);
  const all = bodies.flat();
  assert.equal(all.filter((m) => m.title === 'Hello' && m.body === 'New menu').length, enCount);
  assert.equal(all.filter((m) => m.title === 'Merhaba').length, 368 - enCount);
  const queued = calls.filter((c) => c.op === 'insert').flatMap((c) => c.rows!).filter((x) => x.status === 'queued');
  assert.equal(queued.filter((x) => x.title === 'Hello').length, enCount);
});

test('dil: push_tokens.locale kolonu yoksa (migration öncesi deploy) herkes TR alır, gönderim sürer', async () => {
  const { db } = fakeDb({ prefs: PREFS, tokens: TOKENS, noLocaleColumn: true });
  const { fn, bodies } = fakeFetch();
  const { log } = silentLog();
  const r = await sendToUsers({ db, fetchFn: fn, expoHeaders: {}, log, uuid }, USERS, {
    ...CAMPAIGN, text: { title: 'Merhaba', body: 'x', en: { title: 'Hello', body: 'y' } },
  });
  assert.equal(r.sent, 368);
  assert.ok(bodies.flat().every((m) => m.title === 'Merhaba'));
});

// ── migration ───────────────────────────────────────────────────────────────
test('migration + rollback: locale kolonu, _en alanları, kampanya sayaçları, 19 şablonun İngilizcesi', () => {
  const mig = 'supabase/migrations/20261116100100_g55_notification_locale.sql';
  const rb = 'supabase/rollbacks/20261116100100_g55_notification_locale_rollback.sql';
  assert.ok(existsSync(join(ROOT, mig)) && existsSync(join(ROOT, rb)));
  const sql = read(mig);
  assert.match(sql, /add column if not exists locale text not null default 'tr'/);
  assert.match(sql, /check \(locale in \('tr', 'en'\)\)/);
  for (const col of ['title_template_en', 'body_template_en']) assert.match(sql, new RegExp(`add column if not exists ${col} text`));
  for (const col of ['title_en', 'body_en', 'error_message']) assert.match(sql, new RegExp(`add column if not exists ${col} text`));
  assert.match(sql, /add column if not exists skipped_count integer not null default 0/);
  const keys = ['cart_abandoned', 'inactive_user', 'macro_reminder', 'fin_reminder_breakfast', 'fin_reminder_lunch', 'fin_reminder_dinner', 'fin_reminder_snack', 'fin_streak', 'fin_social', 'order_feedback', 'coupon_expiring', 'delivery_tomorrow', 'subscription_renewal', 'order_confirmed', 'order_preparing', 'order_shipped', 'fin_order_status', 'order_delivered', 'payment_failed'];
  for (const k of keys) assert.match(sql, new RegExp(`\\('${k}',`), k);
  // TR değişkenleri EN'de de aynı
  assert.match(sql, /'Day \{\{n\}\} of your streak 🔥'/);
  assert.match(sql, /'Order \{\{order\}\} is with the courier, about \{\{min\}\} min\.'/);
  assert.match(sql, /'Your Macro membership renews in \{\{days\}\} days\.'/);
  const r = read(rb);
  for (const col of ['locale', 'title_template_en', 'body_template_en', 'title_en', 'body_en', 'skipped_count', 'error_message']) {
    assert.match(r, new RegExp(`drop column if exists ${col}`));
  }
});
