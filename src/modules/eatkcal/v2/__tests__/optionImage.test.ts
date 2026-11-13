// G35-S1 md.4 — seçenek görseli: öncelik (image_url → bağlı ürün → ada göre → boş hâl),
// eksik URL, veri katmanı (image_url kolonu yoksa eski sorguya düşer) ve migration
// eşleme sözleşmesi (58 kod, gramaj LIKE, tam eşleşme ayrımları, yalnız boş satırlar).
// Çalıştırma: npx tsx --test src/modules/eatkcal/v2/__tests__/optionImage.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { optionImageCandidates, primaryOptionImage } from '../model/optionImage';
import { fetchProductOptionGroups } from '../../../../lib/products';
import { groupOptionImageCandidates, isGramajGroup, isGramajGroupTitle, isGramajVariantName, isProteinSticker, OPTION_STICKER_BASE } from '../model/optionImage';

const STICKER = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/sos-ranch.webp';
const LINKED = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/ogun-1.jpg';
const BYNAME = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/ranch.jpg';

test('öncelik: image_url (çıkartma) → bağlı ürün görseli → ada göre ürün görseli', () => {
  assert.deepEqual(optionImageCandidates({ own: STICKER, linked: LINKED, byName: BYNAME }), [
    { uri: STICKER, kind: 'sticker' },
    { uri: LINKED, kind: 'photo' },
    { uri: BYNAME, kind: 'photo' },
  ]);
  assert.deepEqual(primaryOptionImage({ own: STICKER, linked: LINKED }), { uri: STICKER, kind: 'sticker' });
  assert.deepEqual(primaryOptionImage({ own: null, linked: LINKED, byName: BYNAME }), { uri: LINKED, kind: 'photo' });
  assert.deepEqual(primaryOptionImage({ byName: BYNAME }), { uri: BYNAME, kind: 'photo' });
});

test('eksik URL: null / boş / boşluk / "null" / göreli yol → aday sayılmaz; hiçbiri yoksa boş hâl', () => {
  for (const bad of [null, undefined, '', '   ', 'null', 'options/sos-ranch.webp']) {
    assert.deepEqual(optionImageCandidates({ own: bad as string | null, linked: bad as string | null }), []);
  }
  assert.equal(primaryOptionImage({}), null);
  // Kendi görseli eksikse bağlı ürüne düşer; kenar boşlukları kırpılır.
  assert.deepEqual(optionImageCandidates({ own: '  ', linked: `  ${LINKED}  ` }), [{ uri: LINKED, kind: 'photo' }]);
});

test('aynı adres iki kez gelirse tekrar edilmez (ilk tür korunur)', () => {
  assert.deepEqual(optionImageCandidates({ own: STICKER, linked: STICKER, byName: LINKED }), [
    { uri: STICKER, kind: 'sticker' },
    { uri: LINKED, kind: 'photo' },
  ]);
});

// ── Veri katmanı: sahte Supabase istemcisi ─────────────────────────────────
type Resp = { data: unknown; error: unknown };
function fakeClient(optionItems: (cols: string) => Resp) {
  const selects: string[] = [];
  const builder = (table: string) => {
    let cols = '';
    const q: Record<string, unknown> = {};
    const resolve = (): Resp => {
      if (table === 'product_option_groups') return { data: [{ id: 1, product_id: 7, group_id: 'g1', sort_order: 0 }], error: null };
      if (table === 'option_groups')
        return { data: [{ id: 'g1', name: 'Sos', description: '', min_selection: 0, max_selection: 1, is_required: false }], error: null };
      if (table === 'option_items') {
        selects.push(cols);
        return optionItems(cols);
      }
      return { data: [], error: null };
    };
    q.select = (c: string) => {
      cols = c;
      return q;
    };
    q.eq = () => q;
    q.in = () => q;
    q.order = () => q;
    q.then = (ok: (r: Resp) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, ko);
    return q;
  };
  return { client: { from: builder } as never, selects };
}

