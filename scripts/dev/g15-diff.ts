// G15-S6 — Yeni çekimler (out/g15/app) ↔ S1–S5'in SON çekimleri piksel karşılaştırması.
// Her pano için ../g15-s{1..5}/.claude/night/out/** altındaki en yeni <Pano>.png (pair/ klasörleri hariç)
// bulunur; fark oranı = |Δkanal|>24 olan piksel yüzdesi (üst 120 px durum çubuğu hariç).
// Çıktı: .claude/night/out/g15/diff.tsv  (pano, taban, oran%, durum)  durum: same(<0.5) / small(<3) / DIFF
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';

const ROOT = resolve(__dirname, '../..');
const APP = join(ROOT, '.claude/night/out/g15/app');
const WT = resolve(ROOT, '..');

function walk(dir: string, acc: { path: string; mtime: number }[]) {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (/pair/i.test(n)) continue;
      walk(p, acc);
    } else if (n.endsWith('.png')) acc.push({ path: p, mtime: st.mtimeMs });
  }
}

const newest = new Map<string, { path: string; mtime: number }>();
for (const s of ['g15-s1', 'g15-s2', 'g15-s3', 'g15-s4', 'g15-s5']) {
  const acc: { path: string; mtime: number }[] = [];
  walk(join(WT, s, '.claude/night/out'), acc);
  for (const f of acc) {
    const name = f.path.split('/').pop()!.replace(/\.png$/, '');
    const cur = newest.get(name);
    if (!cur || f.mtime > cur.mtime) newest.set(name, f);
  }
}

const rows: string[] = [];
let same = 0, small = 0, diff = 0, nobase = 0;
for (const f of readdirSync(APP).filter((n) => n.endsWith('.png')).sort()) {
  const name = f.replace(/\.png$/, '');
  const base = newest.get(name);
  if (!base) { rows.push(`${name}\t-\t-\tNOBASE`); nobase++; continue; }
  const a = PNG.sync.read(readFileSync(join(APP, f)));
  const b = PNG.sync.read(readFileSync(base.path));
  if (a.width !== b.width || a.height !== b.height) { rows.push(`${name}\t${base.path.replace(WT + '/', '')}\t-\tSIZE`); diff++; continue; }
  let n = 0, tot = 0;
  for (let y = 120; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      tot++;
      if (Math.abs(a.data[i] - b.data[i]) > 24 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 24 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) n++;
    }
  }
  const pct = (100 * n) / tot;
  const st = pct < 0.5 ? 'same' : pct < 3 ? 'small' : 'DIFF';
  if (st === 'same') same++; else if (st === 'small') small++; else diff++;
  rows.push(`${name}\t${base.path.replace(WT + '/', '')}\t${pct.toFixed(2)}\t${st}`);
}
writeFileSync(join(ROOT, '.claude/night/out/g15/diff.tsv'), rows.join('\n') + '\n');
console.log(`same ${same} · small ${small} · DIFF ${diff} · nobase ${nobase}`);
