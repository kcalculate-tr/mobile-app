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
