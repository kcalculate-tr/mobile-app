// G39-S1 md.6 — Ana sayfa eatkcal vitrini eylemleri. eatkcal sekmesindeki (EkHomeScreen) AYNI kurallar:
//  • mağaza / ürün açmadan önce il kapısı (geçilmemişse EkCityGate, sonra hedef);
//  • banner hedefi bannerTargetToEk ile (ürün · mağaza; diğerleri → eatkcal sekmesi);
//  • "Tümü" → eatkcal sekmesi; "Adres ekle" → mevcut adres ekleme akışı (EkAddressAdd).
// `yeni_siparis` kapalıyken v2 rotaları kayıtlı değil → her eylem eatkcal sekmesini açar.
import { readCityGatePassed } from '../../eatkcal/cityGateStorage';
import { bannerTargetToEk } from '../../eatkcal/v2/model/homeData';
import type { BannerCell } from '../../../lib/banners';

type Nav = { navigate: (name: string, params?: object) => void };

export function homeEatkcalActions(nav: Nav, opts: { yeniSiparis: boolean; openEatkcal: () => void; readGate?: () => Promise<boolean> }) {
  const readGate = opts.readGate ?? readCityGatePassed;
  const gated = async (go: () => void, gateParams?: object) => {
    if (await readGate().catch(() => false)) go();
    else nav.navigate('EkCityGate', gateParams);
  };
  const onOpenStore = (brandKey: string) => {
    if (!opts.yeniSiparis) return opts.openEatkcal();
    void gated(() => nav.navigate('EkStore', { brandKey }), { next: 'EkStore', brandKey });
  };
  const onCampaign = (cell: BannerCell) => {
    if (!opts.yeniSiparis) return opts.openEatkcal();
    const target = bannerTargetToEk(cell.navigate_to ?? cell.link);
    if (target.kind === 'product') void gated(() => nav.navigate('EkProduct', { productId: target.productId }));
    else if (target.kind === 'store') onOpenStore(target.brandKey);
    else opts.openEatkcal();
  };
  const onAddAddress = () => (opts.yeniSiparis ? nav.navigate('EkAddressAdd') : opts.openEatkcal());
  return { onOpenStore, onCampaign, onSeeAll: opts.openEatkcal, onAddAddress };
}
