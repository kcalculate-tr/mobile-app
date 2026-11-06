// G14-S1 — Ekran vitrini ÜRETİM paketinde YOK.
//
// Kanıt iki katmanlı:
//  1) Kaynak: src/dev'e tek giriş App.tsx'te `__DEV__ ? require('./src/dev/VitrinGate')`
//     dalı; başka hiçbir üretim dosyası src/dev'i import etmez. Metro üretimde
//     `__DEV__`'i false'a katlar → dal ve modül grafiği paketten düşer.
//  2) Paket: `npx expo export --platform ios` çıktısı varsa (dist/), Hermes/JS
//     paketinde vitrin işaret dizgisi BULUNMAZ (scripts/dev/check-vitrin-bundle.sh).
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__' || ent.name.startsWith('__')) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

test('App.tsx: src/dev yalnız __DEV__ dalında require edilir', () => {
  const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  const refs = app.split('\n').filter((l) => l.includes('src/dev/') && !l.trim().startsWith('//'));
  assert.equal(refs.length, 1, 'App.tsx tek bir src/dev referansı içermeli');
  assert.match(refs[0], /require\('\.\/src\/dev\/VitrinGate'\)/);
  assert.match(app, /= __DEV__\s*\n?\s*\? require\('\.\/src\/dev\/VitrinGate'\)\.default\s*\n?\s*: null;/);
  assert.doesNotMatch(app, /^import .*src\/dev/m);
});

test('src/dev dışındaki hiçbir üretim dosyası src/dev import etmez', () => {
  const offenders = walk(path.join(ROOT, 'src'))
    .filter((f) => !f.includes(`${path.sep}src${path.sep}dev${path.sep}`))
    .filter((f) => /from ['"][./]+(?:\.\.\/)*dev\/|require\(['"][./]+dev\//.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('üretim paketi (varsa dist/) vitrin içermez', { skip: !fs.existsSync(path.join(ROOT, 'dist')) }, () => {
  const files: string[] = [];
  const stack = [path.join(ROOT, 'dist')];
  while (stack.length) {
    const d = stack.pop() as string;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (/\.(hbc|js)$/.test(ent.name)) files.push(p);
    }
  }
  for (const f of files) {
    const buf = fs.readFileSync(f);
    // NOT: 'dev/screen/' dizgisi linking.ts filtresinde üretimde de var → işaret olarak kullanılmaz.
    for (const marker of ['Vitrin: sahne yok', 'vitrin hata', 'dev-vitrin-user']) {
      assert.equal(buf.includes(marker), false, `${path.basename(f)} içinde "${marker}" var`);
    }
  }
});
