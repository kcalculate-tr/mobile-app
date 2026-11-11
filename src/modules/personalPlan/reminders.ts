// G34-S1 · Tur 26o — Öğün + haftalık tartı hatırlatmaları (yerel bildirim). Saf plan
// `planReminders` (tsx --test) + `syncPlanReminders` (expo-notifications). İzin İSTEMEZ:
// izin yalnız Hatırlatmalar ekranında bağlam içinde `requestPushPermission('personal_plan')`
// ile sorulur (pushPermission.ts tek kapı); reddedilirse akış yine tamamlanır.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { pushGranted } from '../../core/push/pushPermission';
import { translate } from '../../core/i18n/core';
import type { Lang } from '../../core/i18n/dictionaries';
import type { PpMeals, PpReminders } from './types';
import { planReminders } from './reminderPlan';

export { planReminders, toExpoWeekday, type PlannedReminder } from './reminderPlan';

const IDS_KEY = '@kcal_pp_reminder_ids';

async function readIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function cancelPlanReminders(): Promise<void> {
  const ids = await readIds();
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.removeItem(IDS_KEY).catch(() => undefined);
}

/** Eşitler; kurulan bildirim sayısı. İzin yoksa hepsini iptal eder (sormaz). */
export async function syncPlanReminders(meals: PpMeals, r: PpReminders, lang: Lang): Promise<number> {
  try {
    await cancelPlanReminders();
    if (!(await pushGranted())) return 0;
    const plan = planReminders(meals, r);
    const ids: string[] = [];
    for (const p of plan) {
      const slotName = p.slot ? translate(lang, `pp.slot_${p.slot}`) : '';
      const title = p.kind === 'weigh' ? translate(lang, 'pp.ci_reminder_title') : translate(lang, 'pp.meal_reminder_title', { slot: slotName });
      const body = p.kind === 'weigh' ? translate(lang, 'pp.ci_reminder_body') : translate(lang, 'pp.meal_reminder_body');
      const trigger =
        p.kind === 'weigh'
          ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: p.weekday!, hour: p.hour, minute: p.minute, ...(Platform.OS === 'android' ? { channelId: 'default' } : {}) }
          : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: p.hour, minute: p.minute, ...(Platform.OS === 'android' ? { channelId: 'default' } : {}) };
      const id = await Notifications.scheduleNotificationAsync({
        identifier: p.id,
        content: { title, body, data: { pp: p.kind, url: p.kind === 'weigh' ? 'kcal://plan/checkin' : 'kcal://plan/mine' } },
        trigger: trigger as Notifications.NotificationTriggerInput,
      });
      ids.push(id);
    }
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids)).catch(() => undefined);
    return ids.length;
  } catch {
    return 0;
  }
}
