import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KeyboardAccessory from '../components/KeyboardAccessory';
import { Animated, ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {ArrowCounterClockwise, CaretRight, Minus, Plus, ShoppingCart, Tag, Trash, Flame, Truck as TruckIcon} from 'phosphor-react-native';
import { MACRO_COLORS, hexToRgba } from '../constants/colors';
import ScreenContainer from '../components/ScreenContainer';
import AnimatedNumberText from '../components/AnimatedNumberText';
import MacroRing from '../components/MacroRing';
import { CachedImage } from '../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import { haptic } from '../utils/haptics';
import { useAnimatedPress } from '../utils/useAnimatedPress';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import DeliveryInfoModal from '../components/modals/DeliveryInfoModal';
import { useModal } from '../hooks/useModal';
import { useCartStore } from '../store/cartStore';
import { getEffectivePrice, hasDiscount } from '../utils/price';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  SUGGESTION_BADGES,
  buildCartSuggestions,
  fetchOrderedProductIds,
  fetchSuggestionPool,
} from '../lib/cartSuggestions';
import { fetchPastOrders, reorderToCart, type PastOrder } from '../lib/reorder';
import { animateListChange } from '../utils/layoutAnimation';
import { validateCoupon, getCouponErrorMessage } from '../lib/offers';
import {
  fetchMacroProfile,
  isPrivileged,
  calculateMacroDiscount,
  MACRO_MEMBER_DISCOUNT_PERCENT,
  MacroProfile,
} from '../lib/macros';
import { addMacros, computeLineMacros, formatMacroGrams, formatMacroKcal, ItemMacros } from '../lib/itemMacros';
import type { Product } from '../types';
import { track } from '../lib/analytics';

type CartNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function CartScreen() {
  // Benzersiz aksesuar ID'si — Android'de inputAccessoryViewID yok sayılır, KeyboardAccessory null döner.
  const accId = useMemo(() => `acc_${Math.random().toString(36).slice(2, 11)}`, []);
  const navigation = useNavigation<CartNavProp>();
  const insets = useSafeAreaInsets();
  const deliveryModal = useModal();
  const { user } = useAuth();
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem = useCartStore(s => s.removeItem);
  const addItem = useCartStore(s => s.addItem);
  const getSubtotal = useCartStore(s => s.getSubtotal);
  const getTotalMacros = useCartStore(s => s.getTotalMacros);
  const appliedCoupon = useCartStore(s => s.appliedCoupon);
  const setCoupon = useCartStore(s => s.setCoupon);
  const clearCoupon = useCartStore(s => s.clearCoupon);
  const getDiscountAmount = useCartStore(s => s.getDiscountAmount);
  const refreshPrices = useCartStore(s => s.refreshPrices);
  const refreshMacros = useCartStore(s => s.refreshMacros);
  // Öneri havuzu (is_crosssell + tüm içecekler) ve kullanıcının geçmişte
  // sipariş ettiği ürünler — ikisi birlikte "sepetinde ne yoksa onu öner"
  // kuralını besliyor (bkz. src/lib/cartSuggestions.ts).
  const [suggestionPool, setSuggestionPool] = useState<Product[]>([]);
  const [orderedProductIds, setOrderedProductIds] = useState<Set<string>>(new Set());
  // Bos sepet: "gecmis siparislerin" + tek dokunusla tekrarla (21.09.2026).
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [macroProfile, setMacroProfile] = useState<MacroProfile | null>(null);
  const [priceUpdated, setPriceUpdated] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // getState() ile okunuyor ki callback yeniden oluşmadan (deps: refreshPrices)
      // her fokusta güncel sepet uzunluğu loglansın.
      track('cart_view', { item_count: useCartStore.getState().items.length });
      let active = true;
      (async () => {
        const res = await refreshPrices();
        if (active && res.changed) setPriceUpdated(true);
        // Makro da fiyat gibi sepete girişte tazelenir — "fotoğraflanmış"
        // eski değerler DB'de düzeltilmişse ekranda güncel görünsün.
        refreshMacros();
      })();
      return () => { active = false; };
    }, [refreshPrices, refreshMacros])
  );

  useEffect(() => {
    fetchSuggestionPool().then(setSuggestionPool).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setOrderedProductIds(new Set()); return; }
    let mounted = true;
    fetchOrderedProductIds(user.id)
      .then((ids) => { if (mounted) setOrderedProductIds(ids); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) { setMacroProfile(null); return; }
    let mounted = true;
    fetchMacroProfile(user.id).then(p => { if (mounted) setMacroProfile(p); }).catch(() => {});
    return () => { mounted = false; };
  }, [user?.id]);

  // Gecmis siparisler yalnizca sepet BOSKEN ve oturum acikken cekilir —
  // dolu sepette gorunmedigi icin bos yere sorgu atilmaz.
  const cartIsEmpty = items.length === 0;
  useEffect(() => {
    if (!cartIsEmpty || !user?.id) { setPastOrders([]); return; }
    let mounted = true;
    setPastLoading(true);
    fetchPastOrders(user.id, 3)
      .then((orders) => { if (mounted) setPastOrders(orders); })
      .catch(() => { if (mounted) setPastOrders([]); })
      .finally(() => { if (mounted) setPastLoading(false); });
    return () => { mounted = false; };
  }, [cartIsEmpty, user?.id]);

  const subtotal = getSubtotal();
  const totalMacros = getTotalMacros();
  const hasTotalMacros = totalMacros.kcal > 0 || totalMacros.protein > 0;

  const [couponInput,   setCouponInput]   = useState('');
  const [couponOpen,    setCouponOpen]    = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError,   setCouponError]   = useState('');
  const couponSlideY   = useRef(new Animated.Value(-20)).current
  const couponOpacity  = useRef(new Animated.Value(0)).current
  const { toast, show: showToast, hide: hideToast } = useToast()

  const handleReorder = useCallback(async (order: PastOrder) => {
    setReorderingId(order.id);
    try {
      const res = await reorderToCart(order, addItem);
      haptic.success();
      if (res.added === 0) {
        showToast('Bu siparişteki ürünler şu an satışta değil.', 'error');
        return;
      }
      if (res.unavailable.length > 0) {
        showToast(`${res.unavailable.length} ürün satışta olmadığı için eklenemedi.`, 'info');
      } else {
        showToast('Sipariş sepete eklendi.', 'success');
      }
      track('reorder_from_empty_cart', { order_id: order.id, added: res.added });
    } catch {
      haptic.error();
      showToast('Sipariş tekrarlanamadı, tekrar dene.', 'error');
    } finally {
      setReorderingId(null);
    }
  }, [addItem, showToast]);
  const { animatedScale: checkoutScale, onPressIn: checkoutPressIn, onPressOut: checkoutPressOut } = useAnimatedPress(0.97)



  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponError('Kupon kodu girin.'); return; }
    setCouponLoading(true); setCouponError('');
    const result = await validateCoupon(code, subtotal);
    setCouponLoading(false);
    if (!result.valid) {
      setCouponError(getCouponErrorMessage(result));
      return;
    }
    haptic.success();
    setCoupon({
      code: result.code,
      campaignId: String(result.campaign_id),
      discountType: result.discount_type,
      discountValue: Number(result.discount_value),
      discountAmount: Number(result.discount_amount),
      title: result.title,
    });
    setCouponOpen(false);
    setCouponError('');
    showToast(`${result.code} kuponu uygulandı!`, 'success');
  };

  const removeCoupon = () => { clearCoupon(); setCouponInput(''); };

  // Yüzde kuponda discount_amount apply anındaki subtotal'a göre sabitlenmişti —
  // sepet sonradan değişirse (ürün eklendi/çıkarıldı) bayat kalırdı. Sabit
  // tutarlı kuponda sorun yok (Math.min ile zaten subtotal'ı aşmıyor), ama
  // yüzdelik indirim yeni subtotal'a göre yeniden hesaplanmalı — bunun için
  // validate_coupon'ı yeniden çağırıyoruz (max_discount/min_cart/limit gibi
  // sunucu kurallarını da güncel tutar). 400ms debounce ile art arda
  // miktar +/- tıklamalarında spam RPC çağrısı yapmıyoruz.
  useEffect(() => {
    if (!appliedCoupon || appliedCoupon.discountType !== 'percent') return;
    const code = appliedCoupon.code;
    let active = true;
    const t = setTimeout(async () => {
      const result = await validateCoupon(code, subtotal);
      if (!active) return;
      if (result.valid) {
        setCoupon({
          code: result.code,
          campaignId: String(result.campaign_id),
          discountType: result.discount_type,
          discountValue: Number(result.discount_value),
          discountAmount: Number(result.discount_amount),
          title: result.title,
        });
      } else {
        // Sepet değişimi kuponu artık geçersiz kıldı (ör. min. sepet altına
        // düştü, süresi doldu, limit doldu) — sessizce eski/bayat tutarla
        // bırakmak yerine kaldır + bilgilendir.
        clearCoupon();
        showToast(getCouponErrorMessage(result), 'error');
      }
    }, 400);
    return () => { active = false; clearTimeout(t); };
    // appliedCoupon'ın kendisini deps'e almıyoruz: bu efektin setCoupon
    // çağrısı appliedCoupon referansını değiştirir ve kod/tip aynı kaldığı
    // sürece tekrar tetiklenmesini İSTEMİYORUZ (sonsuz döngü riski).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, appliedCoupon?.code, appliedCoupon?.discountType]);

  useEffect(() => {
    if (appliedCoupon) {
      Animated.parallel([
        Animated.spring(couponSlideY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.timing(couponOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
    } else {
      couponSlideY.setValue(-20)
      couponOpacity.setValue(0)
    }
  }, [appliedCoupon])

  const couponDiscount = getDiscountAmount(subtotal);

  const isMacroMember = isPrivileged(macroProfile);
  const macroDiscount = calculateMacroDiscount(subtotal, isMacroMember);
  const total = Math.max(0, subtotal - couponDiscount - macroDiscount);

  const handleContinue = async () => {
    const res = await refreshPrices();
    if (res.changed) { setPriceUpdated(true); return; } // müşteri yeni tutarı görsün, tekrar bassın
    await refreshMacros();
    navigation.navigate('Checkout');
  };

  if (cartIsEmpty) {
    const hasPast = pastOrders.length > 0;
    return (
      <ScreenContainer edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sepetim</Text>
          <TouchableOpacity style={styles.deliveryBtn} onPress={deliveryModal.open} activeOpacity={0.8}>
            <TruckIcon size={15} color="#000000" />
            <Text style={styles.deliveryBtnText}>Teslimat Nasıl Olur?</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.emptyScroll, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <ShoppingCart size={56} color={COLORS.brand.green} weight="bold" />
            </View>
            <Text style={styles.emptyTitle}>Sepetin boş</Text>
            <Text style={styles.emptySubtitle}>
              {hasPast ? 'Geçen siparişini tek dokunuşla tekrarlayabilirsin.' : 'Hadi sağlıklı bir öğün ekle!'}
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => navigation.navigate('Categories')}
              activeOpacity={0.85}
            >
              <Text style={styles.browseButtonText}>Menüye Göz At</Text>
            </TouchableOpacity>
          </View>

          {pastLoading ? (
            <View style={styles.pastLoading}>
              <ActivityIndicator color={COLORS.brand.green} />
            </View>
          ) : hasPast ? (
            <View style={styles.pastSection}>
              <View style={styles.pastHeaderRow}>
                <Text style={styles.pastHeaderTitle}>Geçmiş Siparişlerin</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ProfileOrders')} activeOpacity={0.7}>
                  <Text style={styles.pastHeaderLink}>Tümü</Text>
                </TouchableOpacity>
              </View>

              {pastOrders.map((order) => {
                const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);
                const summary = order.items
                  .map((it) => (it.quantity > 1 ? `${it.quantity}× ${it.name}` : it.name))
                  .join(', ');
                const dateLabel = new Date(order.createdAt).toLocaleDateString('tr-TR', {
                  day: 'numeric', month: 'long',
                });
                const busy = reorderingId === order.id;
                // En fazla 3 gorsel yan yana; kalanlar "+N" ile ozetlenir —
                // 4+ urunlu siparislerde satir tasmasin.
                const thumbs = order.items.slice(0, 3);
                const extraCount = order.items.length - thumbs.length;
                return (
                  <View key={order.id} style={styles.pastCard}>
                    <View style={styles.pastCardTop}>
                      <Text style={styles.pastCardDate}>{dateLabel}</Text>
                      <Text style={styles.pastCardTotal}>₺{order.totalAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.pastCardBody}>
                      <View style={styles.pastThumbs}>
                        {thumbs.map((it, i) => (
                          <View key={`${order.id}_${it.id}_${i}`} style={styles.pastThumbWrap}>
                            {it.imageUrl ? (
                              <Image source={{ uri: it.imageUrl }} style={styles.pastThumb} resizeMode="cover" />
                            ) : (
                              <View style={[styles.pastThumb, styles.pastThumbEmpty]}>
                                <ShoppingCart size={18} color={COLORS.text.tertiary} />
                              </View>
                            )}
                            {it.quantity > 1 ? (
                              <View style={styles.pastThumbQty}>
                                <Text style={styles.pastThumbQtyText}>{it.quantity}</Text>
                              </View>
                            ) : null}
                          </View>
                        ))}
                        {extraCount > 0 ? (
                          <View style={[styles.pastThumb, styles.pastThumbMore]}>
                            <Text style={styles.pastThumbMoreText}>+{extraCount}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.pastCardItems} numberOfLines={3}>{summary}</Text>
                    </View>
                    <View style={styles.pastCardBottom}>
                      <Text style={styles.pastCardMeta}>
                        {itemCount} ürün{order.orderCode ? ` • ${order.orderCode}` : ''}
                      </Text>
                      <TouchableOpacity
                        style={[styles.reorderBtn, busy && styles.reorderBtnBusy]}
                        onPress={() => handleReorder(order)}
                        disabled={busy}
                        activeOpacity={0.85}
                      >
                        {busy
                          ? <ActivityIndicator size="small" color="#000000" />
                          : (
                            <>
                              <ArrowCounterClockwise size={15} color="#000000" weight="bold" />
                              <Text style={styles.reorderBtnText}>Siparişi Tekrarla</Text>
                            </>
                          )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>

        <Toast {...toast} onHide={hideToast} />
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
          <TruckIcon size={15} color="#000000" />
          <Text style={styles.deliveryBtnText}>Teslimat Nasıl Olur?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Items */}
        {items.filter((it) => !it.parentLineKey).map((item) => {
          // FIX 5 grup: bu parent'a bağlı ekstra (child) kalemler. Top-level
          // listeden filtrelendi; burada parent altında indent gösterilir.
          const childItems = items.filter((c) => c.parentLineKey === item.lineKey);
          const extrasPrice = childItems.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

          // Parent satırı base + ekstraların TOPLAMINI gösterir (sepet
          // geneli zaten ayrı kalemlerden doğru toplanır; bu sadece görsel).
          const displayTotal = item.unitPrice * item.quantity + extrasPrice;
          const displayOriginal = (item.originalUnitPrice ?? item.unitPrice) * item.quantity + extrasPrice;

          // Tek paylaşılan makro kaynağı: item zaten birim başı nihai değeri
          // taşıyor (bkz. cartStore.addItem/refreshMacros), burada sadece
          // adetle çarpılıp ekstraların toplamıyla birleştiriliyor.
          const parentMacros = computeLineMacros({
            product: item,
            quantity: item.quantity,
            bundleSelections: item.bundle_selections,
          });
          const childMacros = childItems.reduce<ItemMacros>(
            (acc, c) => addMacros(acc, computeLineMacros({ product: c, quantity: c.quantity })),
            { kcal: null, protein: null, carbs: null, fat: null },
          );
          const itemMacros = addMacros(parentMacros, childMacros);

          return (
            <View key={item.lineKey} style={styles.itemCard}>
              {/* Main row */}
              <View style={styles.itemRow}>
                <TouchableOpacity
                  style={styles.itemTapZone}
                  activeOpacity={0.7}
                  onPress={() => {
                    haptic.selection();
                    navigation.navigate('ProductDetail', { productId: item.productId });
                  }}
                >
                <View style={styles.itemImage}>
                  {item.img ? (
                    <CachedImage uri={transformImageUrl(item.img, ImagePreset.productCard) ?? item.img} style={{ width: 76, height: 76, borderRadius: RADIUS.sm }} />
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
                  {item.selected_options && item.selected_options.length > 0 ? (
                    <View style={styles.itemTemplateOptions}>
                      {Object.values(
                        item.selected_options.reduce<
                          Record<number, { name: string; values: typeof item.selected_options }>
                        >((acc, opt) => {
                          const key = opt.template_id;
                          if (!acc[key]) acc[key] = { name: opt.template_name, values: [] };
                          acc[key].values.push(opt);
                          return acc;
                        }, {}),
                      ).map((group, idx) => (
                        <Text key={`${group.name}-${idx}`} style={styles.itemTemplateOption} numberOfLines={2}>
                          {group.name}: {group.values
                            .map((v) =>
                              `${v.value_name}${v.price_modifier !== 0 ? ` (${v.price_modifier > 0 ? '+' : ''}₺${Number(v.price_modifier).toFixed(0)})` : ''}`,
                            )
                            .join(', ')}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {item.originalUnitPrice && item.originalUnitPrice > item.unitPrice ? (
                    <View style={styles.itemPriceRow}>
                      <AnimatedNumberText style={styles.itemPriceDiscounted} value={`₺${displayTotal.toFixed(2)}`} />
                      <Text style={styles.itemPriceStrike}>₺{displayOriginal.toFixed(2)}</Text>
                      {item.discountType ? (
                        <Text style={styles.itemPriceBadge}>
                          {item.discountType === 'percent' ? `-%${item.discountValue}` : `-₺${item.discountValue}`}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <AnimatedNumberText style={styles.itemPrice} value={`₺${displayTotal.toFixed(2)}`} />
                  )}
                </View>
                </TouchableOpacity>

                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => { haptic.medium(); animateListChange(); removeItem(item.lineKey); }}
                  >
                    <Trash size={13} color="#FF3B30" />
                  </TouchableOpacity>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => { haptic.medium(); animateListChange(); updateQuantity(item.lineKey, item.quantity - 1); }}
                    >
                      <Minus size={13} color={COLORS.text.primary} />
                    </TouchableOpacity>
                    <AnimatedNumberText style={styles.qtyText} value={item.quantity} />
                    <TouchableOpacity
                      style={[styles.qtyBtn, styles.qtyBtnAdd]}
                      onPress={() => { haptic.light(); animateListChange(); updateQuantity(item.lineKey, item.quantity + 1); }}
                    >
                      <Plus size={13} color="#000000" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Macro pills — 4 değer her zaman gösterilir, veri yoksa "—"
                  (gizlenmez, bkz. src/lib/itemMacros) */}
              <View style={styles.macroPills}>
                <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.calories.track }]}>
                  <Text style={[styles.macroPillText, { color: MACRO_COLORS.calories.main }]}>
                    {formatMacroKcal(itemMacros.kcal)} kcal
                  </Text>
                </View>
                <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.protein.track }]}>
                  <Text style={[styles.macroPillText, { color: MACRO_COLORS.protein.main }]}>
                    {formatMacroGrams(itemMacros.protein)} P
                  </Text>
                </View>
                <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.carbs.track }]}>
                  <Text style={[styles.macroPillText, { color: MACRO_COLORS.carbs.main }]}>
                    {formatMacroGrams(itemMacros.carbs)} K
                  </Text>
                </View>
                <View style={[styles.macroPill, { backgroundColor: MACRO_COLORS.fat.track }]}>
                  <Text style={[styles.macroPillText, { color: MACRO_COLORS.fat.main }]}>
                    {formatMacroGrams(itemMacros.fat)} Y
                  </Text>
                </View>
              </View>

              {/* Bundle slot kırılımı — ana satırın altında indent edilmiş
                  alt satırlar; fiyat yok ("Dahil"), her öğünün makrosu küçük */}
              {item.bundle_selections && item.bundle_selections.length > 0 ? (
                <View style={styles.bundleChildrenWrap}>
                  {item.bundle_selections.map((sel, idx) => (
                    <View
                      key={`${item.lineKey}-bsel-${idx}`}
                      style={[
                        styles.bundleChildRow,
                        idx < item.bundle_selections!.length - 1 && styles.bundleChildRowDivider,
                      ]}
                    >
                      <View style={styles.bundleChildInfo}>
                        {sel.slot_name ? (
                          <Text style={styles.bundleSlotName} numberOfLines={1}>
                            {sel.slot_name}
                          </Text>
                        ) : null}
                        <Text style={styles.bundleChildName} numberOfLines={2}>
                          {sel.name}
                        </Text>
                        <View style={styles.bundleChildMacros}>
                          <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.calories.main }]}>
                            {formatMacroKcal(sel.calories || null)} kcal
                          </Text>
                          <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.protein.main }]}>
                            {formatMacroGrams(sel.protein || null)} P
                          </Text>
                          <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.carbs.main }]}>
                            {formatMacroGrams(sel.carbs || null)} K
                          </Text>
                          <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.fat.main }]}>
                            {formatMacroGrams(sel.fat || null)} Y
                          </Text>
                        </View>
                      </View>
                      <View style={styles.bundleDahilBadge}>
                        <Text style={styles.bundleDahilText}>Dahil</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* FIX 5 grup: tekli ürün ekstraları parent altında indent —
                  bundle child UI pattern reuse (aynı stiller). Fiyat görünür
                  (+₺X Dahil). Stepper/silme yok; parent silinince cascade. */}
              {childItems.length > 0 ? (
                <View style={styles.bundleChildrenWrap}>
                  {childItems.map((c, idx) => {
                    const cMacros = computeLineMacros({ product: c, quantity: c.quantity });
                    const slot = c.selectedOptions.labels[0];
                    return (
                      <View
                        key={c.lineKey}
                        style={[
                          styles.bundleChildRow,
                          idx < childItems.length - 1 && styles.bundleChildRowDivider,
                        ]}
                      >
                        <View style={styles.bundleChildInfo}>
                          {slot ? (
                            <Text style={styles.bundleSlotName} numberOfLines={1}>
                              {slot}
                            </Text>
                          ) : null}
                          <Text style={styles.bundleChildName} numberOfLines={2}>
                            {c.name}
                          </Text>
                          <View style={styles.bundleChildMacros}>
                            <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.calories.main }]}>
                              {formatMacroKcal(cMacros.kcal)} kcal
                            </Text>
                            <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.protein.main }]}>
                              {formatMacroGrams(cMacros.protein)} P
                            </Text>
                            <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.carbs.main }]}>
                              {formatMacroGrams(cMacros.carbs)} K
                            </Text>
                            <Text style={[styles.bundleChildMacro, { color: MACRO_COLORS.fat.main }]}>
                              {formatMacroGrams(cMacros.fat)} Y
                            </Text>
                          </View>
                        </View>
                        <View style={styles.bundleDahilBadge}>
                          <Text style={styles.bundleDahilText}>
                            +₺{(c.unitPrice * c.quantity).toFixed(0)} · Dahil
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Cross-sell: Bunlar da ilgini çekebilir */}
        {(() => {
          const suggestions = buildCartSuggestions({
            cartItems: items,
            pool: suggestionPool,
            orderedProductIds,
            limit: 10,
          });
          if (suggestions.length === 0) return null;
          return (
            <View style={styles.crosssellSection}>
              <Text style={styles.crosssellTitle}>Bunlar da ilgini çekebilir</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.crosssellScroll}
              >
                {suggestions.map(({ product, reason }) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.crosssellCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      haptic.selection();
                      navigation.navigate('ProductDetail', { productId: String(product.id) });
                    }}
                  >
                    <View style={styles.crosssellBadge}>
                      <Text style={styles.crosssellBadgeText}>{SUGGESTION_BADGES[reason]}</Text>
                    </View>
                    <View style={styles.crosssellImageWrap}>
                      {product.img ? (
                        <CachedImage
                          uri={transformImageUrl(product.img, ImagePreset.productCard) ?? product.img}
                          style={{ width: '100%', height: '100%', borderRadius: RADIUS.sm }}
                        />
                      ) : (
                        <Text style={styles.crosssellImageLetter}>
                          {String(product.name || 'U').slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.crosssellName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <View style={styles.crosssellBottomRow}>
                      {hasDiscount(product) ? (
                        <View style={styles.crosssellPriceCol}>
                          <Text style={styles.crosssellPriceStrike}>₺{Number(product.price).toFixed(2)}</Text>
                          <Text style={styles.crosssellPriceDiscounted}>₺{getEffectivePrice(product).toFixed(2)}</Text>
                        </View>
                      ) : (
                        <Text style={styles.crosssellPrice}>₺{product.price.toFixed(2)}</Text>
                      )}
                      <TouchableOpacity
                        style={styles.crosssellPlusBtn}
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation();
                          haptic.medium();
                          // Yeni satir listede yerini acarak gelsin; ayrica
                          // eklenen urun onerilerden dustugu icin o serit de
                          // kayarak kapansin.
                          animateListChange();
                          addItem(product, {}, 1);
                        }}
                      >
                        <Plus size={14} color="#000000" weight="bold" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        })()}

        {/* Coupon */}
        {appliedCoupon ? (
          <Animated.View style={[styles.couponApplied, { opacity: couponOpacity, transform: [{ translateY: couponSlideY }] }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}>
              <View style={styles.couponAppliedIcon}><Tag size={14} color="#000" /></View>
              <View>
                <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
                <Text style={styles.couponAppliedDesc}>{appliedCoupon.title}</Text>
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
                inputAccessoryViewID={accId}
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
            const ratio = (v: number) => (macroTotal > 0 ? v / macroTotal : 0);
            const fmtG = (v: number) => (v % 1 === 0 ? `${v}g` : `${v.toFixed(1)}g`);
            return (
              <View style={styles.macroBlock}>
                <View style={styles.macroHeadRow}>
                  <View style={styles.macroKcalGroup}>
                    <Flame size={20} color={COLORS.text.primary} weight="fill" />
                    <Text style={styles.macroKcalHeadline}>
                      {Math.round(totalMacros.kcal).toLocaleString('tr-TR')}
                    </Text>
                    <Text style={styles.macroKcalUnit}>kcal</Text>
                  </View>
                  <Text style={styles.macroBlockTitle}>Sepet besin değerleri</Text>
                </View>

                <View style={styles.macroRingRow}>
                  <MacroRing
                    ratio={ratio(totalMacros.protein)}
                    color={MACRO_COLORS.protein.main}
                    trackColor={MACRO_COLORS.protein.track}
                    value={fmtG(totalMacros.protein)}
                    label="Protein"
                  />
                  <MacroRing
                    ratio={ratio(totalMacros.carbs)}
                    color={MACRO_COLORS.carbs.main}
                    trackColor={MACRO_COLORS.carbs.track}
                    value={fmtG(totalMacros.carbs)}
                    label="Karb"
                  />
                  <MacroRing
                    ratio={ratio(totalMacros.fats)}
                    color={MACRO_COLORS.fat.main}
                    trackColor={MACRO_COLORS.fat.track}
                    value={fmtG(totalMacros.fats)}
                    label="Yağ"
                  />
                </View>
              </View>
            );
          })() : null}

          {priceUpdated && (
            <View style={styles.priceUpdateBanner}>
              <Text style={styles.priceUpdateText}>Bazı ürünlerin fiyatı güncellendi. Güncel tutar aşağıda.</Text>
              <TouchableOpacity onPress={() => setPriceUpdated(false)}>
                <Text style={styles.priceUpdateDismiss}>Tamam</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ara Toplam</Text>
            <AnimatedNumberText style={styles.summaryValue} value={`₺${subtotal.toFixed(2)}`} />
          </View>
          {couponDiscount > 0 && appliedCoupon && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Kupon ({appliedCoupon.code})</Text>
              <AnimatedNumberText style={[styles.summaryValue, { color: '#16A34A' }]} value={`-₺${couponDiscount.toFixed(2)}`} />
            </View>
          )}
          {macroDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{`Macro Üye İndirimi (%${MACRO_MEMBER_DISCOUNT_PERCENT})`}</Text>
              <AnimatedNumberText style={[styles.summaryValue, { color: '#16A34A' }]} value={`-₺${macroDiscount.toFixed(2)}`} />
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Toplam</Text>
            <AnimatedNumberText style={styles.summaryTotalValue} value={`₺${total.toFixed(2)}`} />
          </View>
        </View>

        {/* Checkout button - scroll içinde, tab barın üstünde görünür */}
        <Animated.View style={{ transform: [{ scale: checkoutScale }] }}>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => { haptic.success(); handleContinue(); }}
            onPressIn={checkoutPressIn}
            onPressOut={checkoutPressOut}
            activeOpacity={1}
          >
          <View style={styles.checkoutPriceTag}>
            <AnimatedNumberText style={styles.checkoutPriceText} value={`₺${total.toFixed(2)}`} />
          </View>
          <Text style={styles.checkoutText}>Siparişe Devam</Text>
          <CaretRight size={20} color={COLORS.brand.green} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <DeliveryInfoModal visible={deliveryModal.visible} onClose={deliveryModal.close} />
      <Toast {...toast} onHide={hideToast} />
      <KeyboardAccessory nativeID={accId} />
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
  emptyScroll: {
    flexGrow: 1,
    paddingTop: SPACING.xl,
  },
  // Bos sepet artik kaydirilabilir (altinda gecmis siparisler var) — bu yuzden
  // flex:1 ile dikey ortalama yerine sabit dolgu kullaniyoruz.
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING['3xl'],
    paddingVertical: SPACING['2xl'],
  },
  pastLoading: { paddingVertical: SPACING.xl, alignItems: 'center' },
  pastSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  pastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastHeaderTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  pastHeaderLink: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
  },
  pastCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    gap: SPACING.sm,
  },
  pastCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastCardDate: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
  },
  pastCardTotal: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  pastCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  pastThumbs: {
    flexDirection: 'row',
    gap: 6,
  },
  pastThumbWrap: { position: 'relative' },
  pastThumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.gray[100],
  },
  pastThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  // Adet rozeti gorselin KOSESINDE durur; "2x Tavuk" metnini tekrar etmeden
  // coklu adedi gosterir.
  pastThumbQty: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: COLORS.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  pastThumbQtyText: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.white,
  },
  pastThumbMore: { alignItems: 'center', justifyContent: 'center' },
  pastThumbMoreText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.secondary,
  },
  pastCardItems: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
    lineHeight: 19,
  },
  pastCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  pastCardMeta: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 152,
    height: 38,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand.green,
  },
  reorderBtnBusy: { opacity: 0.7 },
  reorderBtnText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  emptyIconWrap: { marginBottom: SPACING.lg },
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
  itemTapZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  macroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  macroPill: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  macroPillText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold'},
  bundleChildrenWrap: {
    marginTop: SPACING.sm,
    marginLeft: SPACING.md,
    paddingLeft: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border.medium,
    backgroundColor: '#F7F7F7',
    borderRadius: RADIUS.sm,
  },
  bundleChildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  bundleChildRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  bundleChildInfo: { flex: 1, paddingRight: SPACING.sm },
  bundleSlotName: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
    marginBottom: 1,
  },
  bundleChildName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
    marginBottom: 3,
  },
  bundleChildMacros: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  bundleChildMacro: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  bundleDahilBadge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: MACRO_COLORS.protein.track,
  },
  bundleDahilText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: MACRO_COLORS.protein.main,
  },
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
  itemTemplateOptions: { marginTop: 2, gap: 1 },
  itemTemplateOption: { color: COLORS.text.secondary, fontSize: TYPOGRAPHY.size.xs, lineHeight: 16 },
  itemPrice: { color: COLORS.text.primary, fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', marginTop: SPACING.xs },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs, flexWrap: 'wrap' },
  itemPriceDiscounted: { color: '#dc2626', fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold' },
  itemPriceStrike: { color: '#9ca3af', fontSize: TYPOGRAPHY.size.xs, fontFamily: 'PlusJakartaSans_700Bold',
textDecorationLine: 'line-through' },
  itemPriceBadge: { color: '#dc2626', fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold' },
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

  // Cross-sell section
  crosssellSection: {
    marginHorizontal: -SPACING.lg,
    marginVertical: SPACING.xs,
  },
  crosssellTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.lg,
    marginBottom: 12,
  },
  crosssellScroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  crosssellCard: {
    width: 140,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    ...SHADOWS.sm,
  },
  // Oneri gerekcesi rozeti — kullanici NEDEN bu urunu gordugunu bilsin
  // ("Yanina icecek" / "Hic denemedin" / "Sepetini tamamla").
  crosssellBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: SPACING.xs,
  },
  crosssellBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  crosssellImageWrap: {
    width: '100%',
    height: 100,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  crosssellImageLetter: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.tertiary,
  },
  crosssellName: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
    lineHeight: 16,
    minHeight: 32,
    marginBottom: SPACING.xs,
  },
  crosssellBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  crosssellPrice: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  crosssellPriceCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  crosssellPriceStrike: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  crosssellPriceDiscounted: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#dc2626',
  },
  crosssellPlusBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: hexToRgba(COLORS.brand.green, 0.12), borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: hexToRgba(COLORS.brand.green, 0.35),
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.sm,
  },
  couponAppliedIcon: { width: 30, height: 30, borderRadius: RADIUS.xs, backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center' },
  couponAppliedCode: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
  couponAppliedDesc: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, marginTop: 1 },
  couponRemoveBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  couponRemoveText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary, textDecorationLine: 'underline' },
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
  // Eski hal: #f8fef0 zemin + yesil stroke'lu kart icinde yigin bar.
  // 21.09.2026: dusuk-opakliktaki yesil katman kaldirildi, makrolar halka
  // (MacroRing) olarak gosteriliyor — Siparis Ozeti karti tek duzlem.
  macroBlock: {
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    gap: SPACING.md,
  },
  // Alev ikonu + sayi tek grup icinde DIKEY ORTALI; 'baseline' kullanildiginda
  // SVG ikonun baseline'i olmadigi icin ikon sayiya gore asagi kayiyordu.
  macroHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroKcalGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroBlockTitle: {
    flex: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.tertiary,
  },
  macroKcalHeadline: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  macroKcalUnit: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
    // Optik hiza: 'kcal' buyuk sayinin tabanina yakin dursun
    alignSelf: 'flex-end',
    paddingBottom: 5,
  },
  macroRingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  priceUpdateBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: '#FEF9E7', borderWidth: 1, borderColor: '#F8C90E', borderRadius: 12, padding: 12, marginBottom: 12 },
  priceUpdateText: { flex: 1, fontSize: 13, color: '#7A5B00', fontFamily: 'PlusJakartaSans_500Medium' },
  priceUpdateDismiss: { fontSize: 13, fontWeight: '700', color: '#7A5B00', fontFamily: 'PlusJakartaSans_700Bold' },

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
