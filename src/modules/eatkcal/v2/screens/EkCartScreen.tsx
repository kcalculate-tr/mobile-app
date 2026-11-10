// eatkcal v2 (G13-S2 md.4) — Sepet: FinEkCart · FinEkCartEmpty · FinEkCartSkeleton
// + kupon sheet'i. Sepet verisi ve hesapları YALNIZ mevcut cartStore'dan
// (items, getSubtotal, getDiscountAmount, getTotalMacros, updateQuantity,
// removeItem, setCoupon/clearCoupon, refreshPrices/refreshMacros). Kupon
// yeniden doğrulama ve "Siparişe devam" adımları bugünkü
// src/modules/eatkcal/screens/CartScreen.tsx (KİMSE) ile AYNI sırada.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Basket, CaretRight, Minus, Plus, Tag, Trash } from '../../../../components/icons';
import { CachedImage } from '../../../../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../../../../lib/imageUrl';
import { EmptyErrorCard, Toast, haptic } from '../../../../core/design';
import { useAuth } from '../../../../core/AuthContext';
import { useCartStore } from '../../../../store/cartStore';
import { useAddressStore } from '../../../../store/addressStore';
import { computeLineMacros, addMacros, type ItemMacros } from '../../../../lib/itemMacros';
import { validateCoupon, getCouponErrorMessage, type CouponCartItem, type CouponValidationSuccess } from '../../../../lib/offers';
import {
  SUGGESTION_BADGES,
  buildCartSuggestions,
  fetchOrderedProductIds,
  fetchSuggestionPool,
} from '../../../../lib/cartSuggestions';
import { fetchGlobalDeliverySettings, type DeliveryGlobals } from '../../../../lib/delivery';
import { getEffectivePrice } from '../../../../utils/price';
import { track } from '../../../../lib/analytics';
import type { DeliveryRuleStatus, Product } from '../../../../types';
import { useEkNav } from '../nav';
import { EkHeader, EkScreen, EkSkeleton, EkStickyBar, EkToastLayer, ekType, money, useEk, EkKV } from '../ui/kit';
import { EkErrorCard } from '../ui/ErrorCard';
import { CouponSheet } from '../ui/CouponSheet';
import { peekPendingCoupon, setPendingCoupon, takePendingCoupon } from '../model/pendingCoupon';
import { priceError, stockError, type EkErrorModel } from '../model/errors';
import { activeZoneRowOf, computeCartTotal, computeCheckoutTotals } from '../model/checkoutModel';
import { freeShippingProgress, groupCartLines, linePrice, lineSummary } from '../model/cartModel';
import { fetchSettingsMinCart, fetchZoneRuleFor } from '../checkout/data';
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';

function useCartHydrated(): boolean {
  const [ok, setOk] = useState(() => useCartStore.persist?.hasHydrated?.() ?? true);
  useEffect(() => {
    if (ok) return;
    const unsub = useCartStore.persist?.onFinishHydration?.(() => setOk(true));
    return () => unsub?.();
  }, [ok]);
  return ok;
}

