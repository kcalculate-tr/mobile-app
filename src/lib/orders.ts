import type { SupabaseClient } from '@supabase/supabase-js';
import { Address, CartItem } from '../types';
import { formatSupabaseErrorForDevLog } from './supabaseErrors';
import { getSupabaseClient } from './supabase';

export type OrderCreateWarning = {
  code: 'ORDER_ITEMS_FALLBACK';
  message: string;
};

export type PendingPaymentOrder = {
  id: string;
  orderCode: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  updatedAt: string;
};

type OrderInsertResult = {
  data: { id: string | number; order_code?: string | null };
  payload: Record<string, unknown>;
  droppedColumns: string[];
};

const getMissingColumnName = (errorText: string) => {
  const pattern = /column ["']?([a-zA-Z0-9_]+)["']?/i;
  const match = String(errorText || '').match(pattern);
  return match?.[1] || '';
};

const createOrderCode = () => {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  const digits = String(Math.floor(100 + Math.random() * 900))
  return `KCAL-${letter}${digits}`
}

const toSafeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const insertOrderWithFallback = async (
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<OrderInsertResult> => {
  const workingPayload = { ...payload };
  const droppedColumns = new Set<string>();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from('orders')
      .insert([workingPayload])
      .select('id,order_code')
      .single();

    if (!error && data) {
      return {
        data: data as { id: string | number; order_code?: string | null },
        payload: workingPayload,
        droppedColumns: Array.from(droppedColumns),
      };
    }

    const errorText = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    const missingColumn = getMissingColumnName(errorText);

    if (
      missingColumn &&
      Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)
    ) {
      delete workingPayload[missingColumn];
      droppedColumns.add(missingColumn);
      continue;
    }

    const removableColumns = [
      'customer_id',
      'user_id',
      'city',
      'district',
      'phone',
      'items',
      'total_price',
      'total_amount',
      'subtotal_amount',
      'delivery_fee',
      'discount_amount',
      'delivery_method',
      'coupon_code',
      'coupon_id',
      'payment_status',
      'payment_provider',
      'order_code',
      'order_note',
      'delivery_type',
      'scheduled_date',
      'scheduled_time',
    ];

    const matchedColumns: string[] = [];
    removableColumns.forEach((column) => {
      if (
        errorText.includes(column) &&
        Object.prototype.hasOwnProperty.call(workingPayload, column)
      ) {
        matchedColumns.push(column);
      }
    });

    if (matchedColumns.length > 0) {
      matchedColumns.forEach((column) => {
        delete workingPayload[column];
        droppedColumns.add(column);
      });
      continue;
    }

    throw error;
  }

  throw new Error('orders insert fallback limiti aşıldı');
};

const isOrderItemsRelationIssue = (error: unknown) => {
  const text = `${(error as { message?: string })?.message || ''} ${(error as { details?: string })?.details || ''}`.toLowerCase();
  return (
    text.includes('order_items') ||
    text.includes('relation') ||
    text.includes('column')
  );
};