test('veri: image_url + bağlı ürün görseli (products.img) OptionItem alanlarına taşınır', async () => {
  const { client, selects } = fakeClient(() => ({
    data: [
      { id: 'a', group_id: 'g1', name: 'Ranch Sos', price_adjustment: 0, is_available: true, sort_order: 0, image_url: STICKER, linked_product_id: null, products: null },
      { id: 'b', group_id: 'g1', name: '1. Öğün', price_adjustment: 0, is_available: true, sort_order: 1, image_url: null, linked_product_id: 12, products: { id: 12, name: 'Öğün', img: LINKED, calories: 500 } },
    ],
    error: null,
  }));
  const groups = await fetchProductOptionGroups(client, '7');
  assert.equal(selects.length, 1);
  assert.match(selects[0], /image_url/);
  assert.match(selects[0], /products:linked_product_id\([^)]*img/);
  const [a, b] = groups[0].items;
  assert.equal(a.imageUrl, STICKER);
  assert.equal(a.linkedProductImageUrl, null);
  assert.equal(b.imageUrl, null);
  assert.equal(b.linkedProductImageUrl, LINKED);
  assert.equal(b.calories, 500);
});

test('veri: migration uygulanmadıysa (image_url kolonu yok) görselsiz sorguya düşer, sayfa kırılmaz', async () => {
  const { client, selects } = fakeClient((cols) =>
    cols.includes('image_url')
      ? { data: null, error: { code: '42703', message: 'column option_items.image_url does not exist' } }
      : { data: [{ id: 'a', group_id: 'g1', name: 'Ranch Sos', price_adjustment: 0, is_available: true, sort_order: 0, linked_product_id: null, products: null }], error: null },
  );
  const groups = await fetchProductOptionGroups(client, '7');
  assert.equal(selects.length, 2);
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[0].items[0].imageUrl, null);
  assert.deepEqual(
    optionImageCandidates({ own: groups[0].items[0].imageUrl, linked: groups[0].items[0].linkedProductImageUrl }),
    [],
  );
});

// ── Migration sözleşmesi ───────────────────────────────────────────────────
const MIG = readFileSync(join(__dirname, '../../../../../supabase/migrations/20261112120100_g35_option_images.sql'), 'utf8');
const RB = readFileSync(join(__dirname, '../../../../../supabase/rollbacks/20261112120100_g35_option_images_rollback.sql'), 'utf8');
const MAP = Array.from(MIG.matchAll(/\('((?:[^']|'')+)', '([a-z-]+)', '([egy])'\)/g)).map((m) => ({
  name: m[1].replace(/''/g, "'"),
  code: m[2],
  kind: m[3],
}));
// SQL'deki pg_temp.g35_option_code ile aynı kural (tam ad önce, sonra uzun ad).
const codeFor = (raw: string): string | null => {
  const n = raw.trim();
  const hits = MAP.filter(
    (m) =>
      n === m.name ||
      (m.kind === 'g' && n.startsWith(`${m.name} `)) ||
      (m.kind === 'y' && new RegExp(`^[0-9].* ${m.name}$`).test(n)),
  ).sort((x, y) => Number(n === y.name) - Number(n === x.name) || y.name.length - x.name.length);
  return hits[0]?.code ?? null;
};

test('migration: iki tabloya nullable image_url (idempotent) + rollback kolonları siler', () => {
  assert.match(MIG, /alter table public\.option_items\s+add column if not exists image_url text;/);
  assert.match(MIG, /alter table public\.product_option_template_values\s+add column if not exists image_url text;/);
  assert.doesNotMatch(MIG, /image_url text not null/);
  assert.match(RB, /alter table public\.option_items\s+drop column if exists image_url;/);
  assert.match(RB, /alter table public\.product_option_template_values\s+drop column if exists image_url;/);
});

