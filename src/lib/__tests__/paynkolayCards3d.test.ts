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

test('pay: ham gövde ASLA istemciye geçmez — ayrıştırılmış HTML döner', () => {
  assert.match(source, /parsePay3DResponse\(raw\)/);
  assert.match(source, /formHtml: parsed\.html/);
  assert.doesNotMatch(source, /formHtml:\s*raw/);
  assert.doesNotMatch(source, /completePaynkolayResult\(/);
});

test('pay: kullanılamayan yanıtta failed_payments kaydı + kullanıcı dostu hata', () => {
  assert.match(source, /reason: '3d_response_unusable'/);
  assert.match(source, /parsed\.kind === 'error'/);
});

test('pay: merchant_oid boşsa clientRefCode ile doldurulur (sweep/iade için)', () => {
  assert.match(source, /merchant_oid: clientRefCode/);
});
