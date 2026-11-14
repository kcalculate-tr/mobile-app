#!/usr/bin/env node
// G54-S1 md.4b — Mutfak görsellerini yerleştir: docs/tur28/mutfaklar/<anahtar>.jpg → assets/kayit/cuisines/<anahtar>.jpg
// ve src/modules/kayit/cuisineImages.ts eşleme tablosunu YALNIZ var olan dosyalarla yeniden yazar.
// Kullanım (repo kökünde): node scripts/sync-cuisine-images.mjs [kaynak_klasör]
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const KEYS = ['turk', 'akdeniz', 'ege', 'italyan', 'yunan', 'ispanyol', 'fransiz', 'ortadogu', 'hint', 'cin', 'japon', 'kore', 'tay', 'vietnam', 'meksika', 'latin', 'amerikan', 'balkan'];
const root = resolve(new URL('..', import.meta.url).pathname);
const src = resolve(process.argv[2] ?? join(root, 'docs/tur28/mutfaklar'));
const dst = join(root, 'assets/kayit/cuisines');
mkdirSync(dst, { recursive: true });
const present = [];
const missing = [];
for (const k of KEYS) {
  const from = join(src, `${k}.jpg`);
  const to = join(dst, `${k}.jpg`);
  if (existsSync(from)) copyFileSync(from, to);
  if (existsSync(to)) present.push(k);
  else missing.push(k);
}
const lines = present.map((k) => `  ${k}: require('../../../assets/kayit/cuisines/${k}.jpg'),`).join('\n');
const header = `// G54-S1 md.4b — Mutfak kartı görselleri eşleme tablosu. BU DOSYA ÜRETİLİR: \`node scripts/sync-cuisine-images.mjs\`
// \`docs/tur28/mutfaklar/<anahtar>.jpg\` (1080×1350) dosyalarını \`assets/kayit/cuisines/\` altına kopyalar ve yalnız
// VAR OLAN dosyalar için \`require\` satırı yazar (eksik dosya Metro'da hata vermez → kart sakin degradeyle çizilir).
// Görsel yoksa: kartın zemini mutfağa özel degrade (CUISINE_GRADIENT, mevcut paletten).
import type { ImageSourcePropType } from 'react-native';
import type { KCuisine } from './model';
`;
writeFileSync(join(root, 'src/modules/kayit/cuisineImages.ts'), `${header}\nexport const CUISINE_IMAGES: Partial<Record<KCuisine, ImageSourcePropType>> = {\n${lines || '  // (görsel yok)'}\n};\n`);
console.log(`görsel: ${present.length}/${KEYS.length}${missing.length ? ` · eksik: ${missing.join(', ')}` : ''}`);
