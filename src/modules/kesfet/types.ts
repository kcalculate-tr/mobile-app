// Keşfet tipleri — G5-CONTRACT.md "Keşfet — Dalga 1" + G8-CONTRACT.md (açık
// paylaşım, yorum, etkinlik, bildirim) imzalarını BİREBİR yansıtır. Sunucu (S1)
// bu imzaları yazar; istemci bunlara göre kodlar. Değişiklik gerekirse LOG'un
// SORULAR'ına yazılır, burada tahmin yapılmaz.

export type FeedTab = 'for_you' | 'following';
export type ReactionKind = 'like' | 'save';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// G8 — gönderi türü (serbest / öğün / etkinlik) ve yayın durumu.
export type PostType = 'serbest' | 'ogun' | 'etkinlik';
export type PostStatus = 'pending' | 'published' | 'removed';
export type MediaKind = 'image' | 'video';

// G8 — etkinlik türleri (G8-CONTRACT.md "Veri": activity_card.type). TR kodlar.
export type ActivityType =
  | 'kosu'
  | 'yuruyus'
  | 'bisiklet'
  | 'yuzme'
  | 'fitness'
  | 'yoga'
  | 'pilates'
  | 'futbol'
  | 'basketbol'
  | 'tenis'
  | 'dans'
  | 'diger';

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'kosu', 'yuruyus', 'bisiklet', 'yuzme', 'fitness', 'yoga',
  'pilates', 'futbol', 'basketbol', 'tenis', 'dans', 'diger',
] as const;

export interface FeedAuthor {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  role: string; // 'kurum' | 'dietitian' | 'pt' | 'user' …
  verified: boolean;
}

export interface FeedMedia {
  url: string;
  width: number;
  height: number;
  // G8 — video desteği (G8-CONTRACT "post_media"); sunucu alanları ekleyene
  // kadar hep undefined → mevcut görsel akışı birebir aynı davranır.
  kind?: MediaKind;
  duration_s?: number | null;
  thumb_path?: string | null;
}

export interface MealCard {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_label: string;
  photo_url: string | null;
  // "tahmin değil, tarif verisi" ise product_id dolu; tahmin ise null.
  product_id: string | null;
}

// G8 — etkinlik kartı (activity_card jsonb). kcal_est her zaman "tahmini".
export interface ActivityCard {
  type: ActivityType;
  minutes: number;
  distance_km?: number | null;
  kcal_est: number;
  note?: string | null;
}

export interface FeedQuote {
  id: string;
  author: string;
  body: string;
}

export interface FeedThread {
  root_id: string;
  index: number;
  total: number;
}

export interface FeedStats {
  likes: number;
  saves: number;
  adds: number;
  // G8 — yorum ve "ben de yaptım" sayaçları.
  comments: number;
  did_it: number;
}

export interface FeedMe {
  liked: boolean;
  saved: boolean;
  // G8 — gönderi bana mı ait (kendi gönderini sil + pending etiketi için).
  is_author: boolean;
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  published_at: string; // ISO
  lang: string;
  body: string;
  media: FeedMedia[];
  meal_card: MealCard | null;
  quote: FeedQuote | null;
  thread: FeedThread | null;
  stats: FeedStats;
  me: FeedMe;
  // G8 — tür + durum + etkinlik kartı. status yalnız yazarına 'pending' döner
  // ("İnceleniyor"); başkasına yalnız 'published' gelir (get_feed süzgeci).
  post_type: PostType;
  status: PostStatus;
  activity_card: ActivityCard | null;
}

export interface FeedPage {
  items: FeedPost[];
  next_cursor: string | null;
}

export interface ReactResult {
  stats: FeedStats;
  me: FeedMe;
}

export interface AddToDayResult {
  consumption_id: string;
}

export type ReportTargetType = 'post' | 'user' | 'day_card' | 'comment';

// ── G8: Composer (create_post) ───────────────────────────────────────────────
export interface CreatePostMedia {
  path: string; // user-media kovasındaki yol
  width: number;
  height: number;
  kind: MediaKind;
}

export interface CreatePostInput {
  type: PostType;
  body: string;
  lang: string;
  media: CreatePostMedia[];
  mealCard: MealCard | null;
  activityCard: ActivityCard | null;
  idempotencyKey: string;
}

export interface CreatePostResult {
  post_id: string;
  status: PostStatus;
}

export interface RateLimitedResult {
  error: 'rate_limited';
}

