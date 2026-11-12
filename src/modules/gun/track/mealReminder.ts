// G19-S2 md.5 — Öğün hatırlatmalarını (fin_reminder) yerel bildirim olarak eşitler.
// Plan saf modülde (`mealReminderPlan.ts`). Yalnız yeni kabukta, `hatirlatma`
// davranışı FinPush kategorileri kayıtlıyken çağrılır (TrackerScreen yeniKabuk).
// Aksiyonlar ("30 dk ertele" / "Bugün sessize al") mevcut `finPushNative`
// işleyicisinde: bildirim `data.fin = 'reminder'` + `categoryIdentifier: fin_reminder`.
import { pushGranted } from '../../../core/push/pushPermission';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getSupabaseClient } from '../../../core/supabase';
import { FIN_PUSH_CATEGORY, renderFinPush, type FinLang } from '../../../core/push/finPush';
import { FIN_PUSH_CHANNEL, readReminderMutedUntil } from '../../../core/push/finPushNative';
import { planMealReminders, reminderId, type ReminderPrefs } from './mealReminderPlan';

const IDS_KEY = '@kcal_fin_meal_reminder_ids';

async function readIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function cancelMealReminders(): Promise<void> {
  const ids = await readIds();
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.removeItem(IDS_KEY).catch(() => undefined);
}

async function readPrefs(userId: string): Promise<ReminderPrefs | null> {
  try {
    const { data } = await getSupabaseClient()
      .from('notification_preferences')
      .select('reminder_enabled,quiet_hours_start,quiet_hours_end')
      .eq('user_id', userId)
      .maybeSingle();
    return (data as ReminderPrefs | null) ?? null;
  } catch {
    return null;
  }
}

export interface MealReminderSync {
  userId: string;
  lang: FinLang;
  loggedToday: ReadonlySet<string>;
  recentlyActive: boolean;
  now?: Date;
}

/** Eşitler; kurulan bildirim sayısını döner. İzin yoksa hepsini iptal eder. */
export async function syncMealReminders(opts: MealReminderSync): Promise<number> {
  try {
    await cancelMealReminders();
    // G26-S1: izin İSTEMEZ — tek fonksiyona sorar, yoksa sessizce geçer.
    if (!(await pushGranted())) return 0;
    const [prefs, mutedUntil] = await Promise.all([readPrefs(opts.userId), readReminderMutedUntil()]);
    const plan = planMealReminders({
      now: opts.now ?? new Date(),
      loggedToday: opts.loggedToday,
      prefs,
      mutedUntil,
      recentlyActive: opts.recentlyActive,
    });
    const ids: string[] = [];
    for (const r of plan) {
      const msg = renderFinPush({ kind: 'reminder', meal: r.meal }, opts.lang);
      const id = await Notifications.scheduleNotificationAsync({
        identifier: reminderId(r),
        content: {
          title: msg.title,
          body: msg.body,
          data: msg.data,
          categoryIdentifier: FIN_PUSH_CATEGORY.reminder,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.date,
          ...(Platform.OS === 'android' ? { channelId: FIN_PUSH_CHANNEL } : {}),
        },
      });
      ids.push(id);
    }
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids)).catch(() => undefined);
    return ids.length;
  } catch (e) {
    if (__DEV__) console.warn('[mealReminder] sync error:', e);
    return 0;
  }
}
