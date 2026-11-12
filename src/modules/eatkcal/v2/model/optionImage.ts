// eatkcal v2 — G35 seçenek görseli önceliği (saf, test edilebilir).
// Sıra: 1) seçeneğin kendi görseli (`image_url`, şeffaf çıkartma → contain, kırpılmaz)
//       2) bağlı ürün görseli (linked_product_id → products.img, fotoğraf → cover)
//       3) ada göre bulunan ürün görseli (G18'den beri var olan yedek, fotoğraf → cover)
//       4) hiçbiri yoksa / hepsi yüklenemezse boş hâl (yer tutucu çıkartma çerçevesi + ad).
// Kart, yüklenemeyen adayı (`onError`) atlayıp sıradakine geçer; böylece Storage'a henüz
// yüklenmemiş bir çıkartma bağlı ürün görseline / boş hâle düşer.

export type OptionImageKind = 'sticker' | 'photo';

export interface OptionImageCandidate {
  uri: string;
  kind: OptionImageKind;
}

export interface OptionImageSources {
  /** option_items.image_url / product_option_template_values.image_url */
  own?: string | null;
  /** Bağlı ürünün görseli (products.img). */
  linked?: string | null;
  /** Ada göre eşleşen ürün görseli (fetchProductImagesByName). */
  byName?: string | null;
}

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  // Yalnız ağ adresleri (http/https). Boş, "null", göreli yol vb. eksik URL sayılır.
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
};

/** Öncelik sırasına göre, tekrarsız görsel adayları. Boş dizi → boş hâl. */
export function optionImageCandidates(src: OptionImageSources): OptionImageCandidate[] {
  const out: OptionImageCandidate[] = [];
  const seen = new Set<string>();
  const push = (uri: string | null, kind: OptionImageKind) => {
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    out.push({ uri, kind });
  };
  push(clean(src.own), 'sticker');
  push(clean(src.linked), 'photo');
  push(clean(src.byName), 'photo');
  return out;
}

/** İlk aday (yoksa null) — kısa yol. */
export function primaryOptionImage(src: OptionImageSources): OptionImageCandidate | null {
  return optionImageCandidates(src)[0] ?? null;
}

// ── G38: gramaj seçenekleri (products.gramaj_options jsonb) ─────────────────
// kcalculate ürünlerinde gramaj ("200g / 300g / 350g") ayrı bir option_items grubu değil, ürünün
// jsonb alanı; satırda görsel kolonu yok. Kart yine görselli olsun diye sıra:
//   1) seçeneğin kendi `image_url`'i (jsonb'de varsa)
//   2) ürün adından G35 protein/şarküteri çıkartması (images/options/<kod>.webp — tera/breaking_fast
//      gramaj gruplarındaki aynı görseller)
//   3) ürünün kendi fotoğrafı (products.img)
//   4) boş hâl.

/** G35 seçenek çıkartmalarının Storage kökü (genel). */
export const OPTION_STICKER_BASE =
  'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/';

// Sıra önemli: özgül olan önce ("tavuk sote" "tavuk"tan, "köfte" her şeyden önce).
const GRAMAJ_STICKER_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/köfte/, 'protein-izgara-kofte'],
  [/\bsote\b/, 'protein-tavuk-sote'],
  [/tavuk|bonfile|fileto/, 'protein-tavuk-bonfile'],
  [/fajita/, 'protein-dana-fajita'],
  [/ton balı/, 'protein-ton-baligi'],
  [/falafel/, 'protein-falafel'],
  [/roastbeef/, 'sarkuteri-dana-roastbeef'],
  [/jambon/, 'sarkuteri-dana-jambon'],
  [/mortadella/, 'sarkuteri-mortadella'],
  [/hindi füme/, 'sarkuteri-hindi-fume'],
  [/yumurta|omlet/, 'protein-yumurta'],
];

/** Ürün adından gramaj çıkartması kodu (yoksa null). SAF. */
export function gramajStickerCode(productName: string | null | undefined): string | null {
  const n = String(productName ?? '').toLocaleLowerCase('tr-TR');
  if (!n.trim()) return null;
  for (const [re, code] of GRAMAJ_STICKER_RULES) if (re.test(n)) return code;
  return null;
}

/** Gramaj seçenek kartının görsel adayları (öncelik sırasıyla). SAF. */
export function gramajImageCandidates(src: {
  own?: string | null;
  productName?: string | null;
  productImg?: string | null;
}): OptionImageCandidate[] {
  const own = clean(src.own);
  const code = gramajStickerCode(src.productName);
  const sticker = code ? `${OPTION_STICKER_BASE}${code}.webp` : null;
  const out = optionImageCandidates({ own: own ?? sticker, linked: src.productImg });
  // Kendi görseli varsa ve yüklenemezse çıkartmaya da düşebilsin.
  if (own && sticker && !out.some((c) => c.uri === sticker)) out.splice(1, 0, { uri: sticker, kind: 'sticker' });
  return out;
}
