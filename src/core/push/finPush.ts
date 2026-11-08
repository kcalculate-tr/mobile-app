// G18-S4 md.3 — FinPush: 4 bildirim şablonu (sipariş durumu · seri · sosyal ·
// hatırlatma). SAF modül (native yok): metin üretimi, karakter sınırları, aksiyon
// kimlikleri ve dokunma hedefi. Native kategori kaydı + aksiyon işleyicileri
// `finPushNative.ts`'te.
//
// Pano kuralları (FinPush):
//  · Başlık ≤ 35, gövde ≤ 90 karakter; 0–2 aksiyon.
//  · Sayım: yer tutucular en uzun hâliyle sayılır — [Ad] ≤ 16, [N] ≤ 3 hane,
//    [KCAL-XXXX] 9 karakter, [Yorum özeti] ≤ 60 (fazlası "…" ile kesilir).
//    Sınırı aşan metin gönderilmez, kısaltılır.
//  · Gizli önizleme: kilit ekranında yalnız uygulama adı + "Bildirim" (iOS) /
//    "İçerik gizli" (Android, kanal PRIVATE). Ad, sipariş no, yorum, öğün yok.

export type FinPushKind = 'order_status' | 'streak' | 'social' | 'reminder';
export type FinLang = 'tr' | 'en';
export type FinMeal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const FIN_PUSH_LIMITS = { title: 35, body: 90, actions: 2, name: 16, count: 3, orderNo: 9, excerpt: 60 } as const;

/** iOS UNNotificationCategory / Android eylem grubu kimlikleri. */
export const FIN_PUSH_CATEGORY: Record<FinPushKind, string> = {
  order_status: 'fin_order',
  streak: 'fin_streak',
  social: 'fin_social',
  reminder: 'fin_reminder',
};

/** Aksiyon kimlikleri (expo-notifications `actionIdentifier`). */
export const FIN_PUSH_ACTION = {
  orderTrack: 'fin_order_track',
  socialReply: 'fin_social_reply',
  remindSnooze: 'fin_remind_snooze_30',
  remindMute: 'fin_remind_mute_today',
} as const;

/** Her şablonun aksiyonları (i18n anahtarlarıyla). */
export const FIN_PUSH_ACTIONS: Record<FinPushKind, { id: string; labelKey: string; textInput?: boolean; foreground: boolean }[]> = {
  order_status: [{ id: FIN_PUSH_ACTION.orderTrack, labelKey: 'push.fin.action_track', foreground: true }],
  streak: [],
  social: [{ id: FIN_PUSH_ACTION.socialReply, labelKey: 'push.fin.action_reply', textInput: true, foreground: false }],
  reminder: [
    { id: FIN_PUSH_ACTION.remindSnooze, labelKey: 'push.fin.action_snooze', foreground: false },
    { id: FIN_PUSH_ACTION.remindMute, labelKey: 'push.fin.action_mute', foreground: false },
  ],
};

/** 30 dk ertele (sn). */
export const FIN_SNOOZE_SECONDS = 30 * 60;

/** Şablon metinleri — i18n sözlüğündeki `push.fin.*` ile BİREBİR (sunucu da bunu okur). */
export const FIN_PUSH_TEXT: Record<FinLang, Record<string, string>> = {
  tr: {
    order_title: 'Siparişin yolda',
    order_body: '%{order} numaralı siparişin kuryede. Tahmini varış %{min} dk.',
    order_body_noeta: '%{order} numaralı siparişin kuryede.',
    streak_title: 'Serin %{n}. gününde',
    streak_body: 'Bugün bir öğün logla, serin devam etsin. Gün bitmeden vaktin var.',
    social_title: '%{name} yorum yaptı',
    social_body: 'Paylaşımına yorum yazdı: “%{excerpt}”',
    reminder_title_breakfast: 'Kahvaltı öğününü henüz loglamadın',
    reminder_title_lunch: 'Öğle öğününü henüz loglamadın',
    reminder_title_dinner: 'Akşam öğününü henüz loglamadın',
    reminder_title_snack: 'Ara öğününü henüz loglamadın',
    reminder_body: 'Şimdi loglarsan günlük dengen güncel kalır. Bir dokunuşla ekleyebilirsin.',
    hidden_preview: 'Bildirim',
  },
  en: {
    order_title: 'Your order is on its way',
    order_body: 'Order %{order} is with the courier. Arriving in about %{min} min.',
    order_body_noeta: 'Order %{order} is with the courier.',
    streak_title: 'Day %{n} of your streak',
    streak_body: 'Log one meal today to keep your streak going. There’s still time.',
    social_title: '%{name} commented',
    social_body: 'Commented on your post: “%{excerpt}”',
    reminder_title_breakfast: 'You haven’t logged breakfast yet',
    reminder_title_lunch: 'You haven’t logged lunch yet',
    reminder_title_dinner: 'You haven’t logged dinner yet',
    reminder_title_snack: 'You haven’t logged a snack yet',
    reminder_body: 'Log now to keep your daily balance up to date. It takes one tap.',
    hidden_preview: 'Notification',
  },
};

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/%\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