// ── G8: Yorumlar ─────────────────────────────────────────────────────────────
export type CommentStatus = 'pending' | 'published' | 'removed';

export interface CommentAuthor {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  verified: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  author: CommentAuthor;
  parent_id: string | null;
  body: string;
  status: CommentStatus;
  created_at: string; // ISO
  reply_count: number;
  can_delete: boolean;
}

export interface CommentPage {
  items: Comment[];
  next_cursor: string | null;
}

export interface AddCommentResult {
  comment_id: string;
  status: CommentStatus;
}

// ── G8: Etkinlik (did_it / log_activity / get_my_day_activity) ───────────────
export interface ActivityLogResult {
  activity_log_id: string;
  kcal_est: number;
}

export interface DayActivityItem {
  id: string;
  type: ActivityType;
  minutes: number;
  distance_km: number | null;
  kcal_est: number;
  source: 'manual' | 'post';
  logged_at: string; // ISO
}

export interface DayActivity {
  items: DayActivityItem[];
  total_kcal_est: number;
  total_minutes: number;
}

// ── G8: Sosyal bildirimler ───────────────────────────────────────────────────
export type NotificationKind =
  | 'like'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'follow_request'
  | 'follow_accept'
  | 'add_to_day'
  | 'did_it';

export interface NotificationActor {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
}

export interface SocialNotification {
  id: string;
  actor: NotificationActor;
  kind: NotificationKind;
  post_id: string | null;
  comment_id: string | null;
  created_at: string; // ISO
  read_at: string | null;
}

export interface NotificationPage {
  items: SocialNotification[];
  next_cursor: string | null;
  unread: number;
}

export type ModerateTargetType = 'post' | 'comment';

// İstemci arayüzü — gerçek RPC (client.ts) ve mock (mock.ts) bunu uygular.
// Store ve hook'lar yalnız bu arayüze bağlıdır; test mock enjekte eder.
export interface KesfetClient {
  getFeed(params: {
    tab: FeedTab;
    lang: string;
    cursor?: string | null;
    limit?: number;
  }): Promise<FeedPage>;
  // get_post(p_post) → tek gönderi (derin bağlantı /p/:postId için). Görünürlük
  // (gizlilik + engel) SUNUCUDA denetlenir; erişilemezse null.
  getPost(params: { post: string }): Promise<FeedPost | null>;
  reactPost(params: {
    post: string;
    kind: ReactionKind;
    on: boolean;
  }): Promise<ReactResult>;
  addPostMealToDay(params: {
    post: string;
    mealType: MealType;
    portion: number;
    idempotencyKey: string;
  }): Promise<AddToDayResult>;
  reportContent(params: {
    targetType: ReportTargetType;
    target: string;
    reason: string;
  }): Promise<void>;
  blockUser(params: { user: string; on: boolean }): Promise<void>;

  // ── G8 ──────────────────────────────────────────────────────────────────
  // create_post → { post_id, status } | { error:'rate_limited' }. status
  // 'pending' başlar; istemci ardından moderateContent çağırır.
  createPost(input: CreatePostInput): Promise<CreatePostResult | RateLimitedResult>;
  deleteMyPost(params: { post: string }): Promise<{ ok: boolean }>;
  // İstemci create_post / add_comment sonrası moderate-content edge fonksiyonunu
  // çağırır (ateşle-unut; hata sunucuda pending kalmasıyla ele alınır).
  moderateContent(params: { targetType: ModerateTargetType; targetId: string }): Promise<void>;

  addComment(params: {
    post: string;
    body: string;
    parent?: string | null;
    idempotencyKey: string;
  }): Promise<AddCommentResult>;
  listComments(params: {
    post: string;
    cursor?: string | null;
    limit?: number;
  }): Promise<CommentPage>;
  deleteMyComment(params: { comment: string }): Promise<{ ok: boolean }>;

  didIt(params: {
    post: string;
    minutes?: number | null;
    idempotencyKey: string;
  }): Promise<ActivityLogResult>;
  logActivity(params: {
    type: ActivityType;
    minutes: number;
    distanceKm?: number | null;
    note?: string | null;
    idempotencyKey: string;
  }): Promise<ActivityLogResult>;
  getMyDayActivity(params?: { day?: string }): Promise<DayActivity>;

  listSocialNotifications(params?: { cursor?: string | null }): Promise<NotificationPage>;
  markSocialNotificationsRead(params?: { until?: string }): Promise<void>;
}
