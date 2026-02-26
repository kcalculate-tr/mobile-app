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
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../supabase';
import { CartContext } from '../context/CartContext';
import SkeletonCard from '../components/SkeletonCard';

const ORDER_LIST_VARIANTS = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

const ORDER_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
};

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
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          const byCustomerId = await supabase
            .from('orders')
            .select('*')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!byCustomerId.error) {
            data = byCustomerId.data;
            error = null;
          } else {
            const fallback = await supabase
              .from('orders')
              .select('*')
              .eq('customer_email', user.email)
              .order('created_at', { ascending: false })
              .limit(50);

            data = fallback.data;
            error = fallback.error;
          }
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
        <header className="app-page-padding sticky top-0 z-30 border-b border-brand-white/10 bg-[#F0F0F0]/95 pb-4 pt-4 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F0F0F0] border border-brand-white/10 shadow-sm"
            >
              <ChevronLeft size={18} className="text-brand-dark" />
            </button>
            <h1 className="app-heading-primary mb-0">Siparişlerim</h1>
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

        <div className="app-page-padding hide-scrollbar flex-1 overflow-y-auto pb-32">
          <AnimatePresence>
            {reviewInfo && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26, mass: 0.45 }}
                className="mt-3 rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-3 py-2 text-xs text-brand-dark"
              >
                {reviewInfo}
              </motion.div>
            )}
          </AnimatePresence>

          {loading && (
            <div className="space-y-3 py-3">
              <SkeletonCard variant="order" count={3} />
            </div>
          )}

          {!loading && error && (
            <div className="app-card mt-4 p-4 text-sm text-gray-600">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mb-3 mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {activeTab === 'active' ? 'Canlı Teslimat' : 'Yakın Geçmiş'}
                </p>
              </div>

              {visibleOrders.length === 0 && (
                <div className="app-card p-8 text-center">
                  <p className="app-text-muted mb-0">
                    Henüz hiç siparişiniz bulunmuyor. Lezzetli öğünlerimizi keşfetmek için menüye göz atın.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="app-btn-green mt-5"
                  >
                    Menüye Git
                  </button>
                </div>
              )}

              <motion.div variants={ORDER_LIST_VARIANTS} initial="hidden" animate="visible">
              {visibleOrders.map((order) => {
                const isDelivered = isDeliveredStatus(order.status);
                const items = Array.isArray(order.items) ? order.items : [];
                const itemCount = items.reduce((sum, item) => sum + Number(item?.quantity || 1), 0) || items.length;
                const statusLabel = orderStatusLabel(order.status);

                return (
                  <motion.article
                    key={order.id}
                    variants={ORDER_ITEM_VARIANTS}
                    className="app-card mb-3 space-y-4"
                  >
                    <div className="flex gap-3">
                      <img
                        alt={order.paytr_oid || order.id}
                        className={`h-16 w-16 shrink-0 rounded-2xl object-cover ${activeTab === 'past' ? 'grayscale-[0.4]' : ''}`}
                        src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-sm font-bold text-gray-900">
                            {order.customer_name || 'Sipariş'}
                          </h3>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide
                            ${isDelivered
                              ? 'bg-green-50 text-green-700'
                              : order.status === 'on_way'
                                ? 'bg-blue-50 text-blue-700'
                                : order.status === 'preparing'
                                  ? 'bg-amber-50 text-amber-700'
                                  : order.status === 'cancelled' || String(order.status).includes('iptal')
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                          {order.created_at ? new Date(order.created_at).toLocaleString('tr-TR') : '-'} • {itemCount || 0} ürün
                        </p>
                        <p className="font-price mt-1 text-base font-bold text-gray-900">
                          ₺{Number(order.total_amount ?? order.total_price ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {activeTab === 'active' && (
                      <>
                        <div className="flex items-center gap-1.5 px-0.5">
                          <div className="h-1.5 flex-1 rounded-full bg-[#98CD00]" />
                          <div className="h-1.5 flex-1 rounded-full bg-[#98CD00]" />
                          <div className="h-1.5 flex-1 rounded-full bg-gray-100" />
                          <div className="h-1.5 flex-1 rounded-full bg-gray-100" />
                        </div>
                        <div className="flex gap-2">
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate(`/order-detail/${order.id}`)}
                            className="app-btn-green flex-1 py-3 text-sm"
                          >
                            Siparişi Takip Et
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => pushInfo('Canlı destek yakında aktif olacak.')}
                            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50"
                            aria-label="Canlı destek"
                          >
                            <MessageCircle size={18} className="text-gray-500" />
                          </motion.button>
                        </div>
                      </>
                    )}

                    {activeTab === 'past' && (
                      <div className="space-y-2">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => navigate(`/order-detail/${order.id}`)}
                          className="app-btn-outline py-3 text-sm"
                        >
                          Yeniden Sipariş Ver
                        </motion.button>

                        {isDelivered && (
                          <div className="flex justify-end">
                            {reviewedOrderMap[String(order.id)] ? (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
                                ✓ Değerlendirildi
                              </span>
                            ) : (
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openReviewModal(order)}
                                className="app-btn-green-sm"
                              >
                                Puanla &amp; Yorum Yap
                              </motion.button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.article>
                );
              })}
              </motion.div>
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

      <AnimatePresence>
      {reviewModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
        >
          <motion.div
            initial={{ y: 28, opacity: 0.96, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 22, opacity: 0.92, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28, mass: 0.6 }}
            className="app-card w-full space-y-4 sm:max-w-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Siparişi Değerlendir</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  Sipariş No: {reviewOrder?.paytr_oid || reviewOrder?.id || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                disabled={reviewSaving}
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">Puanınız</p>
              <div className="flex items-center gap-1">
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
                      className="rounded-xl p-1.5 transition-colors hover:bg-gray-50"
                    >
                      <Star
                        size={26}
                        className={isActive ? 'fill-[#98CD00] text-[#98CD00]' : 'text-gray-200'}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">Yorumunuz</p>
              <textarea
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Deneyiminizi paylaşın..."
                className="app-input resize-none"
                disabled={reviewSaving}
              />
            </div>

            {reviewError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                {reviewError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeReviewModal}
                className="app-btn-outline flex-none w-auto px-5 py-3 text-sm"
                disabled={reviewSaving}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={reviewSaving}
                className="app-btn-green flex-1 py-3 text-sm disabled:opacity-60"
              >
                {reviewSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {reviewSaving ? 'Kaydediliyor...' : 'Gönder'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
