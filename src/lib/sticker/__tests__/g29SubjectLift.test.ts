// G29-S1 md.1 — çıkartma yedek yolları: her başarısızlık sessiz `{ ok:false }`, asla fırlatmaz,
// en geç süre sınırında döner; geçerli sonuç ekranda fotoğrafın üstüne birebir oturur.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STICKER_MAX_SIZE,
  STICKER_TIMEOUT_MS,
  canLiftSticker,
  coverRect,
  liftSticker,
  parseNativeResult,
  platformSupported,
  setSubjectLiftNative,
  setSubjectLiftPlatform,
  type SubjectLiftNative,
} from '../subjectLift';

const GOOD = {
  uri: 'file:///tmp/kcal-sticker-1.webp',
  width: 512,
  height: 384,
  format: 'webp',
  bytes: 21000,
  sourceWidth: 1600,
  sourceHeight: 1200,
  cropX: 0.1,
  cropY: 0.2,
  cropWidth: 0.8,
  cropHeight: 0.6,
};

function native(over: Partial<SubjectLiftNative> = {}): SubjectLiftNative {
  return { isAvailable: () => true, liftAsync: () => Promise.resolve(GOOD), ...over };
}
const IOS17 = () => ({ OS: 'ios', Version: '17.2' });

function setup(n: SubjectLiftNative | null, p = IOS17) {
  setSubjectLiftNative(() => n);
  setSubjectLiftPlatform(p);
}

test.afterEach(() => {
  setSubjectLiftNative(null);
  setSubjectLiftPlatform(null);
});

test('sabitler: 1,5 sn sınır, 512 px', () => {
  assert.equal(STICKER_TIMEOUT_MS, 1500);
  assert.equal(STICKER_MAX_SIZE, 512);
});

test('platform: iOS 17+ ve Android denenir; iOS 16 / web kapalı', () => {
  assert.equal(platformSupported({ OS: 'ios', Version: '17.0' }), null);
  assert.equal(platformSupported({ OS: 'ios', Version: '18.1' }), null);
  assert.equal(platformSupported({ OS: 'ios', Version: '16.7.2' }), 'os_too_old');
  assert.equal(platformSupported({ OS: 'ios', Version: 'x' }), 'os_too_old');
  assert.equal(platformSupported({ OS: 'android', Version: 29 }), null);
  assert.equal(platformSupported({ OS: 'web', Version: '' }), 'unsupported');
  assert.equal(platformSupported(null), 'unsupported');
});

test('başarılı: çıkartma döner (kırpma kutusu + boyut)', async () => {
  setup(native());
  const o = await liftSticker('file:///p.jpg');
  assert.equal(o.ok, true);
  if (!o.ok) return;
  assert.equal(o.sticker.format, 'webp');
  assert.deepEqual(o.sticker.crop, { x: 0.1, y: 0.2, width: 0.8, height: 0.6 });
  assert.equal(canLiftSticker(), true);
});

test('yedek: fotoğraf yok → no_input (native çağrılmaz)', async () => {
  let called = 0;
  setup(native({ liftAsync: () => (called++, Promise.resolve(GOOD)) }));
  const o = await liftSticker(null);
  assert.deepEqual([o.ok, !o.ok && o.reason], [false, 'no_input']);
  assert.equal(called, 0);
});

test('yedek: native modül yok (eski derleme / OTA) → no_native', async () => {
  setup(null);
  const o = await liftSticker('file:///p.jpg');
  assert.deepEqual([o.ok, !o.ok && o.reason], [false, 'no_native']);
  assert.equal(canLiftSticker(), false);
});

test('yedek: iOS 17 altı → os_too_old (native çağrılmaz)', async () => {
  let called = 0;
  setup(native({ liftAsync: () => (called++, Promise.resolve(GOOD)) }), () => ({ OS: 'ios', Version: '16.4' }));
  const o = await liftSticker('file:///p.jpg');
  assert.deepEqual([o.ok, !o.ok && o.reason], [false, 'os_too_old']);
  assert.equal(called, 0);
  assert.equal(canLiftSticker(), false);
});

