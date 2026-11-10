// G22-S2 md.4 — Keşfet arama tipleri. Sunucu: 20261110100200_g22_s2_search.sql.
import type { MealCard, PostType } from '../types';

export type SearchScope = 'people' | 'posts' | 'recipes';
export type SearchFollowState = 'following' | 'requested' | 'none';

/** search_profiles → items[]. */
export interface SearchProfile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  /** creators.role ('dietitian' | 'kurum' | 'pt' | 'user' …). */
  role: string;
  verified: boolean;
  is_private: boolean;
  me_following: SearchFollowState;
}

export interface SearchPostAuthor {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  role: string;
  verified: boolean;
}

/** search_posts → items[] (p_kind 'post' | 'recipe'). */
export interface SearchPost {
  id: string;
  author: SearchPostAuthor;
  published_at: string;
  body: string;
  post_type: PostType;
  meal_card: MealCard | null;
  /** İlk medya (post_media sort sırası) — yoksa null. */
  media_url: string | null;
}

export interface SearchResults {
  people: SearchProfile[];
  posts: SearchPost[];
  recipes: SearchPost[];
}

export interface SearchClient {
  searchProfiles(q: string): Promise<SearchProfile[]>;
  searchPosts(q: string, kind: 'post' | 'recipe'): Promise<SearchPost[]>;
}