test('migration: 58 farklı kod; yalnız image_url is null satırlar güncellenir; genel adres biçimi', () => {
  assert.equal(new Set(MAP.map((m) => m.code)).size, 58);
  assert.equal(MAP.length, 60); // Guacamole + Guacamole Sos, Ranch Sos + Ranch (şablon) — aynı görsel
  assert.equal((MIG.match(/where (oi|v)\.image_url is null/g) || []).length, 2);
  assert.match(MIG, /https:\/\/xtjakvinklthlvsfcncu\.supabase\.co\/storage\/v1\/object\/public\/images\/options\//);
});

test('migration eşlemesi: gramaj LIKE, tam eşleşme ayrımları, yumurta adetleri', () => {
  assert.equal(codeFor('Izgara Tavuk Bonfile 150g'), 'protein-tavuk-bonfile');
  assert.equal(codeFor('Izgara Tavuk Bonfile 350g'), 'protein-tavuk-bonfile');
  assert.equal(codeFor('Izgara Tavuk Bonfile'), 'protein-tavuk-bonfile');
  assert.equal(codeFor('Ton Balığı 120 gr'), 'protein-ton-baligi');
  assert.equal(codeFor('Salatalık'), 'sebze-salatalik');
  assert.equal(codeFor('Salatalık Turşu'), 'tursu-salatalik');
  assert.equal(codeFor('Lolorosso'), 'yesillik-lolorosso');
  assert.equal(codeFor('Akdeniz Lolorosso'), 'baz-akdeniz-lolorosso');
  assert.equal(codeFor('Basmati'), 'baz-basmati');
  assert.equal(codeFor('Basmati & Lolorosso Karışık'), 'baz-basmati-lolorosso');
  assert.equal(codeFor('Guacamole Sos'), 'meze-guacamole');
  assert.equal(codeFor('Guacamole'), 'meze-guacamole');
  assert.equal(codeFor('Ranch'), 'sos-ranch');
  assert.equal(codeFor('2 Yumurta'), 'protein-yumurta');
  assert.equal(codeFor('5 Yumurta'), 'protein-yumurta');
  // Eşleşmemesi gerekenler
  assert.equal(codeFor('Yumurta akı'), null);
  assert.equal(codeFor('Salatalık Turşusu'), null);
  assert.equal(codeFor('Roka Salatası'), null); // tam eşleşme türü LIKE kullanmaz
  assert.equal(codeFor('Basmati Üzeri Tavuk Fileto ve Brokoli'), null);
});

// ── G41-S1 md.4: bağlı/eşleşen ürün fotoğrafı önce; protein çıkartması yalnız gramaj grubunda ──

const KOFTE = `${OPTION_STICKER_BASE}protein-izgara-kofte.webp`;
const RANCH = `${OPTION_STICKER_BASE}sos-ranch.webp`;
const PHOTO = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/kofte-bowl.jpg';
const NAMEPHOTO = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/detoks.jpg';

test('G41: protein/şarküteri çıkartması tanınır; diğer çıkartma ve fotoğraf tanınmaz', () => {
  assert.equal(isProteinSticker(KOFTE), true);
  assert.equal(isProteinSticker(`${OPTION_STICKER_BASE}sarkuteri-hindi-fume.webp`), true);
  assert.equal(isProteinSticker(RANCH), false);
  assert.equal(isProteinSticker(PHOTO), false);
  assert.equal(isProteinSticker(null), false);
});

test('G41: gramaj grup başlığı', () => {
  assert.equal(isGramajGroupTitle('Et Gramajı'), true);
  assert.equal(isGramajGroupTitle('PROTEİN GRAMAJI'), true);
  assert.equal(isGramajGroupTitle('Ana Öğün Seçimi'), false);
  assert.equal(isGramajGroupTitle(null), false);
});

test('G41 hata (id 33/43 "Ana Öğün Seçimi"): bağlı ürün varsa ÜRÜN fotoğrafı; köfte çıkartması hiç yok', () => {
  const c = groupOptionImageCandidates({ own: KOFTE, linked: PHOTO, byName: null, gramajGroup: false });
  assert.deepEqual(c, [{ uri: PHOTO, kind: 'photo' }]);
});

test('G41: bağlı ürün yok ama ad bir ürünle eşleşiyor → o ürünün fotoğrafı önce, sonra (protein değilse) çıkartma', () => {
  assert.deepEqual(groupOptionImageCandidates({ own: KOFTE, byName: NAMEPHOTO, gramajGroup: false }), [{ uri: NAMEPHOTO, kind: 'photo' }]);
  assert.deepEqual(groupOptionImageCandidates({ own: RANCH, byName: NAMEPHOTO, gramajGroup: false }), [
    { uri: NAMEPHOTO, kind: 'photo' },
    { uri: RANCH, kind: 'sticker' },
  ]);
});

test('G41: gramaj dışı grupta yalnız protein çıkartması varsa → boş hâl; sos çıkartması kalır', () => {
  assert.deepEqual(groupOptionImageCandidates({ own: KOFTE, gramajGroup: false }), []);
  assert.deepEqual(groupOptionImageCandidates({ own: RANCH, gramajGroup: false }), [{ uri: RANCH, kind: 'sticker' }]);
});

test('G41: gramaj grubunda protein çıkartması korunur (G35/G38); bağlı ürün yine önce', () => {
  assert.deepEqual(groupOptionImageCandidates({ own: KOFTE, gramajGroup: true }), [{ uri: KOFTE, kind: 'sticker' }]);
  assert.deepEqual(groupOptionImageCandidates({ own: KOFTE, linked: PHOTO, byName: NAMEPHOTO, gramajGroup: true }), [
    { uri: PHOTO, kind: 'photo' },
    { uri: KOFTE, kind: 'sticker' },
    { uri: NAMEPHOTO, kind: 'photo' },
  ]);
});


test('G41: gramaj grubu = başlıkta "gramaj" YA DA bütün seçenekler gramaj/adet çeşidi; ürün adlı grup değil', () => {
  assert.equal(isGramajVariantName('Mortadella 50g'), true);
  assert.equal(isGramajVariantName('Izgara Tavuk Bonfile 150 gr'), true);
  assert.equal(isGramajVariantName('3 Yumurta'), true);
  assert.equal(isGramajVariantName('Izgara Köfte Bowl'), false);
  assert.equal(isGramajGroup('Fıstıklı Mortadella Salam Seçimi', ['Mortadella 50g', 'Mortadella 80g', 'Mortadella 100g']), true);
  assert.equal(isGramajGroup('Et Gramajı', []), true);
  assert.equal(isGramajGroup('Ana Öğün Seçimi', ['Izgara Köfte Bowl', 'Dengeli Izgara Köfte', 'Tavuk Fileto Bowl']), false);
  assert.equal(isGramajGroup('Ana Öğün Seçimi', ['Izgara Köfte Basmati ve Brokoli Sebze', 'Izgara Köfte 150g']), false);
  assert.equal(isGramajGroup('Protein', []), false);
});

test('G41 migration DOSYASI: yalnız bağlı ürünlü satırdaki protein çıkartması temizlenir, yedek + rollback var', () => {
  const root = join(__dirname, '../../../../..');
  const up = readFileSync(join(root, 'supabase/migrations/20261113100100_g41_option_image_fix.sql'), 'utf8');
  const down = readFileSync(join(root, 'supabase/rollbacks/20261113100100_g41_option_image_fix_rollback.sql'), 'utf8');
  assert.match(up, /YALNIZ DOSYA/);
  assert.match(up, /set image_url = null\s+where oi\.linked_product_id is not null\s+and oi\.image_url ~ '\/images\/options\/\(protein\|sarkuteri\)-/);
  assert.match(up, /_g41_option_image_backup/);
  assert.match(up, /enable row level security/);
  // Doldurma yalnız bağlı ürünsüz + boş satırlara.
  assert.match(up, /where oi\.image_url is null and oi\.linked_product_id is null/);
  assert.match(down, /set image_url = b\.image_url/);
  assert.match(down, /drop table public\._g41_option_image_backup/);
});
