import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;
import { SkeletonProductCard } from '../components/ui/SkeletonLoader';
import { CachedImage } from '../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Minus, Plus } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingCartPill from '../components/FloatingCartPill';
import { FLOATING_PILL_GAP, FLOATING_PILL_HEIGHT } from '../constants/layout';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { CategoryProduct, fetchProductsByCategory } from '../lib/categories';
import { fetchProductOptionGroups } from '../lib/products';
import { getSupabaseClient } from '../lib/supabase';
import { useCartStore } from '../store/cartStore';
import { RootStackParamList } from '../navigation/types';
import { COLORS } from '../constants/theme';

type CategoryProductsRouteProp = RouteProp<RootStackParamList, 'CategoryProducts'>;
type CategoryProductsNavigationProp = NativeStackNavigationProp<RootStackParamList>;


export default function CategoryProductsScreen() {
  const navigation = useNavigation<CategoryProductsNavigationProp>();
  const route = useRoute<CategoryProductsRouteProp>();
  const insets = useSafeAreaInsets();
  const { categoryName } = route.params;

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const cartItems = useCartStore((state) => state.items);

  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [checkingOptions, setCheckingOptions] = useState<Record<string, boolean>>({});

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const data = await fetchProductsByCategory(categoryName);
      setProducts(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Kategori ürünleri yüklenemedi.';
      setErrorMessage(message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryName]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleAddToCart = async (item: CategoryProduct) => {
    const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
    setCheckingOptions((prev) => ({ ...prev, [numericId]: true }));
    try {
      const supabase = getSupabaseClient();
      const groups = await fetchProductOptionGroups(supabase, String(item.id));
      const hasRequired = groups.some((g) => g.isRequired);
      if (hasRequired) {
        navigation.navigate('ProductDetail', { productId: String(item.id) });
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
          is_available: true,
        },
        {},
        1,
      );
      setCardQuantities((prev) => ({ ...prev, [numericId]: 1 }));
    } finally {
      setCheckingOptions((prev) => ({ ...prev, [numericId]: false }));
    }
  };

  const handleCardQuantityChange = (item: CategoryProduct, newQty: number) => {
    const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
    const cartItem = cartItems.find((i) => i.productId === String(numericId));
    if (newQty <= 0) {
      if (cartItem) removeItem(cartItem.lineKey);
      setCardQuantities((prev) => {
        const next = { ...prev };
        delete next[numericId];
        return next;
      });
    } else {
      if (cartItem) updateQuantity(cartItem.lineKey, newQty);
      setCardQuantities((prev) => ({ ...prev, [numericId]: newQty }));
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <ArrowLeft color="#000000" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{categoryName}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ gap: 12, padding: 16 }}>
          {[1,2,3].map(i => <SkeletonProductCard key={i} />)}
        </View>
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onAction={loadProducts} />
      ) : products.length === 0 ? (
        <EmptyState
          title="Ürün bulunamadı"
          message="Bu kategoride listelenecek ürün yok."
          actionLabel="Tekrar Dene"
          onAction={loadProducts}
        />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={products}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.grid}
          contentContainerStyle={[
            styles.scrollContent,
            // Pill alt edge'i = insets.bottom + GAP (12). Pill yüksekliği 52.
            // Pill üst edge'i = insets.bottom + 64. Buna buffer (48) ekleyerek son kartın tamamı görünsün.
            { paddingBottom: insets.bottom + FLOATING_PILL_HEIGHT + FLOATING_PILL_GAP + 48 },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('ProductDetail', { productId: String(item.id) })
                }
                style={styles.productCard}
                activeOpacity={0.85}
              >
                <View style={styles.imageWrap}>
                  {item.img ? (
                    <CachedImage uri={transformImageUrl(item.img, ImagePreset.productCard) ?? item.img} style={styles.productImage} priority={index < 4 ? 'high' : 'normal'} />
                  ) : (
                    <View style={styles.productImageFallback}>
                      <Text style={styles.productImageFallbackText}>
                        {String(item.name || 'U').slice(0, 1)}
                      </Text>
                    </View>
                  )}
                  {item.calories ? (
                    <View style={styles.caloriesBadge}>
                      <Text style={styles.caloriesText}>{item.calories} kcal</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>
                    ₺{Number(item.price || 0).toFixed(2)}
                  </Text>
                  {(() => {
                    const numericId =
                      typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
                    const qty = cardQuantities[numericId] ?? 0;
                    const checking = checkingOptions[numericId] ?? false;
                    if (qty > 0) {
                      return (
                        <View style={styles.qtyControl}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => handleCardQuantityChange(item, qty - 1)}
                            activeOpacity={0.8}
                          >
                            <Minus size={14} color="#000000" />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => handleCardQuantityChange(item, qty + 1)}
                            activeOpacity={0.8}
                          >
                            <Plus size={14} color="#000000" />
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    return (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => void handleAddToCart(item)}
                        activeOpacity={0.8}
                        disabled={checking}
                      >
                        {checking ? (
                          <ActivityIndicator size={14} color="#000000" />
                        ) : (
                          <Plus size={16} color="#000000" />
                        )}
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </TouchableOpacity>
          )}
        />
      )}

      <FloatingCartPill />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },
  header: {
    backgroundColor: '#f6f6f6',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#000000',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: CARD_PADDING,
    gap: CARD_GAP,
  },
  // Grid (columnWrapperStyle for FlatList numColumns=2)
  grid: {
    gap: CARD_GAP,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrap: {
    width: '100%',
    height: CARD_WIDTH * 0.85,
    borderRadius: 12,
    backgroundColor: '#f6f6f6',
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageFallbackText: {
    color: COLORS.text.tertiary,
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
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
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    lineHeight: 17,
    marginBottom: 6,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brand.green,
    borderRadius: 15,
    height: 30,
    paddingHorizontal: 4,
    gap: 4,
  },
  qtyBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    minWidth: 16,
    textAlign: 'center',
  },
});
