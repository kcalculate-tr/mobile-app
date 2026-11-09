// G19-S2 — Günlük takip doğruluğu: gün sınırı (Europe/Istanbul), toplam = kayıtlar,
// seri kuralı, kutlama bir kez, gün sonu zamanı, su/etkinlik sınırları, çevrimdışı
// kuyruk, öğün hatırlatma planı, ölçüm olayları. SAF (native yok).
import test from 'node:test';
import assert from 'node:assert/strict';

import { addDays, dayKey, istanbulHHMM, istanbulHour, isOnDay, msUntilNextDay, startOfDayIso } from '../dayClock';
import { dayTotals, goalState, ringComplete, roundKcal, storeMacro, sumRows } from '../totals';
import {
  celebrateStorageKey,
  celebrationStreak,
  dayEndKind,
  displayStreak,
  isNewStreakDay,
  loggedDays,
  markShown,
} from '../streak';
import { activityLimitError, applyWater, validWaterDelta, waterUndoDelta } from '../limits';
import { applyPending, classifyError, enqueue, flush, MAX_OPS, uuidFromBytes, type QueueOp } from '../logQueue';
import { inQuietHours, planMealReminders, reminderId } from '../mealReminderPlan';
import { logSourceOf, sanitize, setTrackSink, trackEvent, TRACK_EVENT_NAMES, TRACK_PROP_WHITELIST } from '../events';
import { buildSlots } from '../../homeData';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FLAG_DEFAULTS } from '../../../../core/flags/registry';
import { ACTIVITY_MAX_KM, ACTIVITY_MAX_MINUTES } from '../limits';

// ─── md.1 Gün sınırı ─────────────────────────────────────────────────────────
test('gün sınırı: İstanbul gece yarısı — UTC 20:59 dün, 21:00 bugün', () => {
  assert.equal(dayKey(new Date('2026-11-08T20:59:59.999Z')), '2026-11-08');
  assert.equal(dayKey(new Date('2026-11-08T21:00:00.000Z')), '2026-11-09');
});

test('gün sınırı cihaz saat diliminden bağımsız (Berlin 23:30 = İstanbul 01:30 ertesi gün)', () => {
  // Berlin kışın UTC+1: 2026-11-08 23:30 Berlin = 22:30Z = 01:30 İstanbul (9 Kas).
  const berlinLate = new Date('2026-11-08T23:30:00+01:00');
  assert.equal(dayKey(berlinLate), '2026-11-09');
  // New York 2026-11-08 15:00 (UTC-5) = 20:00Z = 23:00 İstanbul → hâlâ 8 Kas.
  assert.equal(dayKey(new Date('2026-11-08T15:00:00-05:00')), '2026-11-08');
  assert.equal(istanbulHour(new Date('2026-11-08T15:00:00-05:00')), 23);
});

test('sorgu sınırı: bugünün başı İstanbul 00:00 = önceki gün 21:00Z', () => {
  const now = new Date('2026-11-09T10:00:00Z');
  assert.equal(startOfDayIso(0, now), '2026-11-08T21:00:00.000Z');
  assert.equal(startOfDayIso(1, now), '2026-11-09T21:00:00.000Z');
});

test('gece yarısına kalan süre: 23:59:30 İstanbul → 30 sn; tam gece yarısı → 24 saat', () => {
  assert.equal(msUntilNextDay(new Date('2026-11-09T20:59:30Z')), 30_000);
  assert.equal(msUntilNextDay(new Date('2026-11-09T21:00:00Z')), 24 * 3600 * 1000);
  // Gece yarısından hemen sonra ertesi güne geçer.
  const before = new Date('2026-11-09T20:59:59.500Z');
  const after = new Date(before.getTime() + msUntilNextDay(before));
  assert.notEqual(dayKey(before), dayKey(after));
});

