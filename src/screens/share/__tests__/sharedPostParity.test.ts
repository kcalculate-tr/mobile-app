// G15-S3 — bayrak kapalı parite: `kesfet` kapalıyken derin bağlantı gönderi ekranı
// Keşfet'in (Final'e giydirilen) kartını DEĞİL, night14/visual'dan dondurulmuş
// kopyayı çizer. Dondurulmuş dosyalar Keşfet bileşenlerini (PostCard/MealCard/
// MediaGrid/Avatar/ActivityCard) import etmez — yalnız değişmeyen yardımcıları.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(DIR, p), 'utf8');

test('SharedPostScreen: bayrak kapalı yol dondurulmuş kartı kullanır', () => {
  const src = read('SharedPostScreen.tsx');
  assert.match(src, /import \{ PostCard \} from '\.\/legacy\/LegacyPostCard';/);
  assert.doesNotMatch(src, /from '\.\.\/\.\.\/modules\/kesfet\/ui\/PostCard'/);
  assert.match(src, /return kesfet \? <KesfetPostDetail \/> : <LegacySharedPostScreen \/>;/);
});

test('dondurulmuş kopyalar güncel Keşfet kart bileşenlerine bağlanmaz', () => {
  for (const f of ['LegacyPostCard', 'LegacyMealCard', 'LegacyMediaGrid', 'LegacyAvatar', 'LegacyActivityCard']) {
    const src = read(`legacy/${f}.tsx`);
    assert.match(src, /DONDURULMUŞ KOPYA \(night14\/visual\)/, f);
    assert.doesNotMatch(src, /modules\/kesfet\/ui\/(PostCard|MealCard|MediaGrid|Avatar|ActivityCard|PlateMedia)'/, f);
  }
});
