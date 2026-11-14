// G53-S1 md.4 · G54-S1 md.7 — Paywall / T1 seçili plan kartı neon ışık: kip kuralı, geometri (kart kutusu, tek yol),
// 3 katman + degrade kuyruk, 7 sn sabit hız döngü.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  NEON_PERIOD_MS,
  NEON_TAIL,
  NEON_BASE_OPACITY,
  NEON_BLEED,
  neonGeometry,
  roundRectPath,
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

test('G54 ölçüler: tur 7 sn (G53 2,8 sn × 2,5), kuyruk çevrenin %30u, temel kenar 1,5 pt lime %35, geçiş 250 ms', () => {
  assert.equal(NEON_PERIOD_MS, 7000);
  assert.equal(NEON_TAIL, 0.3);
  assert.equal(NEON_STROKE, 1.5);
  assert.equal(NEON_BASE_OPACITY, 0.35);
  assert.equal(NEON_SWITCH_MS, 250);
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
  assert.equal(neonProgressAt(3500), 0.5);
  assert.equal(neonProgressAt(7000), 0);
  assert.ok(Math.abs(neonProgressAt(7000 * 7 + 1750) - 0.25) < 1e-9);
  const a = neonProgressAt(100) - neonProgressAt(0);
  const b = neonProgressAt(1100) - neonProgressAt(1000);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('hizalama: SVG kart kutusu + taşma payı; yol çizgi yarısı kadar içe, kartın köşe yarıçapıyla (−yarı); yol köşe yaylarını içerir', () => {
  for (const [w, h, r] of [[343, 96, 20], [398, 104, 26]] as const) {
    const g = neonGeometry(w, h, r);
    assert.equal(g.svgW, w + 2 * NEON_BLEED);
    assert.equal(g.svgH, h + 2 * NEON_BLEED);
    assert.equal(g.x, NEON_BLEED + NEON_STROKE / 2);
    assert.equal(g.y, NEON_BLEED + NEON_STROKE / 2);
    assert.equal(g.w, w - NEON_STROKE);
    assert.equal(g.h, h - NEON_STROKE);
    assert.equal(g.r, r - NEON_STROKE / 2);
    // Yolun dış sınırı (çizgi dahil) tam kart kenarında: x − yarı = taşma payı, x + w + yarı = taşma payı + kart eni.
    assert.equal(g.x - NEON_STROKE / 2, NEON_BLEED);
    assert.equal(g.x + g.w + NEON_STROKE / 2, NEON_BLEED + w);
    assert.equal(g.y + g.h + NEON_STROKE / 2, NEON_BLEED + h);
    // 4 köşe yayı yolun içinde (düz çubuk / köşesiz dikdörtgen yok).
    assert.equal((g.d.match(/A/g) ?? []).length, 4);
    assert.ok(Math.abs(g.perimeter - roundRectPerimeter(g.w, g.h, g.r)) < 1e-9);
  }
  assert.equal(roundRectPath(0, 0, 0, 10, 2), '');
});

test('kesik çizgi: ışığın BAŞI p·L noktasında, kuyruk geride; döngü sınırında atlama yok', () => {
  const L = 1000;
  const mod = (x: number) => ((x % L) + L) % L;
  // p = 0: çizgi −o = −len'den başlar → baş 0'da.
  assert.equal(neonDashOffset(0, L, NEON_TAIL), NEON_TAIL * L);
  assert.equal(mod(neonDashOffset(0.999999, L, NEON_TAIL)), mod(neonDashOffset(-0.000001, L, NEON_TAIL)));
  assert.ok(Math.abs(neonDashOffset(0.9, L, NEON_TAIL)) < L);
  assert.equal(neonDashOffset(0.5, 0, NEON_TAIL), 0);
  // Bütün katmanların başı aynı noktada: −o + len = p·L.
  for (const l of neonLayers(1)) assert.ok(Math.abs(mod(-neonDashOffset(0.37, L, l.len) + l.len * L) - 370) < 1e-6);
});

test('katmanlar: 3 tür (hale ≈10 pt · orta ≈5 pt · çekirdek 1,5–2 pt) + baş noktası; en uzun = kuyruk; kısa olan daha opak; açık temada hale daha az', () => {
  const dark = neonLayers(1);
  const light = neonLayers(0.45);
  assert.equal(dark.length, light.length);
  assert.ok(dark.some((l) => l.tone === 'halo' && l.w === 10));
  assert.ok(dark.some((l) => l.tone === 'mid' && l.w === 5));
  assert.ok(dark.filter((l) => l.tone === 'core').every((l) => l.w >= 1.5 && l.w <= 2));
  assert.equal(Math.max(...dark.map((l) => l.len)), NEON_TAIL);
  const cores = dark.filter((l) => l.tone === 'core').sort((x, y) => y.len - x.len);
  for (let i = 1; i < cores.length; i++) assert.ok(cores[i].opacity > cores[i - 1].opacity);
  const halo = (ls: typeof dark) => ls.filter((l) => l.tone === 'halo').reduce((a, l) => a + l.opacity, 0);
  assert.ok(halo(light) < halo(dark));
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
  // G54: tek açık yol (Rect yok), temel kenar ve ışık aynı `g.d` yolunu kullanır.
  assert.doesNotMatch(nb, /<Rect|AnimatedRect/);
  assert.match(nb, /<Path d=\{g\.d\} fill="none" stroke=\{colors\.base\}/);
  assert.match(nb, /<SegLayer key=\{i\} d=\{g\.d\}/);
  // UI thread: strokeDashoffset animatedProps + kare geri çağrısı (worklet), JS zamanlayıcısı yok.
  assert.match(nb, /useAnimatedProps\(\(\) => \(\{ strokeDashoffset: neonDashOffset/);
  assert.match(nb, /'worklet';\s*\n\s*p\.value = neonProgressAt\(f\.timestamp\)/);
  assert.doesNotMatch(nb, /setInterval/);
});
