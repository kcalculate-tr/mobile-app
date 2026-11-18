// G62-S1 — sipariş değerlendirme v2: istem görünürlüğü (teslim + 7 gün + bir kez), puan, düşük puan, ürün oyu,
// gönderim gövdesi, analitik, migration / rollback / moderate-content sözleşmesi, bayrak, TR-EN anahtarları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_ITEM_TAGS,
  EMPTY_DIMS,
  ITEM_TAGS,
  RATE_WINDOW_MS,
  buildSubmitArgs,
  clampComment,
  deliveredAtOf,
  isComplete,
  isLowRating,
  isRatePromptVisible,
  overallRating,
  pickPromptOrder,
  rateItemsFromOrderItems,
  rateOrderLabel,
  resetPromptTracking,
  reviewPhotoPath,
  shouldTrackPrompt,
  submitErrorCode,
  submitEventProps,
  toggleTag,
  toggleVote,
} from '../model/orderRate';
import { FLAG_DEFAULTS } from '../../../../core/flags/registry';
import { tr as g62Tr, en as g62En } from '../../../../core/i18n/g62';
import {
  reviewImagePaths,
  reviewModerationText,
  reviewNeedsModeration,
  reviewStatus,
} from '../../../../../supabase/functions/moderate-content/review';

const ROOT = join(__dirname, '../../../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const NOW = Date.parse('2026-11-18T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

test('istem: yalnız teslim edildi + ≤ 7 gün + değerlendirilmemiş', () => {
  const row = { id: 1, status: 'delivered', delivered_at: iso(NOW - 2 * DAY), updated_at: iso(NOW - 2 * DAY) };
  assert.equal(isRatePromptVisible(row, { reviewed: false, now: NOW }), true);
  assert.equal(isRatePromptVisible(row, { reviewed: true, now: NOW }), false, 'bir kez');
  assert.equal(isRatePromptVisible({ ...row, status: 'on_way' }, { reviewed: false, now: NOW }), false);
  assert.equal(isRatePromptVisible({ ...row, status: 'cancelled' }, { reviewed: false, now: NOW }), false);
  // 7 gün sınırı (dahil) ve hemen sonrası
  assert.equal(isRatePromptVisible({ ...row, delivered_at: iso(NOW - RATE_WINDOW_MS) }, { reviewed: false, now: NOW }), true);
  assert.equal(isRatePromptVisible({ ...row, delivered_at: iso(NOW - RATE_WINDOW_MS - 1000) }, { reviewed: false, now: NOW }), false);
  // Teslimden hemen sonra görünür (30 dk beklemesi yok)
  assert.equal(isRatePromptVisible({ ...row, delivered_at: iso(NOW - 60_000) }, { reviewed: false, now: NOW }), true);
  assert.equal(isRatePromptVisible(null, { reviewed: false, now: NOW }), false);
});

test('teslim anı: delivered_at; yoksa updated_at; ikisi de yoksa istem yok', () => {
  assert.equal(deliveredAtOf({ delivered_at: iso(NOW - DAY), updated_at: iso(NOW) }), NOW - DAY);
  assert.equal(deliveredAtOf({ delivered_at: null, updated_at: iso(NOW - 3 * DAY) }), NOW - 3 * DAY);
  assert.equal(deliveredAtOf({ delivered_at: null, updated_at: null }), null);
  assert.equal(isRatePromptVisible({ id: 1, status: 'delivered', delivered_at: null, updated_at: null }, { reviewed: false, now: NOW }), false);
  // delivered_at 8 gün önce ama updated_at bugün (ör. not düzeltmesi) → pencere teslimden sayılır
  assert.equal(isRatePromptVisible({ id: 1, status: 'delivered', delivered_at: iso(NOW - 8 * DAY), updated_at: iso(NOW) }, { reviewed: false, now: NOW }), false);
});

test('Ana sayfa seçimi: pencere içi, değerlendirilmemiş, kapatılmamış EN YENİ teslim', () => {
  const rows = [
    { id: 10, status: 'delivered', delivered_at: iso(NOW - 1 * DAY) },
    { id: 11, status: 'delivered', delivered_at: iso(NOW - 3 * DAY) },
    { id: 12, status: 'delivered', delivered_at: iso(NOW - 9 * DAY) },
    { id: 13, status: 'preparing', delivered_at: null },
  ];
  assert.equal(pickPromptOrder(rows, new Set(), NOW)?.id, 10);
  assert.equal(pickPromptOrder(rows, new Set([10]), NOW)?.id, 11, 'değerlendirilen atlanır');
  assert.equal(pickPromptOrder(rows, new Set(), NOW, new Set([10]))?.id, 11, 'kapatılan atlanır');
  assert.equal(pickPromptOrder(rows, new Set([10, 11]), NOW), null, '9 günlük sipariş istem açmaz');
  assert.equal(pickPromptOrder([], new Set(), NOW), null);
});

test('genel puan = üç başlığın yuvarlanmış ortalaması; üçü dolmadan 0; düşük puan ≤ 2', () => {
  assert.equal(isComplete(EMPTY_DIMS), false);
  assert.equal(overallRating({ delivery: 5, calorie_fit: 0, taste: 5 }), 0);
  assert.equal(overallRating({ delivery: 5, calorie_fit: 4, taste: 5 }), 5); // 4,67
  assert.equal(overallRating({ delivery: 4, calorie_fit: 4, taste: 5 }), 4); // 4,33
  assert.equal(overallRating({ delivery: 1, calorie_fit: 2, taste: 2 }), 2); // 1,67
  assert.equal(overallRating({ delivery: 1, calorie_fit: 1, taste: 1 }), 1);
  assert.equal(isLowRating({ delivery: 1, calorie_fit: 2, taste: 2 }), true);
  assert.equal(isLowRating({ delivery: 2, calorie_fit: 3, taste: 3 }), false); // 2,67 → 3
  assert.equal(isLowRating({ delivery: 1, calorie_fit: 1, taste: 4 }), true); // 2
  assert.equal(isLowRating(EMPTY_DIMS), false);
});

test('ürün oyu: aynı oy kaldırır, yön değişince etiketler sıfırlanır; etiket yalnız o yönden, en fazla 6', () => {
  let v = toggleVote({}, 7, true);
  assert.deepEqual(v, { 7: { liked: true, tags: [] } });
  v = toggleTag(v, 7, 'lezzetli');
  v = toggleTag(v, 7, 'soguk'); // beğendim yönünde değil → yok sayılır
  assert.deepEqual(v[7].tags, ['lezzetli']);
  v = toggleTag(v, 7, 'lezzetli');
  assert.deepEqual(v[7].tags, []);
  v = toggleTag(toggleVote(v, 7, false), 7, 'soguk');
  assert.deepEqual(v[7], { liked: false, tags: ['soguk'] });
  assert.deepEqual(toggleVote(v, 7, false), {});
  assert.equal(toggleTag({}, 9, 'taze')[9], undefined);
  assert.equal(ALL_ITEM_TAGS.length, ITEM_TAGS.liked.length + ITEM_TAGS.disliked.length);
});

test('orders.items → ürünler: aynı ürün bir kez, geçersiz kimlik atlanır, ad yoksa yedek', () => {
  const items = rateItemsFromOrderItems([{ id: 3, name: 'Tavuk kinoa' }, { id: 3, name: 'Tavuk kinoa' }, { id: 0 }, { id: 'x' }, { id: 5, name: '  ' }], 'Ürün');
  assert.deepEqual(items, [{ productId: 3, name: 'Tavuk kinoa' }, { productId: 5, name: 'Ürün' }]);
  assert.deepEqual(rateItemsFromOrderItems(null), []);
});

test('gönderim gövdesi: boş yorum null, ≤ 500, oylar listeye; analitikte metin yok', () => {
  const args = buildSubmitArgs({
    orderId: 42,
    dims: { delivery: 5, calorie_fit: 4, taste: 5 },
    comment: '   ',
    photoPath: null,
    votes: { 3: { liked: true, tags: ['lezzetli'] }, 5: { liked: false, tags: [] } },
  });
  assert.deepEqual(args, {
    p_order_id: 42, p_delivery: 5, p_calorie_fit: 4, p_taste: 5, p_comment: null, p_photo_path: null,
    p_items: [{ product_id: 3, liked: true, tags: ['lezzetli'] }, { product_id: 5, liked: false, tags: [] }],
  });
  const long = buildSubmitArgs({ orderId: 1, dims: { delivery: 1, calorie_fit: 1, taste: 1 }, comment: 'a'.repeat(700), photoPath: 'u/reviews/1.jpg', votes: {} });
  assert.equal(long.p_comment?.length, 500);
  assert.equal(clampComment('abc'), 'abc');
  const ev = submitEventProps({ ...args, p_comment: 'gizli metin' }, 'home');
  assert.deepEqual(ev, { order_id: '42', rating: 5, delivery: 5, calorie_fit: 4, taste: 5, item_count: 2, has_comment: true, has_photo: false, surface: 'home' });
  assert.ok(!JSON.stringify(ev).includes('gizli'));
});

test('hata kodları, fotoğraf yolu, kart etiketi, istem analitiği bir kez', () => {
  assert.equal(submitErrorCode('already_rated'), 'already_rated');
  assert.equal(submitErrorCode('P0001: expired'), 'expired');
  assert.equal(submitErrorCode('TypeError: Network request failed'), 'network');
  assert.equal(submitErrorCode(undefined), 'unknown');
  assert.equal(reviewPhotoPath('u1', 42, 1000), 'u1/reviews/42-1000.jpg');
  assert.throws(() => reviewPhotoPath('', 1, 1));
  assert.equal(rateOrderLabel({ orderCode: 'KCAL-1234', id: 9 }), 'KCAL-1234');
  assert.equal(rateOrderLabel({ orderCode: null, id: 9 }), '#9');
  resetPromptTracking();
  assert.equal(shouldTrackPrompt(1, 'home'), true);
  assert.equal(shouldTrackPrompt(1, 'home'), false);
  assert.equal(shouldTrackPrompt(1, 'order_detail'), true);
});

test('bayrak: siparis_degerlendirme yerelde KAPALI; migration satırı kapalı, rollback siler', () => {
  assert.equal(FLAG_DEFAULTS.siparis_degerlendirme, false);
  const sql = read('supabase/migrations/20261118120100_g62_order_rating.sql');
  assert.match(sql, /'siparis_degerlendirme', false, 0, '1\.1\.0'/);
  assert.match(sql, /on conflict \(key\) do nothing/);
  assert.doesNotMatch(sql, /update public\.feature_flags|enabled\s*=\s*true/);
  const rb = read('supabase/rollbacks/20261118120100_g62_order_rating_rollback.sql');
  assert.match(rb, /delete from public\.feature_flags where key in \('siparis_degerlendirme'\)/);
  assert.ok(!existsSync(join(ROOT, 'supabase/migrations/20261118120100_g62_order_rating_rollback.sql')));
});

test('migration: v1 üstüne yalnız sütun ekleme (veri kaybı yok); RPC kuralları; restoran puanı kuralı aynı', () => {
  const sql = read('supabase/migrations/20261118120100_g62_order_rating.sql');
  // Ekleme, silme yok
  for (const col of ['delivery', 'calorie_fit', 'taste', 'photo_path', 'version', 'moderation_id']) {
    assert.match(sql, new RegExp(`alter table public\\.reviews add column if not exists ${col}\\b`));
  }
  assert.match(sql, /alter table public\.review_item_feedback add column if not exists tags text\[\]/);
  assert.doesNotMatch(sql, /drop column|drop table|delete from public\.reviews|truncate/i);
  // RPC: sahiplik, teslim, 7 gün, tek kez, yorum ≤ 500, kilit, yalnız authenticated
  assert.match(sql, /create or replace function public\.submit_order_rating\(/);
  assert.match(sql, /for update;/);
  assert.match(sql, /v_order\.user_id is distinct from v_uid/);
  assert.match(sql, /status is distinct from 'delivered'/);
  assert.match(sql, /interval '7 days'/);
  assert.match(sql, /already_rated/);
  assert.match(sql, /char_length\(v_comment\) > 500/);
  assert.match(sql, /round\(\(p_delivery \+ p_calorie_fit \+ p_taste\)::numeric \/ 3\)/);
  assert.match(sql, /grant execute on function public\.submit_order_rating\([^)]*\) to authenticated;/);
  assert.match(sql, /from public, anon;/);
  // Etiket beyaz listesi = istemci listesi
  const m = sql.match(/c_tags\s+constant text\[\] := array\[([\s\S]*?)\];/);
  assert.ok(m);
  const serverTags = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert.deepEqual(serverTags, [...ALL_ITEM_TAGS]);
  // Restoran puanı: son 90 gün, tüm puanlar, <10 → is_new (G22 kuralı aynen); alt boyutlar v2'den
  assert.match(sql, /interval '90 days'/);
  assert.match(sql, /count\(\*\) < 10,/);
  assert.match(sql, /round\(avg\(r\.taste\)::numeric, 2\)/);
  assert.match(sql, /round\(avg\(r\.calorie_fit\)::numeric, 2\)/);
  // Moderasyon hedefi
  assert.match(sql, /moderation_queue_target_type_check\s+check \(target_type in \('post', 'comment', 'story', 'review'\)\)/);
  assert.match(sql, /insert into public\.moderation_queue \(target_type, target_id\)\s+values \('review', v_mod\)/);
  // $$ dengesi
  assert.equal((sql.match(/\$\$/g) ?? []).length % 2, 0);
  const rb = read('supabase/rollbacks/20261118120100_g62_order_rating_rollback.sql');
  assert.match(rb, /drop function if exists public\.submit_order_rating/);
  assert.match(rb, /check \(target_type in \('post', 'comment', 'story'\)\)/);
  assert.match(rb, /null::numeric,/);
});

test('moderate-content: review hedefi (yorum + user-media fotoğrafı; onay = is_approved)', () => {
  const row = { user_id: 'u1', comment: '  Çok iyiydi  ', is_approved: false, photo_path: 'u1/reviews/42-1.jpg' };
  assert.equal(reviewModerationText(row), 'Çok iyiydi');
  assert.deepEqual(reviewImagePaths(row), ['u1/reviews/42-1.jpg']);
  assert.deepEqual(reviewImagePaths({ ...row, photo_path: 'u2/reviews/x.jpg' }), [], 'başkasının klasörü');
  assert.deepEqual(reviewImagePaths({ ...row, photo_path: 'u1/reviews/../scans/x.jpg' }), []);
  assert.deepEqual(reviewImagePaths({ ...row, photo_path: 'https://x/y.jpg' }), []);
  assert.equal(reviewNeedsModeration({ ...row, comment: null, photo_path: null }), false);
  assert.equal(reviewStatus(row), 'pending');
  assert.equal(reviewStatus({ ...row, is_approved: true }), 'published');
  const fn = read('supabase/functions/moderate-content/index.ts');
  assert.match(fn, /targetType !== 'review'/);
  assert.match(fn, /\.from\('reviews'\)\.update\(\{ is_approved: true \}\)\.eq\('moderation_id', targetId\)\.eq\('is_approved', false\)/);
  assert.match(fn, /REVIEW_BUCKET = 'user-media'/);
});

test('TR + EN: aynı anahtarlar, boş metin yok; tasarım metinleri birebir', () => {
  const trK = Object.keys(g62Tr.order_rate).sort();
  const enK = Object.keys(g62En.order_rate).sort();
  assert.deepEqual(trK, enK);
  for (const [k, v] of Object.entries(g62Tr.order_rate)) assert.ok(String(v).trim(), `tr.${k}`);
  for (const [k, v] of Object.entries(g62En.order_rate)) assert.ok(String(v).trim(), `en.${k}`);
  for (const tag of ALL_ITEM_TAGS) assert.ok(`tag_${tag}` in g62Tr.order_rate, tag);
  const design = read('docs/g62/design/FinEkRateSheet.dc.html');
  for (const s of [g62Tr.order_rate.title, g62Tr.order_rate.need_all, g62Tr.order_rate.sent_body, g62En.order_rate.title, g62En.order_rate.need_all, g62En.order_rate.comment_ph, g62Tr.order_rate.word_2, g62En.order_rate.thanks]) {
    assert.ok(design.includes(s), `tasarımda yok: ${s}`);
  }
});
