// eatkcal v2 (G13-S2 md.4/md.9) — Sipariş özetinin SAF modeli.
//
// KURAL: yeni sipariş/ödeme mantığı YOK. Burada yalnız iki şey var:
//  (a) MEVCUT lib fonksiyonlarının (deliveryRules, cartSignature,
//      checkoutPayment) aynı sırayla çağrılması,
//  (b) bugünkü `src/modules/eatkcal/screens/CheckoutScreen.tsx` (KİMSE —
//      değiştirilmedi) İÇİNDE inline duran ve lib'de karşılığı olmayan küçük
//      kararların BİREBİR kopyası; her birinin kaynak satırı yorumda. Bunları
//      tek kaynağa indirmek KİMSE dosyasına dokunmayı gerektirdiği için
//      yapılmadı → docs/night/G13-S2-LOG.md "İLTER'E".
//
// Native import YOK → `npm run test:unit` (node:test) ve jest içinden çağrılır.
import {
  resolveFreeShippingAbove,
  resolveMinOrder,
  resolveShippingFee,
  formatEstimatedDelivery,
  type DeliveryGlobals,
  type DeliveryType,
  type DeliveryZoneRow,
} from '../../../../lib/deliveryRules';
import { buildCartSignatureLines, computeCartSignature } from '../../../../lib/cartSignature';
import { buildPaymentNavParams, type PaymentNavParams } from '../../../../lib/checkoutPayment';
import type { Address, CartItem, DeliveryRuleStatus } from '../../../../types';

export type EkDeliveryMethod = 'home_delivery' | 'pickup';

// ── Zaman aralıkları ──────────────────────────────────────────────────────
// Kaynak: CheckoutScreen.tsx:110-114 (TIME_SLOTS). id 3 bugün de "Dolu".
export const EK_TIME_SLOTS = [
  { id: '1', label: '09:30 – 13:30', start: '09:30', end: '13:30', disabled: false },
  { id: '2', label: '13:30 – 17:30', start: '13:30', end: '17:30', disabled: false },
  { id: '3', label: '17:30 – 21:30', start: '17:30', end: '21:30', disabled: true },
] as const;
export type EkTimeSlot = (typeof EK_TIME_SLOTS)[number];

// ── Bölge kuralı ──────────────────────────────────────────────────────────
// Kaynak: CheckoutScreen.tsx:154-158 (toNormalizedText, readZoneNeighborhood)
// ve :1298-1395 (fetchDistrictRule'un satır seçimi + allow/days ayrıştırması).
const toNormalizedText = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('tr-TR');
const readZoneNeighborhood = (row: Record<string, unknown>) =>
  String(row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '').trim();

export interface ZoneRuleResult {
  status: DeliveryRuleStatus;
  /** null = gösterilmez; boş/okunamaz → [1..5] (CheckoutScreen.tsx:1362). */
  deliveryDays: number[] | null;
}

/**
 * `delivery_zones` satırları (ilçeye göre, updated_at desc) + seçili adres →
 * bugünkü ekranın ürettiği `DeliveryRuleStatus` ile AYNI sonuç.
 */
