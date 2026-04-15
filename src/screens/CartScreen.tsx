import React, { useEffect, useRef, useState } from 'react';
import { Animated, ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {CaretRight, Minus, Plus, Tag, Trash, Flame, Truck, Confetti} from 'phosphor-react-native';
import { MACRO_COLORS, hexToRgba } from '../constants/colors';
import ScreenContainer from '../components/ScreenContainer';
import { CachedImage } from '../components/CachedImage';
import { haptic } from '../utils/haptics';
import { useAnimatedPress } from '../utils/useAnimatedPress';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import DeliveryInfoModal from '../components/modals/DeliveryInfoModal';
import { useModal } from '../hooks/useModal';
import { useCartStore } from '../store/cartStore';
import { RootStackParamList } from '../navigation/types';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { getSupabaseClient } from '../lib/supabase';

type CartNavProp = NativeStackNavigationProp<RootStackParamList>;

const FREE_DELIVERY_THRESHOLD = 150;
const DELIVERY_FEE = 15;

export default function CartScreen() {
  const navigation = useNavigation<CartNavProp>();
  const insets = useSafeAreaInsets();
  const deliveryModal = useModal();
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem = useCartStore(s => s.removeItem);
  const getSubtotal = useCartStore(s => s.getSubtotal);
  const getTotalMacros = useCartStore(s => s.getTotalMacros);
  const subtotal = getSubtotal();
  const totalMacros = getTotalMacros();
  const hasTotalMacros = totalMacros.kcal > 0 || totalMacros.protein > 0;
  const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const isFreeDelivery = remainingForFree === 0;
  const deliveryFee = isFreeDelivery ? 0 : DELIVERY_FEE;

  const [couponCode,    setCouponCode]    = useState('');
  const [couponInput,   setCouponInput]   = useState('');
  const [couponOpen,    setCouponOpen]    = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError,   setCouponError]   = useState('');
  const couponSlideY   = useRef(new Animated.Value(-20)).current
  const couponOpacity  = useRef(new Animated.Value(0)).current
  const { toast, show: showToast, hide: hideToast } = useToast()
  const { animatedScale: checkoutScale, onPressIn: checkoutPressIn, onPressOut: checkoutPressOut } = useAnimatedPress(0.97)
  const [couponData,    setCouponData]    = useState<{ discount_type: string; discount_value: number; title: string } | null>(null);



  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponError('Kupon kodu girin.'); return; }
    setCouponLoading(true); setCouponError('');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('id,title,code,discount_type,discount_value,min_cart_total,end_date,is_active')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    setCouponLoading(false);
    if (error || !data) { setCouponError('Geçersiz veya süresi dolmuş kupon.'); return; }
    if (data.end_date && new Date(data.end_date) < new Date()) { setCouponError('Bu kuponun süresi dolmuş.'); return; }
    if (data.min_cart_total > 0 && subtotal < data.min_cart_total) {
      setCouponError(`Min. sepet tutarı ₺${data.min_cart_total} olmalı.`); return;
    }
    haptic.success();
    setCouponCode(code);
    setCouponData({ discount_type: data.discount_type, discount_value: data.discount_value, title: data.title });
    setCouponOpen(false);
    setCouponError('');
    showToast(`${code} kuponu uygulandı!`, 'success');
  };

  const removeCoupon = () => { setCouponCode(''); setCouponData(null); setCouponInput(''); };

  useEffect(() => {
    if (couponCode) {
      Animated.parallel([
        Animated.spring(couponSlideY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.timing(couponOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
    } else {
      couponSlideY.setValue(-20)
      couponOpacity.setValue(0)
    }
  }, [couponCode])

  const couponDiscount = couponData
    ? couponData.discount_type === 'percent'
      ? Math.round(subtotal * couponData.discount_value / 100)
      : Math.min(couponData.discount_value, subtotal)
    : 0;

  const total = subtotal + deliveryFee - couponDiscount;

  if (items.length === 0) {
    return (
      <ScreenContainer edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sepetim</Text>
          <TouchableOpacity style={styles.deliveryBtn} onPress={deliveryModal.open} activeOpacity={0.8}>
            <Truck size={15} color="#000000" />
            <Text style={styles.deliveryBtnText}>Teslimat Nasıl Olur?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Sepetiniz Boş</Text>
          <Text style={styles.emptySubtitle}>
            Ürün eklemek için menüyü inceleyin.
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('Categories')}
            activeOpacity={0.85}
          >
            <Text style={styles.browseButtonText}>Menüye Git</Text>
          </TouchableOpacity>
        </View>
        <DeliveryInfoModal visible={deliveryModal.visible} onClose={deliveryModal.close} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sepetim</Text>
        <TouchableOpacity style={styles.deliveryBtn} onPress={deliveryModal.open} activeOpacity={0.8}>
          <Truck size={15} color="#000000" />
          <Text style={styles.deliveryBtnText}>Teslimat Nasıl Olur?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shipping threshold banner */}
        <View style={[styles.shippingBanner, isFreeDelivery ? styles.shippingBannerFree : styles.shippingBannerPending]}>
          {isFreeDelivery ? (
            <>
              <Confetti size={18} color="#16A34A" weight="fill" />
              <Text style={[styles.shippingText, styles.shippingTextFree]}>Ücretsiz teslimat kazandınız!</Text>
            </>
          ) : (
            <>
              <Truck size={18} color="#64748b" weight="fill" />
              <Text style={styles.shippingText}>
                Ücretsiz teslimat için{' '}
                <Text style={styles.shippingHighlight}>₺{remainingForFree.toFixed(2)}</Text>
                {' '}daha ekle
              </Text>
            </>
          )}
        </View>

        {/* Shipping progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` as any },
            ]}
          />
        </View>

        {/* Items */}
        {items.map((item) => {
          const itemKcal = Math.round((item.calories ?? 0) * item.quantity);
          const itemProtein = (item.protein ?? 0) * item.quantity;
          const itemCarbs = (item.carbs ?? 0) * item.quantity;
          const itemFats = (item.fats ?? 0) * item.quantity;
          const itemHasMacros = itemKcal > 0 || itemProtein > 0 || itemCarbs > 0 || itemFats > 0;

          return (
            <View key={item.lineKey} style={styles.itemCard}>
              {/* Main row */}
              <View style={styles.itemRow}>
                <View style={styles.itemImage}>
                  {item.img ? (
                    <CachedImage uri={item.img} style={{ width: 76, height: 76, borderRadius: RADIUS.sm }} />
                  ) : (
                    <Text style={styles.itemImageLetter}>
                      {String(item.name || 'U').slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {item.selectedOptions.labels.length > 0 ? (
                    <Text style={styles.itemOptions} numberOfLines={1}>
                      {item.selectedOptions.labels.join(', ')}
                    </Text>
                  ) : null}
                  <Text style={styles.itemPrice}>₺{(item.unitPrice * item.quantity).toFixed(2)}</Text>
                </View>

                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => { haptic.medium(); removeItem(item.lineKey); }}
                  >
                    <Trash size={13} color="#FF3B30" />
                  </TouchableOpacity>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => { haptic.medium(); updateQuantity(item.lineKey, item.quantity - 1); }}
                    >
                      <Minus size={13} color={COLORS.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, styles.qtyBtnAdd]}
                      onPress={() => { haptic.light(); updateQuantity(item.lineKey, item.quantity + 1); }}
                    >
                      <Plus size={13} color="#000000" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Macro pills */}
              {itemHasMacros ? (
                <View style={styles.macroPills}>
                  {itemKcal > 0 ? (
                    <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.calories.track }]}>
                      <Text style={[styles.macroPillText, { color: MACRO_COLORS.calories.main }]}>{itemKcal} kcal</Text>
                    </View>
                  ) : null}
                  {itemProtein > 0 ? (
                    <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.protein.track }]}>
                      <Text style={[styles.macroPillText, { color: MACRO_COLORS.protein.main }]}>{itemProtein % 1 === 0 ? itemProtein : itemProtein.toFixed(1)}g P</Text>
                    </View>
                  ) : null}
                  {itemCarbs > 0 ? (
                    <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.carbs.track }]}>
                      <Text style={[styles.macroPillText, { color: MACRO_COLORS.carbs.main }]}>{itemCarbs % 1 === 0 ? itemCarbs : itemCarbs.toFixed(1)}g K</Text>
                    </View>
                  ) : null}
                  {itemFats > 0 ? (
                    <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.fat.track }]}>
                      <Text style={[styles.macroPillText, { color: MACRO_COLORS.fat.main }]}>{itemFats % 1 === 0 ? itemFats : itemFats.toFixed(1)}g Y</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Coupon */}
        {couponCode ? (
          <Animated.View style={[styles.couponApplied, { opacity: couponOpacity, transform: [{ translateY: couponSlideY }] }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}>
              <View style={styles.couponAppliedIcon}><Tag size={14} color="#000" /></View>
              <View>
                <Text style={styles.couponAppliedCode}>{couponCode}</Text>
                <Text style={styles.couponAppliedDesc}>{couponData?.title}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={removeCoupon} style={styles.couponRemoveBtn} activeOpacity={0.7}>
              <Text style={styles.couponRemoveText}>Kaldır</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : couponOpen ? (
          <View style={styles.couponInputCard}>
            <View style={styles.couponInputRow}>
              <TextInput
                style={styles.couponInput}
                value={couponInput}
                onChangeText={v => setCouponInput(v.toUpperCase())}
                placeholder="KUPON KODUNUZ"
                placeholderTextColor={COLORS.text.tertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
              />
              <TouchableOpacity style={styles.couponApplyBtn} onPress={applyCoupon} disabled={couponLoading} activeOpacity={0.85}>
                {couponLoading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={styles.couponApplyBtnText}>Uygula</Text>}
              </TouchableOpacity>
            </View>
            {couponError ? <Text style={styles.couponErrorText}>{couponError}</Text> : null}
            <TouchableOpacity onPress={() => { setCouponOpen(false); setCouponError(''); }} style={{ marginTop: SPACING.xs }}>
              <Text style={{ fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary }}>İptal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.couponBtn} onPress={() => setCouponOpen(true)} activeOpacity={0.8}>
            <Tag size={16} color={COLORS.text.secondary} />
            <Text style={styles.couponBtnText}>Kupon Kodu Ekle</Text>
            <CaretRight size={14} color={COLORS.text.tertiary} />
          </TouchableOpacity>
        )}

        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Sipariş Özeti</Text>

          {hasTotalMacros ? (() => {
            const macroTotal = totalMacros.protein + totalMacros.carbs + totalMacros.fats;
            const proteinRatio = macroTotal > 0 ? totalMacros.protein / macroTotal : 0;
            const carbsRatio = macroTotal > 0 ? totalMacros.carbs / macroTotal : 0;
            const fatsRatio = macroTotal > 0 ? totalMacros.fats / macroTotal : 0;
            const fmtG = (v: number) => v % 1 === 0 ? `${v}g` : `${v.toFixed(1)}g`;
            return (
              <View style={styles.macroBlock}>
                <Text style={styles.macroBlockTitle}>Sepet Besin Değerleri</Text>

                {/* Calorie headline */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
                  <Flame size={22} color="#111111" weight="fill" />
                  <Text style={styles.macroKcalHeadline}>{Math.round(totalMacros.kcal).toLocaleString('tr-TR')} kcal</Text>
                </View>

                {/* Stacked bar */}
                <View style={styles.macroBar}>
                  {proteinRatio > 0 && (
                    <View style={[styles.macroBarSegment, { flex: proteinRatio, backgroundColor: MACRO_COLORS.protein.main, borderTopLeftRadius: 99, borderBottomLeftRadius: 99, borderTopRightRadius: carbsRatio === 0 && fatsRatio === 0 ? 99 : 0, borderBottomRightRadius: carbsRatio === 0 && fatsRatio === 0 ? 99 : 0 }]} />
                  )}
                  {carbsRatio > 0 && (
                    <View style={[styles.macroBarSegment, { flex: carbsRatio, backgroundColor: MACRO_COLORS.carbs.main, borderTopLeftRadius: proteinRatio === 0 ? 99 : 0, borderBottomLeftRadius: proteinRatio === 0 ? 99 : 0, borderTopRightRadius: fatsRatio === 0 ? 99 : 0, borderBottomRightRadius: fatsRatio === 0 ? 99 : 0 }]} />
                  )}
                  {fatsRatio > 0 && (
                    <View style={[styles.macroBarSegment, { flex: fatsRatio, backgroundColor: MACRO_COLORS.fat.main, borderTopRightRadius: 99, borderBottomRightRadius: 99, borderTopLeftRadius: proteinRatio === 0 && carbsRatio === 0 ? 99 : 0, borderBottomLeftRadius: proteinRatio === 0 && carbsRatio === 0 ? 99 : 0 }]} />
                  )}
                </View>

                {/* Legend */}
                <View style={styles.macroLegend}>
                  <View style={styles.macroLegendItem}>
                    <View style={[styles.macroLegendDot, { backgroundColor: MACRO_COLORS.protein.main }]} />
                    <View>
                      <Text style={styles.macroLegendValue}>{fmtG(totalMacros.protein)}</Text>
                      <Text style={styles.macroLegendLabel}>Protein</Text>
                    </View>
                  </View>
                  <View style={styles.macroLegendItem}>
                    <View style={[styles.macroLegendDot, { backgroundColor: MACRO_COLORS.carbs.main }]} />
                    <View>
                      <Text style={styles.macroLegendValue}>{fmtG(totalMacros.carbs)}</Text>
                      <Text style={styles.macroLegendLabel}>Karb</Text>
                    </View>
                  </View>
                  <View style={styles.macroLegendItem}>
                    <View style={[styles.macroLegendDot, { backgroundColor: MACRO_COLORS.fat.main }]} />
                    <View>
                      <Text style={styles.macroLegendValue}>{fmtG(totalMacros.fats)}</Text>
                      <Text style={styles.macroLegendLabel}>Yağ</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })() : null}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ara Toplam</Text>
            <Text style={styles.summaryValue}>₺{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Teslimat</Text>
            <Text style={[styles.summaryValue, isFreeDelivery && styles.summaryFreeText]}>
              {isFreeDelivery ? 'Ücretsiz' : `₺${DELIVERY_FEE.toFixed(2)}`}
            </Text>
          </View>
          {couponDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Kupon ({couponCode})</Text>
              <Text style={[styles.summaryValue, { color: '#16A34A' }]}>-₺{couponDiscount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Toplam</Text>
            <Text style={styles.summaryTotalValue}>₺{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Checkout button - scroll içinde, tab barın üstünde görünür */}
        <Animated.View style={{ transform: [{ scale: checkoutScale }] }}>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => { haptic.success(); navigation.navigate('Checkout'); }}
            onPressIn={checkoutPressIn}
            onPressOut={checkoutPressOut}
            activeOpacity={1}
          >
          <View style={styles.checkoutPriceTag}>
            <Text style={styles.checkoutPriceText}>₺{total.toFixed(2)}</Text>
          </View>
          <Text style={styles.checkoutText}>Siparişe Devam</Text>
          <CaretRight size={20} color={COLORS.brand.green} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <DeliveryInfoModal visible={deliveryModal.visible} onClose={deliveryModal.close} />
      <Toast {...toast} onHide={hideToast} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: COLORS.text.primary, fontSize: 26, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold'},
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  deliveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  deliveryBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING['3xl'],
  },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.lg },
  emptyTitle: { fontSize: TYPOGRAPHY.size['2xl'], fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, marginBottom: SPACING.sm },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.size.md,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING['2xl'],
  },
  browseButton: {
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 28,
    paddingVertical: SPACING.md,
  },
  browseButtonText: { color: COLORS.text.primary, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', fontSize: TYPOGRAPHY.size.md },

  scrollContent: { padding: SPACING.lg, gap: SPACING.md },

  // Shipping banner
  shippingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  shippingBannerFree: {
    backgroundColor: COLORS.brand.green,
  },
  shippingBannerPending: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
  },
  shippingText: { flex: 1, color: COLORS.text.primary, fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium'},
  shippingTextFree: { fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  shippingHighlight: { fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },

  // Progress bar
  progressBar: {
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: '#e0e0e0',
    marginTop: -4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
  },

  // Item card
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  macroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  macroPill: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  macroPillText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold'},
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemImageLetter: {
    fontSize: TYPOGRAPHY.size['4xl'],
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.tertiary,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemName: { color: COLORS.text.primary, fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 18 },
  itemOptions: { color: COLORS.text.secondary, fontSize: TYPOGRAPHY.size.xs, lineHeight: 15 },
  itemPrice: { color: COLORS.text.primary, fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', marginTop: SPACING.xs },
  itemActions: {
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 0,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnAdd: {
    backgroundColor: COLORS.brand.green,
  },
  qtyText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    minWidth: 20,
    textAlign: 'center',
  },

  // Coupon button
  couponBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
  },
  couponBtnText: { flex: 1, fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.text.secondary },
  couponApplied: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdf4', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: '#86efac',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.sm,
  },
  couponAppliedIcon: { width: 30, height: 30, borderRadius: RADIUS.xs, backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center' },
  couponAppliedCode: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
  couponAppliedDesc: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, marginTop: 1 },
  couponRemoveBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.xs, backgroundColor: '#fee2e2' },
  couponRemoveText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#dc2626' },
  couponInputCard: { backgroundColor: '#f9f9f9', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.sm },
  couponInputRow: { flexDirection: 'row', gap: SPACING.sm },
  couponInput: { flex: 1, height: 44, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border.strong, backgroundColor: COLORS.white, paddingHorizontal: SPACING.md, fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },
  couponApplyBtn: { height: 44, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand.green, paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  couponApplyBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  couponErrorText: { fontSize: TYPOGRAPHY.size.sm, color: '#dc2626' },

  // Order summary
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  summaryTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, marginBottom: SPACING.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: TYPOGRAPHY.size.md, color: COLORS.text.secondary },
  summaryValue: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },
  summaryFreeText: { color: '#16A34A' },
  summaryDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: SPACING.xs },
  summaryTotalLabel: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  summaryTotalValue: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },

  // Macro summary block
  macroBlock: {
    backgroundColor: '#f8fef0',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(198,240,79,0.4)',
    gap: SPACING.sm,
  },
  macroBlockTitle: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#5a7a00', textTransform: 'uppercase', letterSpacing: 0.5 },
  macroKcalHeadline: { fontSize: TYPOGRAPHY.size['3xl'], fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
  macroBar: { flexDirection: 'row', height: 9, borderRadius: 99, overflow: 'hidden' },
  macroBarSegment: { height: '100%' },
  macroLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLegendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  macroLegendDot: { width: 8, height: 8, borderRadius: 4 },
  macroLegendValue: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  macroLegendLabel: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.text.secondary, marginTop: 1 },

  checkoutBtn: {
    backgroundColor: '#000000',
    borderRadius: RADIUS.md,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  checkoutPriceTag: {
    backgroundColor: 'rgba(194,235,73,0.15)',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  checkoutPriceText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.brand.green,
  },
  checkoutText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.brand.green,
    flex: 1,
    textAlign: 'center',
  },
});
