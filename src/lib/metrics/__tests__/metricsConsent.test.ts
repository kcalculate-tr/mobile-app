// G19-S3 md.4/md.5 + G26-S1 + G41-S1 — uygulama içi rıza; iOS'ta ayrıca ATT (yalnız kutudan sonra sorulur).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fbSettingsFor, metaAllowed, parseAdConsent, parseFirstParty, toAttStatus } from '../consent';
import { scanOutcomeEvent } from '../../../modules/ai/scan/scanMetrics';
import { logSourceOf } from '../logSource';

test('G27: Meta varsayılan KAPALI — Android yalnız açık rıza (granted) ile', () => {
  const a = { platform: 'android', att: 'unavailable' as const };
  assert.equal(metaAllowed({ ...a, adConsent: 'unset' }), false);
  assert.equal(metaAllowed({ ...a, adConsent: 'granted' }), true);
  assert.equal(metaAllowed({ ...a, adConsent: 'denied' }), false);
});

test('G41: iOS Meta = onay açık VE ATT izinli; ATT sorulmadı/reddedildi → kapalı', () => {
  for (const att of ['undetermined', 'denied', 'unavailable'] as const) {
    assert.equal(metaAllowed({ platform: 'ios', adConsent: 'granted', att }), false, att);
  }
  assert.equal(metaAllowed({ platform: 'ios', adConsent: 'granted', att: 'granted' }), true);
  for (const adConsent of ['unset', 'denied'] as const) {
    assert.equal(metaAllowed({ platform: 'ios', adConsent, att: 'granted' }), false, adConsent);
  }
});

test('G41: iOS izleme + IDFA yalnız onay + ATT izinliyse; Android reklam kimliği rızaya bağlı', () => {
  const off = { advertiserTracking: false, advertiserIdCollection: false };
  const on = { advertiserTracking: true, advertiserIdCollection: true };
  for (const adConsent of ['unset', 'granted', 'denied'] as const) {
    for (const att of ['undetermined', 'denied'] as const) {
      assert.deepEqual(fbSettingsFor({ platform: 'ios', adConsent, att }), off, `${adConsent}/${att}`);
    }
  }
  assert.deepEqual(fbSettingsFor({ platform: 'ios', adConsent: 'granted', att: 'granted' }), on);
  assert.deepEqual(fbSettingsFor({ platform: 'ios', adConsent: 'denied', att: 'granted' }), off);
  const a = { platform: 'android', att: 'unavailable' as const };
  assert.deepEqual(fbSettingsFor({ ...a, adConsent: 'unset' }), off);
  assert.deepEqual(fbSettingsFor({ ...a, adConsent: 'granted' }), on);
  assert.deepEqual(fbSettingsFor({ ...a, adConsent: 'denied' }), off);
});

test('G41: ATT eşlemesi — iOS dışı unavailable, bilinmeyen → undetermined', () => {
  assert.equal(toAttStatus('android', 'granted'), 'unavailable');
  assert.equal(toAttStatus('ios', 'granted'), 'granted');
  assert.equal(toAttStatus('ios', 'denied'), 'denied');
  assert.equal(toAttStatus('ios', 'undetermined'), 'undetermined');
  assert.equal(toAttStatus('ios', null), 'undetermined');
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
