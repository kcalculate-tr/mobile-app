// G61-S1 md.1 — saf TS QR üreticinin doğruluk testi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr, formatBits, penaltyScore, pickVersion, qrPath, utf8Bytes } from '../qr';
import { GOLDEN } from './qrGolden';

function rowsHex(modules: boolean[][]): string[] {
  const n = modules.length;
  return modules.map((r) =>
    BigInt('0b' + r.map((c) => (c ? '1' : '0')).join('')).toString(16).padStart(Math.ceil(n / 4), '0'),
  );
}

test('altın matrisler: bağımsız uygulama ile modül modül aynı (v3 M, v7 Q, v10 L)', () => {
  for (const g of GOLDEN) {
    const m = encodeQr(g.text, { ecc: g.ecc, mask: g.mask });
    assert.equal(m.version, g.version, `${g.ecc} sürüm`);
    assert.equal(m.size, g.version * 4 + 17);
    assert.deepEqual(rowsHex(m.modules), [...g.rows], `${g.ecc} v${g.version} matris`);
  }
});

test('UTF-8: Türkçe karakterler iki bayt', () => {
  assert.deepEqual(utf8Bytes('ğ'), [0xc4, 0x9f]);
  assert.deepEqual(utf8Bytes('a€'), [0x61, 0xe2, 0x82, 0xac]);
  assert.deepEqual(utf8Bytes('😀'), [0xf0, 0x9f, 0x98, 0x80]);
});

test('sürüm seçimi: kısa bağlantılar küçük sürüm, çok uzun veri hata', () => {
  assert.equal(pickVersion(14, 'M'), 1);
  assert.equal(pickVersion(15, 'M'), 2);
  assert.equal(pickVersion(500, 'L'), null);
  assert.throws(() => encodeQr('x'.repeat(400)), /çok uzun/);
  // Davet bağlantısı (utm dahil) kartta okunur boyutta kalır.
  const inv = encodeQr('https://l.eatkcal.com/i/K7M2QX?utm_source=instagram');
  assert.ok(inv.version <= 4, `davet QR sürümü ${inv.version}`);
});

test('biçim bilgisi: BCH kodu geçerli ve her iki kopya matriste aynı', () => {
  // Bilinen değer (ISO 18004 Tablo C.1): M + maske 0 → 101010000010010
  assert.equal(formatBits('M', 0), 0b101010000010010);
  assert.equal(formatBits('L', 4), 0b110011000101111);
  const m = encodeQr('https://l.eatkcal.com/u/ilter', { ecc: 'Q' });
  const n = m.size;
  const bits = formatBits('Q', m.mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i < 8; i++) assert.equal(m.modules[8][n - 1 - i], bit(i), `kopya2 bit ${i}`);
  for (let i = 0; i <= 5; i++) assert.equal(m.modules[i][8], bit(i), `kopya1 bit ${i}`);
  assert.equal(m.modules[n - 8][8], true, 'koyu modül');
});

test('yapısal desenler: üç bulucu + zamanlama çizgisi', () => {
  const m = encodeQr('https://l.eatkcal.com/m/a1B2c3D4e5');
  const n = m.size;
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        assert.equal(m.modules[oy + y][ox + x], d !== 2, `bulucu ${ox},${oy} @${x},${y}`);
      }
  };
  finder(0, 0);
  finder(n - 7, 0);
  finder(0, n - 7);
  for (let i = 8; i < n - 8; i++) {
    assert.equal(m.modules[6][i], i % 2 === 0);
    assert.equal(m.modules[i][6], i % 2 === 0);
  }
});

test('otomatik maske en düşük ceza puanlısı', () => {
  const text = 'https://l.eatkcal.com/r/mercimek-corbasi';
  const auto = encodeQr(text);
  const best = Math.min(...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => penaltyScore(encodeQr(text, { mask: k }).modules)));
  assert.equal(penaltyScore(auto.modules), best);
});

test('qrPath: koyu modül sayısı yol alanına eşit', () => {
  const m = encodeQr('HELLO', { ecc: 'L' });
  const d = qrPath(m, 2);
  let area = 0;
  for (const seg of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) area += Number(seg[3]);
  const dark = m.modules.flat().filter(Boolean).length;
  assert.equal(area, dark);
  assert.match(d, /^M\d+ \d+h/);
});
