// G61-S1 md.3 — migration DOSYASI denetimi (yerel Postgres yok; metin üzerinden).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALLOWED_FIELDS, isForbiddenField } from '../cardModel';

const ROOT = join(__dirname, '../../../..');
const SQL = readFileSync(join(ROOT, 'supabase/migrations/20261118100100_g61_share.sql'), 'utf8');
const RB = readFileSync(join(ROOT, 'supabase/rollbacks/20261118100100_g61_share_rollback.sql'), 'utf8');

test('işlem bloğu ve $$ dengesi', () => {
  assert.match(SQL, /^begin;/m);
  assert.match(SQL.trimEnd(), /commit;$/);
  assert.equal((SQL.match(/\$\$/g) ?? []).length % 2, 0);
  assert.equal((SQL.match(/\$q\$/g) ?? []).length % 2, 0);
  assert.match(RB, /^begin;/m);
  assert.match(RB.trimEnd(), /commit;$/);
});

test('share_snapshots şeması + RLS + yazma yalnız RPC', () => {
  assert.match(SQL, /create table if not exists public\.share_snapshots/);
  for (const col of ['id', 'kind', 'owner', 'payload', 'created_at', 'revoked_at']) {
    assert.match(SQL, new RegExp(`\\n\\s+${col}\\s+`), `${col} kolonu`);
  }
  assert.match(SQL, /kind in \('meal', 'day', 'xray'\)/);
  assert.match(SQL, /alter table public\.share_snapshots enable row level security/);
  assert.match(SQL, /revoke all on public\.share_snapshots from anon, authenticated/);
  assert.doesNotMatch(SQL, /for insert|for update|for delete/);
});

test('izinler: oluştur/iptal yalnız oturumlu, okuma anon', () => {
  assert.match(SQL, /grant execute on function public\.create_share_snapshot\(text, jsonb\) to authenticated;/);
  assert.match(SQL, /grant execute on function public\.get_share_snapshot\(text\) to anon, authenticated;/);
  assert.match(SQL, /grant execute on function public\.get_share_preview\(text, text\) to anon, authenticated;/);
  assert.match(SQL, /revoke all on function public\.create_share_snapshot\(text, jsonb\) from public, anon;/);
  assert.match(SQL, /create or replace function public\.create_share_snapshot[\s\S]*?security definer/);
});

test('sunucu beyaz listesi istemci modeliyle aynı (foto hariç), yasak alan yok', () => {
  for (const kind of ['meal', 'day', 'xray'] as const) {
    const m = new RegExp(`when '${kind}'\\s+then array\\[([^\\]]+)\\]`).exec(SQL);
    assert.ok(m, `${kind} listesi`);
    const server = m![1].split(',').map((x) => x.trim().replace(/'/g, '')).sort();
    const client = (ALLOWED_FIELDS[kind] as readonly string[]).filter((f) => f !== 'photoUri').sort();
    assert.deepEqual(server, client, `${kind} beyaz liste`);
    for (const f of server) assert.equal(isForbiddenField(f), false, `${kind}.${f}`);
  }
});

test('önizleme: gizli hesap / silinmiş / iptal → gone; sayaç yok', () => {
  const prev = SQL.slice(SQL.indexOf('function public.get_share_preview'));
  assert.match(prev, /not coalesce\(pr\.is_private, false\)/);
  assert.match(prev, /p\.status = 'published'/);
  assert.match(prev, /s\.deleted_at is null/);
  assert.match(prev, /s\.revoked_at is null/);
  assert.match(prev, /'gone', true/);
  assert.match(prev, /'expired', \(s\.expires_at <= now\(\)\)/);
  assert.doesNotMatch(prev, /post_reactions|follows|story_views|story_reactions/);
});

test('rollback her nesneyi kaldırır', () => {
  for (const o of ['get_share_preview', 'revoke_share_snapshot', 'get_share_snapshot', 'create_share_snapshot', 'share_new_id', 'share_payload_clean']) {
    assert.match(RB, new RegExp(`drop function if exists public\\.${o}\\(`));
  }
  assert.match(RB, /drop table if exists public\.share_snapshots/);
});
