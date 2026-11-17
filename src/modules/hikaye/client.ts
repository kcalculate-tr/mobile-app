// G59-S1 — Hikâye gerçek RPC istemcisi (supabase/migrations/20261117220100_g59_hikaye.sql).
// Yetki / görünürlük / bayrak SUNUCUDA denetlenir. `core/supabase` tembel yüklenir (Node testleri
// mock enjekte eder). RPC canlıda yoksa (migration uygulanmadı) okuma uçları boş döner → giriş gizli.
import { parseOverlays } from './overlays';
import type {
  CreateStoryInput,
  CreateStoryResult,
  Highlight,
  Story,
  StoryBg,
  StoryClient,
  StoryReactionKind,
  StoryRing,
  StoryViewersResult,
  TrayItem,
} from './types';

type SupabaseModule = typeof import('../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
}

/** Depo yolu (`stories/{uid}/…`) → herkese açık post-media adresi; tam adres aynen döner. */
export function storyMediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^(https?:|file:|data:)/i.test(pathOrUrl)) return pathOrUrl;
  try {
    return sb().storage.from('post-media').getPublicUrl(pathOrUrl.replace(/^\/+/, '')).data.publicUrl;
  } catch {
    return pathOrUrl;
  }
}

function isMissingFunction(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const m = (error.message ?? '').toLowerCase();
  return m.includes('could not find the function') || m.includes('does not exist');
}
function fail(name: string, error: { message: string }): never {
  throw new Error(`${name}: ${error.message}`);
}
const n = (v: unknown, d = 0) => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : d;
};

function normalizeBg(v: unknown): StoryBg | null {
  if (!v || typeof v !== 'object') return null;
  const b = v as { kind?: unknown; colors?: unknown };
  const colors = Array.isArray(b.colors) ? b.colors.filter((c): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 3) : [];
  if (!colors.length) return null;
  return { kind: b.kind === 'gradient' && colors.length > 1 ? 'gradient' : 'solid', colors };
}

export function normalizeStory(raw: Record<string, unknown>): Story {
  const media = raw.media_type === 'video' || raw.media_type === 'none' ? raw.media_type : 'image';
  const votes: Record<string, number> = {};
  if (raw.my_votes && typeof raw.my_votes === 'object') {
    for (const [k, v] of Object.entries(raw.my_votes as Record<string, unknown>)) votes[k] = n(v);
  }
  const results: Record<string, number[]> = {};
  if (raw.poll_results && typeof raw.poll_results === 'object') {
    for (const [k, v] of Object.entries(raw.poll_results as Record<string, unknown>)) {
      if (Array.isArray(v)) results[k] = v.map((x) => n(x));
    }
  }
  return {
    id: String(raw.id),
    author_id: String(raw.author_id),
    media_url: typeof raw.media_url === 'string' ? raw.media_url : null,
    media_type: media,
    thumb_url: typeof raw.thumb_url === 'string' ? raw.thumb_url : null,
    duration_s: raw.duration_s == null ? null : n(raw.duration_s),
    width: raw.width == null ? null : n(raw.width),
    height: raw.height == null ? null : n(raw.height),
    overlays: parseOverlays(raw.overlays),
    bg: normalizeBg(raw.bg),
    status: raw.status === 'pending' || raw.status === 'removed' ? raw.status : 'published',
    created_at: String(raw.created_at ?? new Date(0).toISOString()),
    expires_at: String(raw.expires_at ?? new Date(0).toISOString()),
    seen: raw.seen === true,
    my_reactions: Array.isArray(raw.my_reactions) ? (raw.my_reactions.filter((k) => typeof k === 'string') as StoryReactionKind[]) : [],
    my_votes: votes,
    poll_results: results,
    view_count: raw.view_count == null ? null : n(raw.view_count),
  };
}

function storyList(data: unknown): Story[] {
  return Array.isArray(data) ? data.map((r) => normalizeStory(r as Record<string, unknown>)) : [];
}

