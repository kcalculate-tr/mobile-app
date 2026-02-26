import { createClient } from '@supabase/supabase-js';

const FALLBACK_CAMPAIGNS = [
  {
    id: 'fallback-hosgeldin150',
    title: 'Hoş Geldin İndirimi',
    description: 'KCAL ailesine katıldığınız için teşekkürler! İlk siparişinizde geçerlidir.',
    code: 'HOSGELDIN150',
    badge: 'Yeni Üye',
    is_active: true,
    discount_type: 'fixed',
    discount_value: 150,
    max_discount: 150,
    min_cart_total: 0,
    start_date: null,
    end_date: null,
  },
  {
    id: 'fallback-merhaba20',
    title: 'İlk Siparişe Özel %20 İndirim',
    description: 'İlk siparişinde sepette anında indirim kazan.',
    code: 'MERHABA20',
    badge: 'Yeni Üye',
    is_active: true,
    discount_type: 'percent',
    discount_value: 20,
    max_discount: 200,
    min_cart_total: 0,
    start_date: null,
    end_date: null,
  },
  {
    id: 'fallback-3al2ode',
    title: '3 Al 2 Öde Menüleri',
    description: 'Seçili menülerde 3 ürün al, 2 ürün öde fırsatı.',
    code: '3AL2ODE',
    badge: 'Popüler',
    is_active: true,
    discount_type: 'percent',
    discount_value: 33,
    max_discount: 250,
    min_cart_total: 0,
    start_date: null,
    end_date: null,
  },
  {
    id: 'fallback-davetet',
    title: 'Arkadaşını Davet Et Kazan',
    description: 'Davet kampanyası indirimi.',
    code: 'DAVETET',
    badge: 'Davet',
    is_active: true,
    discount_type: 'percent',
    discount_value: 15,
    max_discount: 150,
    min_cart_total: 0,
    start_date: null,
    end_date: null,
  },
  {
    id: 'fallback-haftasonu',
    title: 'Hafta Sonu Kargo Ücretsiz',
    description: 'Hafta sonu siparişlerine özel indirim.',
    code: 'HAFTASONU',
    badge: 'Haftalık',
    is_active: true,
    discount_type: 'fixed',
    discount_value: 40,
    max_discount: 40,
    min_cart_total: 0,
    start_date: null,
    end_date: null,
  },
];

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseDateBoundary(dateValue, endOfDay = false) {
  if (!dateValue) return null;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const parsed = new Date(`${dateValue}${suffix}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function canonicalizeCode(code) {
  return normalizeCode(code).replace(/[\s_-]+/g, '');
}

function findFallbackCampaignByCode(code) {
  const canonicalCode = canonicalizeCode(code);
  return (
    FALLBACK_CAMPAIGNS.find((item) => canonicalizeCode(item.code) === canonicalCode) || null
  );
}

function inferDiscountFromCode(campaign) {
  const candidate = String(campaign?.code || '').match(/(\d{1,2})$/);
  if (candidate?.[1]) {
    return {
      discount_type: 'percent',
      discount_value: Number(candidate[1]),
    };
  }
  return {
    discount_type: 'percent',
    discount_value: 0,
  };
}

export async function validateCampaignCoupon({ code, cartSubtotal }) {
  const normalizedCode = normalizeCode(code);
  const canonicalCode = canonicalizeCode(code);
  const subtotal = Math.max(0, toNumber(cartSubtotal));

  if (!normalizedCode) {
    return { valid: false, message: 'Kupon kodu girin.' };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const fallbackCampaign = findFallbackCampaignByCode(normalizedCode);
    if (fallbackCampaign) {
      const inferredFallback = inferDiscountFromCode(fallbackCampaign);
      const fallbackType = ['percent', 'fixed'].includes(String(fallbackCampaign.discount_type || '').toLowerCase())
        ? String(fallbackCampaign.discount_type).toLowerCase()
        : inferredFallback.discount_type;
      const fallbackValue = toNumber(fallbackCampaign.discount_value, inferredFallback.discount_value);
      const fallbackMaxDiscount = Math.max(0, toNumber(fallbackCampaign.max_discount, 0));
      let discountAmount = fallbackType === 'fixed'
        ? fallbackValue
        : (subtotal * fallbackValue) / 100;
      if (fallbackMaxDiscount > 0) discountAmount = Math.min(discountAmount, fallbackMaxDiscount);
      discountAmount = Math.min(subtotal, Math.max(0, discountAmount));

      return {
        valid: discountAmount > 0,
        message: discountAmount > 0 ? 'Kupon başarıyla uygulandı.' : 'Bu kampanya için geçerli indirim tanımlanmamış.',
        campaign: {
          id: fallbackCampaign.id,
          title: fallbackCampaign.title,
          code: fallbackCampaign.code,
          badge: fallbackCampaign.badge,
          min_cart_total: 0,
          start_date: null,
          end_date: null,
          discount_type: fallbackType,
          discount_value: fallbackValue,
          max_discount: fallbackMaxDiscount,
        },
        discountAmount,
        finalSubtotal: Math.max(0, subtotal - discountAmount),
      };
    }

    return { valid: false, message: 'Sunucu Supabase yapılandırması eksik.' };
  }

  let campaign = null;
  let queryError = null;

  const primaryQuery = await supabase
    .from('campaigns')
    .select('*')
    .eq('code', normalizedCode)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!primaryQuery.error && primaryQuery.data) {
    campaign = primaryQuery.data;
  } else {
    if (primaryQuery.error) queryError = primaryQuery.error;

    const fallbackQuery = await supabase
      .from('campaigns')
      .select('*')
      .ilike('code', normalizedCode)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!fallbackQuery.error && fallbackQuery.data) {
      campaign = fallbackQuery.data;
    } else if (fallbackQuery.error) {
      queryError = fallbackQuery.error;
    }
  }

  if (!campaign) {
    // Son fallback: aktif kampanyaları çekip kodu normalize ederek JS tarafında eşleştir.
    let listQuery = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .order('order', { ascending: true })
      .limit(200);

    if (listQuery.error) {
      listQuery = await supabase
        .from('campaigns')
        .select('id,title,description,code,badge,is_active,start_date,end_date,min_cart_total,discount_type,discount_value,max_discount')
        .eq('is_active', true)
        .limit(200);
    }

    if (!listQuery.error) {
      const activeCampaigns = listQuery.data || [];
      campaign = activeCampaigns.find((item) => {
        const itemCanonical = canonicalizeCode(item?.code);
        return itemCanonical && itemCanonical === canonicalCode;
      }) || null;
    } else {
      queryError = listQuery.error;
    }
  }

  if (!campaign && queryError) {
    return {
      valid: false,
      message: 'Kampanya servisine erişilemedi. Lütfen tekrar deneyin.',
      debug: `${queryError.message || ''} ${queryError.details || ''}`.trim(),
    };
  }

  if (!campaign) {
    const fallbackCampaign = findFallbackCampaignByCode(normalizedCode);
    if (fallbackCampaign) {
      campaign = fallbackCampaign;
    }
  }

  if (!campaign) {
    return {
      valid: false,
      message: 'Geçerli bir kampanya kodu bulunamadı.',
      debug: `Aranan kod: ${normalizedCode}`,
    };
  }

  const now = new Date();
  const startDate = parseDateBoundary(campaign.start_date, false);
  const endDate = parseDateBoundary(campaign.end_date, true);
  const minCartTotal = Math.max(0, toNumber(campaign.min_cart_total, 0));

  if (startDate && now < startDate) {
    return {
      valid: false,
      message: `Bu kampanya ${startDate.toLocaleDateString('tr-TR')} tarihinde başlıyor.`,
      campaign,
    };
  }

  if (endDate && now > endDate) {
    return {
      valid: false,
      message: 'Bu kampanyanın süresi dolmuş.',
      campaign,
    };
  }

  if (subtotal < minCartTotal) {
    return {
      valid: false,
      message: `Bu kod için minimum sepet tutarı ₺${minCartTotal.toFixed(0)}.`,
      campaign,
    };
  }

  const inferred = inferDiscountFromCode(campaign);
  const discountType = ['percent', 'fixed'].includes(String(campaign.discount_type || '').toLowerCase())
    ? String(campaign.discount_type).toLowerCase()
    : inferred.discount_type;
  const rawDiscountValue = toNumber(campaign.discount_value, inferred.discount_value);
  const maxDiscount = Math.max(0, toNumber(campaign.max_discount, 0));

  let discountAmount = 0;
  if (discountType === 'fixed') {
    discountAmount = rawDiscountValue;
  } else {
    discountAmount = (subtotal * rawDiscountValue) / 100;
  }

  if (maxDiscount > 0) {
    discountAmount = Math.min(discountAmount, maxDiscount);
  }

  discountAmount = Math.min(subtotal, Math.max(0, discountAmount));

  if (discountAmount <= 0) {
    return {
      valid: false,
      message: 'Bu kampanya için geçerli indirim tanımlanmamış.',
      campaign,
    };
  }

  const finalSubtotal = Math.max(0, subtotal - discountAmount);

  return {
    valid: true,
    message: 'Kupon başarıyla uygulandı.',
    campaign: {
      id: campaign.id,
      title: campaign.title,
      code: campaign.code,
      badge: campaign.badge,
      min_cart_total: minCartTotal,
      start_date: campaign.start_date || null,
      end_date: campaign.end_date || null,
      discount_type: discountType,
      discount_value: rawDiscountValue,
      max_discount: maxDiscount,
    },
    discountAmount,
    finalSubtotal,
  };
}
