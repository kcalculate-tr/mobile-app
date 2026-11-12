// G38-S1 — veri ve metin sözleşmeleri (birim):
//   md.2 ad sadeleştirme migration'ı: yalnız id ile + eski ad korumalı, rollback birebir ters,
//        yeni adlarda hacim parantezi yok, seçenek kartında GERÇEK font ölçüsüyle ≤ 2 satır.
//   md.3 soslar: 5 ürün gizli eklenir, "(50cc)" yok, 40 TL; açma dosyası db push dışında ve
//        yalnız Adisyo eşlemesi olanları açar.
//   md.4 sözlükler: sepet sayısı / fiyat parantez içinde değil (TR + EN).
//   md.5 gramaj görseli: ürün adından G35 çıkartma kodu.
// Çalıştırma: npx tsx --test src/modules/eatkcal/v2/__tests__/g38Names.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { gramajImageCandidates, gramajStickerCode, OPTION_STICKER_BASE } from '../model/optionImage';
import { normalizeGramajOptions } from '../model/productModel';
import { translations as dictionaries } from '../../../../core/i18n/dictionaries';

const ROOT = join(__dirname, '../../../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const MIG = read('supabase/migrations/20261112140100_g38_urun_adlari.sql');
const RB = read('supabase/rollbacks/20261112140100_g38_urun_adlari_rollback.sql');
const SOS = read('supabase/migrations/20261112140200_g38_soslar.sql');
const SOS_RB = read('supabase/rollbacks/20261112140200_g38_soslar_rollback.sql');
const SOS_AC = 'supabase/migrations-manual/20261112T1403_g38_soslar_ac.sql';

// ── Font ölçümü (PlusJakartaSans SemiBold — OptionCard adı ekType.b15s) ──────────────
// Asgari TTF okuyucu: cmap (biçim 4/12) + hmtx ilerleme genişlikleri. Kerning yok sayılır;
// bu yüzden kart metin alanı 117 pt yerine 112 pt güvenlik payıyla ölçülür.
const TTF = readFileSync(
  join(ROOT, 'node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
);
const font = (() => {
  const b = TTF;
  const tables: Record<string, number> = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const o = 12 + i * 16;
    tables[b.toString('ascii', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const upm = b.readUInt16BE(tables.head + 18);
  const numH = b.readUInt16BE(tables.hhea + 34);
  const cm = tables.cmap;
  let sub = -1;
  let fmt = 0;
  for (let i = 0; i < b.readUInt16BE(cm + 2); i++) {
    const pid = b.readUInt16BE(cm + 4 + i * 8);
    const eid = b.readUInt16BE(cm + 6 + i * 8);
    const off = cm + b.readUInt32BE(cm + 8 + i * 8);
    const f = b.readUInt16BE(off);
    if (pid === 3 && (eid === 1 || eid === 10) && (sub < 0 || f === 12)) {
      sub = off;
      fmt = f;
    }
  }
  const gid = (c: number): number => {
    if (fmt === 12) {
      for (let i = 0; i < b.readUInt32BE(sub + 12); i++) {
        const s = b.readUInt32BE(sub + 16 + i * 12);
        const e = b.readUInt32BE(sub + 20 + i * 12);
        if (c >= s && c <= e) return b.readUInt32BE(sub + 24 + i * 12) + c - s;
      }
      return 0;
    }
    const segX2 = b.readUInt16BE(sub + 6);
    const ends = sub + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ros = deltas + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      if (c <= b.readUInt16BE(ends + i * 2)) {
        const s = b.readUInt16BE(starts + i * 2);
        if (c < s) return 0;
        const d = b.readInt16BE(deltas + i * 2);
        const ro = b.readUInt16BE(ros + i * 2);
        if (!ro) return (c + d) & 0xffff;
        const g = b.readUInt16BE(ros + i * 2 + ro + (c - s) * 2);
        return g ? (g + d) & 0xffff : 0;
      }
    }
    return 0;
  };
  const adv = (g: number) => b.readUInt16BE(tables.hmtx + 4 * Math.min(g, numH - 1));
  return { width: (s: string, size: number) => [...s].reduce((a, ch) => a + adv(gid(ch.codePointAt(0)!)), 0) * (size / upm) };
})();

/** Kelime kaydırmalı satır sayısı (RN Text gibi: sığmayan kelime alt satıra). */
function lineCount(text: string, size = 15, width = 112): number {
  let lines = 0;
  let cur = '';
  for (const w of text.split(' ')) {
    const cand = cur ? `${cur} ${w}` : w;
    if (!cur || font.width(cand, size) <= width) cur = cand;
    else {
      lines++;
      cur = w;
    }
  }
  return lines + (cur ? 1 : 0);
}

// ── Migration ayrıştırma ───────────────────────────────────────────────────────────
type Upd = { table: string; to: string; from: string; ids: string[] };
function parseUpdates(sql: string): Upd[] {
  const out: Upd[] = [];
  const re = /update public\.(\w+) set name = '((?:[^']|'')*)'\s*where (?:name = '((?:[^']|'')*)' and id = any\(array\[([^\]]*)\]::uuid\[\]|id = (\d+) and name = '((?:[^']|'')*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const un = (s: string) => s.replace(/''/g, "'");
    if (m[4] != null) {
      out.push({ table: m[1], to: un(m[2]), from: un(m[3]), ids: m[4].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean) });
    } else {
      out.push({ table: m[1], to: un(m[2]), from: un(m[6]), ids: [m[5]] });
    }
  }
  return out;
}
const UP = parseUpdates(MIG);
const DOWN = parseUpdates(RB);
const VOLUME = /\(\s*\d+([.,]\d+)?\s*(ml|cc|cl|lt|l|gr|g)\s*\)\s*$/i;