export const realStoryClient: StoryClient = {
  async getTray(): Promise<TrayItem[]> {
    const { data, error } = await sb().rpc('get_story_tray');
    if (error) {
      if (isMissingFunction(error)) return [];
      fail('get_story_tray', error);
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      user_id: String(r.user_id),
      display_name: typeof r.display_name === 'string' ? r.display_name : '',
      handle: typeof r.handle === 'string' ? r.handle : null,
      avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
      story_count: n(r.story_count),
      unseen_count: n(r.unseen_count),
      latest_at: typeof r.latest_at === 'string' ? r.latest_at : null,
      is_me: r.is_me === true,
      is_official: r.is_official === true,
    }));
  },
  async getUserStories({ user }) {
    const { data, error } = await sb().rpc('get_user_stories', { p_user: user });
    if (error) {
      if (isMissingFunction(error)) return [];
      fail('get_user_stories', error);
    }
    return storyList(data);
  },
  async getStoryRing({ user }): Promise<StoryRing> {
    const { data, error } = await sb().rpc('get_story_ring', { p_user: user });
    if (error) {
      if (isMissingFunction(error)) return { count: 0, unseen: 0 };
      fail('get_story_ring', error);
    }
    const d = (data ?? {}) as Record<string, unknown>;
    return { count: n(d.count), unseen: n(d.unseen) };
  },
  async getHighlightStories({ highlight }) {
    const { data, error } = await sb().rpc('get_highlight_stories', { p_highlight: highlight });
    if (error) {
      if (isMissingFunction(error)) return [];
      fail('get_highlight_stories', error);
    }
    return storyList(data);
  },
  async markViewed({ story }) {
    const { error } = await sb().rpc('mark_story_viewed', { p_story: story });
    if (error) fail('mark_story_viewed', error);
  },
  async react({ story, kind, on }) {
    const { error } = await sb().rpc('react_story', { p_story: story, p_kind: kind, p_on: on });
    if (error) fail('react_story', error);
  },
  async votePoll({ story, sticker, option }) {
    const { data, error } = await sb().rpc('vote_story_poll', { p_story: story, p_sticker: sticker, p_option: option });
    if (error) fail('vote_story_poll', error);
    const d = (data ?? {}) as { option?: unknown; counts?: unknown };
    return { option: n(d.option, option), counts: Array.isArray(d.counts) ? d.counts.map((x) => n(x)) : [] };
  },
  async stickerTap({ story, sticker }) {
    const { error } = await sb().rpc('story_sticker_tap', { p_story: story, p_sticker: sticker });
    if (error) fail('story_sticker_tap', error);
  },
  async addMealToDay({ story, sticker, mealType, portion = 1, idempotencyKey }) {
    const { data, error } = await sb().rpc('add_story_meal_to_day', {
      p_story: story,
      p_sticker: sticker,
      p_meal_type: mealType,
      p_portion: portion,
      p_idempotency_key: idempotencyKey,
    });
    if (error) fail('add_story_meal_to_day', error);
    return { consumption_id: String((data as { consumption_id?: unknown } | null)?.consumption_id ?? '') };
  },
  async getViewers({ story, filter = 'all' }): Promise<StoryViewersResult> {
    const { data, error } = await sb().rpc('get_story_viewers', { p_story: story, p_filter: filter });
    if (error) fail('get_story_viewers', error);
    const d = (data ?? {}) as Record<string, unknown>;
    return {
      views: n(d.views),
      expires_at: String(d.expires_at ?? ''),
      viewers: (Array.isArray(d.viewers) ? d.viewers : []).map((r: Record<string, unknown>) => ({
        user_id: String(r.user_id),
        display_name: typeof r.display_name === 'string' ? r.display_name : '',
        handle: typeof r.handle === 'string' ? r.handle : null,
        avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
        viewed_at: String(r.viewed_at ?? ''),
        liked: r.liked === true,
        reaction: typeof r.reaction === 'string' ? (r.reaction as StoryReactionKind) : null,
      })),
      stickers: (Array.isArray(d.stickers) ? d.stickers : []).map((r: Record<string, unknown>) => ({
        sticker_id: String(r.sticker_id),
        kind: r.kind as StoryViewersResult['stickers'][number]['kind'],
        taps: n(r.taps),
        adds: n(r.adds),
        votes: n(r.votes),
        label: typeof r.label === 'string' ? r.label : null,
      })),
    };
  },
  async createStory(input: CreateStoryInput): Promise<CreateStoryResult> {
    const { data, error } = await sb().rpc('create_story', {
      p_media_url: input.mediaUrl,
      p_media_type: input.mediaType,
      p_thumb_url: input.thumbUrl ?? null,
      p_duration_s: input.durationS ?? null,
      p_width: input.width ?? null,
      p_height: input.height ?? null,
      p_overlays: input.overlays,
      p_bg: input.bg ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) fail('create_story', error);
    return data as CreateStoryResult;
  },
  async deleteMyStory({ story }) {
    const { error } = await sb().rpc('delete_my_story', { p_story: story });
    if (error) fail('delete_my_story', error);
  },
  async getArchive({ before = null, limit = 60 } = {}) {
    const { data, error } = await sb().rpc('get_my_story_archive', { p_before: before, p_limit: limit });
    if (error) {
      if (isMissingFunction(error)) return [];
      fail('get_my_story_archive', error);
    }
    return storyList(data);
  },
  async getHighlights({ user }): Promise<Highlight[]> {
    const { data, error } = await sb().rpc('get_user_highlights', { p_user: user });
    if (error) {
      if (isMissingFunction(error)) return [];
      fail('get_user_highlights', error);
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((h) => {
      const c = h.cover as Record<string, unknown> | null;
      return {
        id: String(h.id),
        title: String(h.title ?? ''),
        sort: n(h.sort),
        cover_story_id: typeof h.cover_story_id === 'string' ? h.cover_story_id : null,
        cover: c
          ? {
              media_url: typeof c.media_url === 'string' ? c.media_url : null,
              media_type: c.media_type === 'video' || c.media_type === 'none' ? c.media_type : 'image',
              thumb_url: typeof c.thumb_url === 'string' ? c.thumb_url : null,
              bg: normalizeBg(c.bg),
            }
          : null,
        count: n(h.count),
        story_ids: Array.isArray(h.story_ids) ? h.story_ids.map(String) : [],
      };
    });
  },
  async upsertHighlight({ highlight, title, storyIds, coverStory = null }) {
    const { data, error } = await sb().rpc('upsert_story_highlight', {
      p_highlight: highlight,
      p_title: title,
      p_story_ids: storyIds,
      p_cover_story: coverStory,
    });
    if (error) fail('upsert_story_highlight', error);
    return { highlight_id: String((data as { highlight_id?: unknown } | null)?.highlight_id ?? '') };
  },
  async deleteHighlight({ highlight }) {
    const { error } = await sb().rpc('delete_story_highlight', { p_highlight: highlight });
    if (error) fail('delete_story_highlight', error);
  },
  async moderate({ story }) {
    // Ateşle-unut (gönderilerdeki gibi): hata sunucuda 'pending' kalıp pg_cron ile yeniden denenir.
    const { error } = await sb().functions.invoke('moderate-content', { body: { target_type: 'story', target_id: story } });
    if (error) throw new Error(`moderate-content: ${error.message}`);
  },
  async report({ story, reason }) {
    const { error } = await sb().rpc('report_content', { p_target_type: 'story', p_target: story, p_reason: reason });
    if (error) fail('report_content', error);
  },
};

let activeClient: StoryClient = realStoryClient;
export function getStoryClient(): StoryClient {
  return activeClient;
}
export function setStoryClient(c: StoryClient): void {
  activeClient = c;
}
export function resetStoryClient(): void {
  activeClient = realStoryClient;
}
