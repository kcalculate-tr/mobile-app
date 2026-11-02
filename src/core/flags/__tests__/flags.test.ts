// Bayrak altyapısı birim testleri — yalnız SAF modüller (registry/rollout/resolve).
// Provider/storage/devOverrides React Native + AsyncStorage'a bağlı; burada
// import edilmez (tsx --test Node'da koşar). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { FLAG_DEFAULTS, FLAG_KEYS, defaultFlags } from '../registry';
import { mergeFlags, flagValue } from '../resolve';
import { fnv1aBucket, rolloutBucket, inRollout } from '../rollout';

// ── 1) Varsayılanlar: HER bayrak false ──────────────────────────────────────
test('registry: her bayrağın yerel varsayılanı false', () => {
  for (const key of FLAG_KEYS) {
    assert.equal(FLAG_DEFAULTS[key], false, `${key} varsayılanı false olmalı`);
  }
  assert.ok(FLAG_KEYS.length > 0, 'en az bir bayrak tanımlı olmalı');
});

test('resolve: remote/override yokken her şey varsayılan (false)', () => {
  const flags = mergeFlags(null, null);
  for (const key of FLAG_KEYS) {
    assert.equal(flags[key], false);
  }
  // flagValue da aynı
  assert.equal(flagValue(FLAG_KEYS[0], null, null), false);
});

// ── 2) Önbellek/sunucu birleşimi ────────────────────────────────────────────
test('resolve: sunucu/önbellek değeri varsayılanın üstüne biner', () => {
  const key = FLAG_KEYS[0];
  const flags = mergeFlags({ [key]: true }, null);
  assert.equal(flags[key], true);
  // diğerleri hâlâ false
  for (const other of FLAG_KEYS.slice(1)) {
    assert.equal(flags[other], false);
  }
});

test('resolve: bilinmeyen anahtar ve boolean olmayan değer yok sayılır', () => {
  const key = FLAG_KEYS[0];
  const flags = mergeFlags(
    { [key]: 'evet' as unknown as boolean, hayali_bayrak: true } as Record<string, boolean>,
    null,
  );
  // 'evet' boolean değil → varsayılan (false) kalır
  assert.equal(flags[key], false);
  // hayali anahtar haritaya hiç girmez
  assert.equal((flags as Record<string, unknown>).hayali_bayrak, undefined);
});

// ── 3) __DEV__ override ve hata/fallback davranışı ──────────────────────────
test('resolve: override sunucu değerini ezer', () => {
  const key = FLAG_KEYS[0];
  // sunucu açık demiş ama override kapalı → kapalı kazanır
  assert.equal(mergeFlags({ [key]: true }, { [key]: false })[key], false);
  // sunucu kapalı ama override açık → açık kazanır
  assert.equal(mergeFlags({ [key]: false }, { [key]: true })[key], true);
});

test('resolve: RPC hatası (remote=null) → önbellek, o da yoksa varsayılan', () => {
  const key = FLAG_KEYS[0];
  // önbellek açık değer taşıyor, canlı RPC başarısız (null) → önbellek kullanılır
  const fromCache = mergeFlags({ [key]: true }, null);
  assert.equal(fromCache[key], true);
  // ne remote ne cache → tamamen varsayılan
  const nothing = mergeFlags(null, null);
  assert.deepEqual(nothing, defaultFlags());
});

// ── 4) Rollout hash determinizmi + sunucu paritesi ──────────────────────────
test('rollout: fnv1a deterministik ve 0..99 aralığında', () => {
  for (const s of ['a', 'discover:user-1', 'çğü:uuid', '']) {
    const a = fnv1aBucket(s);
    const b = fnv1aBucket(s);
    assert.equal(a, b, `aynı girdi aynı kova: ${s}`);
    assert.ok(a >= 0 && a < 100, `kova 0..99: ${s} → ${a}`);
  }
});

test('rollout: sunucu (_ff_fnv1a_bucket) ile BİREBİR parite — bilinen vektör', () => {
  // Postgres convert_to+FNV-1a ile canlı DB'de doğrulandı (bkz. G4-S2-LOG).
  assert.equal(
    rolloutBucket('kesfet', '3f8e1c2a-0000-4000-8000-000000000001'),
    41,
  );
});

test('rollout: 0 → kimse, 100 → herkes', () => {
  const uid = '3f8e1c2a-0000-4000-8000-000000000001';
  assert.equal(inRollout('discover', uid, 0), false);
  assert.equal(inRollout('discover', uid, 100), true);
  assert.equal(inRollout('discover', uid, -5), false);
});

test('rollout: percent eşiğiyle tutarlı (bucket < percent)', () => {
  const uid = '3f8e1c2a-0000-4000-8000-000000000001';
  const bucket = rolloutBucket('discover', uid); // sabit
  assert.equal(inRollout('discover', uid, bucket), false); // bucket < bucket = false
  assert.equal(inRollout('discover', uid, bucket + 1), true); // bucket < bucket+1 = true
});

test('rollout: dağılım kabaca dengeli (determinizm + yayılım kanıtı)', () => {
  let inWave = 0;
  const N = 2000;
  for (let i = 0; i < N; i += 1) {
    if (inRollout('discover', `user-${i}`, 50)) inWave += 1;
  }
  // %50 hedef; hash yayılımı makul ise %40–%60 arası beklenir
  const ratio = inWave / N;
  assert.ok(ratio > 0.4 && ratio < 0.6, `oran ~0.5 olmalı, ölçülen ${ratio}`);
});