test('satır saati ve yuva İstanbul saatiyle; geçersiz → boş', () => {
  assert.equal(istanbulHHMM('2026-11-08T21:05:00Z'), '00:05');
  assert.equal(istanbulHHMM('bozuk'), '');
  assert.equal(isOnDay('2026-11-08T21:05:00Z', '2026-11-09'), true);
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

// ─── md.1 Toplam doğruluğu ───────────────────────────────────────────────────
const rows = [
  { id: 'a', source: 'manual', name: 'A', meal_type: 'breakfast', calories: 320.6, protein: 10.4, carbs: 0.4, fat: 0.4, consumed_at: '2026-11-09T05:00:00Z' },
  { id: 'b', source: 'ai_scan', name: 'B', meal_type: 'lunch', calories: 219.5, protein: 12.4, carbs: 0.4, fat: 0.4, consumed_at: '2026-11-09T09:00:00Z' },
  { id: 'c', source: 'pantry', name: 'C', meal_type: null, calories: 540, protein: 40.3, carbs: 0.4, fat: 0.4, consumed_at: '2026-11-09T16:00:00Z' },
];

test('toplam = kayıtların toplamı; yuva toplamları gün toplamına eşit', () => {
  const t = dayTotals(rows);
  assert.equal(t.kcal, 321 + 220 + 540);
  assert.equal(t.count, 3);
  const slots = buildSlots(rows);
  const slotSum = slots.reduce((s, x) => s + x.kcal, 0);
  assert.equal(slotSum, t.kcal, 'yuva toplamları ≠ gün toplamı');
  const itemSum = slots.flatMap((s) => s.items).reduce((s, it) => s + it.kcal, 0);
  assert.equal(itemSum, t.kcal);
});

test('makrolar: ham toplam bir kez yuvarlanır (0,4 × 3 = 1, satır satır yuvarlasa 0 olurdu)', () => {
  const t = dayTotals(rows);
  assert.equal(t.carbs, 1);
  assert.equal(t.fat, 1);
  assert.equal(t.protein, 63);
  assert.equal(sumRows(rows).carbs.toFixed(1), '1.2');
});

test('bozuk satır toplamı bozmaz; dize sayılar okunur', () => {
  const t = dayTotals([{ calories: 'abc' }, { calories: -50, protein: NaN }, { calories: '120', protein: '4,5' }]);
  assert.equal(t.kcal, 120);
  assert.equal(t.protein, 5);
  assert.equal(roundKcal(Infinity), 0);
  assert.equal(storeMacro(12.345), 12.3);
});

test('hedef yoksa uydurma 2000 yok → "Hedef belirlenmedi"', () => {
  assert.deepEqual(goalState(null, undefined, 0), { has: false, kcal: 0 });
  assert.deepEqual(goalState(0, 1850.4), { has: true, kcal: 1850 });
  assert.equal(ringComplete(3000, goalState(null)), false);
  assert.equal(ringComplete(1850, goalState(1850)), true);
  assert.equal(ringComplete(1849, goalState(1850)), false);
});

// ─── md.4 Seri ───────────────────────────────────────────────────────────────
test('seri: bugün yoksa dünden sayılır (gün bitmeden kırılmaz); kaçırılan gün keser', () => {
  const days = loggedDays([
    { date: '2026-11-08', count: 1 },
    { date: '2026-11-07', count: 2 },
    { date: '2026-11-05', count: 1 },
  ]);
  assert.equal(displayStreak(days, '2026-11-09'), 2);
  assert.equal(celebrationStreak(days, '2026-11-09'), 0);
  days.add('2026-11-09');
  assert.equal(displayStreak(days, '2026-11-09'), 3);
  assert.equal(celebrationStreak(days, '2026-11-09'), 3);
  // Dün de yoksa 0.
  assert.equal(displayStreak(loggedDays([{ date: '2026-11-07', count: 1 }]), '2026-11-09'), 0);
});

test('seri: 0 kcal kayıt da günü saydırır (sunucuyla aynı); eski kovada kcal>0', () => {
  assert.equal(loggedDays([{ date: '2026-11-09', count: 1, kcal: 0 }]).has('2026-11-09'), true);
  assert.equal(loggedDays([{ date: '2026-11-09', kcal: 0 }]).has('2026-11-09'), false);
  assert.equal(isNewStreakDay(0, 1), true);
  assert.equal(isNewStreakDay(1, 2), false);
});

test('kutlama bir kez: 7 gösterilince 3 de gösterilmiş sayılır; anahtar kullanıcıya özel', () => {
  const m = markShown({}, 'streak7');
  assert.equal(m.streak3, true);
  assert.equal(m.streak7, true);
  assert.equal(markShown({}, 'streak3').streak7, undefined);
  assert.equal(celebrateStorageKey('u1'), '@kcal_celebrate_shown:u1');
  assert.notEqual(celebrateStorageKey('u1'), celebrateStorageKey('u2'));
});

test('gün sonu özeti: tamamlanınca Done; 20:00 sonrası End; boş gün/erken/aynı gün yok', () => {
  const base = { todayKey: '2026-11-09', lastShownDay: null as string | null };
  assert.equal(dayEndKind({ ...base, hour: 13, todayCount: 3, ringDone: true }), 'done');
  assert.equal(dayEndKind({ ...base, hour: 20, todayCount: 2, ringDone: false }), 'end');
  assert.equal(dayEndKind({ ...base, hour: 19, todayCount: 2, ringDone: false }), null);
  assert.equal(dayEndKind({ ...base, hour: 22, todayCount: 0, ringDone: false }), null);
  assert.equal(dayEndKind({ ...base, lastShownDay: '2026-11-09', hour: 22, todayCount: 2, ringDone: true }), null);
});

// ─── md.3 Su / etkinlik ──────────────────────────────────────────────────────
test('su: tek adım ≤ 2000 ve ≠ 0; toplam [0, 20000]; tavanda geri al yalnız eklenen kadar', () => {
  assert.equal(validWaterDelta(250), true);
  assert.equal(validWaterDelta(-250), true);
  assert.equal(validWaterDelta(0), false);
  assert.equal(validWaterDelta(2500), false);
  assert.equal(applyWater(19900, 250), 20000);
  assert.equal(waterUndoDelta(19900, 20000), -100);
  assert.equal(applyWater(20000, -100), 19900);
  assert.equal(applyWater(100, -250), 0);
  assert.equal(applyWater(NaN, 250), 250);
});

test('etkinlik sınırları: 1–600 dk, ≤ 300 km', () => {
  assert.equal(activityLimitError(0, null), 'minutes_low');
  assert.equal(activityLimitError(45, 5), null);
  assert.equal(activityLimitError(601, null), 'minutes_high');
  assert.equal(activityLimitError(60, 301), 'distance_high');
});

// ─── md.2 Çevrimdışı kuyruk ──────────────────────────────────────────────────
const ins = (id: string, kcal = 100): QueueOp => ({ kind: 'insert', id, row: { id, calories: kcal }, at: 1 });

test('kuyruk sıkıştırma: ekle+sil düşer, ekle+güncelle birleşir, güncelle+sil → sil', () => {
  let q = enqueue([], ins('x'))!;
  q = enqueue(q, { kind: 'update', id: 'x', patch: { calories: 200 }, at: 2 })!;
  assert.equal(q.length, 1);
  assert.equal((q[0] as any).row.calories, 200);
  q = enqueue(q, { kind: 'delete', id: 'x', at: 3 })!;
  assert.equal(q.length, 0);
  let q2 = enqueue([], { kind: 'update', id: 'y', patch: { meal_type: 'ogle' }, at: 1 })!;
  q2 = enqueue(q2, { kind: 'update', id: 'y', patch: { calories: 50 }, at: 2 })!;
  assert.deepEqual((q2[0] as any).patch, { meal_type: 'ogle', calories: 50 });
  q2 = enqueue(q2, { kind: 'delete', id: 'y', at: 3 })!;
  assert.deepEqual(q2.map((o) => o.kind), ['delete']);
  // Geri al: bekleyen silme + aynı satırın yeniden eklenmesi → ikisi de düşer.
  assert.equal(enqueue(q2, ins('y'))!.length, 0);
});

test('kuyruk: sıra korunur, retry\'de durur, 23505 ekleme = başarı (idempotent), kalıcı hata düşer', async () => {
  const q = [ins('a'), ins('b'), ins('c')];
  const seen: string[] = [];
  const out = await flush(q, async (op) => {
    seen.push(op.id);
    return op.id === 'b' ? 'retry' : 'ok';
  });
  assert.deepEqual(seen, ['a', 'b']);
  assert.deepEqual(out.queue.map((o) => o.id), ['b', 'c']);
  assert.equal(out.stopped, true);
  assert.equal(classifyError('insert', { code: '23505' }), 'ok');
  assert.equal(classifyError('update', { code: '23505' }), 'retry');
  assert.equal(classifyError('insert', { code: '42501' }), 'drop');
  assert.equal(classifyError('insert', { message: 'Network request failed' }), 'retry');
  assert.equal(classifyError('delete', { status: 503 }), 'retry');
  assert.equal(classifyError('delete', null), 'ok');
  const thrown = await flush([ins('z')], async () => {
    throw new Error('offline');
  });
  assert.equal(thrown.queue.length, 1);
});

test('kuyruk: bekleyen işlemler ekranda görünür; taşma reddedilir; uuid v4', () => {
  const shown = applyPending([{ id: 'a', calories: 1 }], [ins('n', 300), { kind: 'delete', id: 'a', at: 1 }]);
  assert.deepEqual(shown.map((r) => r.id), ['n']);
  let full: QueueOp[] = [];
  for (let i = 0; i < MAX_OPS; i += 1) full = enqueue(full, ins(`i${i}`))!;
  assert.equal(enqueue(full, ins('over')), null);
  const u = uuidFromBytes(new Uint8Array(16).fill(255));
  assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ─── md.5 Hatırlatma planı ───────────────────────────────────────────────────
test('hatırlatma: loglanan yuva atlanır, geçmiş saat atlanır, ufuk 3 gün', () => {
  const now = new Date('2026-11-09T09:00:00Z'); // 12:00 İstanbul
  const plan = planMealReminders({ now, loggedToday: new Set(['lunch']), prefs: null, mutedUntil: null, recentlyActive: true });
  const today = plan.filter((p) => p.day === '2026-11-09').map((p) => p.meal);
  assert.deepEqual(today, ['dinner']); // kahvaltı geçti, öğle loglandı
  assert.equal(plan.length, 1 + 3 + 3);
  assert.equal(plan[0].date.toISOString(), '2026-11-09T18:00:00.000Z'); // 21:00 İstanbul
  assert.equal(reminderId(plan[0]), 'fin-reminder-2026-11-09-dinner');
});

test('hatırlatma: tercih kapalı / takip etmeyen kullanıcı → yok; sessize al bugünü keser', () => {
  const now = new Date('2026-11-09T04:00:00Z'); // 07:00
  assert.equal(planMealReminders({ now, loggedToday: new Set(), prefs: { reminder_enabled: false }, mutedUntil: null, recentlyActive: true }).length, 0);
  assert.equal(planMealReminders({ now, loggedToday: new Set(), prefs: null, mutedUntil: null, recentlyActive: false }).length, 0);
  const muted = planMealReminders({ now, loggedToday: new Set(), prefs: null, mutedUntil: new Date('2026-11-09T20:59:59Z').getTime(), recentlyActive: true });
  assert.equal(muted.some((p) => p.day === '2026-11-09'), false);
  assert.equal(muted.length, 6);
});

test('sessiz saatler: gece yarısını saran aralık; 21:00 sessizde atlanır', () => {
  assert.equal(inQuietHours(22 * 60, '21:30', '08:00'), true);
  assert.equal(inQuietHours(7 * 60, '21:30:00', '08:00:00'), true);
  assert.equal(inQuietHours(12 * 60, '21:30', '08:00'), false);
  assert.equal(inQuietHours(12 * 60, '13:00', '13:00'), false);
  const now = new Date('2026-11-09T04:00:00Z');
  const plan = planMealReminders({ now, loggedToday: new Set(), prefs: { quiet_hours_start: '20:30', quiet_hours_end: '08:00' }, mutedUntil: null, recentlyActive: true });
  assert.equal(plan.some((p) => p.meal === 'dinner'), false);
  assert.equal(plan.length, 6);
});

// ─── md.7 Ölçüm olayları ─────────────────────────────────────────────────────
test('olaylar: 7 ad, beyaz liste dışı özellik (ad/not) gönderilmez', () => {
  assert.deepEqual([...TRACK_EVENT_NAMES], ['log_add', 'log_edit', 'log_delete', 'water_add', 'activity_add', 'streak_day', 'ring_complete']);
  const sent: { name: string; props: Record<string, unknown> }[] = [];
  setTrackSink((name, props) => sent.push({ name, props }));
  trackEvent({ name: 'log_add', props: { source: 'manual', slot: 'lunch', kcal: 412.456, offline: false, name: 'Mercimek' } as any });
  setTrackSink(null);
  assert.equal(sent[0].name, 'log_add');
  assert.deepEqual(sent[0].props, { source: 'manual', slot: 'lunch', kcal: 412.46, offline: false });
  for (const n of TRACK_EVENT_NAMES) {
    for (const k of TRACK_PROP_WHITELIST[n]) assert.doesNotMatch(k, /name|note|email|phone|address/);
  }
  assert.equal(logSourceOf('ai_scan'), 'scan');
  assert.equal(logSourceOf('pantry'), 'order');
  assert.equal(logSourceOf('post'), 'kesfet');
  assert.equal(logSourceOf(null), 'manual');
  assert.deepEqual(sanitize({ name: 'streak_day', props: { streak: 3 } }), { streak: 3 });
});

// ─── Sunucu dosyaları ↔ istemci sözleşmesi ───────────────────────────────────
test('migration: ogun_hatirlatma kapalı satır + etkinlik sınırları + 7 olay adı; rollback eşleşir', () => {
  const root = join(__dirname, '../../../../..');
  const up = readFileSync(join(root, 'supabase/migrations/20261109200100_g19_s2_track.sql'), 'utf8');
  const down = readFileSync(join(root, 'supabase/rollbacks/20261109200100_g19_s2_track_rollback.sql'), 'utf8');
  assert.equal(FLAG_DEFAULTS.ogun_hatirlatma, false);
  assert.match(up, /'ogun_hatirlatma', false, 0, '1\.1\.0'/);
  assert.match(up, new RegExp(`minutes <= ${ACTIVITY_MAX_MINUTES}\\b`));
  assert.match(up, new RegExp(`distance_km <= ${ACTIVITY_MAX_KM}\\b`));
  for (const n of TRACK_EVENT_NAMES) {
    assert.match(up, new RegExp(`\\('${n}',`), `migration'da olay yok: ${n}`);
    assert.match(down, new RegExp(`'${n}'`), `rollback'te olay yok: ${n}`);
  }
  assert.match(down, /delete from public\.feature_flags where key = 'ogun_hatirlatma'/);
});
