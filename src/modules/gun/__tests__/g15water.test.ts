// G15-S2 — Su takibi + bayrak + migration dosyası testleri. SAF (native yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WATER_STEP_ML, formatLiters, istanbulDay, pctLabel, waterTargetMl } from '../waterFormat';
import { FLAG_DEFAULTS } from '../../../core/flags/registry';

test('formatLiters: TR virgül, EN nokta, tam litrede ondalık yok', () => {
  assert.equal(formatLiters(1500, 'tr'), '1,5');
  assert.equal(formatLiters(1500, 'en'), '1.5');
  assert.equal(formatLiters(2000, 'tr'), '2');
  assert.equal(formatLiters(0, 'tr'), '0');
  assert.equal(formatLiters(-250, 'tr'), '0');
});

test('waterTargetMl: litre → ml; ml yazılmış eski kayıt; geçersiz → null', () => {
  assert.equal(waterTargetMl(2.5), 2500);
  assert.equal(waterTargetMl(2500), 2500);
  assert.equal(waterTargetMl(null), null);
  assert.equal(waterTargetMl(0), null);
  assert.equal(waterTargetMl(Number.NaN), null);
});

test('istanbulDay: UTC 21:30 → İstanbul ertesi gün', () => {
  assert.equal(istanbulDay(new Date('2026-11-05T21:30:00Z')), '2026-11-06');
  assert.equal(istanbulDay(new Date('2026-11-06T10:00:00Z')), '2026-11-06');
});

test('pctLabel: TR "%50", EN "50%" (FinHomeEN)', () => {
  assert.equal(pctLabel(0.5, 'tr'), '%50');
  assert.equal(pctLabel(0.5, 'en'), '50%');
  assert.equal(pctLabel(0.594, 'tr'), '%59');
});

test('su_takibi bayrağı yerelde KAPALI; adım 250 ml', () => {
  assert.equal(FLAG_DEFAULTS.su_takibi, false);
  assert.equal(WATER_STEP_ML, 250);
});

test('migration dosyası: tablo + RLS yalnız sahibi + log_water + kapalı bayrak satırı', () => {
  const sql = readFileSync(join(__dirname, '../../../../supabase/migrations/20261106000100_g15_water.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.water_daily/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /using \(user_id = auth\.uid\(\)\)/);
  assert.match(sql, /create or replace function public\.log_water\(p_ml integer\)/);
  assert.match(sql, /'su_takibi', false, 0, '1\.1\.0'/);
  assert.doesNotMatch(sql, /drop table|drop column/i);
});
