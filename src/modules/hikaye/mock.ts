// G59-S1 — Bellek içi hikâye istemcisi: sunucu kurallarını BİREBİR uygular (testler + __DEV__ vitrini).
//   • 24 saat: süresi dolan tepside/aktif listede yok; sahibinin arşivinde ve öne çıkanlarda kalır.
//   • Gizlilik: gizli hesabın hikâyesi yalnız onaylı takipçiye; engel (iki yön) → görünmez.
//   • Tepsi: kendi + takip edilenler + herkese açık resmi hesaplar; görülmemiş önce.
//   • Görüldü: kendi hikâyen sayılmaz; tekrar işaret yeni satır açmaz.
//   • Tepki: kendi hikâyene yok; aç/kapa. Anket: kişi başı tek oy, değişmez; sonuç oy veren + sahibine.
//   • Bayrak kapalıyken create_story / öne çıkan yazma reddedilir.
import { hasModeratedText, overlaysValid, parseOverlays } from './overlays';
import { STORY_TTL_MS } from './rules';
import type {
  CreateStoryInput,
  CreateStoryResult,
  Highlight,
  Story,
  StoryClient,
  StoryReactionKind,
  StoryViewersResult,
  TrayItem,
} from './types';

export interface MockUser {
  id: string;
  name: string;
  handle: string | null;
  avatar_url?: string | null;
  is_private?: boolean;
  official?: boolean;
}
interface StoryRow extends Omit<Story, 'seen' | 'my_reactions' | 'my_votes' | 'poll_results' | 'view_count'> {
  deleted_at: string | null;
  idem: string | null;
}
interface HighlightRow {
  id: string;
  owner: string;
  title: string;
  cover: string | null;
  sort: number;
  items: string[];
}

export interface MockWorld {
  me: string;
  users: MockUser[];
  follows: Array<[string, string]>; // [follower, following]
  blocks: Array<[string, string]>; // [blocker, blocked]
  stories: StoryRow[];
  views: Array<{ story: string; viewer: string; at: string }>;
  reactions: Array<{ story: string; user: string; kind: StoryReactionKind; at: string }>;
  votes: Array<{ story: string; sticker: string; user: string; option: number }>;
  events: Array<{ story: string; sticker: string; user: string; action: 'tap' | 'add_log' }>;
  highlights: HighlightRow[];
  consumptions: Array<{ id: string; user: string; source: string; ref: string; name: string; kcal: number }>;
  reports: Array<{ story: string; reason: string; reporter: string }>;
  flags: { hikaye: boolean; kesfet_video: boolean };
  now: () => number;
}

const err = (code: string) => new Error(code);

