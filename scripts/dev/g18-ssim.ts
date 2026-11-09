// G18-S3 — Final panosu ↔ uygulama çekimi ÖLÇÜLÜ karşılaştırma (bölge SSIM).
//
// Her iki görüntü 393×852 gri ölçeğe indirilir (sips + pngjs). Bölgeler (393×852
// pano koordinatı): durum çubuğu (0–54) HARİÇ; üst 54–300, orta 300–600, alt 600–852,
// bütün 54–852. Her bölgede 8×8 pencereli SSIM ortalaması (C1/C2 standart).
// Uyum % = bütün SSIM × 100. Panodaki örnek veri ([N], fotoğraf) yüzünden %100
// beklenmez; düzen/ölçü farkı bölge değerinde düşüş olarak görünür.
//
// Kullanım: npx tsx scripts/dev/g18-ssim.ts <app_dir> [Pano ...]   (boş → app_dir'deki hepsi)
// Ortam: G18_REF (Final png klasörü). Çıktı: stdout TSV (pano, üst, orta, alt, bütün).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

const ROOT = resolve(__dirname, '../..');
const REF = process.env.G18_REF ?? resolve(ROOT, '../../night/design/final/png');
const APP = resolve(process.argv[2] ?? join(ROOT, '.claude/night/out/g18-s3/app'));
const TMP = join(tmpdir(), 'g18-ssim');
mkdirSync(TMP, { recursive: true });
// G18_SCALE: 1 = piksel (metin/fotoğraf dahil), 4 = yerleşim (98×213; bloklar, boşluklar,
// renk alanları). Bölge sınırları pano koordinatında, ölçeğe bölünür.
const SC = Number(process.env.G18_SCALE ?? 4);
const W = Math.round(393 / SC);
const H = Math.round(852 / SC);
const Y = (v: number) => Math.round(v / SC);

function gray(src: string, tag: string): Float64Array {
  const dst = join(TMP, `${tag}.png`);
  execFileSync('sips', ['-s', 'format', 'png', '-z', String(H), String(W), src, '--out', dst], { stdio: 'ignore' });
  const png = PNG.sync.read(readFileSync(dst));
  const out = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = png.data[i * 4], g = png.data[i * 4 + 1], b = png.data[i * 4 + 2], a = png.data[i * 4 + 3] / 255;
    // saydam kenarları beyaz say (pano köşeleri)
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
  }
  return out;
}

function ssim(a: Float64Array, b: Float64Array, y0: number, y1: number): number {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, S = SC >= 4 ? 4 : 8;
  let sum = 0, n = 0;
  for (let y = y0; y + S <= y1; y += S) {
    for (let x = 0; x + S <= W; x += S) {
      let ma = 0, mb = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const k = (y + j) * W + x + i;
        ma += a[k];
        mb += b[k];
      }
      ma /= S * S;
      mb /= S * S;
      let va = 0, vb = 0, cov = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const k = (y + j) * W + x + i;
        va += (a[k] - ma) ** 2;
        vb += (b[k] - mb) ** 2;
        cov += (a[k] - ma) * (b[k] - mb);
      }
      va /= S * S - 1;
      vb /= S * S - 1;
      cov /= S * S - 1;
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      n++;
    }
  }
  return n ? sum / n : 0;
}

const names = process.argv.slice(3).length
  ? process.argv.slice(3)
  : readdirSync(APP).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();

console.log(['pano', 'ust', 'orta', 'alt', 'butun'].join('\t'));
for (const name of names) {
  const ref = join(REF, `${name}.webp`);
  const app = join(APP, `${name}.png`);
  if (!existsSync(ref) || !existsSync(app)) {
    console.log(`${name}\t-\t-\t-\tYOK`);
    continue;
  }
  const a = gray(ref, `${name}-ref-${SC}`);
  const b = gray(app, `${name}-app-${SC}`);
  const f = (v: number) => (v * 100).toFixed(1);
  console.log([name, f(ssim(a, b, Y(54), Y(300))), f(ssim(a, b, Y(300), Y(600))), f(ssim(a, b, Y(600), H)), f(ssim(a, b, Y(54), H))].join('\t'));
}
