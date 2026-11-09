// G18-S5 md.3 + md.9 — Final pano kabul ölçümü (her pano · uygulama çekimi).
//
// Ölçüt (G18-S5 md.9, G18-S1 yöntemi): piksel eşitliği DEĞİL — iki yana gaussian
// bulanıklık (σ 1,5) sonrası SSIM ≥ 0,80 ve dikey kayma ≤ 4 pt.
//  - Pano `design/final/png/<P>.webp`: 393 pt genişliğe ölçeklenir; çok kareli (Mo)
//    panolarda ilk telefon karesi (x 24, y 48, 393 × 852) kırpılır; FinTabBar şerit
//    panoları (≤ 120 pt) çekimin alt şeridiyle karşılaştırılır.
//  - Çekim (1206 × 2622) 393 pt genişliğe ölçeklenir.
//  - Durum çubuğu (üst 54 pt) hariç ilk ekran (54–852). Uygulama tarafında dikey
//    −12…+12 pt aranır; en iyi hizada SSIM (8 × 8 pencere) ve dy raporlanır.
//  - Bölgeler (aynı dy): üst 54–300 · orta 300–600 · alt 600–852 → en iyi bölge.
//
// Kullanım: npx tsx scripts/dev/g18-accept.ts <çekim_klasörü> [Pano …] > tablo.tsv
// Çıktı TSV: pano, bütün, dy, üst, orta, alt, enİyiBölge, durum
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';

const ROOT = resolve(__dirname, '../..');
const REF = process.env.G18_REF ?? resolve(ROOT, '../../night/design/final/png');
const APP = resolve(process.argv[2] ?? '.');
const TMP = join(tmpdir(), `g18-accept-${process.pid}`);
mkdirSync(TMP, { recursive: true });
const W = 393;
const SH = 852;
const TOP = 54;
const DY = 12;

type Img = { w: number; h: number; d: Float64Array };

function load(src: string, tag: string): Img {
  const dst = join(TMP, `${tag}.png`);
  execFileSync('sips', ['-s', 'format', 'png', src, '--out', dst], { stdio: 'ignore' });
  const png = PNG.sync.read(readFileSync(dst));
  const d = new Float64Array(png.width * png.height);
  for (let i = 0; i < d.length; i++) {
    const r = png.data[i * 4], g = png.data[i * 4 + 1], b = png.data[i * 4 + 2], a = png.data[i * 4 + 3] / 255;
    d[i] = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
  }
  return { w: png.width, h: png.height, d };
}

/** Alan ortalamasıyla yeniden örnekleme (kutu filtresi) — oran korunur, genişlik = W. */
function toWidth(img: Img, x0 = 0, y0 = 0, cw = img.w, ch = img.h): Img {
  const s = cw / W;
  const h = Math.round(ch / s);
  const d = new Float64Array(W * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < W; x++) {
      const sx0 = x0 + x * s, sy0 = y0 + y * s;
      let sum = 0, n = 0;
      for (let yy = Math.floor(sy0); yy < Math.min(img.h, Math.ceil(sy0 + s)); yy++) {
        for (let xx = Math.floor(sx0); xx < Math.min(img.w, Math.ceil(sx0 + s)); xx++) {
          sum += img.d[yy * img.w + xx];
          n++;
        }
      }
      d[y * W + x] = n ? sum / n : 255;
    }
  }
  return { w: W, h, d };
}

function blur(img: Img, sigma = 1.5): Img {
  const r = Math.ceil(sigma * 3);
  const k: number[] = [];
  let ks = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    ks += v;
  }
  const kn = k.map((v) => v / ks);
  const tmp = new Float64Array(img.d.length);
  const out = new Float64Array(img.d.length);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += kn[i + r] * img.d[y * img.w + Math.min(img.w - 1, Math.max(0, x + i))];
      tmp[y * img.w + x] = s;
    }
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += kn[i + r] * tmp[Math.min(img.h - 1, Math.max(0, y + i)) * img.w + x];
      out[y * img.w + x] = s;
    }
  return { w: img.w, h: img.h, d: out };
}

