// G40-S1 md.5 — "tek marka yeşili #B9EF14" koruma testi.
//
// Uygulamanın tek lime'ı `src/core/design/tokens.ts › palette.lime` (#B9EF14);
// `src/constants/theme.ts › COLORS.brand.green` aynı değeri ORADAN okur (hex kopyası
// yok). Eski soluk lime (hex ve rgb bileşenleri) `src` altında hiçbir biçimde
// kalmamalı: büyük/küçük harf, 8 haneli alfa ekli hex, `rgba(r, g, b, a)` boşluklu
// ya da boşluksuz.
//
// İSTİSNA (LEGACY): yalnız bayrak KAPALI yolda çizilen 1.0.7 dosyaları — orada değer
// değişirse "bayrak kapalı = bugünkü uygulama, bayt bayt" kuralı bozulur. Her dosya
// tam eşleşme SAYISIYLA kayıtlı: sayı artarsa test kırılır. G-TEMİZLİK bu dosyaları
// siler; liste o gün boşalır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { palette } from '../../core/design/tokens';
import { COLORS } from '../../constants/theme';

const SRC = path.resolve(__dirname, '../..');

// Desenler parçalı yazıldı: bu dosya kendi taramasına takılmasın.
const OLD_HEX = new RegExp('#' + 'C6F0' + '4F', 'i');
const OLD_RGB = new RegExp('\\b' + '198' + '\\s*,\\s*' + '240' + '\\s*,\\s*' + '79' + '\\b');
const OLD_HEX_BARE = new RegExp('(?:0x|\\b)' + 'C6F0' + '4F', 'i');

/** Bayrak kapalı (eski kabuk) yolun 1.0.7 dosyaları → izinli eşleşme sayısı. */
const LEGACY: Record<string, number> = {
  'modules/eatkcal/screens/CheckoutScreen.tsx': 2, // eski ödeme ekranı (yeni_siparis kapalı / paynkolay dışı)
  'components/PrivilegedBadge.tsx': 1, // yalnız eski CheckoutScreen kullanır
  'components/modals/MacroPointModal.tsx': 1, // yalnız eski ProfileScreen / MacroScreen
  'screens/profile/SupportScreen.tsx': 1, // ProfileSupport bayrak kapalı yolu (v2ScreenFor)
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?|json|snap|html|svg|css)$/.test(n)) out.push(p);
  }
  return out;
}

function hits(src: string): number {
  let n = 0;
  for (const line of src.split('\n')) {
    if (OLD_HEX.test(line) || OLD_RGB.test(line) || OLD_HEX_BARE.test(line)) n++;
  }
  return n;
}

test('palette.lime tek marka yeşili #B9EF14; brandLime takma adı yok', () => {
  assert.equal(palette.lime, '#B9EF14');
  assert.equal('brandLime' in palette, false, 'ayrı brandLime anahtarı kalmamalı — palette.lime kullan');
  assert.equal(palette.limeInk, '#0A0A0A', 'lime üstündeki metin/ikon her temada siyah');
  assert.equal(palette.limeLineOnLight, '#4A6B00', 'açık zeminde lime çizgi/metin rengi değişmez');
});

test('constants/theme marka yeşili token\'dan okunur (hex kopyası yok)', () => {
  assert.equal(COLORS.brand.green, palette.lime);
  assert.equal(COLORS.brand.greenBright, palette.lime);
  assert.equal(COLORS.brand.greenTicker, '#BAF112', 'kayan bant tonu ayrı kalır');
  const src = fs.readFileSync(path.join(SRC, 'constants/theme.ts'), 'utf8');
  assert.match(src, /import \{ palette \} from '\.\.\/core\/design\/tokens'/);
  assert.match(src, /\bgreen: palette\.lime,/);
  assert.match(src, /\bgreenBright: palette\.lime,/);
  assert.doesNotMatch(src, /green(Bright)?: '#B9EF14'/i);
});

test('src altında eski lime yok (hex / alfa ekli hex / rgb bileşenleri); yalnız LEGACY listesi', () => {
  const self = path.resolve(__filename);
  const bad: string[] = [];
  const seenLegacy: Record<string, number> = {};
  for (const f of walk(SRC)) {
    if (path.resolve(f) === self) continue;
    const n = hits(fs.readFileSync(f, 'utf8'));
    if (!n) continue;
    const r = path.relative(SRC, f).split(path.sep).join('/');
    if (r in LEGACY) {
      seenLegacy[r] = n;
      if (n > LEGACY[r]) bad.push(`${r}: ${n} (izinli ${LEGACY[r]})`);
    } else {
      bad.push(`${r}: ${n}`);
    }
  }
  assert.deepEqual(bad, [], 'eski lime → palette.lime (ya da SVG/HTML string\'de #B9EF14, rgba(185, 239, 20, a))');
  for (const [r, n] of Object.entries(LEGACY)) {
    assert.ok(fs.existsSync(path.join(SRC, r)), `LEGACY dosyası yok, listeden çıkar: ${r}`);
    assert.equal(seenLegacy[r] ?? 0, n, `LEGACY sayısı değişti, listeyi güncelle: ${r}`);
  }
});

test('desen kendini doğrular (8 haneli alfa, küçük harf, boşluklu rgba yakalanır)', () => {
  const h = '#' + 'c6f0' + '4f';
  assert.equal(hits(`a: '${h}80'`), 1);
  assert.equal(hits(`a: '${h.toUpperCase()}'`), 1);
  assert.equal(hits(`a: 'rgba(${'198'}, ${'240'}, ${'79'}, 0.3)'`), 1);
  assert.equal(hits(`a: 'rgba(${'198'},${'240'},${'79'},0.3)'`), 1);
  assert.equal(hits(`a: '#B9EF14', b: 'rgba(185, 239, 20, 0.3)'`), 0);
});
