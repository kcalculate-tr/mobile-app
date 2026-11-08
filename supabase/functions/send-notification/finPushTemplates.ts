// G18-S4 md.3 — FinPush şablon METİNLERİ (yalnız dosya; DEPLOY YOK).
// İstemcideki `src/core/push/finPush.ts` FIN_PUSH_TEXT ile birebir; burada
// send-notification'ın `{{değişken}}` biçimindedir. Başlık ≤ 35, gövde ≤ 90
// (yer tutucular en uzun hâliyle: ad ≤ 16, sayı ≤ 3 hane, sipariş no 9, yorum ≤ 60).
//
// Aksiyon düğmeleri için Expo mesajına `categoryId` (iOS/Android) ve Android
// gizli önizleme için `channelId: 'fin'` eklenmesi gerekir — bu dosya yalnız
// metinleri ve eşlemeyi taşır; send-notification'daki gönderim kodu DEĞİŞMEDİ
// (bkz. docs/night/G18-S4-LOG.md "deploy gerekir").

export type FinTemplateKey =
  | 'fin_order_status'
  | 'fin_streak'
  | 'fin_social'
  | 'fin_reminder_breakfast'
  | 'fin_reminder_lunch'
  | 'fin_reminder_dinner'
  | 'fin_reminder_snack'

export interface FinTemplate {
  title: { tr: string; en: string }
  body: { tr: string; en: string }
  /** expo-notifications kategori kimliği (istemci `useFinPushSetup` kaydeder). */
  categoryId: 'fin_order' | 'fin_streak' | 'fin_social' | 'fin_reminder'
  channelId: 'fin'
  /** Dokunma yönlendirmesi için `data.fin` (kişisel metin taşımaz). */
  fin: 'order_status' | 'streak' | 'social' | 'reminder'
}

const REMINDER_BODY = {
  tr: 'Şimdi loglarsan günlük dengen güncel kalır. Bir dokunuşla ekleyebilirsin.',
  en: 'Log now to keep your daily balance up to date. It takes one tap.',
}

export const FIN_TEMPLATES: Record<FinTemplateKey, FinTemplate> = {
  fin_order_status: {
    title: { tr: 'Siparişin yolda', en: 'Your order is on its way' },
    body: {
      tr: '{{order}} numaralı siparişin kuryede. Tahmini varış {{min}} dk.',
      en: 'Order {{order}} is with the courier. Arriving in about {{min}} min.',
    },
    categoryId: 'fin_order',
    channelId: 'fin',
    fin: 'order_status',
  },
  fin_streak: {
    title: { tr: 'Serin {{n}}. gününde', en: 'Day {{n}} of your streak' },
    body: {
      tr: 'Bugün bir öğün logla, serin devam etsin. Gün bitmeden vaktin var.',
      en: 'Log one meal today to keep your streak going. There’s still time.',
    },
    categoryId: 'fin_streak',
    channelId: 'fin',
    fin: 'streak',
  },
  fin_social: {
    title: { tr: '{{name}} yorum yaptı', en: '{{name}} commented' },
    body: {
      tr: 'Paylaşımına yorum yazdı: “{{excerpt}}”',
      en: 'Commented on your post: “{{excerpt}}”',
    },
    categoryId: 'fin_social',
    channelId: 'fin',
    fin: 'social',
  },
  fin_reminder_breakfast: {
    title: { tr: 'Kahvaltı öğününü henüz loglamadın', en: 'You haven’t logged breakfast yet' },
    body: REMINDER_BODY,
    categoryId: 'fin_reminder',
    channelId: 'fin',
    fin: 'reminder',
  },
  fin_reminder_lunch: {
    title: { tr: 'Öğle öğününü henüz loglamadın', en: 'You haven’t logged lunch yet' },
    body: REMINDER_BODY,
    categoryId: 'fin_reminder',
    channelId: 'fin',
    fin: 'reminder',
  },
  fin_reminder_dinner: {
    title: { tr: 'Akşam öğününü henüz loglamadın', en: 'You haven’t logged dinner yet' },
    body: REMINDER_BODY,
    categoryId: 'fin_reminder',
    channelId: 'fin',
    fin: 'reminder',
  },
  fin_reminder_snack: {
    title: { tr: 'Ara öğününü henüz loglamadın', en: 'You haven’t logged a snack yet' },
    body: REMINDER_BODY,
    categoryId: 'fin_reminder',
    channelId: 'fin',
    fin: 'reminder',
  },
}
