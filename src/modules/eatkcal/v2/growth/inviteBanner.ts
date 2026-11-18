// 18 Kas (İlter): davet bölümü ve davet ekranı kampanya şeridindeki "Davet et, ikiniz de kazanın"
// banner görselini kullanır (banner_cells c3 ile aynı dosyalar). Oran 1800×624.
const BASE = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/campaigns/2026-11';
export const INVITE_BANNER_RATIO = 1800 / 624;
export function inviteBannerUrl(lang: string): string {
  return `${BASE}/kampanya3-${lang === 'en' ? 'en' : 'tr'}.webp`;
}