export const createOrderFromCart = async ({
  supabase,
  userId,
  address,
  cartItems,
  customerName,
  customerEmail,
  customerPhone,
  subtotal,
  deliveryFee,
  discountAmount,
  couponCode,
  couponId,
  deliveryMethod = 'delivery',
  orderNote,
  deliveryType,
  scheduledDate,
  scheduledTime,
}: {
  supabase: SupabaseClient;
  userId: string;
  address: Address;
  cartItems: CartItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode?: string | null;
  couponId?: string | number | null;
  deliveryMethod?: 'delivery' | 'pickup';
  orderNote?: string | null;
  deliveryType?: 'immediate' | 'scheduled' | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
}) => {
  if (!cartItems.length) {
    throw new Error('Sepet boş.');
  }

  const orderCode = createOrderCode();
  const safeSubtotal = Number(Math.max(0, subtotal).toFixed(2));
  const safeDeliveryFee = Number(Math.max(0, deliveryFee).toFixed(2));
  const safeDiscount = Number(Math.max(0, discountAmount).toFixed(2));
  const totalAmount = Number(Math.max(0, safeSubtotal + safeDeliveryFee - safeDiscount).toFixed(2));

  const itemsPayload = cartItems.map((item) => ({
    line_key: item.lineKey,
    id: item.productId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: Number((item.unitPrice * item.quantity).toFixed(2)),
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fats: item.fats,
    selected_options: item.selectedOptions,
  }));

  const orderPayload: Record<string, unknown> = {
    status: 'pending',
    payment_status: 'pending',
    customer_name: customerName,
    customer_email: customerEmail,
    address: address.full_address,
    city: address.city || 'İzmir',
    district: address.district,
    phone: customerPhone,
    items: itemsPayload,
    user_id: userId,
    total_amount: totalAmount,
    subtotal_amount: safeSubtotal,
    delivery_fee: safeDeliveryFee,
    discount_amount: safeDiscount,
    total_price: totalAmount,
    order_code: orderCode,
    delivery_method: deliveryMethod,
    coupon_code: couponCode || null,
    coupon_id: couponId || null,
    order_note: orderNote || null,
    delivery_type: deliveryType || 'immediate',
    scheduled_date: scheduledDate || null,
    scheduled_time: scheduledTime || null,
  };

  const { data: insertedOrder, droppedColumns } = await insertOrderWithFallback(
    supabase,
    orderPayload,
  );

  if (__DEV__ && droppedColumns.length > 0) {
    console.warn(
      `[orders] insert fallback applied, dropped columns: ${droppedColumns.join(', ')}`,
    );
  }

  const finalOrderId = String(insertedOrder.id);
  const warnings: OrderCreateWarning[] = [];

  const orderItemsPayload = cartItems.map((item) => ({
    order_id: finalOrderId,
    product_id: Number(item.productId),
    quantity: item.quantity,
    unit_price: Number(item.unitPrice.toFixed(2)),
    total_price: Number((item.unitPrice * item.quantity).toFixed(2)),
    product_name: item.name,
  }));

  if (orderItemsPayload.length > 0) {
    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (orderItemsError) {
      if (isOrderItemsRelationIssue(orderItemsError)) {
        if (__DEV__) {
          console.warn(
            `[orders] order_items insert fallback: ${formatSupabaseErrorForDevLog(orderItemsError)}`,
          );
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({ items: itemsPayload })
          .eq('id', finalOrderId);
        if (updateError) {
          throw updateError;
        }

        warnings.push({
          code: 'ORDER_ITEMS_FALLBACK',
          message:
            'Sipariş oluşturuldu ancak ürün detayları kaydedilemedi. Destek ekibimiz bilgilendirildi.',
        });
      } else {
        throw orderItemsError;
      }
    }
  }

  return {
    orderId: finalOrderId,
    orderCode: String(insertedOrder.order_code || orderCode),
    totalAmount,
    warnings,
  };
};

export const createOrderDraftForPayment = async ({
  supabase,
  userId,
  address,
  cartItems,
  customerName,
  customerEmail,
  customerPhone,
  subtotal,
  deliveryFee,
  discountAmount,
  couponCode,
  couponId,
  deliveryMethod = 'delivery',
  orderNote,
  deliveryType,
  scheduledDate,
  scheduledTime,
}: {
  supabase: SupabaseClient;
  userId: string;
  address: Address;
  cartItems: CartItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode?: string | null;
  couponId?: string | number | null;
  deliveryMethod?: 'delivery' | 'pickup';
  orderNote?: string | null;
  deliveryType?: 'immediate' | 'scheduled' | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
}) => {
  if (!cartItems.length) {
    throw new Error('Sepet boş.');
  }

  const orderCode = createOrderCode();
  const safeSubtotal = Number(Math.max(0, subtotal).toFixed(2));
  const safeDeliveryFee = Number(Math.max(0, deliveryFee).toFixed(2));
  const safeDiscount = Number(Math.max(0, discountAmount).toFixed(2));
  const totalAmount = Number(
    Math.max(0, safeSubtotal + safeDeliveryFee - safeDiscount).toFixed(2),
  );

  const itemsPayload = cartItems.map((item) => ({
    line_key: item.lineKey,
    id: item.productId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: Number((item.unitPrice * item.quantity).toFixed(2)),
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fats: item.fats,
    selected_options: item.selectedOptions,
  }));

  const orderPayload: Record<string, unknown> = {
    status: 'pending_payment',
    payment_status: 'pending',
    customer_name: customerName,
    customer_email: customerEmail,
    address: address.full_address,
    city: address.city || 'İzmir',
    district: address.district,
    phone: customerPhone,
    items: itemsPayload,
    user_id: userId,
    total_amount: totalAmount,
    subtotal_amount: safeSubtotal,
    delivery_fee: safeDeliveryFee,
    discount_amount: safeDiscount,
    total_price: totalAmount,
    order_code: orderCode,
    delivery_method: deliveryMethod,
    coupon_code: couponCode || null,
    coupon_id: couponId || null,
    order_note: orderNote || null,
    delivery_type: deliveryType || 'immediate',
    scheduled_date: scheduledDate || null,
    scheduled_time: scheduledTime || null,
  };

  const { data: insertedOrder, droppedColumns } = await insertOrderWithFallback(
    supabase,
    orderPayload,
  );
  if (__DEV__ && droppedColumns.length > 0) {
    console.warn(
      `[orders] draft insert fallback applied, dropped columns: ${droppedColumns.join(', ')}`,
    );
  }

  const finalOrderId = String(insertedOrder.id);
  const warnings: OrderCreateWarning[] = [];

  const orderItemsPayload = cartItems.map((item) => ({
    order_id: finalOrderId,
    product_id: Number(item.productId),
    quantity: item.quantity,
    unit_price: Number(item.unitPrice.toFixed(2)),
    total_price: Number((item.unitPrice * item.quantity).toFixed(2)),
    product_name: item.name,
  }));

  if (orderItemsPayload.length > 0) {
    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (orderItemsError) {
      if (isOrderItemsRelationIssue(orderItemsError)) {
        if (__DEV__) {
          console.warn(
            `[orders] payment draft order_items fallback: ${formatSupabaseErrorForDevLog(orderItemsError)}`,
          );
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({ items: itemsPayload })
          .eq('id', finalOrderId);
        if (updateError) {
          throw updateError;
        }

        warnings.push({
          code: 'ORDER_ITEMS_FALLBACK',
          message:
            'Sipariş taslağı oluşturuldu ancak ürün detayları kaydedilemedi. Destek ekibimiz bilgilendirildi.',
        });
      } else {
        throw orderItemsError;
      }
    }
  }

  return {
    orderId: finalOrderId,
    orderCode: String(insertedOrder.order_code || orderCode),
    totalAmount,
    warnings,
  };
};

export const updateOrderPaymentStatus = async ({
  supabase,
  orderId,
  userId,
  status,
  paymentStatus,
  paymentErrorMessage,
}: {
  supabase: SupabaseClient;
  orderId: string;
  userId: string;
  status: 'pending_payment' | 'paid' | 'payment_failed';
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentErrorMessage?: string | null;
}) => {
  const payload: Record<string, unknown> = {
    status,
    payment_status: paymentStatus,
    payment_error_message: paymentErrorMessage || null,
  };
  const workingPayload = { ...payload };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabase
      .from('orders')
      .update(workingPayload)
      .eq('id', orderId)
      .eq('user_id', userId);

    if (!error) return;

    const errorText = `${error.message || ''} ${error.details || ''}`;
    const missingColumn = getMissingColumnName(errorText);
    if (
      missingColumn &&
      Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)
    ) {
      delete workingPayload[missingColumn];
      continue;
    }

    throw error;
  }

  throw new Error('Sipariş ödeme durumu güncellenemedi.');
};

