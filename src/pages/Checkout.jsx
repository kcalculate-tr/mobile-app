import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Bike, CalendarDays, CheckCircle2, ChevronLeft, CreditCard, ShoppingBag, TicketPercent, Zap } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { supabase } from '../supabase';
import { motion } from 'framer-motion';

const DELIVERY_FEE = 40;
const SERVICE_START_MINUTE = 9 * 60;
const SERVICE_END_MINUTE = 22 * 60;
const DELIVERY_SLOTS = ['09.00 - 13.00', '13.00 - 18.00', '18.00 - 22.00'];
const RESTAURANT_ADDRESS = 'Basın Sitesi Mahallesi, 177/3. Sokak, No:3/A, Karabağlar - İZMİR';
const RESTAURANT_CITY = 'İzmir';
const RESTAURANT_DISTRICT = 'Karabağlar';
const COUPON_API_ENDPOINT = '/api/validate-coupon';
const CHECKOUT_CARD_GRADIENTS = [
  'from-[#7C3AED] via-[#EC4899] to-[#F97316]',
  'from-[#0EA5E9] via-[#14B8A6] to-[#22C55E]',
  'from-[#1D4ED8] via-[#4338CA] to-[#8B5CF6]',
  'from-[#DB2777] via-[#F43F5E] to-[#FB7185]',
];

