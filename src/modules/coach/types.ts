// G24-S1 md.3 — kcalAI Koç istemci tipleri (sunucu: supabase/functions/coach-chat).

export type CoachCard =
  | { type: 'meal_suggestion'; name: string; kcal: number; p: number; c: number; f: number }
  | { type: 'recipe'; post_id: string; name?: string; kcal?: number | null; protein?: number | null; photo_url?: string | null }
  | { type: 'eatkcal_product'; product_id: number; name?: string; kcal?: number | null; price?: number | null; img?: string | null }
  | { type: 'weekly_chart'; metric: 'kcal' | 'protein'; days?: { date: string; kcal: number; protein: number }[]; goal_kcal?: number | null; goal_protein?: number | null }
  | { type: 'safety'; variant: 'medical' | 'ed' };

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  cards: CoachCard[] | null;
  feedback: -1 | 1 | null;
  created_at: string;
}

export interface CoachStatus {
  used: number;
  limit: number;
  kind: 'daily' | 'trial';
  tier: 'free' | 'fresh' | 'balance' | null;
  resetsAt: string | null;
}

export type CoachRef =
  | { type: 'recipe'; post_id: string }
  | { type: 'scan'; name: string; kcal: number; protein: number; carbs: number; fat: number };

export type CoachErrorCode = 'network' | 'quota' | 'rate_limit' | 'unavailable' | 'server';

export type CoachFrom = 'home' | 'scan' | 'profile' | 'recipe' | 'other';

export interface CoachChatParams {
  from?: CoachFrom;
  /** Yazma alanına önceden doldurulan soru (gönderilmez; kullanıcı gönderir). */
  prefill?: string;
  ref?: CoachRef;
  /** Geçmişten açılınca bu mesaja kaydır. */
  focusId?: string;
}
