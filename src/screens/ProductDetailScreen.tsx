import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Animated,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { CachedImage } from '../components/CachedImage';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Minus, Plus, ShoppingBag, CheckCircle } from 'phosphor-react-native';
import { MACRO_COLORS, hexToRgba } from '../constants/colors';
import { haptic } from '../utils/haptics';
import { useAnimatedPress } from '../utils/useAnimatedPress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../components/ScreenContainer';
import { getSupabaseClient } from '../lib/supabase';
import {
  fetchProductOptionGroups,
  getGroupSelectionLimits,
  mapProductRow,
} from '../lib/products';
import { RootStackParamList } from '../navigation/types';
import { OptionGroup, Product } from '../types';
import { useCartStore } from '../store/cartStore';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

type ProductDetailRoute = RouteProp<RootStackParamList, 'ProductDetail'>;
type ProductDetailNavigation = NativeStackNavigationProp<RootStackParamList>;

const toCurrency = (value: number) => `₺${value.toFixed(2)}`;

interface MacroBadgeProps {
  label: string;
  value: number | undefined;
  unit: string;
  color: string;
  trackColor: string;
  percentage: number;
}

const MacroBadge: React.FC<MacroBadgeProps> = ({ label, value, unit, color, trackColor, percentage }) => {
  const v = value ?? 0;
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(percentage, 1);

  return (
    <View style={styles.macroBadge}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.macroCenter}>
          <Text style={[styles.macroValue, { color }]}>{v}</Text>
          <Text style={styles.macroUnit}>{unit}</Text>
        </View>
      </View>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
};

