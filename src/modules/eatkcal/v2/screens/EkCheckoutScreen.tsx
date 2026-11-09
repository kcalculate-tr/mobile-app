// eatkcal v2 (G13-S2 md.4) — Sipariş özeti, tek sayfa: FinEkCheckout +
// FinEkCheckoutPayWait / PayFail / PayUnknown.
//
// Bütün sipariş/ödeme kararları `checkout/useEkCheckout.ts`'te ve orada
// yalnız MEVCUT fonksiyonlar çağrılır. "Siparişi ver" → mevcut
// createOrderDraftForPayment → mevcut PaymentScreen (Paynkolay, 3D dahil AYNEN).
// Başarı PaymentScreen'in kendisi tarafından OrderSuccess'e taşınır; buraya
// yalnız başarısız / doğrulanıyor / vazgeçildi durumları döner ve pano
// durumuna eşlenir (model/checkoutModel.ts payStateFromOrder).
//
// Paynkolay dışı sağlayıcı (eski Tosla satır içi kart formu) v2'de YOK →
// bugünkü Checkout ekranına devredilir.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { PaynkolayLogo } from '../ui/PaynkolayLogo';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { Check, Clock, CreditCard, Lock, MapPin, Plus, Storefront, WarningCircle } from '../../../../components/icons';
import { CachedImage } from '../../../../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../../../../lib/imageUrl';
import { DURATION, RN_CURVE, fontFamily, haptic, useReducedMotion } from '../../../../core/design';
import { mesafeKm } from '../../../../lib/nearestLocation';
import { formatDeliveryDaysFull, isDeliveryDay } from '../../../../utils/deliveryDays';
import { useEkNav, type EkV2ParamList } from '../nav';
import { EkHeader, EkScreen, EkStickyBar, ekType, money, refmtTl, useEk, EkKV } from '../ui/kit';
import { EkErrorCard } from '../ui/ErrorCard';
import { stockError } from '../model/errors';
import { EK_TIME_SLOTS } from '../model/checkoutModel';
import { groupCartLines, linePrice, lineSummary } from '../model/cartModel';
import { useEkCheckout } from '../checkout/useEkCheckout';
import { methodTimeState } from '../model/methodTime';

