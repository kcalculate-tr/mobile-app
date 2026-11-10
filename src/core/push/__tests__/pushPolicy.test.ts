// G26-S1 md.6 — bildirim izni kararı: ilk öğün sonrası tek teklif; ret sonrası yalnız
// Ayarlar'dan, 30 günde en fazla bir sistem penceresi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePush, PUSH_REASK_DAYS } from '../pushPolicy';

const NOW = Date.UTC(2026, 10, 11);
const DAY = 86_400_000;

test('izin varsa her kaynakta granted', () => {
  for (const source of ['first_meal', 'settings'] as const) {
    assert.equal(decidePush({ status: 'granted', canAskAgain: true, askedAt: null, now: NOW, source }), 'granted');
  }
});

test('ilk öğün: hiç sorulmadıysa tek teklif; sorulduysa / reddedildiyse sessiz', () => {
  assert.equal(decidePush({ status: 'undetermined', canAskAgain: true, askedAt: null, now: NOW, source: 'first_meal' }), 'ask');
  assert.equal(decidePush({ status: 'undetermined', canAskAgain: true, askedAt: NOW - DAY, now: NOW, source: 'first_meal' }), 'skip');
  assert.equal(decidePush({ status: 'denied', canAskAgain: true, askedAt: null, now: NOW, source: 'first_meal' }), 'skip');
  assert.equal(decidePush({ status: 'denied', canAskAgain: false, askedAt: null, now: NOW, source: 'first_meal' }), 'skip');
  // 30 gün geçse bile otomatik teklif YOK (yalnız Ayarlar'dan).
  assert.equal(decidePush({ status: 'denied', canAskAgain: true, askedAt: NOW - 90 * DAY, now: NOW, source: 'first_meal' }), 'skip');
});

test('Ayarlar: 30 günde en fazla bir sistem penceresi; aksi hâlde işletim sistemi Ayarlar’ı', () => {
  assert.equal(PUSH_REASK_DAYS, 30);
  assert.equal(decidePush({ status: 'undetermined', canAskAgain: true, askedAt: null, now: NOW, source: 'settings' }), 'ask');
  assert.equal(decidePush({ status: 'denied', canAskAgain: true, askedAt: NOW - 29 * DAY, now: NOW, source: 'settings' }), 'open_settings');
  assert.equal(decidePush({ status: 'denied', canAskAgain: true, askedAt: NOW - 30 * DAY, now: NOW, source: 'settings' }), 'ask');
  // iOS ret sonrası işletim sistemi soramaz → Ayarlar
  assert.equal(decidePush({ status: 'denied', canAskAgain: false, askedAt: NOW - 400 * DAY, now: NOW, source: 'settings' }), 'open_settings');
});