function getInitialPaymentMethod() {
  return 'kredi-karti';
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDeliveryDays(dayCount = 7) {
  const now = new Date();
  return Array.from({ length: dayCount }).map((_, index) => {
    const day = new Date(now);
    day.setDate(now.getDate() + index);
    return {
      iso: toDateInputValue(day),
      weekday: day.toLocaleDateString('tr-TR', { weekday: 'short' }),
      dayOfMonth: day.toLocaleDateString('tr-TR', { day: '2-digit' }),
      month: day.toLocaleDateString('tr-TR', { month: 'short' }),
    };
  });
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, totalAmount } = useContext(CartContext);
  const deliveryDays = useMemo(() => createDeliveryDays(7), []);
  const defaultScheduledDate = deliveryDays[0]?.iso || toDateInputValue(new Date());

  const [loading, setLoading] = useState(false);
  const [isOrderSuccess, setIsOrderSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [debugError, setDebugError] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressLoadError, setAddressLoadError] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState(
    () => localStorage.getItem('checkout_selected_address_id') || ''
  );

  const [deliveryMethod, setDeliveryMethod] = useState('delivery');
  const [deliveryTimeType, setDeliveryTimeType] = useState('immediate');
  const [scheduledDate, setScheduledDate] = useState(defaultScheduledDate);
  const [scheduledSlot, setScheduledSlot] = useState(DELIVERY_SLOTS[0]);
  const [serviceNotice, setServiceNotice] = useState('');
  const [isShopOpen, setIsShopOpen] = useState(true);
  const [isWithinHours, setIsWithinHours] = useState(true);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [minCartAmount, setMinCartAmount] = useState(0);
  const [couponCode, setCouponCode] = useState(
    () => localStorage.getItem('checkout_coupon_code') || ''
  );
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponInfo, setCouponInfo] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponError, setCouponError] = useState('');
  const savedCards = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('checkout_saved_cards');
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // no-op
      }
    }

    return [
      {
        id: 'card_1',
        brand: 'Visa',
        holder: 'İlter Ö. Seven',
        last4: '4242',
        expiry: '12/29',
        isDefault: true,
      },
      {
        id: 'card_2',
        brand: 'Mastercard',
        holder: 'İlter Ö. Seven',
        last4: '5454',
        expiry: '11/28',
        isDefault: false,
      },
    ];
  }, []);
  const [selectedCardId, setSelectedCardId] = useState('');

  const [form, setForm] = useState({
    adSoyad: '',
    telefon: '',
    adres: '',
    city: '',
    district: '',
    odemeYontemi: getInitialPaymentMethod(),
  });

  const isDelivery = deliveryMethod === 'delivery';
  const isScheduledDelivery = isDelivery && deliveryTimeType === 'scheduled';
  const isRestrictedByTime = !isWithinHours;
  const isRestrictedByAdmin = !isShopOpen;
  const shouldForceScheduled = isRestrictedByTime || isRestrictedByAdmin;
  const controlsLocked = !availabilityChecked;
  const disablePickup = shouldForceScheduled || controlsLocked;
  const disableImmediate = shouldForceScheduled || controlsLocked;
  const subtotalAmount = Number(totalAmount.toFixed(2));
  const deliveryFeeAmount = isDelivery ? DELIVERY_FEE : 0;
  const discountAmount = Number(couponInfo?.discountAmount || 0);
  const payableTotal = Number((Math.max(0, subtotalAmount + deliveryFeeAmount - discountAmount)).toFixed(2));
  const selectedCard = useMemo(
    () => savedCards.find((card) => String(card.id) === String(selectedCardId)),
    [savedCards, selectedCardId]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = String(params.get('status') || params.get('success') || '').trim().toLowerCase();
    const successFromQuery = ['1', 'true', 'ok', 'success'].includes(status);
    const successFromState = Boolean(location.state?.orderSuccess);
    setIsOrderSuccess(successFromQuery || successFromState);
  }, [location.search, location.state]);

  useEffect(() => {
    if (selectedCardId) return;
    if (savedCards.length === 0) return;
    const defaultCard = savedCards.find((card) => card?.isDefault);
    setSelectedCardId(String(defaultCard?.id || savedCards[0].id));
  }, [savedCards, selectedCardId]);

  useEffect(() => {
    let isMounted = true;

    const checkAvailability = async () => {
      setAvailabilityChecked(false);

      const now = new Date();
      const currentHour = now.getHours();

      const isAfterHours = currentHour < 9 || currentHour >= 22;
      let isManuallyClosed = false;
      let nextMinCartAmount = 0;

      try {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('is_shop_open,min_cart_amount')
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        isManuallyClosed = settings ? !settings.is_shop_open : false;
        nextMinCartAmount = Number(settings?.min_cart_amount || 0);
      } catch (err) {
        console.warn('Ayarlar okunamadı, varsayılan değerlerle devam ediliyor:', err?.message || err);
      }

      if (!isMounted) return;

      setMinCartAmount(nextMinCartAmount);
      setIsWithinHours(!isAfterHours);
      setIsShopOpen(!isManuallyClosed);

      if (isAfterHours || isManuallyClosed) {
        setDeliveryTimeType('scheduled');
        setDeliveryMethod('delivery');
      } else {
        setDeliveryTimeType('immediate');
        setDeliveryMethod('delivery');
      }

      setAvailabilityChecked(true);
    };

    checkAvailability();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isRestrictedByAdmin) {
      setServiceNotice('Mağazamız şu an geçici olarak kapalıdır. Şimdilik sadece ileri tarihli eve teslim alıyoruz.');
      return;
    }

    if (isRestrictedByTime) {
      setServiceNotice('Sadece 09:00-22:00 arası hizmet veriyoruz. Hemen teslimat ve Gel Al şu an pasif.');
      return;
    }

    setServiceNotice('');
  }, [isRestrictedByAdmin, isRestrictedByTime]);

  const validateCouponOnServer = async (codeToValidate) => {
    const response = await fetch(COUPON_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: String(codeToValidate || '').trim(),
        cart_subtotal: subtotalAmount,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Kupon doğrulaması başarısız.');
    }
    return payload;
  };

  const handleApplyCoupon = async () => {
    setCouponError('');
    setCouponMessage('');

    const normalizedCode = String(couponCode || '').trim();
    if (!normalizedCode) {
      setCouponError('Kupon kodu girin.');
      return;
    }

    setCouponLoading(true);
    try {
      const result = await validateCouponOnServer(normalizedCode);
      if (!result.valid) {
        setCouponInfo(null);
        setCouponError(result.message || 'Kupon kullanılamıyor.');
        return;
      }

      setCouponInfo({
        id: result?.campaign?.id || null,
        code: result?.campaign?.code || normalizedCode.toUpperCase(),
        discountAmount: Number(result?.discountAmount || 0),
        campaign: result?.campaign || null,
      });
      setCouponCode(result?.campaign?.code || normalizedCode.toUpperCase());
      localStorage.setItem('checkout_coupon_code', result?.campaign?.code || normalizedCode.toUpperCase());
      setCouponMessage(result.message || 'Kupon uygulandı.');
    } catch (err) {
      setCouponInfo(null);
      setCouponError(err?.message || 'Kupon doğrulaması sırasında hata oluştu.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleClearCoupon = () => {
    setCouponCode('');
    setCouponInfo(null);
    setCouponMessage('');
    setCouponError('');
    localStorage.removeItem('checkout_coupon_code');
  };

  useEffect(() => {
    async function loadSavedAddresses() {
      setAddressesLoading(true);
      setAddressLoadError('');
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setSavedAddresses([]);
          return;
        }

        if (!form.adSoyad) {
          setForm((prev) => ({
            ...prev,
            adSoyad: user.user_metadata?.full_name || prev.adSoyad,
          }));
        }

        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSavedAddresses(data || []);
      } catch (err) {
        setAddressLoadError(err?.message || 'Kayıtlı adresler yüklenemedi.');
      } finally {
        setAddressesLoading(false);
      }
    }

    loadSavedAddresses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAddress = useMemo(
    () => savedAddresses.find((item) => String(item.id) === String(selectedAddressId)),
    [savedAddresses, selectedAddressId]
  );

  useEffect(() => {
    if (addressesLoading) return;
    if (selectedAddressId) return;
    if (savedAddresses.length === 0) return;
    setSelectedAddressId(String(savedAddresses[0].id));
  }, [addressesLoading, savedAddresses, selectedAddressId]);

  useEffect(() => {
    if (!selectedAddress) return;
    setForm((prev) => ({
      ...prev,
      adSoyad: selectedAddress.contact_name || prev.adSoyad,
      telefon: selectedAddress.contact_phone || prev.telefon,
      city: selectedAddress.city || '',
      district: selectedAddress.district || '',
      adres: selectedAddress.full_address || '',
    }));
  }, [selectedAddress]);

  useEffect(() => {
    if (!selectedAddressId) return;
    localStorage.setItem('checkout_selected_address_id', String(selectedAddressId));
  }, [selectedAddressId]);

  useEffect(() => {
    if (!couponInfo) return;
    setCouponInfo(null);
    setCouponMessage('Sepet tutarı değişti. Kuponu tekrar uygulayın.');
  }, [subtotalAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError(null);
    setDebugError('');

    if (controlsLocked) {
      setError('Servis uygunluğu kontrol ediliyor. Lütfen birkaç saniye sonra tekrar deneyin.');
      return;
    }

    if (cart.length === 0) {
      setError('Sepetiniz boş. Lütfen ürün ekleyin.');
      return;
    }

    if (subtotalAmount < minCartAmount) {
      setError(`Minimum sipariş tutarı ₺${Number(minCartAmount || 0).toFixed(0)} olmalıdır.`);
      return;
    }

    if (!form.adSoyad.trim() || !form.telefon.trim()) {
      setError('Lütfen ad soyad ve telefon bilgilerinizi girin.');
      return;
    }

    if (isDelivery && (!form.adres.trim() || !form.city.trim() || !form.district.trim())) {
      setError('Eve teslim için adres, şehir ve ilçe alanları zorunludur.');
      return;
    }

    if (isScheduledDelivery && (!scheduledDate || !scheduledSlot)) {
      setError('Randevulu teslimat için tarih ve saat aralığı seçin.');
      return;
    }

    if (shouldForceScheduled && deliveryTimeType !== 'scheduled') {
      setError('Bu saat aralığında yalnızca ileri tarihli teslimat seçilebilir.');
      return;
    }

    if (couponCode.trim() && !couponInfo) {
      setError('Kuponu uygulayın veya kodu temizleyin.');
      return;
    }
    if (!selectedCardId) {
      setError('Lütfen bir kart seçin.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Sipariş vermek için giriş yapmalısınız.');
        navigate('/login');
        return;
      }

      let confirmedCoupon = couponInfo;
      let confirmedDiscountAmount = discountAmount;

      if (couponInfo?.code) {
        const couponResult = await validateCouponOnServer(couponInfo.code);
        if (!couponResult.valid) {
          throw new Error(couponResult.message || 'Kupon artık kullanılamıyor.');
        }
        confirmedCoupon = {
          id: couponResult?.campaign?.id || null,
          code: couponResult?.campaign?.code || couponInfo.code,
          discountAmount: Number(couponResult?.discountAmount || 0),
          campaign: couponResult?.campaign || null,
        };
        confirmedDiscountAmount = Number(couponResult?.discountAmount || 0);
      }

      const finalPayableTotal = Number(
        Math.max(0, subtotalAmount + deliveryFeeAmount - confirmedDiscountAmount).toFixed(2)
      );

      const orderOid = `TEST${Date.now()}`;
      const items = cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        quantity: item.quantity || 1,
        type: item.type || 'meal',
        cal: Number(item.cal ?? item.kcal ?? 0),
        protein: Number(item.protein ?? 0),
        carbs: Number(item.carbs ?? 0),
        fats: Number(item.fats ?? 0),
      }));

      const composedAddress = isDelivery
        ? [form.adres, form.district, form.city].filter(Boolean).join(', ')
        : RESTAURANT_ADDRESS;
      const orderCity = isDelivery ? form.city : RESTAURANT_CITY;
      const orderDistrict = isDelivery ? form.district : RESTAURANT_DISTRICT;
      const orderDeliveryTimeType = isDelivery ? deliveryTimeType : 'immediate';
      const orderScheduledDate = isScheduledDelivery ? scheduledDate : null;
      const orderScheduledSlot = isScheduledDelivery ? scheduledSlot : null;

      const basePayload = {
        paytr_oid: orderOid,
        total_price: finalPayableTotal,
        status: 'pending',
        customer_name: form.adSoyad,
        customer_email: user.email,
        address: composedAddress,
        city: orderCity,
        district: orderDistrict,
        phone: form.telefon,
        items,
        payment_method: 'kredi-karti',
        payment_card_id: selectedCard?.id || null,
        payment_card_last4: selectedCard?.last4 || null,
        payment_card_brand: selectedCard?.brand || null,
        delivery_method: deliveryMethod,
        delivery_time_type: orderDeliveryTimeType,
        scheduled_date: orderScheduledDate,
        scheduled_slot: orderScheduledSlot,
        coupon_code: confirmedCoupon?.code || null,
        coupon_id: confirmedCoupon?.id || null,
        discount_amount: Number(confirmedDiscountAmount.toFixed(2)),
        subtotal_amount: subtotalAmount,
        delivery_fee: Number(deliveryFeeAmount.toFixed(2)),
      };

      const draft = {
        oid: orderOid,
        created_at: new Date().toISOString(),
        user_id: user.id,
        cart: items,
        checkout: {
          adSoyad: form.adSoyad,
          telefon: form.telefon,
          adres: isDelivery ? form.adres : RESTAURANT_ADDRESS,
          city: orderCity,
          district: orderDistrict,
          odemeYontemi: form.odemeYontemi,
          selectedCardId: selectedCard?.id || null,
          selectedCardLast4: selectedCard?.last4 || null,
          deliveryMethod,
          deliveryTimeType: orderDeliveryTimeType,
          scheduledDate: orderScheduledDate,
          scheduledSlot: orderScheduledSlot,
          deliveryFeeAmount,
          couponCode: confirmedCoupon?.code || null,
          couponId: confirmedCoupon?.id || null,
          discountAmount: Number(confirmedDiscountAmount.toFixed(2)),
          subtotalAmount: Number(subtotalAmount.toFixed(2)),
        },
        order: basePayload,
      };

      localStorage.setItem(`pending_order_${orderOid}`, JSON.stringify(draft));
      localStorage.setItem('latest_pending_order_oid', orderOid);
      localStorage.removeItem('checkout_coupon_code');
      localStorage.removeItem('checkout_selected_address_id');

      const basket = items.map((item) => [item.name, item.price.toFixed(2), item.quantity]);
      if (deliveryFeeAmount > 0) {
        basket.push(['Teslimat Ücreti', deliveryFeeAmount.toFixed(2), 1]);
      }

      const paymentEndpoint = import.meta.env.VITE_PAYMENT_API_URL || '/api/payment';
      const okUrl = `${window.location.origin}/success?oid=${encodeURIComponent(orderOid)}`;
      const failUrl = `${window.location.origin}/fail?oid=${encodeURIComponent(orderOid)}`;

      const paymentResponse = await fetch(paymentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_oid: orderOid,
          total_amount: finalPayableTotal,
          user_basket: basket,
          cart_subtotal: subtotalAmount,
          delivery_fee: deliveryFeeAmount,
          coupon_code: confirmedCoupon?.code || null,
          email: user.email,
          user_name: form.adSoyad,
          user_address: composedAddress,
          user_phone: form.telefon,
          merchant_ok_url: okUrl,
          merchant_fail_url: failUrl,
        }),
      });

      const paymentData = await paymentResponse.json().catch(() => ({}));
      if (!paymentResponse.ok || !paymentData?.token) {
        throw {
          message: paymentData?.error || 'PayTR token alınamadı',
          code: paymentResponse.status,
        };
      }

      window.location.assign(`/payment?token=${encodeURIComponent(paymentData.token)}&oid=${encodeURIComponent(orderOid)}`);
    } catch (err) {
      console.error(
        'Checkout Error Detayı:',
        err?.message || '',
        err?.details || '',
        err?.hint || ''
      );
      const readableError = [
        err?.message && `message: ${err.message}`,
        err?.code && `code: ${err.code}`,
        err?.details && `details: ${err.details}`,
        err?.hint && `hint: ${err.hint}`,
      ]
        .filter(Boolean)
        .join(' | ');

      console.error('Checkout flow failed:', err);
      const rawMessage = String(err?.message || '');
      const isPaymentTokenError = rawMessage.toLowerCase().includes('paytr') || rawMessage.toLowerCase().includes('token');
      if (isPaymentTokenError) {
        setError(`Ödeme başlatılamadı: ${rawMessage || 'PayTR token alınamadı'}`);
      } else {
        setError('Sipariş kaydedilemedi. Lütfen tekrar deneyin.');
      }
      setDebugError(readableError || 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  const cardClass = 'rounded-2xl border border-brand-primary/30 bg-[#F0F0F0] shadow-[0_8px_20px_rgba(32,32,32,0.25)]';
  const infoSectionClass = 'rounded-2xl border border-brand-dark/10 bg-brand-white shadow-sm';

  if (isOrderSuccess) {
    return (
      <div className="min-h-screen bg-brand-white px-5 py-10 text-brand-dark">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
          <div className="w-full rounded-3xl bg-brand-white p-7 text-center shadow-[0_16px_36px_rgba(32,32,32,0.12)]">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#98CD00]/15"
            >
              <CheckCircle2 size={50} className="text-[#98CD00]" strokeWidth={2.4} />
            </motion.div>
            <h1 className="mb-2 font-zalando text-lg font-semibold text-brand-dark">Siparişiniz Alındı!</h1>
            <p className="mb-0 font-google text-sm font-normal text-brand-dark/70">Siparişiniz hazırlanıyor, afiyet olsun.</p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/')}
              className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#98CD00] px-5 py-3.5 font-google font-medium text-[#F0F0F0]"
            >
              Ana Sayfaya Dön
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F0F0] to-[#F0F0F0] text-brand-dark">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-white/10 bg-[#F0F0F0]/95 px-5 py-4 backdrop-blur-md">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full border border-brand-white/15 bg-[#F0F0F0] transition-transform active:scale-90 inline-flex items-center justify-center"
          aria-label="Geri"
        >
          <ChevronLeft size={18} className="text-brand-dark" />
        </motion.button>
        <div className="text-center leading-tight">
          <h1 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">Ödeme</h1>
          <p className="mb-0 font-google text-[10px] font-extralight uppercase tracking-widest text-brand-dark/60">Güvenli Ödeme</p>
        </div>
        <div className="w-10" />
      </header>

      <form id="checkout-form" onSubmit={handleSubmit} className="mx-auto flex-1 w-full max-w-lg space-y-5 overflow-y-auto px-5 pb-48 pt-3">
        {serviceNotice && (
          <div className="inline-flex w-full items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-google text-sm font-normal text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{serviceNotice}</span>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">Teslimat Yöntemi</h2>
          </div>

          <div className={`${cardClass} p-4`}>
            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMethod('delivery')}
                className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                  isDelivery
                    ? 'border-[#98CD00] bg-[#98CD00] text-[#F0F0F0] shadow-[0_8px_20px_rgba(152,205,0,0.3)]'
                    : 'border-brand-primary/30 bg-[#F0F0F0] text-brand-dark/85'
                }`}
              >
                <span className="inline-flex items-center gap-2 font-google text-sm font-medium">
                  <Bike size={16} className="text-current" />
                  Eve Teslim
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (disablePickup) {
                    setServiceNotice('Sadece 09:00-22:00 arası hizmet veriyoruz.');
                    return;
                  }
                  setDeliveryMethod('pickup');
                }}
                disabled={disablePickup}
                className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                  disablePickup
                    ? 'border-brand-primary/20 bg-[#F0F0F0]/80 cursor-not-allowed text-brand-dark/70'
                    : !isDelivery
                      ? 'border-[#98CD00] bg-[#98CD00] text-[#F0F0F0] shadow-[0_8px_20px_rgba(152,205,0,0.3)]'
                      : 'border-brand-primary/30 bg-[#F0F0F0] text-brand-dark/85'
                }`}
              >
                <span className="inline-flex items-center gap-2 font-google text-sm font-medium">
                  <ShoppingBag size={16} className="text-current" />
                  Gel Al
                </span>
              </button>
            </div>
          </div>

          {isDelivery ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (disableImmediate) {
                      setServiceNotice('Sadece 09:00-22:00 arası hizmet veriyoruz.');
                      return;
                    }
                    setDeliveryTimeType('immediate');
                  }}
                  disabled={disableImmediate}
                    className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                      disableImmediate
                        ? 'border-brand-primary/20 bg-[#F0F0F0]/80 cursor-not-allowed text-brand-dark/70'
                        : deliveryTimeType === 'immediate'
                          ? 'border-[#98CD00] bg-[#98CD00] text-[#F0F0F0] shadow-[0_8px_20px_rgba(152,205,0,0.3)]'
                          : 'border-brand-primary/30 bg-[#F0F0F0] text-brand-dark/85'
                    }`}
                  >
                  <span className="inline-flex items-center gap-2 font-google text-sm font-medium">
                    <Zap size={15} className="text-current" />
                    Hemen Teslimat
                  </span>
                  <p className="mb-0 mt-1 text-xs text-current/70">Yaklaşık 30-45 dk</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryTimeType('scheduled')}
                    className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                      deliveryTimeType === 'scheduled'
                        ? 'border-[#98CD00] bg-[#98CD00] text-[#F0F0F0] shadow-[0_8px_20px_rgba(152,205,0,0.3)]'
                        : 'border-brand-primary/30 bg-[#F0F0F0] text-brand-dark/85'
                    }`}
                  >
                  <span className="inline-flex items-center gap-2 font-google text-sm font-medium">
                    <CalendarDays size={15} className="text-current" />
                    İleri Tarihli
                  </span>
                  <p className="mb-0 mt-1 text-xs text-current/70">Randevulu teslimat</p>
                </button>
              </div>

              {isScheduledDelivery && (
                <>
                  <div className="hide-scrollbar overflow-x-auto">
                    <div className="flex min-w-max gap-2">
                      {deliveryDays.map((day) => {
                        const isSelected = scheduledDate === day.iso;
                        return (
                          <button
                            key={day.iso}
                            type="button"
                            onClick={() => setScheduledDate(day.iso)}
                            className={`min-w-[70px] rounded-xl border px-3 py-2 text-center transition-all duration-200 ${
                              isSelected
                                ? 'bg-[#98CD00] border-[#98CD00] text-[#F0F0F0]'
                                : 'bg-[#F0F0F0] border-brand-primary/30 text-brand-dark/75'
                            }`}
                          >
                            <p className="mb-0 font-google text-[10px] font-extralight">{day.weekday}</p>
                            <p className="mb-0 mt-0.5 font-google text-sm font-medium">{day.dayOfMonth}</p>
                            <p className="mb-0 font-google text-[10px] font-extralight">{day.month}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {DELIVERY_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setScheduledSlot(slot)}
                        className={`rounded-xl border px-3 py-2.5 text-left font-google text-sm font-medium transition-all duration-200 ${
                          scheduledSlot === slot
                            ? 'border-[#98CD00] bg-[#98CD00] text-[#F0F0F0]'
                            : 'border-brand-primary/30 bg-[#F0F0F0] text-brand-dark/85'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className={`${cardClass} p-3`}>
              <p className="mb-0 font-google text-sm font-medium text-brand-dark">Restorandan Teslim Al</p>
              <p className="mb-0 mt-1 font-google text-xs font-extralight text-brand-dark/70">
                Siparişinizi şu adresten teslim alabilirsiniz: {RESTAURANT_ADDRESS}
              </p>
            </div>
          )}
        </section>

        <section className={`${infoSectionClass} space-y-4 p-4`}>
          <h2 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">İletişim Bilgileri</h2>
          <div className="space-y-2 rounded-2xl border border-brand-dark/10 bg-brand-white p-2.5">
            <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
              <input
                type="text"
                name="adSoyad"
                value={form.adSoyad}
                onChange={handleChange}
                placeholder="Ad Soyad"
                className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark placeholder:text-brand-dark/60"
                required
              />
            </div>
            <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
              <input
                type="tel"
                name="telefon"
                value={form.telefon}
                onChange={handleChange}
                placeholder="Telefon"
                className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark placeholder:text-brand-dark/60"
                required
              />
            </div>
          </div>
        </section>

        {isDelivery && (
          <section className={`${infoSectionClass} space-y-4 p-4`}>
            <h2 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">Teslimat Adresi</h2>

            <div className="space-y-3 rounded-2xl border border-brand-dark/10 bg-brand-white p-2.5">
              <div className="space-y-2">
                <p className="mb-0 font-google text-xs font-extralight text-brand-dark/65">Kayıtlı Adreslerimden Seç</p>
                {addressesLoading ? (
                  <p className="mb-0 font-google text-xs font-extralight text-brand-dark/55">Adresler yükleniyor...</p>
                ) : savedAddresses.length > 0 ? (
                  <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark"
                    >
                      <option value="">Adres seçin</option>
                      {savedAddresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.title} - {address.contact_name || '-'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/profile/addresses')}
                    className="w-full rounded-xl bg-[#F0F0F0] py-2.5 font-google text-sm font-medium text-brand-dark"
                  >
                    Kayıtlı adres yok. Adres eklemek için tıkla
                  </button>
                )}
                {addressLoadError && <p className="mb-0 text-xs text-[#98CD00]">{addressLoadError}</p>}
              </div>

              <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
                <textarea
                  name="adres"
                  value={form.adres}
                  onChange={handleChange}
                  placeholder="Açık Adres"
                  rows={3}
                  className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full resize-none bg-transparent font-google text-sm font-normal text-brand-dark placeholder:text-brand-dark/60"
                  required={isDelivery}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Şehir"
                    className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark placeholder:text-brand-dark/60"
                    required={isDelivery}
                  />
                </div>
                <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
                  <input
                    type="text"
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    placeholder="İlçe"
                    className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark placeholder:text-brand-dark/60"
                    required={isDelivery}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        <section className={`${infoSectionClass} space-y-3 p-4`}>
          <h2 className="mb-0 inline-flex items-center gap-2 font-zalando text-lg font-semibold text-brand-dark">
            <TicketPercent size={16} className="text-[#98CD00]" />
            Kampanya Kodu
          </h2>
          <div className="rounded-2xl border border-brand-dark/10 bg-brand-white p-2">
            <div className="flex gap-2 rounded-xl border border-brand-dark/10 bg-brand-white p-1.5">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Kupon kodunu girin"
                className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none flex-1 rounded-xl bg-transparent px-4 py-3.5 font-google text-sm font-normal text-brand-dark placeholder:text-brand-dark/60"
              />
              {couponInfo ? (
                <button
                  type="button"
                  onClick={handleClearCoupon}
                  className="rounded-xl bg-brand-bg px-3 font-google text-sm font-medium text-brand-dark"
                >
                  Temizle
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading}
                  className="rounded-xl bg-[#98CD00] px-3 font-google text-sm font-medium text-[#F0F0F0] disabled:opacity-60"
                >
                  {couponLoading ? 'Kontrol...' : 'Uygula'}
                </button>
              )}
            </div>
          </div>
          {couponInfo && (
            <p className="text-xs text-brand-dark">
              {couponInfo.code} uygulandı. İndirim: <span className="font-google font-medium">₺{Number(couponInfo.discountAmount || 0).toFixed(2)}</span>
            </p>
          )}
          {!couponInfo && couponMessage && (
            <p className="font-google text-xs font-extralight text-brand-dark/70">{couponMessage}</p>
          )}
          {couponError && <p className="text-xs text-[#98CD00]">{couponError}</p>}
        </section>

        <section className={`${cardClass} space-y-4 p-4`}>
          <h2 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">Ödeme Yöntemi</h2>

          <div className="rounded-xl border border-brand-primary/30 bg-[#F0F0F0] px-3 py-2.5">
            <p className="mb-0 inline-flex items-center gap-2 font-google text-sm font-medium text-brand-dark">
              <CreditCard size={16} className="text-[#98CD00]" />
              Kredi / Banka Kartı
            </p>
            <p className="mb-0 mt-1 font-google text-xs font-extralight text-brand-dark/60">Sadece kart ile ödeme alınmaktadır.</p>
          </div>

          <div className="space-y-2">
            {savedCards.map((card, index) => {
              const selected = String(card.id) === String(selectedCardId);
              const gradientClass = CHECKOUT_CARD_GRADIENTS[index % CHECKOUT_CARD_GRADIENTS.length];
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    setSelectedCardId(String(card.id));
                    setForm((prev) => ({ ...prev, odemeYontemi: 'kredi-karti' }));
                  }}
                  className={`w-full rounded-2xl border bg-gradient-to-br p-3 text-left text-brand-white transition-all ${gradientClass} ${
                    selected
                      ? 'border-brand-primary ring-2 ring-brand-primary/25'
                      : 'border-brand-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="mb-0 font-google text-sm font-medium text-brand-white">{card.brand} •••• {card.last4}</p>
                      <p className="mb-0 mt-1 font-google text-xs font-extralight text-brand-white/80">{card.holder} • SKT {card.expiry}</p>
                    </div>
                    {selected && (
                      <span className="rounded-full bg-brand-white px-2 py-0.5 font-google text-[10px] font-medium text-brand-dark">
                        Seçili
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {savedCards.length === 0 && (
              <p className="rounded-xl border border-brand-primary/30 bg-[#F0F0F0] px-3 py-2 text-xs text-brand-dark/65">
                Kayıtlı kart bulunamadı.
              </p>
            )}
          </div>
        </section>

        <section className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-brand-dark/60">Ürün Tutarı</span>
            <span className="font-google font-medium text-brand-dark">₺{subtotalAmount.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-brand-dark/60">Teslimat Ücreti</span>
            <span className="font-google font-medium text-brand-dark">₺{deliveryFeeAmount.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-brand-dark/60">Kampanya İndirimi</span>
            <span className="font-google font-medium text-brand-dark">
              {discountAmount > 0 ? `-₺${discountAmount.toFixed(2)}` : '₺0.00'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-brand-white/10 pt-3.5">
            <span className="font-bold text-brand-dark">Toplam Tutar</span>
            <span className="font-google text-xl font-medium text-brand-dark">₺{payableTotal.toFixed(2)}</span>
          </div>
        </section>

        {error && (
          <div className="space-y-2">
            <p className="text-center text-sm text-[#98CD00]">{error}</p>
            {debugError && (
              <p className="break-words text-center text-[11px] text-brand-dark/60">{debugError}</p>
            )}
          </div>
        )}
      </form>

      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto max-w-lg rounded-t-3xl border-t border-brand-white/10 bg-[#F0F0F0]/95 px-5 pb-8 pt-5 shadow-[0_-14px_30px_rgba(32,32,32,0.45)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex flex-col">
              <span className="font-google text-xs font-medium uppercase tracking-widest text-brand-dark/60">Ödenecek Tutar</span>
              <span className="font-google text-2xl font-medium text-brand-dark">₺{payableTotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-[#98CD00] px-3 py-1 font-google text-xs font-medium text-[#F0F0F0]">
                İndirim <span className="font-google font-medium">₺{discountAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            form="checkout-form"
            disabled={loading || controlsLocked}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#98CD00] py-4 font-google text-[#F0F0F0] shadow-[0_12px_24px_rgba(152,205,0,0.35)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
          >
            <span className="font-google text-lg font-medium">
              {loading ? 'İşleniyor...' : controlsLocked ? 'Servis Kontrol Ediliyor...' : 'Siparişi Tamamla'}
            </span>
            {!loading && !controlsLocked && (
              <>
                <div className="h-6 w-px bg-brand-white/35" />
                <span className="font-google text-lg font-medium">₺{payableTotal.toFixed(2)}</span>
              </>
            )}
          </motion.button>
          <div className="h-3" />
        </div>
      </div>
    </div>
  );
}
