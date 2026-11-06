// eatkcal v2 (G13-S2 md.1) — Ana sayfa (FinEkHome + FinEkHomeSkeleton).
// Yalnız `yeni_siparis` açıkken Home sekmesinde gösterilir (routes.tsx
// `EkHomeTab`); kapalıyken HİÇ mount edilmez.
//
// Veri — HEPSİ mevcut fonksiyonlar (bugünkü HomeScreen.tsx:161-167 ile aynı set):
//   fetchCategories · fetchProducts · fetchBannerRows · fetchFeaturedProducts ·
//   fetchBusinessHours (src/lib/*), vitrinYorumlariniGetir (socialProof),
//   fetchActiveOrder + subscribeToOrder + isDeliveredExpired (activeOrder,
//   HomeScreen.tsx:189-266 ile aynı desen), fetchMacroProfile/Settings (macros),
//   fetchBrand (brands; anahtarlar katalog ürünlerinin `brand` alanından),
//   fetchProductsByCategory (kategori çipi), fetchAllDeliveryZones (teslimat
//   şeridindeki tahmini süre — yalnız gösterim; ui/home/useDeliveryChip).
// Veri yoksa bölüm gizlenir; panodaki [N]/[Ürün] yer tutucu, uydurma yok.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EkScreen, EkSection, EkChip, EkButton, ekType, useEk } from '../ui/kit';
import { useEkNav } from '../nav';
import { HRow, ProductCard, StoreCard, CampaignCard, ReviewCard, CategoryPill } from '../ui/home/cards';
import { LiveOrderCard } from '../ui/home/LiveOrderCard';
import { HomeSkeleton } from '../ui/home/HomeSkeleton';
import { useDeliveryChip } from '../ui/home/useDeliveryChip';
import { EmptyErrorCard, haptic } from '../../../../core/design';
import { useAuth } from '../../../../core/AuthContext';
import { useFeature } from '../../../../core/flags';
import { MagnifyingGlass, Receipt, ShoppingBag, MapPin, CaretRight, X, BellRinging, Info } from '../../../../components/icons';
import { EkInfoSheet } from '../ui/InfoSheet';
import { TAB_BAR_TOTAL } from '../../../../constants/layout';

import { fetchCategories, fetchProductsByCategory, type Category, type CategoryProduct } from '../../../../lib/categories';
import { fetchProducts, fetchFeaturedProducts } from '../../../../lib/products';
import { fetchBannerRows, type BannerCell } from '../../../../lib/banners';
import { fetchBusinessHours, type BusinessHours } from '../../../../lib/businessHours';
import { vitrinYorumlariniGetir, type VitrinYorumu } from '../../../../lib/socialProof';
import { fetchActiveOrder, subscribeToOrder, isDeliveredExpired, type ActiveOrder } from '../../../../lib/activeOrder';
import { fetchMacroProfile, fetchMacroSettings, DEFAULT_MACRO_SETTINGS, type MacroProfile, type MacroSettings } from '../../../../lib/macros';
import { fetchBrand, type Brand } from '../../../../lib/brands';
import { resolveNavigation } from '../../../../lib/navigation';
import { useAddressStore } from '../../../../store/addressStore';
import { useCartStore } from '../../../../store/cartStore';
import { readCityGatePassed, writeCityGatePassed } from '../../cityGateStorage';
import { CityGateView, type GateStep } from '../ui/gate/CityGateView';
import type { Product } from '../../../../types';
import {
  bannerTargetToEk,
  distinctBrandKeys,
  filterProductsByQuery,
  macroStrip,
} from '../model/homeData';

// EatHomeScreen.tsx ile AYNI yerel anahtar ("haber ver" sunucuya gitmez).
const NEARBY_INTEREST_KEY = 'eatkcal-nearby-interest-notified';
// HomeScreen.tsx ile aynı "Tüm Ürünler" adları (lib/categories ALL_PRODUCTS_NAMES).
const ALL_PRODUCTS_NAMES = ['Tüm Ürünler', 'Tum Urunler'];

type StoreItem = { key: string; brand: Brand; cover: string | null };

