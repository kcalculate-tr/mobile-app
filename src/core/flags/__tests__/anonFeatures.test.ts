// G20-S3 md.3 — girişten önce bayrak: migration DOSYASI (statik) + splash bekçisi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('migration: get_anon_features anon çağrılabilir, kural get_my_features ile aynı, kilit yok, rollback var', () => {
  const mig = 'supabase/migrations/20261109220100_g20_s3_anon_features.sql';
  const rb = 'supabase/rollbacks/20261109220100_g20_s3_anon_features_rollback.sql';
  assert.ok(existsSync(join(ROOT, mig)) && existsSync(join(ROOT, rb)));
  const sql = read(mig);
  assert.match(sql, /create or replace function public\.get_anon_features\(/);
  assert.match(sql, /security definer/);
  assert.match(sql, /grant execute on function public\.get_anon_features\(text, text, text\) to anon, authenticated;/);
  assert.match(sql, /_ff_fnv1a_bucket\(ff\.key \|\| ':anon:' \|\| p_device_id\) < ff\.rollout_percent/);
  assert.match(sql, /_ff_version_gte\(p_app_version, ff\.min_app_version\)/);
  assert.match(sql, /p_device_id ~ '\^\[A-Za-z0-9_-\]\{8,64\}\$'/);
  const code = sql.replace(/--.*$/gm, ''); // yorumlar hariç
  assert.doesNotMatch(code, /user_feature_unlocks/);
  assert.doesNotMatch(code, /\binsert\b|\bupdate\b/i);
  assert.match(read(rb), /drop function if exists public\.get_anon_features\(text, text, text\)/);
});

test('AppNavigator: oturumsuz açılışta bayraklar çözülene dek splash açık (sınırlı süre)', () => {
  const nav = read('src/navigation/AppNavigator.tsx');
  assert.match(nav, /const waitFlags = !session && !!flagsCtx && !flagsCtx\.ready;/);
  assert.match(nav, /if \(authLoading \|\| waitFlags\) return null;/);
  assert.match(nav, /if \(authLoading \|\| waitFlags\) return;\s*SplashScreen\.hideAsync/);
  const prov = read('src/core/flags/FlagsProvider.tsx');
  assert.match(prov, /rpc\('get_anon_features'/);
  assert.match(prov, /ANON_TIMEOUT_MS = 2500/);
});
