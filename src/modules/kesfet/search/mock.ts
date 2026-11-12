// G22-S2 md.4 — Keşfet arama sahte istemcisi (vitrin / __DEV__ mock modu / testler).
// Gerçek veri sunucuda (search_profiles / search_posts). Eşleştirme sunucuyla aynı
// kural: '@' atılır, ≥ 2 karakter, TR küçük harf "içerir"; görünürlük süzgeci
// sunucunun işi olduğundan burada yalnız örnek veri vardır.
import type { SearchClient, SearchPost, SearchProfile } from './types';
import { SEARCH_LIMIT, matches } from './logic';

const PROFILES: SearchProfile[] = [
  { id: 'author-1', display_name: 'Dyt. Elif Yılmaz', handle: 'dyt.elif', avatar_url: null, role: 'dietitian', verified: true, is_private: false, me_following: 'none' },
  { id: 'author-2', display_name: 'PT Can Demir', handle: 'pt.can', avatar_url: null, role: 'pt', verified: false, is_private: false, me_following: 'following' },
  { id: 'author-0', display_name: 'Kcalculate', handle: 'kcalculate', avatar_url: null, role: 'kurum', verified: true, is_private: false, me_following: 'none' },
  { id: 'author-3', display_name: 'Ayşe Kaya', handle: 'ayse.protein', avatar_url: null, role: 'user', verified: false, is_private: false, me_following: 'none' },
  { id: 'author-4', display_name: 'Dyt. Mert Aksoy', handle: 'diyetisyen.mert', avatar_url: null, role: 'dietitian', verified: true, is_private: false, me_following: 'none' },
];

function post(
  i: number,
  name: string,
  body: string,
  kcal: number,
  protein: number,
  author: SearchProfile,
  recipe: boolean,
): SearchPost {
  return {
    id: `post-${i}`,
    author: {
      id: author.id,
      display_name: author.display_name,
      handle: author.handle,
      avatar_url: author.avatar_url,
      role: author.role,
      verified: author.verified,
    },
    published_at: `2026-11-0${(i % 9) + 1}T10:00:00.000Z`,
    body,
    post_type: recipe ? 'ogun' : 'serbest',
    meal_card: recipe
      ? { name, kcal, protein_g: protein, carbs_g: 40, fat_g: 14, portion_label: '1 porsiyon', photo_url: null, product_id: null }
      : null,
    media_url: null,
  };
}

const [ELIF, CAN, KCAL, AYSE, MERT] = PROFILES;
const POSTS: SearchPost[] = [
  post(0, 'Fırın somon, kinoa ve roka', 'Akşam için yüksek protein: fırın somon ve kinoa.', 540, 38, ELIF, true),
  post(1, 'Izgara tavuk ve kinoa kasesi', 'Antrenman sonrası protein kasesi.', 610, 46, CAN, true),
  post(2, 'Kırmızı mercimek çorbası', 'Klasik mercimek çorbası, bol limonlu.', 320, 18, KCAL, true),
  post(3, 'Yoğurt, yulaf ve meyve', 'Kahvaltıda protein yoğurt kasesi.', 380, 24, AYSE, true),
  post(4, '', 'Bugün 10 bin adım + protein hedefi tamam!', 0, 0, AYSE, false),
  post(5, 'Bol yeşillikli çoban salata', 'Öğle için hafif çoban salata.', 210, 6, MERT, true),
];

export interface MockSearchOptions {
  /** Her çağrı hata fırlatsın (hata durumu testi). */
  fail?: boolean;
}

export function createMockSearchClient(options: MockSearchOptions = {}): SearchClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async searchProfiles(q) {
      calls.push(`profiles:${q}`);
      if (options.fail) throw new Error('search_profiles: mock hata');
      return PROFILES.filter((p) => matches(p.handle, q) || matches(p.display_name, q))
        .slice(0, SEARCH_LIMIT)
        .map((p) => ({ ...p }));
    },
    async searchPosts(q, kind) {
      calls.push(`posts:${kind}:${q}`);
      if (options.fail) throw new Error('search_posts: mock hata');
      return POSTS.filter((p) => kind === 'post' || (p.post_type === 'ogun' && p.meal_card != null))
        .filter((p) => matches(p.body, q) || matches(p.meal_card?.name, q))
        .slice(0, SEARCH_LIMIT)
        .map((p) => ({ ...p, author: { ...p.author } }));
    },
  };
}

export const mockSearchClient = createMockSearchClient();
