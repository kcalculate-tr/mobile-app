import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock3, Copy, Loader2, TicketPercent } from 'lucide-react';
import { supabase } from '../../supabase';

const WELCOME_COUPON = {
  id: 'welcome-150',
  title: 'Hoş Geldin İndirimi',
  code: 'HOSGELDIN150',
  value: '₺150',
  valueLabel: 'İndirim',
  detail: 'KCAL ailesine katıldığınız için teşekkürler! İlk siparişinizde geçerlidir.',
  expiryText: 'İlk siparişte geçerli',
};

export default function Coupons() {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isFirstOrderEligible, setIsFirstOrderEligible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadEligibility() {
      setLoading(true);
      setPromoError('');
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          navigate('/login');
          return;
        }

        let hasOrder = false;
        const byUserId = await supabase
          .from('orders')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (!byUserId.error) {
          hasOrder = Array.isArray(byUserId.data) && byUserId.data.length > 0;
        } else {
          const byCustomerId = await supabase
            .from('orders')
            .select('id')
            .eq('customer_id', user.id)
            .limit(1);

          if (!byCustomerId.error) {
            hasOrder = Array.isArray(byCustomerId.data) && byCustomerId.data.length > 0;
          } else {
            const byEmail = await supabase
              .from('orders')
              .select('id')
              .eq('customer_email', user.email)
              .limit(1);
            hasOrder = Array.isArray(byEmail.data) && byEmail.data.length > 0;
          }
        }

        if (isMounted) {
          setIsFirstOrderEligible(!hasOrder);
        }
      } catch {
        if (isMounted) setPromoError('Kuponlar yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEligibility();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const activeCoupons = useMemo(
    () => (isFirstOrderEligible ? [WELCOME_COUPON] : []),
    [isFirstOrderEligible]
  );

  const handleCopy = async (coupon) => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopiedId(coupon.id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch {
      setCopiedId(coupon.id);
      setTimeout(() => setCopiedId(''), 1500);
    }
  };

  const handleApplyPromo = () => {
    setPromoMessage('');
    setPromoError('');

    const normalized = String(promoCode || '').trim().toUpperCase();
    if (!normalized) {
      setPromoError('Lütfen bir kupon kodu girin.');
      return;
    }

    if (normalized !== WELCOME_COUPON.code) {
      setPromoError('Bu kupon geçersiz veya şu an aktif değil.');
      return;
    }

    if (!isFirstOrderEligible) {
      setPromoError('Bu kupon yalnızca ilk siparişte geçerlidir.');
      return;
    }

    localStorage.setItem('checkout_coupon_code', WELCOME_COUPON.code);
    setPromoMessage(`${WELCOME_COUPON.code} checkout için kaydedildi.`);
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-28">
      <header className="sticky top-0 z-30 border-b border-brand-white/10 bg-[#F0F0F0]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 p-2 -ml-2 font-semibold text-gray-900"
          >
            <ChevronLeft size={18} />
            Geri
          </button>
          <h1 className="app-heading-primary">Kuponlarım</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="app-page-padding mx-auto w-full max-w-[430px] space-y-6 pt-5">
        {/* ── Kupon kodu girişi ── */}
        <section className="app-card p-3">
          <div className="relative flex items-center gap-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
              <TicketPercent size={18} />
            </div>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoMessage('');
                setPromoError('');
              }}
              placeholder="Promosyon kodu girin"
              className="app-input flex-1"
            />
            <button
              onClick={handleApplyPromo}
              className="app-btn-green-sm shrink-0"
            >
              Uygula
            </button>
          </div>
          {promoMessage && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-green-50 px-3 py-2">
              <p className="mb-0 text-sm text-green-700">{promoMessage}</p>
              <button
                onClick={() => navigate('/checkout')}
                className="app-btn-green-sm whitespace-nowrap text-xs"
              >
                Ödemeye Git
              </button>
            </div>
          )}
          {promoError && (
            <p className="mb-0 mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {promoError}
            </p>
          )}
        </section>

        {/* ── Aktif kuponlar ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="app-heading-secondary">Aktif Kuponlar</h2>
            {!loading && (
              <span className="rounded-full bg-[#98CD00] px-2.5 py-1 text-[11px] font-semibold text-white">
                {activeCoupons.length} Aktif
              </span>
            )}
          </div>

          {loading ? (
            <div className="app-card flex items-center justify-center p-8 text-sm text-gray-400">
              <Loader2 size={16} className="mr-2 animate-spin text-[#98CD00]" />
              Kuponlar yükleniyor...
            </div>
          ) : activeCoupons.length === 0 ? (
            <div className="app-card p-6 text-center">
              <p className="text-sm text-gray-400">
                Şu an aktif kuponunuz bulunmuyor. İlk sipariş kuponu yalnızca yeni üyelikte geçerlidir.
              </p>
            </div>
          ) : (
            activeCoupons.map((coupon) => (
              <article
                key={coupon.id}
                className="relative flex overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                {/* Ticket punch-out dekoratif daireler */}
                <div className="absolute -top-3 left-[33.333%] h-6 w-6 -translate-x-1/2 rounded-full bg-[#F0F0F0]" />
                <div className="absolute -bottom-3 left-[33.333%] h-6 w-6 -translate-x-1/2 rounded-full bg-[#F0F0F0]" />

                <div className="flex w-1/3 flex-col items-center justify-center border-r border-dashed border-gray-200 bg-[#98CD00]/10 p-4 text-center">
                  <p className="text-3xl font-extrabold text-gray-900 leading-none">{coupon.value}</p>
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-[#98CD00]">
                    {coupon.valueLabel}
                  </p>
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <p className="text-sm font-bold text-gray-900">{coupon.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{coupon.detail}</p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                      <Clock3 size={12} />
                      {coupon.expiryText}
                    </div>
                    <button
                      onClick={() => handleCopy(coupon)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 transition-all active:scale-95"
                    >
                      <Copy size={12} />
                      {copiedId === coupon.id ? '✓ Kopyalandı' : 'Kopyala'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
