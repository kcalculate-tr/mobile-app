// G17-S2 md.2/4 — çekim boyutu (uzun kenar ≤ 1600) ve barkod doğrulama. SAF.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPTURE_MAX_EDGE,
  CAPTURE_QUALITY,
  SCAN_BARCODE_TYPES,
  normalizeBarcode,
  pickPictureSize,
  upcEToUpcA,
} from '../camera';

test('çekim: kalite 0.5, uzun kenar 1600', () => {
  assert.equal(CAPTURE_QUALITY, 0.5);
  assert.equal(CAPTURE_MAX_EDGE, 1600);
});

test('pickPictureSize: Android listesi → 4:3 ve ≤ 1600 olanların en büyüğü', () => {
  const sizes = ['4000x3000', '1920x1080', '1600x1200', '1440x1080', '1280x960', '640x480'];
  assert.equal(pickPictureSize(sizes), '1600x1200');
});

test('pickPictureSize: iOS ön ayarları + boyutlar → 1280x720 (≤1600; 4:3 büyük yok)', () => {
  const ios = ['3840x2160', '1920x1080', '1280x720', '640x480', '352x288', 'Photo', 'High', 'Medium', 'Low'];
  assert.equal(pickPictureSize(ios), '1280x720');
});

test('pickPictureSize: seçilen boyutun uzun kenarı hiçbir zaman 1600’ü aşmaz', () => {
  const sizes = ['1920x1440', '1700x1275', '1600x900', '1024x768'];
  const s = pickPictureSize(sizes)!;
  const [w, h] = s.split('x').map(Number);
  assert.ok(Math.max(w, h) <= 1600, s);
  assert.equal(s, '1024x768');
});

test('pickPictureSize: uygun boyut yoksa undefined (cihaz varsayılanı)', () => {
  assert.equal(pickPictureSize(['Photo', 'High']), undefined);
  assert.equal(pickPictureSize(['4032x3024']), undefined);
  assert.equal(pickPictureSize([]), undefined);
  assert.equal(pickPictureSize(null), undefined);
});

test('barkod türleri: EAN-13/8, UPC-A/E', () => {
  assert.deepEqual([...SCAN_BARCODE_TYPES], ['ean13', 'ean8', 'upc_a', 'upc_e']);
});

test('normalizeBarcode: geçerli EAN-13 / EAN-8 / UPC-A kabul, bozuk sağlama red', () => {
  assert.equal(normalizeBarcode('ean13', '4006381333932'), null); // yanlış sağlama
  assert.equal(normalizeBarcode('ean13', '4006381333931'), '4006381333931');
  assert.equal(normalizeBarcode('org.gs1.EAN-13', '4006381333931'), '4006381333931'); // iOS tür adı
  assert.equal(normalizeBarcode('ean8', '96385074'), '96385074');
  assert.equal(normalizeBarcode('ean8', '96385075'), null);
  assert.equal(normalizeBarcode('upc_a', '036000291452'), '036000291452');
  assert.equal(normalizeBarcode('upc_a', '036000291453'), null);
});

test('normalizeBarcode: UPC-E genişletilip doğrulanır', () => {
  assert.equal(upcEToUpcA('04252614'), '042100005264');
  assert.equal(normalizeBarcode('upc_e', '04252614'), '04252614');
  assert.equal(normalizeBarcode('upc_e', '04252615'), null);
});

test('normalizeBarcode: desteklenmeyen tür / harf / boş → null (sahte sonuç yok)', () => {
  assert.equal(normalizeBarcode('qr', '4006381333931'), null);
  assert.equal(normalizeBarcode('ean13', 'ABC'), null);
  assert.equal(normalizeBarcode('ean13', ''), null);
});
