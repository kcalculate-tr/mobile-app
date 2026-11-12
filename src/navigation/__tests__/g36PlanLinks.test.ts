// G36-S1 md.14 — kişisel plan bildirim dokunuşları: haftalık tartı → kcal://plan/checkin (Haftalık
// tartı), öğün hatırlatması → kcal://plan/today (Öğün planı, bugün). Saf eşleyici + linking.ts yolları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN_URL, planLinkTarget, reminderUrl } from '../planLinks';

const ROOT = join(__dirname, '../../..');

test('bildirim türü → URL: tartı → plan/checkin, öğün → plan/today', () => {
  assert.equal(reminderUrl('weigh'), 'kcal://plan/checkin');
  assert.equal(reminderUrl('meal'), 'kcal://plan/today');
});

test('plan/checkin → Haftalık tartı', () => {
  assert.deepEqual(planLinkTarget(PLAN_URL.checkin, '2026-11-12'), { name: 'PersonalPlanCheckin' });
  assert.deepEqual(planLinkTarget('kcal:///plan/checkin/', '2026-11-12'), { name: 'PersonalPlanCheckin' });
});

test('plan/today → Öğün planı bugün (gün + hafta başı Pazartesi); kapalıysa Kişisel planım', () => {
  assert.deepEqual(planLinkTarget(PLAN_URL.today, '2026-11-12'), {
    name: 'MealPlan',
    params: { date: '2026-11-12', weekStart: '2026-11-09' },
    fallback: 'PersonalPlanMine',
  });
  assert.equal(planLinkTarget('https://l.eatkcal.com/plan/today?x=1', '2026-11-15')?.params?.weekStart, '2026-11-09');
});

test('plan/mine → Kişisel planım; plan dışı bağlantılar null', () => {
  assert.deepEqual(planLinkTarget(PLAN_URL.mine, '2026-11-12'), { name: 'PersonalPlanMine' });
  assert.equal(planLinkTarget('kcal://reviews', '2026-11-12'), null);
  assert.equal(planLinkTarget('kcal://plan/other', '2026-11-12'), null);
  assert.equal(planLinkTarget(null, '2026-11-12'), null);
});

test('linking.ts aynı yolları eşler; hatırlatmalar planLinks kullanır; bildirim dinleyicisi data.url okur', () => {
  const linking = readFileSync(join(ROOT, 'src/navigation/linking.ts'), 'utf8');
  assert.match(linking, /PersonalPlanCheckin: PLAN_LINK\.checkin/);
  assert.match(linking, /MealPlan: PLAN_LINK\.today/);
  assert.match(linking, /PersonalPlanMine: PLAN_LINK\.mine/);
  const rem = readFileSync(join(ROOT, 'src/modules/personalPlan/reminders.ts'), 'utf8');
  assert.match(rem, /url: reminderUrl\(p\.kind\)/);
  const notif = readFileSync(join(ROOT, 'src/core/notifications.ts'), 'utf8');
  assert.match(notif, /data\.url\.startsWith\('kcal:\/\/plan\/'\)/);
});
