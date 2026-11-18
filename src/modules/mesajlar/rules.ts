// G63-S1 — Mesajlar SAF kuralları. Sunucu (20261118140100_g63_mesajlar.sql) TEK KAYNAKTIR; burası onun aynası:
// istemci düğmeleri/uyarıları aynı sırayla gösterir, mock istemci (vitrin + jest) aynı kuralları uygular.
// Birim testi (g63Dm.test.ts) iki tarafın aynı sabitleri taşıdığını denetler.
import type {
  DmCannotReason,
  DmConversationMeta,
  DmInboxItem,
  DmMemberState,
  DmMessage,
  DmRealtimeEvent,
} from './types';

/** Gövde sınırı (messages.body ≤ 1000). */
export const BODY_MAX = 1000;
/** Sunucu hız sınırları (dm_send). */
export const RATE = { perMinute: 20, requestsPerDay: 30 } as const;
/** Kendi mesajını silme süresi (dm_delete_message). */
export const DELETE_WINDOW_MS = 15 * 60 * 1000;
/** Push önizlemesi (fn_push_dm_message `left(v_snip, 60)`). */
export const PUSH_SNIPPET = 60;

// ─── Gönderebilir mi? (dm_can_message ile AYNI SIRA) ──────────────────────────
export interface CanMessageInput {
  self: boolean;
  exists: boolean;
  /** İki yönlü: ben onu ya da o beni engellediyse. */
  blocked: boolean;
  recipientPrivate: boolean;
  /** Ben alıcıyı (onaylı) takip ediyor muyum. */
  iFollow: boolean;
}

export function canMessage(i: CanMessageInput): DmCannotReason | null {
  if (i.self) return 'kendine';
  if (!i.exists) return 'bulunamadi';
  if (i.blocked) return 'engel';
  if (i.recipientPrivate && !i.iFollow) return 'gizli_hesap';
  return null;
}

/** İstek kuralı: karşılıklı takip yoksa alıcının durumu 'request'. */
export function recipientState(i: { iFollow: boolean; followsMe: boolean }): DmMemberState {
  return i.iFollow && i.followsMe ? 'active' : 'request';
}

// ─── Hız sınırı (sunucu kararı; istemci yalnız hata metnini seçer) ─────────────
export function rateLimitScope(i: { sentLastMinute: number; requestsToday: number; isNewRequest: boolean }): 'minute' | 'requests' | null {
  if (i.sentLastMinute >= RATE.perMinute) return 'minute';
  if (i.isNewRequest && i.requestsToday >= RATE.requestsPerDay) return 'requests';
  return null;
}

// ─── Okundu / yazıyor ─────────────────────────────────────────────────────────
/**
 * "Görüldü" hangi mesajın altında? Yalnız receipts (iki taraf aktif) açıkken; karşı tarafın okuma anından
 * önce/aynı anda gönderilmiş SON kendi mesajım. Bundan sonra karşı taraf yazdıysa gösterilmez.
 */
export function seenMessageId(meta: Pick<DmConversationMeta, 'receipts' | 'other_last_read_at'>, messages: DmMessage[]): string | null {
  if (!meta.receipts || !meta.other_last_read_at) return null;
  const read = Date.parse(meta.other_last_read_at);
  if (!Number.isFinite(read)) return null;
  const visible = messages.filter((m) => !m.local && m.status === 'sent');
  const last = visible[visible.length - 1];
  if (!last || !last.mine) return null;
  return Date.parse(last.created_at) <= read ? last.id : null;
}

/** Yazıyor yayını yalnız iki taraf da aktifken gönderilir/gösterilir. */
export function typingAllowed(meta: Pick<DmConversationMeta, 'receipts'> | null | undefined): boolean {
  return !!meta?.receipts;
}

// ─── Silme ────────────────────────────────────────────────────────────────────
export function canDeleteMessage(m: Pick<DmMessage, 'mine' | 'created_at' | 'local'>, now: number): boolean {
  if (!m.mine || m.local === 'sending') return false;
  const t = Date.parse(m.created_at);
  return Number.isFinite(t) && now - t < DELETE_WINDOW_MS;
}

// ─── İstek güvenliği: bağlantı / telefon içeren ilk mesaj ──────────────────────
const LINK_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\.(com|net|org|io|me|app|co|tr|ly|link|xyz|info|biz|shop)(\/\S*)?\b/i;
// 10–13 hane (boşluk, tire, nokta, parantez serbest), isteğe bağlı +.
const PHONE_RE = /(\+?\d[\d\s().-]{8,16}\d)/;

export function hasLinkOrPhone(text: string | null | undefined): boolean {
  if (!text) return false;
  if (LINK_RE.test(text)) return true;
  const m = text.match(PHONE_RE);
  if (!m) return false;
  const digits = m[1].replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

// ─── Hata kodu → metin anahtarı (nötr; ayrıntı sızdırmaz) ─────────────────────
export type DmErrorKey =
  | 'dm.err.blocked'
  | 'dm.err.private'
  | 'dm.err.rate_minute'
  | 'dm.err.rate_requests'
  | 'dm.err.not_sent'
  | 'dm.err.delete_window'
  | 'dm.err.closed'
  | 'dm.err.too_long'
  | 'dm.err.generic';

/** "dm_send: engel" → "engel". */
export function rpcCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const m = msg.match(/:\s*([a-z_]+)\s*$/);
  return m ? m[1] : msg.trim();
}

