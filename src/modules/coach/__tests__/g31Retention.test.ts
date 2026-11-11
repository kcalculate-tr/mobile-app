// G31-S1 md.5 — Koç 30 gün saklama: günlük silme işi (migration DOSYASI + rollback).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const MIG = 'supabase/migrations/20261112000100_g31_coach_retention_cron.sql';
const RB = 'supabase/rollbacks/20261112000100_g31_coach_retention_cron_rollback.sql';

test('migration: fonksiyon coach_retention_days ile siler, yalnız service_role çalıştırır', () => {
  const s = readFileSync(join(ROOT, MIG), 'utf8');
  assert.match(s, /create or replace function public\.fn_coach_retention_purge\(\)/);
  assert.match(s, /_coach_int_setting\('coach_retention_days', 30\)/);
  assert.match(s, /delete from public\.coach_messages/);
  assert.match(s, /revoke all on function public\.fn_coach_retention_purge\(\) from public, anon, authenticated/);
  assert.match(s, /grant execute on function public\.fn_coach_retention_purge\(\) to service_role/);
});

test('migration: pg_cron varsa idempotent günlük iş, yoksa atlanır', () => {
  const s = readFileSync(join(ROOT, MIG), 'utf8');
  assert.match(s, /to_regnamespace\('cron'\) is null/);
  assert.match(s, /cron\.unschedule\(j\.jobname\) from cron\.job j where j\.jobname = 'coach-retention-daily'/);
  assert.match(s, /cron\.schedule\('coach-retention-daily', '30 0 \* \* \*'/);
  assert.match(s, /^begin;$/m);
  assert.match(s, /^commit;$/m);
});

test('rollback: iş kaldırılır, fonksiyon silinir', () => {
  const s = readFileSync(join(ROOT, RB), 'utf8');
  assert.match(s, /cron\.unschedule/);
  assert.match(s, /drop function if exists public\.fn_coach_retention_purge\(\)/);
});
