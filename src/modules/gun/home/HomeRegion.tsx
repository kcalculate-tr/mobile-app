// G18-S2 md.4 — Ana sayfa eatkcal bölge bölümü.
//  • İzmir / bölge bilinmiyor (G39-S1 md.6): başlık eatkcal LOGOSU + "İzmir'de <süre>"; adres yoksa
//    "Adresini gir…" kartı; kampanya bannerları (yatay) + restoran/mağaza kartları (en fazla 6, "Tümü" →
//    eatkcal sekmesi). İskelet · "Şu an açık restoran yok" · sessiz hata (bölüm gizli). Önceki TEK öneri
//    kartı (G18-S2) kaldırıldı.
//  • İzmir dışı (FinHomeOutside): "eatkcal · Şimdilik yalnız İzmir'de" + iki satır
//    (72 yükseklik, 44 ikon kutusu, sağ ok): "Restoranını eatkcal'a ekle" ·
//    "Bize çevrendeki restoranları öner" → S3'ün FinWaitlistAdd / FinWaitlistSuggest
//    sheet'leri (bağlantı çağıranda tek satır: `onWaitlist`).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { BrandLogo } from '../../../core/design/components/BrandLogo';
import { FinSkeletonBlock } from '../../../core/design/components/FinSkeleton';
import { useT } from '../../../core/i18n';
import { fetchBannerRows, type BannerCell } from '../../../lib/banners';
import { fetchBrand } from '../../../lib/brands';
import { fetchProducts } from '../../../lib/products';
import { CampaignCard, HRow, STORE_CARD, StoreCard } from '../../eatkcal/v2/ui/home/cards';
import { useDeliveryChip } from '../../eatkcal/v2/ui/home/useDeliveryChip';
import { HOME_STORE_LIMIT, buildStoreItems, campaignCellsFrom, type StoreItem } from '../../eatkcal/v2/model/showcase';
import { BRICOLAGE_SEMI, LIME, LIME_INK, useHomeTokens } from '../../onboarding/first/homeTokens';
import type { HomeRegion as Region } from './region';

const STORE_D =
  'M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96h0v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8a8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z';
const PIN_D =
  'M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z';
const CARET_D =
  'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z';

// G39-S1 md.6 — İzmir (ve bölgesi henüz belli olmayan) kullanıcıya eatkcal VİTRİNİ: tek ürün kartı kalktı;
// eatkcal sekmesinin mevcut bileşenleri (CampaignCard · StoreCard · HRow) ve veri kuralı (model/showcase)
// yeniden kullanılır. Ana sayfa açılışı bu veriyi BEKLEMEZ (bölüm kendi içinde yüklenir).
type Provider = {
  campaigns: () => Promise<BannerCell[]>;
  stores: () => Promise<StoreItem[]>;
  /** Yalnız vitrin/test: teslim süresi sabiti (yoksa seçili adresin bölge süresi, o da yoksa "30–45 dk"). */
  eta?: string | null;
};
const realProvider: Provider = {
  campaigns: () => fetchBannerRows().then(campaignCellsFrom),
  stores: () => fetchProducts().then((prods) => buildStoreItems(prods, fetchBrand)),
};
let provider: Provider = realProvider;
/** Yalnız vitrin/test. */
export function setHomeRegionProvider(p: Provider | null): void {
  provider = p ?? realProvider;
}