export default function ProductDetailScreen() {
  const route = useRoute<ProductDetailRoute>();
  const navigation = useNavigation<ProductDetailNavigation>();
  const insets = useSafeAreaInsets();

  const addItem = useCartStore((state) => state.addItem);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);

  const [addedToCart, setAddedToCart] = useState(false)
  const addButtonScale  = useRef(new Animated.Value(1)).current
  const successOpacity  = useRef(new Animated.Value(0)).current
  const { animatedScale: cartBtnScale, onPressIn: cartPressIn, onPressOut: cartPressOut } = useAnimatedPress(0.95);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [validationAttempted, setValidationAttempted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', route.params.productId)
          .maybeSingle();

        if (!mounted) return;
        if (error) throw error;

        if (!data) {
          setProduct(null);
          setErrorMessage('Ürün bulunamadı.');
          return;
        }

        setProduct(mapProductRow(data as Record<string, unknown>));
      } catch (error: unknown) {
        if (!mounted) return;
        console.error('Ürün detayı alınamadı:', error);
        setProduct(null);
        setErrorMessage('Ürün bilgisi alınamadı.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      mounted = false;
    };
  }, [route.params.productId]);

  useEffect(() => {
    if (!product?.id) return;
    let mounted = true;

    const fetchOptions = async () => {
      try {
        setOptionsLoading(true);
        setOptionsError('');

        const supabase = getSupabaseClient();
        const groups = await fetchProductOptionGroups(supabase, String(product.id));

        if (!mounted) return;
        setOptionGroups(groups);

        setSelections({});
      } catch (error: unknown) {
        if (!mounted) return;
        console.error('Ürün opsiyonları alınamadı:', error);
        setOptionGroups([]);
        setSelections({});
        setOptionsError('Seçim grupları şu an yüklenemiyor.');
      } finally {
        if (mounted) {
          setOptionsLoading(false);
        }
      }
    };

    fetchOptions();

    return () => {
      mounted = false;
    };
  }, [product?.id]);

  const toggleSelection = (group: OptionGroup, itemId: string) => {
    const { max } = getGroupSelectionLimits(group);

    setSelections((prev) => {
      const current = new Set(prev[group.id] || []);

      if (max === 1) {
        return {
          ...prev,
          [group.id]: [itemId],
        };
      }

      if (current.has(itemId)) {
        current.delete(itemId);
      } else if (current.size < max) {
        current.add(itemId);
      }

      return {
        ...prev,
        [group.id]: Array.from(current),
      };
    });
  };

  const selectionsValid = useMemo(() => {
    if (!optionGroups.length) return true;

    return optionGroups.every((group) => {
      const { min, max } = getGroupSelectionLimits(group);
      const selectedCount = (selections[group.id] || []).length;
      return selectedCount >= min && selectedCount <= max;
    });
  }, [optionGroups, selections]);

  const extraPrice = useMemo(() => {
    let total = 0;
    optionGroups.forEach((group) => {
      const selectedIds = new Set(selections[group.id] || []);
      group.items.forEach((item) => {
        if (selectedIds.has(item.id)) {
          total += item.priceAdjustment;
        }
      });
    });
    return Number(total.toFixed(2));
  }, [optionGroups, selections]);

  const optionLabels = useMemo(() => {
    const labels: string[] = [];

    optionGroups.forEach((group) => {
      const selectedIds = new Set(selections[group.id] || []);
      group.items.forEach((item) => {
        if (selectedIds.has(item.id)) {
          labels.push(`${group.name}: ${item.name}`);
        }
      });
    });

    return labels;
  }, [optionGroups, selections]);

  const totalUnitPrice = Number(((product?.price || 0) + extraPrice).toFixed(2));
  const totalPrice = Number((totalUnitPrice * quantity).toFixed(2));

  const animateAddToCart = () => {
    Animated.sequence([
      Animated.spring(addButtonScale, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(addButtonScale, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 12 }),
    ]).start()
    Animated.sequence([
      Animated.timing(successOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  const handleAddToCart = () => {
    if (!product) return;
    if (!selectionsValid) {
      setValidationAttempted(true);
      haptic.error();
      return;
    }

    addItem(
      product,
      {
        byGroup: selections,
        extraPrice,
        labels: optionLabels,
      },
      quantity,
    );

    haptic.light();
    animateAddToCart();
    setAddedToCart(true);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.brand.green} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!product) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Ürün Yüklenemedi</Text>
          <Text style={styles.errorText}>{errorMessage || 'Bilinmeyen hata oluştu.'}</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const totalCalMacros =
    ((product?.carbs ?? 0) * 4) +
    ((product?.protein ?? 0) * 4) +
    ((product?.fats ?? 0) * 9) || 1;

  const macros = [
    {
      label: 'Kalori',
      value: product?.calories ?? product?.cal,
      unit: 'kcal',
      color: MACRO_COLORS.calories.main,
      trackColor: MACRO_COLORS.calories.track,
      percentage: Math.min(((product?.calories ?? product?.cal ?? 0) / 2000), 1),
    },
    {
      label: 'Karb.',
      value: product?.carbs,
      unit: 'g',
      color: MACRO_COLORS.carbs.main,
      trackColor: MACRO_COLORS.carbs.track,
      percentage: ((product?.carbs ?? 0) * 4) / totalCalMacros,
    },
    {
      label: 'Protein',
      value: product?.protein,
      unit: 'g',
      color: MACRO_COLORS.protein.main,
      trackColor: MACRO_COLORS.protein.track,
      percentage: ((product?.protein ?? 0) * 4) / totalCalMacros,
    },
    {
      label: 'Yağ',
      value: product?.fats,
      unit: 'g',
      color: MACRO_COLORS.fat.main,
      trackColor: MACRO_COLORS.fat.track,
      percentage: ((product?.fats ?? 0) * 9) / totalCalMacros,
    },
  ];

  return (
    <ScreenContainer style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptic.selection();
            navigation.goBack();
          }}
          style={styles.iconButton}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ürün Detayı</Text>
        <View style={styles.headerActions} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
        contentContainerStyle={{
          paddingBottom: Math.max(180, insets.bottom + 140),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Image */}
        <View style={styles.imageContainer}>
          {product.img && !imageLoadError ? (
            <CachedImage
              uri={product.img}
              style={styles.image}
              onError={() => setImageLoadError(true)}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderEmoji}>🍽️</Text>
              <Text style={styles.imagePlaceholderText}>Görsel Yüklenemedi</Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          {/* Title + Quantity Controls */}
          <View style={styles.titleRow}>
            <Text style={styles.productTitle}>{product.name}</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                onPress={() => {
                  haptic.light();
                  const newQty = Math.max(1, quantity - 1);
                  setQuantity(newQty);
                  if (addedToCart) {
                    const { items, updateQuantity } = useCartStore.getState();
                    const existing = items.find(
                      i => i.productId === String(product?.id) &&
                      JSON.stringify(i.selectedOptions?.byGroup) === JSON.stringify(selections)
                    );
                    if (existing) updateQuantity(existing.lineKey, newQty);
                  }
                }}
                style={styles.quantityButtonSmall}
                activeOpacity={0.8}
              >
                <Minus size={13} color="#000000" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                onPress={() => {
                  haptic.light();
                  const newQty = quantity + 1;
                  setQuantity(newQty);
                  if (addedToCart) {
                    const { items, updateQuantity } = useCartStore.getState();
                    const existing = items.find(
                      i => i.productId === String(product?.id) &&
                      JSON.stringify(i.selectedOptions?.byGroup) === JSON.stringify(selections)
                    );
                    if (existing) updateQuantity(existing.lineKey, newQty);
                  }
                }}
                style={[styles.quantityButtonSmall, styles.quantityButtonActive]}
                activeOpacity={0.8}
              >
                <Plus size={13} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Macro Badges */}
          {(product.calories ?? product.cal) != null && (
            <View style={styles.macroContainer}>
              {macros.map((m) => (
                <MacroBadge key={m.label} {...m} />
              ))}
            </View>
          )}

          {/* Description */}
          {product.desc ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionTitle}>Açıklama</Text>
              <Text style={styles.descriptionText}>{product.desc}</Text>
            </View>
          ) : null}
        </View>

        {optionsLoading ? (
          <View style={styles.optionsLoading}>
            <ActivityIndicator color={COLORS.brand.green} />
          </View>
        ) : null}

        {!optionsLoading && optionGroups.length > 0 ? (
          <View style={styles.optionsWrapper}>
            {optionGroups.map((group) => {
              const selected = new Set(selections[group.id] || []);
              const { min, max } = getGroupSelectionLimits(group);
              const selectedCount = selected.size;
              const isGroupInvalid = validationAttempted && selectedCount < min;

              return (
                <View key={group.id} style={[styles.optionGroupCard, isGroupInvalid && styles.optionGroupCardError]}>
                  <View style={styles.optionGroupHeader}>
                    <Text style={styles.optionGroupTitle}>{group.name}</Text>
                    {min > 0 && (
                      <Text style={[styles.requiredBadge, isGroupInvalid && styles.requiredBadgeError]}>
                        Zorunlu
                      </Text>
                    )}
                  </View>
                  {group.description ? (
                    <Text style={styles.optionGroupDesc}>{group.description}</Text>
                  ) : null}
                  {isGroupInvalid && (
                    <Text style={styles.groupValidationError}>⚠ Lütfen bir seçim yapınız</Text>
                  )}

                  {group.items.map((item) => {
                    const isSelected = selected.has(item.id);
                    const isDisabled =
                      !item.isAvailable ||
                      (!isSelected && max > 1 && selected.size >= max);

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => toggleSelection(group, item.id)}
                        disabled={isDisabled}
                        style={({ pressed }) => [
                          styles.optionRow,
                          isSelected && styles.optionRowSelected,
                          isDisabled && styles.optionRowDisabled,
                          pressed && !isDisabled && styles.optionRowPressed,
                        ]}
                      >
                        <Text style={styles.optionName}>{item.name}</Text>
                        <Text style={styles.optionPrice}>
                          {item.priceAdjustment > 0
                            ? `+${toCurrency(item.priceAdjustment)}`
                            : 'Dahil'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}

        {!optionsLoading && optionsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{optionsError}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Cart Banner */}
      {addedToCart && (
        <TouchableOpacity
          style={[styles.cartBanner, { bottom: Math.max(14, insets.bottom) + 80 }]}
          onPress={() => navigation.navigate('Tabs', { screen: 'Cart' })}
          activeOpacity={0.9}
        >
          <ShoppingBag size={16} color="#000000" />
          <Text style={styles.cartBannerText}>Sepete eklendi — Sepete git →</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom) }]}>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Toplam Tutar</Text>
          <Text style={styles.priceValue}>{toCurrency(totalPrice)}</Text>
        </View>
        <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={handleAddToCart}
            onPressIn={cartPressIn}
            onPressOut={cartPressOut}
            activeOpacity={1}
          >
            <ShoppingBag size={18} color="#000000" />
            <Text style={styles.addToCartText}>Sepete Ekle</Text>
            <Animated.View style={{ position: 'absolute', right: 16, opacity: successOpacity }}>
              <CheckCircle size={18} color="#000000" weight="fill" />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    textAlign: 'center',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    height: 260,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  imagePlaceholderEmoji: {
    fontSize: 40,
    opacity: 0.4,
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: '#b0b0b0',
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  infoCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    paddingTop: 20,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  productTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 12,
    lineHeight: 26,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  quantityButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonActive: {
    backgroundColor: COLORS.brand.green,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    minWidth: 20,
    textAlign: 'center',
  },
  macroContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    gap: 0,
    justifyContent: 'space-between',
  },
  macroBadge: {
    alignItems: 'center',
    gap: 8,
  },
  macroCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    lineHeight: 17,
  },
  macroUnit: {
    fontSize: 9,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.tertiary,
    lineHeight: 10,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.tertiary,
  },
  descriptionSection: {
    marginBottom: 4,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  optionsLoading: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionsWrapper: {
    gap: 12,
    paddingHorizontal: 16,
  },
  optionGroupCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionGroupCardError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  optionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  requiredBadge: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    overflow: 'hidden',
  },
  requiredBadgeError: {
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  groupValidationError: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginTop: 6,
  },
  optionGroupDesc: {
    marginTop: 3,
    color: '#666',
    fontSize: 13,
  },
  optionGroupRule: {
    marginTop: 6,
    color: COLORS.brand.green,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  optionRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowSelected: {
    borderColor: COLORS.brand.green,
    backgroundColor: '#F5FBE4',
  },
  optionRowDisabled: {
    opacity: 0.45,
  },
  optionRowPressed: {
    opacity: 0.85,
  },
  optionName: {
    color: COLORS.text.primary,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    flex: 1,
    paddingRight: 10,
  },
  optionPrice: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  errorBox: {
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorBoxText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    paddingTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 8,
  },
  priceSection: {
    gap: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  addToCartButton: {
    height: 52,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  addToCartText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  errorTitle: {
    fontSize: 22,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 14,
  },
  secondaryButton: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  secondaryButtonText: {
    color: COLORS.text.primary,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  cartBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: COLORS.brand.green,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cartBannerText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    flex: 1,
  },
});
