// G39-S1 md.6 — eatkcal vitrini (kampanya bannerları + restoran/mağaza kartları) — SAF yardımcılar.
// EkHomeScreen (eatkcal sekmesi) ve Ana sayfa eatkcal alanı AYNI kuralı kullanır (yeniden yazma yok):
//  • kampanyalar: hero + promo satırlarının görseli olan hücreleri, sırayla;
//  • mağazalar: ürünlerin brand anahtarları (ilk görülme sırası) → fetchBrand (aktif değilse null → gizli);
//    kapak = marka hero görseli, yoksa o markanın ilk ürün görseli.
import type { Brand } from '../../../../lib/brands';
import type { BannerCell } from '../../../../lib/banners';
import { distinctBrandKeys } from './homeData';

export type StoreItem = { key: string; brand: Brand; cover: string | null };

/** Ana sayfada en fazla bu kadar restoran kartı; fazlası "Tümü" ile eatkcal sekmesinde. */
export const HOME_STORE_LIMIT = 6;

export function campaignCellsFrom(banners: { hero: { cells: BannerCell[] }[]; promo: { cells: BannerCell[] }[] }): BannerCell[] {
  return [...banners.hero, ...banners.promo].flatMap((r) => r.cells).filter((cell) => !!cell.image_url);
}

export async function buildStoreItems(
  prods: readonly { brand?: string | null; img?: string | null }[],
  fetchBrandFn: (key: string) => Promise<Brand | null>,
): Promise<StoreItem[]> {
  const keys = distinctBrandKeys(prods);
  const brands = await Promise.all(keys.map((k) => fetchBrandFn(k).catch(() => null)));
  return keys
    .map((key, i) => {
      const brand = brands[i];
      if (!brand) return null;
      const cover = brand.hero_image_url || prods.find((p) => p.brand === key && p.img)?.img || null;
      return { key, brand, cover };
    })
    .filter((s): s is StoreItem => s !== null);
}

/** Teslim süresi metni ("30-45 dk", "~45 dk") → EN arayüzde "min" (G39-S1 md.7: EN'de Türkçe birim kalmasın). */
export function etaForLang(estimate: string, lang: string): string {
  return lang === 'en' ? estimate.replace(/\s?dk\b/g, ' min') : estimate;
}
