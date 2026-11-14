// G50-S1 md.1 — Ana sayfa ek bölümlerinin saf kuralları: veri yoksa gizli, görev durumu gerçek kayıtlardan,
// 3/3 → bir kez kutlama, tarama rozeti kota kaynağından, tarifler kalori + görselle, hafta sütunları gerçek kaloriyle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_DAYS,
  homeStreak,
  recipesFromFeed,
  taskRows,
  tasksDismissKey,
  tasksView,
  weekColumns,
  withinFirstDays,
  type RecipeSourcePost,
} from '../homeSectionRules';

const NOW = Date.parse('2026-11-14T12:00:00.000Z');
const DAY = 864e5;

test('ilk 7 gün: oluşturma zamanı bilinmiyorsa / bozuksa / 7 gün geçtiyse HAYIR', () => {
  assert.equal(FIRST_DAYS, 7);
  assert.equal(withinFirstDays(new Date(NOW - 2 * DAY).toISOString(), NOW), true);
  assert.equal(withinFirstDays(new Date(NOW - 6.9 * DAY).toISOString(), NOW), true);
  assert.equal(withinFirstDays(new Date(NOW - 7 * DAY).toISOString(), NOW), false);
  assert.equal(withinFirstDays(null, NOW), false);
  assert.equal(withinFirstDays(undefined, NOW), false);
  assert.equal(withinFirstDays('bozuk', NOW), false);
});

test('görev satırları: bilinmeyen alan → null (kart gizli); su kapalı → 2 görev', () => {
  assert.equal(taskRows({ plan: true, scan: null, water: false }), null);
  assert.equal(taskRows({ plan: null, scan: true, water: true }), null);
  assert.deepEqual(taskRows({ plan: false, scan: false, water: false }), [
    { key: 'plan', done: false },
    { key: 'scan', done: false },
    { key: 'water', done: false },
  ]);
  assert.deepEqual(taskRows({ plan: true, scan: false, water: 'off' }), [
    { key: 'plan', done: true },
    { key: 'scan', done: false },
  ]);
});

test('kart hâli: 0/3 ve 2/3 → liste; 3/3 → kutlama (bir kez); kapatıldı / 7 gün dışı / işaret okunmadı → gizli', () => {
  const createdAt = new Date(NOW - DAY).toISOString();
  const none = taskRows({ plan: false, scan: false, water: false });
  const two = taskRows({ plan: true, scan: true, water: false });
  const all = taskRows({ plan: true, scan: true, water: true });
  assert.equal(tasksView({ createdAt, now: NOW, rows: none, dismissed: false }), 'show');
  assert.equal(tasksView({ createdAt, now: NOW, rows: two, dismissed: false }), 'show');
  assert.equal(tasksView({ createdAt, now: NOW, rows: all, dismissed: false }), 'celebrate');
  // kutlamadan sonra çağıran "kapatıldı" yazar → bir daha gösterilmez
  assert.equal(tasksView({ createdAt, now: NOW, rows: all, dismissed: true }), 'hidden');
  assert.equal(tasksView({ createdAt, now: NOW, rows: none, dismissed: null }), 'hidden');
  assert.equal(tasksView({ createdAt: new Date(NOW - 8 * DAY).toISOString(), now: NOW, rows: none, dismissed: false }), 'hidden');
  assert.equal(tasksView({ createdAt, now: NOW, rows: null, dismissed: false }), 'hidden');
  assert.equal(tasksDismissKey('u1'), '@kcal_first_tasks_closed:u1');
});

test('G54 md.8: tarama rozeti kuralı kaldırıldı (homeSectionRules dışa açmıyor)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  assert.equal((require('../homeSectionRules') as Record<string, unknown>).scanBadge, undefined);
});

const post = (id: string, meal: Partial<NonNullable<RecipeSourcePost['meal_card']>> | null, media: RecipeSourcePost['media'] = []): RecipeSourcePost => ({
  id,
  media,
  meal_card: meal ? { name: 'Tavuklu kinoa', kcal: 540, protein_g: 32, photo_url: 'https://x/p.jpg', ...meal } : null,
});

test('tarifler: yalnız kalorisi (> 0) ve görseli olan öğün kartları; en çok 8; tekrar yok', () => {
  assert.deepEqual(recipesFromFeed([]), []);
  assert.deepEqual(recipesFromFeed(null), []);
  const items = [
    post('a', {}),
    post('b', null),
    post('c', { kcal: 0 }),
    post('d', { photo_url: null }),
    post('e', { photo_url: null }, [{ url: 'https://x/m.jpg' }]),
    post('f', { photo_url: null }, [{ url: 'https://x/v.mp4', kind: 'video', thumb_path: 'https://x/t.jpg' }]),
    post('a', {}),
    post('g', { name: '   ' }),
    post('h', { protein_g: 0 }),
  ];
  const r = recipesFromFeed(items);
  assert.deepEqual(r.map((x) => x.id), ['a', 'e', 'f', 'h']);
  assert.deepEqual(r[0], { id: 'a', name: 'Tavuklu kinoa', kcal: 540, protein: 32, photo: 'https://x/p.jpg' });
  assert.equal(r[1].photo, 'https://x/m.jpg');
  assert.equal(r[2].photo, 'https://x/t.jpg');
  assert.equal(r[3].protein, null);
  const many = Array.from({ length: 12 }, (_, i) => post(`p${i}`, {}));
  assert.equal(recipesFromFeed(many).length, 8);
});

test('hafta sütunları: Pazartesi başlangıç, gerçek kalori / hedef, gelecek günler boş', () => {
  // 2026-11-14 Cumartesi → hafta 09 (Pzt) … 15 (Paz)
  const days = [
    { date: '2026-11-08', kcal: 3000, count: 2 },
    { date: '2026-11-09', kcal: 1000, count: 1 },
    { date: '2026-11-10', kcal: 2500, count: 3 },
    { date: '2026-11-11', kcal: 0, count: 1 },
    { date: '2026-11-14', kcal: 1500, count: 2 },
  ];
  const cols = weekColumns(days, '2026-11-14', 2000);
  assert.deepEqual(cols.map((c) => c.key), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.deepEqual(cols.map((c) => c.kcal), [1000, 2500, 0, 0, 0, 1500, 0]);
  assert.deepEqual(cols.map((c) => c.k), [0.5, 1, 0, 0, 0, 0.75, 0]);
  assert.deepEqual(cols.map((c) => c.logged), [true, true, true, false, false, true, false]);
  assert.equal(cols[5].today, true);
  assert.equal(cols[6].future, true);
  // hedef yoksa haftanın en yüksek gününe göre
  assert.deepEqual(weekColumns(days, '2026-11-14', null).map((c) => c.k), [0.4, 1, 0, 0, 0, 0.6, 0]);
  // Pazar: hafta aynı Pazartesi'den
  assert.equal(weekColumns(days, '2026-11-15', 2000)[0].key, '2026-11-09');
});

test('seri: track/streak kuralı (bugün yoksa dünden); bugünün yeni kaydı sayılır', () => {
  const days = [
    { date: '2026-11-12', kcal: 100, count: 1 },
    { date: '2026-11-13', kcal: 0, count: 1 },
  ];
  assert.equal(homeStreak(days, '2026-11-14', 0), 2);
  assert.equal(homeStreak(days, '2026-11-14', 1), 3);
  assert.equal(homeStreak([], '2026-11-14', 0), 0);
  assert.equal(homeStreak([{ date: '2026-11-11', kcal: 100, count: 1 }], '2026-11-14', 0), 0);
});
