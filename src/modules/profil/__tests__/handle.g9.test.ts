// G9-3d — Kullanıcı adı Instagram kuralı istemci/sunucu PARİTESİ.
// Kural: [a-z0-9._], 3–30, başta/sonda nokta yok, ardışık nokta yok.
// Sunucu karşılığı: profiles CHECK + claim_handle + check_handle regex
//   '^[a-z0-9_]+(\.[a-z0-9_]+)*$' + char_length 3–30.
// AŞAĞIDAKİ VEKTÖRLER supabase/tests/g9_fixes_test.sql ile AYNIDIR (ortak set).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateHandle, HANDLE_MAX } from '../handle';

export const VALID_HANDLES = [
  'abc',
  'ab_c',
  'a.b',
  'user.name',
  'a1_b2.c3',
  '___',
  'a'.repeat(30), // tam 30 — üst sınır
];

export const INVALID_HANDLES: Array<[string, string]> = [
  ['ab', 'too_short'],
  ['a'.repeat(31), 'too_long'], // 31 — üst sınırın bir üstü
  ['.abc', 'edge_dot'],
  ['abc.', 'edge_dot'],
  ['a..b', 'consecutive_dots'],
  ['ab-c', 'invalid_chars'],
  ['a b', 'invalid_chars'],
];

test('3d: istemci sınırı sunucu ile aynı (3–30)', () => {
  assert.equal(HANDLE_MAX, 30);
});

test('3d: geçerli handle vektörleri', () => {
  for (const h of VALID_HANDLES) {
    const r = validateHandle(h);
    assert.equal(r.ok, true, `"${h}" geçerli olmalı (reason=${r.reason})`);
  }
});

test('3d: geçersiz handle vektörleri + sebep', () => {
  for (const [h, reason] of INVALID_HANDLES) {
    const r = validateHandle(h);
    assert.equal(r.ok, false, `"${h}" geçersiz olmalı`);
    assert.equal(r.reason, reason, `"${h}" sebep=${reason} olmalı (geldi: ${r.reason})`);
  }
});

test('3d: nokta içeren ad artık kabul (eski sunucu reddediyordu)', () => {
  assert.equal(validateHandle('john.doe').ok, true);
  assert.equal(validateHandle('a.b.c').ok, true);
});
