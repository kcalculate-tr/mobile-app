import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ActivityIndicator, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage } from '../components/CachedImage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MagnifyingGlass, MapPin, CaretDown, Question, CaretRight, Plus, Minus, Tag } from 'phosphor-react-native';
import { TAB_BAR_TOTAL } from '../constants/layout';
import { haptic } from '../utils/haptics';
import HowItWorksModal from '../components/modals/HowItWorksModal';
import PopupModal from '../components/PopupModal';
import { useModal } from '../hooks/useModal';
import { usePopups } from '../hooks/usePopups';
import { useCartStore } from '../store/cartStore';
import { Category, fetchCategories } from '../lib/categories';
import { RootStackParamList } from '../navigation/types';
import { Product, fetchProducts, fetchFeaturedProducts, fetchProductOptionGroups } from '../lib/products';
import { getSupabaseClient } from '../lib/supabase';
import { BannerCell, BannerRow, fetchBannerRows } from '../lib/banners';
import { resolveNavigation } from '../lib/navigation';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import { useAddressStore } from '../store/addressStore';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_W = SCREEN_W - 32 + 12;
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_W - CARD_PADDING * 2 - CARD_GAP) / 2;
const BANNER_PADDING = 16;
const FULL_BANNER_WIDTH = SCREEN_W - BANNER_PADDING * 2;
const BANNER_HEIGHT = 155;
const PROMO_CELL_GAP = 8;

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

