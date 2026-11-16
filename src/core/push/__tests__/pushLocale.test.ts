// G55-S1 md.1 — uygulama: push token kaydına arayüz dili (`locale`) yazılır, dil değişince güncellenir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMissingLocaleColumn, toPushLocale } from '../pushLocale';
import { normalizePushLocale } from '../../../../supabase/functions/send-notification/locale';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('toPushLocale: en → en, tr/bilinmeyen → tr; sunucu normalizasyonu ile aynı', () => {
  for (const v of ['en', 'tr', 'EN', 'en-GB', 'de', '', null, undefined]) {
    assert.equal(toPushLocale(v as string), normalizePushLocale(v), String(v));
  }
  assert.equal(toPushLocale('en'), 'en');
  assert.equal(toPushLocale('tr'), 'tr');
});

test('isMissingLocaleColumn: PostgREST/PG kolon-yok hataları', () => {
  assert.equal(isMissingLocaleColumn({ code: 'PGRST204', message: "Could not find the 'locale' column" }), true);
  assert.equal(isMissingLocaleColumn({ code: '42703', message: 'column does not exist' }), true);
  assert.equal(isMissingLocaleColumn({ code: '23505', message: 'duplicate key' }), false);
  assert.equal(isMissingLocaleColumn(null), false);
});

test('notifications.ts: upsert locale yazar, kolon yoksa kolonsuz tekrar; dil değişince token satırı güncellenir', () => {
  const s = read('src/core/notifications.ts');
  assert.match(s, /\.upsert\(\{ \.\.\.row, locale \}, \{ onConflict: 'user_id,expo_push_token' \}\)/);
  assert.match(s, /if \(upsertError && isMissingLocaleColumn\(upsertError\)\)/);
  assert.match(s, /export async function syncPushLocale\(lang: string\)/);
  assert.match(s, /\.update\(\{ locale: next \}\)/);
});

test('App.tsx: arayüz dili (useT) hazır olunca ve her değişimde syncPushLocale çağrılır', () => {
  const s = read('App.tsx');
  assert.match(s, /const \{ lang, ready: langReady \} = useT\(\);/);
  assert.match(s, /void syncPushLocale\(lang\);\n  \}, \[lang, langReady\]\);/);
});