export function createMockStoryClient(world: MockWorld): StoryClient & { world: MockWorld } {
  const W = world;
  const user = (id: string) => W.users.find((u) => u.id === id);
  const blocked = (a: string, b: string) => W.blocks.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const follows = (a: string, b: string) => W.follows.some(([x, y]) => x === a && y === b);
  const canViewAuthor = (viewer: string, author: string) =>
    !blocked(viewer, author) && (viewer === author || !user(author)?.is_private || follows(viewer, author));
  const inHighlight = (sid: string) => W.highlights.some((h) => h.items.includes(sid));
  const active = (s: StoryRow) => Date.parse(s.expires_at) > W.now();
  const canView = (viewer: string, s: StoryRow) =>
    !s.deleted_at &&
    (s.author_id === viewer ||
      (s.status === 'published' && canViewAuthor(viewer, s.author_id) && (active(s) || inHighlight(s.id))));
  const find = (id: string) => W.stories.find((s) => s.id === id);
  const iso = (ms: number) => new Date(ms).toISOString();

  const toStory = (s: StoryRow): Story => {
    const me = W.me;
    const polls = s.overlays.filter((o) => o.kind === 'poll');
    const results: Record<string, number[]> = {};
    for (const p of polls) {
      const voted = W.votes.some((v) => v.story === s.id && v.sticker === p.id && v.user === me);
      if (s.author_id !== me && !voted) continue;
      const opts = p.kind === 'poll' ? p.data.options.length : 0;
      results[p.id] = Array.from({ length: opts }, (_, i) => W.votes.filter((v) => v.story === s.id && v.sticker === p.id && v.option === i).length);
    }
    const myVotes: Record<string, number> = {};
    for (const v of W.votes) if (v.story === s.id && v.user === me) myVotes[v.sticker] = v.option;
    const { deleted_at: _d, idem: _i, ...rest } = s;
    return {
      ...rest,
      seen: s.author_id === me || W.views.some((v) => v.story === s.id && v.viewer === me),
      my_reactions: W.reactions.filter((r) => r.story === s.id && r.user === me).map((r) => r.kind),
      my_votes: myVotes,
      poll_results: results,
      view_count: s.author_id === me ? W.views.filter((v) => v.story === s.id).length : null,
    };
  };

  const client: StoryClient & { world: MockWorld } = {
    world: W,
    async getTray(): Promise<TrayItem[]> {
      const me = W.me;
      const authors = new Set<string>([me]);
      for (const [a, b] of W.follows) if (a === me) authors.add(b);
      for (const u of W.users) if (u.official && !u.is_private) authors.add(u.id);
      const out: TrayItem[] = [];
      for (const id of authors) {
        const u = user(id);
        if (!u) continue;
        const list = W.stories.filter((s) => s.author_id === id && active(s) && canView(me, s) && (id === me || s.status === 'published'));
        if (id !== me && !list.length) continue;
        const unseen = id === me ? 0 : list.filter((s) => !W.views.some((v) => v.story === s.id && v.viewer === me)).length;
        out.push({
          user_id: id,
          display_name: u.name,
          handle: u.handle,
          avatar_url: u.avatar_url ?? null,
          story_count: list.length,
          unseen_count: unseen,
          latest_at: list.length ? list.map((s) => s.created_at).sort().slice(-1)[0] : null,
          is_me: id === me,
          is_official: !!u.official,
        });
      }
      return out.sort((a, b) => {
        if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
        const ua = a.unseen_count > 0 ? 1 : 0;
        const ub = b.unseen_count > 0 ? 1 : 0;
        if (ua !== ub) return ub - ua;
        return (Date.parse(b.latest_at ?? '') || 0) - (Date.parse(a.latest_at ?? '') || 0);
      });
    },
    async getUserStories({ user: uid }) {
      return W.stories
        .filter((s) => s.author_id === uid && !s.deleted_at && active(s) && canView(W.me, s))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(toStory);
    },
    async getStoryRing({ user: uid }) {
      const list = W.stories.filter((s) => s.author_id === uid && !s.deleted_at && active(s) && canView(W.me, s));
      const unseen = uid === W.me ? 0 : list.filter((s) => !W.views.some((v) => v.story === s.id && v.viewer === W.me)).length;
      return { count: list.length, unseen };
    },
    async getHighlightStories({ highlight }) {
      const h = W.highlights.find((x) => x.id === highlight);
      if (!h || (h.owner !== W.me && !canViewAuthor(W.me, h.owner))) return [];
      return h.items
        .map(find)
        .filter((s): s is StoryRow => !!s && !s.deleted_at && (s.status === 'published' || s.author_id === W.me))
        .map(toStory);
    },
    async markViewed({ story }) {
      const s = find(story);
      if (!s || !canView(W.me, s)) throw err('bulunamadi');
      if (s.author_id === W.me) return;
      if (!W.views.some((v) => v.story === story && v.viewer === W.me)) W.views.push({ story, viewer: W.me, at: iso(W.now()) });
    },
    async react({ story, kind, on }) {
      const s = find(story);
      if (!s || !canView(W.me, s)) throw err('bulunamadi');
      if (s.author_id === W.me) throw err('kendi_hikayen');
      const i = W.reactions.findIndex((r) => r.story === story && r.user === W.me && r.kind === kind);
      if (on && i < 0) {
        W.reactions.push({ story, user: W.me, kind, at: iso(W.now()) });
        if (!W.views.some((v) => v.story === story && v.viewer === W.me)) W.views.push({ story, viewer: W.me, at: iso(W.now()) });
      }
      if (!on && i >= 0) W.reactions.splice(i, 1);
    },
    async votePoll({ story, sticker, option }) {
      const s = find(story);
      if (!s || !canView(W.me, s)) throw err('bulunamadi');
      const p = s.overlays.find((o) => o.kind === 'poll' && o.id === sticker);
      if (!p || p.kind !== 'poll') throw err('anket_yok');
      if (s.author_id === W.me) throw err('kendi_hikayen');
      if (option < 0 || option >= p.data.options.length) throw err('gecersiz_secenek');
      if (!W.votes.some((v) => v.story === story && v.sticker === sticker && v.user === W.me)) {
        W.votes.push({ story, sticker, user: W.me, option });
      }
      const mine = W.votes.find((v) => v.story === story && v.sticker === sticker && v.user === W.me)!.option;
      const counts = p.data.options.map((_, i) => W.votes.filter((v) => v.story === story && v.sticker === sticker && v.option === i).length);
      return { option: mine, counts };
    },
    async stickerTap({ story, sticker }) {
      const s = find(story);
      if (!s || !canView(W.me, s)) throw err('bulunamadi');
      if (!W.events.some((e) => e.story === story && e.sticker === sticker && e.user === W.me && e.action === 'tap')) {
        W.events.push({ story, sticker, user: W.me, action: 'tap' });
      }
    },
    async addMealToDay({ story, sticker, idempotencyKey, portion = 1 }) {
      const s = find(story);
      if (!s || !canView(W.me, s)) throw err('bulunamadi');
      const m = s.overlays.find((o) => o.kind === 'meal' && o.id === sticker);
      if (!m || m.kind !== 'meal') throw err('ogun_karti_yok');
      const prev = W.consumptions.find((c) => c.user === W.me && c.source === 'story' && c.ref === idempotencyKey);
      if (prev) return { consumption_id: prev.id };
      const id = `mc-${W.consumptions.length + 1}`;
      W.consumptions.push({ id, user: W.me, source: 'story', ref: idempotencyKey, name: m.data.name, kcal: Math.round(m.data.kcal * portion) });
      if (!W.events.some((e) => e.story === story && e.sticker === sticker && e.user === W.me && e.action === 'add_log')) {
        W.events.push({ story, sticker, user: W.me, action: 'add_log' });
      }
      return { consumption_id: id };
    },
    async getViewers({ story, filter = 'all' }): Promise<StoryViewersResult> {
      const s = find(story);
      if (!s || s.deleted_at || s.author_id !== W.me) throw err('bulunamadi');
      const rows = W.views
        .filter((v) => v.story === story && !blocked(W.me, v.viewer))
        .map((v) => {
          const u = user(v.viewer);
          const reacts = W.reactions.filter((r) => r.story === story && r.user === v.viewer);
          const last = reacts.filter((r) => r.kind !== 'like').slice(-1)[0];
          return {
            user_id: v.viewer,
            display_name: u?.name ?? '',
            handle: u?.handle ?? null,
            avatar_url: u?.avatar_url ?? null,
            viewed_at: v.at,
            liked: reacts.some((r) => r.kind === 'like'),
            reaction: last ? last.kind : null,
          };
        })
        .filter((r) => filter === 'all' || r.liked || r.reaction)
        .sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));
      return {
        views: W.views.filter((v) => v.story === story).length,
        expires_at: s.expires_at,
        viewers: rows,
        stickers: s.overlays
          .filter((o) => o.kind === 'meal' || o.kind === 'poll' || o.kind === 'recipe' || o.kind === 'mention' || o.kind === 'location')
          .map((o) => ({
            sticker_id: o.id,
            kind: o.kind,
            taps: W.events.filter((e) => e.story === story && e.sticker === o.id && e.action === 'tap').length,
            adds: W.events.filter((e) => e.story === story && e.sticker === o.id && e.action === 'add_log').length,
            votes: W.votes.filter((v) => v.story === story && v.sticker === o.id).length,
            label: 'name' in o.data ? o.data.name : 'question' in o.data ? o.data.question : 'text' in o.data ? o.data.text : null,
          })),
      };
    },
    async createStory(input: CreateStoryInput): Promise<CreateStoryResult> {
      if (!W.flags.hikaye) throw err('kapali');
      if (input.mediaType === 'video' && !W.flags.kesfet_video) throw err('video_kapali');
      if (input.mediaType !== 'none' && !(input.mediaUrl ?? '').startsWith(`stories/${W.me}/`)) throw err('gecersiz_yol');
      if (input.mediaType === 'none' && !input.bg) throw err('zemin_zorunlu');
      if (input.mediaType === 'video' && !(input.durationS && input.durationS > 0 && input.durationS <= 60)) throw err('video_suresi');
      if (!overlaysValid(input.overlays)) throw err('gecersiz_katman');
      const dup = W.stories.find((s) => s.author_id === W.me && s.idem === input.idempotencyKey);
      if (dup) return { story_id: dup.id, status: dup.status };
      const recent = W.stories.filter((s) => s.author_id === W.me && Date.parse(s.created_at) > W.now() - STORY_TTL_MS).length;
      if (recent >= 30) return { error: 'rate_limited' };
      const id = `st-${W.stories.length + 1}-${W.now().toString(36)}`;
      const status = hasModeratedText(input.overlays) ? 'pending' : 'published';
      W.stories.push({
        id,
        author_id: W.me,
        media_url: input.mediaType === 'none' ? null : input.mediaUrl,
        media_type: input.mediaType,
        thumb_url: input.thumbUrl ?? null,
        duration_s: input.durationS ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        overlays: parseOverlays(input.overlays),
        bg: input.mediaType === 'none' ? input.bg ?? null : null,
        status,
        created_at: iso(W.now()),
        expires_at: iso(W.now() + STORY_TTL_MS),
        deleted_at: null,
        idem: input.idempotencyKey,
      });
      return { story_id: id, status };
    },
    async deleteMyStory({ story }) {
      const s = find(story);
      if (!s || s.author_id !== W.me || s.deleted_at) throw err('bulunamadi');
      s.deleted_at = iso(W.now());
      for (const h of W.highlights) {
        h.items = h.items.filter((x) => x !== story);
        if (h.cover === story) h.cover = null;
      }
    },
    async getArchive() {
      return W.stories
        .filter((s) => s.author_id === W.me && !s.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toStory);
    },
    async getHighlights({ user: uid }): Promise<Highlight[]> {
      if (uid !== W.me && !canViewAuthor(W.me, uid)) return [];
      return W.highlights
        .filter((h) => h.owner === uid)
        .map((h) => {
          const ids = h.items.filter((x) => {
            const s = find(x);
            return !!s && !s.deleted_at;
          });
          const coverId = h.cover ?? ids[0] ?? null;
          const c = coverId ? find(coverId) : null;
          return {
            id: h.id,
            title: h.title,
            sort: h.sort,
            cover_story_id: coverId,
            cover: c ? { media_url: c.media_url, media_type: c.media_type, thumb_url: c.thumb_url, bg: c.bg } : null,
            count: ids.length,
            story_ids: ids,
          };
        })
        .filter((h) => uid === W.me || h.count > 0)
        .sort((a, b) => a.sort - b.sort);
    },
    async upsertHighlight({ highlight, title, storyIds, coverStory = null }) {
      if (!W.flags.hikaye) throw err('kapali');
      const t = title.trim();
      if (t.length < 1 || t.length > 16) throw err('gecersiz_baslik');
      const uniq = Array.from(new Set(storyIds));
      if (!uniq.length || uniq.length > 100) throw err('gecersiz_oge');
      if (!uniq.every((id) => {
        const s = find(id);
        return !!s && s.author_id === W.me && !s.deleted_at;
      })) throw err('gecersiz_oge');
      if (coverStory && !uniq.includes(coverStory)) throw err('gecersiz_kapak');
      if (highlight) {
        const h = W.highlights.find((x) => x.id === highlight && x.owner === W.me);
        if (!h) throw err('bulunamadi');
        h.title = t;
        h.items = uniq;
        h.cover = coverStory;
        return { highlight_id: h.id };
      }
      const id = `hl-${W.highlights.length + 1}`;
      W.highlights.push({ id, owner: W.me, title: t, cover: coverStory, sort: W.highlights.filter((h) => h.owner === W.me).length, items: uniq });
      return { highlight_id: id };
    },
    async deleteHighlight({ highlight }) {
      const i = W.highlights.findIndex((h) => h.id === highlight && h.owner === W.me);
      if (i < 0) throw err('bulunamadi');
      W.highlights.splice(i, 1);
    },
    async moderate({ story }) {
      // Mock: metinli hikâye denetimden geçer (yayına alınır).
      const s = find(story);
      if (s && s.status === 'pending') s.status = 'published';
    },
    async report({ story, reason }) {
      const s = find(story);
      if (!s || s.author_id === W.me || !canView(W.me, s)) throw err('bulunamadi');
      W.reports.push({ story, reason, reporter: W.me });
    },
  };
  return client;
}

