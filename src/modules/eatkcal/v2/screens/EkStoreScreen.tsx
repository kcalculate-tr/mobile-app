// eatkcal v2 (G13-S2 md.2) — Mağaza (FinEkStore) + Yorumlar sheet'i (FinEkReviews).
//
// Veri — bugünkü BrandLandingScreen.tsx:66-69 ile aynı: fetchBrand(brandKey) +
// fetchProductsByBrand(brandKey) (src/lib/brands.ts, src/lib/categories.ts;
// şube stok filtresi lib içinde). Kategori çipleri: fetchCategories, yalnız
// mağazanın ürünlerinde geçenler. Yorumlar: vitrinYorumlariniGetir.
// Hızlı "Sepete ekle" (+): BrandLandingScreen.handleAddToCart ile BİREBİR aynı
// karar zinciri (needsOptionSelection → fetchProductOptionGroups →
// cartStore.addItem); seçim gerekiyorsa ürün detayına (EkProduct) gider.
// Mağaza puanı / değerlendirme sayısı verisi yok → "★ [N] · [N] değerlendirme"
// gizli; "Yorumları gör" yalnız onaylı yorum varsa.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { EkRatingLine, EkSkeleton, ekType, useEk } from '../ui/kit';
import { EkCartBar, CART_BAR_GAP, CART_BAR_H, cartBarBottom, useCartSummary } from '../ui/home/CartBar';
import { useEkNav, type EkV2ParamList } from '../nav';
import { CategoryPill, ProductCard } from '../ui/home/cards';
import { useDeliveryChip } from '../ui/home/useDeliveryChip';
import { ReviewsSheet, type ReviewAggregate, type ReviewSubScores } from '../ui/ReviewsSheet';
import { fetchRestaurantRating, type RestaurantRating } from '../../../../lib/restaurantRating';
import { EmptyErrorCard, haptic } from '../../../../core/design';
import { CachedImage } from '../../../../components/CachedImage';
import { CaretLeft, Lightning } from '../../../../components/icons';
import { transformImageUrl, ImagePreset } from '../../../../lib/imageUrl';
import { fetchBrand, type Brand } from '../../../../lib/brands';
import { fetchCategories, fetchProductsByBrand, type Category, type CategoryProduct } from '../../../../lib/categories';
import { fetchProductOptionGroups } from '../../../../lib/products';
import { needsOptionSelection } from '../../../../lib/quickAdd';
import { vitrinYorumlariniGetir, type VitrinYorumu } from '../../../../lib/socialProof';
import { getSupabaseClient } from '../../../../core/supabase';
import { useCartStore } from '../../../../store/cartStore';
import { filterByCategory, storeCategories } from '../model/homeData';

type R = RouteProp<EkV2ParamList, 'EkStore'>;
/** YALNIZ __DEV__ vitrini (FinEkReviews): sheet açık başlar; özet/alt puan örnek veriyle. */
type VitrinParams = { vitrinReviews?: boolean; vitrinAggregate?: ReviewAggregate; vitrinSubScores?: ReviewSubScores };

