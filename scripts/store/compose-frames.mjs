// G20-S2 md.4 — Başlıklı mağaza kareleri (ÖNERİ düzen; Final'de mağaza panosu yok).
//
// Girdi:  <OUT>/raw/<boyut>/<dil>/<id>.png  (store-shots.sh çıktısı)
// Çıktı:  <OUT>/final/<boyut>/<dil>/<id>.png  — boyut: ios-69 1320×2868 · ios-65 1242×2688 · android 1080×1920
// Araç:   Google Chrome başsız (yeni paket YOK). Yazı tipi: assets/fonts/BricolageGrotesque_*.ttf (uygulamadaki başlık fontu).
// Düzen:  siyah zemin, üstte başlık (beyaz) + alt satır (lime #B9EF14), altta ekran görüntüsü yuvarlatılmış köşeli.
//
// Kullanım: node scripts/store/compose-frames.mjs <OUT> [boyut…]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(process.argv[2] ?? join(ROOT, '.claude/night/out/store'));
const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cfg = JSON.parse(readFileSync(join(ROOT, 'scripts/store/captions.json'), 'utf8'));
const SIZES = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(cfg.sizes);
const LANGS = (process.env.STORE_LANGS ?? 'tr en').split(/\s+/).filter(Boolean);
const font = (w) => pathToFileURL(join(ROOT, `assets/fonts/BricolageGrotesque_${w}.ttf`)).href;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function html({ w, h, img, title, sub }) {
  const pad = Math.round(w * 0.07);
  const titleSize = Math.round(w * 0.072);
  const subSize = Math.round(w * 0.04);
  const shotW = Math.round(w * 0.84);
  const top = Math.round(h * 0.2);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:B;src:url(${font('700Bold')});font-weight:700}
@font-face{font-family:B;src:url(${font('500Medium')});font-weight:500}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#000}
.cap{position:absolute;left:${pad}px;right:${pad}px;top:${Math.round(h * 0.055)}px;text-align:center}
h1{font:700 ${titleSize}px/1.08 B;color:#fff;margin:0;letter-spacing:-0.02em;text-wrap:balance}
p{font:500 ${subSize}px/1.25 B;color:#B9EF14;margin:${Math.round(subSize * 0.6)}px 0 0}
.shot{position:absolute;top:${top}px;left:${Math.round((w - shotW) / 2)}px;width:${shotW}px;
border-radius:${Math.round(shotW * 0.09)}px;overflow:hidden;box-shadow:0 0 0 ${Math.max(2, Math.round(w * 0.004))}px #222}
.shot img{display:block;width:100%}
</style></head><body><div class="cap"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
<div class="shot"><img src="${pathToFileURL(img).href}"></div></body></html>`;
}

let made = 0;
for (const size of SIZES) {
  const s = cfg.sizes[size];
  if (!s) throw new Error(`bilinmeyen boyut: ${size}`);
  for (const lang of LANGS) {
    const rawDir = join(OUT, 'raw', size, lang);
    const finalDir = join(OUT, 'final', size, lang);
    mkdirSync(finalDir, { recursive: true });
    for (const f of cfg.frames) {
      const img = join(rawDir, `${f.id}.png`);
      if (!existsSync(img)) {
        console.warn(`yok: ${img}`);
        continue;
      }
      const page = join(finalDir, `${f.id}.html`);
      writeFileSync(page, html({ w: s.w, h: s.h, img, title: f.title[lang], sub: f.sub[lang] }));
      const png = join(finalDir, `${f.id}.png`);
      execFileSync(CHROME, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        '--allow-file-access-from-files', `--window-size=${s.w},${s.h}`, `--screenshot=${png}`, pathToFileURL(page).href,
      ], { stdio: 'ignore' });
      made += 1;
      console.log(`ok ${size}/${lang}/${f.id}.png`);
    }
  }
}
console.log(`${made} kare → ${join(OUT, 'final')}`);
