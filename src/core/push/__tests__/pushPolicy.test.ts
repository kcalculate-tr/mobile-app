// G26-S1 md.6 — bildirim izni kararı: ilk öğün sonrası tek teklif; ret sonrası yalnız
// Ayarlar'dan, 30 günde en fazla bir sistem penceresi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideNotifyReoffer, decidePush, NOTIFY_REOFFER_DAYS, PUSH_REASK_DAYS } from '../pushPolicy';

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

// ── G27-S1 md.3 (G26 SORULAR 4): kaçan teklifin ikinci şansı ─────────────────
import { decideNotifyOffer } from '../pushPolicy';

const base = { offered: false, missedSession: null, currentSession: 'B', consentShownThisSession: false, canOffer: true };

test('G27: ilk öğün — oturumda onay sheet\'i yoksa teklif; varsa ertele (kaçtı)', () => {
  assert.equal(decideNotifyOffer({ ...base, trigger: 'first_meal' }), 'offer');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'first_meal', consentShownThisSession: true }), 'defer');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'first_meal', canOffer: false }), 'skip');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'first_meal', offered: true }), 'skip');
});

test('G27: kaçan teklif SONRAKİ oturumda öğün kaydında BİR kez daha; aynı oturumda değil', () => {
  assert.equal(decideNotifyOffer({ ...base, trigger: 'meal_log', missedSession: 'A' }), 'offer');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'meal_log', missedSession: 'B' }), 'skip', 'aynı oturum');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'meal_log' }), 'skip', 'kaçan teklif yok');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'meal_log', missedSession: 'A', offered: true }), 'skip', 'ikinci şans kullanıldı');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'meal_log', missedSession: 'A', consentShownThisSession: true }), 'skip', 'hak korunur');
  assert.equal(decideNotifyOffer({ ...base, trigger: 'meal_log', missedSession: 'A', canOffer: false }), 'drop', 'izin verildi / sorulamaz');
});

// G41-S1 md.3 — ön kart "Şimdi değil" → 7 gün sonra EN FAZLA bir kez daha.

test('G41: "Şimdi değil" sonrası ikinci kart yalnız 7 gün dolunca ve bir kez', () => {
  const D = 86_400_000;
  const base = { reoffered: false, consentShownThisSession: false, canOffer: true };
  assert.equal(NOTIFY_REOFFER_DAYS, 7);
  assert.equal(decideNotifyReoffer({ ...base, laterAt: null, now: 10 * D }), 'skip');
  assert.equal(decideNotifyReoffer({ ...base, laterAt: 0, now: 6 * D }), 'skip');
  assert.equal(decideNotifyReoffer({ ...base, laterAt: 0, now: 7 * D }), 'offer');
  assert.equal(decideNotifyReoffer({ ...base, laterAt: 0, now: 30 * D, reoffered: true }), 'skip');
  assert.equal(decideNotifyReoffer({ ...base, laterAt: 0, now: 30 * D, canOffer: false }), 'skip');
  assert.equal(decideNotifyReoffer({ ...base, laterAt: 0, now: 30 * D, consentShownThisSession: true }), 'skip');
});
