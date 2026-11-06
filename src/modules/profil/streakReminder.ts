/**
 * G15-S4 — Seri hatırlatması (FinSheetNotify / FinPrNotify "Seri hatırlatması").
 *
 * İzin verilirse her gün 19:30 (yerel) bir bildirim. O gün öğün loglandıysa o
 * günün bildirimi kurulmaz/iptal edilir, sıradaki güne kurulur. Mevcut
 * `expo-notifications` paketiyle yerel bildirim (yeni paket YOK); push/DB'ye
 * dokunmaz. Bir kerelik tarihli bildirimler `HORIZON_DAYS` gün ileriye kurulur
 * ve uygulama her açıldığında/öğün loglandığında yeniden eşitlenir.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REMINDER_HOUR, REMINDER_MINUTE, HORIZON_DAYS, planReminderDates } from './streakReminderPlan';

export const REMINDER_IDS_KEY = '@kcal_streak_reminder_ids';
export const LOGGED_DAY_KEY = '@kcal_streak_logged_day';
export const REMINDER_ENABLED_KEY = '@kcal_streak_reminder_enabled';
export { REMINDER_HOUR, REMINDER_MINUTE, HORIZON_DAYS, planReminderDates };

async function readIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Kurulu seri hatırlatmalarını iptal eder (yalnız bu modülün kurdukları). */
export async function cancelStreakReminders(): Promise<void> {
  const ids = await readIds();
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.removeItem(REMINDER_IDS_KEY).catch(() => undefined);
}

/** Kullanıcı tercihi (FinPrNotify "Seri hatırlatması"); varsayılan açık. */
export async function isStreakReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REMINDER_ENABLED_KEY)) !== '0';
  } catch {
    return true;
  }
}

export async function setStreakReminderEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* sessiz */
  }
}

export interface SyncOptions {
  /** Bugün en az bir öğün loglandı mı. */
  loggedToday: boolean;
  title: string;
  body: string;
  now?: Date;
}

/**
 * Hatırlatmaları eşitler. İzin yoksa ya da tercih kapalıysa hepsini iptal eder.
 * Dönüş: kurulan bildirim sayısı.
 */
export async function syncStreakReminder({ loggedToday, title, body, now = new Date() }: SyncOptions): Promise<number> {
  try {
    // Bugün loglandığı bir kez görüldüyse o gün boyunca hatırlanır (aç/kapa
    // anında ekran verisi olmasa da bugünün bildirimi kurulmaz).
    const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (loggedToday) {
      await AsyncStorage.setItem(LOGGED_DAY_KEY, dayKey).catch(() => undefined);
    } else if ((await AsyncStorage.getItem(LOGGED_DAY_KEY).catch(() => null)) === dayKey) {
      loggedToday = true;
    }
    await cancelStreakReminders();
    if (!(await isStreakReminderEnabled())) return 0;
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return 0;

    const ids: string[] = [];
    for (const date of planReminderDates(now, loggedToday)) {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { kind: 'streak_reminder' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
      ids.push(id);
    }
    await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(ids));
    return ids.length;
  } catch (e) {
    console.warn('[streakReminder] sync error:', e);
    return 0;
  }
}