export default function EkStoreScreen() {
  const { c, t, insets, theme } = useEk();
  const navigation = useEkNav();
  const routeParams = useRoute<R>().params as R['params'] & VitrinParams;
  const { brandKey } = routeParams;
  // Her erişim ayrı __DEV__ dalında → üretim paketinde vitrin adları kalmaz.
  const vitrin = {
    reviews: __DEV__ ? routeParams.vitrinReviews : undefined,
    aggregate: __DEV__ ? routeParams.vitrinAggregate : undefined,
    subScores: __DEV__ ? routeParams.vitrinSubScores : undefined,
  };
  const addItem = useCartStore((s) => s.addItem);
  const { chip } = useDeliveryChip();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<VitrinYorumu[]>([]);
  // G22-S1 md.6: son 3 ay puanı (restaurant_rating; mağaza marka bazlı → tüm şubeler).
  const [rating, setRating] = useState<RestaurantRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const cartSummary = useCartSummary();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [b, prods, cats] = await Promise.all([
        fetchBrand(brandKey),
        fetchProductsByBrand(brandKey),
        fetchCategories().catch(() => [] as Category[]),
      ]);
      setBrand(b);
      setProducts(prods);
      setCategories(cats);
    } catch {
      setError(true);
      setProducts([]);
    } finally {
      setLoading(false);
    }
    vitrinYorumlariniGetir(20).then(setReviews).catch(() => setReviews([]));
    fetchRestaurantRating(null).then(setRating).catch(() => setRating(null));
  }, [brandKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (vitrin.reviews && reviews.length > 0) setReviewsOpen(true);
  }, [vitrin.reviews, reviews.length]);

  const chips = useMemo(() => storeCategories(categories, products), [categories, products]);
  const visible = useMemo(() => filterByCategory(products, category), [products, category]);
  const cover = brand?.hero_image_url || products.find((p) => p.img)?.img || null;
  const coverSrc = cover ? transformImageUrl(cover, ImagePreset.bannerLarge) : '';

  const openProduct = (id: string | number) => navigation.navigate('EkProduct', { productId: String(id) });

  // BrandLandingScreen.handleAddToCart ile aynı karar zinciri (yeni mantık yok).
  const quickAdd = async (item: CategoryProduct) => {
    const key = String(item.id);
    const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
    if (needsOptionSelection({ gramajOptions: item.gramaj_options })) {
      openProduct(item.id);
      return;
    }
    setAdding((p) => ({ ...p, [key]: true }));
    try {
      const groups = await fetchProductOptionGroups(getSupabaseClient(), key);
      if (needsOptionSelection({ optionGroups: groups })) {
        openProduct(item.id);
        return;
      }
      addItem(
        {
          id: numericId,
          name: item.name,
          price: item.price,
          img: item.img ?? undefined,
          calories: item.calories ?? undefined,
          protein: item.protein ?? undefined,
          carbs: item.carbs ?? undefined,
          fats: item.fats ?? undefined,
          brand: item.brand ?? undefined,
          category: item.category ?? undefined,
          is_available: true,
          discount_type: item.discount_type ?? null,
          discount_value: item.discount_value ?? null,
        },
        {},
        1,
      );
      haptic('success');
    } catch {
      // Opsiyonlar öğrenilemediyse eklemek güvenli değil → detayda seçilir (mevcut kural).
      openProduct(item.id);
    } finally {
      setAdding((p) => ({ ...p, [key]: false }));
    }
  };

  const overlay = theme.isDark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.85)';
  const name = brand?.name ?? brandKey;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-store">
      <ScrollView
        style={styles.fill}
        stickyHeaderIndices={chips.length > 0 ? [2] : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: cartSummary.count > 0 ? cartBarBottom(insets.bottom, false) + CART_BAR_H + CART_BAR_GAP : insets.bottom + 40,
        }}
      >
        {/* 0 — Kapak 220 */}
        <View style={styles.hero}>
          {coverSrc ? (
            <CachedImage uri={coverSrc} style={StyleSheet.absoluteFill as never} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.line }]} />
          )}
        </View>

        {/* 1 — Başlık */}
        <View style={styles.head}>
          <Text style={[ekType.h24, { color: c.ink }]} accessibilityRole="header">
            {name}
          </Text>
          {brand?.tagline ? <Text style={[ekType.b15, { color: c.secondary }]}>{brand.tagline}</Text> : null}
          {rating ? <EkRatingLine average={rating.average} count={rating.count} isNew={rating.isNew} testID="ek-store-rating" /> : null}
          {reviews.length > 0 ? (
            <Pressable
              onPress={() => {
                haptic('selection');
                setReviewsOpen(true);
              }}
              accessibilityRole="button"
              style={styles.link}
              testID="ek-store-reviews"
            >
              <Text style={[ekType.b15s, { color: c.ink, textDecorationLine: 'underline', fontSize: 14 }]}>
                {t('eatkcal.v2.store.reviews_link')}
              </Text>
            </Pressable>
          ) : null}
          {chip ? (
            <View style={styles.eta}>
              <Lightning size={14} color={c.secondary} weight="fill" />
              <Text style={[ekType.c13, { color: c.secondary }]}>
                {`${t(chip.immediate ? 'eatkcal.v2.home.immediate' : 'eatkcal.v2.home.scheduled')}, ${chip.estimate}`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 2 — Yapışkan kategori çipleri */}
        {chips.length > 0 ? (
          <View style={[styles.sticky, { backgroundColor: c.bg, borderBottomColor: c.line }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <CategoryPill label={t('eatkcal.v2.store.all')} selected={category == null} onPress={() => setCategory(null)} />
              {chips.map((n) => (
                <CategoryPill key={n} label={n} selected={category === n} onPress={() => setCategory(n)} />
              ))}
            </ScrollView>
          </View>
        ) : (
          <View />
        )}

        {/* 3 — Ürün ızgarası (2 sütun, 172 fotoğraf) */}
        {loading ? (
          <View style={styles.grid} accessible accessibilityLabel={t('eatkcal.v2.common.loading')}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.cell, { gap: 6 }]}>
                <EkSkeleton height={172} radius={16} />
                <EkSkeleton width="70%" height={14} radius={7} />
                <EkSkeleton width="40%" height={14} radius={7} />
              </View>
            ))}
          </View>
        ) : error ? (
          <View style={styles.gutter}>
            <EmptyErrorCard
              tone="error"
              title={t('eatkcal.v2.store.error_title')}
              description={t('eatkcal.v2.store.error_body')}
              actionLabel={t('eatkcal.v2.home.retry')}
              onAction={load}
            />
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.gutter}>
            <EmptyErrorCard
              tone="empty"
              title={t('eatkcal.v2.store.empty_title')}
              description={t('eatkcal.v2.store.empty_body')}
              actionLabel={t('eatkcal.v2.store.empty_cta')}
              onAction={() => navigation.goBack()}
            />
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map((p) => (
              <View key={String(p.id)} style={styles.cell}>
                <ProductCard
                  product={p}
                  photoHeight={172}
                  onPress={() => openProduct(p.id)}
                  onAdd={() => quickAdd(p)}
                  adding={!!adding[String(p.id)]}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Kapak üstü geri (44, beyaz %85) */}
      <View style={[styles.topBar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => {
            haptic('selection');
            navigation.goBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('eatkcal.v2.common.back')}
          style={[styles.round, { backgroundColor: overlay }]}
        >
          <CaretLeft size={22} color={c.ink} />
        </Pressable>
        {/* Tur 26 (FinEkStore): sağ üst sepet düğmesi yok — sepete geçiş yüzen lime çubukta. */}
      </View>

      <ReviewsSheet
        visible={reviewsOpen}
        onClose={() => setReviewsOpen(false)}
        reviews={reviews}
        aggregate={vitrin.aggregate ?? (rating && !rating.isNew && rating.average != null ? { average: rating.average, count: rating.count } : null)}
        subScores={vitrin.subScores ?? (rating ? { taste: rating.taste, delivery: rating.delivery, calorieFit: rating.calorieFit } : null)}
      />
      {/* Tur 26 md.12 (FinEkStore, FinMoCart): eklemenin geri bildirimi yüzen lime sepet çubuğu
          (görünür/güncellenir; "Sepete git" → sepet). "Sepete eklendi" toast'ının yerini aldı. */}
      <EkCartBar bottom={cartBarBottom(insets.bottom, false)} onPress={() => navigation.navigate('EkCart')} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hero: { height: 220, overflow: 'hidden' },
  head: { paddingHorizontal: 16, paddingTop: 14, gap: 6 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  eta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sticky: { marginTop: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  chipRow: { paddingHorizontal: 16, gap: 10 },
  gutter: { paddingHorizontal: 16, paddingTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 12, rowGap: 16 },
  cell: { width: '50%', paddingHorizontal: 6 },
  topBar: { position: 'absolute', left: 4, right: 4, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
