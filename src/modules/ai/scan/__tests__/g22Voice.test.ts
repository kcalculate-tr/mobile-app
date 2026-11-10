// G22-S1 md.1/md.5 — Ses modu saf mantığı + metin taraması (hak ortak) + çevrimdışı metin kuyruğu
// + barkod günlük hakkı (fail-open). Ses SUNUCUYA GİTMEZ: istemci yalnız metin gönderir.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSheetPhase,
  joinTranscript,
  levelFromVolume,
  phaseAfterError,
  phaseForPermission,
  phaseOnDone,
  speechLocale,
  splitSpokenItems,
  splitTail,
  voiceScanKey,
  waveHeights,
  WAVE_BARS,
} from '../voice/voiceCore';
import { runAiTextScan } from '../runScan';
import { createMockAiScanClient } from '../mock';
import { buildTextAnalyzeBody, normalizeTranscript } from '../client';
import { reserveBarcode } from '../barcode/quota';

test('ses: cihaz dili → tanıma dili (TR/EN)', () => {
  assert.equal(speechLocale('tr', 'en'), 'tr-TR');
  assert.equal(speechLocale('de', 'tr'), 'en-US');
  assert.equal(speechLocale(null, 'en'), 'en-US');
  assert.equal(speechLocale(null, 'tr'), 'tr-TR');
});

test('ses: canlı döküm birleşir; son kelime ara sonuçta ayrılır', () => {
  assert.equal(joinTranscript('2 yumurta,', ' 1 dilim  ekmek'), '2 yumurta, 1 dilim ekmek');
  assert.deepEqual(splitTail('2 yumurta, yarım avokado', true), { head: '2 yumurta, yarım ', tail: 'avokado' });
  assert.deepEqual(splitTail('2 yumurta', false), { head: '2 yumurta', tail: '' });
});

test('ses hâlleri: izin, hata, Bitti', () => {
  assert.equal(phaseForPermission({ granted: true }), 'idle');
  assert.equal(phaseForPermission({ granted: false, canAskAgain: true }), 'perm');
  assert.equal(phaseForPermission({ granted: false, canAskAgain: false }), 'denied');
  assert.equal(phaseForPermission(null), 'perm');
  assert.equal(phaseAfterError('not-allowed', false), 'denied');
  assert.equal(phaseAfterError('no-speech', false), 'empty');
  assert.equal(phaseAfterError('no-speech', true), 'paused', 'metin varsa kaybetme');
  assert.equal(phaseAfterError('language-not-supported', false), 'unavailable');
  assert.equal(phaseAfterError('aborted', false), 'idle');
  assert.equal(phaseOnDone('   ', false), 'empty');
  assert.equal(phaseOnDone('1 kase yoğurt', true), 'offline');
  assert.equal(phaseOnDone('1 kase yoğurt', false), 'processing');
  for (const p of ['perm', 'empty', 'denied', 'offline', 'limit', 'failed'] as const) assert.equal(isSheetPhase(p), true);
  for (const p of ['idle', 'listening', 'paused', 'processing'] as const) assert.equal(isSheetPhase(p), false);
});

test('ses: dalga yalnız seviyeyle; sessizken düz 6 pt; merkez yüksek', () => {
  assert.equal(levelFromVolume(-1), 0);
  assert.equal(levelFromVolume(5), 0.5);
  assert.equal(levelFromVolume(20), 1);
  const quiet = waveHeights(0, 0);
  assert.equal(quiet.length, WAVE_BARS);
  assert.ok(quiet.every((h) => h === 6));
  const loud = waveHeights(1, 0);
  const mid = Math.floor(WAVE_BARS / 2);
  assert.ok(loud[mid] > loud[0] && loud[mid] > loud[WAVE_BARS - 1]);
  assert.ok(loud.every((h) => h >= 6 && h <= 76));
});

test('ses: öğe çipleri ve anahtar', () => {
  assert.deepEqual(splitSpokenItems('2 yumurta, 1 dilim tam buğday ekmek, yarım avokado.'), ['2 yumurta', '1 dilim tam buğday ekmek', 'yarım avokado']);
  assert.deepEqual(splitSpokenItems('mercimek çorbası ve bir ayran'), ['mercimek çorbası', 'bir ayran']);
  const k = voiceScanKey('u1', 1000, 0.5);
  assert.match(k, /^voice-u1-/);
  assert.notEqual(voiceScanKey('u1', 1000, 0.1), k);
});