/** Boş dünya (testler doldurur). */
export function emptyWorld(me = 'me', nowMs = Date.parse('2026-11-17T12:00:00Z')): MockWorld {
  return {
    me,
    users: [{ id: me, name: 'Ben', handle: 'ben' }],
    follows: [],
    blocks: [],
    stories: [],
    views: [],
    reactions: [],
    votes: [],
    events: [],
    highlights: [],
    consumptions: [],
    reports: [],
    flags: { hikaye: true, kesfet_video: true },
    now: () => nowMs,
  };
}

/** Test/vitrin yardımcısı: dünyaya doğrudan hikâye ekler (yaş saat cinsinden). */
export function seedStory(
  W: MockWorld,
  s: Partial<StoryRow> & { id: string; author_id: string },
  ageHours = 1,
): StoryRow {
  const created = W.now() - ageHours * 3_600_000;
  const row: StoryRow = {
    media_url: `stories/${s.author_id}/${s.id}.jpg`,
    media_type: 'image',
    thumb_url: null,
    duration_s: null,
    width: 1080,
    height: 1920,
    overlays: [],
    bg: null,
    status: 'published',
    created_at: new Date(created).toISOString(),
    expires_at: new Date(created + STORY_TTL_MS).toISOString(),
    deleted_at: null,
    idem: null,
    ...s,
  };
  W.stories.push(row);
  return row;
}
