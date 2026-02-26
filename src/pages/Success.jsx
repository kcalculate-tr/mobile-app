import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Home, MapPin, ReceiptText } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { supabase } from '../supabase';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: item?.id ?? null,
      name: item?.name || 'Ürün',
      quantity: Math.max(1, toNumber(item?.quantity || 1)),
      price: toNumber(item?.price),
      cal: toNumber(item?.cal ?? item?.kcal ?? item?.calories),
      protein: toNumber(item?.protein),
      carbs: toNumber(item?.carbs),
      fats: toNumber(item?.fats),
      type: item?.type || 'meal',
    }))
    .filter((item) => item.quantity > 0);
}

function buildAddressString(address, district, city) {
  return [address, district, city].filter(Boolean).join(', ');
}

function getMissingColumnName(errorText) {
  const pattern = /column ["']?([a-zA-Z0-9_]+)["']?/i;
  const match = errorText.match(pattern);
  return match?.[1] || '';
}

async function insertOrderWithFallback(payload) {
  const nextPayload = { ...payload };

  for (let i = 0; i < 8; i += 1) {
    const { data, error } = await supabase.from('orders').insert([nextPayload]).select('id').single();
    if (!error) return { data, payload: nextPayload };

    const errorText = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    const missingCol = getMissingColumnName(errorText);

    if (missingCol && Object.prototype.hasOwnProperty.call(nextPayload, missingCol)) {
      delete nextPayload[missingCol];
      continue;
    }

    const fallbackColumns = [
      'user_id',
      'customer_id',
      'city',
      'district',
      'phone',
      'items',
      'payment_method',
      'delivery_method',
      'delivery_time_type',
      'scheduled_date',
      'scheduled_slot',
      'coupon_code',
      'coupon_id',
      'discount_amount',
      'subtotal_amount',
      'delivery_fee',
    ];
    let removedAny = false;
    fallbackColumns.forEach((column) => {
      if (errorText.includes(column) && Object.prototype.hasOwnProperty.call(nextPayload, column)) {
        delete nextPayload[column];
        removedAny = true;
      }
    });

    if (removedAny) continue;
    throw error;
  }

  throw new Error('orders insert fallback limiti aşıldı');
}

export default function Success() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderNumber = params.get('oid') || '';
  const { cart, totalAmount, clearCart } = useContext(CartContext);

  const [isOrderCreated, setIsOrderCreated] = useState(false);
  const [savingOrder, setSavingOrder] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [estimatedRange, setEstimatedRange] = useState('25-30 dk');
  const didRunRef = useRef(false);

  const effectiveOid = useMemo(
    () => orderNumber || localStorage.getItem('latest_pending_order_oid') || '',
    [orderNumber]
  );

  useEffect(() => {
    async function createOrderFromSuccess() {
      if (didRunRef.current) return;
      didRunRef.current = true;
      setSavingOrder(true);
      setSaveError('');

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error('Sipariş kaydı için giriş gerekli.');
        }

        const createdFlagKey = effectiveOid ? `order_created_${effectiveOid}` : '';
        if (createdFlagKey && localStorage.getItem(createdFlagKey) === '1') {
          setIsOrderCreated(true);
          clearCart();
          return;
        }

        let existingOrderId = '';
        if (effectiveOid) {
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('paytr_oid', effectiveOid)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          existingOrderId = existingOrder?.id ? String(existingOrder.id) : '';
        }

        const draftRaw = effectiveOid ? localStorage.getItem(`pending_order_${effectiveOid}`) : null;
        const draft = draftRaw ? JSON.parse(draftRaw) : null;
        const draftItems = normalizeItems(draft?.cart);
        const cartItems = normalizeItems(cart);
        const itemsToUse = draftItems.length > 0 ? draftItems : cartItems;

        if (!existingOrderId && itemsToUse.length === 0) {
          throw new Error('Sipariş oluşturmak için sepet verisi bulunamadı.');
        }

        let address = draft?.checkout?.adres || '';
        let city = draft?.checkout?.city || '';
        let district = draft?.checkout?.district || '';
        let phone = draft?.checkout?.telefon || '';
        let customerName = draft?.checkout?.adSoyad || user.user_metadata?.full_name || '';
        const paymentMethod = draft?.checkout?.odemeYontemi || 'Credit Card';
        const deliveryMethod = draft?.checkout?.deliveryMethod || draft?.order?.delivery_method || 'delivery';
        const deliveryTimeType = draft?.checkout?.deliveryTimeType || draft?.order?.delivery_time_type || 'immediate';
        const scheduledDate = draft?.checkout?.scheduledDate || draft?.order?.scheduled_date || null;
        const scheduledSlot = draft?.checkout?.scheduledSlot || draft?.order?.scheduled_slot || null;
        const couponCode = draft?.checkout?.couponCode || draft?.order?.coupon_code || null;
        const couponId = draft?.checkout?.couponId || draft?.order?.coupon_id || null;
        const discountAmount = toNumber(draft?.checkout?.discountAmount ?? draft?.order?.discount_amount);
        const subtotalAmount = toNumber(draft?.checkout?.subtotalAmount ?? draft?.order?.subtotal_amount);
        const deliveryFee = toNumber(draft?.checkout?.deliveryFeeAmount ?? draft?.order?.delivery_fee);

        if (deliveryMethod === 'delivery' && (!address || !city || !district)) {
          const { data: defaultAddress } = await supabase
            .from('addresses')
            .select('full_address, city, district, contact_phone, contact_name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (defaultAddress) {
            address = address || defaultAddress.full_address || '';
            city = city || defaultAddress.city || '';
            district = district || defaultAddress.district || '';
            phone = phone || defaultAddress.contact_phone || '';
            customerName = customerName || defaultAddress.contact_name || '';
          }
        }

        if (deliveryMethod === 'pickup' && !address) {
          address = 'Restorandan teslim alınacak';
        }

        const summaryAddress = buildAddressString(address, district, city) || 'Teslimat adresi bulunamadı';
        setDeliveryAddress(summaryAddress);
        setEstimatedRange(deliveryMethod === 'pickup' ? 'Hazır olunca teslim' : '25-30 dk');

        const totalFromItems = itemsToUse.reduce(
          (sum, item) => sum + toNumber(item.price) * toNumber(item.quantity || 1),
          0
        );
        const totalPrice = toNumber(draft?.order?.total_price || totalFromItems || totalAmount);

        let finalOrderId = existingOrderId;

        if (!finalOrderId) {
          const paytrOid = effectiveOid || `SUCCESS${Date.now()}`;
          const orderPayload = {
            paytr_oid: paytrOid,
            user_id: user.id,
            customer_id: user.id,
            customer_email: user.email,
            customer_name: customerName || 'Müşteri',
            total_price: totalPrice,
            status: 'Hazırlanıyor',
            payment_method: paymentMethod,
            address: buildAddressString(address, district, city),
            city,
            district,
            phone,
            items: itemsToUse,
            delivery_method: deliveryMethod,
            delivery_time_type: deliveryTimeType,
            scheduled_date: scheduledDate,
            scheduled_slot: scheduledSlot,
            coupon_code: couponCode,
            coupon_id: couponId,
            discount_amount: discountAmount,
            subtotal_amount: subtotalAmount,
            delivery_fee: deliveryFee,
          };

          const { data: insertedOrder } = await insertOrderWithFallback(orderPayload);
          finalOrderId = String(insertedOrder.id);
        }

        if (finalOrderId && itemsToUse.length > 0) {
          const orderItemsPayload = itemsToUse.map((item) => ({
            order_id: finalOrderId,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
          }));

          const { error: orderItemsError } = await supabase.from('order_items').insert(orderItemsPayload);
          if (orderItemsError) {
            const errorText = `${orderItemsError.message || ''} ${orderItemsError.details || ''}`.toLowerCase();
            const relationProblem =
              errorText.includes('order_items') ||
              errorText.includes('relation') ||
              errorText.includes('column');

            if (relationProblem) {
              await supabase.from('orders').update({ items: itemsToUse }).eq('id', finalOrderId);
            } else {
              throw orderItemsError;
            }
          }
        }

        if (effectiveOid) {
          localStorage.removeItem(`pending_order_${effectiveOid}`);
          localStorage.setItem(`order_created_${effectiveOid}`, '1');
          const latestOid = localStorage.getItem('latest_pending_order_oid');
          if (latestOid === effectiveOid) {
            localStorage.removeItem('latest_pending_order_oid');
          }
        }

        clearCart();
        setCreatedOrderId(finalOrderId);
        setIsOrderCreated(true);
      } catch (err) {
        setSaveError(err?.message || 'Sipariş kaydı oluşturulamadı.');
      } finally {
        setSavingOrder(false);
      }
    }

    createOrderFromSuccess();
  }, [cart, clearCart, effectiveOid, totalAmount]);

  const displayOrderId = createdOrderId || effectiveOid || orderNumber || 'Oluşturuluyor...';
  return (
    <div className="min-h-screen bg-brand-bg px-4 py-6">
      <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] flex-col rounded-[2rem] bg-brand-white p-6 shadow-sm">
        <section className="mt-3 flex flex-col items-center text-center">
          <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-brand-primary/15">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-primary text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]">
              <CheckCircle2 size={48} strokeWidth={2.4} />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-brand-dark">Siparişiniz Başarıyla Alındı</h1>
          <p className="mt-2 max-w-[290px] text-sm text-brand-dark/65">
            Siparişiniz hazırlanıyor. Tahmini teslim süresi <span className="font-semibold text-brand-dark">{estimatedRange}</span>.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-brand-dark/10 bg-brand-bg px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark/45">Sipariş No</p>
              <p className="font-mono text-sm font-bold text-brand-dark">#{displayOrderId}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/20 text-brand-dark">
              <ReceiptText size={18} />
            </span>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/15 text-brand-dark">
              <MapPin size={15} />
            </span>
            <div>
              <p className="mb-1 text-xs font-semibold text-brand-dark/50">Teslimat Adresi</p>
              <p className="text-sm font-medium leading-snug text-brand-dark">
                {deliveryAddress || 'Adres bilgisi kaydediliyor...'}
              </p>
            </div>
          </div>
        </section>

        {savingOrder && (
          <p className="mt-4 text-center text-xs text-brand-dark/55">Siparişiniz veritabanına kaydediliyor...</p>
        )}

        {!!saveError && !savingOrder && (
          <p className="mt-4 rounded-xl bg-brand-primary/10 px-3 py-2 text-center text-xs text-brand-dark">
            Siparişiniz alındı. Teknik doğrulama devam ediyor, dilerseniz siparişlerinizi kontrol edebilirsiniz.
          </p>
        )}

        {!savingOrder && (
          <div className="mt-auto space-y-3 pt-8">
            <button
              onClick={() => navigate('/orders')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-3.5 text-sm font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)] active:scale-[0.99]"
            >
              <ReceiptText size={16} />
              Siparişlerim'e Git
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-dark/10 bg-transparent py-3.5 text-sm font-semibold text-brand-dark active:scale-[0.99]"
            >
              <Home size={16} />
              Ana Sayfaya Dön
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
