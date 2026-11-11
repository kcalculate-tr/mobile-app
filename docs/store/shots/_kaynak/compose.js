// Store screenshot compositor: headline on top + phone frame (HTML template -> PNG).
// Usage: node compose.js <phonesDir> <outRoot>
//   phonesDir: 1179x2556 frames from phone.js ({tr,en}-NN.png)
//   outRoot:   docs/store/shots  -> {ios,play}/{tr,en}/NN.png (6.9" = ios/{lang}/NN.png, 6.5" = ios/{lang}/65/NN.png, play feature.png)
const { chromium } = require('/Users/ilterozisseven/dev/kcal-research/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const LIME = '#C8F05A';
const INK = '#0A0A0A';

const COPY = {
  tr: [
    ['Fotoğraf çek, kaloriyi öğren', 'Yapay zekâ tabaktaki her yiyeceği ayırır, gramı sen düzeltirsin.'],
    ['Yaz, söyle ya da barkod okut', 'Fotoğraf istemeyen öğünler de saniyeler içinde günlüğünde.'],
    ['Günün tek bakışta', 'Kalori, makro ve su halkaları ana sayfanda.'],
    ['İzmir’de makrosu hesaplı öğün kapında', 'eatkcal mutfağından. Teslim edilen öğün günlüğüne kendiliğinden işlenir.'],
    ['Topluluktan tarif ve öğün keşfet', 'Beğendiğin tabağı tek dokunuşla gününe ekle.'],
    ['Fiyat baştan belli<br>7 gün ücretsiz', 'Yıllık planlarda 7 gün deneme. Ücretsiz planda günde 2 AI tarama.'],
  ],
  en: [
    ['Snap a photo, get calories', 'AI spots each food on your plate. You fine-tune the grams.'],
    ['Type, talk or scan a barcode', 'No photo? Log a meal in seconds anyway.'],
    ['Your day at a glance', 'Calorie, macro and water rings on your home screen.'],
    ['Track your progress', 'Eaten, burned and what’s left, every day.'],
    ['Discover meals from the community', 'Like a plate? Add it to your day in one tap.'],
    ['Clear prices<br>7 days free', '7-day free trial on yearly plans. Free plan: 2 AI scans a day.'],
  ],
};
const FEATURE = {
  tr: ['Hesabı biz yapıyoruz,', 'sen de görüyorsun.', 'AI kalori hesaplama · Fit yemek'],
  en: ['The calorie tracker', 'with a real kitchen behind it.', 'AI calorie counter · Photo food tracker'],
};

const SIZES = [
  { dir: 'ios', sub: '', w: 1320, h: 2868 }, // iPhone 6.9"
  { dir: 'ios', sub: '65', w: 1284, h: 2778 }, // iPhone 6.5"
  { dir: 'play', sub: '', w: 1080, h: 1920 }, // Play phone 9:16
];

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Plus+Jakarta+Sans:wght@500;600&display=swap">';

function page({ w, h, title, sub, img, dark, play }) {
  const pad = Math.round(w * 0.075);
  const hs = (play ? 0.082 : 0.088) * w;
  const ss = (play ? 0.034 : 0.036) * w;
  const pw = Math.round(w * (play ? 0.66 : 0.78));
  const bg = dark ? INK : LIME;
  const fg = dark ? '#FFFFFF' : INK;
  const subc = dark ? '#C7C7CC' : 'rgba(10,10,10,0.72)';
  const frame = dark ? '#2C2C2E' : INK;
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg}}
  .t{position:absolute;left:${pad}px;right:${pad}px;top:${Math.round(w * (play ? 0.07 : 0.1))}px;text-align:center}
  .mark{font-family:'Bricolage Grotesque';font-weight:700;font-size:${Math.round(w * 0.042)}px;color:${fg};letter-spacing:-0.02em;margin-bottom:${Math.round(w * 0.03)}px}
  .mark i{font-style:normal;color:${dark ? LIME : INK}}
  .dot{display:inline-block;width:.28em;height:.28em;border-radius:50%;background:${dark ? LIME : INK};margin-left:.04em}
  h1{margin:0;font-family:'Bricolage Grotesque';font-weight:700;font-size:${hs}px;line-height:1.02;letter-spacing:-0.025em;color:${fg};text-wrap:balance}
  p{margin:${Math.round(w * 0.028)}px auto 0;max-width:${Math.round(w * 0.78)}px;font-family:'Plus Jakarta Sans';font-weight:500;font-size:${ss}px;line-height:1.32;color:${subc};text-wrap:balance}
  .ph{position:absolute;left:50%;transform:translateX(-50%);width:${pw}px;border:${Math.round(pw * 0.014)}px solid ${frame};border-radius:${Math.round(pw * 0.085)}px;overflow:hidden;box-shadow:0 ${Math.round(w * 0.02)}px ${Math.round(w * 0.06)}px rgba(0,0,0,${dark ? 0.5 : 0.18})}
  .ph img{display:block;width:100%}
  </style></head><body>
  <div class="t"><div class="mark">kcal<span class="dot"></span></div><h1>${title}</h1><p>${sub}</p></div>
  <div class="ph" id="ph"><img src="${img}"></div>
  <script>
    window.place=()=>{const t=document.querySelector('.t').getBoundingClientRect();
    document.getElementById('ph').style.top=(t.bottom+${Math.round(w * 0.06)})+'px';};place();
  </script></body></html>`;
}

function feature({ lang, img }) {
  const [a, b, c] = FEATURE[lang];
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box}html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:${LIME}}
  .t{position:absolute;left:64px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center}
  .mark{font-family:'Bricolage Grotesque';font-weight:700;font-size:44px;color:${INK};letter-spacing:-0.02em;margin-bottom:22px}
  .dot{display:inline-block;width:.28em;height:.28em;border-radius:50%;background:${INK};margin-left:.04em}
  h1{margin:0;font-family:'Bricolage Grotesque';font-weight:700;font-size:50px;line-height:1.04;letter-spacing:-0.025em;color:${INK}}
  p{margin:20px 0 0;font-family:'Plus Jakarta Sans';font-weight:600;font-size:22px;color:rgba(10,10,10,.72)}
  .ph{position:absolute;right:72px;top:56px;width:290px;border:5px solid ${INK};border-radius:28px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.2)}
  .ph img{display:block;width:100%}
  </style></head><body>
  <div class="t"><div class="mark">kcal<span class="dot"></span></div><h1>${a}<br>${b}</h1><p>${c}</p></div>
  <div class="ph"><img src="${img}"></div></body></html>`;
}