test('metin taraması: yalnız METİN gönderilir (mode:text), döküm sadeleşir ve 500 ile sınırlanır', () => {
  const body = buildTextAnalyzeBody({ idempotencyKey: 'k', text: ' 2 yumurta,\n1 dilim\tekmek ', lang: 'tr' });
  assert.deepEqual(body, { reservation_id: 'k', mode: 'text', text: '2 yumurta, 1 dilim ekmek', lang: 'tr' });
  assert.equal(Object.keys(body).some((k) => /audio|image/.test(k)), false, 'ses/görsel alanı YOK');
  assert.equal(normalizeTranscript('a'.repeat(900)).length, 500);
});

test('metin taraması: hak fotoğrafla ORTAK (aynı reserve), başarısızlıkta iade, kota bitince limit', async () => {
  const c = createMockAiScanClient({ cap: 2 });
  const ok = await runAiTextScan(c, { idempotencyKey: 'v1', text: '2 yumurta, 1 dilim ekmek', lang: 'tr' });
  assert.equal(ok.status, 'ok');
  if (ok.status === 'ok') {
    assert.equal(ok.estimate.ingredients.length, 2);
    assert.equal(ok.estimate.isEstimate, true);
  }
  assert.equal(c._remaining(), 1);
  assert.ok(c._calls.includes('reserve:v1') && c._calls.some((x) => x.startsWith('analyzeText:')));
  assert.equal(c._calls.some((x) => x.startsWith('upload:') || x.startsWith('analyze:')), false, 'görsel yükleme/analiz yok');
  const failing = createMockAiScanClient({ cap: 2, failAnalysis: true });
  const f = await runAiTextScan(failing, { idempotencyKey: 'v2', text: 'yoğurt' });
  assert.equal(f.status, 'failed');
  assert.equal(failing._remaining(), 2, 'iade edildi');
  await runAiTextScan(c, { idempotencyKey: 'v3', text: 'ayran' });
  const lim = await runAiTextScan(c, { idempotencyKey: 'v4', text: 'çay' });
  assert.equal(lim.status, 'quota_exhausted');
});

test('metin taraması: kademeli yanıt (tier/limit/unlimited) sonuca taşınır; G23: fair_use nedeni yok', async () => {
  const base = createMockAiScanClient({ cap: 5 });
  const c = {
    ...base,
    reserveScan: async () => ({ ok: false, remaining: 0, reset_at: 'x', tier: 'balance' as const, limit: 50, unlimited: false }),
  };
  const r = await runAiTextScan(c, { idempotencyKey: 'v9', text: 'x' });
  assert.equal(r.status, 'quota_exhausted');
  if (r.status === 'quota_exhausted') {
    assert.equal('reason' in r, false);
    assert.deepEqual(r.quota, { tier: 'balance', limit: 50, unlimited: false });
  }
});

test('barkod hakkı: ok → izin + anlık hak; ok:false → limit; RPC hatası → izin (fail-open)', async () => {
  const ok = await reserveBarcode('8690000000001', async () => ({ data: { ok: true, remaining: 4, limit: 5, tier: 'free', unlimited: false, reset_at: 'r' }, error: null }));
  assert.equal(ok.allowed, true);
  assert.deepEqual(ok.snapshot && { r: ok.snapshot.remaining, l: ok.snapshot.limit, k: ok.snapshot.kind }, { r: 4, l: 5, k: 'barcode' });
  const lim = await reserveBarcode('8690000000002', async () => ({ data: { ok: false, remaining: 0, limit: 5 }, error: null }));
  assert.equal(lim.allowed, false);
  const missing = await reserveBarcode('8690000000003', async () => ({ data: null, error: { message: 'function reserve_barcode_scan does not exist' } }));
  assert.deepEqual(missing, { allowed: true, snapshot: null });
  const thrown = await reserveBarcode('8690000000004', async () => {
    throw new Error('network');
  });
  assert.deepEqual(thrown, { allowed: true, snapshot: null });
});