export function resolveZoneRule(
  rows: readonly Record<string, unknown>[],
  address: Pick<Address, 'district' | 'neighbourhood'>,
  deliveryTimeType: DeliveryType,
): ZoneRuleResult {
  if (rows.length === 0) return { status: { status: 'not_configured' }, deliveryDays: null };

  const selectedNeighborhood = toNormalizedText(address.neighbourhood);
  const matchingRow = selectedNeighborhood
    ? rows.find((row) => toNormalizedText(readZoneNeighborhood(row)) === selectedNeighborhood)
    : rows[0];
  if (!matchingRow) return { status: { status: 'not_configured' }, deliveryDays: null };

  const zoneRow = matchingRow as Record<string, unknown>;
  const typedCol = deliveryTimeType === 'immediate' ? zoneRow.delivery_days_immediate : zoneRow.delivery_days_scheduled;
  const rawDeliveryDays = typedCol !== undefined && typedCol !== null ? typedCol : zoneRow.delivery_days;
  const parsed = Array.isArray(rawDeliveryDays)
    ? (rawDeliveryDays as unknown[]).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    : [];
  const deliveryDays = parsed.length > 0 ? parsed : [1, 2, 3, 4, 5];

  const hasAllowRule = zoneRow.allow_immediate !== undefined || zoneRow.allow_scheduled !== undefined;
  const allowImmediate = hasAllowRule ? zoneRow.allow_immediate === true : true;
  const allowScheduled = hasAllowRule ? zoneRow.allow_scheduled === true : true;

  return {
    deliveryDays,
    status: {
      status: 'ok',
      data: {
        district: String(zoneRow.district || address.district).trim(),
        neighbourhood: readZoneNeighborhood(zoneRow) || null,
        isActive: allowImmediate || allowScheduled,
        minOrder: Math.max(0, Number(zoneRow.min_order || 0)),
        allowImmediate,
        allowScheduled,
        zoneRow,
      },
    },
  };
}

export function activeZoneRowOf(status: DeliveryRuleStatus): DeliveryZoneRow | null {
  return status.status === 'ok' ? ((status.data.zoneRow as DeliveryZoneRow | undefined) ?? null) : null;
}

// ── Toplamlar ─────────────────────────────────────────────────────────────
export interface EkTotalsInput {
  /** useCartStore.getSubtotal() */
  subtotal: number;
  /** appliedCoupon ? useCartStore.getDiscountAmount(subtotal) : 0 */
  discountAmount: number;
  deliveryMethod: EkDeliveryMethod;
  deliveryTimeType: DeliveryType;
  zoneRow: DeliveryZoneRow | null;
  globals: DeliveryGlobals | null;
  /** settings.min_cart_amount (CheckoutScreen.tsx:1054-1068) */
  settingsMinCartAmount: number;
}

export interface EkTotals {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  freeShippingAbove: number;
  /** Ücretsiz teslimata kalan (0 = eşik yok ya da aşıldı). */
  remainingToFreeShipping: number;
  effectiveMinAmount: number;
  remainingToMinAmount: number;
  estimatedDeliveryLabel: string | null;
}

/** Kaynak: CheckoutScreen.tsx:705-722 + :806-810. Macro indirimi v2 modelde 0 (:617-618). */
export function computeCheckoutTotals(i: EkTotalsInput): EkTotals {
  const macroDiscount = 0;
  const resolvedMinOrder = resolveMinOrder(i.zoneRow, i.globals, i.deliveryTimeType);
  const freeShippingAbove = resolveFreeShippingAbove(i.zoneRow, i.globals, i.deliveryTimeType);
  const deliveryFee =
    i.deliveryMethod === 'pickup' ? 0 : resolveShippingFee(i.zoneRow, i.globals, i.deliveryTimeType, i.subtotal);
  const totalAmount = Math.max(0, i.subtotal + deliveryFee - i.discountAmount - macroDiscount);
  const effectiveMinAmount = Math.max(Math.max(0, i.settingsMinCartAmount), resolvedMinOrder);
  const remainingToMinAmount = Math.max(0, effectiveMinAmount - i.subtotal);
  // Kaynak: CheckoutFooter.tsx:73-79 (ücretsiz teslimat şeridi; Gel-Al'da yok, CheckoutScreen.tsx:2880).
  const remainingToFreeShipping =
    i.deliveryMethod === 'pickup' || freeShippingAbove <= 0
      ? 0
      : Math.max(0, freeShippingAbove - i.subtotal);
  return {
    subtotal: i.subtotal,
    discountAmount: i.discountAmount,
    deliveryFee,
    totalAmount,
    freeShippingAbove,
    remainingToFreeShipping,
    effectiveMinAmount,
    remainingToMinAmount,
    estimatedDeliveryLabel: formatEstimatedDelivery(i.zoneRow),
  };
}

