// G18-S4 md.7 — Final panosu (design/final/png/<Pano>.webp) ↔ vitrin çekimi piksel uyumu.
// İkisi de 393 pt genişliğe ölçeklenir; durum çubuğu (üst 54 pt) hariç ortak yükseklikte
// her pikselin en büyük kanal farkı ≤ 24 ise "aynı" sayılır. Uyum % = aynı / toplam.
// Çok kareli (geniş) panolar (en-boy oranı telefondan çok farklı) ölçülmez: "çok kareli".
// Kullanım: npx tsx scripts/dev/g18-diff.ts <çekim klasörü> Pano [Pano ...]
// Çıktı: TSV satırları (pano, uyum%, ölçülen yükseklik, not) stdout'a.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

const ROOT = resolve(__dirname, '../..');
const REF = process.env.G18_REF ?? resolve(ROOT, '../../night/design/final/png');
const [appDir, ...names] = process.argv.slice(2);
const W = 393;
const TOP = 54;
const TOL = 24;
const TMP = join(tmpdir(), 'g18-diff');
mkdirSync(TMP, { recursive: true });

function load(src: string, dst: string): PNG {
  execFileSync('sips', ['-s', 'format', 'png', '--resampleWidth', String(W), src, '--out', dst], { stdio: 'ignore' });
  return PNG.sync.read(readFileSync(dst));
}

function refName(pano: string): string {
  // EN çekimleri: FinFeedEmptyEN → FinFeedEmpty (EN panosu yoksa; metin EN, yerleşim aynı).
  if (existsSync(join(REF, `${pano}.webp`))) return pano;
  return pano.replace(/EN$/, '');
}

console.log(['pano', 'uyum%', 'yükseklik', 'not'].join('\t'));
for (const pano of names) {
  const refSrc = join(REF, `${refName(pano)}.webp`);
  const appSrc = join(appDir, `${pano}.png`);
  if (!existsSync(refSrc) || !existsSync(appSrc)) {
    console.log([pano, '-', '-', `yok (ref=${existsSync(refSrc)} app=${existsSync(appSrc)})`].join('\t'));
    continue;
  }
  const a = load(refSrc, join(TMP, `${pano}-ref.png`));
  const b = load(appSrc, join(TMP, `${pano}-app.png`));
  // Şerit panolar (FinTabBar-*: 393 × 100): çekimin ALT şeridiyle karşılaştırılır.
  if (a.height <= 140) {
    const off = b.height - a.height;
    let s = 0;
    let n = 0;
    for (let y = 0; y < a.height; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const j = ((y + off) * W + x) * 4;
        const d = Math.max(
          Math.abs(a.data[i] - b.data[j]),
          Math.abs(a.data[i + 1] - b.data[j + 1]),
          Math.abs(a.data[i + 2] - b.data[j + 2]),
        );
        if (d <= TOL) s++;
        n++;
      }
    }
    console.log([pano, ((s / n) * 100).toFixed(1), String(a.height), 'şerit: çekimin alt 100 pt’si'].join('\t'));
    continue;
  }
  // Çok kareli panolar (924 yük., kareler 393 genişlikte x=24, y=48'den başlar):
  // yerel ölçekte İLK telefon karesi kırpılır ve onunla ölçülür.
  let ref = a;
  let frameNote = '';
  if (a.width / a.height > 0.7) {
    const raw = join(TMP, `${pano}-raw.png`);
    execFileSync('sips', ['-s', 'format', 'png', refSrc, '--out', raw], { stdio: 'ignore' });
    const full = PNG.sync.read(readFileSync(raw));
    if (full.height < 900 || full.width < 24 + W) {
      console.log([pano, '-', String(full.height), 'geniş pano (kare düzeni farklı) — piksel ölçümü yok'].join('\t'));
      continue;
    }
    const fh = 852;
    ref = new PNG({ width: W, height: fh });
    PNG.bitblt(full, ref, 24, 48, W, fh, 0, 0);
    frameNote = 'çok kareli: 1. kare';
  }
  const aRef = ref;
  // G18_MAXY: yalnız üst bölgeyi ölç (ör. veri bağımlı alanların üstü — başlık/şerit/metin).
  const maxY = Number(process.env.G18_MAXY ?? 0);
  const h = Math.min(aRef.height, b.height, maxY > 0 ? maxY : Infinity);
  let same = 0;
  let total = 0;
  // G18_MINY: yalnız alt bölge (ör. Tara: simülatör kamerası siyah, pano gri yer tutucu → yalnız kontrol paneli).
  const minY = Math.max(TOP, Number(process.env.G18_MINY ?? 0));
  for (let y = minY; y < h; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.max(
        Math.abs(aRef.data[i] - b.data[i]),
        Math.abs(aRef.data[i + 1] - b.data[i + 1]),
        Math.abs(aRef.data[i + 2] - b.data[i + 2]),
      );
      if (d <= TOL) same++;
      total++;
    }
  }
  const note = frameNote || (aRef.height > b.height * 1.15 ? `pano uzun (${aRef.height}); ilk ${h} pt ölçüldü` : '');
  console.log([pano, ((same / total) * 100).toFixed(1), String(h), note].join('\t'));
}
