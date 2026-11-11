// G19-S4 md.2 — Çift olay temizliği: her kullanıcı eylemi TAM 1 olay.
// G19-S1 (Tara), G19-S2 (takip) ve G19-S3 (ölçüm) aynı eylemlere ayrı ayrı olay
// eklemişti; birleştirmede tek kopya bırakıldı. Bu test hem davranışı (sink ile)
// hem de kaynak koddaki çağrı noktalarını (statik) kilitler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setScanEventSink, trackScan } from '../../../modules/ai/scan/scanEvents';
import { trackScanLog, trackScanOutcome } from '../../../modules/ai/scan/scanTrack';
import { setTrackSink, trackEvent } from '../../../modules/gun/track/events';
import { isClientEvent } from '../events';
import { sanitizeProps } from '../sanitize';

const ROOT = join(__dirname, '../../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

type Ev = [string, Record<string, unknown>];
function capture(fn: () => void): Ev[] {
  const got: Ev[] = [];
  setScanEventSink((n, p) => got.push([n, p]));
  setTrackSink((n, p) => got.push([n, p]));
  try {
    fn();
  } finally {
    setScanEventSink(null);
    setTrackSink(null);
  }
  return got;
}

const EST = { kcal: 412.4, ingredients: [{}, {}] };

test('Tara sonucu: başarı / limit / kapatma / hata → tam 1 olay', () => {
  const ok = capture(() => trackScanOutcome({ status: 'ok', estimate: EST as never, remaining: 2, reset_at: '' }, 'camera'));
  assert.deepEqual(ok, [['scan_success', { n_items: 2, kcal: 412, via: 'camera' }]]);
  const lim = capture(() => trackScanOutcome({ status: 'quota_exhausted', remaining: 0, reset_at: '' }, 'gallery'));
  assert.deepEqual(lim, [['scan_limit', { via: 'gallery' }]]);
  for (const reason of ['disabled', 'global_cap'] as const) {
    const off = capture(() => trackScanOutcome({ status: 'unavailable', reason, remaining: 2, reset_at: '' }, 'camera'));
    assert.deepEqual(off, [['scan_fail', { code: reason, stage: 'reserve', via: 'camera' }]]);
  }
  const fail = capture(() =>
    trackScanOutcome(
      { status: 'failed', remaining: 2, reset_at: '', failure: { code: 'parse', stage: 'analyze' } } as never,
      'queue',
    ),
  );
  assert.deepEqual(fail, [['scan_fail', { code: 'parse', stage: 'analyze', via: 'queue' }]]);
});

test('Tara kaydı: tam 1 scan_log + tam 1 log_add{source:scan}', () => {
  const got = capture(() => trackScanLog(EST, true, 'ogle'));
  assert.deepEqual(
    got.map((e) => e[0]),
    ['scan_log', 'log_add'],
  );
  assert.deepEqual(got[0][1], { n_items: 2, kcal: 412, edited: true, meal_type: 'ogle' });
  assert.equal(got[1][1].source, 'scan');
  assert.equal(got[1][1].kcal, 412);
});

test('takip olayları: trackEvent tek çağrı → tek olay, sözlük beyaz listesinden geçer', () => {
  const got = capture(() => {
    trackEvent({ name: 'water_add', props: { ml: 250, total_ml: 750, undo: false } });
    trackEvent({ name: 'activity_add', props: { type: 'kosu', minutes: 30, undo: false } });
    trackEvent({ name: 'log_delete', props: { source: 'manual', slot: 'lunch', undone: false } });
    trackEvent({ name: 'streak_day', props: { days: 3 } });
    trackEvent({ name: 'ring_complete', props: { kcal: 2000, target: 2000 } });
  });
  assert.deepEqual(
    got.map((e) => e[0]),
    ['water_add', 'activity_add', 'log_delete', 'streak_day', 'ring_complete'],
  );
  // S2 alanları S3 sözlüğünde de izinli (sunucuya düşmeden gider).
  for (const [n, p] of got) {
    assert.ok(isClientEvent(n), `${n} istemci olayı`);
    assert.deepEqual(sanitizeProps(n, p), p, `${n} prop'ları sözlükte`);
  }
});

test('Tara olay adları: sözlükteki kanonik adlar (eski D-S1 adları istemciden yazılmaz)', () => {
  for (const n of ['scan_open', 'scan_capture', 'scan_success', 'scan_fail', 'scan_limit', 'scan_offline', 'scan_log'] as const) {
    const got = capture(() => trackScan(n));
    assert.equal(got.length, 1);
    assert.ok(isClientEvent(n), n);
  }
  const files = ['src/modules/ai/scan/screens/ScanScreen.tsx', 'src/modules/ai/scan/drainPending.ts'].map(read).join('\n');
  assert.equal(count(files, /'scan_start'|'scan_failed'|'log_meal'/g), 0);
});

test('statik: aynı eylem için ikinci çağrı yok', () => {
  // Su: yalnız Ana sayfa (TrackerScreen) — veri katmanı (water.ts) olay göndermez.
  assert.equal(count(read('src/modules/gun/water.ts'), /\btrack(Event)?\(/g), 0);
  // Etkinlik ekle: TrackerActivityEntry'de tek activity_add.
  assert.equal(count(read('src/modules/kesfet/ui/TrackerActivityEntry.tsx'), /activity_add/g), 1);
  // Tara: ekran ve kuyruk log_add'ı doğrudan göndermez (scanTrack.trackScanLog tek yer).
  const scan = read('src/modules/ai/scan/screens/ScanScreen.tsx') + read('src/modules/ai/scan/drainPending.ts');
  assert.equal(count(scan, /'log_add'/g), 0);
  assert.equal(count(scan, /\btrack\(/g), 0, 'Tara ekranı track() yerine trackScan kullanır');
  // Tara sonucu ekranda tek noktadan (yeni kabuk + eski kabuk = 2 trackScanOutcome).
  assert.equal(count(read('src/modules/ai/scan/screens/ScanScreen.tsx'), /trackScanOutcome\(/g), 2);
  assert.equal(count(read('src/modules/ai/scan/screens/ScanScreen.tsx'), /'scan_success'/g), 0);
  // logFlight köprüsü Tara uçuşlarını saymaz; Tara uçuşları source='scan' taşır.
  assert.match(read('src/modules/gun/track/logEventsBridge.ts'), /SELF_REPORTED\.has\(p\.source\)\) return;/);
  // G21-S1: foto + kuyruk + barkod (md.2); G28-S1 md.1: foto ve barkod ortak logTrace'ten, kuyruk emitLogFlight.
  assert.equal(count(read('src/modules/ai/scan/screens/ScanScreen.tsx'), /emitLogFlight\(\{\s*(?:\/\/[^\n]*\s*)?[^\n]*source: 'scan'/g), 1);
  assert.equal(count(read('src/modules/ai/scan/screens/ScanScreen.tsx'), /await logTrace\(\{[\s\S]{0,200}?source: 'scan'/g), 2);
  // Keşfet logu: KesfetScreen'de tek log_add + geri alda tek log_delete; köprü 'kesfet' saymaz.
  const kesfet = read('src/modules/kesfet/ui/KesfetScreen.tsx');
  assert.equal(count(kesfet, /name: 'log_add'/g), 1);
  assert.equal(count(kesfet, /name: 'log_delete'/g), 1);
  assert.match(read('src/modules/gun/track/logEventsBridge.ts'), /SELF_REPORTED = new Set\(\['scan', 'kesfet'\]\)/);
  // Takip köprüsü App.tsx'te tek track()'e bağlı.
  assert.match(read('App.tsx'), /setTrackSink\(\(name, props\) => track\(/);
});

test('statik: TrackerScreen her eylemde ya yeni kabuk (trackEvent) ya eski kabuk (track) — ikisi aynı dalda değil', () => {
  const src = read('src/screens/TrackerScreen.tsx');
  // Teslim edilen sipariş otomatik log'u: yalnız yeni kabuk, yalnız yeni satır.
  assert.equal(count(src, /source: 'order'/g), 1);
  assert.match(src, /if \(!e2\) \{\s*trackEvent\(\{\s*name: 'log_add'/);
  // Elle giriş: yeni kabuk 1 (trackEvent) + eski kabuk 1 (track) — ayrı dallar.
  assert.equal(count(src, /props: \{ source: 'manual'/g), 1);
  assert.equal(count(src, /track\('log_add', \{ source: 'manual'/g), 1);
});
