import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Karar (2026-09-18): 3D'siz işlem yetkisi talep edilmiyor — saklı kartla ödeme
// HER ZAMAN use3D=true. Kaynak taraması (edge function Deno'da, burada import edilemez).
const source = readFileSync(
  join(__dirname, '../../../supabase/functions/paynkolay-cards/index.ts'),
  'utf8',
);

test('pay: use3D her zaman true', () => {
  assert.match(source, /form\.set\('use3D', 'true'\)/);
  assert.doesNotMatch(source, /use3D\s*\?\s*'true'\s*:\s*'false'/);
});

test('pay: tutar/yeni-cihaz risk kuralı geri gelmemeli', () => {
  assert.doesNotMatch(source, /THREE_D_AMOUNT_THRESHOLD/);
  assert.doesNotMatch(source, /isNewDevice/);
  assert.doesNotMatch(source, /user_known_devices/);
});

test('pay: yanıt her zaman 3D form HTML\'i (non-3D senkron dal yok)', () => {
  assert.match(source, /requires3D: true, formHtml: raw/);
  assert.doesNotMatch(source, /completePaynkolayResult\(/);
});
