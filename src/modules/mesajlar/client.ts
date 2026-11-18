// G63-S1 — Mesajlar gerçek istemcisi: Supabase RPC'leri (dm_*), moderate-content ('message'), Realtime
// (postgres_changes messages + broadcast "typing"). Yetki/kural/hız sınırı SUNUCUDA; burası yalnız taşır.
// `core/supabase` tembel yüklenir (Node testlerinde istemci kurulmasın — Keşfet istemcisiyle aynı desen).
// Ekranlar doğrudan buna değil `getDmClient()` üzerinden bağlanır (vitrin/jest mock enjekte eder).
import type {
  DmClient,
  DmConversationMeta,
  DmInboxItem,
  DmMessage,
  DmModerationResult,
  DmPerson,
  DmRealtimeEvent,
  DmSendResult,
} from './types';

type SupabaseModule = typeof import('../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
}

function rpcError(name: string, error: { message: string }): never {
  throw new Error(`${name}: ${error.message}`);
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function normalizePerson(r: Row | null | undefined): DmPerson | null {
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    display_name: str(r.display_name) ?? str(r.handle) ?? '',
    handle: str(r.handle),
    avatar_url: str(r.avatar_url),
    role: str(r.role) ?? 'user',
    verified: r.verified === true,
    is_private: r.is_private === true,
    i_follow: r.i_follow === true,
    follows_me: r.follows_me === true,
    mutual_count: typeof r.mutual_count === 'number' ? r.mutual_count : undefined,
  };
}

export function normalizeMessage(r: Row): DmMessage {
  return {
    id: String(r.id),
    conversation_id: String(r.conversation_id),
    sender_id: str(r.sender_id),
    mine: r.mine === true,
    body: str(r.body),
    kind: (str(r.kind) ?? 'text') as DmMessage['kind'],
    ref: (r.ref && typeof r.ref === 'object' ? r.ref : null) as DmMessage['ref'],
    status: (str(r.status) ?? 'sent') as DmMessage['status'],
    created_at: String(r.created_at),
  };
}

function normalizeInboxItem(r: Row): DmInboxItem {
  return {
    conversation_id: String(r.conversation_id),
    kind: r.kind === 'group' ? 'group' : '1to1',
    muted: r.muted === true,
    last_message_at: String(r.last_message_at),
    other: normalizePerson(r.other as Row),
    last: r.last ? normalizeMessage(r.last as Row) : null,
    unread: typeof r.unread === 'number' ? r.unread : Number(r.unread ?? 0),
  };
}

function normalizeMeta(r: Row): DmConversationMeta {
  return {
    id: String(r.id),
    kind: r.kind === 'group' ? 'group' : '1to1',
    my_state: (str(r.my_state) ?? 'active') as DmConversationMeta['my_state'],
    muted: r.muted === true,
    other: normalizePerson(r.other as Row),
    other_last_read_at: str(r.other_last_read_at),
    receipts: r.receipts === true,
    can_send: r.can_send !== false,
    cannot_reason: (str(r.cannot_reason) as DmConversationMeta['cannot_reason']) ?? null,
  };
}