export default function EkCartScreen() {
  const navigation = useEkNav();
  const { c, t, insets } = useEk();
  const { user } = useAuth();
  const hydrated = useCartHydrated();
  // YALNIZ __DEV__ vitrini (FinEkCartSkeleton): iskelet hâlinde başlar.
  const routeParams = useRoute().params as { vitrinSkeleton?: boolean; couponCode?: string } | undefined;
  const vitrinSkeleton = __DEV__ ? routeParams?.vitrinSkeleton === true : false;

  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalMacros = useCartStore((s) => s.getTotalMacros);
  const appliedCoupon = useCartStore((s) => s.appliedCoupon);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const clearCoupon = useCartStore((s) => s.clearCoupon);
  const getDiscountAmount = useCartStore((s) => s.getDiscountAmount);
  const refreshPrices = useCartStore((s) => s.refreshPrices);
  const refreshMacros = useCartStore((s) => s.refreshMacros);
  const selectedAddress = useAddressStore((s) => s.selectedAddress);

  const [couponOpen, setCouponOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [priceErr, setPriceErr] = useState<EkErrorModel | null>(null);
  const [suggestionPool, setSuggestionPool] = useState<Product[]>([]);
  const [orderedIds, setOrderedIds] = useState<Set<string>>(new Set());
  const [ruleStatus, setRuleStatus] = useState<DeliveryRuleStatus>({ status: 'idle' });
  const [globals, setGlobals] = useState<DeliveryGlobals | null>(null);
  const [minCart, setMinCart] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const subtotal = getSubtotal();

  // ── Fiyat tazeleme (CartScreen.tsx:80-95 + :264-268) ─────────────────────
  const runPriceRefresh = useCallback(async (): Promise<boolean> => {
    const before = useCartStore.getState().getSubtotal();
    const res = await refreshPrices();
    const after = useCartStore.getState().getSubtotal();
    const err = priceError(res, before, after);
    setPriceErr(err);
    return !!err;
  }, [refreshPrices]);

  useFocusEffect(
    useCallback(() => {
      track('cart_view', { item_count: useCartStore.getState().items.length, ui: 'ek_v2' });
      let active = true;
      (async () => {
        await runPriceRefresh();
        if (active) refreshMacros();
      })();
      return () => {
        active = false;
      };
    }, [runPriceRefresh, refreshMacros]),
  );

  useEffect(() => {
    fetchSuggestionPool().then(setSuggestionPool).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user?.id) {
      setOrderedIds(new Set());
      return;
    }
    let m = true;
    fetchOrderedProductIds(user.id)
      .then((ids) => m && setOrderedIds(ids))
      .catch(() => {});
    return () => {
      m = false;
    };
  }, [user?.id]);

  // ── Teslimat (kayıtlı adres varsa; yoksa "Özette hesaplanır") ───────────
  useEffect(() => {
    let m = true;
    fetchGlobalDeliverySettings().then((g) => m && setGlobals(g));
    fetchSettingsMinCart()
      .then((v) => m && setMinCart(v))
      .catch(() => {});
    return () => {
      m = false;
    };
  }, []);
  useEffect(() => {
    if (!selectedAddress?.district) {
      setRuleStatus({ status: 'idle' });
      return;
    }
    let m = true;
    fetchZoneRuleFor(selectedAddress, 'immediate').then((r) => m && setRuleStatus(r.status));
    return () => {
      m = false;
    };
  }, [selectedAddress?.district, selectedAddress?.neighbourhood, selectedAddress]);

  // ── Kupon (CartScreen.tsx:138-246) ──────────────────────────────────────
  const couponItems = useMemo<CouponCartItem[]>(
    () =>
      items
        .map((i) => ({ product_id: Number(i.productId), quantity: i.quantity }))
        .filter((i) => Number.isFinite(i.product_id) && i.product_id > 0),
    [items],
  );

  const handleCouponApplied = (result: CouponValidationSuccess) => {
    haptic('success');
    setCoupon({
      code: result.code,
      campaignId: String(result.campaign_id),
      discountType: result.discount_type,
      discountValue: Number(result.discount_value),
      discountAmount: Number(result.discount_amount),
      title: result.title,
    });
    setToast(t('eatkcal.v2.coupon.applied_toast', { code: result.code }));
  };

  // G25-S1 md.4 (A5): Macro ödülü "Kullan" → `couponCode`. Sepet boşsa kod bekler; ürün varken bir kez
  // doğrulanıp uygulanır (başarı → mevcut "uygulandı" toast'ı, hata → kupon hata metni).
  const paramCoupon = routeParams?.couponCode;
  useEffect(() => {
    if (paramCoupon) setPendingCoupon(paramCoupon);
  }, [paramCoupon]);
  useEffect(() => {
    if (items.length === 0 || !peekPendingCoupon()) return;
    const code = takePendingCoupon() as string;
    if (appliedCoupon?.code === code) return;
    let active = true;
    void validateCoupon(code, subtotal, couponItems).then((result) => {
      if (!active) return;
      if (result.valid) handleCouponApplied(result);
      else setToast(getCouponErrorMessage(result));
    });
    return () => {
      active = false;
    };
    // Yalnız sepet doluluğu / kod değişince (subtotal her adetle değişir; kod bir kez alınır).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length > 0, paramCoupon]);

  // Yüzdelik / ücretsiz öğün kuponu sepet değişince yeniden doğrulanır
  // (CartScreen.tsx:207-247 — aynı 400 ms bekleme, aynı alanlar).
  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCoupon.discountType !== 'percent' && appliedCoupon.discountType !== 'free_item') return;
    const code = appliedCoupon.code;
    let active = true;
    const tm = setTimeout(async () => {
      const result = await validateCoupon(code, subtotal, couponItems);
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
        clearCoupon();
        setToast(getCouponErrorMessage(result));
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(tm);
    };
    // CartScreen.tsx:236-245 ile aynı bağımlılıklar (appliedCoupon nesnesi bilinçli olarak yok).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, couponItems, appliedCoupon?.code, appliedCoupon?.discountType]);

  const couponDiscount = getDiscountAmount(subtotal);

  // ── Toplamlar ───────────────────────────────────────────────────────────
  const zoneRow = activeZoneRowOf(ruleStatus);
  const deliveryKnown = ruleStatus.status === 'ok' && ruleStatus.data.isActive;
  const quote = computeCheckoutTotals({
    subtotal,
    discountAmount: appliedCoupon ? couponDiscount : 0,
    deliveryMethod: 'home_delivery',
    deliveryTimeType: 'immediate',
    zoneRow,
    globals,
    settingsMinCartAmount: minCart,
  });
  // Adres/bölge biliniyorsa özetteki tutarın aynısı; değilse eski sepet toplamı.
  const total = deliveryKnown ? quote.totalAmount : computeCartTotal(subtotal, couponDiscount);
  const progress = deliveryKnown ? freeShippingProgress(subtotal, quote.freeShippingAbove) : null;
  const totalMacros = getTotalMacros();
  const lines = groupCartLines(items);

  const handleContinue = async () => {
    // CartScreen.tsx:264-269: fiyat değiştiyse müşteri yeni tutarı görsün, tekrar bassın.
    const changed = await runPriceRefresh();
    if (changed) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    await refreshMacros();
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('EkCheckout');
  };

  const goStores = () => navigation.navigate('Tabs', { screen: 'Home' });

  // ── İskelet ─────────────────────────────────────────────────────────────
  if (!hydrated || vitrinSkeleton) {
    // G15-S5 (FinEkCartSkeleton): 3 ürün kartı (76 görsel · 2 satır · 44 hap) + özet bloğu.
    return (
      <EkScreen header={<EkHeader title={t('eatkcal.v2.cart.title')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />}>
        <View style={{ padding: 16, gap: 12 }} testID="ek-cart-skeleton">
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skCard, { backgroundColor: c.surface }]}>
              <EkSkeleton width={76} height={76} radius={14} />
              <View style={{ flex: 1, gap: 8 }}>
                <EkSkeleton height={14} radius={7} />
                <EkSkeleton height={14} radius={7} />
                <EkSkeleton height={44} radius={22} />
              </View>
            </View>
          ))}
          <EkSkeleton height={160} radius={20} />
        </View>
      </EkScreen>
    );
  }

  // ── Boş ─────────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <EkScreen header={<EkHeader title={t('eatkcal.v2.cart.title')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />}>
        <View style={{ padding: 16, paddingTop: 128 }} testID="ek-cart-empty">
          <EmptyErrorCard
            icon={<Basket size={24} color={c.ink} />}
            title={t('eatkcal.v2.cart.empty_title')}
            description={t('eatkcal.v2.cart.empty_body')}
            actionLabel={t('eatkcal.v2.cart.empty_action')}
            onAction={goStores}
          />
        </View>
      </EkScreen>
    );
  }

  const suggestions = buildCartSuggestions({ cartItems: items, pool: suggestionPool, orderedProductIds: orderedIds, limit: 10 });

  return (
    <EkScreen
      scrollRef={scrollRef}
      header={<EkHeader title={t('eatkcal.v2.cart.title')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />}
      footer={
        <>
        <EkStickyBar>
          <Pressable
            onPress={handleContinue}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: c.ink }]}
            testID="ek-cart-continue"
          >
            <Text style={[ekType.b17, ekType.num, { color: c.surface }]}>
              {t('eatkcal.v2.cart.continue', { amount: money(total) })}
            </Text>
          </Pressable>
        </EkStickyBar>
        {/* G16-S2: Toast akışta değil, alt barın üstünde yüzer (önce kaydırma içeriğinin sonunda ~69 pt yer tutuyordu). */}
        <EkToastLayer bottom={Math.max(insets.bottom, 12) + 84}>
          <Toast visible={!!toast} message={toast ?? ''} onDismiss={() => setToast(null)} autoHideMs={2400} />
        </EkToastLayer>
        </>
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }} testID="ek-cart">
        {priceErr ? <EkErrorCard error={priceErr} onAction={() => setPriceErr(null)} /> : null}

        {lines.map(({ item, children }) => {
          const macros = addMacros(
            computeLineMacros({ product: item, quantity: item.quantity, bundleSelections: item.bundle_selections }),
            children.reduce<ItemMacros>(
              (acc, ch) => addMacros(acc, computeLineMacros({ product: ch, quantity: ch.quantity })),
              { kcal: null, protein: null, carbs: null, fat: null },
            ),
          );
          const price = linePrice(item, children);
          const summary = lineSummary(item, children);
          return (
            <View key={item.lineKey} style={[styles.line, { backgroundColor: c.surface }]}>
              <Pressable
                onPress={() => navigation.navigate('EkProduct', { productId: item.productId })}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                {item.img ? (
                  <CachedImage uri={transformImageUrl(item.img, ImagePreset.productCard) ?? item.img} style={styles.img} />
                ) : (
                  <View style={[styles.img, { backgroundColor: c.line, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={[ekType.h20, { color: c.secondary }]}>{String(item.name || 'U').slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      haptic('selection');
                      removeItem(item.lineKey);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('eatkcal.v2.cart.remove')} ${item.name}`}
                    style={styles.icon44}
                    testID={`ek-cart-remove-${item.lineKey}`}
                  >
                    <Trash size={20} color={c.secondary} />
                  </Pressable>
                </View>
                {summary ? (
                  <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
                    {summary}
                  </Text>
                ) : null}
                <MacroChips m={macros} />
                <View style={styles.between}>
                  <View style={[styles.stepper, { borderColor: c.line }]}>
                    <Pressable
                      onPress={() => {
                        haptic('selection');
                        updateQuantity(item.lineKey, item.quantity - 1);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('eatkcal.v2.cart.decrease')}
                      style={styles.icon44}
                    >
                      <Minus size={18} color={c.ink} />
                    </Pressable>
                    <Text style={[ekType.b17, ekType.num, { color: c.ink, minWidth: 20, textAlign: 'center' }]}>{item.quantity}</Text>
                    <Pressable
                      onPress={() => {
                        haptic('selection');
                        updateQuantity(item.lineKey, item.quantity + 1);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('eatkcal.v2.cart.increase')}
                      style={styles.icon44}
                    >
                      <Plus size={18} color={c.ink} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    {price.was != null ? (
                      <Text style={[ekType.c13, ekType.num, { color: c.secondary, textDecorationLine: 'line-through' }]}>{money(price.was)}</Text>
                    ) : null}
                    <Text style={[ekType.b15s, ekType.num, { color: c.ink }]}>{money(price.now)}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        {suggestions.length > 0 ? (
          <>
            <Text style={[ekType.h20, { color: c.ink, marginTop: 12 }]} accessibilityRole="header">
              {t('eatkcal.v2.cart.suggestions')}
            </Text>
            <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {suggestions.map(({ product, reason }) => (
                <Pressable
                  key={product.id}
                  onPress={() => navigation.navigate('EkProduct', { productId: String(product.id) })}
                  accessibilityRole="button"
                  accessibilityLabel={`${product.name}, ${SUGGESTION_BADGES[reason]}`}
                  style={[styles.sugg, { backgroundColor: c.surface }]}
                >
                  {product.img ? (
                    <CachedImage uri={transformImageUrl(product.img, ImagePreset.productCard) ?? product.img} style={styles.suggImg} />
                  ) : (
                    <View style={[styles.suggImg, { backgroundColor: c.line }]} />
                  )}
                  <Text style={[ekType.c13s, { color: c.ink }]} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.between}>
                    <Text style={[ekType.c13s, ekType.num, { color: c.ink }]}>{money(getEffectivePrice(product))}</Text>
                    <View style={[styles.plus, { backgroundColor: c.ink }]}>
                      <Plus size={16} color={c.surface} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {appliedCoupon ? (
          <View style={[styles.couponRow, { backgroundColor: c.surface }]} testID="ek-cart-coupon-applied">
            <Tag size={20} color={c.ink} />
            <Text style={[ekType.b15s, ekType.num, { color: c.ink, flex: 1 }]} numberOfLines={1}>
              {t('eatkcal.v2.cart.coupon_applied', { code: appliedCoupon.code, amount: money(couponDiscount) })}
            </Text>
            <Pressable onPress={() => clearCoupon()} accessibilityRole="button" style={styles.textBtn}>
              <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.cart.coupon_remove')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setCouponOpen(true)}
            accessibilityRole="button"
            style={[styles.couponRow, { backgroundColor: c.surface }]}
            testID="ek-cart-coupon"
          >
            <Tag size={20} color={c.ink} />
            <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.cart.use_coupon')}</Text>
            <CaretRight size={18} color={c.secondary} />
          </Pressable>
        )}

        <View style={[styles.summary, { backgroundColor: c.surface }]}>
          <Text style={[ekType.h20, { color: c.ink }]} accessibilityRole="header">
            {t('eatkcal.v2.cart.summary')}
          </Text>
          {totalMacros.kcal > 0 || totalMacros.protein > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.cart.total')}</Text>
                <Text style={[ekType.h24, ekType.num, { color: c.ink }]}>
                  {Math.round(totalMacros.kcal)} {t('eatkcal.v2.common.kcal')}
                </Text>
              </View>
              {(
                [
                  ['protein', totalMacros.protein],
                  ['carbs', totalMacros.carbs],
                  ['fat', totalMacros.fats],
                ] as const
              ).map(([k, v]) => (
                <View key={k} style={{ alignItems: 'center', gap: 2 }}>
                  <Text style={[ekType.c13s, ekType.num, { color: c.ink }]}>{t('eatkcal.v2.common.grams', { n: Math.round(v) })}</Text>
                  <Text style={[ekType.c13, { color: c.secondary }]}>{t(`eatkcal.v2.common.${k}`)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: c.line }} />
          <EkKV label={t('eatkcal.v2.cart.subtotal')} value={money(subtotal)} />
          {appliedCoupon && couponDiscount > 0 ? (
            <EkKV label={t('eatkcal.v2.cart.discount')} value={`−${money(couponDiscount)}`} tone="ok" />
          ) : null}
          <EkKV
            label={t('eatkcal.v2.cart.delivery')}
            value={
              !deliveryKnown
                ? t('eatkcal.v2.cart.delivery_at_checkout')
                : quote.deliveryFee === 0
                  ? t('eatkcal.v2.cart.delivery_free')
                  : money(quote.deliveryFee)
            }
            tone={deliveryKnown && quote.deliveryFee === 0 ? 'ok' : undefined}
          />
          <EkKV label={t('eatkcal.v2.cart.total')} value={money(total)} strong />
        </View>

        {progress != null && quote.remainingToFreeShipping > 0 ? (
          <View style={[styles.freeBar, { backgroundColor: c.line }]} testID="ek-cart-free-left">
            <View style={styles.between}>
              <Text style={[ekType.c13, { color: c.ink, flex: 1 }]}>
                {t('eatkcal.v2.cart.free_left', { amount: money(quote.remainingToFreeShipping) })}
              </Text>
              <Pressable onPress={goStores} accessibilityRole="button" style={styles.textBtn}>
                <Text style={[ekType.c13s, { color: c.ink }]}>{t('eatkcal.v2.cart.add_products')}</Text>
              </Pressable>
            </View>
            <View style={[styles.track, { backgroundColor: c.surface }]}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.ink }]} />
            </View>
          </View>
        ) : null}
      </View>

      <CouponSheet
        visible={couponOpen}
        onClose={() => setCouponOpen(false)}
        cartTotal={subtotal}
        items={couponItems}
        onApplied={handleCouponApplied}
      />
    </EkScreen>
  );
}

/** Satır makro çipleri — sıra kcal · P · K · Y; veri yoksa çip yok. */
function MacroChips({ m }: { m: ItemMacros }) {
  const { c, t } = useEk();
  const chips: [string, string][] = [];
  if (m.kcal != null) chips.push([String(Math.round(m.kcal)), t('eatkcal.v2.common.kcal')]);
  if (m.protein != null) chips.push([t('eatkcal.v2.common.p'), t('eatkcal.v2.common.grams', { n: Math.round(m.protein) })]);
  if (m.carbs != null) chips.push([t('eatkcal.v2.common.k'), t('eatkcal.v2.common.grams', { n: Math.round(m.carbs) })]);
  if (m.fat != null) chips.push([t('eatkcal.v2.common.y'), t('eatkcal.v2.common.grams', { n: Math.round(m.fat) })]);
  if (chips.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {chips.map(([b, rest], i) => (
        <View key={i} style={[styles.chip, { backgroundColor: c.line }]}>
          <Text style={[ekType.c13, ekType.num, { color: c.ink }]}>
            <Text style={{ fontWeight: '700' }}>{b}</Text> {rest}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Kullanılmayan import uyarısı olmasın: stok kartı sipariş özetinde (EkCheckout) gösterilir.
void stockError;

const styles = StyleSheet.create({
  skCard: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 20 },
  line: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 20 },
  img: { width: 76, height: 76, borderRadius: 14 },
  icon44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, borderWidth: 1 },
  chip: { height: 26, paddingHorizontal: 9, borderRadius: 13, justifyContent: 'center' },
  sugg: { width: 120, padding: 10, borderRadius: 18, gap: 6 },
  suggImg: { height: 88, borderRadius: 12 },
  plus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  couponRow: { minHeight: 56, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  textBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  summary: { padding: 14, borderRadius: 20, gap: 10 },
  freeBar: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  cta: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
