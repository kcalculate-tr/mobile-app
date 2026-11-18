// G63-S1 — Mesajlar (DM) tipleri. Sunucu biçimi: supabase/migrations/20261118140100_g63_mesajlar.sql
// (dm_person_json, dm_message_json, dm_inbox, dm_thread). İstemci yalnız gösterir; kurallar sunucuda.

export type DmMemberState = 'active' | 'request' | 'declined' | 'left';
export type DmMessageKind = 'text' | 'post' | 'story_reply' | 'meal';
/** 'pending' = AI denetimi bekliyor (yalnız gönderen görür); 'blocked' = denetimde engellendi. */
export type DmMessageStatus = 'pending' | 'sent' | 'blocked';

export interface DmPerson {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  role: 'user' | 'kurum' | 'diyetisyen' | 'pt' | 'moderator' | string;
  verified: boolean;
  is_private: boolean;
  i_follow: boolean;
  follows_me: boolean;
  /** Yalnız arama sonucu: ortak takip sayısı. */
  mutual_count?: number;
}

export interface DmMessageRef {
  post_id?: string;
  story_id?: string;
  name?: string;
  kcal?: number;
  protein_g?: number;
  /** İstemci süsü (sunucu saklamaz): hikâye küçük görseli / gönderi önizlemesi. */
  thumb_url?: string | null;
  text?: string | null;
  author?: string | null;
}

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  mine: boolean;
  body: string | null;
  kind: DmMessageKind;
  ref: DmMessageRef | null;
  status: DmMessageStatus;
  created_at: string;
  /** Yalnız istemci: gönderiliyor (iyimser) / gönderilemedi. */
  local?: 'sending' | 'failed' | 'blocked';
  /** Yalnız istemci: yeniden deneme için aynı anahtar. */
  idem?: string;
}

export interface DmInboxItem {
  conversation_id: string;
  kind: '1to1' | 'group';
  muted: boolean;
  last_message_at: string;
  other: DmPerson | null;
  last: DmMessage | null;
  unread: number;
}

export interface DmInboxPage {
  items: DmInboxItem[];
  next_cursor: string | null;
  unread: number;
  requests: number;
}

export type DmCannotReason = 'kendine' | 'bulunamadi' | 'engel' | 'gizli_hesap';

export interface DmConversationMeta {
  id: string;
  kind: '1to1' | 'group';
  my_state: DmMemberState;
  muted: boolean;
  other: DmPerson | null;
  /** Yalnız iki taraf da 'active' iken dolu (istekte okundu bilgisi yok). */
  other_last_read_at: string | null;
  /** Okundu + yazıyor göstergesi açık mı (iki taraf da 'active'). */
  receipts: boolean;
  can_send: boolean;
  cannot_reason: DmCannotReason | null;
}

export interface DmThread {
  conversation: DmConversationMeta;
  messages: DmMessage[];
  has_more: boolean;
}

export type DmSendResult =
  | { ok: true; id: string; status: DmMessageStatus; created_at: string; needs_moderation: boolean }
  | { ok: false; error: 'rate_limited'; scope: 'minute' | 'requests' }
  | { ok: false; error: string };

export type DmModerationResult = 'sent' | 'blocked' | 'pending';

export interface DmSearchResult {
  items: DmPerson[];
  suggested: boolean;
}

/** Realtime olayı (messages INSERT/UPDATE). */
export interface DmRealtimeEvent {
  type: 'insert' | 'update';
  row: {
    id: string;
    conversation_id: string;
    sender_id: string | null;
    body: string | null;
    kind: DmMessageKind;
    ref: DmMessageRef | null;
    status: DmMessageStatus;
    created_at: string;
    deleted_at: string | null;
  };
}

export interface DmClient {
  inbox(input: { tab: 'all' | 'requests'; cursor?: string | null }): Promise<DmInboxPage>;
  unreadCount(): Promise<{ unread: number; requests: number }>;
  open(input: { user: string }): Promise<{ conversation_id: string }>;
  thread(input: { conversation: string; before?: string | null }): Promise<DmThread>;
  send(input: { conversation: string; body: string | null; kind: DmMessageKind; ref?: DmMessageRef | null; idem: string }): Promise<DmSendResult>;
  /** AI denetimi (moderate-content `message`). Hata → 'pending' (sunucu yeniden dener). */
  moderate(input: { message: string }): Promise<DmModerationResult>;
  markRead(input: { conversation: string }): Promise<void>;
  accept(input: { conversation: string }): Promise<void>;
  decline(input: { conversation: string }): Promise<void>;
  leave(input: { conversation: string }): Promise<void>;
  mute(input: { conversation: string; on: boolean }): Promise<void>;
  deleteMessage(input: { message: string }): Promise<void>;
  searchPeople(input: { q: string }): Promise<DmSearchResult>;
  report(input: { targetType: 'message' | 'conversation'; target: string; reason: string }): Promise<void>;
  block(input: { user: string }): Promise<void>;
  /** Realtime abonelik; dönüş = aboneliği kapat. Bağlantı yoksa no-op. */
  subscribe(input: { conversation?: string | null; onEvent: (e: DmRealtimeEvent) => void }): () => void;
  /**
   * Yazıyor + okundu yayını (Realtime broadcast; DB'ye yazılmaz). Yalnız receipts açıkken (iki taraf aktif) kurulur.
   * `sendRead` karşı tarafın "Görüldü"sünü anında günceller; kalıcı kaynak yine dm_thread.other_last_read_at.
   */
  typing(input: { conversation: string; onTyping: (userId: string) => void; onRead?: (userId: string) => void }): {
    send: () => void;
    sendRead: () => void;
    close: () => void;
  };
}
