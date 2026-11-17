// eatkcal v2 (G13-S2 md.1) — Ana sayfa (FinEkHome + FinEkHomeSkeleton).
// Yalnız `yeni_siparis` açıkken Home sekmesinde gösterilir (routes.tsx
// `EkHomeTab`); kapalıyken HİÇ mount edilmez.
//
// G56-S1 — sipariş artırma bölümleri, sıra docs/g56/design/EkHome.dc.html (pack HARİÇ — İlter kararı):
//   üst bar · canlı sipariş · Macro · teslimat · 0 kampanya şeridi · 1 kategori çipleri ·
//   2 tekrar sipariş · 3 kalan kalori (öne çıkan) · 4 planından sipariş · mağazalar ·
//   5 bu hafta en çok · 6 arkadaşını davet et · en iyi yorumlar (· restoran yakında, bayrakla).
// Kurallar growth/rules (saf), yapılandırma growth/config, veri growth/growthApi.
//
// Veri — mevcut fonksiyonlar: fetchProducts · fetchBannerRows · fetchBusinessHours (src/lib/*),
//   vitrinYorumlariniGetir (socialProof), fetchActiveOrder + subscribeToOrder + isDeliveredExpired,
//   fetchMacroProfile/Settings, fetchBrand, useNutritionSummary (gün halkasıyla aynı RPC),
//   addPlanMealsToCart (öğün planı), fetchPastOrders (teslim edilmiş).
// Veri yoksa bölüm gizlenir; uydurma yok.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EkScreen, EkSection, EkChip, EkButton, EkToastLayer, ekType, money, useEk } from '../ui/kit';
import { useEkNav } from '../nav';
import { HRow, ProductCard, StoreCard, ReviewCard } from '../ui/home/cards';
import { EkCartBar, CART_BAR_GAP, CART_BAR_H, cartBarBottom, useCartSummary } from '../ui/home/CartBar';
import { LiveOrderCard } from '../ui/home/LiveOrderCard';
import { HomeSkeleton } from '../ui/home/HomeSkeleton';
import { useDeliveryChip } from '../ui/home/useDeliveryChip';
import { BrandLogo, EmptyErrorCard, haptic } from '../../../../core/design';
import { useAuth } from '../../../../core/AuthContext';
import { useFeature } from '../../../../core/flags';
import type { FlagKey } from '../../../../core/flags/registry';
import { MagnifyingGlass, Receipt, MapPin, CaretRight, X, BellRinging, Info } from '../../../../components/icons';
import { EkInfoSheet } from '../ui/InfoSheet';
import { TAB_BAR_TOTAL } from '../../../../constants/layout';
import { tabBarContentInset, useInR3Shell } from '../../../shell';

import { fetchProducts } from '../../../../lib/products';
import { fetchBannerRows, type BannerCell } from '../../../../lib/banners';
import { fetchBusinessHours, type BusinessHours } from '../../../../lib/businessHours';
import { vitrinYorumlariniGetir, type VitrinYorumu } from '../../../../lib/socialProof';
import { fetchActiveOrder, subscribeToOrder, isDeliveredExpired, type ActiveOrder } from '../../../../lib/activeOrder';
import { fetchMacroProfile, fetchMacroSettings, DEFAULT_MACRO_SETTINGS, type MacroProfile, type MacroSettings } from '../../../../lib/macros';
import { fetchBrand } from '../../../../lib/brands';
import { dayKey } from '../../../../lib/dayKey';
import type { PastOrder } from '../../../../lib/reorder';
import { useNutritionSummary } from '../../../../hooks/useNutritionSummary';
import { useCartStore } from '../../../../store/cartStore';
import { addPlanMealsToCart } from '../../../plan/actions';
import type { PlanItem } from '../../../plan/types';
import { buildStoreItems, campaignCellsFrom, type StoreItem } from '../model/showcase';
import { resolveNavigation } from '../../../../lib/navigation';
import { useAddressStore } from '../../../../store/addressStore';
import { writeCityGatePassed } from '../../cityGateStorage';
import { readEatGatePassed, useEatGate } from '../../gate/eatGate';
import { EkLocationGate, type GateState } from '../../gate/EkLocationGate';
import type { GateSelection } from '../../gate/gateRule';
import type { Product } from '../../../../types';
import { bannerImage, bannerTargetToEk, filterProductsByQuery, macroStrip } from '../model/homeData';
import { fetchRestaurantRating, type RestaurantRating } from '../../../../lib/restaurantRating';
import {
  bannerVisible,
  inviteVisible,
  kcalPicks,
  kcalSectionState,
  matchPlanItems,
  planReorder,
  reorderUnavailable,
  topRows,
  type GrowthProduct,
  type PlanItemLike,
  type ReorderLine,
  type TopRpcRow,
} from '../growth/rules';
import { KCAL_SECTION, type FilterKey } from '../growth/config';
import {
  fetchDeliveredOrders,
  fetchOptionInfo,
  fetchReferralSettings,
  fetchTodayPlanItems,
  fetchTopProductsWeek,
} from '../growth/growthApi';
import { growthFixture, type VitrinGrowthKind } from '../growth/vitrinFixture';
import {
  AddedToast,
  BannerStrip,
  ChipsRow,
  InviteBanner,
  KcalSection,
  PlanSection,
  ReorderSection,
  SecSkeleton,
  TopSection,
  secTap,
  type ReorderCardModel,
} from '../ui/growth/sections';
import { useQuickAdd } from '../ui/growth/useQuickAdd';
import { useSubscriptionEnabled } from '../../../../lib/subscription/useSubscriptionBootstrap';
import { useTier } from '../../../../lib/subscription/purchases';
import { IZMIR_OFFER_FROM, IZMIR_OFFER_SEEN_KEY, shouldShowIzmirOffer } from '../../../subscription/izmirOffer';