function EkHomeContent() {
  const { c, t } = useEk();
  const navigation = useEkNav();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const restoranYakinda = useFeature('restoran_yakinda');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<BannerCell[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [reviews, setReviews] = useState<VitrinYorumu[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [macroProfile, setMacroProfile] = useState<MacroProfile | null>(null);
  const [macroSettings, setMacroSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS);
  const [category, setCategory] = useState<string | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<CategoryProduct[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [nearbyNotified, setNearbyNotified] = useState(false);

  const address = useAddressStore((s) => s.selectedAddress);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + (i.parentLineKey ? 0 : i.quantity), 0));

  // ── Katalog (HomeScreen.fetchData ile aynı fonksiyonlar) ─────────────────
  const fetchData = useCallback(async () => {
    setLoadError(false);
    try {
      const [cats, prods, banners, feat, bh] = await Promise.all([
        fetchCategories(),
        fetchProducts(),
        fetchBannerRows(),
        fetchFeaturedProducts(),
        fetchBusinessHours(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setFeatured(feat);
      setBusinessHours(bh);
      setCampaigns(
        [...banners.hero, ...banners.promo].flatMap((r) => r.cells).filter((cell) => !!cell.image_url),
      );
      // Mağazalar: ürünlerin brand anahtarları → fetchBrand (aktif değilse null → gizli).
      const keys = distinctBrandKeys(prods);
      const brands = await Promise.all(keys.map((k) => fetchBrand(k).catch(() => null)));
      setStores(
        keys
          .map((key, i) => {
            const brand = brands[i];
            if (!brand) return null;
            const cover = brand.hero_image_url || prods.find((p) => p.brand === key && p.img)?.img || null;
            return { key, brand, cover };
          })
          .filter((s): s is StoreItem => s !== null),
      );
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
    // Yorumlar ayrı: vitrin boşsa/başarısızsa bölüm gizlenir, sayfa etkilenmez.
    vitrinYorumlariniGetir(12).then(setReviews).catch(() => setReviews([]));
  }, []);

  useEffect(() => {
    fetchData();
    AsyncStorage.getItem(NEARBY_INTEREST_KEY)
      .then((v) => setNearbyNotified(v === '1'))
      .catch(() => {});
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Canlı sipariş (HomeScreen.tsx:189-266 deseni) ─────────────────────────
  const refreshActiveOrder = useCallback(async () => {
    if (!userId) {
      setActiveOrder(null);
      return;
    }
    try {
      setActiveOrder(await fetchActiveOrder(userId));
    } catch {
      /* sessiz — kart yoksa sayfa normal */
    }
  }, [userId]);

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

  useFocusEffect(
    useCallback(() => {
      refreshActiveOrder();
      refreshMacro();
    }, [refreshActiveOrder, refreshMacro]),
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

  // ── Teslimat şeridi: seçili adres + bölge tahmini süresi (yalnız gösterim) ──
  const { chip } = useDeliveryChip(businessHours);

  // ── Kategori çipi → mevcut fetchProductsByCategory ────────────────────────
  const orderedCategories = useMemo(() => {
    const all = categories.find((cat) => ALL_PRODUCTS_NAMES.includes(cat.name));
    if (!all) return categories;
    return [all, ...categories.filter((cat) => !ALL_PRODUCTS_NAMES.includes(cat.name))];
  }, [categories]);

  const selectCategory = useCallback((name: string) => {
    if (ALL_PRODUCTS_NAMES.includes(name)) {
      setCategory(null);
      setCategoryProducts(null);
      return;
    }
    setCategory(name);
    setCategoryProducts(null);
    fetchProductsByCategory(name)
      .then(setCategoryProducts)
      .catch(() => setCategoryProducts([]));
  }, []);

  // ── İl kapısı: ilk sipariş eyleminde (mağaza/ürün açmadan önce) ──────────
  const gatePassedRef = useRef(false);
  const gated = useCallback(
    async (go: () => void, gateParams?: { next?: 'EkStore'; brandKey?: string }) => {
      if (!gatePassedRef.current) gatePassedRef.current = await readCityGatePassed();
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

  const onCampaign = useCallback(
    (cell: BannerCell) => {
      const target = bannerTargetToEk(cell.navigate_to ?? cell.link);
      if (target.kind === 'product') openProduct(target.productId);
      else if (target.kind === 'store') openStore(target.brandKey);
      else if (target.kind === 'category') selectCategory(target.categoryName);
      else if (target.kind === 'legacy') resolveNavigation(navigation, target.dest);
    },
    [openProduct, openStore, selectCategory, navigation],
  );

  const handleNearbyNotify = useCallback(async () => {
    await AsyncStorage.setItem(NEARBY_INTEREST_KEY, '1').catch(() => {});
    setNearbyNotified(true);
  }, []);

  const popular: { id: number | string; name: string; price: number; img?: string | null; calories?: number | null; discount_type?: string | null; discount_value?: number | null }[] =
    category != null
      ? categoryProducts ?? []
      : featured.length > 0
        ? featured
        : products.slice(0, 6); // HomeScreen.displayProducts ile aynı geri düşüş
  const searchResults = useMemo(() => filterProductsByQuery(products, query), [products, query]);
  const macro = userId ? macroStrip(macroProfile, macroSettings) : null;
  const deliveryText = address
    ? [address.title, [address.district, address.city || 'İzmir'].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
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
          <Text style={[ekType.h24, { color: c.ink, flex: 1 }]} accessibilityRole="header">
            {t('eatkcal.v2.home.title')}
          </Text>
          <IconBtn label={t('eatkcal.v2.home.info')} onPress={() => setInfoOpen(true)} testID="ek-home-info">
            <Info size={22} color={c.ink} />
          </IconBtn>
          <IconBtn label={t('eatkcal.v2.home.search')} onPress={() => setSearchOpen(true)} testID="ek-home-search">
            <MagnifyingGlass size={22} color={c.ink} />
          </IconBtn>
          <IconBtn label={t('eatkcal.v2.home.orders')} onPress={() => navigation.navigate('EkOrders')} testID="ek-home-orders">
            <Receipt size={22} color={c.ink} />
          </IconBtn>
          <IconBtn
            label={cartCount > 0 ? t('eatkcal.v2.home.cart_count', { count: cartCount }) : t('eatkcal.v2.home.cart')}
            onPress={() => navigation.navigate('EkCart')}
            testID="ek-home-cart"
          >
            <ShoppingBag size={22} color={c.ink} />
            {cartCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.accent }]}>
                <Text style={[ekType.c13s, ekType.num, { color: c.onAccent, fontSize: 13, lineHeight: 16 }]}>{cartCount}</Text>
              </View>
            ) : null}
          </IconBtn>
        </>
      )}
    </View>
  );

  const bottom = TAB_BAR_TOTAL + 24;

  if (searchOpen) {
    return (
      <EkScreen header={header} bottomInset={bottom} testID="ek-home">
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
                    {`${t(chip.immediate ? 'eatkcal.v2.home.immediate' : 'eatkcal.v2.home.scheduled')} · ${chip.estimate}`}
                  </Text>
                </View>
              ) : null}
              <CaretRight size={16} color={c.secondary} />
            </Pressable>
          </View>

          {campaigns.length > 0 ? (
            <HRow label={t('eatkcal.v2.home.campaign')}>
              {campaigns.map((cell) => (
                <CampaignCard key={cell.id} imageUri={cell.image_url as string} title={cell.title} onPress={() => onCampaign(cell)} />
              ))}
            </HRow>
          ) : null}

          {orderedCategories.length > 0 ? (
            <HRow label={t('eatkcal.v2.home.categories')}>
              {orderedCategories.map((cat) => {
                const isAll = ALL_PRODUCTS_NAMES.includes(cat.name);
                const selected = isAll ? category == null : category === cat.name;
                return (
                  <CategoryPill key={cat.id} label={cat.name} selected={selected} onPress={() => selectCategory(cat.name)} />
                );
              })}
            </HRow>
          ) : null}

          {stores.length > 0 ? (
            <EkSection title={t('eatkcal.v2.home.stores')} style={{ marginTop: 14 }}>
              <HRow label={t('eatkcal.v2.home.stores')}>
                {stores.map((s) => (
                  <StoreCard
                    key={s.key}
                    name={s.brand.name}
                    imageUri={s.cover}
                    // Mağaza puanı/değerlendirme sayısı verisi YOK (yalnız onaylı vitrin
                    // yorumları var, marka bazında değil) → alt satırda gerçek veri:
                    // bölge tahmini süresi, yoksa markanın kendi sloganı.
                    subtitle={chip ? `${t(chip.immediate ? 'eatkcal.v2.home.immediate' : 'eatkcal.v2.home.scheduled')} · ${chip.estimate}` : s.brand.tagline}
                    onPress={() => openStore(s.key)}
                  />
                ))}
              </HRow>
            </EkSection>
          ) : null}

          {popular.length > 0 ? (
            <EkSection
              title={category ?? t('eatkcal.v2.home.popular')}
              action={t('eatkcal.v2.home.see_all')}
              onAction={() => setSearchOpen(true)}
              style={{ marginTop: 14 }}
            >
              <HRow label={t('eatkcal.v2.home.popular')}>
                {popular.map((p) => (
                  <ProductCard key={String(p.id)} product={p} width={148} photoHeight={148} onPress={() => openProduct(p.id)} />
                ))}
              </HRow>
            </EkSection>
          ) : null}

          {reviews.length > 0 ? (
            <EkSection title={t('eatkcal.v2.home.reviews')} style={{ marginTop: 14 }}>
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
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

// ── G15-S5 md.2 — il kapısı eatkcal sekmesinde (FinCityR1 / WaitlistR1 / EatBerlin) ──
// Final'de kapı, sekme çubuğuyla birlikte eatkcal sekmesinin ilk hâli. Kapı
// geçilmemişse (bugünkü `eatkcal-city-gate-passed` anahtarı) sekme önce
// fotoğraflı şehir seçimini gösterir; İzmir doğrulanınca (aynı checkCity)
// EkCityGateScreen.onAllowed ile aynı adımlar: kapı geçildi → adres yoksa adres
// ekranı → mağaza ana sayfası. Geçildikten sonra bir daha sorulmaz.
type HomeTabParams = {
  /** YALNIZ __DEV__ vitrini: kapı adımı (FinWaitlistR1 / FinEatBerlin). */
  vitrinGate?: GateStep;
  vitrinCity?: string;
  vitrinOtherCity?: string;
};

export default function EkHomeScreen() {
  const { c } = useEk();
  const navigation = useEkNav();
  const params = (useRoute().params ?? {}) as HomeTabParams;
  const address = useAddressStore((s) => s.selectedAddress);
  const [gate, setGate] = useState<'unknown' | 'show' | 'passed'>('unknown');

  useEffect(() => {
    let alive = true;
    readCityGatePassed()
      .then((passed) => {
        if (alive) setGate(passed ? 'passed' : 'show');
      })
      .catch(() => {
        if (alive) setGate('passed');
      });
    return () => {
      alive = false;
    };
  }, []);

  const onAllowed = useCallback(async () => {
    await writeCityGatePassed();
    setGate('passed');
    if (!useAddressStore.getState().selectedAddress) {
      navigation.navigate('EkAddressAdd', { selectMode: true });
    }
  }, [navigation]);

  const onTrack = useCallback(() => {
    (navigation as unknown as { navigate: (name: string, p?: object) => void }).navigate('Tabs', { screen: 'Tracker' });
  }, [navigation]);

  if (gate === 'unknown') return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (gate === 'show') {
    return (
      <CityGateView
        onAllowed={onAllowed}
        onTrack={onTrack}
        initialStep={__DEV__ ? params.vitrinGate : undefined}
        initialCityKey={__DEV__ ? params.vitrinCity : undefined}
        otherCityName={(__DEV__ ? params.vitrinOtherCity : undefined) ?? address?.city ?? null}
      />
    );
  }
  return <EkHomeContent />;
}