const ALL_PRODUCTS_NAMES = ['Tüm Ürünler', 'Tum Urunler'];

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const howItWorks = useModal();
  const { popup, total, index, handleClose, handleNext } = usePopups();
  const insets = useSafeAreaInsets();
  const selectedAddress = useAddressStore((s) => s.selectedAddress);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const cartItems = useCartStore((state) => state.items);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [heroRows, setHeroRows] = useState<BannerRow[]>([]);
  const [promoRows, setPromoRows] = useState<BannerRow[]>([]);
  const [activeHero, setActiveHero] = useState(0);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [checkingOptions, setCheckingOptions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const heroFlatListRef = useRef<FlatList>(null);
  const activeDotWidth  = useRef(new Animated.Value(14)).current;

// Active dot expand animation
  useEffect(() => {
    activeDotWidth.setValue(5);
    Animated.spring(activeDotWidth, { toValue: 14, useNativeDriver: false, speed: 20, bounciness: 4 }).start();
  }, [activeHero]);

  const heroCells = useMemo(
    () => heroRows.flatMap((r) => r.cells),
    [heroRows],
  );

  useEffect(() => {
    if (heroCells.length <= 1) return;
    const interval = setInterval(() => {
      setActiveHero((prev) => {
        const next = prev + 1 >= heroCells.length ? 0 : prev + 1;
        heroFlatListRef.current?.scrollToOffset({ offset: next * SLIDE_W, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [heroCells.length]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, prods, bannerData, featured] = await Promise.all([
        fetchCategories(),
        fetchProducts(),
        fetchBannerRows(),
        fetchFeaturedProducts(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setHeroRows(bannerData.hero);
      setPromoRows(bannerData.promo);
      setFeaturedProducts(featured);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCategoryPress = (cat: Category) => {
    haptic.selection();
    setSearchText('');
    navigation.navigate('CategoryProducts', { categoryName: cat.name });
  };

  const handleProductPress = (product: Product) => {
    haptic.selection();
    navigation.navigate('ProductDetail', { productId: product.id.toString() });
  };

  const handleAddToCart = async (product: Product) => {
    haptic.medium();
    setCheckingOptions(prev => ({ ...prev, [product.id]: true }));
    try {
      const supabase = getSupabaseClient();
      const groups = await fetchProductOptionGroups(supabase, String(product.id));
      const hasRequired = groups.some(g => g.isRequired || g.minSelection > 0);
      if (hasRequired) {
        haptic.selection();
        navigation.navigate('ProductDetail', { productId: product.id.toString() });
        return;
      }
    } catch {
      // hata olursa direkt ekle
    } finally {
      setCheckingOptions(prev => ({ ...prev, [product.id]: false }));
    }
    addItem(product, {}, 1);
    setCardQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  const handleCardQuantityChange = (product: Product, newQty: number) => {
    haptic.light();
    if (newQty <= 0) {
      const existingItem = cartItems.find(
        i => i.productId === String(product.id) &&
        Object.keys(i.selectedOptions?.byGroup ?? {}).length === 0
      );
      if (existingItem) removeItem(existingItem.lineKey);
      setCardQuantities(prev => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      return;
    }
    const existingItem = cartItems.find(
      i => i.productId === String(product.id) &&
      Object.keys(i.selectedOptions?.byGroup ?? {}).length === 0
    );
    if (existingItem) updateQuantity(existingItem.lineKey, newQty);
    setCardQuantities(prev => ({ ...prev, [product.id]: newQty }));
  };

  const allCategoriesWithAll: Category[] = useMemo(() => {
    const allProducts = categories.find((c) => ALL_PRODUCTS_NAMES.includes(c.name));
    if (!allProducts) return categories;
    const others = categories.filter((c) => !ALL_PRODUCTS_NAMES.includes(c.name));
    return [allProducts, ...others];
  }, [categories]);

  const displayProducts = searchText.trim()
    ? products.filter(p => p.name.toLowerCase().includes(searchText.toLowerCase()))
    : (featuredProducts.length > 0 ? featuredProducts : products.slice(0, 6));

  const renderHeroBanner = useCallback(({ item: cell }: { item: BannerCell }) => (
    <TouchableOpacity
      style={styles.heroSlide}
      activeOpacity={0.95}
      onPress={() => resolveNavigation(navigation, cell.navigate_to)}
    >
      <CachedImage
        uri={transformImageUrl(cell.image_url ?? '', ImagePreset.bannerLarge) ?? (cell.image_url ?? '')}
        style={styles.heroImage}
        priority="high"
      />
    </TouchableOpacity>
  ), [navigation]);

  return (
    <View style={[styles.container, { flex: 1, paddingTop: insets.top }]}>
      {loading && (
        <View style={styles.skeletonContainer}>
          {/* Skeleton Header */}
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeletonBox, { width: 80, height: 32, borderRadius: RADIUS.xs }]} />
            <View style={[styles.skeletonBox, { width: 120, height: 32, borderRadius: RADIUS.pill }]} />
            <View style={[styles.skeletonBox, { width: 36, height: 36, borderRadius: RADIUS.md }]} />
          </View>
          {/* Skeleton Search */}
          <View style={[styles.skeletonBox, { height: 52, borderRadius: RADIUS.pill, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }]} />
          {/* Skeleton Categories */}
          <View style={styles.skeletonCategoryRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.skeletonCategory}>
                <View style={[styles.skeletonBox, { width: 54, height: 54, borderRadius: RADIUS.md }]} />
                <View style={[styles.skeletonBox, { width: 40, height: 10, borderRadius: 4, marginTop: SPACING.xs }]} />
              </View>
            ))}
          </View>
          {/* Skeleton Banner */}
          <View style={[styles.skeletonBox, { aspectRatio: 2, borderRadius: RADIUS.lg, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }]} />
          {/* Skeleton Grid */}
          <View style={styles.skeletonGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={[styles.skeletonBox, { height: 110, borderRadius: RADIUS.sm, marginBottom: SPACING.sm }]} />
                <View style={[styles.skeletonBox, { height: 12, borderRadius: 4, marginBottom: SPACING.xs, width: '80%' }]} />
                <View style={[styles.skeletonBox, { height: 12, borderRadius: 4, width: '50%' }]} />
              </View>
            ))}
          </View>
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_TOTAL + 24 },
        ]}
        style={{ display: loading ? 'none' : 'flex' }}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Logo - absolute sol */}
          <View style={{ position: 'absolute', left: 16, zIndex: 1, gap: 4 }}>
            <Image
              source={require('../../assets/kcal-logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>

          {/* Adres - tam merkez */}
          <TouchableOpacity
            style={styles.addressButton}
            onPress={() => navigation.navigate('Addresses')}
            activeOpacity={0.8}
          >
            <MapPin size={13} color="#000000" />
            <Text style={styles.addressText} numberOfLines={1}>
              {selectedAddress?.neighbourhood || selectedAddress?.district || 'Adres seçin'}
            </Text>
            <CaretDown size={12} color="#000000" />
          </TouchableOpacity>

          {/* Sağ butonlar */}
          <View style={{ position: 'absolute', right: 8, zIndex: 1, flexDirection: 'row', gap: 0, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => navigation.navigate('ProfileCoupons')}
              activeOpacity={0.8}
            >
              <Tag size={16} color="#000000" />
              <Text style={styles.headerActionText}>Kuponlar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={howItWorks.open}
              activeOpacity={0.8}
            >
              <Question size={16} color="#000000" />
              <Text style={styles.headerActionText}>Nasıl Çalışır?</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Empty/Retry State */}
        {!loading && products.length === 0 && categories.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Text style={{ fontSize: 16, color: '#878787', marginBottom: 16, fontFamily: 'PlusJakartaSans_500Medium' }}>
              İçerikler yüklenemedi
            </Text>
            <TouchableOpacity onPress={fetchData} style={{ backgroundColor: '#C6F04F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 }}>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000' }}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero Banner Slider */}
        {heroCells.length > 0 && (
          <View style={styles.heroWrapper}>
            <FlatList
              keyboardShouldPersistTaps="handled"
              ref={heroFlatListRef}
              data={heroCells}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              snapToAlignment="start"
              snapToInterval={SLIDE_W}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SPACING.md, paddingHorizontal: SPACING.lg }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
                setActiveHero(idx);
              }}
              renderItem={renderHeroBanner}
            />
            {heroCells.length > 1 && (
              <View style={styles.bannerDots}>
                {heroCells.map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.bannerDot,
                      i === activeHero && { backgroundColor: '#C6F04F', width: activeDotWidth },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Categories */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          style={styles.categoryScroll}
        >
          {allCategoriesWithAll.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryItem}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.8}
            >
              <View style={styles.categoryIcon}>
                {cat.img ? (
                  <CachedImage uri={transformImageUrl(cat.img, ImagePreset.categoryIcon) ?? cat.img} style={{ width: 56, height: 56, borderRadius: RADIUS.sm }} />
                ) : (
                  <Text style={styles.categoryEmoji}>
                    {cat.emoji || cat.name.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.categoryName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Bu Hafta Popüler — banner_rows promo grid */}
        {promoRows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bu Hafta Popüler</Text>
            {promoRows.map((row) => {
              const gapTotal = (row.grid_size - 1) * PROMO_CELL_GAP;
              const cellWidth = (FULL_BANNER_WIDTH - gapTotal) / row.grid_size;
              return (
                <View key={row.id} style={styles.promoRow}>
                  {row.cells.map((cell, idx) => (
                    <TouchableOpacity
                      key={cell.id}
                      style={[
                        styles.promoCell,
                        {
                          width: cellWidth,
                          height: BANNER_HEIGHT,
                          marginRight: idx < row.cells.length - 1 ? PROMO_CELL_GAP : 0,
                        },
                      ]}
                      activeOpacity={0.9}
                      onPress={() => resolveNavigation(navigation, cell.navigate_to, 'Offers')}
                    >
                      <CachedImage
                        uri={
                          transformImageUrl(
                            cell.image_url ?? '',
                            row.grid_size === 1 ? ImagePreset.bannerLarge : ImagePreset.bannerMedium,
                          ) ?? (cell.image_url ?? '')
                        }
                        style={styles.promoImage}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <MagnifyingGlass size={18} color={COLORS.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün ara..."
            placeholderTextColor={COLORS.text.tertiary}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Sana Özel Teklifler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sana Özel Teklifler</Text>
          
          {/* Product Grid */}
          <View style={styles.productGrid}>
            {displayProducts.map((product, idx) => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.8}
              >
                <View style={styles.productImageContainer}>
                  {product.img ? (
                    <CachedImage uri={transformImageUrl(product.img, ImagePreset.productCard) ?? product.img} style={styles.productImage} priority={idx < 2 ? 'high' : 'normal'} />
                  ) : (
                    <Text style={styles.productImageFallback}>
                      {String(product.name || '').slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                  {product.calories ? (
                    <View style={styles.caloriesBadge}>
                      <Text style={styles.caloriesText}>{product.calories} kcal</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.productFooter}>
                    <Text style={styles.productPrice}>₺{product.price.toFixed(2)}</Text>
                    {cardQuantities[product.id] ? (
                      <View style={styles.qtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleCardQuantityChange(product, (cardQuantities[product.id] ?? 1) - 1);
                          }}
                          activeOpacity={0.8}
                        >
                          <Minus size={12} color="#000000" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{cardQuantities[product.id]}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleCardQuantityChange(product, (cardQuantities[product.id] ?? 1) + 1);
                          }}
                          activeOpacity={0.8}
                        >
                          <Plus size={12} color="#000000" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        activeOpacity={0.8}
                        disabled={checkingOptions[product.id]}
                      >
                        {checkingOptions[product.id] ? (
                          <ActivityIndicator size="small" color="#000000" />
                        ) : (
                          <Plus size={16} color="#000000" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <HowItWorksModal visible={howItWorks.visible} onClose={howItWorks.close} />
      {popup && (
        <PopupModal
          popup={popup}
          total={total}
          index={index}
          onClose={handleClose}
          onNext={handleNext}
          onCta={(dest) => resolveNavigation(navigation, dest)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
  },
  scrollContent: {},
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  logoImg: { width: 80, height: 32 },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.xs,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: TYPOGRAPHY.size.lg,
  },
  logoText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.pill,
    paddingVertical: 7,
    paddingHorizontal: SPACING.md,
    maxWidth: 220,
  },
  addressText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
  },
  headerActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    width: 54,
  },
  headerActionText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#555555',
    textAlign: 'center',
    lineHeight: 11,
  },
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Search Bar
  searchBar: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.text.primary,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.text.tertiary,
  },
  searchButton: {
    backgroundColor: '#000000',
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  searchButtonText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.brand.green,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  // Categories
  categoryScroll: {
    marginBottom: SPACING.lg,
  },
  categoryRow: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  categoryItem: {
    alignItems: 'center',
    width: 72,
    gap: SPACING.xs,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryEmoji: {
    fontSize: TYPOGRAPHY.size['3xl'],
  },
  categoryName: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
    textAlign: 'center',
    lineHeight: 14,
    flexWrap: 'wrap',
    maxWidth: 68,
  },
  // Section
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING['2xl'],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    letterSpacing: -0.4,
  },
  // Promo grid (banner_rows promo — her row N hücre yan yana, eşit yükseklik)
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  promoCell: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  promoImage: {
    width: '100%',
    height: '100%',
  },
  promoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: 'transparent',
  },
  promoEmoji: {
    fontSize: TYPOGRAPHY.size['3xl'],
    marginBottom: SPACING.xs,
    opacity: 0.9,
  },
  promoTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.white,
    marginBottom: SPACING.xs,
    lineHeight: 14,
  },
  promoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  promoActionText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.brand.green,
  },
  badgeText: { color: 'white', fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},
  chipScroll: {
    maxHeight: 52,
    marginBottom: SPACING.md,
  },
  chipRow: {
    gap: SPACING.sm,
  },
  chip: {
    height: 34,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.brand.green,
  },
  chipText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
    opacity: 0.6,
  },
  chipTextActive: {
    opacity: 1,
  },
  // Product Grid
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    overflow: 'hidden',
    ...SHADOWS.md,
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 220,
  },
  productImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.85,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImageFallback: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    fontSize: TYPOGRAPHY.size['4xl'],
    fontWeight: TYPOGRAPHY.weight.bold,
    color: COLORS.text.disabled,
    transform: [{ translateX: -12 }, { translateY: -20 }],
  },
  caloriesBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  caloriesText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.3,
  },
  productName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
    marginBottom: 0,
    lineHeight: 16,
    flex: 1,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: 0,
  },

  // Hero banner slider
  heroWrapper: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  heroSlide: {
    width: SCREEN_W - 32,
    aspectRatio: 2,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: SPACING.sm,
  },
  bannerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  privilegedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#FEF2F2',
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: SPACING.xs,
  },
  privilegedBadgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#DC2626',
  },
  bannerDotActive: {
    backgroundColor: '#000000',
    width: 14,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  qtyBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
    minWidth: 16,
    textAlign: 'center',
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  skeletonBox: {
    backgroundColor: '#E5E7EB',
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  skeletonCategoryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  skeletonCategory: {
    alignItems: 'center',
    width: 54,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  skeletonCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    minHeight: 180,
  },
});