// EatHomeScreen.tsx ile AYNI yerel anahtar ("haber ver" sunucuya gitmez).
const NEARBY_INTEREST_KEY = 'eatkcal-nearby-interest-notified';
const TOAST_MS = 2400;

type AnyNav = { navigate: (name: string, params?: object) => void };

function EkHomeContent({ vitrin, vitrinScroll }: { vitrin?: VitrinGrowthKind; vitrinScroll?: number }) {
  const { c, t, lang, insets } = useEk();
  // G16-S2: yeni kabukta bar indi → alt boşluk barın yeni üst kenarına göre;
  // bayrak kapalı kabukta (CustomTabBar) bugünkü değer AYNEN.
  const inR3 = useInR3Shell();
  const navigation = useEkNav();
  const nav = navigation as unknown as AnyNav;
  const cartSummary = useCartSummary();
  const addItem = useCartStore((s) => s.addItem);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const restoranYakinda = useFeature('restoran_yakinda');
  const davet = useFeature('davet' as FlagKey);
  const isVitrin = __DEV__ && !!vitrin;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // G22-S1 md.6: restoran puanı (son 3 ay) — mağaza kartlarında kompakt.
  const [rating, setRating] = useState<RestaurantRating | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRestaurantRating(null)
      .then((r) => alive && setRating(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<BannerCell[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [reviews, setReviews] = useState<VitrinYorumu[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [macroProfile, setMacroProfile] = useState<MacroProfile | null>(null);
  const [macroSettings, setMacroSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [nearbyNotified, setNearbyNotified] = useState(false);

  // G56-S1 bölüm verisi (null = bilinmiyor / yükleniyor).
  const [orders, setOrders] = useState<PastOrder[] | null>(null);
  const [topRpc, setTopRpc] = useState<TopRpcRow[] | null>(null);
  const [planItems, setPlanItems] = useState<PlanItemLike[]>([]);
  const [rewardTl, setRewardTl] = useState<number | null>(null);
  const [reorderBusy, setReorderBusy] = useState<number | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [toast, setToast] = useState(0);
  const nutrition = useNutritionSummary();

  const address = useAddressStore((s) => s.selectedAddress);

  // ── Katalog ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadError(false);
    try {
      const [prods, banners, bh] = await Promise.all([fetchProducts(), fetchBannerRows(), fetchBusinessHours()]);
      setProducts(prods);
      setBusinessHours(bh);
      // G39-S1 md.6: kampanya + mağaza kuralı ortak modelde (Ana sayfa eatkcal alanı da kullanır).
      setCampaigns(campaignCellsFrom(banners));
      // Mağazalar: ürünlerin brand anahtarları → fetchBrand (aktif değilse null → gizli).
      setStores(await buildStoreItems(prods, fetchBrand));
    } catch {
      setLoadError(true);
    } finally {
      if (!(__DEV__ && vitrin === 'skel')) setLoading(false);
    }
    // Yorumlar ayrı: vitrin boşsa/başarısızsa bölüm gizlenir, sayfa etkilenmez.
    vitrinYorumlariniGetir(12).then(setReviews).catch(() => setReviews([]));
  }, [vitrin]);

  useEffect(() => {
    fetchData();
    AsyncStorage.getItem(NEARBY_INTEREST_KEY)
      .then((v) => setNearbyNotified(v === '1'))
      .catch(() => {});
  }, [fetchData]);

  // ── G56-S1 bölüm verisi (odakta yenilenir) ───────────────────────────────
  const refreshGrowth = useCallback(async () => {
    if (isVitrin) return;
    const today = dayKey();
    const [o, top, plan, ref] = await Promise.all([
      userId ? fetchDeliveredOrders(userId) : Promise.resolve([] as PastOrder[]),
      fetchTopProductsWeek(),
      userId ? fetchTodayPlanItems(userId, today) : Promise.resolve([] as PlanItemLike[]),
      userId && davet ? fetchReferralSettings() : Promise.resolve(null),
    ]);
    setOrders(o);
    setTopRpc(top);
    setPlanItems(plan);
    setRewardTl(ref?.rewardTl ?? null);
  }, [userId, davet, isVitrin]);

  // YALNIZ __DEV__ vitrini: gerçek katalog üstüne örnek kullanıcı verisi.
  const fixture = useMemo(() => (isVitrin && products.length > 0 ? growthFixture(vitrin as VitrinGrowthKind, products, dayKey()) : null), [isVitrin, vitrin, products]);
  useEffect(() => {
    if (!fixture) return;
    setOrders(fixture.orders);
    setTopRpc(fixture.top);
    setPlanItems(fixture.plan);
    setRewardTl(fixture.rewardTl);
  }, [fixture]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshGrowth(), nutrition.refetch()]);
    setRefreshing(false);
  }, [fetchData, refreshGrowth, nutrition]);

  // ── Canlı sipariş (HomeScreen.tsx:189-266 deseni) ─────────────────────────
  const refreshActiveOrder = useCallback(async () => {
    if (!userId || isVitrin) {
      setActiveOrder(null);
      return;
    }
    try {
      setActiveOrder(await fetchActiveOrder(userId));
    } catch {
      /* sessiz — kart yoksa sayfa normal */
    }
  }, [userId, isVitrin]);

  const refreshMacro = useCallback(async () => {
    if (!userId) {
      setMacroProfile(null);
      return;
    }
    const [p, s] = await Promise.all([
      fetchMacroProfile(userId).catch(() => null),
      fetchMacroSettings().catch(() => DEFAULT_MACRO_SETTINGS),
    ]);
    setMacroProfile(p);
    setMacroSettings(s);
  }, [userId]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      refreshActiveOrder();
      refreshMacro();
      void refreshGrowth();
      // İlk odakta useNutritionSummary zaten çekiyor; sonraki dönüşlerde (log sonrası) yenile.
      if (!firstFocus.current && !isVitrin) void nutrition.refetch();
      firstFocus.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshActiveOrder, refreshMacro, refreshGrowth, isVitrin]),
  );

  useEffect(() => {
    if (!activeOrder) return;
    const unsubscribe = subscribeToOrder(activeOrder.id, (next) => {
      if (!next || isDeliveredExpired(next)) {
        setActiveOrder(null);
        return;
      }
      setActiveOrder(next);
      if (next.status === 'delivered') haptic('success');
    });
    return unsubscribe;
    // Abonelik yalnız sipariş KİMLİĞİ değişince (HomeScreen ile aynı gerekçe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id]);

  useEffect(() => {
    if (activeOrder?.status !== 'delivered') return;
    const timer = setInterval(() => {
      setActiveOrder((cur) => (cur && isDeliveredExpired(cur) ? null : cur));
    }, 20_000);
    return () => clearInterval(timer);
  }, [activeOrder?.status]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(0), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Teslimat şeridi: seçili adres + bölge tahmini süresi (yalnız gösterim) ──
  const { chip } = useDeliveryChip(businessHours);

  // G57 (İlter 17 Kas): İzmir teslimat bölgesinden giren, aboneliği olmayan kullanıcıya paywall
  // (Fresh yıllık seçili + "2 öğün fiyatına Fresh yıllık, ekstra 2 öğün bizden") BİR KEZ doğrudan açılır.
  const subsOn = useSubscriptionEnabled();
  const { tier, status: tierStatus } = useTier();
  const inZone = chip != null;
  useEffect(() => {
    if (isVitrin) return;
    let alive = true;
    const id = setTimeout(() => {
      AsyncStorage.getItem(IZMIR_OFFER_SEEN_KEY)
        .then((seen) => {
          if (!alive) return;
          const show = shouldShowIzmirOffer({
            signedIn: !!userId,
            inZone,
            tier,
            tierKnown: tierStatus !== 'unknown',
            subscriptionsEnabled: subsOn,
            seen: !!seen,
          });
          if (!show) return;
          void AsyncStorage.setItem(IZMIR_OFFER_SEEN_KEY, '1').catch(() => {});
          nav.navigate('SubPaywall', { plan: 'fresh', yearly: true, from: IZMIR_OFFER_FROM, offer: 'izmir_fresh' });
        })
        .catch(() => {});
    }, 1200);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [isVitrin, userId, inZone, tier, tierStatus, subsOn, nav]);

  // ── İl kapısı: ilk sipariş eyleminde (mağaza/ürün açmadan önce) ──────────
  const gatePassedRef = useRef(false);
  const gated = useCallback(
    async (go: () => void, gateParams?: { next?: 'EkStore'; brandKey?: string }) => {
      // G48-S1 md.2: kural = kayıtlı adres (oturumlu) / oturumsuz gezinme işareti (eatGate).
      if (!gatePassedRef.current) gatePassedRef.current = await readEatGatePassed();
      if (gatePassedRef.current) go();
      else navigation.navigate('EkCityGate', gateParams);
    },
    [navigation],
  );

  const openProduct = useCallback(
    (id: number | string) => gated(() => navigation.navigate('EkProduct', { productId: String(id) })),
    [gated, navigation],
  );
  const openStore = useCallback(
    (brandKey: string) =>
      gated(() => navigation.navigate('EkStore', { brandKey }), { next: 'EkStore', brandKey }),
    [gated, navigation],
  );
  const openList = useCallback(
    (params: { filter?: FilterKey; category?: string; maxKcal?: number; ids?: string[]; title?: string }) => navigation.navigate('EkList', params),
    [navigation],
  );

  const inviteOn = inviteVisible({ signedIn: !!userId || isVitrin, flag: davet, rewardTl });

  const onCampaign = useCallback(
    (cell: BannerCell) => {
      const target = bannerTargetToEk(cell.navigate_to ?? cell.link);
      if (target.kind === 'product') openProduct(target.productId);
      else if (target.kind === 'store') openStore(target.brandKey);
      else if (target.kind === 'category') openList({ category: target.categoryName });
      else if (target.kind === 'list') openList({ filter: target.filter });
      else if (target.kind === 'legacy') resolveNavigation(navigation, target.dest);
      else if (target.kind === 'screen') {
        if (target.name === 'EkInvite' && !inviteOn) return;
        nav.navigate(target.name, target.params);
      }
      // G17-S1 md.11: bannerın hedefi yoksa kampanya sayfası (Kampanyalar ve kuponlar).
      else nav.navigate('ProfileCoupons');
    },
    [openProduct, openStore, openList, navigation, nav, inviteOn],
  );

  const handleNearbyNotify = useCallback(async () => {
    await AsyncStorage.setItem(NEARBY_INTEREST_KEY, '1').catch(() => {});
    setNearbyNotified(true);
  }, []);

  const { addingId, quickAdd } = useQuickAdd(
    useCallback((id: string) => void openProduct(id), [openProduct]),
    setToast,
  );

  // ── Bölüm türetmeleri (saf kurallar) ──────────────────────────────────────
  const productsById = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);
  const onSaleIds = useMemo(() => (products.length > 0 ? new Set(products.map((p) => String(p.id))) : null), [products]);

  const visibleCampaigns = useMemo(
    () =>
      campaigns
        .filter((cell) => bannerVisible(cell, { signedIn: !!userId || isVitrin, hasOrders: orders == null ? null : orders.length > 0, inviteOn }))
        .map((cell) => ({ id: cell.id, image: bannerImage(cell, lang) as string, title: cell.title })),
    [campaigns, userId, isVitrin, orders, inviteOn, lang],
  );

  const reorderCards = useMemo<ReorderCardModel[]>(() => {
    if (!orders) return [];
    return orders
      .filter((o) => o.items.length > 0)
      .map((o) => {
        const lines: ReorderLine[] = o.items.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity, options: it.options }));
        const missing = reorderUnavailable(lines, onSaleIds);
        const d = new Date(o.createdAt);
        return {
          order: o,
          date: Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: lang === 'en' ? 'short' : 'long' }),
          names: o.items.map((it) => it.name).join(', '),
          total: money(o.totalAmount),
          oos: missing.length > 0 ? { n: missing.length, m: lines.length - missing.length } : null,
        };
      });
  }, [orders, onSaleIds, lang]);

  const kcal = useMemo(() => {
    const target = fixture ? fixture.targetKcal : nutrition.summary?.targetKcal;
    const consumed = fixture ? fixture.consumedKcal : nutrition.summary?.consumedKcal;
    const s = kcalSectionState({ targetKcal: target, consumedKcal: consumed });
    return { ...s, picks: kcalPicks(products, s.state, s.remaining) };
  }, [fixture, nutrition.summary, products]);
  const kcalLoading = !fixture && !!userId && nutrition.loading && !nutrition.summary;

  const planRows = useMemo(() => matchPlanItems(planItems, products, dayKey()), [planItems, products]);
  const top = useMemo(() => topRows(topRpc, products), [topRpc, products]);

  const macLabel = useCallback(
    (p: GrowthProduct) =>
      p.protein != null || p.carbs != null || p.fats != null
        ? t('ek56.card.mac', { p: Math.round(Number(p.protein) || 0), k: Math.round(Number(p.carbs) || 0), y: Math.round(Number(p.fats) || 0) })
        : undefined,
    [t],
  );

  // ── Eylemler ──────────────────────────────────────────────────────────────
  const reorder = useCallback(
    async (order: PastOrder) => {
      secTap('reorder', 'reorder');
      setReorderBusy(order.id);
      try {
        const lines: ReorderLine[] = order.items.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity, options: it.options }));
        const info = await fetchOptionInfo(lines.filter((l) => productsById.has(String(l.id))).map((l) => String(l.id)));
        const plan = planReorder(lines, productsById, info);
        for (const call of plan.calls) addItem(call.product, call.options, call.quantity, call.parentLineKey);
        if (plan.added > 0) {
          haptic('success');
          setToast(plan.added);
        }
        if (plan.needsPage.length > 0) openProduct(plan.needsPage[0]);
      } finally {
        setReorderBusy(null);
      }
    },
    [productsById, addItem, openProduct],
  );

  const addPlanAll = useCallback(async () => {
    setPlanBusy(true);
    try {
      const items = planRows.map((r) => ({ ...r.item, source: 'eatkcal', refId: String(r.product.id) }) as unknown as PlanItem);
      const res = await addPlanMealsToCart(items);
      if (res.added > 0) {
        haptic('success');
        setToast(res.added);
      }
      if (res.choice.length > 0) openProduct(res.choice[0].id);
    } finally {
      setPlanBusy(false);
    }
  }, [planRows, openProduct]);

  const popularFallback = products.slice(0, 6);
  const searchResults = useMemo(() => filterProductsByQuery(products, query), [products, query]);
  const macro = userId ? macroStrip(macroProfile, macroSettings) : null;
  const deliveryText = address
    ? [address.title, [address.district, address.city || 'İzmir'].filter(Boolean).join(', ')].filter(Boolean).join(', ')
    : null;

  // ── Üst bar ───────────────────────────────────────────────────────────────
  const [infoOpen, setInfoOpen] = useState(false);
  const header = (
    <View style={styles.header}>
      {searchOpen ? (
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
          <MagnifyingGlass size={18} color={c.secondary} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('eatkcal.v2.home.search_placeholder')}
            placeholderTextColor={c.secondary}
            returnKeyType="search"
            style={[ekType.b15, { flex: 1, color: c.ink, minHeight: 44 }]}
            accessibilityLabel={t('eatkcal.v2.home.search')}
            testID="ek-home-search-input"
          />
          <IconBtn
            label={t('eatkcal.v2.home.search_close')}
            onPress={() => {
              setSearchOpen(false);
              setQuery('');
            }}
          >
            <X size={20} color={c.ink} />
          </IconBtn>
        </View>
      ) : (
        <>
          {/* G39-S1 md.2: üst başlıkta "eatkcal" yazısı yerine eatkcal logosu. */}
          <View style={styles.headerLogo}>
            <BrandLogo name="eatkcal" height={24} color={c.ink} accessibilityRole="header" accessibilityLabel={t('eatkcal.v2.home.title')} testID="ek-home-logo" />
          </View>
          {/* G15-S5 (FinEkHome): Final sırası ara · siparişler · bilgi. */}
          <IconBtn label={t('eatkcal.v2.home.search')} onPress={() => setSearchOpen(true)} testID="ek-home-search">
            <MagnifyingGlass size={22} color={c.ink} />
          </IconBtn>
          <IconBtn label={t('eatkcal.v2.home.orders')} onPress={() => navigation.navigate('EkOrders')} testID="ek-home-orders">
            <Receipt size={22} color={c.ink} />
          </IconBtn>
          <IconBtn label={t('eatkcal.v2.home.info')} onPress={() => setInfoOpen(true)} testID="ek-home-info">
            <Info size={22} color={c.ink} />
          </IconBtn>
        </>
      )}
    </View>
  );

  const baseBottom = inR3 ? tabBarContentInset(insets.bottom) - insets.bottom : TAB_BAR_TOTAL + 24;
  // Tur 26 md.12: yüzen lime sepet çubuğu (sekme çubuğunun 12 üstü); görünürken son kart altında kalmasın.
  const cartBarAt = inR3 ? cartBarBottom(insets.bottom, true) : insets.bottom + TAB_BAR_TOTAL + CART_BAR_GAP;
  const bottom = cartSummary.count > 0 ? cartBarAt + CART_BAR_H + CART_BAR_GAP - insets.bottom : baseBottom;
  const overlay = (
    <>
      <EkCartBar bottom={cartBarAt} onPress={() => navigation.navigate('EkCart')} />
      {toast > 0 ? (
        <EkToastLayer bottom={(cartSummary.count > 0 ? cartBarAt + CART_BAR_H + CART_BAR_GAP : cartBarAt) + 4}>
          <AddedToast count={toast} onCart={() => navigation.navigate('EkCart')} />
        </EkToastLayer>
      ) : null}
    </>
  );

  // YALNIZ __DEV__ vitrini: istenen kaydırma konumu (ekran görüntüsü parçaları).
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!__DEV__ || !vitrinScroll || loading) return;
    // Bölümler sırayla doluyor (iskelet → içerik); birkaç kez uygula ki son yerleşimde dursun.
    const ids = [1200, 2400, 3600].map((ms) => setTimeout(() => scrollRef.current?.scrollTo({ y: vitrinScroll, animated: false }), ms));
    return () => ids.forEach(clearTimeout);
  }, [vitrinScroll, loading, products.length]);

  if (searchOpen) {
    return (
      <EkScreen header={header} bottomInset={bottom} testID="ek-home" overlay={overlay}>
        <View style={styles.grid}>
          {searchResults.length === 0 ? (
            <Text style={[ekType.b15, { color: c.secondary, padding: 16 }]}>{t('eatkcal.v2.home.search_empty')}</Text>
          ) : (
            searchResults.map((p) => (
              <View key={String(p.id)} style={styles.gridCell}>
                <ProductCard product={p} photoHeight={148} onPress={() => openProduct(p.id)} />
              </View>
            ))
          )}
        </View>
      </EkScreen>
    );
  }

  return (
    <EkScreen
      header={header}
      bottomInset={bottom}
      testID="ek-home"
      overlay={overlay}
      scrollRef={scrollRef}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.secondary} />}
    >
      {loading ? (
        <HomeSkeleton />
      ) : loadError && products.length === 0 ? (
        <View style={styles.gutter}>
          <EmptyErrorCard
            tone="error"
            title={t('eatkcal.v2.home.error_title')}
            description={t('eatkcal.v2.home.error_body')}
            actionLabel={t('eatkcal.v2.home.retry')}
            onAction={() => {
              setLoading(true);
              fetchData();
            }}
          />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={[styles.gutter, { gap: 10 }]}>
            {activeOrder ? (
              <LiveOrderCard
                orderCode={activeOrder.orderCode}
                status={activeOrder.status}
                onDetail={() => navigation.navigate('EkOrderDetail', { orderId: activeOrder.id })}
              />
            ) : null}

            {macro ? (
              <View style={[styles.macro, { backgroundColor: c.line }]} testID="ek-home-macro">
                <Text style={[ekType.c13, { color: c.ink, flex: 1 }]}>
                  {t('eatkcal.v2.home.macro_next', { n: macro.toNext })}
                </Text>
                <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {Array.from({ length: macro.total }).map((_, i) => (
                    <View key={i} style={[styles.mdot, { backgroundColor: i < macro.filled ? c.ink : c.secondary, opacity: i < macro.filled ? 1 : 0.4 }]} />
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                haptic('selection');
                if (address) navigation.navigate('EkAddresses', { selectMode: true });
                else navigation.navigate('EkAddressAdd');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.delivery, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.85 }]}
              testID="ek-home-delivery"
            >
              <MapPin size={20} color={c.ink} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.home.delivery')}</Text>
                <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={1}>
                  {deliveryText ?? t('eatkcal.v2.home.delivery_add')}
                </Text>
              </View>
              {chip ? (
                <View style={[styles.chip, { backgroundColor: c.line }]}>
                  <Text style={[ekType.c13s, { color: c.ink }]}>
                    {`${t(chip.immediate ? 'eatkcal.v2.home.immediate' : 'eatkcal.v2.home.scheduled')}, ${chip.estimate}`}
                  </Text>
                </View>
              ) : null}
              <CaretRight size={16} color={c.secondary} />
            </Pressable>
          </View>

          {/* 0 · Kampanya şeridi (mevcut banner_rows / banner_cells; koşulu sağlamayan çıkar). */}
          <BannerStrip
            cells={visibleCampaigns}
            onPress={(id) => {
              const cell = campaigns.find((x) => x.id === id);
              if (cell) onCampaign(cell);
            }}
          />

          {/* 1 · Kategori çipleri → Filtrelenmiş liste. */}
          <ChipsRow onPick={(key) => openList({ filter: key })} />

          {/* 3 · Kalan kalorine uygun öğünler (öne çıkan). */}
          {kcalLoading ? (
            <SecSkeleton sec="kcal" />
          ) : (
            <KcalSection
              state={kcal.state}
              remaining={kcal.remaining}
              picks={kcal.picks}
              addingId={addingId}
              macLabel={macLabel}
              onOpen={(p) => openProduct(p.id)}
              onAdd={(p) => void quickAdd(p as Product)}
              onGoal={() => nav.navigate('NutritionProfile')}
              onAll={() =>
                openList({
                  maxKcal: kcal.state === 'done' ? KCAL_SECTION.lightMaxKcal : kcal.remaining,
                  title: kcal.state === 'done' ? t('ek56.kcal.done_title') : t('ek56.kcal.left_title', { n: kcal.remaining }),
                })
              }
            />
          )}

          {/* 4 · Planından sipariş et (yalnız planı olanda; eşleşmeyen satır yok). */}
          <PlanSection rows={planRows} busy={planBusy} onOpen={(p) => openProduct(p.id)} onAddAll={addPlanAll} />

          {stores.length > 0 ? (
            <EkSection title={t('eatkcal.v2.home.stores')} style={{ marginTop: 4 }}>
              <HRow label={t('eatkcal.v2.home.stores')}>
                {stores.map((s) => (
                  <StoreCard
                    key={s.key}
                    name={s.brand.name}
                    imageUri={s.cover}
                    // G22-S1 md.6: puan = restaurant_rating (son 3 ay, tüm şubeler; <10 → "Yeni").
                    // Alt satır: bölge tahmini süresi, yoksa markanın kendi sloganı.
                    subtitle={chip ? `${t(chip.immediate ? 'eatkcal.v2.home.immediate' : 'eatkcal.v2.home.scheduled')}, ${chip.estimate}` : s.brand.tagline}
                    rating={rating}
                    onPress={() => openStore(s.key)}
                  />
                ))}
              </HRow>
            </EkSection>
          ) : null}

          {/* 5 · Bu hafta en çok sipariş edilenler (< 3 ürün → gizli). */}
          {topRpc == null ? (
            <SecSkeleton sec="top" />
          ) : (
            <TopSection
              rows={top}
              addingId={addingId}
              onOpen={(p) => openProduct(p.id)}
              onAdd={(p) => void quickAdd(p as Product)}
              onAll={() => openList({ ids: top.map((r) => String(r.product.id)), title: t('ek56.top.title') })}
            />
          )}

          {/* 16 Kas: Önceki siparişlerim — en çok sipariş edilenlerin ALTINDA (İlter). */}
          {orders == null && userId ? <SecSkeleton sec="reorder" /> : <ReorderSection cards={reorderCards} busyId={reorderBusy} onReorder={reorder} />}

          {/* 6 · Arkadaşını davet et (giriş + `davet` bayrağı + ödül; misafirde gizli). */}
          {inviteOn ? <InviteBanner onPress={() => navigation.navigate('EkInvite')} /> : null}

          {reviews.length > 0 ? (
            <EkSection title={t('eatkcal.v2.home.reviews')} style={{ marginTop: 4 }}>
              <HRow label={t('eatkcal.v2.home.reviews')}>
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </HRow>
            </EkSection>
          ) : null}

          {/* FinEatBerlin — "Çevrendeki sağlıklı restoranlar": EatHomeScreen ile aynı
              mantık (restoran_yakinda bayrağı; sahte restoran listesi YOK, tek kart). */}
          {restoranYakinda ? (
            <EkSection title={t('eatkcal.nearby_title')} style={{ marginTop: 14 }}>
              <View style={styles.gutter}>
                <View style={[styles.nearby, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <BellRinging size={20} color={c.secondary} />
                  <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]}>{t('eatkcal.nearby_card_title')}</Text>
                  <EkChip
                    label={nearbyNotified ? t('eatkcal.nearby_notified') : t('eatkcal.nearby_notify')}
                    selected={nearbyNotified}
                    disabled={nearbyNotified}
                    onPress={handleNearbyNotify}
                  />
                </View>
                <Text style={[ekType.c13, { color: c.secondary, marginTop: 12 }]}>{t('eatkcal.footer')}</Text>
              </View>
            </EkSection>
          ) : null}

          {/* Veri gelmediyse (top/öneri boş) yine de menüye bir giriş kalsın. */}
          {top.length === 0 && topRpc != null && popularFallback.length > 0 ? (
            <EkSection title={t('eatkcal.v2.home.popular')} action={t('eatkcal.v2.home.see_all')} onAction={() => openList({ filter: 'all' })} style={{ marginTop: 14 }}>
              <HRow label={t('eatkcal.v2.home.popular')}>
                {popularFallback.map((p) => (
                  <ProductCard key={String(p.id)} product={p} width={148} photoHeight={148} onPress={() => openProduct(p.id)} />
                ))}
              </HRow>
            </EkSection>
          ) : null}

          {loadError ? (
            <View style={styles.gutter}>
              <EkButton variant="secondary" label={t('eatkcal.v2.home.retry')} onPress={onRefresh} />
            </View>
          ) : null}
        </View>
      )}
      <EkInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </EkScreen>
  );
}

