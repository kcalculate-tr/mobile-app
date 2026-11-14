// G53/G54 → 15 Kas — Paywall / T1 seçili plan kartı neon kenarı: kip kuralı, gölge sözdizimi, kart kutusuna hizalı
// sabit kenar (dolaşan SVG ışık yok) ve sağ üstte aylık fiyat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NEON_BREATH_MIN, NEON_BREATH_MS, NEON_STROKE, NEON_SWITCH_MS, neonMode, neonShadow, rgba } from '../ui/neon';

const root = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('kip: seçili değil = yok; azaltılmış hareket / görünmüyor = sabit; aksi = nefes', () => {
  assert.equal(neonMode({ selected: false, reduced: false, visible: true }), 'off');
  assert.equal(neonMode({ selected: true, reduced: true, visible: true }), 'static');
  assert.equal(neonMode({ selected: true, reduced: false, visible: false }), 'static');
  assert.equal(neonMode({ selected: true, reduced: false, visible: true }), 'run');
});

test('ölçüler: 2 pt kenar, 250 ms geçiş, yavaş nefes', () => {
  assert.equal(NEON_STROKE, 2);
  assert.equal(NEON_SWITCH_MS, 250);
  assert.ok(NEON_BREATH_MS >= 1200);
  assert.ok(NEON_BREATH_MIN > 0.3 && NEON_BREATH_MIN < 1);
});

test('rgba + neon gölgesi: dış hale + dış çekirdek + içe ışıma, marka lime', () => {
  assert.equal(rgba('#B9EF14', 0.5), 'rgba(185,239,20,0.5)');
  assert.equal(rgba('#fff', 2), 'rgba(255,255,255,1)');
  const sh = neonShadow('#B9EF14', 1, 0.2);
  assert.equal(sh.split(', ').length, 3);
  assert.match(sh, /^0px 0px 22px 2px rgba\(185,239,20,0\.55\)/);
  assert.match(sh, /inset 0px 0px 12px 0px rgba\(185,239,20,0\.2\)$/);
  // açık temada hale daha az
  assert.match(neonShadow('#B9EF14', 0.5, 0), /rgba\(185,239,20,0\.275\)/);
});

test('NeonBorder: SVG/dolaşan ışık yok; kart kutusunda kenar + boxShadow; nefes UI thread (withRepeat)', () => {
  const nb = read('src/modules/subscription/ui/NeonBorder.tsx');
  assert.doesNotMatch(nb, /react-native-svg|useFrameCallback|setInterval/);
  assert.match(nb, /boxShadow: neonShadow\(/);
  assert.match(nb, /withRepeat\(withTiming\(NEON_BREATH_MIN/);
  assert.match(nb, /borderWidth: NEON_STROKE, borderColor: colors\.line/);
});

test('Paywall + T1: neon kenar yerinde; sağ üstte aylık fiyat büyük, yıllık tutar altında küçük', () => {
  const pw = read('src/modules/subscription/screens/PaywallScreen.tsx');
  assert.match(pw, /<NeonBorder selected=\{selected\} radius=\{20\} borderWidth=\{2\}/);
  assert.doesNotMatch(pw, /useNeonClock|monthPill/);
  assert.match(pw, /c\.yearly && c\.monthlyText \? c\.monthlyText : c\.priceText\}\$\{tr\('sub\.paywall\.per_month'\)/);
  assert.match(pw, /testID=\{`sub-billed-\$\{c\.key\}`\}/);
  const t1 = read('src/modules/kayit/screens/OfferScreen.tsx');
  assert.match(t1, /<NeonBorder selected=\{selected\} radius=\{26\} borderWidth=\{1\}/);
  assert.doesNotMatch(t1, /useNeonClock|kayit-offer-month/);
  assert.match(t1, /card\.yearly && card\.monthlyText \? card\.monthlyText : card\.priceText/);
  assert.match(t1, /testID="kayit-offer-billed"/);
});
