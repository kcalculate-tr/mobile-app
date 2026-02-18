import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Clock3, RotateCcw } from 'lucide-react';
import { supabase } from '../supabase';
import { CartContext } from '../context/CartContext';

const RESTAURANT_FALLBACK_ADDRESS = 'Moda Caddesi No:45, Kadıköy / İstanbul';

const STATUS_STEPS = [
  { key: 'received', label: 'Alındı' },
  { key: 'preparing', label: 'Hazırlanıyor' },
  { key: 'on_way', label: 'Yolda' },
  { key: 'delivered', label: 'Teslim Edildi' },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(statusRaw) {
  const status = String(statusRaw || '').toLowerCase();
  if (!status) return 'preparing';
  if (status === 'pending' || status === 'beklemede' || status === 'alindi') return 'preparing';
  if (status === 'preparing' || status === 'hazirlaniyor') return 'preparing';
  if (status === 'on_way' || status === 'yola_cikti') return 'on_way';
  if (status === 'delivered' || status === 'teslim_edildi') return 'delivered';
  if (status.includes('hazır') || status.includes('hazir')) return 'preparing';
  if (status.includes('yol')) return 'on_way';
  if (status.includes('teslim')) return 'delivered';
  return 'received';
}

function buildStepIndex(normalizedStatus) {
  if (normalizedStatus === 'delivered') return 3;
  if (normalizedStatus === 'on_way') return 2;
  if (normalizedStatus === 'preparing') return 1;
  return 0;
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTimeType(order) {
  const deliveryMethod = order?.delivery_method;
  if (deliveryMethod === 'pickup') return 'Gel-Al';

  const timeType = order?.delivery_time_type;
  if (timeType === 'scheduled') {
    const dateLabel = formatDate(order?.scheduled_date);
    const slot = order?.scheduled_slot || 'Saat seçilmedi';
    return `Randevulu: ${dateLabel} · ${slot}`;
  }
  return 'Hemen teslimat (30-45 dk)';
}

function normalizeItems(itemsRaw) {
  if (!Array.isArray(itemsRaw)) return [];
  return itemsRaw.map((item, index) => ({
    id: item?.id ?? `i-${index}`,
    productId: item?.id ?? null,
    name: item?.name || item?.title || 'Ürün',
    quantity: Math.max(1, toNumber(item?.quantity || 1)),
    price: toNumber(item?.price || item?.unit_price || 0),
    image: item?.img || item?.image || null,
    description: item?.desc || item?.description || '',
  }));
}

export default function OrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { clearCart, addToCart } = useContext(CartContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          navigate('/login');
          return;
        }

        const attempts = [
          { column: 'customer_id', value: user.id },
          { column: 'user_id', value: user.id },
          { column: 'customer_email', value: user.email },
        ].filter((x) => x.value);

        let foundOrder = null;

        // First try by id only (RLS may already scope by current user)
        const byIdOnly = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
        if (!byIdOnly.error && byIdOnly.data) {
          foundOrder = byIdOnly.data;
        }

        if (!foundOrder) {
          for (const attempt of attempts) {
            const res = await supabase
              .from('orders')
              .select('*')
              .eq('id', id)
              .eq(attempt.column, attempt.value)
              .maybeSingle();

            if (!res.error && res.data) {
              foundOrder = res.data;
              break;
            }
          }
        }

        if (!foundOrder) {
          throw new Error('Sipariş bulunamadı.');
        }

        setOrder(foundOrder);

        const parsedItems = normalizeItems(foundOrder.items);
        if (parsedItems.length > 0) {
          setOrderItems(parsedItems);
          return;
        }

        const relationItems = await supabase
          .from('order_items')
          .select('product_id, quantity, unit_price, products(name,img,desc)')
          .eq('order_id', foundOrder.id);

        if (!relationItems.error && Array.isArray(relationItems.data) && relationItems.data.length > 0) {
          const rows = relationItems.data.map((item, index) => ({
            id: `oi-${index}`,
            productId: item.product_id,
            name: item?.products?.name || item?.products?.title || 'Ürün',
            quantity: Math.max(1, toNumber(item?.quantity || 1)),
            price: toNumber(item?.unit_price || 0),
            image: item?.products?.img || item?.products?.image || null,
            description: item?.products?.desc || item?.products?.description || '',
          }));
          setOrderItems(rows);
        } else {
          setOrderItems([]);
        }
      } catch (err) {
        setError(err?.message || 'Sipariş detayı alınamadı.');
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchOrder();
  }, [id, navigate]);

  const normalizedStatus = normalizeStatus(order?.status);
  const activeStepIndex = buildStepIndex(normalizedStatus);

  const subtotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [orderItems]
  );
  const total = toNumber(order?.total_price || subtotal);
  const deliveryFee = Math.max(0, total - subtotal);
  const discount = Math.max(0, subtotal + deliveryFee - total);

  const deliveryMethod = order?.delivery_method || 'delivery';
  const isPickup = deliveryMethod === 'pickup';
  const addressText = order?.address || RESTAURANT_FALLBACK_ADDRESS;
  const mapQuery = encodeURIComponent(addressText);
  const noteText = order?.customer_note || order?.note || order?.order_note || '';

  const handleReorder = () => {
    if (orderItems.length === 0) {
      setError('Bu siparişte tekrar sepete eklenecek ürün bulunamadı.');
      return;
    }

    clearCart();
    orderItems.forEach((item) => {
      const payload = {
        id: item.productId || item.id,
        name: item.name,
        price: item.price,
        img: item.image,
        image: item.image,
        desc: item.description,
      };
      addToCart(payload, item.quantity);
    });

    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-36 text-brand-dark">
      <header className="sticky top-0 z-40 bg-[#F0F0F0]/95 backdrop-blur-md px-4 py-3 border-b border-brand-white/10 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-brand-dark font-bold flex items-center gap-1"
          >
            <ChevronLeft size={18} />
            Geri
          </button>
          <h1 className="text-lg font-bold text-brand-dark">Sipariş Detayı</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {loading && (
          <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-6 text-center text-sm text-brand-dark/60">
            Yükleniyor...
          </div>
        )}

        {!loading && error && (
          <div className="bg-brand-secondary/10 border border-brand-secondary/40 rounded-xl px-3 py-2 text-xs text-brand-dark">
            {error}
          </div>
        )}

        {!loading && !error && order && (
          <>
            <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-4">
              <p className="text-xs text-brand-dark/60">Sipariş No</p>
              <p className="text-base font-bold text-brand-dark mt-0.5">#{order.paytr_oid || order.id}</p>

              <div className="mt-4">
                <div className="flex items-center gap-1">
                  {STATUS_STEPS.map((step, index) => {
                    const reached = index <= activeStepIndex;
                    const isActive = index === activeStepIndex;
                    return (
                      <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center min-w-0 flex-1">
                          <span
                            className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center ${
                              reached
                                ? isActive
                                  ? 'bg-[#F0F0F0] text-[#98CD00]'
                                  : 'bg-[#98CD00]/30 text-brand-dark'
                                : 'bg-[#F0F0F0] text-brand-dark/40'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className={`mt-1 text-[10px] text-center ${reached ? 'text-brand-dark font-semibold' : 'text-brand-dark/40'}`}>
                            {step.label}
                          </span>
                        </div>
                        {index < STATUS_STEPS.length - 1 && (
                          <div className={`h-1 flex-1 rounded-full ${index < activeStepIndex ? 'bg-[#F0F0F0]' : 'bg-[#F0F0F0]'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-4">
              <h2 className="text-sm font-bold text-brand-dark">Teslimat Bilgisi</h2>
              <p className="text-xs text-brand-dark/60 mt-2 inline-flex items-center gap-1">
                <Clock3 size={13} /> {formatTimeType(order)}
              </p>

              <div className="mt-2">
                <p className="text-xs font-semibold text-brand-dark">
                  {isPickup ? 'Gel-Al Noktası' : 'Teslimat Adresi'}
                </p>
                <p className="text-xs text-brand-dark/60 mt-1">{addressText}</p>
              </div>

              <div className="mt-3 rounded-xl overflow-hidden border border-brand-white/10">
                <iframe
                  title="Harita"
                  src={`https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`}
                  className="w-full h-36"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              {noteText && (
                <div className="mt-3 rounded-xl border border-[#98CD00]/40 bg-[#F0F0F0] p-3">
                  <p className="text-xs font-semibold text-[#98CD00]">Sipariş Notu</p>
                  <p className="text-xs text-[#98CD00] mt-1">{noteText}</p>
                </div>
              )}
            </div>

            <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-4">
              <h2 className="text-sm font-bold text-brand-dark">Ürünler</h2>
              <div className="mt-3 space-y-2">
                {orderItems.length === 0 ? (
                  <p className="text-xs text-brand-dark/60">Ürün detayı bulunamadı.</p>
                ) : (
                  orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-brand-dark">{item.quantity} x {item.name}</p>
                        <p className="text-xs text-brand-dark/60"><span className="font-price font-semibold">₺{item.price.toFixed(2)}</span> / adet</p>
                      </div>
                      <p className="font-price font-semibold text-brand-dark">₺{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-brand-white/10 space-y-1.5 text-sm">
                <div className="flex justify-between text-brand-dark/70">
                  <span>Ara Toplam</span>
                  <span className="font-price font-semibold">₺{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-brand-dark/70">
                  <span>Teslimat Ücreti</span>
                  <span className={deliveryFee > 0 ? 'font-price font-semibold' : ''}>{deliveryFee > 0 ? `₺${deliveryFee.toFixed(2)}` : 'Ücretsiz'}</span>
                </div>
                <div className="flex justify-between text-brand-dark/70">
                  <span>İndirim</span>
                  <span className="font-price font-semibold">{discount > 0 ? `-₺${discount.toFixed(2)}` : '₺0.00'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-brand-white/10 text-base font-bold text-brand-dark">
                  <span>Genel Toplam</span>
                  <span className="font-price font-semibold">₺{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

          </>
        )}
      </div>

      {!loading && !error && order && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="mx-auto w-full max-w-lg rounded-t-3xl border-t border-brand-white/10 bg-[#F0F0F0]/95 px-4 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
            <button
              onClick={handleReorder}
              className="w-full border border-brand-white bg-[#98CD00] text-[#F0F0F0] font-bold rounded-2xl py-3.5 inline-flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <RotateCcw size={16} />
              Bu Siparişi Tekrarla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
