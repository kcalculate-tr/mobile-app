// G18-S4 md.3 — FinPush native bağı: expo-notifications kategorileri (iOS
// UNNotificationCategory / Android eylem düğmeleri), gizli önizleme, aksiyon
// işleyicileri. Şablon metinleri ve kurallar saf modülde (`finPush.ts`).
//
// Kayıt YALNIZ yeni kabukta (`useFinPushSetup`, TabNavigatorR3) yapılır → bayrak
// kapalıyken uygulamanın bildirim davranışı bugünküyle aynı (kategori/kanal yok).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FIN_PUSH_ACTION,
  FIN_PUSH_ACTIONS,
  FIN_PUSH_CATEGORY,
  FIN_SNOOZE_SECONDS,
  finPushRoute,
  isReminderMuted,
  muteUntilEndOfDay,
  type FinPushKind,
} from './finPush';

export const FIN_PUSH_CHANNEL = 'fin';
export const FIN_REMINDER_MUTED_KEY = '@kcal_fin_reminder_muted_until';

type Translate = (key: string) => string;

/** Kategorileri (aksiyonlar + gizli önizleme) ve Android kanalını kaydeder. */
export async function registerFinPushCategories(t: Translate): Promise<void> {
  const kinds = Object.keys(FIN_PUSH_CATEGORY) as FinPushKind[];
  for (const kind of kinds) {
    const actions: Notifications.NotificationAction[] = FIN_PUSH_ACTIONS[kind].map((a) => ({
      identifier: a.id,
      buttonTitle: t(a.labelKey),
      ...(a.textInput
        ? {
            textInput: {
              submitButtonTitle: t('push.fin.action_reply_send'),
              placeholder: t('push.fin.action_reply_placeholder'),
            },
          }
        : {}),
      options: { opensAppToForeground: a.foreground },
    }));
    await Notifications.setNotificationCategoryAsync(FIN_PUSH_CATEGORY[kind], actions, {
      // Kilit ekranında önizleme kapalıysa: yalnız uygulama adı + "Bildirim".
      previewPlaceholder: t('push.fin.hidden_preview'),
      showTitle: false,
      showSubtitle: false,
    }).catch(() => undefined);
  }
  if (Platform.OS === 'android') {
    // Android kilit ekranı: PRIVATE → sistem "İçerik gizli" gösterir.
    await Notifications.setNotificationChannelAsync(FIN_PUSH_CHANNEL, {
      name: t('push.fin.channel_name'),
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: 'default',
    }).catch(() => undefined);
  }
}

/** Yeni kabukta bir kez (dil değişince yeniden) kaydet. */
export function useFinPushSetup(t: Translate, lang: string): void {
  useEffect(() => {
    void registerFinPushCategories(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
}

export async function readReminderMutedUntil(): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(FIN_REMINDER_MUTED_KEY);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Ön planda gelen bildirim: sessizdeki hatırlatma gösterilmez. */
export async function shouldSuppressFinPush(data: Record<string, unknown> | undefined): Promise<boolean> {
  if (!data || data.fin !== 'reminder') return false;
  return isReminderMuted(await readReminderMutedUntil());
}

export function isFinPushData(data: unknown): boolean {
  return !!data && typeof data === 'object' && typeof (data as Record<string, unknown>).fin === 'string';
}

type Nav = { isReady: () => boolean; navigate: (...args: any[]) => void };

export interface FinPushDeps {
  /** Sosyal "Yanıtla": yorumu gönder (Keşfet istemcisi). */
  reply?: (p: { postId: string; parentId: string | null; body: string; key: string }) => Promise<void>;
}

/**
 * Bildirim yanıtını işler. `true` → FinPush'tı ve işlendi (çağıran başka iş yapmaz).
 */
export async function handleFinPushResponse(
  response: Notifications.NotificationResponse,
  nav: Nav | null,
  deps: FinPushDeps = {},
): Promise<boolean> {
  const req = response.notification.request;
  const data = (req.content.data ?? {}) as Record<string, unknown>;
  if (!isFinPushData(data)) return false;
  const action = response.actionIdentifier;
  const dismiss = () => Notifications.dismissNotificationAsync(req.identifier).catch(() => undefined);

  if (action === FIN_PUSH_ACTION.remindSnooze) {
    await dismiss();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: req.content.title ?? undefined,
        body: req.content.body ?? undefined,
        data,
        categoryIdentifier: FIN_PUSH_CATEGORY.reminder,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: FIN_SNOOZE_SECONDS },
    }).catch(() => undefined);
    return true;
  }

  if (action === FIN_PUSH_ACTION.remindMute) {
    await dismiss();
    await AsyncStorage.setItem(FIN_REMINDER_MUTED_KEY, String(muteUntilEndOfDay())).catch(() => undefined);
    // Bugün için kurulmuş (ertelenmiş) hatırlatmaları da iptal et.
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const end = muteUntilEndOfDay();
      await Promise.all(
        all
          .filter((n) => (n.content.data as Record<string, unknown> | undefined)?.fin === 'reminder')
          .filter((n) => {
            const trig = n.trigger as { type?: string; seconds?: number; value?: number } | null;
            if (trig && typeof trig.seconds === 'number') return Date.now() + trig.seconds * 1000 <= end;
            if (trig && typeof trig.value === 'number') return trig.value <= end;
            return true;
          })
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
    } catch {
      /* sessiz */
    }
    return true;
  }

  if (action === FIN_PUSH_ACTION.socialReply) {
    const body = (response.userText ?? '').trim();
    const postId = typeof data.postId === 'string' ? data.postId : null;
    if (body && postId && deps.reply) {
      try {
        await deps.reply({
          postId,
          parentId: typeof data.commentId === 'string' ? data.commentId : null,
          body: body.slice(0, 500),
          key: `push-reply-${req.identifier}`,
        });
        await dismiss();
        return true;
      } catch {
        // Gönderilemezse yorumlara aç (kullanıcı yeniden dener).
      }
    }
  }

  // Varsayılan dokunuş + "Siparişi izle" + gönderilemeyen yanıt → hedef ekran.
  const route = finPushRoute(data);
  if (route && nav) {
    const go = () => {
      if (!nav.isReady()) return;
      if ('params' in route) nav.navigate(route.name, route.params);
      else nav.navigate(route.name);
    };
    if (nav.isReady()) go();
    else setTimeout(go, 500); // soğuk açılış: navigatör hazır olsun (mevcut dinleyiciyle aynı)
  }
  return true;
}
