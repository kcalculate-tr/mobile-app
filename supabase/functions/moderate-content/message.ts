// G63-S1 — DM mesajı (messages) denetimi için SAF yardımcılar (Deno + Node testleri ortak).
// Mesaj 'pending' yazılır; karar: izin → 'sent' (alıcı görür, push gider), ret → 'blocked' (alıcı hiç görmez,
// gönderene nötr hata). Posts'tan farkı: ret durumunda 'pending' KALMAZ — gönderilmemiş sayılır.

export interface MessageRowLite {
  sender_id: string | null
  status: string | null
  body: string | null
  kind: string | null
  deleted_at?: string | null
}

/** Denetlenecek metin (gövde). Yoksa ''. */
export function messageModerationText(row: MessageRowLite): string {
  return typeof row.body === 'string' ? row.body.trim().slice(0, 1000) : ''
}

/** Silinmiş ya da metinsiz mesajda denetlenecek bir şey yok. */
export function messageNeedsModeration(row: MessageRowLite): boolean {
  return !row.deleted_at && messageModerationText(row).length > 0
}

/** Karar sonrası yazılacak durum. */
export function messageDecisionStatus(allow: boolean): 'sent' | 'blocked' {
  return allow ? 'sent' : 'blocked'
}

/** Model istemine eklenen bağlam: özel mesajlarda olağan selamlaşma/pazarlık serbest; spam ve taciz yasak. */
export const MESSAGE_PROMPT_NOTE =
  'This is a PRIVATE DIRECT MESSAGE between two users. Normal greetings, questions, food/fitness talk, ' +
  'meeting plans and sharing contact details with consent are ALLOWED. Block harassment, threats, sexual ' +
  'solicitation, hate, self-harm promotion, scams/phishing and unsolicited commercial spam.'
