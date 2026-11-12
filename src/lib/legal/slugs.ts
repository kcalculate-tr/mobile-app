// G20-S3 md.1 — Hukuki belge adları (tek kaynak). Canlı `legal_documents.slug`
// değerleriyle AYNI (Claude 9 Kas doğruladı). Uygulama içi metin (contractsData),
// Sözleşmeler ekranı, rıza bloğu, `user_consents.doc_slug` ve `my_consent_status()`
// hep bu adları kullanır. Saf modül (RN importu yok → tsx --test).

export const LEGAL_SLUG = {
  terms: 'kullanim-kosullari',
  privacy: 'gizlilik-politikasi',
  kvkk: 'kvkk',
  distanceSales: 'mesafeli-satis',
} as const;

export type LegalSlug = (typeof LEGAL_SLUG)[keyof typeof LEGAL_SLUG];

const ALL = new Set<string>(Object.values(LEGAL_SLUG));

// Eski adlar (G20-S1 öncesi istemci içi anahtarlar) → canlı ad. Eski bir
// gezinme parametresi / bekleyen kayıt gelirse doğru belgeye düşsün.
const ALIASES: Record<string, LegalSlug> = {
  terms: LEGAL_SLUG.terms,
  privacy: LEGAL_SLUG.privacy,
  'distance-sales': LEGAL_SLUG.distanceSales,
};

/** Bilinen bir belge adı mı (canlı ya da eski)? Bilinmeyen → undefined. */
export function normalizeLegalSlug(raw: unknown): LegalSlug | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase();
  if (ALL.has(s)) return s as LegalSlug;
  return ALIASES[s];
}