type SectionKey = 'md' | 'ad' | 'ct' | 'nt' | 'py' | 'bk';
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EkCheckoutScreen() {
  const navigation = useEkNav();
  const route = useRoute<RouteProp<EkV2ParamList, 'EkCheckout'>>();
  const { c, t, lang, theme } = useEk();
  const ctrl = useEkCheckout({ initialAddressId: route.params?.selectedAddressId });
  // YALNIZ __DEV__ vitrini (FinEkCheckoutPayWait/Fail/Unknown): ödeme ara durumu
  // yalnız GÖRÜNÜMDE zorlanır; ödeme mantığı (useEkCheckout) değişmez.
  const vitrinPay = __DEV__
    ? (route.params as { vitrinPay?: 'wait' | 'fail' | 'unknown' } | undefined)?.vitrinPay
    : undefined;
  const payState = vitrinPay ?? ctrl.payState;
  // Tur 26 md.14 (FinEkCheckout): "Yöntem ve zaman" boş ve AÇIK başlar ("Seçilmedi" + "Kapat").
  const [open, setOpen] = useState<SectionKey | null>('md');
  const scrollRef = useRef<ScrollView>(null);

  // G17-S1 md.6 — Yöntem ve zaman ÖNCEDEN SEÇİLİ gelmez (YALNIZ görünüm katmanı;
  // useEkCheckout varsayılanları ve sipariş/ödeme mantığı aynı). Kullanıcı ikisini
  // de seçmeden "Öde" pasif. Seçilen zaman türü mantık tarafından değiştirilir ya
  // da geçersizleşirse (dükkân kapandı, bölge izin vermiyor, dilim doldu) seçim
  // düşer ve yeniden istenir.
  const [pickedMethod, setPickedMethod] = useState<'home_delivery' | 'pickup' | null>(null);
  const [pickedTime, setPickedTime] = useState<'immediate' | 'scheduled' | null>(null);
  const { methodReady, timeStillValid, ready: methodTimeReady } = methodTimeState({
    pickedMethod,
    pickedTime,
    deliveryMethod: ctrl.deliveryMethod,
    deliveryTimeType: ctrl.deliveryTimeType,
    rulesSettled: ctrl.deliveryRulesSettled,
    canPickImmediate: ctrl.canPickImmediate,
    canPickScheduled: ctrl.canPickScheduled,
    hasScheduledDate: !!ctrl.scheduledDate,
    hasOpenSlot: !!ctrl.timeSlot && !ctrl.timeSlot.disabled,
  });
  useEffect(() => {
    if (pickedTime !== null && !timeStillValid) setPickedTime(null);
  }, [pickedTime, timeStillValid]);
  // Ödeme bekleyen taslak varsa seçim zaten yapılmıştır (FinEkCheckoutPayWait/Fail/Unknown):
  // özet mantığın yöntem/zamanını gösterir, bölüm kapalı durur. Yalnız görünüm.
  const draftShown = useRef(false);
  useEffect(() => {
    if (!ctrl.draftOrder || draftShown.current) return;
    draftShown.current = true;
    setPickedMethod((m) => m ?? ctrl.deliveryMethod);
    setPickedTime((x) => x ?? ctrl.deliveryTimeType);
    setOpen((o) => (o === 'md' ? null : o));
  }, [ctrl.draftOrder, ctrl.deliveryMethod, ctrl.deliveryTimeType]);

  // Paynkolay dışı → bugünkü ekran (yeni ödeme yolu yazılmaz).
  useEffect(() => {
    if (!ctrl.isPaynkolay) navigation.replace('Checkout', route.params?.selectedAddressId ? { selectedAddressId: route.params.selectedAddressId } : undefined);
  }, [ctrl.isPaynkolay, navigation, route.params?.selectedAddressId]);

  // Oturum yoksa giriş (CheckoutScreen.tsx:984-990 guard'ının karşılığı).
  useEffect(() => {
    if (!ctrl.user) navigation.navigate('Login');
  }, [ctrl.user, navigation]);

  // PaymentScreen'den dönüş → sonucu mevcut fonksiyonla oku.
  useFocusEffect(
    useCallback(() => {
      ctrl.refreshPaymentOutcome();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctrl.refreshPaymentOutcome]),
  );

  // Alan hatası çıkınca ilgili bölümü aç (eski ekran o alana kayıyordu).
  useEffect(() => {
    const e = ctrl.fieldErrors;
    if (e.adres) setOpen('ad');
    else if (e.ad || e.tel || e.eposta) setOpen('ct');
    else if (e.zaman) setOpen('md');
  }, [ctrl.fieldErrors]);

  // Sepet boşaldıysa (ör. başka sekmede) sepete dön — sipariş tamamlanıp
  // ekrandan çıkılırken (0 TL → OrderSuccess) tetiklenmez.
  const leavingRef = useRef(false);
  useEffect(() => {
    if (leavingRef.current) return;
    if (ctrl.items.length === 0 && ctrl.payState === 'idle' && !ctrl.placing && navigation.isFocused()) navigation.goBack();
  }, [ctrl.items.length, ctrl.payState, ctrl.placing, navigation]);

  const toggle = (k: SectionKey) => {
    haptic('selection');
    setOpen((o) => (o === k ? null : k));
  };

  const onPlace = async () => {
    const r = await ctrl.placeOrder();
    if (r.kind === 'payment') navigation.navigate('PaymentScreen', r.params);
    else if (r.kind === 'free_success') {
      leavingRef.current = true;
      navigation.replace('OrderSuccess', { orderCode: r.orderCode, orderId: r.orderId, noticeMessage: undefined });
    } else if (r.kind === 'login') navigation.navigate('Login');
  };

  // ── Özet satırları ─────────────────────────────────────────────────────
  const days = lang === 'en' ? EN_DAYS : TR_DAYS;
  const dayLabel = (d: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d.toDateString() === tomorrow.toDateString() ? (lang === 'en' ? 'Tomorrow' : 'Yarın') : days[d.getDay()];
  };
  const eta = ctrl.totals.estimatedDeliveryLabel;
  const methodLabel = ctrl.deliveryMethod === 'home_delivery' ? t('eatkcal.v2.checkout.home_delivery') : t('eatkcal.v2.checkout.pickup');
  const timeLabel =
    ctrl.deliveryTimeType === 'immediate'
      ? [t('eatkcal.v2.checkout.immediate'), ctrl.deliveryMethod === 'home_delivery' ? eta : null].filter(Boolean).join(', ')
      : [
          t('eatkcal.v2.checkout.scheduled'),
          ctrl.scheduledDate ? `${dayLabel(ctrl.scheduledDate)} ${ctrl.timeSlot?.label ?? ''}`.trim() : null,
        ]
          .filter(Boolean)
          .join(', ');
  const mdSum = !methodReady
    ? t('eatkcal.v2.checkout.not_selected')
    : ctrl.deliveryMethod === 'pickup'
      ? methodLabel
      : pickedTime
        ? `${methodLabel}, ${timeLabel}`
        : `${methodLabel}, ${t('eatkcal.v2.checkout.pick_method_time')}`;

  const branch = ctrl.branches.find((b) => b.id === ctrl.selectedBranchId) ?? null;
  const adSum =
    ctrl.deliveryMethod === 'home_delivery'
      ? ctrl.selectedAddress
        ? `${ctrl.selectedAddress.title}, ${ctrl.selectedAddress.full_address}`
        : ctrl.addressesLoading
          ? '…'
          : t('eatkcal.v2.checkout.add_address')
      : branch
        ? branch.name
        : '—';
  const ctSum = [ctrl.customerName, ctrl.customerPhone].filter(Boolean).join(', ') || '—';
  const selectedCard = ctrl.savedCards.find((x) => x.id === ctrl.selectedCardId) ?? null;
  const pySum = selectedCard?.last4
    ? t('eatkcal.v2.checkout.card', { last4: selectedCard.last4 })
    : t('eatkcal.v2.checkout.new_card');
  const itemCount = ctrl.items.filter((i) => !i.parentLineKey).reduce((s, i) => s + i.quantity, 0);
  const bkSum = t('eatkcal.v2.checkout.basket_sum', { count: itemCount, amount: money(ctrl.totals.totalAmount) });

  // Gel-Al: en yakın şube önerisi (yalnız konum izni varsa; BranchPicker ile aynı amaç).
  const branchRows = useMemo(
    () =>
      ctrl.branches.map((b) => ({
        branch: b,
        km:
          ctrl.deviceCoords && b.latitude != null && b.longitude != null
            ? mesafeKm(ctrl.deviceCoords, { latitude: b.latitude, longitude: b.longitude })
            : null,
      })),
    [ctrl.branches, ctrl.deviceCoords],
  );
  const [branchAuto, setBranchAuto] = useState(false);
  useEffect(() => {
    if (ctrl.deliveryMethod !== 'pickup' || ctrl.selectedBranchId || branchRows.length === 0) return;
    const withKm = branchRows.filter((r) => r.km != null).sort((a, b) => (a.km! - b.km!));
    if (withKm.length > 0) {
      ctrl.setSelectedBranchId(withKm[0].branch.id);
      setBranchAuto(true);
    }
  }, [ctrl.deliveryMethod, ctrl.selectedBranchId, branchRows, ctrl]);

  const stock = stockError(ctrl.closedItemNames);
  const lines = groupCartLines(ctrl.items);
  const hasDraft = !!ctrl.draftOrder;
  // G17-S1 md.6: taslak (ödeme bekleyen) sipariş yokken yöntem+zaman seçilmeden "Öde" pasif.
  const needsMethodTime = !hasDraft && !methodTimeReady;
  // Tur 26 md.14 (FinEkCheckout): düğme her zaman "Öde [N] TL"; eksik adım düğmenin
  // ALTINDA yardım satırı ("Yöntem ve zaman seç" / "Sözleşmeleri onayla").
  const ctaAmount = money(hasDraft ? ctrl.draftOrder?.totalAmount || ctrl.totals.totalAmount : ctrl.totals.totalAmount);
  const ctaLabel = `${t('eatkcal.v2.checkout.pay')} ${ctaAmount}`;
  const ctaHelp = needsMethodTime
    ? t('eatkcal.v2.checkout.pick_method_time')
    : !ctrl.contractsAccepted
      ? t('eatkcal.v2.checkout.accept_contracts')
      : '';
  const ctaDisabled = ctrl.isCheckoutDisabled || !ctrl.contractsAccepted || needsMethodTime;
  const disBg = theme.isDark ? '#2C2C2E' : '#DCDEE2';
  const disFg = theme.isDark ? '#A1A1A6' : '#45454A';

  // ── Alt bar ─────────────────────────────────────────────────────────────
  const footer = (
    <EkStickyBar testID="ek-checkout-footer">
      {payState === 'wait' ? (
        // FinEkCheckoutPayWait: teslimat notu + gri (pasif) hap düğme · nabız noktası.
        <View style={{ gap: 6 }} accessibilityLiveRegion="polite" testID="ek-pay-wait">
          {ctrl.deliveryMethod === 'home_delivery' && ctrl.isDeliverable && ctrl.totals.deliveryFee === 0 ? (
            <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.checkout.delivery_free_note')}</Text>
          ) : null}
          <View style={[styles.cta, styles.waitRow, { backgroundColor: c.line }]} accessibilityRole="progressbar">
            <PulseDot color={c.accentLine} />
            <Text style={[ekType.b17, { color: c.ink }]}>{t('eatkcal.v2.checkout.pay_wait')}</Text>
          </View>
        </View>
      ) : payState === 'fail' ? (
        <View style={[styles.payCard, { backgroundColor: c.surface }]} accessibilityRole="alert" testID="ek-pay-fail">
          <View style={[styles.payIcon, { backgroundColor: c.line }]}>
            <CreditCard size={24} color={c.ink} />
          </View>
          <Text style={[ekType.h20, { color: c.ink, textAlign: 'center' }]}>{t('eatkcal.v2.checkout.pay_fail_title')}</Text>
          <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center' }]}>
            {ctrl.screenError ? refmtTl(ctrl.screenError) : t('eatkcal.v2.checkout.pay_fail_body')}
          </Text>
          <Pressable
            onPress={onPlace}
            disabled={ctrl.placing || !ctrl.retryAllowed}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: c.ink, alignSelf: 'stretch' }]}
            testID="ek-pay-retry"
          >
            <Text style={[ekType.b17, { color: c.surface }]}>{t('eatkcal.v2.checkout.pay_fail_retry')}</Text>
          </Pressable>
          {ctrl.cardsEnabled ? (
            <Pressable
              onPress={() => {
                ctrl.setSelectedCardId(null);
                setOpen('py');
              }}
              accessibilityRole="button"
              style={styles.textBtn}
            >
              <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.checkout.pay_fail_other')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : payState === 'unknown' ? (
        <View style={[styles.payCard, { backgroundColor: c.surface }]} accessibilityRole="alert" testID="ek-pay-unknown">
          <View style={[styles.payIcon, { backgroundColor: c.line }]}>
            <Clock size={24} color={c.ink} />
          </View>
          <Text style={[ekType.h20, { color: c.ink, textAlign: 'center' }]}>{t('eatkcal.v2.checkout.pay_unknown_title')}</Text>
          <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center' }]}>{t('eatkcal.v2.checkout.pay_unknown_body')}</Text>
          <Pressable
            onPress={() => navigation.navigate('EkOrders')}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: c.ink, alignSelf: 'stretch' }]}
          >
            <Text style={[ekType.b17, { color: c.surface }]}>{t('eatkcal.v2.checkout.pay_unknown_action')}</Text>
          </Pressable>
          {ctrl.retryAllowed ? (
            // Eski ekranda bekleyen taslak her zaman tekrar ödenebiliyordu (retryPaymentOrderId).
            <Pressable onPress={onPlace} accessibilityRole="button" style={styles.textBtn} testID="ek-pay-unknown-retry">
              <Text style={[ekType.b15s, ekType.num, { color: c.ink }]}>{ctaLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {ctrl.deliveryMethod === 'home_delivery' && ctrl.isDeliverable ? (
            <Text style={[ekType.c13s, { color: c.secondary }]}>
              {ctrl.totals.deliveryFee === 0
                ? t('eatkcal.v2.checkout.delivery_free_note')
                : ctrl.totals.remainingToFreeShipping > 0
                  ? t('eatkcal.v2.cart.free_left', { amount: money(ctrl.totals.remainingToFreeShipping) })
                  : `${t('eatkcal.v2.cart.delivery')} ${money(ctrl.totals.deliveryFee)}`}
            </Text>
          ) : null}
          <View style={styles.contracts}>
            <Pressable
              onPress={() => {
                haptic('selection');
                ctrl.setContractsAccepted(!ctrl.contractsAccepted);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ctrl.contractsAccepted }}
              accessibilityLabel={`${t('eatkcal.v2.checkout.terms')}${t('eatkcal.v2.checkout.and')}${t('eatkcal.v2.checkout.distance_sales')}`}
              style={styles.check44}
              testID="ek-contracts"
            >
              <View
                style={[
                  styles.box,
                  {
                    backgroundColor: ctrl.contractsAccepted ? c.ink : 'transparent',
                    borderColor: ctrl.fieldErrors.sozlesme ? c.danger : ctrl.contractsAccepted ? c.ink : c.secondary,
                  },
                ]}
              >
                {ctrl.contractsAccepted ? <Check size={14} color={c.surface} weight="bold" /> : null}
              </View>
            </Pressable>
            <Text style={[ekType.c13, { color: c.ink, flex: 1 }]}>
              {t('eatkcal.v2.checkout.contracts_pre')}
              <Text
                style={[ekType.c13s, { textDecorationLine: 'underline' }]}
                onPress={() => navigation.navigate('ProfileContracts', { slug: 'terms' })}
                accessibilityRole="link"
                suppressHighlighting
              >
                {t('eatkcal.v2.checkout.terms')}
              </Text>
              {t('eatkcal.v2.checkout.and')}
              <Text
                style={[ekType.c13s, { textDecorationLine: 'underline' }]}
                onPress={() => navigation.navigate('ProfileContracts', { slug: 'distance-sales' })}
                accessibilityRole="link"
                suppressHighlighting
              >
                {t('eatkcal.v2.checkout.distance_sales')}
              </Text>
              {t('eatkcal.v2.checkout.contracts_post')}
            </Text>
          </View>
          {ctrl.fieldErrors.sozlesme ? (
            <Text style={[ekType.c13, { color: c.danger }]}>{ctrl.fieldErrors.sozlesme}</Text>
          ) : null}
          <Pressable
            onPress={onPlace}
            disabled={ctrl.placing || ctrl.isCheckoutDisabled || needsMethodTime}
            accessibilityRole="button"
            accessibilityState={{ disabled: ctaDisabled }}
            accessibilityLabel={ctaLabel}
            accessibilityHint={ctaHelp || undefined}
            style={[styles.cta, styles.ctaRow, { backgroundColor: ctaDisabled ? disBg : c.ink }]}
            testID="ek-checkout-place"
          >
            {ctrl.placing ? (
              <ActivityIndicator color={c.surface} />
            ) : (
              <>
                <Text style={[styles.ctaText, { color: ctaDisabled ? disFg : c.surface }]}>{t('eatkcal.v2.checkout.pay')}</Text>
                <Text style={[styles.ctaText, ekType.num, { color: ctaDisabled ? disFg : c.surface }]}>{ctaAmount}</Text>
              </>
            )}
          </Pressable>
          {ctaHelp ? (
            <Text style={[styles.help, { color: c.secondary }]} testID="ek-checkout-help">
              {ctaHelp}
            </Text>
          ) : null}
        </View>
      )}
    </EkStickyBar>
  );

  return (
    <EkScreen
      scrollRef={scrollRef}
      header={<EkHeader title={t('eatkcal.v2.checkout.title')} onBack={navigation.goBack} />}
      footer={footer}
      bottomInset={200}
      contentStyle={{ paddingBottom: 280 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }} testID="ek-checkout">
        {/* Yöntem · Zaman */}
        <Section k="md" label={t('eatkcal.v2.checkout.method_time')} summary={mdSum} open={open} onToggle={toggle}>
          <Segmented
            items={[
              { key: 'home_delivery', label: t('eatkcal.v2.checkout.home_delivery') },
              { key: 'pickup', label: t('eatkcal.v2.checkout.pickup') },
            ]}
            value={pickedMethod !== null ? ctrl.deliveryMethod : null}
            onChange={(k) => {
              const m = k as 'home_delivery' | 'pickup';
              setPickedMethod(m);
              if (m !== ctrl.deliveryMethod) setPickedTime(null);
              ctrl.setDeliveryMethod(m);
            }}
          />
          {ctrl.deliveryMethod === 'home_delivery' ? (
            <Segmented
              items={[
                {
                  key: 'immediate',
                  label:
                    ctrl.deliveryRulesSettled && !ctrl.canPickImmediate
                      ? `${t('eatkcal.v2.checkout.immediate')} (${t('eatkcal.v2.checkout.closed')})`
                      : t('eatkcal.v2.checkout.immediate'),
                  disabled: ctrl.deliveryRulesSettled && !ctrl.canPickImmediate,
                },
                {
                  key: 'scheduled',
                  label: t('eatkcal.v2.checkout.scheduled'),
                  disabled: ctrl.deliveryRulesSettled && !ctrl.canPickScheduled,
                },
              ]}
              value={pickedTime !== null ? ctrl.deliveryTimeType : null}
              onChange={(k) => {
                setPickedTime(k as 'immediate' | 'scheduled');
                ctrl.setDeliveryTimeType(k as 'immediate' | 'scheduled');
              }}
            />
          ) : null}
          {ctrl.deliveryMethod === 'home_delivery' && ctrl.deliveryTimeType === 'scheduled' ? (
            <View style={{ gap: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {ctrl.scheduledDates.map((d) => {
                  const sel = !!ctrl.scheduledDate && d.toDateString() === ctrl.scheduledDate.toDateString();
                  const ok = isDeliveryDay(d, ctrl.deliveryDays);
                  return (
                    <Pressable
                      key={d.toISOString()}
                      onPress={() => {
                        if (!ok) {
                          haptic('warning');
                          return;
                        }
                        haptic('selection');
                        ctrl.setScheduledDate(d);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: sel, disabled: !ok }}
                      accessibilityLabel={`${dayLabel(d)} ${d.getDate()}`}
                      style={[
                        styles.day,
                        sel ? { backgroundColor: c.accent } : { borderColor: c.line, borderWidth: 1 },
                        !ok && { opacity: 0.4 },
                      ]}
                    >
                      <Text style={[ekType.c13, { color: sel ? c.onAccent : c.ink }]}>{dayLabel(d)}</Text>
                      <Text style={[ekType.h20, ekType.num, { color: sel ? c.onAccent : c.ink }]}>{d.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {ctrl.scheduledDate ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {EK_TIME_SLOTS.map((slot) => {
                    const sel = ctrl.timeSlot?.id === slot.id;
                    return (
                      <Pressable
                        key={slot.id}
                        disabled={slot.disabled}
                        onPress={() => {
                          haptic('selection');
                          ctrl.setTimeSlot(slot);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: sel, disabled: slot.disabled }}
                        style={[
                          styles.slot,
                          sel ? { backgroundColor: c.accent } : { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 },
                          slot.disabled && { opacity: 0.45 },
                        ]}
                      >
                        <Text style={[ekType.b15s, ekType.num, { color: sel ? c.onAccent : c.ink }]}>
                          {slot.disabled ? `${slot.label} (${t('eatkcal.v2.checkout.slot_full')})` : slot.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {ctrl.deliveryDays && ctrl.deliveryDays.length < 7 ? (
                <Text style={[ekType.c13, { color: c.secondary }]}>
                  {t('eatkcal.v2.checkout.delivery_days', { days: formatDeliveryDaysFull(ctrl.deliveryDays) })}
                </Text>
              ) : null}
              {ctrl.fieldErrors.zaman ? <Text style={[ekType.c13, { color: c.danger }]}>{ctrl.fieldErrors.zaman}</Text> : null}
            </View>
          ) : null}
        </Section>

        {/* Adres / Şube */}
        <Section
          k="ad"
          label={ctrl.deliveryMethod === 'home_delivery' ? t('eatkcal.v2.checkout.address') : t('eatkcal.v2.checkout.branch')}
          summary={adSum}
          open={open}
          onToggle={toggle}
          error={ctrl.fieldErrors.adres}
        >
          {ctrl.deliveryMethod === 'home_delivery' ? (
            <View style={{ gap: 10 }}>
              {ctrl.addresses.map((a) => {
                const sel = a.id === ctrl.selectedAddress?.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      haptic('selection');
                      ctrl.selectAddress(a.id);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    style={[styles.option, sel ? { backgroundColor: c.accent } : { borderColor: c.line, borderWidth: 1 }]}
                  >
                    <MapPin size={20} color={sel ? c.onAccent : c.ink} weight={sel ? 'fill' : 'regular'} />
                    <View style={{ flex: 1 }}>
                      <Text style={[ekType.b15s, { color: sel ? c.onAccent : c.ink }]}>{a.title}</Text>
                      <Text style={[ekType.c13, { color: sel ? c.onAccent : c.secondary }]} numberOfLines={2}>
                        {[a.full_address, a.neighbourhood, a.district].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    {sel ? <Check size={18} color={c.onAccent} weight="bold" /> : null}
                  </Pressable>
                );
              })}
              {ctrl.addressError ? <Text style={[ekType.c13, { color: c.danger }]}>{ctrl.addressError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => navigation.navigate('EkAddressAdd', { selectMode: true })}
                  accessibilityRole="button"
                  style={[styles.outlineBtn, { borderColor: c.line }]}
                >
                  <Plus size={16} color={c.ink} />
                  <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.checkout.add_address')}</Text>
                </Pressable>
                {ctrl.addresses.length > 0 ? (
                  <Pressable
                    onPress={() => navigation.navigate('EkAddresses', { selectMode: true })}
                    accessibilityRole="button"
                    style={[styles.outlineBtn, { borderColor: c.line }]}
                  >
                    <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.checkout.my_addresses')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {branchRows.map(({ branch: b, km }) => {
                const sel = b.id === ctrl.selectedBranchId;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      haptic('selection');
                      ctrl.setSelectedBranchId(b.id);
                      setBranchAuto(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    style={[styles.option, sel ? { backgroundColor: c.accent } : { borderColor: c.line, borderWidth: 1 }]}
                  >
                    <Storefront size={20} color={sel ? c.onAccent : c.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={[ekType.b15s, { color: sel ? c.onAccent : c.ink }]}>{b.name}</Text>
                      <Text style={[ekType.c13, { color: sel ? c.onAccent : c.secondary }]} numberOfLines={2}>
                        {km != null ? `${km.toFixed(1)} km, ${b.address}` : b.address}
                      </Text>
                    </View>
                    {sel ? <Check size={18} color={c.onAccent} weight="bold" /> : null}
                  </Pressable>
                );
              })}
              {branchAuto ? <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.checkout.branch_auto')}</Text> : null}
            </View>
          )}
        </Section>

        {/* İletişim */}
        <Section
          k="ct"
          label={t('eatkcal.v2.checkout.contact')}
          summary={ctSum}
          open={open}
          onToggle={toggle}
          error={ctrl.fieldErrors.ad || ctrl.fieldErrors.tel || ctrl.fieldErrors.eposta}
        >
          <Field
            label={t('eatkcal.v2.checkout.name')}
            value={ctrl.customerName}
            onChange={(v) => {
              ctrl.setCustomerName(v);
              ctrl.clearFieldError('ad');
            }}
            error={ctrl.fieldErrors.ad}
            textContentType="name"
          />
          <Field
            label={t('eatkcal.v2.checkout.phone')}
            value={ctrl.customerPhone}
            onChange={(v) => {
              ctrl.setCustomerPhone(v);
              ctrl.clearFieldError('tel');
            }}
            error={ctrl.fieldErrors.tel}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
          <Field
            label={t('eatkcal.v2.checkout.email')}
            value={ctrl.customerEmail}
            onChange={(v) => {
              ctrl.setCustomerEmail(v);
              ctrl.clearFieldError('eposta');
            }}
            error={ctrl.fieldErrors.eposta}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </Section>

        {/* Sipariş notu */}
        <Section
          k="nt"
          label={t('eatkcal.v2.checkout.note')}
          summary={ctrl.orderNote.trim() || t('eatkcal.v2.checkout.note_add')}
          open={open}
          onToggle={toggle}
        >
          <TextInput
            value={ctrl.orderNote}
            onChangeText={ctrl.setOrderNote}
            multiline
            numberOfLines={3}
            accessibilityLabel={t('eatkcal.v2.checkout.note')}
            style={[styles.textarea, ekType.b15, { backgroundColor: c.line, color: c.ink }]}
          />
        </Section>

        {/* Ödeme */}
        <Section k="py" label={t('eatkcal.v2.checkout.payment')} summary={pySum} open={open} onToggle={toggle}>
          {ctrl.cardsEnabled
            ? ctrl.savedCards.map((card) => {
                const sel = card.id === ctrl.selectedCardId;
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => {
                      haptic('selection');
                      ctrl.setSelectedCardId(card.id);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    style={[styles.option, { minHeight: 52 }, sel ? { backgroundColor: c.accent } : { borderColor: c.line, borderWidth: 1 }]}
                  >
                    <CreditCard size={20} color={sel ? c.onAccent : c.ink} />
                    <Text style={[ekType.b15s, { color: sel ? c.onAccent : c.ink, flex: 1 }]}>
                      {card.card_alias || t('eatkcal.v2.checkout.card', { last4: card.last4 ?? '' })}
                    </Text>
                    {sel ? <Check size={18} color={c.onAccent} weight="bold" /> : null}
                  </Pressable>
                );
              })
            : null}
          {ctrl.cardsEnabled ? (
            <Pressable
              onPress={() => ctrl.setSelectedCardId(null)}
              accessibilityRole="radio"
              accessibilityState={{ checked: !ctrl.selectedCardId }}
              style={[
                styles.outlineBtn,
                { borderColor: c.line, alignSelf: 'flex-start' },
                !ctrl.selectedCardId && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
            >
              <Plus size={16} color={!ctrl.selectedCardId ? c.onAccent : c.ink} />
              <Text style={[ekType.b15s, { color: !ctrl.selectedCardId ? c.onAccent : c.ink }]}>{t('eatkcal.v2.checkout.new_card')}</Text>
            </Pressable>
          ) : null}
          {ctrl.cardsState === 'liste_hatasi' ? (
            <Pressable onPress={ctrl.reloadCards} accessibilityRole="button" style={styles.textBtnLeft}>
              <Text style={[ekType.c13s, { color: c.ink }]}>{t('eatkcal.v2.checkout.cards_retry')}</Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Lock size={14} color={c.secondary} />
            <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.checkout.secure')}</Text>
          </View>
        </Section>

        {/* FinEkCheckout: "Ödeme altyapısı" + resmî Paynkolay logosu (1.0.7 varlığı; İSTİSNA 3). */}
        <View style={styles.provider} testID="ek-checkout-provider">
          <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.checkout.provider')}</Text>
          <View accessible accessibilityRole="image" accessibilityLabel={t('eatkcal.v2.checkout.provider_logo')}>
            <PaynkolayLogo height={20} isDark={theme.isDark} />
          </View>
        </View>

        {/* Sepet özeti */}
        <Section k="bk" label={t('eatkcal.v2.checkout.basket')} summary={bkSum} open={open} onToggle={toggle}>
          {lines.map(({ item, children }) => {
            const p = linePrice(item, children);
            const sum = lineSummary(item, children);
            return (
              <View key={item.lineKey} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                {item.img ? (
                  <CachedImage uri={transformImageUrl(item.img, ImagePreset.productCard) ?? item.img} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: c.line }]} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[ekType.b15, { color: c.ink }]} numberOfLines={2}>
                    {item.name} ×{item.quantity}
                  </Text>
                  {sum ? (
                    <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
                      {sum}
                    </Text>
                  ) : null}
                </View>
                <Text style={[ekType.b15s, ekType.num, { color: c.ink }]}>{money(p.now)}</Text>
              </View>
            );
          })}
          {/* G15-S5: Final'de ayrı toplam kartı yok → döküm "Sepet özeti" açılınca;
              kapalıyken toplam satır özetinde + düğmede, teslimat ücreti alt notta. */}
          <View style={[styles.totals, { borderTopColor: c.line }]} testID="ek-checkout-totals">
            <EkKV label={t('eatkcal.v2.cart.subtotal')} value={money(ctrl.totals.subtotal)} />
            {ctrl.totals.discountAmount > 0 ? (
              <EkKV label={t('eatkcal.v2.cart.discount')} value={`−${money(ctrl.totals.discountAmount)}`} tone="ok" />
            ) : null}
            <EkKV
              label={t('eatkcal.v2.cart.delivery')}
              value={ctrl.totals.deliveryFee === 0 ? t('eatkcal.v2.cart.delivery_free') : money(ctrl.totals.deliveryFee)}
              tone={ctrl.totals.deliveryFee === 0 ? 'ok' : undefined}
            />
            <EkKV label={t('eatkcal.v2.cart.total')} value={money(ctrl.totals.totalAmount)} strong />
          </View>
        </Section>

        {ctrl.kazanilacakMacro > 0 ? (
          <View style={[styles.macro, { backgroundColor: c.line }]}>
            <View style={[styles.dot, { backgroundColor: c.accentLine }]} />
            <Text style={[ekType.b15, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.checkout.macro_earn')}</Text>
            <Text style={[ekType.b15s, ekType.num, { color: c.ink }]}>+{ctrl.kazanilacakMacro}</Text>
          </View>
        ) : null}

        {stock ? <EkErrorCard error={stock} onAction={() => navigation.navigate('EkCart')} /> : null}
        {payState === 'idle' && (ctrl.screenError || ctrl.checkoutBlockMessage) && !stock ? (
          <View style={[styles.card, { backgroundColor: c.surface, flexDirection: 'row', gap: 8, alignItems: 'center' }]} accessibilityRole="alert">
            <WarningCircle size={18} color={ctrl.screenError ? c.danger : c.secondary} weight="fill" />
            <Text style={[ekType.c13, { color: c.ink, flex: 1 }]}>{refmtTl(ctrl.screenError || ctrl.checkoutBlockMessage)}</Text>
            {ctrl.ruleStatus.status === 'error' ? (
              <Pressable onPress={ctrl.retryRules} accessibilityRole="button" style={styles.textBtn}>
                <Text style={[ekType.c13s, { color: c.ink }]}>{t('eatkcal.v2.common.retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </EkScreen>
  );
}

// ── Küçük parçalar ─────────────────────────────────────────────────────────
function Section({
  k,
  label,
  summary,
  open,
  onToggle,
  error,
  children,
}: {
  k: SectionKey;
  label: string;
  summary: string;
  open: SectionKey | null;
  onToggle: (k: SectionKey) => void;
  error?: string;
  children: React.ReactNode;
}) {
  const { c, t } = useEk();
  const isOpen = open === k;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, padding: 0 }]}>
      <Pressable
        onPress={() => onToggle(k)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={styles.sectionHead}
        testID={`ek-section-${k}`}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[ekType.c13s, { color: c.secondary }]}>{label}</Text>
          <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={isOpen ? undefined : 2}>
            {summary}
          </Text>
        </View>
        <Text style={[ekType.b15s, { color: c.ink }]}>{isOpen ? t('eatkcal.v2.common.close') : t('eatkcal.v2.checkout.edit')}</Text>
      </Pressable>
      {error ? <Text style={[ekType.c13, { color: c.danger, paddingHorizontal: 14, paddingBottom: isOpen ? 0 : 12 }]}>{error}</Text> : null}
      {isOpen ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>{children}</View> : null}
    </View>
  );
}

function Segmented({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string; disabled?: boolean }[];
  /** null → hiçbiri seçili değil (G17-S1 md.6). */
  value: string | null;
  onChange: (k: string) => void;
}) {
  const { c } = useEk();
  return (
    <View style={[styles.seg, { backgroundColor: c.line }]} accessibilityRole="radiogroup">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            disabled={it.disabled}
            onPress={() => {
              haptic('selection');
              onChange(it.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!it.disabled }}
            style={[styles.segItem, on && { backgroundColor: c.surface }, it.disabled && { opacity: 0.45 }]}
          >
            <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={1}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  keyboardType,
  textContentType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
}) {
  const { c } = useEk();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[ekType.c13, { color: c.secondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        style={[
          styles.input,
          ekType.b15,
          { backgroundColor: c.line, color: c.ink, borderColor: error ? c.danger : 'transparent' },
        ]}
      />
      {error ? <Text style={[ekType.c13, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 14 },
  sectionHead: { minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 26 },
  segItem: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  day: { width: 64, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2 },
  slot: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  option: { minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  outlineBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  textarea: { minHeight: 88, paddingHorizontal: 14, paddingTop: 12, borderRadius: 14, textAlignVertical: 'top' },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  macro: { minHeight: 48, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  contracts: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4 },
  check44: { width: 44, height: 44, marginLeft: -11, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaRow: { flexDirection: 'row', gap: 10 },
  ctaText: { fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 21 },
  help: { minHeight: 20, textAlign: 'center', fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  provider: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  textBtn: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  textBtnLeft: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  totals: { gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  waitRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  payCard: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 8, borderRadius: 20, gap: 8, alignItems: 'center' },
  payIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});

/** Ödeme bekleniyor noktası — 1800 ms nabız; azaltılmış harekette sabit. */
function PulseDot({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.35, duration: DURATION.story, easing: RN_CURVE.standard, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: DURATION.story, easing: RN_CURVE.standard, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o, reduced]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: o }} />;
}