function IconBtn({
  label,
  onPress,
  children,
  testID,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconBtn}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, marginTop: 6 },
  headerLogo: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingLeft: 14 },
  gutter: { paddingHorizontal: 16 },
  macro: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', gap: 4 },
  mdot: { width: 8, height: 8, borderRadius: 4 },
  delivery: {
    minHeight: 52,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: { minHeight: 30, paddingHorizontal: 10, borderRadius: 15, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, rowGap: 16 },
  gridCell: { width: '50%', paddingHorizontal: 6 },
  nearby: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1 },
});

// ── G48-S1 md.2 — konum kapısı eatkcal sekmesinde (EkLocationGate) ─────────────
// Kural (eatGate/gateRule): oturumlu kullanıcının SUNUCUDA kayıtlı adresi yoksa ana sayfadan önce kapı;
// varsa kapı hiç yok. Oturumsuz: kapı; İzmir hizmet ilçesi seçince menü gezilebilir (sepete ekleme /
// ödeme AuthSheet'i açar). Hizmet verilen ilçe + oturum → adres ekleme (ilçe dolu) → kaydedince ana sayfa.
// Diğer her seçim kapının "Çok yakında" durumunda kalır; sipariş akışı başlamaz.
type HomeTabParams = {
  /** YALNIZ __DEV__ vitrini: kapı durumu ve seçim. */
  vitrinGate?: GateState;
  vitrinSel?: Partial<GateSelection>;
  /** YALNIZ __DEV__ vitrini: açık form sheet'i (FinWaitlistAdd / FinWaitlistSuggest). */
  vitrinSheet?: 'restaurant_add' | 'restaurant_suggest';
  vitrinPicker?: 'country' | 'city' | 'district';
  /** YALNIZ __DEV__ vitrini (G56-S1): bölüm verisi (dolu · yeni kullanıcı · iskelet) ve kaydırma. */
  vitrinGrowth?: VitrinGrowthKind;
  vitrinScroll?: number;
};

