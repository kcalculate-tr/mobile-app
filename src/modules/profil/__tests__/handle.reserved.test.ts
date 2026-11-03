// G11-1 — Ayrılmış kullanıcı adları istemci/sunucu PARİTESİ.
// Kural (G11-CONTRACT): ayrılmışlık iki yoldan —
//   (a) tam eşleşme: aşağıdaki RESERVED_EXACT_VECTORS listesi;
//   (b) marka öneki + harf/rakam: `kcal`/`eatkcal` ile BAŞLAYIP ardından [a-z0-9]
//       gelen adlar (ör. `kcalofficial`, `eatkcalhq`).
//   Noktalı/alt çizgili türevler (örn. `kcal.official`, `kcal_`) ayrılmış DEĞİL.
// AŞAĞIDAKİ VEKTÖRLER supabase/tests/feed_rls_test.sql T28 ile AYNIDIR (ortak set).
// Sunucu karşılığı: public.handle_is_reserved() + claim_handle/check_handle.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateHandle, isReservedHandle } from '../handle';

// (a) Tam eşleşme ile ayrılmış (23 ad).
export const RESERVED_EXACT_VECTORS = [
  'admin',
  'administrator',
  'kcal',
  'kcalai',
  'kcalculate',
  'kcalculateai',
  'eatkcal',
  'support',
  'destek',
  'yardim',
  'help',
  'root',
  'null',
  'undefined',
  'system',
  'sistem',
  'moderator',
  'mod',
  'official',
  'resmi',
  'api',
  'www',
  'app',
];

// (b) Marka öneki + harf/rakam → ayrılmış.
export const RESERVED_PREFIX_VECTORS = [
  'kcalofficial',
  'kcalstore',
  'kcal2',
  'kcalculatehq',
  'eatkcalhq',
  'eatkcal1',
];

// Ayrılmış OLMAYAN (marka öneki + ayraç, veya alakasız ad).
export const NOT_RESERVED_VECTORS = [
  'kcal.official', // nokta ayracı → impersonation değil
  'kcal_',         // alt çizgi ayracı
  'kcal.news',
  'eatkcal.me',
  'eat_kcal',      // önek `eatkcal` değil (araya alt çizgi)
  'mykcal',        // önekle BAŞLAMIYOR
  'admins',        // 'admin' değil (çoğul, listede yok, önek de değil)
  'moderatorx',    // 'moderator' tam değil; marka öneki de değil
  'kaloriuzmani',
  'ahmet.yilmaz',
];

test('G11-1: tam eşleşme ayrılmış adlar reddedilir', () => {
  for (const h of RESERVED_EXACT_VECTORS) {
    assert.equal(isReservedHandle(h), true, `"${h}" ayrılmış olmalı`);
    // validateHandle de 'reserved' döner (3 karakterden kısa olanlar hariç kontrol
    // edilmez; hepsi >= 3 uzunlukta).
    const r = validateHandle(h);
    assert.equal(r.ok, false, `"${h}" validateHandle ok=false olmalı`);
    assert.equal(r.reason, 'reserved', `"${h}" reason=reserved olmalı (alınan: ${r.reason})`);
  }
});

test('G11-1: marka öneki + harf/rakam ayrılmış', () => {
  for (const h of RESERVED_PREFIX_VECTORS) {
    assert.equal(isReservedHandle(h), true, `"${h}" ayrılmış olmalı (marka öneki)`);
    assert.equal(validateHandle(h).reason, 'reserved', `"${h}" reason=reserved olmalı`);
  }
});

test('G11-1: ayrılmış OLMAYAN adlar geçerli', () => {
  for (const h of NOT_RESERVED_VECTORS) {
    assert.equal(isReservedHandle(h), false, `"${h}" ayrılmış OLMAMALI`);
    const r = validateHandle(h);
    assert.equal(r.ok, true, `"${h}" geçerli olmalı (reason=${r.reason})`);
  }
});