function Head({ sub }: { sub: string | null }) {
  const k = useHomeTokens();
  return (
    <View style={styles.head}>
      {/* G39-S1 md.2/md.6: başlık "eatkcal" yazısı yerine logo. */}
      <BrandLogo name="eatkcal" height={20} color={k.text} accessibilityRole="header" testID="home-ek-logo" style={styles.headLogo} />
      {sub ? (
        <AppText numberOfLines={1} style={[styles.sub, { color: k.sec }]}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

function AddressPrompt({ onAdd }: { onAdd: () => void }) {
  const k = useHomeTokens();
  const { t: tt } = useT();
  return (
    <View style={[styles.addr, { backgroundColor: k.card, borderColor: k.line }]} testID="home-ek-address-prompt">
      <View style={[styles.waitIcon, { backgroundColor: k.track }]}>
        <Svg width={22} height={22} viewBox="0 0 256 256">
          <Path d={PIN_D} fill={k.text} />
        </Svg>
      </View>
      <AppText style={[styles.addrText, { color: k.text }]}>{tt('home.ek_addr_title')}</AppText>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={tt('home.ek_addr_cta')}
        style={({ pressed }) => [styles.addrBtn, { backgroundColor: LIME }, pressed && { opacity: 0.85 }]}
        testID="home-ek-address-add"
      >
        <AppText style={[styles.addrBtnText, { color: LIME_INK }]}>{tt('home.ek_addr_cta')}</AppText>
      </Pressable>
    </View>
  );
}

function ShowcaseSkeleton() {
  return (
    <View style={styles.skel} testID="home-ek-skeleton" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.skelRow}>
        <FinSkeletonBlock width={300} height={104} radius={20} />
        <FinSkeletonBlock width={60} height={104} radius={20} />
      </View>
      <View style={styles.skelRow}>
        <FinSkeletonBlock width={STORE_CARD.width} height={STORE_CARD.photo + 50} radius={20} />
        <FinSkeletonBlock width={100} height={STORE_CARD.photo + 50} radius={20} />
      </View>
    </View>
  );
}

type ShowcaseState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; campaigns: BannerCell[]; stores: StoreItem[] };

export function HomeEatkcalShowcase({
  onOpenStore,
  onCampaign,
  onSeeAll,
  onAddAddress,
}: {
  onOpenStore: (brandKey: string) => void;
  onCampaign: (cell: BannerCell) => void;
  onSeeAll: () => void;
  onAddAddress: () => void;
}) {
  const k = useHomeTokens();
  const { t: tt } = useT();
  const { address, chip } = useDeliveryChip();
  const addressId = address ? String((address as { id?: string | number }).id ?? 'set') : null;
  const [state, setState] = useState<ShowcaseState>({ status: 'loading' });
  // Adres kaydedilince / değişince alan yenilenir (teslim süresi ve liste yeniden okunur).
  useEffect(() => {
    let alive = true;
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    // Senkron atan sağlayıcı da (ör. eksik modül) sessiz hataya düşer: çağrılar Promise zincirinin içinde.
    const safe = <T,>(fn: () => Promise<T>) => Promise.resolve().then(fn);
    Promise.all([safe(provider.campaigns).catch(() => [] as BannerCell[]), safe(provider.stores)])
      .then(([campaigns, stores]) => alive && setState({ status: 'ready', campaigns, stores }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, [addressId]);
  // Sessiz hata: alan tamamen gizlenir (Ana sayfanın geri kalanı etkilenmez).
  if (state.status === 'error') return null;
  // Adres yokken / bölge süresi bilinmezken README md.6 varsayılanı (home.ek_eta_default: "30–45 dk").
  const eta = (provider.eta !== undefined ? provider.eta : chip?.estimate) ?? tt('home.ek_eta_default');
  const stores = state.status === 'ready' ? state.stores.slice(0, HOME_STORE_LIMIT) : [];
  const campaigns = state.status === 'ready' ? state.campaigns : [];
  return (
    <View style={styles.section} accessibilityLabel={tt('home.ek_region')} testID="home-region-izmir">
      <View style={styles.pad}>
        <Head sub={tt('home.ek_eta', { eta })} />
        {!address ? <AddressPrompt onAdd={onAddAddress} /> : null}
      </View>
      {state.status === 'loading' ? (
        <ShowcaseSkeleton />
      ) : (
        <>
          {campaigns.length > 0 ? (
            <View style={styles.block} testID="home-ek-campaigns">
              <HRow label={tt('eatkcal.v2.home.campaign')}>
                {campaigns.map((cell) => (
                  <CampaignCard key={cell.id} imageUri={cell.image_url as string} title={cell.title} onPress={() => onCampaign(cell)} />
                ))}
              </HRow>
            </View>
          ) : null}
          {stores.length > 0 ? (
            <View style={styles.block} testID="home-ek-stores">
              <View style={[styles.pad, styles.storesHead]}>
                <AppText accessibilityRole="header" style={[styles.storesTitle, { color: k.text }]}>
                  {tt('eatkcal.v2.home.stores')}
                </AppText>
                <Pressable onPress={onSeeAll} accessibilityRole="link" accessibilityLabel={tt('home.ek_all_a11y')} style={styles.allBtn} hitSlop={4} testID="home-ek-all">
                  <AppText style={[styles.allText, { color: k.text }]}>{tt('home.ek_all')}</AppText>
                  <Svg width={14} height={14} viewBox="0 0 256 256">
                    <Path d={CARET_D} fill={k.text} />
                  </Svg>
                </Pressable>
              </View>
              <HRow label={tt('eatkcal.v2.home.stores')}>
                {stores.map((st) => (
                  <StoreCard
                    key={st.key}
                    name={st.brand.name}
                    imageUri={st.cover}
                    subtitle={chip ? `${tt(chip.immediate ? 'eatkcal.v2.home.immediate' : 'eatkcal.v2.home.scheduled')}, ${chip.estimate}` : st.brand.tagline}
                    onPress={() => onOpenStore(st.key)}
                  />
                ))}
              </HRow>
            </View>
          ) : (
            <View style={styles.pad}>
              <View style={[styles.none, { backgroundColor: k.card, borderColor: k.line }]} testID="home-ek-empty">
                <AppText style={[styles.small, { color: k.sec }]}>{tt('home.ek_none')}</AppText>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function WaitRow({ icon, title, sub, onPress, testID }: { icon: string; title: string; sub: string; onPress: () => void; testID: string }) {
  const k = useHomeTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${sub}`}
      style={[styles.wait, { backgroundColor: k.card, borderColor: k.line }]}
      testID={testID}
    >
      <View style={[styles.waitIcon, { backgroundColor: k.track }]}>
        <Svg width={22} height={22} viewBox="0 0 256 256">
          <Path d={icon} fill={k.text} />
        </Svg>
      </View>
      <View style={styles.flex}>
        <AppText numberOfLines={2} style={[styles.waitTitle, { color: k.text }]}>
          {title}
        </AppText>
        <AppText numberOfLines={2} style={[styles.small, { color: k.sec }]}>
          {sub}
        </AppText>
      </View>
      <Svg width={18} height={18} viewBox="0 0 256 256">
        <Path d={CARET_D} fill={k.sec} />
      </Svg>
    </Pressable>
  );
}

export function HomeOutsideCards({ onWaitlist }: { onWaitlist: (kind: 'add' | 'suggest') => void }) {
  const { t: tt } = useT();
  return (
    <View style={[styles.section, styles.pad]} accessibilityLabel="eatkcal" testID="home-region-outside">
      <Head sub={tt('home.ek_only')} />
      <View style={styles.waitList}>
        <WaitRow icon={STORE_D} title={tt('home.wait_add')} sub={tt('home.wait_add_sub')} onPress={() => onWaitlist('add')} testID="home-wait-add" />
        <WaitRow icon={PIN_D} title={tt('home.wait_suggest')} sub={tt('home.wait_suggest_sub')} onPress={() => onWaitlist('suggest')} testID="home-wait-suggest" />
      </View>
    </View>
  );
}

/**
 * Bölgeye göre: İzmir ya da henüz bilinmeyen bölge → eatkcal vitrini (G39-S1 md.6: adres yoksa da restoranlar
 * listelenir, üstte "Adres ekle" kartı); İzmir dışı (adres/il/konum başka şehir) → bekleme listesi satırları.
 */
export function HomeRegionSection(props: {
  region: Region;
  onOpenStore: (brandKey: string) => void;
  onCampaign: (cell: BannerCell) => void;
  onSeeAll: () => void;
  onAddAddress: () => void;
  onWaitlist: (kind: 'add' | 'suggest') => void;
}) {
  if (props.region === 'other') return <HomeOutsideCards onWaitlist={props.onWaitlist} />;
  return (
    <HomeEatkcalShowcase onOpenStore={props.onOpenStore} onCampaign={props.onCampaign} onSeeAll={props.onSeeAll} onAddAddress={props.onAddAddress} />
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  pad: { paddingHorizontal: 16 },
  head: { minHeight: 44, paddingTop: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 6 },
  headLogo: { marginBottom: 2 },
  sub: { fontSize: 13, lineHeight: 17, flexShrink: 1 },
  block: { marginTop: 10 },
  storesHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, minHeight: 44 },
  storesTitle: { flex: 1, fontFamily: BRICOLAGE_SEMI, fontSize: 17, lineHeight: 22 },
  allBtn: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  allText: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_600SemiBold' },
  addr: { marginTop: 6, padding: 12, borderRadius: 20, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  addrText: { flex: 1, minWidth: 140, fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_600SemiBold' },
  addrBtn: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  addrBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  skel: { marginTop: 10, gap: 16, paddingLeft: 16, overflow: 'hidden' },
  skelRow: { flexDirection: 'row', gap: 10 },
  none: { marginTop: 10, minHeight: 56, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  small: { fontSize: 13, lineHeight: 18 },
  waitList: { marginTop: 4, gap: 8 },
  wait: {
    minHeight: 72,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waitIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  waitTitle: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
