import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Star,
  X,
  Search,
  Home,
  Compass,
  ShoppingBag,
  ReceiptText,
  User,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../supabase';
import { CartContext } from '../context/CartContext';

function isDeliveredStatus(statusRaw) {
  const status = String(statusRaw || '').toLowerCase();
  if (!status) return false;
  if (status === 'delivered' || status === 'teslim_edildi') return true;
  if (status.includes('teslim')) return true;
  return false;
}

function isPastOrder(statusRaw) {
  const status = String(statusRaw || '').toLowerCase();
  return status === 'delivered' || status === 'cancelled' || status.includes('teslim') || status.includes('iptal');
}

function orderStatusLabel(statusRaw) {
  const status = String(statusRaw || '').toLowerCase();
  if (status === 'pending') return 'Beklemede';
  if (status === 'preparing') return 'Hazırlanıyor';
  if (status === 'on_way') return 'Yolda';
  if (status === 'delivered' || status.includes('teslim')) return 'Teslim Edildi';
  if (status === 'cancelled' || status.includes('iptal')) return 'İptal';
  return statusRaw || 'Beklemede';
}

export default function Orders() {
  const navigate = useNavigate();
  const { cart } = useContext(CartContext);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [reviewedOrderMap, setReviewedOrderMap] = useState({});
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewInfo, setReviewInfo] = useState('');

  useEffect(() => {
    async function loadOrders() {
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
        setCurrentUser(user);

        let { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          const fallback = await supabase
            .from('orders')
            .select('*')
            .eq('customer_email', user.email)
            .order('created_at', { ascending: false })
            .limit(50);

          data = fallback.data;
          error = fallback.error;
        }

        if (error) throw error;
        const nextOrders = data || [];
        setOrders(nextOrders);

        const deliveredOrderIds = nextOrders
          .filter((item) => isDeliveredStatus(item.status))
          .map((item) => item.id);

        if (deliveredOrderIds.length > 0) {
          const { data: reviewRows, error: reviewLoadError } = await supabase
            .from('reviews')
            .select('order_id')
            .eq('user_id', user.id)
            .in('order_id', deliveredOrderIds);

          if (!reviewLoadError && Array.isArray(reviewRows)) {
            const nextReviewMap = {};
            reviewRows.forEach((row) => {
              nextReviewMap[String(row.order_id)] = true;
            });
            setReviewedOrderMap(nextReviewMap);
          }
        } else {
          setReviewedOrderMap({});
        }
      } catch (err) {
        setError(err?.message || 'Siparişler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [navigate]);

  const openReviewModal = (order) => {
    setReviewOrder(order);
    setReviewRating(0);
    setReviewHover(0);
    setReviewComment('');
    setReviewError('');
    setReviewModalOpen(true);
  };

  const pushInfo = (message) => {
    setReviewInfo(message);
    setTimeout(() => {
      setReviewInfo((prev) => (prev === message ? '' : prev));
    }, 2200);
  };

  const closeReviewModal = () => {
    if (reviewSaving) return;
    setReviewModalOpen(false);
    setReviewOrder(null);
    setReviewRating(0);
    setReviewHover(0);
    setReviewComment('');
    setReviewError('');
  };

  const submitReview = async () => {
    if (!currentUser || !reviewOrder) return;
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Lütfen 1-5 arası yıldız seçin.');
      return;
    }

    const orderId = String(reviewOrder.id);
    if (reviewedOrderMap[orderId]) {
      setReviewError('Bu sipariş için zaten yorum yapılmış.');
      return;
    }

    setReviewSaving(true);
    setReviewError('');

    try {
      const { data: existingRows, error: existingError } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', reviewOrder.id)
        .eq('user_id', currentUser.id)
        .limit(1);

      if (existingError) throw existingError;

      if (Array.isArray(existingRows) && existingRows.length > 0) {
        setReviewedOrderMap((prev) => ({ ...prev, [orderId]: true }));
        setReviewInfo('Bu sipariş için daha önce değerlendirme yapmışsınız.');
        closeReviewModal();
        return;
      }

      const { error: insertError } = await supabase
        .from('reviews')
        .insert([{
          order_id: reviewOrder.id,
          user_id: currentUser.id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
          is_approved: false,
        }]);

      if (insertError) {
        if (insertError.code === '23505') {
          setReviewedOrderMap((prev) => ({ ...prev, [orderId]: true }));
          setReviewInfo('Bu sipariş için daha önce değerlendirme yapmışsınız.');
          closeReviewModal();
          return;
        }
        throw insertError;
      }

      setReviewedOrderMap((prev) => ({ ...prev, [orderId]: true }));
      setReviewInfo('Değerlendirmeniz alındı. Teşekkür ederiz.');
      closeReviewModal();
    } catch (err) {
      setReviewError(err?.message || 'Yorum kaydedilemedi.');
    } finally {
      setReviewSaving(false);
    }
  };

  const activeOrders = orders.filter((order) => !isPastOrder(order.status));
  const pastOrders = orders.filter((order) => isPastOrder(order.status));
  const visibleOrders = activeTab === 'active' ? activeOrders : pastOrders;
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    [cart]
  );

  return (
    <div className="bg-[#F0F0F0] text-brand-dark min-h-screen flex justify-center">
      <main className="w-full max-w-[430px] min-h-screen relative flex flex-col overflow-hidden pb-24">
        <header className="px-6 pb-4 pt-4 sticky top-0 bg-[#F0F0F0]/95 backdrop-blur-md z-30 border-b border-brand-white/10">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F0F0F0] border border-brand-white/10 shadow-sm"
            >
              <ChevronLeft size={18} className="text-brand-dark" />
            </button>
            <h1 className="text-xl font-bold mb-0">Siparişlerim</h1>
            <button
              onClick={() => pushInfo('Sipariş arama yakında aktif olacak.')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F0F0F0] border border-brand-white/10 shadow-sm"
              aria-label="Sipariş ara"
            >
              <Search size={16} className="text-brand-dark/60" />
            </button>
          </div>

          <div className="flex border-b border-brand-white/10">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 pb-3 text-sm transition-all ${
                activeTab === 'active'
                  ? 'font-bold text-brand-dark border-b-2 border-[#98CD00]'
                  : 'font-semibold text-brand-dark/40 border-b-2 border-transparent'
              }`}
            >
              Aktif
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 pb-3 text-sm transition-all ${
                activeTab === 'past'
                  ? 'font-bold text-brand-dark border-b-2 border-[#98CD00]'
                  : 'font-semibold text-brand-dark/40 border-b-2 border-transparent'
              }`}
            >
              Geçmiş Siparişler
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 overflow-y-auto hide-scrollbar pb-32">
          {reviewInfo && (
            <div className="mt-3 rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-3 py-2 text-xs text-brand-dark">
              {reviewInfo}
            </div>
          )}

          {loading && <p className="text-sm text-brand-dark/60 text-center py-8">Yükleniyor...</p>}

          {!loading && error && (
            <div className="rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-3 py-2 text-xs text-brand-dark">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mt-4 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-dark/40">
                  {activeTab === 'active' ? 'Canlı Teslimat' : 'Yakın Geçmiş'}
                </h2>
              </div>

              {visibleOrders.length === 0 && (
                <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-8 text-center text-sm text-brand-dark/60">
                  Bu sekmede sipariş bulunmuyor.
                </div>
              )}

              {visibleOrders.map((order) => {
                const isDelivered = isDeliveredStatus(order.status);
                const items = Array.isArray(order.items) ? order.items : [];
                const itemCount = items.reduce((sum, item) => sum + Number(item?.quantity || 1), 0) || items.length;

                return (
                  <article
                    key={order.id}
                    className="bg-[#F0F0F0] rounded-2xl p-4 mb-4 border border-brand-white/10 shadow-sm"
                  >
                    <div className="flex gap-4 mb-4">
                      <img
                        alt={order.paytr_oid || order.id}
                        className={`w-16 h-16 rounded-xl object-cover bg-brand-white ${activeTab === 'past' ? 'grayscale-[0.3]' : ''}`}
                        src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-brand-dark leading-tight truncate">
                            {order.customer_name || 'Sipariş'}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#F0F0F0] text-brand-dark uppercase tracking-tighter">
                            {orderStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-xs text-brand-dark/50 mt-1">
                          {order.created_at ? new Date(order.created_at).toLocaleString('tr-TR') : '-'} • {itemCount || 0} ürün
                        </p>
                        <p className="font-price text-sm font-semibold text-brand-dark mt-1">₺{Number(order.total_price || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    {activeTab === 'active' && (
                      <>
                        <div className="flex items-center gap-2 mb-4 px-1">
                          <div className="h-1.5 flex-1 bg-[#98CD00] rounded-full" />
                          <div className="h-1.5 flex-1 bg-[#98CD00] rounded-full" />
                          <div className="h-1.5 flex-1 bg-[#F0F0F0] rounded-full" />
                          <div className="h-1.5 flex-1 bg-[#F0F0F0] rounded-full" />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => navigate(`/order-detail/${order.id}`)}
                            className="flex-1 py-3.5 bg-[#98CD00] text-[#F0F0F0] font-bold rounded-xl text-sm"
                          >
                            Siparişi Takip Et
                          </button>
                          <button
                            onClick={() => pushInfo('Canlı destek yakında aktif olacak.')}
                            className="w-14 flex items-center justify-center rounded-xl bg-[#F0F0F0] border border-brand-white/10"
                            aria-label="Canlı destek"
                          >
                            <MessageCircle size={18} className="text-brand-dark/70" />
                          </button>
                        </div>
                      </>
                    )}

                    {activeTab === 'past' && (
                      <div className="space-y-3">
                        <button
                          onClick={() => navigate(`/order-detail/${order.id}`)}
                          className="w-full py-3 border border-brand-white/20 text-brand-dark font-bold rounded-xl text-sm hover:bg-[#F0F0F0] transition-colors"
                        >
                          Yeniden Sipariş Ver
                        </button>

                        {isDelivered && (
                          <div className="flex justify-end">
                            {reviewedOrderMap[String(order.id)] ? (
                              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F0F0F0] text-brand-dark border border-brand-white/10">
                                Değerlendirildi
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openReviewModal(order)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#98CD00] text-[#F0F0F0]"
                              >
                                Puanla & Yorum Yap
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          )}
        </div>

        <nav className="fixed bottom-4 left-4 right-4 z-50 pointer-events-none sm:bottom-6">
          <div className="mx-auto max-w-[360px] pb-[max(0px,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto rounded-[2rem] border border-brand-white/10 bg-[#F0F0F0] px-5 py-3 backdrop-blur-md shadow-[0_10px_18px_-10px_rgba(32,32,32,0.38)]">
              <div className="flex items-end justify-between">
                <button
                  onClick={() => navigate('/')}
                  aria-label="Ana Sayfa"
                  className="relative flex h-10 w-10 flex-col items-center justify-center text-brand-dark/70 transition-colors hover:text-brand-dark"
                >
                  <Home size={24} strokeWidth={2.2} />
                  <span className="mt-1 h-1 w-1 rounded-full opacity-0" />
                </button>

                <button
                  onClick={() => navigate('/offers')}
                  aria-label="Keşfet"
                  className="relative flex h-10 w-10 flex-col items-center justify-center text-brand-dark/70 transition-colors hover:text-brand-dark"
                >
                  <Compass size={24} strokeWidth={2.2} />
                  <span className="mt-1 h-1 w-1 rounded-full opacity-0" />
                </button>

                <button
                  onClick={() => navigate('/cart')}
                  aria-label="Sepet"
                  className="relative flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full bg-[#98CD00] text-[#F0F0F0] shadow-[0_10px_24px_rgba(152,205,0,0.45)] transition-transform hover:-translate-y-2.5"
                >
                  <span className="relative inline-flex items-center justify-center">
                    <ShoppingBag size={24} strokeWidth={2.5} />
                    {cartCount > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-[14px] h-[14px] px-1 rounded-full bg-brand-secondary border border-[#98CD00] text-[8px] leading-none font-bold text-brand-dark flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </span>
                </button>

                <button
                  onClick={() => navigate('/orders')}
                  aria-label="Siparişler"
                  className="relative flex h-10 w-10 flex-col items-center justify-center text-[#98CD00] transition-colors"
                >
                  <ReceiptText size={24} strokeWidth={2.2} />
                  <span className="mt-1 h-1 w-1 rounded-full bg-[#98CD00]" />
                </button>

                <button
                  onClick={() => navigate('/profile')}
                  aria-label="Profil"
                  className="relative flex h-10 w-10 flex-col items-center justify-center text-brand-dark/70 transition-colors hover:text-brand-dark"
                >
                  <User size={24} strokeWidth={2.2} />
                  <span className="mt-1 h-1 w-1 rounded-full opacity-0" />
                </button>
              </div>
            </div>
          </div>
        </nav>
      </main>

      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#F0F0F0]/45 flex items-end sm:items-center sm:justify-center p-3">
          <div className="w-full sm:max-w-md bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-brand-dark mb-0">Siparişi Değerlendir</h2>
              <button
                type="button"
                onClick={closeReviewModal}
                className="w-8 h-8 rounded-full bg-[#F0F0F0] inline-flex items-center justify-center text-brand-dark/70"
                disabled={reviewSaving}
              >
                <X size={14} />
              </button>
            </div>

            <p className="mt-1 text-xs text-brand-dark/60">
              Sipariş No: {reviewOrder?.paytr_oid || reviewOrder?.id || '-'}
            </p>

            <div className="mt-4">
              <p className="text-xs font-semibold text-brand-dark/70 mb-0">Puanınız</p>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const activeValue = reviewHover || reviewRating;
                  const isActive = star <= activeValue;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setReviewHover(star)}
                      onMouseLeave={() => setReviewHover(0)}
                      onClick={() => setReviewRating(star)}
                      className="p-1.5 rounded-lg hover:bg-[#F0F0F0] transition-colors"
                    >
                      <Star
                        size={24}
                        className={isActive ? 'text-[#98CD00] fill-[#98CD00]' : 'text-brand-dark/20'}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-brand-dark/70 mb-0">Yorumunuz</p>
              <textarea
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Deneyiminizi paylaşın..."
                className="mt-2 w-full resize-none rounded-xl border border-brand-white/10 px-3 py-2 text-sm outline-none focus:border-brand-white"
                disabled={reviewSaving}
              />
            </div>

            {reviewError && (
              <div className="mt-3 bg-[#F0F0F0] border border-brand-white/10 rounded-lg px-2.5 py-2 text-xs text-brand-dark">
                {reviewError}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeReviewModal}
                className="flex-1 py-2.5 rounded-xl border border-brand-white/10 text-sm font-semibold text-brand-dark/70"
                disabled={reviewSaving}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={reviewSaving}
                className="flex-1 py-2.5 rounded-xl bg-[#98CD00] text-[#F0F0F0] text-sm font-bold inline-flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {reviewSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {reviewSaving ? 'Kaydediliyor...' : 'Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
