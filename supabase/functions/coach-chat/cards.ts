// coach-chat — model çıktısı ayrıştırma + kart doğrulama (SAF: import yok).
// Model JSON dışı dönerse yalnız metin. Kartlar beyaz listeyle süzülür: tarif yalnız bağlamdaki
// gönderilerden, eatkcal ürünü yalnız İzmir'deki kullanıcıya ve yalnız bağlamdaki ürünlerden.

export type CoachCard =
  | { type: 'meal_suggestion'; name: string; kcal: number; p: number; c: number; f: number }
  | { type: 'recipe'; post_id: string; name?: string; kcal?: number | null; protein?: number | null; photo_url?: string | null }
  | { type: 'eatkcal_product'; product_id: number; name?: string; kcal?: number | null; price?: number | null; img?: string | null }
  | { type: 'weekly_chart'; metric: 'kcal' | 'protein'; days?: { date: string; kcal: number; protein: number }[]; goal_kcal?: number | null; goal_protein?: number | null }
  | { type: 'safety'; variant: 'medical' | 'ed' };

export interface ParsedReply {
  type: 'answer' | 'safety';
  text: string;
  cards: CoachCard[];
}

/** Model yanıtından ilk { … } bloğunu çıkar. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const int = (v: unknown, max: number): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(max, Math.round(n));
};
const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

export interface CardAllow {
  recipeIds: ReadonlySet<string>;
  productIds: ReadonlySet<number>;
  izmir: boolean;
}

export function sanitizeCards(raw: unknown, allow: CardAllow): CoachCard[] {
  if (!Array.isArray(raw)) return [];
  const out: CoachCard[] = [];
  let meals = 0;
  for (const r of raw) {
    if (out.length >= 3) break;
    const o = (r ?? {}) as Record<string, unknown>;
    if (o.type === 'meal_suggestion') {
      const name = clean(o.name, 80);
      const kcal = int(o.kcal, 3000);
      if (!name || kcal == null || meals >= 3) continue;
      meals += 1;
      out.push({ type: 'meal_suggestion', name, kcal, p: int(o.p, 300) ?? 0, c: int(o.c, 500) ?? 0, f: int(o.f, 300) ?? 0 });
    } else if (o.type === 'recipe') {
      const id = clean(o.post_id, 64);
      if (id && allow.recipeIds.has(id)) out.push({ type: 'recipe', post_id: id });
    } else if (o.type === 'eatkcal_product') {
      const id = int(o.product_id, Number.MAX_SAFE_INTEGER);
      if (allow.izmir && id != null && allow.productIds.has(id)) out.push({ type: 'eatkcal_product', product_id: id });
    } else if (o.type === 'weekly_chart') {
      out.push({ type: 'weekly_chart', metric: o.metric === 'protein' ? 'protein' : 'kcal' });
    }
  }
  return out;
}

/** Model metni → yanıt. JSON değilse yalnız metin (kart yok). */
export function parseModelReply(modelText: string, allow: CardAllow): ParsedReply | null {
  const j = extractJson(modelText) as Record<string, unknown> | null;
  if (j && typeof j.text === 'string' && j.text.trim()) {
    const type = j.type === 'safety' ? 'safety' : 'answer';
    return { type, text: clean(j.text, 4000), cards: type === 'safety' ? [] : sanitizeCards(j.cards, allow) };
  }
  const plain = clean(modelText.replace(/```[a-z]*|```/gi, ''), 4000);
  return plain ? { type: 'answer', text: plain, cards: [] } : null;
}

/**
 * Anthropic geçmişi: son N mesaj, rol sırası user/assistant dönüşümlü, ilk mesaj user.
 * Aynı rol art arda gelirse birleştirilir; boşlar atılır.
 */
export function toModelHistory(rows: { role: string; body: string }[], max = 20): { role: 'user' | 'assistant'; content: string }[] {
  const last = rows.slice(-max);
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const r of last) {
    const role = r.role === 'assistant' ? 'assistant' : 'user';
    const content = clean(r.body, 4000);
    if (!content) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content = `${prev.content}\n${content}`;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}
