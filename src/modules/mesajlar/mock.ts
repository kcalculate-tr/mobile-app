// G63-S1 — Bellek içi Mesajlar istemcisi (YALNIZ __DEV__ vitrini + jest). Sunucu kurallarını rules.ts ile
// uygular: istek kuralı (karşılıklı takip), gizli hesap, iki yönlü engel, hız sınırı (20/dk, 30 istek/gün),
// okundu yalnız iki taraf aktifken, silme 15 dk, denetimde engellenen mesaj alıcıya hiç düşmez.
import { DELETE_WINDOW_MS, RATE, canMessage, recipientState } from './rules';
import type {
  DmClient,
  DmInboxItem,
  DmMemberState,
  DmMessage,
  DmMessageKind,
  DmMessageRef,
  DmPerson,
  DmRealtimeEvent,
  DmSendResult,
} from './types';

export interface MockPerson {
  id: string;
  name: string;
  handle: string;
  role?: string;
  isPrivate?: boolean;
  avatar?: string | null;
}

interface MConv {
  id: string;
  kind: '1to1' | 'group';
  members: Record<string, { state: DmMemberState; lastRead: number | null; muted: boolean; requestFrom?: string; requestAt?: number }>;
  lastAt: number | null;
}

interface MMsg {
  id: string;
  conv: string;
  sender: string;
  body: string | null;
  kind: DmMessageKind;
  ref: DmMessageRef | null;
  status: 'pending' | 'sent' | 'blocked';
  at: number;
  deleted: boolean;
  idem?: string;
}

export interface MockDmOptions {
  me: string;
  people: MockPerson[];
  /** [takip eden, takip edilen] */
  follows?: Array<[string, string]>;
  /** [engelleyen, engellenen] */
  blocks?: Array<[string, string]>;
  now?: () => number;
  /** Denetimde engellenecek metin (içerirse 'blocked'). */
  blockedWords?: string[];
  /** Denetim hizmeti yanıt vermiyor (→ 'pending'). */
  moderationDown?: boolean;
}

export type MockDm = DmClient & {
  /** Test: karşı taraf adına mesaj yaz (Realtime olayı üretir). */
  receive(from: string, conv: string, body: string, opts?: { at?: number; kind?: DmMessageKind; ref?: DmMessageRef }): string;
  /** Test/vitrin: hazır sohbet kur. */
  seed(conv: { id: string; with: string; myState?: DmMemberState; otherState?: DmMemberState; muted?: boolean; messages: Array<{ from: 'me' | 'them'; body: string | null; at: number; kind?: DmMessageKind; ref?: DmMessageRef }>; otherRead?: number | null; myRead?: number | null }): void;
  /** Test: karşı tarafın okuma anı. */
  setOtherRead(conv: string, at: number): void;
  state: { convs: Map<string, MConv>; msgs: MMsg[]; follows: Set<string>; blocks: Set<string> };
  calls: string[];
};

