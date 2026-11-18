// G63-S1 — Yeni mesaj push metinleri. KOD SABİTİ = sunucu tetikleyicisi `fn_push_dm_message`
// (20261118140100_g63_mesajlar.sql) ile BİREBİR (birim testi metni karşılaştırır).
// Metinler İlter onayı bekler (LOG "SORULAR" — önerilen metin bu dosyadakiyle aynı).
//   sohbet : "%{ad}: %{mesajın ilk 60 karakteri}"
//   istek  : "%{ad} sana mesaj göndermek istiyor"  (isteğin yalnız ilk mesajında)
// Sosyal push'lar gibi yalnız Türkçe gönderilir (fn_push_social_notification deseni).
import { PUSH_SNIPPET } from './rules';
import type { DmMessageKind } from './types';

export const DM_PUSH_TEXT = {
  title: 'Kcalculate',
  message: '%{ad}: %{metin}',
  request: '%{ad} sana mesaj göndermek istiyor',
  fallback: {
    post: 'Bir gönderi paylaştı',
    meal: 'Bir öğün paylaştı',
    story_reply: 'Hikâyene yanıt verdi',
    text: 'Yeni mesaj',
  } satisfies Record<DmMessageKind, string>,
  deepLinkPrefix: 'kcal://dm/',
} as const;

/** Sunucudaki gövde üretiminin aynası (test ve LOG örnekleri için). */
export function dmPushBody(i: { name: string; body: string | null; kind: DmMessageKind; request: boolean }): string {
  const name = i.name || 'Biri';
  if (i.request) return DM_PUSH_TEXT.request.replace('%{ad}', name);
  let snip = (i.body ?? '').replace(/\s+/g, ' ').trim();
  if (snip.length > PUSH_SNIPPET) snip = snip.slice(0, PUSH_SNIPPET);
  if (!snip) snip = DM_PUSH_TEXT.fallback[i.kind];
  return DM_PUSH_TEXT.message.replace('%{ad}', name).replace('%{metin}', snip);
}
