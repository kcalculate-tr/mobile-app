import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock3, Copy, TicketPercent, Truck } from 'lucide-react';

const activeCoupons = [
  {
    id: 'cp1',
    title: 'Hafta Sonu Özel',
    code: 'FIT20',
    value: '%20',
    valueLabel: 'İndirim',
    detail: 'Tüm restoran siparişlerinde geçerli',
    expiryText: '2 gün kaldı',
  },
  {
    id: 'cp2',
    title: 'İlk Sipariş Bonusu',
    code: 'WELCOME10',
    value: '₺50',
    valueLabel: 'İndirim',
    detail: 'Min. 300 TL sepet tutarı',
    expiryText: '5 gün kaldı',
  },
  {
    id: 'cp3',
    title: 'Sadakat Ödülü',
    code: 'UCRETSIZ40',
    value: 'Kargo',
    valueLabel: 'Bedava',
    detail: '10. siparişine özel teslimat ücretsiz',
    expiryText: '10 gün kaldı',
    isShipping: true,
  },
];

const inactiveCoupons = [
  {
    id: 'old-1',
    title: 'Flaş Kampanya',
    detail: 'Gece kampanyası',
    value: '%15',
    valueLabel: 'Süresi Doldu',
    statusText: 'Bitti: 15 Ocak',
  },
  {
    id: 'old-2',
    title: 'Hoş Geldin Hediyesi',
    detail: 'İlk siparişte kullanıldı',
    value: '₺25',
    valueLabel: 'Kullanıldı',
    statusText: 'Kullanım: 2 Ocak',
  },
];

export default function Coupons() {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState('');

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

    const found = activeCoupons.find((coupon) => coupon.code === normalized);
    if (!found) {
      setPromoError('Bu kupon geçersiz veya şu an aktif değil.');
      return;
    }

    localStorage.setItem('checkout_coupon_code', found.code);
    setPromoMessage(`${found.code} checkout için kaydedildi.`);
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-28">
      <header className="sticky top-0 z-30 border-b border-brand-white/10 bg-[#F0F0F0]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 p-2 -ml-2 font-bold text-brand-dark"
          >
            <ChevronLeft size={18} />
            Geri
          </button>
          <h1 className="text-lg font-bold text-brand-dark">Kuponlarım</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[430px] px-4 pt-5">
        <section className="mb-7">
          <div className="flex items-center rounded-full bg-[#F0F0F0] p-1.5">
            <span className="ml-3 text-brand-dark/50">
              <TicketPercent size={17} />
            </span>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoMessage('');
                setPromoError('');
              }}
              placeholder="Promosyon kodu girin"
              className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none flex-1 bg-transparent px-2 text-sm font-medium text-brand-dark"
            />
            <button
              onClick={handleApplyPromo}
              className="rounded-full border border-brand-white bg-[#98CD00] px-5 py-2 text-xs font-bold text-[#F0F0F0]"
            >
              Uygula
            </button>
          </div>
          {promoMessage && (
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <p className="mb-0 text-xs text-brand-dark">{promoMessage}</p>
              <button
                onClick={() => navigate('/checkout')}
                className="rounded-lg border border-brand-white/20 bg-[#F0F0F0] px-2.5 py-1 text-[11px] font-bold text-brand-dark"
              >
                Ödemeye Git
              </button>
            </div>
          )}
          {promoError && <p className="mb-0 mt-2 px-1 text-xs text-[#98CD00]">{promoError}</p>}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-dark/50">Sana Özel</h2>
            <span className="rounded-full bg-[#98CD00] px-2 py-1 text-[11px] font-bold text-[#F0F0F0]">
              {activeCoupons.length} Aktif
            </span>
          </div>

          {activeCoupons.map((coupon) => (
            <article
              key={coupon.id}
              className="relative flex overflow-hidden rounded-2xl border border-brand-white/10 bg-[#F0F0F0] shadow-sm"
            >
              <div className="absolute -top-3 left-[33.333%] h-6 w-6 -translate-x-1/2 rounded-full bg-[#F0F0F0]" />
              <div className="absolute -bottom-3 left-[33.333%] h-6 w-6 -translate-x-1/2 rounded-full bg-[#F0F0F0]" />
              <div className="w-1/3 border-r border-dashed border-brand-white/20 bg-[#98CD00]/30 p-4 text-center">
                {coupon.isShipping ? (
                  <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F0F0]">
                    <Truck size={16} className="text-brand-dark" />
                  </span>
                ) : (
                  <p className="text-2xl font-extrabold text-brand-dark">{coupon.value}</p>
                )}
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-dark/70">
                  {coupon.valueLabel}
                </p>
              </div>
              <div className="min-w-0 flex-1 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-brand-dark">{coupon.title}</p>
                    <p className="text-xs text-brand-dark/50 mt-0.5">{coupon.detail}</p>
                  </div>
                  <span className="rounded-full border border-brand-white/10 bg-[#F0F0F0] px-2 py-1 text-[11px] font-extrabold text-brand-dark">
                    {coupon.code}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark/50">
                    <Clock3 size={13} />
                    {coupon.expiryText}
                  </div>
                  <button
                    onClick={() => handleCopy(coupon)}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-white px-3 py-1.5 text-[11px] font-bold text-brand-dark"
                  >
                    <Copy size={12} />
                    {copiedId === coupon.id ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-10 space-y-4 opacity-70">
          <div className="px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-dark/50">Kullanılmış ve Süresi Dolmuş</h2>
          </div>

          {inactiveCoupons.map((coupon) => (
            <article
              key={coupon.id}
              className="relative flex overflow-hidden rounded-2xl border border-brand-white/10 bg-[#F0F0F0]/70"
            >
              <div className="absolute -top-3 left-[33.333%] h-6 w-6 -translate-x-1/2 rounded-full bg-[#F0F0F0]" />
              <div className="absolute -bottom-3 left-[33.333%] h-6 w-6 -translate-x-1/2 rounded-full bg-[#F0F0F0]" />
              <div className="w-1/3 border-r border-dashed border-brand-white/20 bg-[#F0F0F0] p-4 text-center">
                <p className="text-2xl font-extrabold text-brand-dark/50">{coupon.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-dark/50">
                  {coupon.valueLabel}
                </p>
              </div>
              <div className="min-w-0 flex-1 p-4">
                <p className="text-sm font-bold text-brand-dark/60">{coupon.title}</p>
                <p className="mt-0.5 text-xs text-brand-dark/50">{coupon.detail}</p>
                <span className="mt-3 inline-flex rounded-md bg-brand-white/10 px-2 py-1 text-[10px] font-bold uppercase text-brand-dark/60">
                  {coupon.statusText}
                </span>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
