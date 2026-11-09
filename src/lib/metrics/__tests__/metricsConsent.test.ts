// G19-S3 md.4/md.5 — ATT dalları + uygulama içi rıza.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fbSettingsFor, metaAllowed, parseAdConsent, parseFirstParty, toAttStatus } from '../consent';
import { scanOutcomeEvent } from '../../../modules/ai/scan/scanMetrics';
import { logSourceOf } from '../logSource';

test('iOS: Meta yalnız ATT granted iken açık (rıza unset = bugünkü davranış)', () => {
  assert.equal(metaAllowed({ platform: 'ios', att: 'granted', adConsent: 'unset' }), true);
  for (const att of ['denied', 'undetermined', 'restricted'] as const) {
    assert.equal(metaAllowed({ platform: 'ios', att, adConsent: 'unset' }), false, att);
    assert.equal(metaAllowed({ platform: 'ios', att, adConsent: 'granted' }), false, `${att}+granted`);
  }
});

test('uygulama içi rıza denied: ATT granted olsa da Meta kapalı (iOS + Android)', () => {
  assert.equal(metaAllowed({ platform: 'ios', att: 'granted', adConsent: 'denied' }), false);
  assert.equal(metaAllowed({ platform: 'android', att: 'unavailable', adConsent: 'denied' }), false);
});

test('Android: ATT yok; rıza unset/granted → açık (bugünkü davranış korunur)', () => {
  assert.equal(metaAllowed({ platform: 'android', att: 'unavailable', adConsent: 'unset' }), true);
  assert.equal(metaAllowed({ platform: 'android', att: 'unavailable', adConsent: 'granted' }), true);
});

test('initFBSDK ayarları: IDFA toplama ve advertiser tracking aynı karara bağlı', () => {
  assert.deepEqual(fbSettingsFor({ platform: 'ios', att: 'granted', adConsent: 'unset' }), { advertiserTracking: true, advertiserIdCollection: true });
  assert.deepEqual(fbSettingsFor({ platform: 'ios', att: 'denied', adConsent: 'unset' }), { advertiserTracking: false, advertiserIdCollection: false });
  assert.deepEqual(fbSettingsFor({ platform: 'ios', att: 'granted', adConsent: 'denied' }), { advertiserTracking: false, advertiserIdCollection: false });
});

test('ATT durum dizesi eşlemesi', () => {
  assert.equal(toAttStatus('ios', 'granted'), 'granted');
  assert.equal(toAttStatus('ios', 'denied'), 'denied');
  assert.equal(toAttStatus('ios', 'restricted'), 'restricted');
  assert.equal(toAttStatus('ios', 'undetermined'), 'undetermined');
  assert.equal(toAttStatus('ios', undefined), 'undetermined');
  assert.equal(toAttStatus('android', 'granted'), 'unavailable');
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