test('md.2 migration: 6 ürün + 31 seçenek adı güncellemesi, toplam 200 seçenek satırı; hepsi id ile ve eski ad korumalı', () => {
  const prods = UP.filter((u) => u.table === 'products');
  const opts = UP.filter((u) => u.table === 'option_items');
  assert.equal(prods.length, 6);
  assert.deepEqual(prods.map((p) => Number(p.ids[0])), [17, 18, 19, 20, 21, 22]);
  assert.equal(opts.length, 31);
  assert.equal(opts.reduce((a, o) => a + o.ids.length, 0), 200);
  for (const o of opts) for (const id of o.ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  // id'ler tekil (bir satır iki kez güncellenmez).
  const all = opts.flatMap((o) => o.ids);
  assert.equal(new Set(all).size, all.length);
  // Ada göre toplu güncelleme YOK — her update satırı id koşullu.
  const updates = MIG.match(/^update public\.[\s\S]*?;$/gm) ?? [];
  assert.equal(updates.length, 37);
  for (const u of updates) assert.match(u, /\bid = (any\(|\d)/);
  assert.doesNotMatch(MIG, /product_option_template_values\s+set/); // canlıda parantezli template adı yok
  assert.match(MIG, /^begin;/m);
  assert.match(MIG, /^commit;/m);
});

test('md.2 rollback birebir ters: aynı id kümeleri, yeni ad → eski ad', () => {
  assert.equal(DOWN.length, UP.length);
  const key = (u: Upd) => `${u.table}|${[...u.ids].sort().join(',')}`;
  const downBy = new Map(DOWN.map((d) => [key(d), d]));
  for (const u of UP) {
    const d = downBy.get(key(u));
    assert.ok(d, `rollback eksik: ${u.from}`);
    assert.equal(d!.from, u.to);
    assert.equal(d!.to, u.from);
  }
});

test('md.2 yeni adlar: hacim/gramaj parantezi yok; ürün adları KISALTILMAZ (yalnız parantez)', () => {
  for (const u of UP) assert.doesNotMatch(u.to, VOLUME, u.to);
  for (const p of UP.filter((x) => x.table === 'products')) {
    assert.equal(p.to, p.from.replace(VOLUME, '').trim());
  }
  assert.ok(UP.some((u) => u.to === 'Turuncu Metabolizma'));
  assert.ok(UP.some((u) => u.to === 'Fıstık Ezmeli Shake'));
});

test('md.1+2 seçenek kartı: kısalan her ad ≤ 26 karakter ve GERÇEK font ölçüsüyle ≤ 2 satır; eskiler 3+ satırdı', () => {
  const shortened = UP.filter((u) => u.table === 'option_items' && u.to !== u.from.replace(VOLUME, '').trim());
  assert.ok(shortened.length >= 20);
  for (const u of UP.filter((x) => x.table === 'option_items')) {
    assert.ok(u.to.length <= 26, `${u.to} (${u.to.length})`);
    assert.ok(lineCount(u.to) <= 2, `${u.to} → ${lineCount(u.to)} satır`);
  }
  // Grup içi tutarlılık için kısalan (kendisi sığan) kardeşler: "Dana Roastbeef 100g" 3 satır → grup "Roastbeef …".
  const SIBLINGS = new Set(['Dana Roastbeef 50g', 'Dana Roastbeef 80g']);
  for (const u of shortened.filter((x) => !SIBLINGS.has(x.from))) {
    assert.ok(lineCount(u.from.replace(VOLUME, '').trim()) >= 3, `${u.from} zaten sığıyordu`);
  }
  // Ölçer doğrulaması: bilinen örnekler.
  assert.equal(lineCount('Turuncu Metabolizma Hızlandırıcı'), 3);
  assert.equal(lineCount('Turuncu Metabolizma'), 2);
  assert.equal(lineCount('Ballı Hardal Sos'), 1);
});

test('md.2 aynı gruptaki seri adları ayırt edilir (Protein / Dengeli / Bowl) ve alerjen kelimesi korunur', () => {
  const to = (from: string) => UP.find((u) => u.from === from)?.to;
  assert.equal(to('Basmati Üzeri Tavuk Fileto ve Brokoli'), 'Protein Tavuk Fileto');
  assert.equal(to('Tavuk Fileto Basmati ve Brokoli Sebze'), 'Dengeli Tavuk Fileto');
  assert.equal(to('Brokoli Sebze Üzeri Tavuk Fileto Bowl'), 'Tavuk Fileto Bowl');
  assert.equal(to('Soya Soslu Tavuk Sote 150g'), 'Soya Soslu Sote 150g'); // soya
  assert.equal(to('Basmati Üzeri Tavuk Sote ve Brokoli'), to('Basmati Üzeri Tavuk Sote ve Brokoli Sebze'));
});

test('md.2 Adisyo listesi belgesi: 6 ürün adı, kodsuz ürün bölümü, 5 sos', () => {
  const doc = read('docs/night/G38-ADISYO-AD-LISTESI.md');
  for (const p of UP.filter((u) => u.table === 'products')) assert.ok(doc.includes(`| ${p.from} | ${p.to} |`), p.from);
  assert.match(doc, /Kodsuz ürünler/);
  for (const n of ['Acı Sweet Chili Sos', 'Ranch Sos', 'Ballı Hardal Sos', 'Remoulade Sos', 'Chipotle Sos']) assert.ok(doc.includes(n), n);
});

test('md.3 soslar migration: 5 ürün, "(50cc)" yok, 40 TL, kcalculate/Soslar, GİZLİ (is_available false), idempotent', () => {
  for (const n of ['Acı Sweet Chili Sos', 'Ranch Sos', 'Ballı Hardal Sos', 'Remoulade Sos', 'Chipotle Sos']) {
    assert.ok(SOS.includes(`('${n}',`), n);
  }
  assert.doesNotMatch(SOS.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n'), /50\s*cc\)/i);
  assert.match(SOS, /'50 cc', 40, 'Soslar', 'kcalculate'/);
  assert.match(SOS, /'meal', false,/);
  assert.match(SOS, /where not exists \(\s*select 1 from public\.products p where p\.brand = 'kcalculate' and p\.slug = v\.slug/);
  // Görsel: G35 çıkartmaları; Remoulade görselsiz + makrosuz.
  for (const code of ['sos-sweet-chili', 'sos-ranch', 'sos-balli-hardal', 'sos-chipotle']) assert.ok(SOS.includes(`${OPTION_STICKER_BASE}${code}.webp`));
  assert.match(SOS, /\('Remoulade Sos', 'remoulade-sos',\s*null,\s*null::smallint, null::numeric, null::numeric, null::numeric/);
  // Kategori burada eklenmez (boş ana sayfa döşemesi olmasın).
  assert.doesNotMatch(SOS, /insert into public\.categories/);
  assert.match(SOS_RB, /delete from public\.products/);
  assert.match(SOS_RB, /not exists \(select 1 from public\.order_items/);
});

test('md.3 açma dosyası db push DIŞINDA; yalnız merkez + Bayraklı eşlemesi olan sosları ve kategoriyi açar', () => {
  assert.ok(existsSync(join(ROOT, SOS_AC)));
  assert.ok(!existsSync(join(ROOT, 'supabase/migrations/20261112T1403_g38_soslar_ac.sql')));
  const ac = read(SOS_AC);
  assert.match(ac, /insert into public\.categories \(name, "order"\)\s*select 'Soslar', 55/);
  assert.match(ac, /set is_available = true/);
  assert.match(ac, /adisyo_product_unit_id is not null/);
  assert.match(ac, /branch_product_adisyo b/);
  assert.ok(existsSync(join(ROOT, 'supabase/migrations-manual/20261112T1403_g38_soslar_ac_rollback.sql')));
});

test('md.4 sözlükler: sepet sayısı / fiyat parantez içinde değil (TR + EN), sesli etiketler düz metin', () => {
  for (const lang of ['tr', 'en'] as const) {
    const d = dictionaries[lang] as any;
    const ek = d.eatkcal.v2;
    const vals = [
      ek.home.cart_count, ek.product.add_with_price, ek.cart.continue, ek.cart.continue_a11y,
      ek.checkout.basket_sum, ek.checkout.place, ek.checkout.complete, d.shell.cart_count, d.plan.shop_bought,
      d.plan.basket_cta, d.kesfet.detail.replies,
    ];
    for (const v of vals) {
      assert.equal(typeof v, 'string', `${lang}: eksik anahtar`);
      assert.doesNotMatch(v, /\(%\{\w+\}[^)]*\)/, `${lang}: ${v}`);
    }
    assert.equal(ek.home.cart_n, undefined); // "Sepet (N)" anahtarı kaldırıldı
  }
  const tr = dictionaries.tr as any;
  assert.equal(tr.shell.cart_count, 'Sepet, %{count} ürün');
  assert.equal(tr.eatkcal.v2.cart.continue, 'Siparişe devam');
  assert.equal(tr.eatkcal.v2.product.add_with_price, 'Sepete ekle, %{amount}');
});

test('md.4 eatkcal/plan/sesli kayıt modül sözlüklerinde de "(%{…})" sayı/fiyat kalıbı yok', () => {
  for (const f of [
    'src/modules/eatkcal/v2/i18n/home.ts',
    'src/modules/eatkcal/v2/i18n/cart.ts',
    'src/modules/eatkcal/v2/i18n/product.ts',
    'src/modules/plan/i18n.ts',
    'src/modules/ai/scan/voice/i18n.ts',
  ]) {
    assert.doesNotMatch(read(f), /\(%\{(count|amount|price|n)\}[^)]*\)/, f);
  }
});

test('md.5 gramaj çıkartması: ürün adından G35 protein kodu (özgül önce)', () => {
  assert.equal(gramajStickerCode('Basmati Üzeri Tavuk Fileto ve Brokoli'), 'protein-tavuk-bonfile');
  assert.equal(gramajStickerCode('Basmati Üzeri Tavuk Sote ve Brokoli Sebze'), 'protein-tavuk-sote');
  assert.equal(gramajStickerCode('Brokoli Sebze Üzeri Izgara Köfte Bowl'), 'protein-izgara-kofte');
  assert.equal(gramajStickerCode('IZGARA KÖFTE BASMATI'), 'protein-izgara-kofte');
  assert.equal(gramajStickerCode('Ton Balığı Salata'), 'protein-ton-baligi');
  assert.equal(gramajStickerCode('Dana Fajita Wrap'), 'protein-dana-fajita');
  assert.equal(gramajStickerCode('Falafel Bowl'), 'protein-falafel');
  assert.equal(gramajStickerCode('Dana Roastbeef Omlette Box'), 'sarkuteri-dana-roastbeef');
  assert.equal(gramajStickerCode('Brokoli Sebze Salata Bowl'), null);
  assert.equal(gramajStickerCode(''), null);
});

test('md.5 gramaj görsel adayları: kendi image_url → çıkartma → ürün fotoğrafı; hiçbiri yoksa boş', () => {
  const IMG = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/6.jpg';
  const OWN = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/ozel.webp';
  const st = `${OPTION_STICKER_BASE}protein-tavuk-bonfile.webp`;
  assert.deepEqual(gramajImageCandidates({ productName: 'Tavuk Fileto Basmati', productImg: IMG }), [
    { uri: st, kind: 'sticker' },
    { uri: IMG, kind: 'photo' },
  ]);
  assert.deepEqual(gramajImageCandidates({ own: OWN, productName: 'Tavuk Fileto Basmati', productImg: IMG }), [
    { uri: OWN, kind: 'sticker' },
    { uri: st, kind: 'sticker' },
    { uri: IMG, kind: 'photo' },
  ]);
  assert.deepEqual(gramajImageCandidates({ productName: 'Brokoli Salata', productImg: IMG }), [{ uri: IMG, kind: 'photo' }]);
  assert.deepEqual(gramajImageCandidates({ productName: 'Brokoli Salata', productImg: '' }), []);
});

test('md.5 normalizeGramajOptions: jsonb image_url taşınır, yoksa alan eklenmez (eski şekil korunur)', () => {
  const p = {
    gramaj_options: [
      { name: '200g', is_default: true, display_order: 0, price_modifier: 0 },
      { name: '300g', display_order: 1, price_modifier: 110, image_url: ' https://x.supabase.co/a.webp ' },
    ],
  } as any;
  const g = normalizeGramajOptions(p);
  assert.equal('image_url' in g[0], false);
  assert.equal(g[1].image_url, 'https://x.supabase.co/a.webp');
});