const mapOrderSummary = (row: Record<string, unknown>): PendingPaymentOrder => ({
  id: String(row.id ?? '').trim(),
  orderCode:
    String(row.order_code ?? '').trim() ||
    `#${String(row.id ?? '').trim().slice(0, 8).toUpperCase()}`,
  totalAmount: Number(
    Math.max(0, toSafeNumber(row.total_amount) || toSafeNumber(row.total_price)).toFixed(2),
  ),
  status: String(row.status ?? '').trim(),
  paymentStatus: String(row.payment_status ?? '').trim(),
  updatedAt:
    String(row.updated_at ?? '').trim() ||
    String(row.created_at ?? '').trim() ||
    '',
});

export const fetchPendingPaymentOrderById = async ({
  supabase,
  userId,
  orderId,
}: {
  supabase: SupabaseClient;
  userId: string;
  orderId: string;
}) => {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id,order_code,total_amount,total_price,status,payment_status,updated_at,created_at',
    )
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapOrderSummary(data as Record<string, unknown>);
};

export const fetchLatestPendingPaymentOrder = async ({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) => {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id,order_code,total_amount,total_price,status,payment_status,updated_at,created_at',
    )
    .eq('user_id', userId)
    .or('status.eq.pending_payment,status.eq.payment_failed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapOrderSummary(data as Record<string, unknown>);
};

// ─────────────────────────────────────────────────────────────────────────────
// Order modification requests (customer-initiated cancel / date / address)
// ─────────────────────────────────────────────────────────────────────────────

export type OrderModificationType = 'cancel' | 'date_change' | 'address_change';
export type OrderModificationStatus = 'pending' | 'approved' | 'rejected';

export type OrderModification = {
  id: string;
  order_id: string;
  user_id: string;
  type: OrderModificationType;
  status: OrderModificationStatus;
  old_scheduled_date: string | null;
  new_scheduled_date: string | null;
  old_scheduled_time: string | null;
  new_scheduled_time: string | null;
  old_address_id: string | null;
  new_address_id: string | null;
  new_address_text: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
};

const normalizeModification = (row: Record<string, unknown>): OrderModification => ({
  id: String(row.id ?? ''),
  order_id: String(row.order_id ?? ''),
  user_id: String(row.user_id ?? ''),
  type: (String(row.type ?? 'cancel') as OrderModificationType),
  status: (String(row.status ?? 'pending') as OrderModificationStatus),
  old_scheduled_date: row.old_scheduled_date ? String(row.old_scheduled_date) : null,
  new_scheduled_date: row.new_scheduled_date ? String(row.new_scheduled_date) : null,
  old_scheduled_time: row.old_scheduled_time ? String(row.old_scheduled_time) : null,
  new_scheduled_time: row.new_scheduled_time ? String(row.new_scheduled_time) : null,
  old_address_id: row.old_address_id ? String(row.old_address_id) : null,
  new_address_id: row.new_address_id ? String(row.new_address_id) : null,
  new_address_text: row.new_address_text ? String(row.new_address_text) : null,
  reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
  reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
  reject_reason: row.reject_reason ? String(row.reject_reason) : null,
  customer_note: row.customer_note ? String(row.customer_note) : null,
  created_at: String(row.created_at ?? ''),
  updated_at: String(row.updated_at ?? ''),
});

export async function createOrderModification(data: {
  orderId: string | number;
  type: OrderModificationType;
  newScheduledDate?: string;
  newScheduledTime?: string;
  newAddressId?: string;
  newAddressText?: string;
  customerNote?: string;
}): Promise<OrderModification> {
  const supabase = getSupabaseClient();

  const { data: userResp, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userResp?.user?.id;
  if (!userId) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
  }

  // Snapshot old values from the order
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('scheduled_date, scheduled_time, address_id')
    .eq('id', data.orderId)
    .maybeSingle();
  if (orderError) throw orderError;

  const old = (orderRow ?? {}) as Record<string, unknown>;

  const payload: Record<string, unknown> = {
    order_id: data.orderId,
    user_id: userId,
    type: data.type,
    status: 'pending',
    old_scheduled_date: old.scheduled_date ?? null,
    old_scheduled_time: old.scheduled_time ? String(old.scheduled_time) : null,
    old_address_id: old.address_id ?? null,
    new_scheduled_date: data.newScheduledDate ?? null,
    new_scheduled_time: data.newScheduledTime ?? null,
    new_address_id: data.newAddressId ?? null,
    new_address_text: data.newAddressText ?? null,
    customer_note: data.customerNote ?? null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('order_modifications')
    .insert([payload])
    .select('*')
    .single();

  if (insertError) throw insertError;
  return normalizeModification(inserted as Record<string, unknown>);
}

export async function getOrderModifications(
  orderId: string | number,
): Promise<OrderModification[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('order_modifications')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) =>
    normalizeModification(row as Record<string, unknown>),
  );
}

export async function getPendingModificationsForUser(
  userId: string,
): Promise<OrderModification[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('order_modifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) =>
    normalizeModification(row as Record<string, unknown>),
  );
}
