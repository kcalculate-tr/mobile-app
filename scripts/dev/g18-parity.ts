// G18-S4 md.7 — Bayrak KAPALI parite: taban dal (night17/camera) ile bu dalın aynı
// vitrin sahnesindeki (`Off-<Sekme>`, bütün bayraklar kapalı) çekimleri piksel piksel.
// Kullanım: npx tsx scripts/dev/g18-parity.ts <taban klasörü> <yeni klasör> Off-Tracker …
// Çıktı: pano, farklı piksel %, en büyük fark kutusu (varsa). Durum çubuğu (üst 160 px) hariç.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const [baseDir, headDir, ...names] = process.argv.slice(2);
const TOP = 160;
const TOL = 24;
console.log(['pano', 'farklı%', 'fark kutusu (x0,y0–x1,y1 px)'].join('\t'));
for (const n of names) {
  const a = join(baseDir, `${n}.png`);
  const b = join(headDir, `${n}.png`);
  if (!existsSync(a) || !existsSync(b)) {
    console.log([n, '-', 'çekim yok'].join('\t'));
    continue;
  }
  const A = PNG.sync.read(readFileSync(a));
  const B = PNG.sync.read(readFileSync(b));
  if (A.width !== B.width || A.height !== B.height) {
    console.log([n, '-', `boyut farklı ${A.width}x${A.height} / ${B.width}x${B.height}`].join('\t'));
    continue;
  }
  let diff = 0;
  let total = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = TOP; y < A.height; y++) {
    for (let x = 0; x < A.width; x++) {
      const i = (y * A.width + x) * 4;
      const d = Math.max(
        Math.abs(A.data[i] - B.data[i]),
        Math.abs(A.data[i + 1] - B.data[i + 1]),
        Math.abs(A.data[i + 2] - B.data[i + 2]),
      );
      total++;
      if (d > TOL) {
        diff++;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  const box = diff ? `${x0},${y0}–${x1},${y1}` : '—';
  console.log([n, ((diff / total) * 100).toFixed(3), box].join('\t'));
}