/** Metni sınıra kırp: sığmıyorsa "…" ile biter (sınırı aşan metin gönderilmez). */
export function clip(s: string, max: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, Math.max(0, max - 1)).join('').trimEnd() + '…';
}

export function charCount(s: string): number {
  return Array.from(s).length;
}

export type FinPushInput =
  | { kind: 'order_status'; orderNo: string; etaMin?: number | null; orderId?: number }
  | { kind: 'streak'; days: number }
  | { kind: 'social'; name: string; excerpt: string; postId: string; commentId?: string }
  | { kind: 'reminder'; meal: FinMeal };

export interface FinPushMessage {
  title: string;
  body: string;
  categoryId: string;
  /** Dokunma/aksiyon yönlendirmesi — kişisel metin taşımaz (yalnız kimlikler). */
  data: Record<string, string | number>;
}

/** Şablonu doldurur; başlık ≤ 35, gövde ≤ 90 garanti. */
export function renderFinPush(input: FinPushInput, lang: FinLang = 'tr'): FinPushMessage {
  const T = FIN_PUSH_TEXT[lang];
  const L = FIN_PUSH_LIMITS;
  let title = '';
  let body = '';
  const data: Record<string, string | number> = { fin: input.kind };
  switch (input.kind) {
    case 'order_status': {
      const order = clip(input.orderNo, L.orderNo);
      const eta = input.etaMin != null && Number.isFinite(input.etaMin) && input.etaMin > 0
        ? String(Math.min(999, Math.round(input.etaMin)))
        : null;
      title = T.order_title;
      body = eta ? fill(T.order_body, { order, min: eta }) : fill(T.order_body_noeta, { order });
      if (input.orderId != null) data.orderId = input.orderId;
      break;
    }
    case 'streak': {
      title = fill(T.streak_title, { n: String(Math.min(999, Math.max(1, Math.round(input.days)))) });
      body = T.streak_body;
      break;
    }
    case 'social': {
      title = fill(T.social_title, { name: clip(input.name.trim(), L.name) });
      body = fill(T.social_body, { excerpt: clip(input.excerpt.replace(/\s+/g, ' ').trim(), L.excerpt) });
      data.postId = input.postId;
      if (input.commentId) data.commentId = input.commentId;
      break;
    }
    case 'reminder': {
      title = T[`reminder_title_${input.meal}`];
      body = T.reminder_body;
      data.meal = input.meal;
      break;
    }
  }
  return {
    title: clip(title, L.title),
    body: clip(body, L.body),
    categoryId: FIN_PUSH_CATEGORY[input.kind],
    data,
  };
}

/** Dokunma hedefi (aksiyonsuz dokunuş). Saf: navigatör çağrısını tarif eder. */
export type FinPushRoute =
  | { name: 'OrderDetail'; params: { orderId: number } }
  | { name: 'ProfileOrders' }
  | { name: 'Tabs'; params: { screen: 'Tracker'; params?: { finOpenLog?: FinMeal | true } } }
  | { name: 'SharedPost'; params: { postId: string; commentId?: string } }
  | { name: 'KesfetNotifications' };

export function finPushRoute(data: Record<string, unknown>): FinPushRoute | null {
  const kind = data.fin;
  switch (kind) {
    case 'order_status': {
      const id = Number(data.orderId);
      return Number.isFinite(id) && id > 0 ? { name: 'OrderDetail', params: { orderId: id } } : { name: 'ProfileOrders' };
    }
    case 'streak':
      return { name: 'Tabs', params: { screen: 'Tracker', params: { finOpenLog: true } } };
    case 'social': {
      const postId = typeof data.postId === 'string' ? data.postId : null;
      if (!postId) return { name: 'KesfetNotifications' };
      const commentId = typeof data.commentId === 'string' ? data.commentId : undefined;
      return { name: 'SharedPost', params: commentId ? { postId, commentId } : { postId } };
    }
    case 'reminder': {
      const meal = data.meal;
      const ok = meal === 'breakfast' || meal === 'lunch' || meal === 'dinner' || meal === 'snack';
      return { name: 'Tabs', params: { screen: 'Tracker', params: { finOpenLog: ok ? (meal as FinMeal) : true } } };
    }
    default:
      return null;
  }
}

/** "Bugün sessize al": gün sonuna (yerel 23:59:59.999) kadar. */
export function muteUntilEndOfDay(now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Hatırlatma şablonu sessizde mi (ön planda gösterimi bastırmak için). */
export function isReminderMuted(mutedUntil: number | null, now: number = Date.now()): boolean {
  return mutedUntil != null && now <= mutedUntil;
}
