// G15-S6 — Tabanı olmayan (NOBASE) panolar için Final referansına kaba benzerlik ölçüsü.
// Her iki görüntü 40×86 gri ölçeğe indirilir (kutu ortalaması); ölçü = ortalama |Δ|/255 (%).
// Düşük = yapısal olarak yakın. Sıralı liste → en yüksekler gözle incelenir.
// Çıktı: .claude/night/out/g15/ref.tsv
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

const ROOT = resolve(__dirname, '../..');
const APP = join(ROOT, '.claude/night/out/g15/app');
const REF = resolve(ROOT, '../../night/design/final/png');
const TMP = join(tmpdir(), 'g15-ref');
mkdirSync(TMP, { recursive: true });
const W = 40, H = 86;

function small(png: PNG): number[] {
  const out: number[] = [];
  for (let by = 0; by < H; by++) {
    for (let bx = 0; bx < W; bx++) {
      const x0 = Math.floor((bx * png.width) / W), x1 = Math.floor(((bx + 1) * png.width) / W);
      const y0 = Math.floor((by * png.height) / H), y1 = Math.floor(((by + 1) * png.height) / H);
      let s = 0, n = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const i = (y * png.width + x) * 4;
        s += 0.3 * png.data[i] + 0.59 * png.data[i + 1] + 0.11 * png.data[i + 2];
        n++;
      }
      out.push(n ? s / n : 0);
    }
  }
  return out;
}
function load(path: string, key: string): PNG {
  const dst = join(TMP, key + '.png');
  execFileSync('sips', ['-s', 'format', 'png', '--resampleHeight', '800', path, '--out', dst], { stdio: 'ignore' });
  return PNG.sync.read(readFileSync(dst));
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(APP).filter((n) => n.endsWith('.png')).map((n) => n.replace(/\.png$/, ''));
const rows: [string, number][] = [];
for (const name of names) {
  const refPath = ['webp', 'png'].map((e) => join(REF, `${name}.${e}`)).find(existsSync);
  if (!refPath) continue;
  const a = small(load(join(APP, `${name}.png`), 'a-' + name));
  const b = small(load(refPath, 'r-' + name));
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  rows.push([name, (100 * d) / (a.length * 255)]);
}
rows.sort((x, y) => y[1] - x[1]);
writeFileSync(join(ROOT, '.claude/night/out/g15/ref.tsv'), rows.map(([n, d]) => `${n}\t${d.toFixed(2)}`).join('\n') + '\n');
console.log(rows.slice(0, 40).map(([n, d]) => `${n} ${d.toFixed(1)}`).join('\n'));
