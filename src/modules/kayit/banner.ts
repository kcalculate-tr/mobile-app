// G45-S1 md.5 — L2 eatkcal kampanya bannerı: eatkcal ana sayfasının kampanya şeridiyle AYNI veri
// (fetchBannerRows → campaignCellsFrom; ilk görselli hücre) ve AYNI hedef kuralı (bannerTargetToEk; ürün/mağaza
// il kapısından geçer — homeEatkcalActions; bilinmeyen hedef mevcut resolveNavigation; hedefsiz → Kampanyalar).
// Koşul (ekranda): yalnız İzmir teslimat bölgesi (useHomeRegion — kayıtlı adres → seçilen il → izinli konum) ve
// banner varsa; yoksa bölüm gizli.
import type { BannerCell } from '../../lib/banners';
import { campaignCellsFrom } from '../eatkcal/v2/model/showcase';
import { bannerTargetToEk } from '../eatkcal/v2/model/homeData';

type Rows = Parameters<typeof campaignCellsFrom>[0];

/** eatkcal kampanya şeridinin ilk (görselli) hücresi; yoksa null. */
export function pickCampaign(rows: Rows | null | undefined): BannerCell | null {
  if (!rows) return null;
  return campaignCellsFrom(rows)[0] ?? null;
}

type Nav = { navigate: (name: string, params?: object) => void };

/**
 * Banner dokunuşu. `legacy` hedef → resolveNavigation; hedefsiz → Kampanyalar ve kuponlar (EkHomeScreen ile aynı);
 * ürün / mağaza / kategori → Ana sayfa eatkcal eylemi (il kapısı; yeni_siparis kapalıysa eatkcal sekmesi).
 */
export function openCampaign(
  nav: Nav,
  cell: BannerCell,
  deps: {
    onCampaign: (cell: BannerCell) => void;
    resolve: (nav: Nav, dest: string) => void;
  },
): void {
  const target = bannerTargetToEk(cell.navigate_to ?? cell.link);
  if (target.kind === 'legacy') deps.resolve(nav, target.dest);
  else if (target.kind === 'none') nav.navigate('ProfileCoupons');
  else deps.onCampaign(cell);
}
