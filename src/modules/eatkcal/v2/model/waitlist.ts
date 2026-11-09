// eatkcal v2 (G18-S3 md.1) — "Çok yakında" formları: doğrulama + gönderim kuyruğu (SAF).
//
// Tablo `public.eatkcal_waitlist_requests` (supabase/migrations/20261108000300_…,
// CANLIYA UYGULANACAK). Gönderim hiçbir durumda kullanıcıya hata göstermez:
// ekleme başarısızsa (tablo yok, oturum yok, ağ) satır cihaz kuyruğunda kalır ve
// sonraki açılışta yeniden denenir. Çift satır, istemci referansıyla (client_ref)
// sunucuda tekil indeksle engellenir (aynı satır ikinci kez eklenirse 23505 = gönderildi say).

export type WaitlistKind = 'restaurant_add' | 'restaurant_suggest';

export interface WaitlistDraft {
  kind: WaitlistKind;
  country: string;
  city: string;
  restaurant_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  district?: string;
  reason?: string;
  lang?: 'tr' | 'en';
}

export interface QueuedWaitlist extends WaitlistDraft {
  client_ref: string;
  queued_at: string;
}

const trim = (v?: string | null) => (v ?? '').trim();

/** Final: ekle → ad, il, yetkili, telefon, e-posta zorunlu; öner → ad + il. */
export function requiredKeys(kind: WaitlistKind): (keyof WaitlistDraft)[] {
  return kind === 'restaurant_add'
    ? ['restaurant_name', 'city', 'contact_name', 'phone', 'email']
    : ['restaurant_name', 'city'];
}

export function isDraftComplete(d: WaitlistDraft): boolean {
  return requiredKeys(d.kind).every((k) => trim(d[k] as string | undefined).length > 0);
}

/** Boş isteğe bağlı alanlar null'a, metinler kırpılır (sunucu kısıtlarıyla aynı sınırlar). */
export function toRow(q: QueuedWaitlist): Record<string, string | null> {
  const opt = (v: string | undefined, max: number) => {
    const s = trim(v);
    return s ? s.slice(0, max) : null;
  };
  return {
    kind: q.kind,
    country: trim(q.country).slice(0, 16) || 'TR',
    city: trim(q.city).slice(0, 80),
    restaurant_name: trim(q.restaurant_name).slice(0, 120),
    contact_name: opt(q.contact_name, 120),
    phone: opt(q.phone, 32),
    email: opt(q.email, 254),
    website: opt(q.website, 200),
    district: opt(q.district, 80),
    reason: opt(q.reason, 1000),
    lang: q.lang ?? null,
    client_ref: q.client_ref,
  };
}

export function makeQueued(d: WaitlistDraft, now: Date, rand: () => number = Math.random): QueuedWaitlist {
  const ref = `${now.getTime().toString(36)}-${Math.floor(rand() * 1e9).toString(36)}`;
  return { ...d, client_ref: ref, queued_at: now.toISOString() };
}

export type SendResult = 'sent' | 'duplicate' | 'failed';

/** Sunucu hatası → sonuç. 23505 (tekil indeks) = daha önce gönderilmiş. */
export function classifyInsertError(err: { code?: string | null } | null | undefined): SendResult {
  if (!err) return 'sent';
  if (err.code === '23505') return 'duplicate';
  return 'failed';
}

/**
 * Kuyruğu boşalt: her satırı sırayla gönder; gönderilen/çift olanları çıkar,
 * başarısız olanları (tablo yok, oturum yok, ağ) sırasıyla bırak.
 */
export async function flushQueue(
  queue: QueuedWaitlist[],
  send: (row: Record<string, string | null>) => Promise<SendResult>,
): Promise<QueuedWaitlist[]> {
  const left: QueuedWaitlist[] = [];
  for (const q of queue) {
    let r: SendResult = 'failed';
    try {
      r = await send(toRow(q));
    } catch {
      r = 'failed';
    }
    if (r === 'failed') left.push(q);
  }
  return left;
}

/** Kuyruk üst sınırı (cihazda kişisel veri birikmesin). En eskiler düşer. */
export const QUEUE_MAX = 20;

export function enqueue(queue: QueuedWaitlist[], item: QueuedWaitlist): QueuedWaitlist[] {
  const next = [...queue.filter((q) => q.client_ref !== item.client_ref), item];
  return next.length > QUEUE_MAX ? next.slice(next.length - QUEUE_MAX) : next;
}
