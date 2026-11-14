// G53-S1 md.4 — Paywall / T1 seçili plan kartı neon ışık: kip kuralı, geometri, sabit hız döngü.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  NEON_PERIOD_MS,
  NEON_SEGMENT,
  NEON_STROKE,
  NEON_SWITCH_MS,
  neonDashOffset,
  neonLayers,
  neonMode,
  neonProgressAt,
  roundRectPerimeter,
} from '../ui/neon';

const root = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('kip: seçili değil = yok; azaltılmış hareket = sabit; görünmüyor = sabit (döngü durur); aksi = dolaşır', () => {
  assert.equal(neonMode({ selected: false, reduced: false, visible: true }), 'off');
  assert.equal(neonMode({ selected: false, reduced: true, visible: false }), 'off');
  assert.equal(neonMode({ selected: true, reduced: true, visible: true }), 'static');
  assert.equal(neonMode({ selected: true, reduced: false, visible: false }), 'static');
  assert.equal(neonMode({ selected: true, reduced: false, visible: true }), 'run');
});

test('ölçüler: tur 2,8 sn, parça çevrenin %25i, temel kenar 2 pt, geçiş 200 ms', () => {
  assert.equal(NEON_PERIOD_MS, 2800);
  assert.equal(NEON_SEGMENT, 0.25);
  assert.equal(NEON_STROKE, 2);
  assert.equal(NEON_SWITCH_MS, 200);
});

test('yuvarlak dikdörtgen çevresi', () => {
  // r = 0 → düz dikdörtgen
  assert.equal(roundRectPerimeter(100, 50, 0), 300);
  // tam daire (kare + r = yarı kenar) → 2πr
  assert.ok(Math.abs(roundRectPerimeter(40, 40, 20) - 2 * Math.PI * 20) < 1e-9);
  // r en/boyun yarısıyla sınırlı
  assert.equal(roundRectPerimeter(40, 40, 99), roundRectPerimeter(40, 40, 20));
  assert.equal(roundRectPerimeter(0, 10, 2), 0);
});

test('ilerleme sabit hızda ve kesintisiz (mod periyot)', () => {
  assert.equal(neonProgressAt(0), 0);
  assert.equal(neonProgressAt(1400), 0.5);
  assert.equal(neonProgressAt(2800), 0);
  assert.ok(Math.abs(neonProgressAt(2800 * 7 + 700) - 0.25) < 1e-9);
  // eşit zaman adımı → eşit ilerleme adımı (sabit hız)
  const a = neonProgressAt(100) - neonProgressAt(0);
  const b = neonProgressAt(1100) - neonProgressAt(1000);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('kesik çizgi kaydırması: merkez p·L noktasında; döngü sınırında atlama yok (desen L ile periyodik)', () => {
  const L = 400;
  const len = NEON_SEGMENT * L;
  // p = 0 → başlangıç = −len/2 (merkez yolun başında) → offset = len/2
  assert.equal(neonDashOffset(0, L, NEON_SEGMENT), len / 2);
  // p ve p+1 aynı görüntü (mod L)
  const mod = (x: number) => ((x % L) + L) % L;
  assert.equal(mod(neonDashOffset(0.999999, L, NEON_SEGMENT)), mod(neonDashOffset(-0.000001, L, NEON_SEGMENT)));
  // değer büyümez
  assert.ok(Math.abs(neonDashOffset(0.9, L, NEON_SEGMENT)) < L);
  assert.equal(neonDashOffset(0.5, 0, NEON_SEGMENT), 0);
});

test('katmanlar: sayı sabit (kanca sırası); en uzun parça %25; kısa olan daha opak (yumuşak uç); açık temada kontur', () => {
  const dark = neonLayers(1, false);
  const light = neonLayers(0.5, true);
  assert.equal(dark.length, light.length);
  assert.equal(Math.max(...dark.map((l) => l.len)), NEON_SEGMENT);
  const cores = dark.filter((l) => l.tone === 'core').sort((x, y) => y.len - x.len);
  for (let i = 1; i < cores.length; i++) assert.ok(cores[i].opacity >= cores[i - 1].opacity);
  assert.equal(dark.find((l) => l.tone === 'edge')!.opacity, 0);
  assert.ok(light.find((l) => l.tone === 'edge')!.opacity > 0);
  // açık temada glow daha az
  const g = (ls: typeof dark) => ls.filter((l) => l.tone === 'glow').reduce((n, l) => n + l.opacity, 0);
  assert.ok(g(light) < g(dark));
});

test('Paywall + T1: seçili kartta sabit lime kenar yerine NeonBorder; içerik (rozet, fiyat, radyo) yerinde', () => {
  const pw = read('src/modules/subscription/screens/PaywallScreen.tsx');
  assert.match(pw, /<NeonBorder selected=\{selected\} radius=\{20\}/);
  assert.doesNotMatch(pw, /borderColor: selected \? frame/);
  assert.match(pw, /useNeonClock\(!reduced && neonVisible && !result\)/);
  assert.match(pw, /styles\.radio, selected \? \{ backgroundColor: palette\.lime/);
  const t1 = read('src/modules/kayit/screens/OfferScreen.tsx');
  assert.match(t1, /<NeonBorder selected=\{selected\} radius=\{26\} borderWidth=\{1\}/);
  assert.match(t1, /useNeonClock\(!reducedMotion && neonVisible/);
  const nb = read('src/modules/subscription/ui/NeonBorder.tsx');
  // UI thread: strokeDashoffset animatedProps + kare geri çağrısı (worklet), JS zamanlayıcısı yok.
  assert.match(nb, /useAnimatedProps\(\(\) => \(\{ strokeDashoffset: neonDashOffset/);
  assert.match(nb, /'worklet';\s*\n\s*p\.value = neonProgressAt\(f\.timestamp\)/);
  assert.doesNotMatch(nb, /setInterval/);
});