export default function EkHomeScreen() {
  const { c } = useEk();
  const navigation = useEkNav();
  const params = (useRoute().params ?? {}) as HomeTabParams;
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { state: gate, recheck, setState } = useEatGate(userId);

  // Adres ekleyip dönünce / başka sekmeden gelince yeniden değerlendir.
  useFocusEffect(
    useCallback(() => {
      void recheck();
    }, [recheck]),
  );

  const onServed = useCallback(
    async (sel: GateSelection) => {
      if (!userId) {
        // Oturumsuz gezinme: menü açılır; sepete ekleme / ödeme giriş katmanını açar.
        await writeCityGatePassed();
        setState('pass');
        return;
      }
      navigation.navigate('EkAddressAdd', { gateDistrict: sel.district ?? undefined, afterGate: {} });
    },
    [userId, navigation, setState],
  );

  if (gate === 'unknown') return <View style={{ flex: 1, backgroundColor: c.bg }} testID="ek-gate-pending" />;
  if (gate === 'show') {
    return (
      <EkLocationGate
        onServed={onServed}
        initialState={__DEV__ ? params.vitrinGate : undefined}
        initialSelection={__DEV__ ? params.vitrinSel : undefined}
        initialSheet={__DEV__ ? params.vitrinSheet : undefined}
        initialPicker={__DEV__ ? params.vitrinPicker : undefined}
        onPrivacy={() => navigation.navigate('ProfileContracts', { slug: 'kvkk' })}
      />
    );
  }
  return <EkHomeContent vitrin={__DEV__ ? params.vitrinGrowth : undefined} vitrinScroll={__DEV__ ? params.vitrinScroll : undefined} />;
}
