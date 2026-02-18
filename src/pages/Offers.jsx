import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Gift,
  History,
  Sparkles,
  TicketPercent
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { CartContext } from '../context/CartContext';

const FALLBACK_CAMPAIGNS = [
  {
    id: 'c1',
    badge: 'Yeni Üye',
    title: 'İlk Siparişe Özel %20 İndirim',
    description: 'İlk siparişinde sepette anında indirim kazan.',
    code: 'MERHABA20',
    color_from: '#98CD00',
    color_via: '#98CD00',
    color_to: '#98CD00',
  },
  {
    id: 'c2',
    badge: 'Popüler',
    title: '3 Al 2 Öde Menüleri',
    description: 'Seçili menülerde 3 ürün al, 2 ürün öde fırsatını yakala.',
    code: '3AL2ODE',
    color_from: '#98CD00',
    color_via: '#98CD00',
    color_to: '#98CD00',
  },
  {
    id: 'c3',
    badge: 'Davet',
    title: 'Arkadaşını Davet Et Kazan',
    description: 'Davet ettiğin her arkadaş için hesabına kupon tanımlansın.',
    code: 'DAVETET',
    color_from: '#82CD47',
    color_via: '#82CD47',
    color_to: '#82CD47',
  },
  {
    id: 'c4',
    badge: 'Haftalık',
    title: 'Hafta Sonu Kargo Ücretsiz',
    description: 'Cumartesi-Pazar verilen siparişlerde teslimat ücretsiz.',
    code: 'HAFTASONU',
    color_from: '#82CD47',
    color_via: '#82CD47',
    color_to: '#82CD47',
  },
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferDiscountFromCode(code) {
  const match = String(code || '').match(/(\d{1,2})$/);
  if (match?.[1]) return Number(match[1]);
  return 0;
}

function campaignGradient(campaign, fallback = ['#F0F0F0', '#F0F0F0', '#F0F0F0']) {
  const from = campaign?.color_from || '#98CD00';
  const via = campaign?.color_via || '#82CD47';
  const to = campaign?.color_to || '#F0F0F0';
  return `linear-gradient(135deg, ${from} 0%, ${via} 55%, ${to} 100%)`;
}

export default function Offers() {
  const navigate = useNavigate();
  const { totalAmount } = useContext(CartContext);
  const [copiedId, setCopiedId] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      setLoading(true);
      try {
        let response = await supabase
          .from('campaigns')
          .select('id,title,description,code,badge,color_from,color_via,color_to,discount_type,discount_value,max_discount,start_date,end_date,min_cart_total,is_active,order')
          .eq('is_active', true)
          .order('order', { ascending: true });

        if (response.error) {
          response = await supabase
            .from('campaigns')
            .select('id,title,description,code,badge,color_from,color_via,color_to,is_active,order')
            .eq('is_active', true)
            .order('order', { ascending: true });
        }

        if (response.error) throw response.error;
        setCampaigns(response.data || []);
      } catch {
        setCampaigns([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCampaigns();

    const channel = supabase
      .channel('offers-campaigns-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, fetchCampaigns)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeCampaigns = useMemo(() => {
    if (!loading && campaigns.length > 0) return campaigns;
    return FALLBACK_CAMPAIGNS;
  }, [campaigns, loading]);

  const toDateBoundary = (value, endOfDay = false) => {
    if (!value) return null;
    const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
    const date = new Date(`${value}${suffix}`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const getCampaignEligibility = useCallback((campaign) => {
    const now = new Date();
    const startDate = toDateBoundary(campaign.start_date, false);
    const endDate = toDateBoundary(campaign.end_date, true);
    const minCart = Number(campaign.min_cart_total || 0);
    const discountType = ['percent', 'fixed'].includes(String(campaign.discount_type || '').toLowerCase())
      ? String(campaign.discount_type).toLowerCase()
      : 'percent';
    const rawDiscountValue = toNumber(
      campaign.discount_value,
      discountType === 'percent' ? inferDiscountFromCode(campaign.code) : 0
    );
    const maxDiscount = Math.max(0, toNumber(campaign.max_discount, 0));

    const started = !startDate || now >= startDate;
    const notEnded = !endDate || now <= endDate;
    const withinDateRange = started && notEnded;
    const subtotal = Math.max(0, Number(totalAmount || 0));
    // Offers ekranında sepet boş olsa da kupon kopyalanabilsin.
    // Gerçek minimum sepet kontrolü checkout/backend tarafında tekrar doğrulanır.
    const meetsMinCart = subtotal <= 0 ? true : subtotal >= minCart;
    let calculatedDiscount = discountType === 'fixed'
      ? rawDiscountValue
      : (subtotal * rawDiscountValue) / 100;
    if (maxDiscount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, maxDiscount);
    }
    calculatedDiscount = Math.min(subtotal, Math.max(0, calculatedDiscount));

    let reason = '';
    if (!started && startDate) {
      reason = `Bu kampanya ${startDate.toLocaleDateString('tr-TR')} tarihinde başlar.`;
    } else if (!notEnded && endDate) {
      reason = 'Bu kampanyanın süresi doldu.';
    } else if (!meetsMinCart && minCart > 0) {
      reason = `Kampanya için en az ₺${minCart.toFixed(0)} sepet tutarı gerekli.`;
    }

    return {
      eligible: withinDateRange && meetsMinCart,
      reason,
      minCart,
      discountType,
      discountValue: rawDiscountValue,
      discountAmount: calculatedDiscount,
      maxDiscount,
    };
  }, [totalAmount]);

  const rewardStats = useMemo(() => {
    const total = activeCampaigns.length || 1;
    const eligibleCount = activeCampaigns.filter((campaign) => getCampaignEligibility(campaign).eligible).length;
    const eligibilityProgress = Math.round((eligibleCount / total) * 100);
    const goalAmount = 500;
    const spendProgress = Math.max(0, Math.min(100, Math.round((Number(totalAmount || 0) / goalAmount) * 100)));

    return {
      total,
      eligibleCount,
      eligibilityProgress,
      spendProgress,
      remainingSpend: Math.max(0, goalAmount - Number(totalAmount || 0)),
    };
  }, [activeCampaigns, getCampaignEligibility, totalAmount]);

  const handleCopy = async (campaign) => {
    try {
      await navigator.clipboard.writeText(campaign.code);
      setCopiedId(campaign.id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch {
      setCopiedId(campaign.id);
      setTimeout(() => setCopiedId(''), 1500);
    }
  };

  const featuredCampaigns = activeCampaigns.slice(0, 3);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-dark pb-24">
      <div className="h-10 w-full" />

      <header className="sticky top-0 z-50 border-b border-brand-dark/10 bg-brand-bg/95 px-5 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-[#F0F0F0] rounded-full transition-colors"
          aria-label="Geri"
        >
          <ArrowLeft size={18} className="text-brand-dark" />
        </button>
        <h1 className="text-lg font-bold mb-0">Teklifler ve Fırsatlar</h1>
        <div className="w-10" />
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        <section className="mt-4">
          <div className="px-5 flex justify-between items-end mb-3">
            <div>
              <h2 className="text-[28px] font-extrabold tracking-tight leading-none mb-0">Ödüllerin</h2>
              <p className="text-sm text-brand-dark/60">Sipariş ettikçe avantajların artar</p>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-brand-dark font-bold text-sm inline-flex items-center gap-1"
            >
              <History size={14} />
              Geçmiş
            </button>
          </div>

          <div className="hide-scrollbar flex overflow-x-auto gap-3 px-5 pb-2">
            <article className="flex-shrink-0 w-72 rounded-2xl border border-brand-secondary/45 bg-brand-white p-4 shadow-[0_8px_18px_rgba(32,32,32,0.08)]">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-brand-bg rounded-lg flex items-center justify-center">
                  <Gift size={18} className="text-brand-dark" />
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-brand-primary text-brand-white rounded-full">
                  {rewardStats.total - rewardStats.eligibleCount} Kampanya Kaldı
                </span>
              </div>
              <h3 className="font-bold text-brand-dark mb-1">Kampanya Uygunluğu</h3>
              <p className="text-xs text-brand-dark/60 mb-4">
                {rewardStats.eligibleCount}/{rewardStats.total} kampanya şu an kullanılabilir
              </p>
              <div className="w-full bg-brand-bg h-2 rounded-full overflow-hidden">
                <div className="bg-brand-primary h-full rounded-full" style={{ width: `${rewardStats.eligibilityProgress}%` }} />
              </div>
            </article>

            <article className="flex-shrink-0 w-72 rounded-2xl border border-brand-secondary/45 bg-brand-white p-4 shadow-[0_8px_18px_rgba(32,32,32,0.08)]">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-brand-bg rounded-lg flex items-center justify-center">
                  <Sparkles size={18} className="text-brand-dark" />
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-brand-bg text-brand-dark rounded-full">
                  Hedef <span className="font-price font-semibold">₺500</span>
                </span>
              </div>
              <h3 className="font-bold text-brand-dark mb-1">Aylık Harcama</h3>
              <p className="text-xs text-brand-dark/60 mb-4">
                Sonraki ödüle <span className="font-price font-semibold">₺{rewardStats.remainingSpend.toFixed(2)}</span> kaldı
              </p>
              <div className="w-full bg-brand-bg h-2 rounded-full overflow-hidden">
                <div className="bg-[#98CD00] h-full rounded-full" style={{ width: `${rewardStats.spendProgress}%` }} />
              </div>
            </article>
          </div>
        </section>

        <section className="mt-5 px-5">
          <h2 className="text-[28px] font-extrabold tracking-tight leading-none mb-3">Öne Çıkan Fırsatlar</h2>
          <div className="grid grid-cols-2 gap-3">
            {featuredCampaigns[0] && (
              <article
                className="col-span-2 relative h-40 overflow-hidden rounded-2xl border border-brand-secondary/45 text-brand-dark shadow-[0_8px_18px_rgba(32,32,32,0.08)]"
                style={{ backgroundImage: campaignGradient(featuredCampaigns[0], ['#98CD00', '#82CD47', '#F0F0F0']) }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-brand-white/55 via-brand-white/25 to-brand-white/5" />
                <div className="relative z-10 p-6 flex flex-col justify-center h-full">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">
                    {featuredCampaigns[0].badge || 'KAMPANYA'}
                  </span>
                  <h3 className="text-2xl font-black mb-1 leading-tight">{featuredCampaigns[0].title}</h3>
                  <p className="text-sm font-medium opacity-90 max-w-[220px] line-clamp-2">{featuredCampaigns[0].description}</p>
                </div>
              </article>
            )}

            {featuredCampaigns.slice(1).map((campaign) => (
              <article
                key={campaign.id}
                className="relative h-48 overflow-hidden rounded-2xl border border-brand-secondary/45 shadow-[0_8px_18px_rgba(32,32,32,0.08)]"
                style={{ backgroundImage: campaignGradient(campaign) }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-brand-white/70 via-brand-white/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-4 text-brand-dark">
                  <h3 className="font-bold text-lg leading-tight">{campaign.title}</h3>
                  <p className="text-xs opacity-80 mt-1 line-clamp-2">{campaign.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 px-5">
          <h2 className="text-[28px] font-extrabold tracking-tight leading-none mb-3">Kullanılabilir Kuponlar</h2>
          <div className="space-y-4">
            {activeCampaigns.map((campaign) => {
              const eligibility = getCampaignEligibility(campaign);
              const discountLabel = eligibility.discountType === 'fixed'
                ? `₺${eligibility.discountValue.toFixed(0)}`
                : `%${eligibility.discountValue.toFixed(0)}`;

              return (
                <article
                  key={campaign.id}
                  className="bg-brand-white rounded-2xl overflow-hidden flex shadow-[0_8px_18px_rgba(32,32,32,0.08)] border border-brand-secondary/45 relative"
                >
                  <div className="w-24 bg-brand-secondary/35 flex flex-col items-center justify-center border-r border-dashed border-brand-secondary/50 relative">
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-brand-bg rounded-full border border-brand-secondary/45" />
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-brand-bg rounded-full border border-brand-secondary/45" />
                    <span className={`${eligibility.discountType === 'fixed' ? 'font-price ' : ''}text-2xl font-semibold text-brand-dark`}>{discountLabel}</span>
                    <span className="text-[10px] font-bold text-brand-dark/70 uppercase">İndirim</span>
                  </div>

                  <div className="flex-1 p-4">
                    <h4 className="font-semibold text-brand-dark mb-0">{campaign.code}</h4>
                    <p className="text-xs text-brand-dark/60 mt-1">{campaign.title}</p>
                    <p className="text-[11px] text-brand-dark/50 mt-1 line-clamp-2">{campaign.description}</p>

                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-[10px] font-medium text-brand-dark/50">
                        {eligibility.reason || 'Kullanıma hazır'}
                      </span>
                      <button
                        onClick={() => handleCopy(campaign)}
                        disabled={!campaign.code}
                        className="text-sm font-bold text-brand-dark hover:bg-[#F0F0F0] px-2 py-1 rounded inline-flex items-center gap-1"
                      >
                        <Copy size={13} />
                        {copiedId === campaign.id ? 'Kopyalandı' : 'Kopyala'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

    </div>
  );
}
