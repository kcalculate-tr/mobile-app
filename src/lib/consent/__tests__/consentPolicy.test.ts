// G20-S1 — rıza kapısı kararları + kayıt satırları + migration dosyası (statik).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_VERSIONS,
  PENDING_MAX,
  acceptedFromStatus,
  appendPending,
  covers,
  decideGate,
  parsePending,
  parsePolicyRecord,
  policyRows,
  toggleRow,
  versionsFrom,
  type ServerStatus,
} from '../policy';

const ROOT = join(__dirname, '..', '..', '..', '..');
const status = (terms: [number, number | null], privacy: [number, number | null], ad: boolean | null = null): ServerStatus => ({
  docs: [
    { slug: 'privacy', version: privacy[0], accepted_version: privacy[1] },
    { slug: 'terms', version: terms[0], accepted_version: terms[1] },
  ],
  ad_measurement: ad,
  first_party: null,
});
const rec = (terms: number, privacy: number) => ({ v: { terms, privacy }, at: '2026-11-09T20:00:00Z' });

test('bayrak kapalı → legacy (bugünkü davranış: ATT açılışta)', () => {
  assert.equal(decideGate({ flagsOn: false, signedIn: true, local: null, server: null }), 'legacy');
  assert.equal(decideGate({ flagsOn: false, signedIn: false, local: null, server: null }), 'legacy');
});

test('hesap yok, kayıt yok → bekle (ATT sorulmaz); kayıt varsa hazır', () => {
  assert.equal(decideGate({ flagsOn: true, signedIn: false, local: null, server: null }), 'wait');
  assert.equal(decideGate({ flagsOn: true, signedIn: false, local: rec(1, 1), server: null }), 'ready');
});

test('mevcut kullanıcı: hiç kabul yok → bir kez bilgilendirme (notice)', () => {
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: null, server: status([1, null], [1, null]) }), 'notice');
  // sunucu okunamadı (migration yok) → yalnız cihaz: kayıt yok → notice
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: null, server: null }), 'notice');
});

test('bilgilendirmeden sonra hiç (cihaz kaydı güncel) → hazır', () => {
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: rec(1, 1), server: status([1, 1], [1, 1]) }), 'ready');
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: rec(1, 1), server: null }), 'ready');
});

test('başka cihazda kabul (sunucu) → hazır, sheet yok', () => {
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: null, server: status([1, 1], [1, 1]) }), 'ready');
});

test('yeni belge sürümü → tekrar kabul (reconsent)', () => {
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: rec(1, 1), server: status([2, 1], [1, 1]) }), 'reconsent');
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: null, server: status([1, 1], [3, 2]) }), 'reconsent');
  // yeni sürüm kabul edildi → hazır
  assert.equal(decideGate({ flagsOn: true, signedIn: true, local: rec(2, 1), server: status([2, 1], [1, 1]) }), 'ready');
});

test('versionsFrom: sürüm alanı yoksa / bozuksa 1', () => {
  assert.deepEqual(versionsFrom(null), DEFAULT_VERSIONS);
  assert.deepEqual(versionsFrom([{ slug: 'terms' }, { slug: 'privacy', version: 'x' }]), { terms: 1, privacy: 1 });
  assert.deepEqual(versionsFrom([{ slug: 'terms', version: 3 }, { slug: 'kvkk', version: 9 }]), { terms: 3, privacy: 1 });
});

test('acceptedFromStatus / covers', () => {
  assert.equal(acceptedFromStatus(status([1, 1], [1, null])), null);
  assert.deepEqual(acceptedFromStatus(status([2, 2], [1, 1])), { terms: 2, privacy: 1 });
  assert.equal(covers({ terms: 2, privacy: 1 }, { terms: 2, privacy: 1 }), true);
  assert.equal(covers({ terms: 1, privacy: 1 }, { terms: 2, privacy: 1 }), false);
  assert.equal(covers(null, DEFAULT_VERSIONS), false);
});

test('parsePolicyRecord / parsePending: bozuk veri güvenli', () => {
  assert.equal(parsePolicyRecord(null), null);
  assert.equal(parsePolicyRecord('{bozuk'), null);
  assert.equal(parsePolicyRecord(JSON.stringify({ v: { terms: 0, privacy: 1 } })), null);
  assert.deepEqual(parsePolicyRecord(JSON.stringify({ v: { terms: 2, privacy: 1 }, at: 'x' })), { v: { terms: 2, privacy: 1 }, at: 'x' });
  assert.deepEqual(parsePending('nope'), []);
  assert.deepEqual(parsePending(JSON.stringify([{ kind: 'att' }, null, 3])), [{ kind: 'att' }]);
});

test('policyRows: iki zorunlu belge (sürümlü) + reklam izni, kişisel veri yok', () => {
  const rows = policyRows({ versions: { terms: 2, privacy: 1 }, adOn: true, source: 'signup_email', platform: 'ios', appVersion: '1.1.0', at: 't' });
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => [r.kind, r.doc_slug, r.doc_version, r.granted, r.source]),
    [
      ['policy', 'terms', 2, true, 'signup_email'],
      ['policy', 'privacy', 1, true, 'signup_email'],
      ['ad_measurement', null, null, true, 'signup_email'],
    ],
  );
  const keys = new Set(rows.flatMap((r) => Object.keys(r)));
  assert.deepEqual([...keys].sort(), ['app_version', 'created_at', 'doc_slug', 'doc_version', 'granted', 'kind', 'platform', 'source']);
  const off = policyRows({ versions: DEFAULT_VERSIONS, adOn: false, source: 'notice', platform: null, appVersion: null, at: 't' });
  assert.equal(off[2].granted, false);
});

test('toggleRow + appendPending sınırı', () => {
  const r = toggleRow({ kind: 'att', granted: false, source: 'att', platform: 'ios', appVersion: null, at: 't' });
  assert.equal(r.doc_slug, null);
  const many = appendPending([], Array.from({ length: PENDING_MAX + 5 }, () => r));
  assert.equal(many.length, PENDING_MAX);
});

test('migration dosyası: user_consents + RLS kendi satırı + güncelleme/silme yok + sürüm alanı + rollback', () => {
  const mig = join(ROOT, 'supabase/migrations/20261109210100_g20_s1_user_consents.sql');
  const rb = join(ROOT, 'supabase/rollbacks/20261109210100_g20_s1_user_consents_rollback.sql');
  assert.ok(existsSync(mig) && existsSync(rb));
  const sql = readFileSync(mig, 'utf8');
  assert.match(sql, /create table if not exists public\.user_consents/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for select to authenticated\s+using \(user_id = auth\.uid\(\)\)/);
  assert.match(sql, /for insert to authenticated\s+with check \(user_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(sql, /for (update|delete|all)\b/);
  assert.match(sql, /add column if not exists version integer not null default 1/);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/);
  // istemcinin yazdığı kaynak/kind değerleri CHECK listesinde
  for (const v of ['signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att']) assert.ok(sql.includes(`'${v}'`), v);
  const back = readFileSync(rb, 'utf8');
  assert.match(back, /drop table if exists public\.user_consents/);
  assert.match(back, /drop column if exists version/);
});