(async () => {
  const phones = path.resolve(process.argv[2]);
  const outRoot = path.resolve(process.argv[3]);
  const tmp = path.join(phones, '_tpl');
  fs.mkdirSync(tmp, { recursive: true });
  const b = await chromium.launch();
  const render = async (html, w, h, out) => {
    const f = path.join(tmp, 'p.html');
    fs.writeFileSync(f, html);
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await pg.goto('file://' + f, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(300);
    await pg.evaluate(() => window.place && window.place());
    await pg.waitForTimeout(100);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await pg.screenshot({ path: out });
    await pg.close();
  };
  for (const lang of ['tr', 'en']) {
    for (let i = 0; i < 6; i++) {
      const nn = String(i + 1).padStart(2, '0');
      const img = path.join(phones, `${lang}-${nn}.png`);
      const [title, sub] = COPY[lang][i];
      for (const s of SIZES) {
        const out = path.join(outRoot, s.dir, lang, s.sub, `${nn}.png`);
        await render(page({ w: s.w, h: s.h, title, sub, img: 'file://' + img, dark: i % 2 === 1, play: s.dir === 'play' }), s.w, s.h, out);
      }
    }
    await render(feature({ lang, img: 'file://' + path.join(phones, `${lang}-03.png`) }), 1024, 500, path.join(outRoot, 'play', lang, 'feature.png'));
  }
  await b.close();
})();