/** Sepet ekranı toplamı — CartScreen.tsx:250-255 ile aynı (teslimat sepette yok). */
export function computeCartTotal(subtotal: number, couponDiscount: number): number {
  return Math.max(0, subtotal - couponDiscount);
}

// ── Engel mesajı ──────────────────────────────────────────────────────────
// Kaynak: CheckoutScreen.tsx:812-870 (checkoutBlockMessage) — metinler AYNEN.
export const RULES_FETCH_ERROR_MESSAGE = 'Teslimat kuralları yüklenemedi. Lütfen tekrar deneyin.';

export interface EkBlockInput {
  deliveryMethod: EkDeliveryMethod;
  deliveryTimeType: DeliveryType;
  rulesFetchFailed: boolean;
  rulesLoading: boolean;
  hasAddress: boolean;
  ruleStatus: DeliveryRuleStatus;
  hasScheduledDate: boolean;
  hasTimeSlot: boolean;
  effectiveMinAmount: number;
  remainingToMinAmount: number;
  /** Para biçimi (src/lib/money.ts tl) — test için enjekte edilir. */
  formatMoney: (v: number) => string;
}

export function resolveCheckoutBlock(i: EkBlockInput): string {
  const minMsg = `Minimum sepet: ${i.formatMoney(i.effectiveMinAmount)} — Kalan: ${i.formatMoney(i.remainingToMinAmount)}`;
  if (i.deliveryMethod === 'pickup') return i.remainingToMinAmount > 0 ? minMsg : '';
  if (i.rulesFetchFailed) return RULES_FETCH_ERROR_MESSAGE;
  if (!i.hasAddress) return 'Lütfen teslimat adresi seçin.';
  if (i.rulesLoading) return 'Teslimat kuralları kontrol ediliyor...';
  const s = i.ruleStatus;
  if (s.status === 'not_configured') return 'Bu bölge için teslimat kuralı tanımlı değil. Lütfen farklı bir adres seçin.';
  if (s.status === 'ok' && !s.data.isActive) return 'Bu bölgeye teslimat yok';
  if (s.status === 'ok' && i.deliveryTimeType === 'immediate' && !s.data.allowImmediate)
    return 'Bu bölgede hemen teslimat yok. Lütfen randevulu teslimatı seçin.';
  if (s.status === 'ok' && i.deliveryTimeType === 'scheduled' && !s.data.allowScheduled)
    return 'Bu bölgede randevulu teslimat yok. Lütfen hemen teslimatı seçin.';
  if (i.deliveryTimeType === 'scheduled' && !i.hasScheduledDate) return 'Lütfen teslimat tarihi seçin.';
  if (i.deliveryTimeType === 'scheduled' && i.hasScheduledDate && !i.hasTimeSlot) return 'Lütfen teslimat saatini seçin.';
  if (i.remainingToMinAmount > 0) return minMsg;
  return '';
}

// ── Teslimat alanları + gel-al adresi ─────────────────────────────────────
/** Kaynak: CheckoutScreen.tsx:1659-1669. `toLocalDateStr` (businessHours) dışarıdan verilir. */
export function scheduledFieldsOf(
  deliveryTimeType: DeliveryType,
  scheduledDateStr: string | null,
  slot: Pick<EkTimeSlot, 'start'> | null,
): { delivery_type: DeliveryType; scheduled_date: string | null; scheduled_time: string | null } {
  return deliveryTimeType === 'scheduled' && scheduledDateStr && slot
    ? { delivery_type: 'scheduled', scheduled_date: scheduledDateStr, scheduled_time: slot.start }
    : { delivery_type: 'immediate', scheduled_date: null, scheduled_time: null };
}