let seq = 0;
const uid = (p: string) => `${p}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function createMockDm(opts: MockDmOptions): MockDm {
  const now = opts.now ?? (() => Date.now());
  const me = opts.me;
  const people = new Map(opts.people.map((p) => [p.id, p]));
  const follows = new Set((opts.follows ?? []).map(([a, b]) => `${a}>${b}`));
  const blocks = new Set((opts.blocks ?? []).map(([a, b]) => `${a}>${b}`));
  const convs = new Map<string, MConv>();
  const msgs: MMsg[] = [];
  const subs = new Set<{ conv: string | null; fn: (e: DmRealtimeEvent) => void }>();
  const calls: string[] = [];

  const isFollow = (a: string, b: string) => follows.has(`${a}>${b}`);
  const isBlocked = (a: string, b: string) => blocks.has(`${a}>${b}`) || blocks.has(`${b}>${a}`);
  const other = (c: MConv, u: string) => Object.keys(c.members).find((x) => x !== u) ?? null;
  const reason = (sender: string, recipient: string) =>
    canMessage({
      self: sender === recipient,
      exists: people.has(recipient),
      blocked: isBlocked(sender, recipient),
      recipientPrivate: !!people.get(recipient)?.isPrivate,
      iFollow: isFollow(sender, recipient),
    });

  const person = (id: string, viewer: string): DmPerson | null => {
    const p = people.get(id);
    if (!p) return null;
    return {
      id: p.id,
      display_name: p.name,
      handle: p.handle,
      avatar_url: p.avatar ?? null,
      role: p.role ?? 'user',
      verified: false,
      is_private: !!p.isPrivate,
      i_follow: isFollow(viewer, id),
      follows_me: isFollow(id, viewer),
    };
  };

  const visibleTo = (m: MMsg, viewer: string) => !m.deleted && (m.status === 'sent' || m.sender === viewer) && !isBlocked(viewer, m.sender === viewer ? '' : m.sender);
  const toMsg = (m: MMsg, viewer: string): DmMessage => ({
    id: m.id,
    conversation_id: m.conv,
    sender_id: m.sender,
    mine: m.sender === viewer,
    body: m.body,
    kind: m.kind,
    ref: m.ref,
    status: m.status,
    created_at: new Date(m.at).toISOString(),
  });
  const emit = (m: MMsg, type: 'insert' | 'update') => {
    // RLS aynası: alıcı yalnız 'sent' + silinmemiş + engelsiz olayı alır; gönderen kendi satırını hep alır.
    for (const s of subs) {
      if (s.conv && s.conv !== m.conv) continue;
      const c = convs.get(m.conv);
      const myState = c?.members[me]?.state;
      if (!c || !(myState === 'active' || myState === 'request')) continue;
      if (m.sender !== me && (m.status !== 'sent' || isBlocked(me, m.sender))) continue;
      s.fn({
        type,
        row: { id: m.id, conversation_id: m.conv, sender_id: m.sender, body: m.body, kind: m.kind, ref: m.ref, status: m.status, created_at: new Date(m.at).toISOString(), deleted_at: m.deleted ? new Date(now()).toISOString() : null },
      });
    }
  };
  const bump = (m: MMsg) => {
    if (m.status !== 'sent') return;
    const c = convs.get(m.conv);
    if (c) c.lastAt = Math.max(c.lastAt ?? 0, m.at);
  };
  const unreadOf = (c: MConv, viewer: string) => {
    const lr = c.members[viewer]?.lastRead ?? 0;
    return msgs.filter((m) => m.conv === c.id && !m.deleted && m.status === 'sent' && m.sender !== viewer && m.at > lr && !isBlocked(viewer, m.sender)).length;
  };
  const counts = () => {
    let unread = 0;
    let requests = 0;
    for (const c of convs.values()) {
      const mm = c.members[me];
      const o = other(c, me);
      if (!mm || c.lastAt == null || (o && isBlocked(me, o))) continue;
      if (mm.state === 'active' && !mm.muted && unreadOf(c, me) > 0) unread += 1;
      if (mm.state === 'request') requests += 1;
    }
    return { unread, requests };
  };
  const req = (c: MConv | undefined, u = me) => {
    if (!c || !c.members[u]) throw new Error('dm: bulunamadi');
    return c;
  };

  const client: MockDm = {
    state: { convs, msgs, follows, blocks },
    calls,

    async inbox({ tab }) {
      calls.push(`inbox:${tab}`);
      const want = tab === 'requests' ? 'request' : 'active';
      const items: DmInboxItem[] = [];
      for (const c of convs.values()) {
        const mm = c.members[me];
        const o = other(c, me);
        if (!mm || mm.state !== want || c.lastAt == null || (o && isBlocked(me, o))) continue;
        const last = msgs.filter((m) => m.conv === c.id && visibleTo(m, me)).sort((a, b) => b.at - a.at)[0];
        items.push({
          conversation_id: c.id,
          kind: c.kind,
          muted: mm.muted,
          last_message_at: new Date(c.lastAt).toISOString(),
          other: o ? person(o, me) : null,
          last: last ? toMsg(last, me) : null,
          unread: unreadOf(c, me),
        });
      }
      items.sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
      return { items, next_cursor: null, ...counts() };
    },

    async unreadCount() {
      calls.push('unread');
      return counts();
    },

    async open({ user }) {
      calls.push(`open:${user}`);
      const r = reason(me, user);
      if (r) throw new Error(`dm_open: ${r}`);
      for (const c of convs.values()) {
        if (c.kind === '1to1' && c.members[me] && c.members[user]) {
          if (c.members[me].state === 'left' || c.members[me].state === 'declined') c.members[me].state = 'active';
          return { conversation_id: c.id };
        }
      }
      const id = uid('conv');
      convs.set(id, {
        id,
        kind: '1to1',
        lastAt: null,
        members: {
          [me]: { state: 'active', lastRead: null, muted: false },
          [user]: { state: recipientState({ iFollow: isFollow(me, user), followsMe: isFollow(user, me) }), lastRead: null, muted: false },
        },
      });
      return { conversation_id: id };
    },

    async thread({ conversation }) {
      calls.push(`thread:${conversation}`);
      const c = req(convs.get(conversation));
      const mm = c.members[me];
      if (!(mm.state === 'active' || mm.state === 'request')) throw new Error('dm_thread: bulunamadi');
      const o = other(c, me);
      if (o && isBlocked(me, o)) throw new Error('dm_thread: engel');
      const om = o ? c.members[o] : null;
      const receipts = !!om && mm.state === 'active' && om.state === 'active';
      const r = o ? reason(me, o) : null;
      return {
        conversation: {
          id: c.id,
          kind: c.kind,
          my_state: mm.state,
          muted: mm.muted,
          other: o ? person(o, me) : null,
          other_last_read_at: receipts && om?.lastRead ? new Date(om.lastRead).toISOString() : null,
          receipts,
          can_send: !r,
          cannot_reason: r,
        },
        messages: msgs.filter((m) => m.conv === c.id && visibleTo(m, me)).sort((a, b) => a.at - b.at).map((m) => toMsg(m, me)),
        has_more: false,
      };
    },

    async send({ conversation, body, kind, ref = null, idem }): Promise<DmSendResult> {
      calls.push(`send:${kind}`);
      const dup = msgs.find((m) => m.sender === me && m.idem === idem);
      if (dup) return { ok: true, id: dup.id, status: dup.status, created_at: new Date(dup.at).toISOString(), needs_moderation: dup.status === 'pending' };
      const c = req(convs.get(conversation));
      const o = other(c, me);
      if (o) {
        const r = reason(me, o);
        if (r) throw new Error(`dm_send: ${r}`);
      }
      const text = (body ?? '').trim() || null;
      if ((kind === 'text' || kind === 'story_reply') && !text) throw new Error('dm_send: bos_mesaj');
      if (text && text.length > 1000) throw new Error('dm_send: cok_uzun');
      const t = now();
      if (msgs.filter((m) => m.sender === me && m.at > t - 60000).length >= RATE.perMinute) return { ok: false, error: 'rate_limited', scope: 'minute' };
      const om = o ? c.members[o] : null;
      if (om && om.state === 'request' && o && isFollow(me, o) && isFollow(o, me)) om.state = 'active';
      if (om && om.state === 'request') {
        const first = !msgs.some((m) => m.conv === c.id && m.sender === me);
        if (first) {
          const day = new Date(t).toDateString();
          let n = 0;
          for (const cc of convs.values()) for (const v of Object.values(cc.members)) if (v.requestFrom === me && v.requestAt && new Date(v.requestAt).toDateString() === day) n += 1;
          if (n >= RATE.requestsPerDay) return { ok: false, error: 'rate_limited', scope: 'requests' };
          om.requestFrom = me;
          om.requestAt = t;
        }
      }
      if (om && om.state === 'left') om.state = 'active';
      c.members[me].state = 'active';
      const m: MMsg = { id: uid('msg'), conv: c.id, sender: me, body: text, kind, ref, status: text ? 'pending' : 'sent', at: t, deleted: false, idem };
      msgs.push(m);
      c.members[me].lastRead = t;
      bump(m);
      emit(m, 'insert');
      return { ok: true, id: m.id, status: m.status, created_at: new Date(t).toISOString(), needs_moderation: m.status === 'pending' };
    },

    async moderate({ message }) {
      calls.push('moderate');
      const m = msgs.find((x) => x.id === message);
      if (!m) return 'pending';
      if (m.status !== 'pending') return m.status === 'sent' ? 'sent' : 'blocked';
      if (opts.moderationDown) return 'pending';
      const bad = (opts.blockedWords ?? []).some((w) => (m.body ?? '').toLocaleLowerCase('tr').includes(w));
      m.status = bad ? 'blocked' : 'sent';
      bump(m);
      emit(m, 'update');
      return m.status;
    },

    async markRead({ conversation }) {
      calls.push('markRead');
      const c = req(convs.get(conversation));
      c.members[me].lastRead = now();
    },
    async accept({ conversation }) {
      calls.push('accept');
      const c = req(convs.get(conversation));
      if (c.members[me].state !== 'request') throw new Error('dm_accept_request: istek_yok');
      c.members[me].state = 'active';
      c.members[me].lastRead = now();
    },
    async decline({ conversation }) {
      calls.push('decline');
      const c = req(convs.get(conversation));
      if (c.members[me].state !== 'request') throw new Error('dm_decline_request: istek_yok');
      c.members[me].state = 'declined';
    },
    async leave({ conversation }) {
      calls.push('leave');
      req(convs.get(conversation)).members[me].state = 'left';
    },
    async mute({ conversation, on }) {
      calls.push(`mute:${on}`);
      req(convs.get(conversation)).members[me].muted = on;
    },
    async deleteMessage({ message }) {
      calls.push('delete');
      const m = msgs.find((x) => x.id === message);
      if (!m || m.sender !== me || m.deleted) throw new Error('dm_delete_message: bulunamadi');
      if (now() - m.at >= DELETE_WINDOW_MS) throw new Error('dm_delete_message: sure_doldu');
      m.deleted = true;
      emit(m, 'update');
    },
    async searchPeople({ q }) {
      calls.push(`search:${q}`);
      const qq = q.trim().replace(/^@/, '').toLocaleLowerCase('tr');
      const ok = (p: MockPerson) => p.id !== me && !reason(me, p.id);
      if (qq.length < 2) {
        const sug = opts.people.filter((p) => ok(p) && (isFollow(me, p.id) || isFollow(p.id, me)));
        sug.sort((a, b) => Number(isFollow(b.id, me) && isFollow(me, b.id)) - Number(isFollow(a.id, me) && isFollow(me, a.id)));
        return { items: sug.slice(0, 8).map((p) => person(p.id, me)!), suggested: true };
      }
      const hits = opts.people.filter((p) => ok(p) && (p.handle.toLocaleLowerCase('tr').includes(qq) || p.name.toLocaleLowerCase('tr').includes(qq)));
      return { items: hits.slice(0, 24).map((p) => ({ ...person(p.id, me)!, mutual_count: 0 })), suggested: false };
    },
    async report({ targetType, target }) {
      calls.push(`report:${targetType}:${target}`);
    },
    async block({ user }) {
      calls.push(`block:${user}`);
      blocks.add(`${me}>${user}`);
    },
    subscribe({ conversation, onEvent }) {
      const s = { conv: conversation ?? null, fn: onEvent };
      subs.add(s);
      return () => {
        subs.delete(s);
      };
    },
    typing() {
      return { send: () => {}, sendRead: () => {}, close: () => {} };
    },

    receive(from, conv, body, o2) {
      const c = convs.get(conv);
      if (!c || !c.members[from]) throw new Error('mock: sohbet yok');
      if (c.members[me]?.state === 'left') c.members[me].state = 'active';
      const m: MMsg = { id: uid('msg'), conv, sender: from, body, kind: o2?.kind ?? 'text', ref: o2?.ref ?? null, status: 'sent', at: o2?.at ?? now(), deleted: false };
      msgs.push(m);
      bump(m);
      emit(m, 'insert');
      return m.id;
    },
    seed(s) {
      const c: MConv = {
        id: s.id,
        kind: '1to1',
        lastAt: null,
        members: {
          [me]: { state: s.myState ?? 'active', lastRead: s.myRead ?? null, muted: !!s.muted },
          [s.with]: { state: s.otherState ?? 'active', lastRead: s.otherRead ?? null, muted: false },
        },
      };
      convs.set(c.id, c);
      for (const x of s.messages) {
        const m: MMsg = { id: uid('msg'), conv: c.id, sender: x.from === 'me' ? me : s.with, body: x.body, kind: x.kind ?? 'text', ref: x.ref ?? null, status: 'sent', at: x.at, deleted: false };
        msgs.push(m);
        bump(m);
      }
    },
    setOtherRead(conv, at) {
      const c = convs.get(conv);
      const o = c ? other(c, me) : null;
      if (c && o) c.members[o].lastRead = at;
    },
  };
  return client;
}