test('yedek: modül "desteklenmiyor" / isAvailable fırlatır → unsupported', async () => {
  setup(native({ isAvailable: () => false }));
  assert.deepEqual(await liftSticker('file:///p.jpg').then((o) => !o.ok && o.reason), 'unsupported');
  setup(native({ isAvailable: () => { throw new Error('x'); } }));
  assert.deepEqual(await liftSticker('file:///p.jpg').then((o) => !o.ok && o.reason), 'unsupported');
  assert.equal(canLiftSticker(), false);
});

test('yedek: native hata (Android model inmemiş dahil) → error, fırlatmaz', async () => {
  setup(native({ liftAsync: () => Promise.reject(new Error('Waiting for the subject segmentation optional module to be downloaded')) }));
  const o = await liftSticker('file:///p.jpg');
  assert.deepEqual([o.ok, !o.ok && o.reason], [false, 'error']);
  setup(native({ liftAsync: () => { throw new Error('sync'); } }));
  const o2 = await liftSticker('file:///p.jpg');
  assert.deepEqual([o2.ok, !o2.ok && o2.reason], [false, 'error']);
});

test('yedek: süre aşımı → timeout, akış beklemez; geç gelen sonuç yok sayılır', async () => {
  let resolveLate: (v: unknown) => void = () => {};
  setup(native({ liftAsync: () => new Promise((r) => (resolveLate = r)) }));
  const t0 = Date.now();
  const o = await liftSticker('file:///p.jpg', { timeoutMs: 40 });
  const took = Date.now() - t0;
  assert.deepEqual([o.ok, !o.ok && o.reason], [false, 'timeout']);
  assert.ok(took < 400, `süre ${took} ms`);
  resolveLate(GOOD); // geç gelir — artık hiçbir şey değişmez
  await new Promise((r) => setTimeout(r, 5));
});

test('yedek: geçersiz sonuç → invalid', async () => {
  for (const bad of [null, 'x', { ...GOOD, uri: '' }, { ...GOOD, cropWidth: 0 }, { ...GOOD, cropX: 2 }, { ...GOOD, width: 2048 }, { ...GOOD, format: 'jpg' }, { ...GOOD, sourceWidth: 0 }]) {
    setup(native({ liftAsync: () => Promise.resolve(bad) }));
    const o = await liftSticker('file:///p.jpg');
    assert.deepEqual([o.ok, !o.ok && o.reason], [false, 'invalid'], JSON.stringify(bad));
  }
});

test('parseNativeResult: PNG yedeği kabul (iOS WebP kodlayıcı yoksa)', () => {
  const s = parseNativeResult({ ...GOOD, format: 'png' });
  assert.equal(s?.format, 'png');
});

test('coverRect: cover ile çizilen fotoğrafta çıkartma kutusu', () => {
  // 1600×1200 (4:3) fotoğraf 390×844 kapta cover: ölçek = 844/1200, genişlik taşar ve ortalanır.
  const r = coverRect({ width: 390, height: 844 }, { sourceWidth: 1600, sourceHeight: 1200, crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } });
  assert.ok(r);
  const s = 844 / 1200;
  const dw = 1600 * s;
  const ox = (390 - dw) / 2;
  assert.ok(Math.abs(r!.x - (ox + 0.25 * dw)) < 1e-6);
  assert.ok(Math.abs(r!.y - 0.25 * 844) < 1e-6);
  assert.ok(Math.abs(r!.width - 0.5 * dw) < 1e-6);
  assert.ok(Math.abs(r!.height - 422) < 1e-6);
  // Tam kare → kabın tamamı
  const full = coverRect({ width: 300, height: 300 }, { sourceWidth: 1000, sourceHeight: 1000, crop: { x: 0, y: 0, width: 1, height: 1 } });
  assert.deepEqual(full, { x: 0, y: 0, width: 300, height: 300 });
  assert.equal(coverRect({ width: 0, height: 100 }, { sourceWidth: 1, sourceHeight: 1, crop: { x: 0, y: 0, width: 1, height: 1 } }), null);
});
