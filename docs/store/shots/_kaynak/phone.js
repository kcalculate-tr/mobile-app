// Renders Final design boards (.dc.html) to 3x phone frames for store screenshots.
// Usage: node phone.js dump|render <outDir>
// Boards are served from a scratch copy at http://127.0.0.1:8765/ (never the design source).
const { chromium } = require('/Users/ilterozisseven/dev/kcal-research/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const SHOTS = require('./shots.js');

const BASE = 'http://127.0.0.1:8765/';
const mode = process.argv[2] || 'dump';
const outDir = process.argv[3] || path.join(__dirname, 'out');

async function prep(page, s) {
  await page.goto(BASE + s.board, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(s.wait || 2600);
  await page.evaluate((s) => {
    const walk = (fn) => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (w.nextNode()) nodes.push(w.currentNode);
      nodes.forEach(fn);
    };
    // 1) photo placeholders -> real food photo
    for (const [label, img] of Object.entries(s.photos || {})) {
      walk((n) => {
        if (!n.nodeValue.trim().startsWith(label)) return;
        const span = n.parentElement;
        let box = span.parentElement;
        // climb to the element that owns the grey background
        for (let i = 0; i < 4 && box; i++) {
          const bg = getComputedStyle(box).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && box.offsetHeight > 80) break;
          box = box.parentElement;
        }
        if (!box) return;
        box.style.backgroundImage = `url(${img})`;
        box.style.backgroundSize = 'cover';
        box.style.backgroundPosition = 'center';
        Array.from(box.children).forEach((c) => {
          if (c.tagName !== 'svg' || c.querySelector('path[d^="M48"]') == null) {
            if (c.contains(span) || c === span) c.style.visibility = 'hidden';
          }
        });
        span.style.visibility = 'hidden';
      });
    }
    // 2) exact/substring text replacements (in order)
    for (const [from, to] of s.replace || []) {
      walk((n) => {
        if (n.nodeValue.includes(from)) n.nodeValue = n.nodeValue.split(from).join(to);
      });
    }
    // 2b) sequential replacements: each occurrence gets the next value
    for (const [from, vals] of Object.entries(s.seqReplace || {})) {
      const q = vals.slice();
      walk((n) => {
        if (n.nodeValue.includes(from) && q.length) n.nodeValue = n.nodeValue.split(from).join(q.shift());
      });
    }
    // 3) remaining [N] in DOM order, only inside the crop
    const seq = (s.nSeq || []).slice();
    walk((n) => {
      if (!n.nodeValue.includes('[N]')) return;
      const r = n.parentElement.getBoundingClientRect();
      if (r.top > (s.cropH || 852)) return;
      n.nodeValue = n.nodeValue.replace(/\[N\]/g, () => (seq.length ? seq.shift() : '·'));
    });
    // 4) hide elements by visible text
    for (const t of s.hide || []) {
      walk((n) => {
        if (n.nodeValue.trim() === t) {
          let el = n.parentElement;
          for (let i = 0; i < (s.hideUp || 0); i++) el = el.parentElement;
          el.style.visibility = 'hidden';
        }
      });
    }
    if (s.css) {
      const st = document.createElement('style');
      st.textContent = s.css;
      document.head.appendChild(st);
    }
    // 5) layout hook for tall boards (e.g. coach chat: crop to one phone screen)
    if (s.js) new Function(s.js)();
  }, s);
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 1100 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  fs.mkdirSync(outDir, { recursive: true });
  const only = process.argv[4];
  for (const s of SHOTS) {
    if (only && s.id !== only) continue;
    await prep(page, s);
    if (mode === 'dump') {
      const items = await page.evaluate((cropH) => {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const out = [];
        while (w.nextNode()) {
          const n = w.currentNode;
          const v = n.nodeValue.trim();
          if (!v || !/\[|·/.test(v)) continue;
          const r = n.parentElement.getBoundingClientRect();
          if (r.top <= cropH && r.width > 0) out.push(`${Math.round(r.top)}:${Math.round(r.left)} ${v}`);
        }
        return out;
      }, s.cropH || 852);
      console.log('==', s.id, s.board);
      console.log(items.join('\n'));
    }
    const clipY = s.clipY || 0;
    await page.screenshot({ path: path.join(outDir, s.id + '.png'), clip: { x: 0, y: clipY, width: 393, height: 852 } });
  }
  await browser.close();
})();
