// Keşfet tipleri — G5-CONTRACT.md "Keşfet — Dalga 1" bölümünü BİREBİR yansıtır.
// Sunucu (S1) bu imzaları yazar; istemci bunlara göre kodlar. Değişiklik
// gerekirse LOG'un SORULAR'ına yazılır, burada tahmin yapılmaz.

export type FeedTab = 'for_you' | 'following';
export type ReactionKind = 'like' | 'save';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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
}

export interface FeedMe {
  liked: boolean;
  saved: boolean;
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

export type ReportTargetType = 'post' | 'user' | 'day_card';

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
}
