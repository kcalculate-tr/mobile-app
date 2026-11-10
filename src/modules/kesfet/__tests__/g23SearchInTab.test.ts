// G23-S1 md.4 — Keşfet araması sekmenin İÇİNDE (sekme çubuğu görünür, tasarımdaki gibi):
// sekmede `searchOpen` katmanı, yığında (derin bağlantı) bugünkü KesfetSearch rotası.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../ui/KesfetScreen.tsx'), 'utf8');
const search = fs.readFileSync(path.resolve(__dirname, '../ui/SearchScreen.tsx'), 'utf8');

test('Keşfet: sekmede arama katmanı, yığında KesfetSearch rotası', () => {
  assert.match(src, /onSearch=\{\(\) => \(asTab \? setSearchOpen\(true\) : navigation\.navigate\('KesfetSearch'\)\)\}/);
  assert.match(src, /<SearchScreen navigation=\{navigation\} onClose=\{closeSearch\} bottomInset=\{listBottomPad\} \/>/);
  // Geçiş token'la; azaltılmış harekette 200 ms opaklık.
  assert.match(src, /FadeIn\.duration\(reducedMotion \? REDUCED\.duration : DURATION\.fast\)/);
});

test('SearchScreen: onClose verilince Vazgeç ve Android geri onu çağırır', () => {
  assert.match(search, /onPress=\{\(\) => \(onClose \? onClose\(\) : navigation\.goBack\(\)\)\}/);
  assert.match(search, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(search, /paddingBottom: bottomInset \?\? insets\.bottom \+ 24/);
});