/** Kaynak: CheckoutScreen.tsx:1674-1688 — Gel-Al sentetik adresi. */
export function pickupAddressOf(
  contact: { name: string; phone: string; email: string },
  branch: { name: string; address: string } | null,
): Address {
  return {
    id: 'pickup',
    title: 'Gel-Al',
    contact_name: contact.name.trim(),
    contact_phone: contact.phone.trim(),
    contact_email: contact.email.trim(),
    full_address: branch ? `Gel-Al · ${branch.name} — ${branch.address}` : 'Gel-Al (Şubeden Teslim)',
    city: '',
    district: '',
    neighbourhood: null,
  } as Address;
}

export function orderDeliveryMethodOf(m: EkDeliveryMethod): 'delivery' | 'pickup' {
  return m === 'home_delivery' ? 'delivery' : 'pickup';
}

// ── Mükerrer taslak koruması (imza) ───────────────────────────────────────
/** Kaynak: CheckoutScreen.tsx:1700-1717 — imza değiştiyse eski taslak iptal edilir. */
export function cartSignatureFor(
  items: CartItem[],
  ctx: {
    couponCode: string | null;
    addressId: string | null;
    deliveryMethod: 'delivery' | 'pickup';
    deliveryType: DeliveryType;
    scheduledDate: string | null;
    scheduledTime: string | null;
  },
): string {
  return computeCartSignature(buildCartSignatureLines(items), ctx);
}

/** Taslak yeniden kullanılabilir mi? (aynı imza → aynı taslak, yeni sipariş YOK). */
export function canReuseDraft(existingSignature: string | null | undefined, currentSignature: string): boolean {
  return !!existingSignature && existingSignature === currentSignature;
}

// ── createOrderDraftForPayment argümanı ───────────────────────────────────
export interface EkDraftInput {
  userId: string;
  address: Address;
  cartItems: CartItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode: string | null;
  couponId: string | null;
  deliveryMethod: 'delivery' | 'pickup';
  orderNote: string | null;
  deliveryType: DeliveryType;
  scheduledDate: string | null;
  scheduledTime: string | null;
  paymentMethod: 'saved_card' | 'new_card';
}

/** Kaynak: CheckoutScreen.tsx:1746-1770 — alan adları ve dönüşümler AYNEN. */
export function buildDraftInput(i: {
  userId: string;
  address: Address;
  cartItems: CartItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totals: Pick<EkTotals, 'subtotal' | 'deliveryFee' | 'discountAmount'>;
  coupon: { code?: string | null; campaignId?: string | null } | null;
  deliveryMethod: EkDeliveryMethod;
  orderNote: string;
  scheduled: ReturnType<typeof scheduledFieldsOf>;
  cardsEnabled: boolean;
  selectedCardId: string | null;
}): EkDraftInput {
  return {
    userId: i.userId,
    address: i.address,
    cartItems: i.cartItems,
    customerName: i.customerName.trim(),
    customerEmail: i.customerEmail.trim(),
    customerPhone: i.customerPhone.trim(),
    subtotal: i.totals.subtotal,
    deliveryFee: i.totals.deliveryFee,
    discountAmount: i.totals.discountAmount,
    couponCode: i.coupon?.code || null,
    couponId: i.coupon?.campaignId || null,
    deliveryMethod: orderDeliveryMethodOf(i.deliveryMethod),
    orderNote: i.orderNote.trim() || null,
    deliveryType: i.scheduled.delivery_type,
    scheduledDate: i.scheduled.scheduled_date,
    scheduledTime: i.scheduled.scheduled_time,
    paymentMethod: i.cardsEnabled && i.selectedCardId ? 'saved_card' : 'new_card',
  };
}

// ── PaymentScreen parametreleri ───────────────────────────────────────────
export type EkPaymentRouteParams = {
  orderId: string;
  amount: number;
  orderCode?: string;
} & PaymentNavParams;

