// G59-S1 — Hikâye tipleri. Sunucu sözleşmesi: supabase/migrations/20261117220100_g59_hikaye.sql
// (story_json, get_story_tray, get_story_viewers, get_user_highlights). Katman şeması overlays.ts'te.

export type StoryMediaType = 'image' | 'video' | 'none';
export type StoryStatus = 'pending' | 'published' | 'removed';

/** Çıkartma görünümü (tasarım FinStorySticker `skin`). */
export type StickerSkin = 'light' | 'dark' | 'glass';

/** Yazı tipi (tasarım FinStoryEditor `fontDefs`). */
export type StoryFont = 'modern' | 'bold' | 'classic' | 'type' | 'caps';
export type StoryAlign = 'left' | 'center' | 'right';
export type StoryBrush = 'pen' | 'marker' | 'eraser';

/** Tasarım renk paleti kimlikleri (FinStoryEditor `cols`). */
export type StoryColorId = 'white' | 'black' | 'lime' | 'coral' | 'sky' | 'sun' | 'lilac' | 'mint';

/** İzinli katman türleri — sunucu `story_overlays_valid` ile birebir. Müzik/soru/challenge YOK. */
export type OverlayKind =
  | 'text'
  | 'draw'
  | 'meal'
  | 'ring'
  | 'streak'
  | 'water'
  | 'steps'
  | 'recipe'
  | 'poll'
  | 'location'
  | 'mention'
  | 'hashtag'
  | 'time';

export interface DrawPath {
  /** Normalleştirilmiş noktalar [x0,y0,x1,y1,…] (0..1, tuval oranı). */
  pts: number[];
  color: string;
  /** Kalınlık (pt, 393 genişlikli tuvale göre; çizimde ölçeklenir). */
  width: number;
  brush: 'pen' | 'marker';
}

export interface TextData {
  text: string;
  font: StoryFont;
  color: StoryColorId;
  align: StoryAlign;
  box: boolean;
}
export interface MealData {
  name: string;
  meal_type: string | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  image_url: string | null;
  show_macros: boolean;
  skin: StickerSkin;
}
export interface RingData {
  kcal: number;
  goal: number;
  skin: StickerSkin;
}
export interface StreakData {
  days: number;
  skin: StickerSkin;
}
export interface WaterData {
  ml: number;
  skin: StickerSkin;
}
export interface StepsData {
  steps: number;
  skin: StickerSkin;
}
export interface RecipeData {
  recipe_key: string;
  name: string;
  kcal: number;
  image_url: string | null;
  skin: StickerSkin;
}
export interface PollData {
  question: string;
  options: string[];
  skin: StickerSkin;
}
export interface LabelData {
  text: string;
  skin: StickerSkin;
  /** mention: hedef kullanıcının handle'ı (dokununca profil). */
  handle?: string | null;
}
export interface TimeData {
  /** "HH:MM" — paylaşım anının yerel saati (çizimde sabit). */
  text: string;
  skin: StickerSkin;
}
export interface DrawData {
  paths: DrawPath[];
}

interface OverlayBase<K extends OverlayKind, D> {
  id: string;
  kind: K;
  /** Merkez konumu, tuvale oranla (0..1). */
  x: number;
  y: number;
  /** 0.2..4 */
  scale: number;
  /** Derece (-360..360). */
  rotation: number;
  /** Çizim sırası (küçük önce). */
  z: number;
  data: D;
}

export type StoryOverlay =
  | OverlayBase<'text', TextData>
  | OverlayBase<'draw', DrawData>
  | OverlayBase<'meal', MealData>
  | OverlayBase<'ring', RingData>
  | OverlayBase<'streak', StreakData>
  | OverlayBase<'water', WaterData>
  | OverlayBase<'steps', StepsData>
  | OverlayBase<'recipe', RecipeData>
  | OverlayBase<'poll', PollData>
  | OverlayBase<'location', LabelData>
  | OverlayBase<'mention', LabelData>
  | OverlayBase<'hashtag', LabelData>
  | OverlayBase<'time', TimeData>;

