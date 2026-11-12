// G25-S1 md.1 (A1) — Tanıtım + TbFirst "günde N ücretsiz tarama": sayı sunucu tavanından
// (app_settings ai_daily_free), okunamazsa yedek 2. Sözlükte sabit "3" kalmadı; TR + EN.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FREE_AI_FALLBACK, freeAiCap, limitsFromSettings } from '../limits';
import { translate } from '../../../core/i18n/core';

test('freeAiCap: sunucu değeri varsa o, yoksa yedek 2', () => {
  assert.equal(FREE_AI_FALLBACK, 2);
  assert.equal(freeAiCap(null), 2);
  assert.equal(freeAiCap(limitsFromSettings([])), 2);
  assert.equal(freeAiCap(limitsFromSettings([{ key: 'ai_daily_free', value: 4 }])), 4);
  assert.equal(freeAiCap(limitsFromSettings([{ key: 'ai_daily_free', value: '1' }])), 1);
  assert.equal(freeAiCap(limitsFromSettings([{ key: 'ai_daily_free', value: 0 }])), 0);
});

test('tb.first.scan_desc + intro.tara_desc: sayı parametreden, TR/EN, tekil/çoğul', () => {
  for (const key of ['tb.first.scan_desc', 'intro.tara_desc']) {
    assert.equal(translate('tr', key, { count: 2 }), 'Fotoğrafla; günde 2 ücretsiz tarama.');
    assert.equal(translate('en', key, { count: 2 }), 'By photo; 2 free scans a day.');
    assert.equal(translate('en', key, { count: 1 }), 'By photo; 1 free scan a day.');
    assert.equal(translate('tr', key, { count: 5 }), 'Fotoğrafla; günde 5 ücretsiz tarama.');
  }
});

test('çağrı yerleri useFreeAiCap() sayısını geçiriyor (sabit 3 yok)', () => {
  const root = path.resolve(__dirname, '../../..');
  const intro = fs.readFileSync(path.join(root, 'modules/onboarding/intro/IntroOverlay.tsx'), 'utf8');
  const tb = fs.readFileSync(path.join(root, 'modules/onboarding/takibe/TakibeNavigator.tsx'), 'utf8');
  assert.match(intro, /useFreeAiCap\(\)/);
  assert.match(intro, /t\('intro\.tara_desc', \{ count: freeCap \}\)/);
  assert.match(tb, /useFreeAiCap\(\)/);
  assert.match(tb, /t\('tb\.first\.scan_desc', \{ count: freeCap \}\)/);
  const dict = fs.readFileSync(path.join(root, 'core/i18n/dictionaries.ts'), 'utf8');
  assert.doesNotMatch(dict, /günde 3 ücretsiz|3 free scans a day/);
});
