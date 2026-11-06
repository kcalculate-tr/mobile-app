// G14-S1 — Karşılaştırma çifti: Final referansı (sol) + uygulama görüntüsü (sağ)
// aynı yükseklikte tek PNG. Çıktı: .claude/night/out/g14/pair/<Pano>.png
// Kullanım: npx tsx scripts/dev/g14-pair.ts [Pano ...]   (boş → app/ klasöründeki hepsi)
// Ortam: G14_REF (referans png klasörü), G14_H (yükseklik, varsayılan 1100)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

const ROOT = resolve(__dirname, '../..');
const OUT = join(ROOT, '.claude/night/out/g14');
const REF = process.env.G14_REF ?? resolve(ROOT, '../../night/design/final/png');
const H = Number(process.env.G14_H ?? 1100);
const TMP = join(tmpdir(), 'g14-pair');
mkdirSync(TMP, { recursive: true });
mkdirSync(join(OUT, 'pair'), { recursive: true });

function toPng(src: string, dst: string): PNG {
  execFileSync('sips', ['-s', 'format', 'png', '--resampleHeight', String(H), src, '--out', dst], {
    stdio: 'ignore',
  });
  return PNG.sync.read(readFileSync(dst));
}

const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(OUT, 'app'))
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.slice(0, -4));

for (const name of names) {
  const refSrc = join(REF, `${name}.webp`);
  const appSrc = join(OUT, 'app', `${name}.png`);
  if (!existsSync(refSrc) || !existsSync(appSrc)) {
    console.log(`atla ${name} (ref=${existsSync(refSrc)} app=${existsSync(appSrc)})`);
    continue;
  }
  const a = toPng(refSrc, join(TMP, `${name}-ref.png`));
  const b = toPng(appSrc, join(TMP, `${name}-app.png`));
  const gap = 16;
  const out = new PNG({ width: a.width + gap + b.width, height: H });
  out.data.fill(255);
  PNG.bitblt(a, out, 0, 0, a.width, Math.min(a.height, H), 0, 0);
  PNG.bitblt(b, out, 0, 0, b.width, Math.min(b.height, H), a.width + gap, 0);
  writeFileSync(join(OUT, 'pair', `${name}.png`), PNG.sync.write(out));
  console.log(`ok ${name}`);
}