export interface StoryBg {
  kind: 'solid' | 'gradient';
  colors: string[];
}

export interface Story {
  id: string;
  author_id: string;
  media_url: string | null;
  media_type: StoryMediaType;
  thumb_url: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  overlays: StoryOverlay[];
  bg: StoryBg | null;
  status: StoryStatus;
  created_at: string;
  expires_at: string;
  seen: boolean;
  my_reactions: StoryReactionKind[];
  my_votes: Record<string, number>;
  poll_results: Record<string, number[]>;
  view_count: number | null;
}

export type StoryReactionKind = 'like' | 'congrats' | 'enjoy' | 'recipe' | 'great' | 'join';

export interface TrayItem {
  user_id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  story_count: number;
  unseen_count: number;
  latest_at: string | null;
  is_me: boolean;
  is_official: boolean;
}

export interface StoryRing {
  count: number;
  unseen: number;
}

export interface StoryViewerRow {
  user_id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  viewed_at: string;
  liked: boolean;
  reaction: StoryReactionKind | null;
}
export interface StickerStat {
  sticker_id: string;
  kind: OverlayKind;
  taps: number;
  adds: number;
  votes: number;
  label: string | null;
}
export interface StoryViewersResult {
  views: number;
  expires_at: string;
  viewers: StoryViewerRow[];
  stickers: StickerStat[];
}

export interface HighlightCover {
  media_url: string | null;
  media_type: StoryMediaType;
  thumb_url: string | null;
  bg: StoryBg | null;
}
export interface Highlight {
  id: string;
  title: string;
  sort: number;
  cover_story_id: string | null;
  cover: HighlightCover | null;
  count: number;
  story_ids: string[];
}

export interface CreateStoryInput {
  mediaUrl: string | null;
  mediaType: StoryMediaType;
  thumbUrl?: string | null;
  durationS?: number | null;
  width?: number | null;
  height?: number | null;
  overlays: StoryOverlay[];
  bg?: StoryBg | null;
  idempotencyKey: string;
}
export type CreateStoryResult = { story_id: string; status: StoryStatus } | { error: 'rate_limited' };

export interface StoryClient {
  getTray(): Promise<TrayItem[]>;
  getUserStories(params: { user: string }): Promise<Story[]>;
  getStoryRing(params: { user: string }): Promise<StoryRing>;
  getHighlightStories(params: { highlight: string }): Promise<Story[]>;
  markViewed(params: { story: string }): Promise<void>;
  react(params: { story: string; kind: StoryReactionKind; on: boolean }): Promise<void>;
  votePoll(params: { story: string; sticker: string; option: number }): Promise<{ option: number; counts: number[] }>;
  stickerTap(params: { story: string; sticker: string }): Promise<void>;
  addMealToDay(params: {
    story: string;
    sticker: string;
    mealType: string;
    portion?: number;
    idempotencyKey: string;
  }): Promise<{ consumption_id: string }>;
  getViewers(params: { story: string; filter?: 'all' | 'reacted' }): Promise<StoryViewersResult>;
  createStory(input: CreateStoryInput): Promise<CreateStoryResult>;
  deleteMyStory(params: { story: string }): Promise<void>;
  getArchive(params?: { before?: string | null; limit?: number }): Promise<Story[]>;
  getHighlights(params: { user: string }): Promise<Highlight[]>;
  upsertHighlight(params: {
    highlight: string | null;
    title: string;
    storyIds: string[];
    coverStory?: string | null;
  }): Promise<{ highlight_id: string }>;
  deleteHighlight(params: { highlight: string }): Promise<void>;
  moderate(params: { story: string }): Promise<void>;
  report(params: { story: string; reason: string }): Promise<void>;
}