/** Kaynak: CheckoutScreen.tsx:1835-1840 (+ :560-563 paymentNavParams). */
export function paymentRouteParams(i: {
  orderId: string | number;
  amount: number;
  orderCode?: string;
  cardsEnabled: boolean;
  selectedCardId: string | null;
}): EkPaymentRouteParams {
  return {
    orderId: String(i.orderId),
    amount: i.amount,
    orderCode: i.orderCode,
    ...buildPaymentNavParams({ cardsEnabled: i.cardsEnabled, selectedCardId: i.selectedCardId }),
  };
}

// ── Ödeme sonucu → pano durumu ────────────────────────────────────────────
/**
 * FinEkCheckoutPayWait / PayFail / PayUnknown eşlemesi. Girdi: PaymentScreen'den
 * dönüldükten sonra MEVCUT `fetchPendingPaymentOrderById` ile okunan sipariş.
 *  - 'wait'    : taslak oluşturuluyor / sonuç okunuyor (Ödemen onaylanıyor)
 *  - 'fail'    : status payment_failed | payment_status failed (Ödeme alınamadı)
 *  - 'unknown' : sonuç kesin değil — hâlâ pending_payment (PaymentScreen
 *                "doğrulanıyor/kontrol ediliyor" ya da kullanıcı çıktı) veya
 *                sipariş okunamadı/onaylandı (PaymentScreen başarıyı kendisi
 *                OrderSuccess'e taşır; buraya dönüldüyse doğrulama gecikmiştir).
 */
export type EkPayState = 'idle' | 'wait' | 'fail' | 'unknown';

export function payStateFromOrder(
  order: { status: string; paymentStatus: string } | null,
): Exclude<EkPayState, 'idle' | 'wait'> {
  if (!order) return 'unknown';
  if (order.status === 'payment_failed' || order.paymentStatus === 'failed') return 'fail';
  return 'unknown';
}

/** Ödeme düğmesi bu durumda tekrar denemeye izin verir mi? (eski ekran: retry her zaman açık) */
export function payStateAllowsRetry(
  state: EkPayState,
  order: { status: string; paymentStatus: string } | null,
): boolean {
  if (state === 'wait') return false;
  if (!order) return true;
  // Onaylanmış/ödenmiş siparişte TEKRAR ödeme başlatılmaz.
  if (order.paymentStatus === 'paid') return false;
  return order.status === 'pending_payment' || order.status === 'payment_failed';
}

// ── Ücretsiz sipariş hata metinleri ───────────────────────────────────────
// Kaynak: CheckoutScreen.tsx:142-152 — AYNEN.
const FREE_ORDER_ERROR_MESSAGES: Record<string, string> = {
  coupon_invalid: 'Kupon geçersiz',
  free_requires_full_coupon: 'Bu kupon ücretsiz siparişe uygun değil',
  free_requires_targeted_coupon: 'Bu kupon ücretsiz siparişe uygun değil',
  not_your_order: 'Sipariş bulunamadı',
  wrong_status: 'Sipariş zaten işlenmiş',
};
export const resolveFreeOrderErrorMessage = (reason: unknown) =>
  FREE_ORDER_ERROR_MESSAGES[String(reason || '')] ?? 'Sipariş tamamlanamadı. Lütfen tekrar deneyin.';

/** Kaynak: CheckoutScreen.tsx:1543-1550 — şubede tükenen ürün mesajı AYNEN. */
export function closedItemsMessage(names: readonly string[]): string {
  return names.length === 1
    ? `"${names[0]}" bu adrese hizmet veren şubede tükendi. Sepetten çıkarıp tekrar deneyin.`
    : `Şu ürünler bu adrese hizmet veren şubede tükendi: ${names.join(', ')}. Sepetten çıkarıp tekrar deneyin.`;
}

/** Kaynak: CheckoutScreen.tsx:136-137. */
export const fallbackOrderCodeFromId = (orderId: string) => `#${String(orderId || '').slice(0, 8).toUpperCase()}`;