export function errorKey(code: string, scope?: 'minute' | 'requests'): DmErrorKey {
  switch (code) {
    case 'engel':
    case 'bulunamadi':
    case 'kendine':
      return 'dm.err.blocked';
    case 'gizli_hesap':
      return 'dm.err.private';
    case 'rate_limited':
      return scope === 'requests' ? 'dm.err.rate_requests' : 'dm.err.rate_minute';
    case 'blocked':
      return 'dm.err.not_sent';
    case 'sure_doldu':
      return 'dm.err.delete_window';
    case 'kapali':
      return 'dm.err.closed';
    case 'cok_uzun':
      return 'dm.err.too_long';
    default:
      return 'dm.err.generic';
  }
}

// ─── Gelen kutusu önizlemesi ───────────────────────────────────────────────────
type Tr = (key: string, vars?: Record<string, string | number>) => string;

export function previewText(item: Pick<DmInboxItem, 'last'>, tr: Tr): string {
  const m = item.last;
  if (!m) return '';
  let core: string;
  if (m.kind === 'post' && !m.body) core = tr('dm.preview.post');
  else if (m.kind === 'meal' && !m.body) core = tr('dm.preview.meal');
  else if (m.kind === 'story_reply') core = m.mine ? tr('dm.preview.story_reply_mine', { text: m.body ?? '' }) : tr('dm.preview.story_reply', { text: m.body ?? '' });
  else core = (m.body ?? '').replace(/\s+/g, ' ').trim();
  return m.mine && m.kind !== 'story_reply' ? tr('dm.preview.you', { text: core }) : core;
}

/** Göreli zaman: "[N] dk" · "[N] sa" · "Dün" · "[N] g" (FinInbox). */
export function relTime(iso: string, now: number, tr: Tr): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return tr('dm.time.now');
  if (min < 60) return tr('dm.time.min', { n: min });
  const h = Math.floor(min / 60);
  const d0 = new Date(now);
  const startToday = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
  if (t >= startToday) return tr('dm.time.hour', { n: h });
  if (t >= startToday - 86400000) return tr('dm.time.yday');
  return tr('dm.time.day', { n: Math.max(2, Math.ceil((startToday - t) / 86400000)) });
}

// ─── Sohbet zaman çizelgesi (gün çipleri) ──────────────────────────────────────
export type TimelineRow =
  | { type: 'chip'; key: string; at: string }
  | { type: 'msg'; key: string; msg: DmMessage; first: boolean; last: boolean };

/** Gün değişince ya da 60 dk'dan uzun arada "Bugün 09:12" çipi; ardışık aynı gönderen balonları gruplanır. */
export function timeline(messages: DmMessage[]): TimelineRow[] {
  const out: TimelineRow[] = [];
  let prev: DmMessage | null = null;
  messages.forEach((m, i) => {
    const t = Date.parse(m.created_at);
    const pt = prev ? Date.parse(prev.created_at) : NaN;
    const newDay = !prev || new Date(t).toDateString() !== new Date(pt).toDateString() || t - pt > 60 * 60000;
    if (newDay) out.push({ type: 'chip', key: `chip-${m.id}`, at: m.created_at });
    const next = messages[i + 1];
    const sameAsPrev = !!prev && !newDay && prev.mine === m.mine;
    const nt = next ? Date.parse(next.created_at) : NaN;
    const nextBreaks = !next || next.mine !== m.mine || new Date(nt).toDateString() !== new Date(t).toDateString() || nt - t > 60 * 60000;
    out.push({ type: 'msg', key: m.id, msg: m, first: !sameAsPrev, last: nextBreaks });
    prev = m;
  });
  return out;
}

// ─── Realtime birleştirme ───────────────────────────────────────────────────────
function byTime(a: DmMessage, b: DmMessage): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at) || (a.id < b.id ? -1 : 1);
}

/**
 * messages INSERT/UPDATE olayını listeye uygular: silinen/engellenen çıkar; 'sent' olan eklenir ya da güncellenir.
 * Karşı tarafın 'pending' mesajı RLS'ten zaten gelmez; yine de yalnız kendi pending'imi tutarım.
 */
export function applyRealtime(list: DmMessage[], e: DmRealtimeEvent, myId: string | null): DmMessage[] {
  const r = e.row;
  const mine = !!myId && r.sender_id === myId;
  const gone = !!r.deleted_at || (r.status === 'blocked' && !mine) || (r.status === 'pending' && !mine);
  const idx = list.findIndex((m) => m.id === r.id);
  if (gone) return idx === -1 ? list : list.filter((m) => m.id !== r.id);
  const msg: DmMessage = {
    id: r.id,
    conversation_id: r.conversation_id,
    sender_id: r.sender_id,
    mine,
    body: r.body,
    kind: r.kind,
    ref: idx === -1 ? r.ref : { ...(list[idx].ref ?? {}), ...(r.ref ?? {}) },
    status: r.status,
    created_at: r.created_at,
    local: mine && r.status === 'blocked' ? 'blocked' : undefined,
  };
  if (idx === -1) return [...list, msg].sort(byTime);
  const next = list.slice();
  next[idx] = { ...list[idx], ...msg, idem: list[idx].idem };
  return next;
}

/** Benzersiz idempotency anahtarı (paket yok). */
export function newIdem(): string {
  return `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Rozet metni (Keşfet başlığı). */
export function badgeText(n: number): string {
  return n > 9 ? '9+' : String(n);
}

/** Gövde kırpma (gönderim öncesi). */
export function cleanBody(s: string): string {
  return s.replace(/\r\n/g, '\n').trim().slice(0, BODY_MAX);
}

/**
 * PublicProfile "Mesaj" düğmesi görünür mü? Sunucu kuralının istemci ön süzgeci: gizli hesaba yalnız onaylı
 * takipçi yazabilir (engelli profilde düğme zaten çizilmez). Asıl karar dm_open / dm_send'de.
 */
export function canMessageProfile(p: { is_private?: boolean | null; me_following?: string | null }): boolean {
  return !p.is_private || p.me_following === 'following';
}
