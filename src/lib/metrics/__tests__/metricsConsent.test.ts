// G19-S3 md.4/md.5 + G26-S1 — uygulama içi rıza (iOS ATT kaldırıldı).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as consent from '../consent';
import { fbSettingsFor, metaAllowed, parseAdConsent, parseFirstParty } from '../consent';
import { scanOutcomeEvent } from '../../../modules/ai/scan/scanMetrics';
import { logSourceOf } from '../logSource';

test('G27: Meta varsayılan KAPALI — yalnız açık rıza (granted) ile (iOS + Android; ATT yok)', () => {
  assert.equal(metaAllowed({ adConsent: 'unset' }), false);
  assert.equal(metaAllowed({ adConsent: 'granted' }), true);
  assert.equal(metaAllowed({ adConsent: 'denied' }), false);
});

test('G26: iOS izleme + IDFA HER ZAMAN kapalı; Android reklam kimliği rızaya bağlı', () => {
  for (const adConsent of ['unset', 'granted', 'denied'] as const) {
    assert.deepEqual(fbSettingsFor({ platform: 'ios', adConsent }), { advertiserTracking: false, advertiserIdCollection: false }, adConsent);
  }
  assert.deepEqual(fbSettingsFor({ platform: 'android', adConsent: 'unset' }), { advertiserTracking: false, advertiserIdCollection: false });
  assert.deepEqual(fbSettingsFor({ platform: 'android', adConsent: 'granted' }), { advertiserTracking: true, advertiserIdCollection: true });
  assert.deepEqual(fbSettingsFor({ platform: 'android', adConsent: 'denied' }), { advertiserTracking: false, advertiserIdCollection: false });
});

test('G26: ATT eşlemesi kaldırıldı', () => {
  assert.equal((consent as Record<string, unknown>).toAttStatus, undefined);
});

test('kalıcı rıza değerleri: bilinmeyen → unset; birinci taraf yalnız "0" ile kapanır', () => {
  assert.equal(parseAdConsent(null), 'unset');
  assert.equal(parseAdConsent('granted'), 'granted');
  assert.equal(parseAdConsent('denied'), 'denied');
  assert.equal(parseAdConsent('evet'), 'unset');
  assert.equal(parseFirstParty(null), true);
  assert.equal(parseFirstParty('1'), true);
  assert.equal(parseFirstParty('0'), false);
});

test('Tara sonucu → olay eşlemesi (scan_success{n_items}, scan_fail{code}, scan_limit)', () => {
  const est = { isEstimate: true as const, name: 'Bowl', kcal: 512.4, protein_g: 30, carbs_g: 50, fat_g: 12, portion: 1, ingredients: [{}, {}, {}] as never[], photo_url: null };
  assert.deepEqual(scanOutcomeEvent({ status: 'ok', estimate: est, remaining: 2, reset_at: '' }, 'camera'), {
    name: 'scan_success', props: { n_items: 3, kcal: 512, via: 'camera' },
  });
  assert.deepEqual(scanOutcomeEvent({ status: 'quota_exhausted', remaining: 0, reset_at: '' }, 'gallery'), {
    name: 'scan_limit', props: { via: 'gallery' },
  });
  assert.deepEqual(
    scanOutcomeEvent({ status: 'failed', error: 'x', remaining: 1, reset_at: '', failure: { stage: 'upload', code: 'network', httpStatus: null, message: '' } }, 'queue'),
    { name: 'scan_fail', props: { code: 'network', stage: 'upload', via: 'queue' } },
  );
  assert.equal(scanOutcomeEvent({ status: 'failed', error: 'x', remaining: 1, reset_at: '' }, 'legacy').props.hasOwnProperty('code'), true);
});

test('öğün kaynağı eşlemesi', () => {
  assert.equal(logSourceOf('ai_scan'), 'scan');
  assert.equal(logSourceOf('pantry'), 'pantry');
  assert.equal(logSourceOf('order'), 'order');
  assert.equal(logSourceOf('manual'), 'manual');
  assert.equal(logSourceOf(null), 'manual');
});
