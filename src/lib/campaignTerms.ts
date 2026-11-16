// 16 Kas — Kampanya koşulları: kampanya satırındaki GERÇEK alanlardan maddeler (uydurma yok).
// SAF modül: ekran her maddeyi `profil.<key>` çevirisiyle yazar.
import type { Campaign } from './offers';

export interface CampaignTerm {
  key: string;
  params?: Record<string, string | number>;
}

type TermsInput = Pick<
  Campaign,
  'start_date' | 'end_date' | 'min_cart_total' | 'discount_type' | 'max_discount' | 'max_uses_per_user' | 'excluded_categories'
> & { first_order_only?: boolean | null };

export function campaignTerms(c: TermsInput, fmtDate: (iso: string) => string): CampaignTerm[] {
  const out: CampaignTerm[] = [];
  if (c.first_order_only) out.push({ key: 'coupons_term_first' });
  const min = Number(c.min_cart_total ?? 0);
  if (min > 0) out.push({ key: 'coupons_term_min', params: { n: Math.round(min) } });
  const max = Number(c.max_discount ?? 0);
  if (c.discount_type === 'percent' && max > 0) out.push({ key: 'coupons_term_max', params: { n: Math.round(max) } });
  const uses = Number(c.max_uses_per_user ?? 0);
  if (uses === 1) out.push({ key: 'coupons_term_uses_one' });
  else if (uses > 1) out.push({ key: 'coupons_term_uses', params: { n: uses } });
  if (c.start_date && c.end_date) out.push({ key: 'coupons_term_dates', params: { from: fmtDate(c.start_date), to: fmtDate(c.end_date) } });
  else if (c.end_date) out.push({ key: 'coupons_term_until', params: { date: fmtDate(c.end_date) } });
  const ex = (c.excluded_categories ?? []).filter((x) => typeof x === 'string' && x.trim());
  if (ex.length > 0) out.push({ key: 'coupons_term_excluded', params: { list: ex.join(', ') } });
  // Sepet tek kupon taşır (cartStore.appliedCoupon) — her kampanyada doğru.
  out.push({ key: 'coupons_term_single' });
  return out;
}
