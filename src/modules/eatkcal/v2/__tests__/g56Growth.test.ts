// G56-S1 — eatkcal ana sayfa sipariş artırma bölümleri: saf kurallar.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { FILTERS, FILTER_THRESHOLDS, PLAN_MATCH } from '../growth/config';
import {
  applyListSource,
  bannerVisible,
  filterChips,
  inviteVisible,
  kcalPicks,
  kcalSectionState,
  matchPlanItems,
  planReorder,
  rebuildReorderLine,
  reorderUnavailable,
  reorderVisible,
  topRows,
  type PlanItemLike,
  type ReorderLine,
} from '../growth/rules';
import {
  normalizeReferralCode,
  parseApplyResult,
  parseMyReferral,
  referralCodeLooksValid,
  referralShareText,
  visibleHistory,
} from '../growth/referral';
import { bannerTargetToEk } from '../model/homeData';
import { FLAG_DEFAULTS } from '../../../../core/flags/registry';
import type { OptionGroup, Product } from '../../../../types';

const P = (id: number, o: Partial<Product> = {}): Product => ({ id, name: `P${id}`, price: 100, is_available: true, in_stock: true, ...o });

const CATALOG: Product[] = [
  P(1, { category: "Bowl's", calories: 540, protein: 42, carbs: 48 }),
  P(2, { category: 'Yüksek Protein', calories: 480, protein: 38, carbs: 12 }),
  P(3, { category: 'Dengeli ve Sağlıklı', calories: 220, protein: 12, carbs: 30 }),
  P(4, { category: 'Detoks & Shake', calories: 160, protein: 14, carbs: 9 }),
  P(5, { category: 'Soslar', calories: 40, protein: 0, carbs: 2 }),
  P(6, { category: 'Omlette Box', calories: 320, protein: 18, carbs: 10 }),
  P(7, { category: "Wrap's", calories: 820, protein: 62, carbs: 78 }),
  P(8, { category: "Bowl's", calories: 380, protein: 31, carbs: 20, in_stock: false }),
];

// ── 1) Çipler + filtre ──────────────────────────────────────────────────────
test('çipler: tasarım sırası, verisi olmayan (vegan, tatlı) gizli, eşikler 30 g / 20 g', () => {
  assert.deepEqual(FILTERS.map((f) => f.key), ['all', 'high_protein', 'under_500', 'vegan', 'low_carb', 'dessert', 'drinks']);
  assert.deepEqual(filterChips().map((f) => f.key), ['all', 'high_protein', 'under_500', 'low_carb', 'drinks']);
  assert.equal(FILTER_THRESHOLDS.highProteinMinG, 30);
  assert.equal(FILTER_THRESHOLDS.lowCarbMaxG, 20);
});