export const realDmClient: DmClient = {
  async inbox({ tab, cursor = null }) {
    const { data, error } = await sb().rpc('dm_inbox', { p_tab: tab, p_cursor: cursor, p_limit: 30 });
    if (error) rpcError('dm_inbox', error);
    const d = (data ?? {}) as Row;
    return {
      items: Array.isArray(d.items) ? (d.items as Row[]).map(normalizeInboxItem) : [],
      next_cursor: str(d.next_cursor),
      unread: Number(d.unread ?? 0),
      requests: Number(d.requests ?? 0),
    };
  },

  async unreadCount() {
    const { data, error } = await sb().rpc('dm_unread_count');
    if (error) rpcError('dm_unread_count', error);
    const d = (data ?? {}) as Row;
    return { unread: Number(d.unread ?? 0), requests: Number(d.requests ?? 0) };
  },

  async open({ user }) {
    const { data, error } = await sb().rpc('dm_open', { p_user: user });
    if (error) rpcError('dm_open', error);
    return { conversation_id: String((data as Row).conversation_id) };
  },

  async thread({ conversation, before = null }) {
    const { data, error } = await sb().rpc('dm_thread', { p_conversation: conversation, p_before: before, p_limit: 40 });
    if (error) rpcError('dm_thread', error);
    const d = (data ?? {}) as Row;
    return {
      conversation: normalizeMeta((d.conversation ?? {}) as Row),
      messages: Array.isArray(d.messages) ? (d.messages as Row[]).map(normalizeMessage) : [],
      has_more: d.has_more === true,
    };
  },

  async send({ conversation, body, kind, ref = null, idem }): Promise<DmSendResult> {
    // Sunucu yalnız beyaz listedeki ref alanlarını saklar; istemci süsleri (thumb_url vb.) gönderilmez.
    const serverRef = ref
      ? { post_id: ref.post_id, story_id: ref.story_id, name: ref.name, kcal: ref.kcal, protein_g: ref.protein_g }
      : null;
    const { data, error } = await sb().rpc('dm_send', {
      p_conversation: conversation,
      p_body: body,
      p_kind: kind,
      p_ref: serverRef,
      p_idem: idem,
    });
    if (error) rpcError('dm_send', error);
    const d = (data ?? {}) as Row;
    if (d.error === 'rate_limited') return { ok: false, error: 'rate_limited', scope: d.scope === 'requests' ? 'requests' : 'minute' };
    if (typeof d.error === 'string') return { ok: false, error: d.error };
    return {
      ok: true,
      id: String(d.id),
      status: (str(d.status) ?? 'sent') as DmMessage['status'],
      created_at: String(d.created_at),
      needs_moderation: d.needs_moderation === true,
    };
  },

  async moderate({ message }): Promise<DmModerationResult> {
    try {
      const { data, error } = await sb().functions.invoke('moderate-content', {
        body: { target_type: 'message', target_id: message },
      });
      if (error) return 'pending';
      const d = (data ?? {}) as Row;
      if (d.allow === true) return 'sent';
      if (d.allow === false) return 'blocked';
      return 'pending';
    } catch {
      return 'pending';
    }
  },

  async markRead({ conversation }) {
    const { error } = await sb().rpc('dm_mark_read', { p_conversation: conversation });
    if (error) rpcError('dm_mark_read', error);
  },
  async accept({ conversation }) {
    const { error } = await sb().rpc('dm_accept_request', { p_conversation: conversation });
    if (error) rpcError('dm_accept_request', error);
  },
  async decline({ conversation }) {
    const { error } = await sb().rpc('dm_decline_request', { p_conversation: conversation });
    if (error) rpcError('dm_decline_request', error);
  },
  async leave({ conversation }) {
    const { error } = await sb().rpc('dm_leave', { p_conversation: conversation });
    if (error) rpcError('dm_leave', error);
  },
  async mute({ conversation, on }) {
    const { error } = await sb().rpc('dm_mute', { p_conversation: conversation, p_on: on });
    if (error) rpcError('dm_mute', error);
  },
  async deleteMessage({ message }) {
    const { error } = await sb().rpc('dm_delete_message', { p_message: message });
    if (error) rpcError('dm_delete_message', error);
  },
  async searchPeople({ q }) {
    const { data, error } = await sb().rpc('dm_search_people', { q });
    if (error) rpcError('dm_search_people', error);
    const d = (data ?? {}) as Row;
    return {
      items: Array.isArray(d.items) ? ((d.items as Row[]).map(normalizePerson).filter(Boolean) as DmPerson[]) : [],
      suggested: d.suggested === true,
    };
  },
  async report({ targetType, target, reason }) {
    const { error } = await sb().rpc('report_content', { p_target_type: targetType, p_target: target, p_reason: reason });
    if (error) rpcError('report_content', error);
  },
  async block({ user }) {
    const { error } = await sb().rpc('block_user', { p_user: user, p_on: true });
    if (error) rpcError('block_user', error);
  },

  subscribe({ conversation, onEvent }) {
    try {
      const client = sb();
      const name = `dm-msgs-${conversation ?? 'inbox'}-${Math.random().toString(36).slice(2, 8)}`;
      const channel = client
        .channel(name)
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'messages', ...(conversation ? { filter: `conversation_id=eq.${conversation}` } : {}) },
          (payload: { eventType?: string; new?: Row }) => {
            const row = payload.new;
            if (!row || typeof row.id !== 'string') return;
            const e: DmRealtimeEvent = {
              type: payload.eventType === 'INSERT' ? 'insert' : 'update',
              row: {
                id: row.id,
                conversation_id: String(row.conversation_id),
                sender_id: str(row.sender_id),
                body: str(row.body),
                kind: (str(row.kind) ?? 'text') as DmMessage['kind'],
                ref: (row.ref && typeof row.ref === 'object' ? row.ref : null) as DmMessage['ref'],
                status: (str(row.status) ?? 'sent') as DmMessage['status'],
                created_at: String(row.created_at),
                deleted_at: str(row.deleted_at),
              },
            };
            onEvent(e);
          },
        )
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  },

  typing({ conversation, onTyping, onRead }) {
    try {
      const client = sb();
      const channel = client
        .channel(`dm-typing-${conversation}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, (msg: { payload?: { user?: string } }) => {
          if (msg.payload?.user) onTyping(msg.payload.user);
        })
        .on('broadcast', { event: 'read' }, (msg: { payload?: { user?: string } }) => {
          if (msg.payload?.user) onRead?.(msg.payload.user);
        })
        .subscribe();
      let me: string | null = null;
      void client.auth.getSession().then(({ data }) => {
        me = data.session?.user.id ?? null;
      });
      return {
        send: () => {
          if (me) void channel.send({ type: 'broadcast', event: 'typing', payload: { user: me } });
        },
        sendRead: () => {
          if (me) void channel.send({ type: 'broadcast', event: 'read', payload: { user: me } });
        },
        close: () => {
          void client.removeChannel(channel);
        },
      };
    } catch {
      return { send: () => {}, sendRead: () => {}, close: () => {} };
    }
  },
};

let activeClient: DmClient = realDmClient;

export function getDmClient(): DmClient {
  return activeClient;
}
export function setDmClient(c: DmClient): void {
  activeClient = c;
}
export function resetDmClient(): void {
  activeClient = realDmClient;
}
