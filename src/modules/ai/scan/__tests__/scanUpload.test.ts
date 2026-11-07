// G17-S1 md.1 — Tara yükleme adımı: yol biçimi, yükleme → analiz sırası,
// yükleme/analiz hatasında hak iadesi (release), çevrimdışı kuyruk da aynı adımı
// kullanır. SAF (native yok). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { runAiScan } from '../runScan';
import { createMockAiScanClient } from '../mock';
import {
  base64Bytes,
  isStoragePath,
  scanFileKey,
  scanImagePath,
  sniffImageType,
} from '../scanPath';

const UID = '3f1c2a9e-0000-4000-8000-000000000001';
const LOCAL = 'file:///var/mobile/Containers/Data/Application/AB/Library/Caches/ImagePicker/1F2E.jpg';
const KEY = `${UID}-${LOCAL}`; // ScanScreen'deki anahtar biçimi

test('scanImagePath: <uid>/scans/<anahtar>.jpg — edge kuralına uyar (uid öneki, `..` yok, tek klasör)', () => {
  const p = scanImagePath(UID, KEY);
  assert.ok(p.startsWith(`${UID}/scans/`), p);
  assert.ok(p.endsWith('.jpg'));
  assert.equal(p.includes('..'), false);
  assert.equal(p.includes('file:'), false, 'yerel URI kova yoluna sızmaz');
  assert.equal(p.split('/').length, 3, 'yalnız <uid>/scans/<dosya>');
  assert.ok(isStoragePath(p, UID));
  assert.equal(isStoragePath(LOCAL, UID), false, 'file:// kova yolu sayılmaz');
});

test('scanFileKey: deterministik, güvenli karakter, uzun anahtarda sınırlı ve ayrık', () => {
  assert.equal(scanFileKey(KEY), scanFileKey(KEY));
  assert.match(scanFileKey(KEY), /^[A-Za-z0-9_-]+$/);
  assert.ok(scanFileKey(KEY).length <= 96);
  const other = KEY.replace('1F2E', '9A9A');
  assert.notEqual(scanFileKey(KEY), scanFileKey(other));
  assert.equal(scanFileKey('kısa../a'), 'k_sa___a');
  assert.throws(() => scanImagePath('', KEY));
});

test('sniffImageType/base64Bytes: tür başlıktan, boyut base64 uzunluğundan', () => {
  assert.equal(sniffImageType('/9j/4AAQSkZJRg'), 'image/jpeg');
  assert.equal(sniffImageType('iVBORw0KGgoAAAA'), 'image/png');
  assert.equal(sniffImageType('UklGRiQAAABXRUJQ'), 'image/webp');
  assert.equal(base64Bytes('QUJD'), 3);
  assert.equal(base64Bytes('QUI='), 2);
  assert.equal(base64Bytes('QQ=='), 1);
});

test('runAiScan: sıra reserve → upload → analyze; analize KOVA YOLU gider (file:// değil)', async () => {
  const c = createMockAiScanClient({ withUpload: true, userId: UID });
  const out = await runAiScan(c, { idempotencyKey: KEY, imageRef: LOCAL });
  assert.equal(out.status, 'ok');
  assert.deepEqual(c._calls, [
    `reserve:${KEY}`,
    `upload:${LOCAL}`,
    `analyze:${scanImagePath(UID, KEY)}`,
  ]);
});

test('runAiScan: yükleme başarısız → analiz çağrılmaz, hak İADE edilir', async () => {
  const c = createMockAiScanClient({ failUpload: true, userId: UID, cap: 3 });
  const out = await runAiScan(c, { idempotencyKey: KEY, imageRef: LOCAL });
  assert.equal(out.status, 'failed');
  assert.deepEqual(c._calls, [`reserve:${KEY}`, `upload:${LOCAL}`, `release:${KEY}`]);
  assert.equal(c._remaining(), 3);
  if (out.status === 'failed') assert.equal(out.remaining, 3);
});

test('runAiScan: yükleme tamam, analiz başarısız → release (sırayla)', async () => {
  const c = createMockAiScanClient({ withUpload: true, failAnalysis: true, userId: UID });
  const out = await runAiScan(c, { idempotencyKey: KEY, imageRef: LOCAL });
  assert.equal(out.status, 'failed');
  assert.deepEqual(c._calls.map((x) => x.split(':')[0]), ['reserve', 'upload', 'analyze', 'release']);
});

test('runAiScan: kota bitince yükleme de yapılmaz (boşuna veri gönderilmez)', async () => {
  const c = createMockAiScanClient({ withUpload: true, cap: 0, userId: UID });
  const out = await runAiScan(c, { idempotencyKey: KEY, imageRef: LOCAL });
  assert.equal(out.status, 'quota_exhausted');
  assert.deepEqual(c._calls, [`reserve:${KEY}`]);
});