test('filtre: yüksek protein ≥ 30 (dahil), düşük karbonhidrat ≤ 20 (dahil), 500 kcal altı, içecek kategorisi; stok dışı ve sos yok', () => {
  const ids = (k: Parameters<typeof applyListSource>[1]) => applyListSource(CATALOG, k).map((p) => p.id);
  assert.deepEqual(ids({ filter: 'high_protein' }), [1, 2, 7]);
  assert.deepEqual(ids({ filter: 'low_carb' }), [2, 4, 6]);
  assert.deepEqual(ids({ filter: 'under_500' }), [2, 3, 4, 6]);
  assert.deepEqual(ids({ filter: 'drinks' }), [4]);
  assert.deepEqual(ids({ filter: 'all' }), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(ids({ filter: 'vegan' }), []);
  assert.deepEqual(ids({ category: "Bowl's" }), [1]);
  // Tam eşik değerleri
  assert.deepEqual(applyListSource([P(9, { protein: 30, carbs: 20, calories: 499 })], { filter: 'high_protein' }).length, 1);
  assert.deepEqual(applyListSource([P(9, { protein: 29.9 })], { filter: 'high_protein' }).length, 0);
  assert.deepEqual(applyListSource([P(9, { calories: 500 })], { filter: 'under_500' }).length, 0);
});

// ── 2) Tekrar sipariş ──────────────────────────────────────────────────────
test('tekrar sipariş: yalnız ≥ 1 tamamlanmış siparişte görünür', () => {
  assert.equal(reorderVisible([]), false);
  assert.equal(reorderVisible(null), false);
  assert.equal(reorderVisible([{ items: [] }]), false);
  assert.equal(reorderVisible([{ items: [{}] }]), true);
});

const GROUP: OptionGroup = {
  id: 'g1', name: 'Sos', description: '', minSelection: 1, maxSelection: 1, isRequired: true, sortOrder: 0,
  items: [
    { id: 'a', groupId: 'g1', name: 'Acı', priceAdjustment: 10, sortOrder: 0, isAvailable: true },
    { id: 'b', groupId: 'g1', name: 'Tatlı', priceAdjustment: 0, sortOrder: 1, isAvailable: false },
  ],
};

test('tekrar sipariş: satışta olmayan ürün oos, yalnız kalanlar eklenir', () => {
  const lines: ReorderLine[] = [
    { id: '1', name: 'Kinoa', quantity: 2, options: {} },
    { id: '8', name: 'Stoksuz', quantity: 1, options: {} },
    { id: '99', name: 'Kaldırılmış', quantity: 1, options: {} },
  ];
  const byId = new Map(CATALOG.map((p) => [String(p.id), p]));
  const plan = planReorder(lines, byId, new Map());
  assert.deepEqual(plan.unavailable, ['Stoksuz', 'Kaldırılmış']);
  assert.equal(plan.added, 1);
  assert.equal(plan.calls.length, 1);
  assert.equal(plan.calls[0].quantity, 2);
  // Kart üstü uyarı: satıştaki kimliklerle
  const onSale = new Set(CATALOG.filter((p) => p.in_stock !== false).map((p) => String(p.id)));
  assert.deepEqual(reorderUnavailable(lines, onSale).map((l) => l.name), ['Stoksuz', 'Kaldırılmış']);
  assert.deepEqual(reorderUnavailable(lines, null), []);
});

test('tekrar sipariş: eski seçim geçerliyse korunur (güncel fiyatla), değilse ürün sayfası', () => {
  const prod = P(1, { category: "Bowl's", calories: 540 });
  const info = { groups: [GROUP], links: [] };
  const ok = rebuildReorderLine(prod, { id: '1', name: 'K', quantity: 1, options: { byGroup: { g1: ['a'] }, extraPrice: 3, labels: [] } }, info);
  assert.ok(ok);
  assert.deepEqual(ok![0].options.byGroup, { g1: ['a'] });
  assert.equal(ok![0].options.extraPrice, 10, 'fiyat farkı güncel katalogdan');
  // Seçenek satışta değil
  assert.equal(rebuildReorderLine(prod, { id: '1', name: 'K', quantity: 1, options: { byGroup: { g1: ['b'] } } }, info), null);
  // Seçenek kaldırılmış
  assert.equal(rebuildReorderLine(prod, { id: '1', name: 'K', quantity: 1, options: { byGroup: { g1: ['zzz'] } } }, info), null);
  // Zorunlu grup eklenmiş, eski seçim yok
  assert.equal(rebuildReorderLine(prod, { id: '1', name: 'K', quantity: 1, options: {} }, info), null);
  // Gramaj: ad hâlâ varsa korunur, yoksa ürün sayfası
  const gram = P(2, { gramaj_options: [{ name: '150 g', price_modifier: 0 }, { name: '200 g', price_modifier: 40 }] as never });
  const g1 = rebuildReorderLine(gram, { id: '2', name: 'G', quantity: 1, options: { templateOptions: [{ template_id: 0, template_name: 'Et Gramajı', value_id: 5, value_name: '200 g', price_modifier: 0, calorie_modifier: 0, protein_modifier: 0, carbs_modifier: 0, fats_modifier: 0 }] } }, { groups: [], links: [] });
  assert.ok(g1);
  assert.equal(g1![0].options.templateOptions?.[0].price_modifier, 40);
  assert.equal(rebuildReorderLine(gram, { id: '2', name: 'G', quantity: 1, options: {} }, { groups: [], links: [] }), null);
  assert.equal(rebuildReorderLine(gram, { id: '2', name: 'G', quantity: 1, options: { templateOptions: [{ template_id: 0, template_name: 'Et Gramajı', value_id: 0, value_name: '300 g', price_modifier: 0, calorie_modifier: 0, protein_modifier: 0, carbs_modifier: 0, fats_modifier: 0 }] } }, { groups: [], links: [] }), null);
  // Paket ürün → her zaman ürün sayfası
  assert.equal(rebuildReorderLine(P(3, { is_bundle: true }), { id: '3', name: 'B', quantity: 1, options: {} }, { groups: [], links: [] }), null);
  // planReorder: seçim geçersiz → needsPage
  const plan = planReorder([{ id: '1', name: 'K', quantity: 1, options: { byGroup: { g1: ['b'] } } }], new Map([['1', prod]]), new Map([['1', info]]));
  assert.deepEqual(plan.needsPage, ['1']);
  assert.equal(plan.added, 0);
});

// ── 3) Kalan kalori ────────────────────────────────────────────────────────
test('kalan kalori: hedef yok → empty, dolu → full + kalan, doldu → done', () => {
  assert.deepEqual(kcalSectionState({ targetKcal: null, consumedKcal: 0 }), { state: 'empty', remaining: 0 });
  assert.deepEqual(kcalSectionState({ targetKcal: 0, consumedKcal: 100 }), { state: 'empty', remaining: 0 });
  assert.deepEqual(kcalSectionState({ targetKcal: 2000, consumedKcal: 1240 }), { state: 'full', remaining: 760 });
  assert.deepEqual(kcalSectionState({ targetKcal: 2000, consumedKcal: 2000 }), { state: 'done', remaining: 0 });
  assert.deepEqual(kcalSectionState({ targetKcal: 2000, consumedKcal: 2300 }), { state: 'done', remaining: 0 });
});

test('kalan kalori filtresi: kalan ≥ ürün kcal, proteine göre sıralı; doldu → ≤ 400 kcal; sos/stok dışı yok', () => {
  assert.deepEqual(kcalPicks(CATALOG, 'full', 500).map((p) => p.id), [2, 6, 4, 3]);
  assert.deepEqual(kcalPicks(CATALOG, 'full', 540).map((p) => p.id), [1, 2, 6, 4, 3]);
  assert.deepEqual(kcalPicks(CATALOG, 'done', 0).map((p) => p.id), [6, 4, 3]);
  assert.deepEqual(kcalPicks(CATALOG, 'empty', 0), []);
});

// ── 4) Plan eşleme ─────────────────────────────────────────────────────────
const it = (o: Partial<PlanItemLike>): PlanItemLike => ({ id: 'x', date: '2026-11-16', slot: 'lunch', source: 'recipe', refId: null, name: 'Tarif', kcal: 500, ...o });

test('plan eşleme: ürün kimliği → o ürün; yoksa aynı öğün tipinde ±%10 en yakın; eşleşmeyen satır yok', () => {
  const rows = matchPlanItems(
    [
      it({ id: 'd', slot: 'dinner', kcal: 530 }), // akşam → Bowl's 540 (fark 10) ya da Yüksek Protein 480 (50) → 1
      it({ id: 'b', slot: 'breakfast', kcal: 300 }), // kahvaltı → Omlette Box 320 (fark 20 ≤ 30) → 6
      it({ id: 'l', slot: 'lunch', source: 'eatkcal', refId: '7', kcal: 820 }), // kimlik → 7
      it({ id: 's', slot: 'snack', kcal: 100 }), // ara öğün → içecek 160 (fark 60 > 10) → yok
      it({ id: 'e', slot: 'lunch', source: 'eatkcal', refId: '8', kcal: 380 }), // kimlik ama stok dışı → yok (yedek eşleme yok)
      it({ id: 'y', date: '2026-11-15', slot: 'lunch', kcal: 540 }), // dün → yok
    ],
    CATALOG,
    '2026-11-16',
  );
  assert.deepEqual(rows.map((r) => [r.item.id, r.product.id, r.via]), [
    ['b', 6, 'kcal'],
    ['l', 7, 'id'],
    ['d', 1, 'kcal'],
  ]);
  assert.equal(PLAN_MATCH.kcalTolerance, 0.1);
  assert.deepEqual(matchPlanItems([it({ slot: 'snack', kcal: 50 })], CATALOG, '2026-11-16'), [], 'hepsi eşleşmezse bölüm gizli');
  // Sos hiçbir öğün tipinde aday değil
  assert.ok(!Object.values(PLAN_MATCH.slotCategories).some((c) => c.includes('Soslar')));
});

// ── 5) Top ─────────────────────────────────────────────────────────────────
test('bu hafta en çok: < 3 ürün → gizli; katalogda olmayan düşer, sıra yeniden numaralanır, gerçek adet', () => {
  assert.deepEqual(topRows([{ product_id: 1, rank: 1, order_count: 9 }, { product_id: 2, rank: 2, order_count: 4 }], CATALOG), []);
  assert.deepEqual(topRows(null, CATALOG), []);
  const rows = topRows(
    [
      { product_id: 7, rank: 1, order_count: 12 },
      { product_id: 99, rank: 2, order_count: 8 },
      { product_id: 1, rank: 3, order_count: 6 },
      { product_id: 2, rank: 4, order_count: 3 },
    ],
    CATALOG,
  );
  assert.deepEqual(rows.map((r) => [r.product.id, r.rank, r.orderCount]), [[7, 1, 12], [1, 2, 6], [2, 3, 3]]);
  assert.deepEqual(topRows([{ product_id: 7, rank: 1, order_count: 2 }, { product_id: 99, rank: 2, order_count: 1 }, { product_id: 1, rank: 3, order_count: 1 }], CATALOG), [], 'katalogdan düşünce < 3');
});

// ── 0) Banner koşulu + hedefler ─────────────────────────────────────────────
test('banner koşulu: hücre bazında opsiyonel; davet misafirde/kapalıyken, "ilk sipariş" siparişi olanda gizli', () => {
  const ctxGuest = { signedIn: false, hasOrders: null, inviteOn: false };
  const ctxNew = { signedIn: true, hasOrders: false, inviteOn: true };
  const ctxOld = { signedIn: true, hasOrders: true, inviteOn: true };
  assert.equal(bannerVisible({ navigate_to: 'BrandLanding:tera' }, ctxGuest), true);
  assert.equal(bannerVisible({ navigate_to: 'Invite' }, ctxGuest), false);
  assert.equal(bannerVisible({ navigate_to: 'Invite' }, { ...ctxOld, inviteOn: false }), false);
  assert.equal(bannerVisible({ navigate_to: 'Invite' }, ctxOld), true);
  assert.equal(bannerVisible({ audience: 'no_orders' }, ctxNew), true);
  assert.equal(bannerVisible({ audience: 'no_orders' }, ctxOld), false);
  assert.equal(bannerVisible({ audience: 'no_orders' }, { ...ctxNew, hasOrders: null }), false, 'bilinmiyor → gizli');
  assert.equal(bannerVisible({ audience: 'no_orders' }, ctxGuest), true);
  assert.equal(bannerVisible({ audience: 'signed_in' }, ctxGuest), false);
  assert.equal(bannerVisible({ audience: 'guest' }, ctxGuest), true);
  assert.equal(bannerVisible({ audience: 'has_orders' }, ctxOld), true);
  assert.equal(bannerVisible({ audience: 'has_orders' }, ctxNew), false);
});

test('banner hedefleri: Davet, paywall (Fresh yıllık), liste (filtre/kategori), kampanya detayı', () => {
  assert.deepEqual(bannerTargetToEk('Invite'), { kind: 'screen', name: 'EkInvite' });
  assert.deepEqual(bannerTargetToEk('SubPaywall:fresh:yearly'), { kind: 'screen', name: 'SubPaywall', params: { from: 'banner', plan: 'fresh', yearly: true, offer: 'izmir_fresh' } });
  assert.deepEqual(bannerTargetToEk('ProductList:high_protein'), { kind: 'list', filter: 'high_protein' });
  assert.deepEqual(bannerTargetToEk('ProductList:bilinmeyen'), { kind: 'list', filter: 'all' });
  assert.deepEqual(bannerTargetToEk('CategoryProducts:Koliye Özel Fırsatlar'), { kind: 'category', categoryName: 'Koliye Özel Fırsatlar' });
  assert.deepEqual(bannerTargetToEk('Campaign:3b63a9f1-0000-0000-0000-000000000000'), { kind: 'screen', name: 'ProfileCoupons', params: { campaignId: '3b63a9f1-0000-0000-0000-000000000000' } });
});

// ── 6) Davet ───────────────────────────────────────────────────────────────
test('davet görünürlüğü: giriş + bayrak + ödül; bayrak yerelde kapalı', () => {
  assert.equal(FLAG_DEFAULTS.davet, false);
  assert.equal(inviteVisible({ signedIn: true, flag: true, rewardTl: 100 }), true);
  assert.equal(inviteVisible({ signedIn: false, flag: true, rewardTl: 100 }), false);
  assert.equal(inviteVisible({ signedIn: true, flag: false, rewardTl: 100 }), false);
  assert.equal(inviteVisible({ signedIn: true, flag: true, rewardTl: null }), false);
  assert.equal(inviteVisible({ signedIn: true, flag: true, rewardTl: 0 }), false);
});

test('davet kodu: karışmayan alfabe, 6–8 karakter, boşluk/küçük harf normalize', () => {
  assert.equal(normalizeReferralCode(' ab3k 7mq '), 'AB3K7MQ');
  assert.equal(referralCodeLooksValid('ab3k7mq'), true);
  assert.equal(referralCodeLooksValid('AB1K7MQ'), false, '1 yok');
  assert.equal(referralCodeLooksValid('ABOK7MQ'), false, 'O yok');
  assert.equal(referralCodeLooksValid('ABIK7MQ'), false, 'I yok');
  assert.equal(referralCodeLooksValid('ABLK7MQ'), false, 'L yok');
  assert.equal(referralCodeLooksValid('AB3K7'), false);
});

test('davet RPC ayrıştırma + geçmiş + paylaşım metni', () => {
  const m = parseMyReferral({ ok: true, code: 'AB3K7MQ', reward_tl: '100', min_order_tl: null, history: [
    { id: 'r1', name: 'Ayşe K.', status: 'earned', created_at: '2026-11-10', earned_at: '2026-11-12' },
    { id: 'r2', name: null, status: 'pending', created_at: '2026-11-11' },
    { id: 'r3', name: 'X', status: 'void', created_at: '2026-11-11' },
  ] });
  assert.ok(m);
  assert.equal(m!.rewardTl, 100);
  assert.equal(m!.minOrderTl, null);
  assert.deepEqual(visibleHistory(m!.history).map((h) => h.status), ['earned', 'pending']);
  assert.equal(parseMyReferral({ ok: false, error: 'not_signed_in' }), null);
  assert.deepEqual(parseApplyResult({ ok: true }), { ok: true });
  assert.deepEqual(parseApplyResult({ ok: false, error: 'own_code' }), { ok: false, error: 'own_code' });
  assert.deepEqual(parseApplyResult({ ok: false, error: 'weird' }), { ok: false, error: 'error' });
  const text = referralShareText((k, p) => `${k}|${p?.code}|${p?.amount}`, 'AB3K7MQ', 100);
  assert.match(text, /ek56\.invite\.share_text\|AB3K7MQ\|100/);
  assert.match(text, /apps\.apple\.com/);
  assert.match(text, /play\.google\.com/);
});

test('migration: davet kuralları, top < 3, bayrak kapalı, banner koşulu + rollback', () => {
  const root = path.join(__dirname, '../../../../..');
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261116200100_g56_eatkcal_growth.sql'), 'utf8');
  const rb = fs.readFileSync(path.join(root, 'supabase/rollbacks/20261116200100_g56_eatkcal_growth_rollback.sql'), 'utf8');
  assert.match(sql, /create or replace function public\.top_products_week\(p_limit int default 10\)/);
  assert.match(sql, /o\.status = 'delivered'/);
  assert.match(sql, /now\(\) - interval '7 days'/);
  assert.match(sql, /\(select count\(\*\) from agg\) >= 3/);
  assert.match(sql, /referee_id\s+uuid not null unique/);
  assert.match(sql, /status in \('pending', 'earned', 'void'\)/);
  assert.match(sql, /'own_code'/);
  assert.match(sql, /'already_applied'/);
  assert.match(sql, /'has_orders'/);
  assert.match(sql, /referral_reward_tl/);
  assert.match(sql, /referral_min_order_tl/);
  assert.match(sql, /if v_reward is null or v_reward <= 0 then/);
  assert.match(sql, /\('davet', false, 0, '1\.1\.0'/);
  assert.match(sql, /banner_cells add column if not exists audience/);
  assert.match(sql, /'referral'\s*\)/);
  assert.match(sql, /ABCDEFGHJKMNPQRSTUVWXYZ23456789/);
  for (const x of ['trg_referral_on_delivery', 'apply_referral_code', 'my_referral', 'top_products_week', 'referrals', 'referral_codes', 'audience', "key = 'davet'"]) {
    assert.ok(rb.includes(x), `rollback: ${x}`);
  }
});
