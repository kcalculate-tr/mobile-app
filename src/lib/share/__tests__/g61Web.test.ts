// G61-S1 md.4 — l.eatkcal.com önizleme işlevi (landing-page/api/share.js): og meta sınırları, kaçış,
// gizli/silinmiş → 404 + genel görsel, yönlendirmeler, AASA, statik OG görselleri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = join(__dirname, '../../../..');
const req = createRequire(__filename);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const share = req(join(ROOT, 'landing-page/api/share.js')) as {
  (r: unknown, s: unknown): Promise<void>;
  build: (k: string, id: string, d: unknown, lang: 'tr' | 'en') => { title: string; desc: string; card: string; gone?: boolean };
};

type Res = { statusCode: number; headers: Record<string, string>; body: string; setHeader: (k: string, v: string) => void; end: (b: string) => void };
function res(): Res {
  const r: Res = { statusCode: 0, headers: {}, body: '', setHeader: (k, v) => void (r.headers[k.toLowerCase()] = v), end: (b) => void (r.body = b) };
  return r;
}
const meta = (html: string, prop: string) => new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`).exec(html)?.[1] ?? null;

test('og:title ≤ 60, og:description ≤ 110, twitter:card summary_large_image, tür görseli', async () => {
  delete process.env.SUPABASE_URL;
  const long = 'Antrenman sonrası tavuklu kinoa kasesi. Sosu yoğurt, limon ve dereotuyla yaptım; tarifi gönderide. '.repeat(3);
  const b = share.build('post', 'x', { kind: 'post', author_name: 'Ayşe'.repeat(30), handle: 'ayse', text: long }, 'tr');
  assert.ok(b.title.length <= 60, `title ${b.title.length}`);
  assert.ok(b.desc.length <= 110, `desc ${b.desc.length}`);
  const r = res();
  await share({ query: { k: 'm', id: 'aB3dE5fG7h' }, headers: { 'accept-language': 'en-US' } }, r);
  assert.equal(r.statusCode, 200); // önizleme alınamadı → genel kart (yok DEMEZ)
  assert.equal(meta(r.body, 'twitter:card'), 'summary_large_image');
  assert.equal(meta(r.body, 'og:image'), 'https://l.eatkcal.com/og/meal-en.png');
  assert.match(r.body, /<html lang="en">/);
  assert.match(r.body, /href="kcal:\/\/m\/aB3dE5fG7h"/);
  assert.match(r.body, /apps\.apple\.com\/app\/id6763964912/);
});

test('HTML kaçışı ve yalnız https görseller', () => {
  const b = share.build('post', 'x', { kind: 'post', author_name: '<script>x</script>', text: '"><img onerror=1>', image: 'javascript:alert(1)' }, 'tr');
  assert.doesNotMatch(b.card, /<script>|onerror=1>|javascript:/);
  assert.match(b.card, /&lt;script&gt;/);
});

test('gizli / silinmiş / iptal → "Bu içerik artık yok", 404, genel marka görseli', async () => {
  const b = share.build('meal', 'x', { kind: 'meal', gone: true }, 'tr');
  assert.equal(b.gone, true);
  const r = res();
  await share({ query: { k: 's', id: 'IZM01' }, headers: {} }, r); // saha kodu biçimli /s/ → geçersiz
  assert.equal(r.statusCode, 404);
  assert.match(r.body, /Bu içerik artık yok/);
  assert.equal(meta(r.body, 'og:image'), 'https://l.eatkcal.com/og/default-tr.png');
});

test('kart verisi gizlilik: gün kartında hedef/toplam rakamı yok; sayaç yok', () => {
  const d = share.build('day', 'x', { pct: 76, meals: 3, protein: 98, waterL: 1.8, goal: 2100, dayTotal: 1650 }, 'tr');
  assert.doesNotMatch(d.card, /2100|1650/);
  assert.match(d.card, /%76/);
  const p = share.build('post', 'x', { kind: 'post', author_name: 'A', text: 't', likes: 999 }, 'tr');
  assert.doesNotMatch(p.card, /999/);
});

test('vercel.json: 8 tür → /api/share; /s/ yalnız UUID; AASA ve OG görselleri', () => {
  const v = JSON.parse(readFileSync(join(ROOT, 'landing-page/vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[] };
  for (const k of ['p', 'u', 'r', 'i', 'm', 'd', 'x']) {
    assert.ok(v.rewrites.some((r) => r.source === `/${k}/:id` && r.destination === `/api/share?k=${k}&id=:id`), k);
  }
  assert.ok(v.rewrites.some((r) => r.source.startsWith('/s/:id([0-9a-fA-F]{8}-') && r.destination.includes('k=s')));
  const aasa = JSON.parse(readFileSync(join(ROOT, 'landing-page/.well-known/apple-app-site-association'), 'utf8'));
  const paths = aasa.applinks.details[0].components.map((c: { '/': string }) => c['/']);
  for (const p of ['/p/*', '/u/*', '/r/*', '/i/*', '/m/*', '/d/*', '/x/*', '/s/*']) assert.ok(paths.includes(p), p);
  for (const k of ['post', 'profile', 'recipe', 'invite', 'meal', 'day', 'xray', 'story', 'default'])
    for (const l of ['tr', 'en']) assert.ok(existsSync(join(ROOT, `landing-page/og/${k}-${l}.png`)), `${k}-${l}.png`);
});