/** a[y0a..y1a) ↔ b[y0a+dy..) bölgesinde 8×8 pencereli ortalama SSIM. */
function ssim(a: Img, b: Img, y0: number, y1: number, dy: number): number {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, N = 8;
  let tot = 0, cnt = 0;
  for (let y = y0; y + N <= y1; y += N) {
    const by = y + dy;
    if (by < 0 || by + N > b.h || y + N > a.h) continue;
    for (let x = 0; x + N <= W; x += N) {
      let ma = 0, mb = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        ma += a.d[(y + j) * W + x + i];
        mb += b.d[(by + j) * W + x + i];
      }
      ma /= N * N;
      mb /= N * N;
      let va = 0, vb = 0, cv = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const p = a.d[(y + j) * W + x + i] - ma, q = b.d[(by + j) * W + x + i] - mb;
        va += p * p;
        vb += q * q;
        cv += p * q;
      }
      const n1 = N * N - 1;
      va /= n1; vb /= n1; cv /= n1;
      tot += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      cnt++;
    }
  }
  return cnt ? tot / cnt : 0;
}

function boardImg(p: string): { img: Img; strip: boolean } {
  const raw = load(join(REF, `${p}.webp`), `ref-${p}`);
  // Çok kareli (Mo, FinPush) panolar 1× dışa aktarım: ilk telefon karesi (x 24, y 48).
  if (raw.w >= 1000) return { img: toWidth(raw, 24, 48, W, SH), strip: false };
  const img = toWidth(raw);
  return { img, strip: img.h <= 140 };
}

const names = process.argv.slice(3).length
  ? process.argv.slice(3)
  : readdirSync(APP).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();

console.log(['pano', 'butun', 'dy', 'ust', 'orta', 'alt', 'enIyiBolge', 'durum'].join('\t'));
for (const p of names) {
  const shot = join(APP, `${p}.png`);
  if (!existsSync(join(REF, `${p}.webp`))) {
    console.log([p, '', '', '', '', '', '', 'pano-yok'].join('\t'));
    continue;
  }
  if (!existsSync(shot)) {
    console.log([p, '', '', '', '', '', '', 'cekim-yok'].join('\t'));
    continue;
  }
  try {
    const { img: refRaw, strip } = boardImg(p);
    const app = blur(toWidth(load(shot, `app-${p}`)));
    if (strip) {
      // Tab bar şeridi: panonun tamamı ↔ çekimin alt şeridi.
      const ref = blur(refRaw);
      let best = -1, bdy = 0;
      const base = app.h - ref.h;
      // Şerit: cihaz alt boşluğu (home indicator) farklı → ±40 pt aranır.
      for (let dy = -40; dy <= 40; dy++) {
        const v = ssim(ref, app, 0, ref.h, base + dy);
        if (v > best) { best = v; bdy = dy; }
      }
      console.log([p, best.toFixed(3), bdy, '', '', '', best.toFixed(3), best >= 0.8 && Math.abs(bdy) <= 4 ? 'UYUMLU' : 'FARK'].join('\t'));
      continue;
    }
    const ref = blur(refRaw);
    const y1 = Math.min(SH, ref.h);
    let best = -1, bdy = 0;
    for (let dy = -DY; dy <= DY; dy++) {
      const v = ssim(ref, app, TOP, y1, dy);
      if (v > best) { best = v; bdy = dy; }
    }
    // Bölge: her bant KENDİ en iyi hizasında (G18-S1 yöntemi: bileşen kutusu, dikey arama).
    const band = (a0: number, a1: number): [number, number] => {
      let bv = -1, bd = 0;
      for (let dy = -DY; dy <= DY; dy++) {
        const v = ssim(ref, app, a0, a1, dy);
        if (v > bv) { bv = v; bd = dy; }
      }
      return [bv, bd];
    };
    const bands = y1 > 600 ? [band(TOP, 300), band(300, 600), band(600, y1)] : [band(TOP, y1)];
    const fmt = ([v, d]: [number, number]) => `${v.toFixed(3)}@${d}`;
    const okBands = bands.filter(([v, d]) => v >= 0.8 && Math.abs(d) <= 4).length;
    const top = Math.max(...bands.map(([v]) => v));
    const ok = best >= 0.8 && Math.abs(bdy) <= 4;
    const status = ok ? 'UYUMLU' : okBands === bands.length ? 'BOLGE-UYUMLU' : okBands > 0 ? 'KISMI' : 'FARK';
    const pad = bands.map(fmt).concat(['', '', '']).slice(0, 3);
    console.log([p, best.toFixed(3), bdy, ...pad, top.toFixed(3), status].join('\t'));
  } catch (e) {
    console.log([p, '', '', '', '', '', '', `hata:${String((e as Error).message).slice(0, 40)}`].join('\t'));
  }
}
