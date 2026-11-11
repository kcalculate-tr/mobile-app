// G28-S1 md.7 — Yasal web bağlantıları (TEK SABİT DOSYA). Paywall, Profil › Sözleşmeler,
// onay sheet'leri, hesap silme ve destek bu dosyadan okur; başka yerde adres yazılmaz.
// Saf modül (RN importu yok → tsx --test).
import { LEGAL_SLUG } from './slugs';

export const LEGAL_WEB_BASE = 'https://legal.eatkcal.com';

export type LegalWebDoc = 'terms' | 'privacy' | 'support' | 'accountDeletion';

/** Dil başına yollar. EN hesap silme yolu ayrıca verilmedi → TR ile aynı sayfa (`/account-deletion`). */
export const LEGAL_WEB_PATHS: Record<'tr' | 'en', Record<LegalWebDoc, string>> = {
  tr: {
    terms: '/kullanim-kosullari',
    privacy: '/gizlilik-politikasi',
    support: '/destek',
    accountDeletion: '/account-deletion',
  },
  en: {
    terms: '/en/legal/terms',
    privacy: '/en/legal/privacy',
    support: '/en/support',
    accountDeletion: '/account-deletion',
  },
};

export function legalWebUrl(doc: LegalWebDoc, lang: string | null | undefined): string {
  const l: 'tr' | 'en' = lang === 'en' ? 'en' : 'tr';
  return `${LEGAL_WEB_BASE}${LEGAL_WEB_PATHS[l][doc]}`;
}

/** Uygulama içi belge adı → web belgesi. KVKK / mesafeli satışın web yolu yok → null (uygulama içi). */
export function webDocForSlug(slug: string | null | undefined): LegalWebDoc | null {
  if (slug === LEGAL_SLUG.terms) return 'terms';
  if (slug === LEGAL_SLUG.privacy) return 'privacy';
  return null;
}
