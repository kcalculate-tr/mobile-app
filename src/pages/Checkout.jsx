import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Bike, CalendarDays, CheckCircle2, ChevronLeft, CreditCard, Loader2, ShoppingBag, TicketPercent, Zap } from 'lucide-react';
import { CartContext, CART_STORAGE_KEY } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../supabase';
import { AnimatePresence, motion } from 'framer-motion';
import useDeliveryZones from '../hooks/useDeliveryZones';
import AuthModal from '../components/AuthModal';

const DELIVERY_FEE = 40;
const IMMEDIATE_DELIVERY_MIN_AMOUNT = 500;
const SCHEDULED_DELIVERY_MIN_AMOUNT = 1000;
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

function normalizeForCompare(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function isMissingRequiredValue(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const normalized = text.toLocaleLowerCase('tr-TR');
  return normalized === 'seçiniz' || normalized === 'seciniz';
}

function extractNeighborhoodFromFullAddress(fullAddress) {
  return String(fullAddress || '').split(',')[0]?.trim() || '';
}

function getMissingColumnName(errorText) {
  const pattern = /column ["']?([a-zA-Z0-9_]+)["']?/i;
  const match = String(errorText || '').match(pattern);
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
      'paytr_oid',
      'total_price',
      'payment_method',
      'payment_card_id',
      'payment_card_last4',
      'payment_card_brand',
      'delivery_method',
      'delivery_time_type',
      'scheduled_date',
      'scheduled_slot',
      'coupon_code',
      'coupon_id',
      'discount_amount',
      'subtotal_amount',
      'delivery_fee',
      'total_amount',
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

async function awardMacroPoints(userId, increment = 100) {
  const safeUserId = String(userId || '').trim();
  const safeIncrement = Math.max(0, Number(increment) || 0);
  if (!safeUserId || !safeIncrement) return;

  const readProfileByUserId = async () => supabase
    .from('profiles')
    .select('id,user_id,macro_points')
    .eq('user_id', safeUserId)
    .maybeSingle();

  const readProfileById = async () => supabase
    .from('profiles')
    .select('id,user_id,macro_points')
    .eq('id', safeUserId)
    .maybeSingle();

  const applyUpdate = async (field, value, nextPoints) => supabase
    .from('profiles')
    .update({ macro_points: nextPoints })
    .eq(field, value);

  const upsertInsert = async (payload) => supabase
    .from('profiles')
    .insert([payload]);

  try {
    let profile = null;

    const byUserId = await readProfileByUserId();
    if (!byUserId.error && byUserId.data) {
      profile = byUserId.data;
    } else {
      const byId = await readProfileById();
      if (!byId.error && byId.data) profile = byId.data;
    }

    const nextPoints = Math.max(0, Number(profile?.macro_points || 0)) + safeIncrement;

    if (profile?.id !== undefined && profile?.id !== null) {
      const updateById = await applyUpdate('id', profile.id, nextPoints);
      if (!updateById.error) return;
    }

    const updateByUserId = await applyUpdate('user_id', safeUserId, nextPoints);
    if (!updateByUserId.error) return;

    const insertByUserId = await upsertInsert({ user_id: safeUserId, macro_points: safeIncrement });
    if (!insertByUserId.error) return;

    await upsertInsert({ id: safeUserId, macro_points: safeIncrement });
  } catch {
    // Puan yazılamasa da sipariş akışı kesilmez.
  }
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, totalAmount, clearCart } = useContext(CartContext);
  const { user, authLoading } = useContext(AuthContext);
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isContractsAccepted, setIsContractsAccepted] = useState(false);
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
  const {
    deliveryZones,
    deliveryZonesLoading,
    deliveryZonesError,
    districts: districtOptions,
    getNeighborhoodsByDistrict,
  } = useDeliveryZones();

  const [form, setForm] = useState({
    adSoyad: '',
    telefon: '',
    email: '',
    adres: '',
    city: '',
    district: '',
    neighborhood: '',
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
  const deliveryMethodMinAmount = useMemo(() => {
    if (!isDelivery) return 0;
    return deliveryTimeType === 'scheduled' ? SCHEDULED_DELIVERY_MIN_AMOUNT : IMMEDIATE_DELIVERY_MIN_AMOUNT;
  }, [isDelivery, deliveryTimeType]);
  const deliveryMethodMissingAmount = useMemo(
    () => Math.max(0, Number((deliveryMethodMinAmount - payableTotal).toFixed(2))),
    [deliveryMethodMinAmount, payableTotal]
  );
  const isBelowDeliveryMethodMinimum = isDelivery && deliveryMethodMissingAmount > 0;
  const deliveryMethodMinimumMessage = useMemo(() => {
    if (!isBelowDeliveryMethodMinimum) return '';

    const missingText = deliveryMethodMissingAmount.toFixed(2);
    if (deliveryTimeType === 'scheduled') {
      return `Randevulu teslimat için minimum sepet tutarı 1.000 TL'dir. Sepetinize ${missingText} TL'lik daha ürün eklemelisiniz.`;
    }
    return `Hemen teslimat için minimum sepet tutarı 500 TL'dir. Sepetinize ${missingText} TL'lik daha ürün eklemelisiniz.`;
  }, [isBelowDeliveryMethodMinimum, deliveryMethodMissingAmount, deliveryTimeType]);
  const neighborhoodOptions = useMemo(() => {
    return getNeighborhoodsByDistrict(form.district);
  }, [form.district, getNeighborhoodsByDistrict]);
  const selectedZone = useMemo(() => {
    const selectedDistrict = normalizeForCompare(form.district);
    const selectedNeighborhood = normalizeForCompare(form.neighborhood);
    if (!selectedDistrict || !selectedNeighborhood) return null;

    return (
      deliveryZones.find((item) => (
        normalizeForCompare(item?.district) === selectedDistrict
        && normalizeForCompare(item?.neighborhood) === selectedNeighborhood
      )) || null
    );
  }, [deliveryZones, form.district, form.neighborhood]);
  const deliveryZoneValidationMessage = useMemo(() => {
    if (!isDelivery) return '';
    if (!selectedZone) return '';

    const allowImmediate = Boolean(selectedZone?.allow_immediate);
    const allowScheduled = Boolean(selectedZone?.allow_scheduled);

    if (!allowImmediate && !allowScheduled) {
      return 'Ne yazık ki şu anda bölgenize kurye hizmetimiz bulunmamaktadır. Siparişinizi "Gel Al" seçeneği ile oluşturabilirsiniz.';
    }

    if (deliveryTimeType === 'immediate' && !allowImmediate) {
      return 'Mevcut adresinize ne yazık ki şu anda "Hemen Teslim" seçeneği sunulmuyor. Lütfen "Randevulu Teslim" veya "Gel Al" seçeneği ile siparişinizi tamamlayınız.';
    }

    if (deliveryTimeType === 'scheduled' && !allowScheduled) {
      return 'Mevcut adresinize "Randevulu Teslim" yapılamamaktadır. Lütfen "Hemen Teslim" (eğer açıksa) veya "Gel Al" seçiniz.';
    }

    return '';
  }, [isDelivery, selectedZone, deliveryTimeType]);
  const isDeliveryZoneBlocked = Boolean(deliveryZoneValidationMessage);
  const hasRequiredLegalApprovals = isContractsAccepted;

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
    if (authLoading) return;
    setShowAuthModal(!user);
  }, [authLoading, user]);

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
    if (!isDelivery) return;
    setForm((prev) => (prev.city === RESTAURANT_CITY ? prev : { ...prev, city: RESTAURANT_CITY }));
  }, [isDelivery]);

  useEffect(() => {
    if (!isDelivery) return;
    if (!form.neighborhood) return;

    const existsInDistrict = neighborhoodOptions.some(
      (item) => normalizeForCompare(item?.neighborhood) === normalizeForCompare(form.neighborhood)
    );
    if (!existsInDistrict) {
      setForm((prev) => ({ ...prev, neighborhood: '' }));
    }
  }, [isDelivery, neighborhoodOptions, form.neighborhood]);

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

        if (!form.adSoyad || !form.email) {
          setForm((prev) => ({
            ...prev,
            adSoyad: user.user_metadata?.full_name || prev.adSoyad,
            email: user.email || prev.email,
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
    const fallbackNeighborhood = extractNeighborhoodFromFullAddress(selectedAddress.full_address);
    setForm((prev) => ({
      ...prev,
      adSoyad: selectedAddress.contact_name || prev.adSoyad,
      telefon: selectedAddress.contact_phone || prev.telefon,
      email: selectedAddress.contact_email || prev.email,
      city: RESTAURANT_CITY,
      district: selectedAddress.district || '',
      neighborhood:
        selectedAddress.neighborhood
        || selectedAddress.neighbourhood
        || selectedAddress.mahalle
        || fallbackNeighborhood,
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

    if (!user) {
      setShowAuthModal(true);
      setError('Siparişi tamamlamak için giriş yapmanız gerekiyor.');
      return;
    }

    if (cart.length === 0) {
      setError('Sepetiniz boş. Lütfen ürün ekleyin.');
      return;
    }

    if (isBelowDeliveryMethodMinimum) {
      return;
    }

    if (!hasRequiredLegalApprovals) {
      setError('Lütfen siparişi tamamlamak için sözleşme onayını işaretleyin.');
      return;
    }

    if (isDelivery && subtotalAmount < minCartAmount) {
      setError(`Minimum sipariş tutarı ₺${Number(minCartAmount || 0).toFixed(0)} olmalıdır.`);
      return;
    }

    const fullNameMissing = isMissingRequiredValue(form.adSoyad);
    const phoneMissing = isMissingRequiredValue(form.telefon);
    const emailMissing = isMissingRequiredValue(form.email);
    const districtMissing = isMissingRequiredValue(form.district);
    const neighborhoodMissing = isMissingRequiredValue(form.neighborhood);

    if (fullNameMissing || phoneMissing || emailMissing || (isDelivery && (districtMissing || neighborhoodMissing))) {
      setError('Lütfen Ad Soyad, Telefon, E-posta, İlçe ve Mahalle alanlarının tamamını doldurduğunuzdan emin olun.');
      return;
    }

    if (isDelivery && (!form.adres.trim() || !form.city.trim() || districtMissing)) {
      setError('Eve teslim için adres, şehir, ilçe ve mahalle alanları zorunludur.');
      return;
    }

    if (isDelivery && neighborhoodMissing) {
      setError('Lütfen mahalle seçimi yapın.');
      return;
    }

    if (isDeliveryZoneBlocked) {
      setError(deliveryZoneValidationMessage);
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
        setShowAuthModal(true);
        setError('Siparişi tamamlamak için giriş yapmanız gerekiyor.');
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
        price: Number(item.unitPrice ?? item.price ?? 0),
        quantity: item.quantity || 1,
        type: item.type || 'meal',
        cal: Number(item.cal ?? item.kcal ?? 0),
        protein: Number(item.protein ?? 0),
        carbs: Number(item.carbs ?? item.carb ?? 0),
        fats: Number(item.fats ?? 0),
      }));

      const composedAddress = isDelivery
        ? [form.adres, form.neighborhood, form.district, form.city].filter(Boolean).join(', ')
        : RESTAURANT_ADDRESS;
      const orderCity = isDelivery ? form.city : RESTAURANT_CITY;
      const orderDistrict = isDelivery ? form.district : RESTAURANT_DISTRICT;
      const orderDeliveryTimeType = isDelivery ? deliveryTimeType : 'immediate';
      const orderScheduledDate = isScheduledDelivery ? scheduledDate : null;
      const orderScheduledSlot = isScheduledDelivery ? scheduledSlot : null;

      const orderPayload = {
        status: 'pending',
        customer_name: form.adSoyad,
        customer_email: form.email.trim(),
        address: composedAddress,
        city: orderCity,
        district: orderDistrict,
        phone: form.telefon,
        items,
        delivery_method: deliveryMethod,
        delivery_time_type: orderDeliveryTimeType,
        scheduled_date: orderScheduledDate,
        scheduled_slot: orderScheduledSlot,
        user_id: user.id,
        total_amount: finalPayableTotal,
      };

      const { data: insertedOrder } = await insertOrderWithFallback(orderPayload);
      const finalOrderId = insertedOrder?.id ? String(insertedOrder.id) : '';

      if (!finalOrderId) {
        throw new Error('Sipariş kaydı oluşturulamadı.');
      }

      if (items.length > 0) {
        const orderItemsPayload = items.map((item) => ({
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
            await supabase.from('orders').update({ items }).eq('id', finalOrderId);
          } else {
            throw orderItemsError;
          }
        }
      }

      await awardMacroPoints(user.id, 100);

      // localStorage'ı clearCart() öncesi elle temizle.
      // clearCart(), setCart([]) çağırır ve ilgili useEffect'in localStorage'a
      // yazması bir sonraki render'da gerçekleşir. Eğer navigate() bileşeni
      // unmount ederse bu render hiç olmayabilir — eski sepet veritabanında
      // kalır. Dolayısıyla sepet anahtarını burada direkt siliyoruz.
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.setItem(`order_created_${orderOid}`, '1');
      localStorage.removeItem(`pending_order_${orderOid}`);
      localStorage.removeItem('latest_pending_order_oid');
      localStorage.removeItem('checkout_coupon_code');
      localStorage.removeItem('checkout_selected_address_id');
      clearCart();
      navigate(`/success?oid=${encodeURIComponent(orderOid)}`);
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
      setError('Sipariş kaydedilemedi. Lütfen tekrar deneyin.');
      setDebugError(readableError || 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  const cardClass = 'rounded-2xl border border-gray-100 bg-white shadow-sm';
  const infoSectionClass = 'rounded-2xl border border-gray-100 bg-white shadow-sm';

  if (isOrderSuccess) {
    return (
      <div className="app-page-padding min-h-screen bg-brand-white py-10 text-brand-dark">
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
            <h1 className="app-heading-primary mb-2">Siparişiniz Alındı!</h1>
            <p className="mb-0 font-google text-sm font-normal text-brand-dark/70">Siparişiniz hazırlanıyor, afiyet olsun.</p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/')}
              className="app-btn-green mt-7 inline-flex w-full items-center justify-center"
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
      <header className="app-page-padding sticky top-0 z-30 flex items-center justify-between border-b border-brand-white/10 bg-[#F0F0F0]/95 py-4 backdrop-blur-md">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full border border-brand-white/15 bg-[#F0F0F0] transition-transform active:scale-90 inline-flex items-center justify-center"
          aria-label="Geri"
        >
          <ChevronLeft size={18} className="text-brand-dark" />
        </motion.button>
        <div className="text-center leading-tight">
          <h1 className="app-heading-primary mb-0">Ödeme</h1>
          <p className="mb-0 font-google text-[10px] font-extralight uppercase tracking-widest text-brand-dark/60">Güvenli Ödeme</p>
        </div>
        <div className="w-10" />
      </header>

      <form id="checkout-form" onSubmit={handleSubmit} className="app-page-padding mx-auto flex-1 w-full max-w-lg space-y-5 overflow-y-auto pb-48 pt-3">
        {serviceNotice && (
          <div className="inline-flex w-full items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-google text-sm font-normal text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{serviceNotice}</span>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="app-heading-secondary mb-0">Teslimat Yöntemi</h2>
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
          <h2 className="app-heading-secondary mb-0">İletişim Bilgileri</h2>
          <div className="space-y-2">
            <input
              type="text"
              name="adSoyad"
              value={form.adSoyad}
              onChange={handleChange}
              placeholder="Ad Soyad"
              className="app-input"
              required
            />
            <input
              type="tel"
              name="telefon"
              value={form.telefon}
              onChange={handleChange}
              placeholder="Telefon"
              className="app-input"
              required
            />
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="E-posta"
              className="app-input"
              required
            />
          </div>
        </section>

        {isDelivery && (
          <section className={`${infoSectionClass} space-y-4 p-4`}>
            <h2 className="app-heading-secondary mb-0">Teslimat Adresi</h2>

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
                    value={RESTAURANT_CITY}
                    readOnly
                    disabled
                    className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark placeholder:text-brand-dark/60 disabled:opacity-100"
                  />
                </div>
                <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
                  <select
                    name="district"
                    value={form.district}
                    onChange={(e) => {
                      const nextDistrict = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        district: nextDistrict,
                        neighborhood: '',
                      }));
                    }}
                    className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark"
                    required={isDelivery}
                  >
                    <option value="">İlçe Seçiniz</option>
                    {districtOptions.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rounded-xl border border-brand-dark/10 bg-brand-white px-4 py-3.5">
                <select
                  name="neighborhood"
                  value={form.neighborhood}
                  onChange={handleChange}
                  className="input-no-stroke !border-none !outline-none !ring-0 !shadow-none w-full bg-transparent font-google text-sm font-normal text-brand-dark"
                  required={isDelivery}
                  disabled={!form.district}
                >
                  <option value="">{form.district ? 'Mahalle Seçiniz' : 'Önce İlçe Seçiniz'}</option>
                  {neighborhoodOptions.map((zone) => (
                    <option key={zone.id} value={zone.neighborhood}>{zone.neighborhood}</option>
                  ))}
                </select>
              </div>
              {(deliveryZonesLoading || deliveryZonesError) && (
                <p className="mb-0 text-xs text-brand-dark/60">
                  {deliveryZonesLoading ? 'Teslimat bölgeleri yükleniyor...' : deliveryZonesError}
                </p>
              )}
            </div>
          </section>
        )}

        <section className={`${infoSectionClass} space-y-3 p-4`}>
          <h2 className="app-heading-secondary mb-0 inline-flex items-center gap-2">
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
                  className="app-btn-green inline-flex items-center justify-center gap-2 rounded-xl px-3 text-sm disabled:opacity-60"
                >
                  {couponLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Kontrol...
                    </>
                  ) : (
                    'Uygula'
                  )}
                </button>
              )}
            </div>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            {couponInfo && (
              <motion.p
                key="coupon-success"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="text-xs text-brand-dark"
              >
                {couponInfo.code} uygulandı. İndirim:{' '}
                <span className="font-google font-medium">₺{Number(couponInfo.discountAmount || 0).toFixed(2)}</span>
              </motion.p>
            )}
            {!couponInfo && couponMessage && (
              <motion.p
                key="coupon-message"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="font-google text-xs font-extralight text-brand-dark/70"
              >
                {couponMessage}
              </motion.p>
            )}
            {couponError && (
              <motion.p
                key="coupon-error"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="text-xs text-[#98CD00]"
              >
                {couponError}
              </motion.p>
            )}
          </AnimatePresence>
        </section>

        <section className={`${cardClass} space-y-4 p-4`}>
          <h2 className="app-heading-secondary mb-0">Ödeme Yöntemi</h2>

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
        <div className="app-page-padding mx-auto max-w-lg rounded-t-3xl border-t border-brand-white/10 bg-[#F0F0F0]/95 pb-8 pt-5 shadow-[0_-14px_30px_rgba(32,32,32,0.45)] backdrop-blur">
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

          {isDeliveryZoneBlocked && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-500">
              {deliveryZoneValidationMessage}
            </div>
          )}
          {isBelowDeliveryMethodMinimum && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-600">
              {deliveryMethodMinimumMessage}
            </div>
          )}

          <div className="mb-4 space-y-2 rounded-xl border border-brand-dark/10 bg-brand-white p-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={isContractsAccepted}
                onChange={(e) => setIsContractsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#98CD00]"
              />
              <span className="font-google text-xs leading-relaxed text-brand-dark">
                <Link to="/kullanim-kosullari" className="font-medium underline underline-offset-2">
                  Ön Bilgilendirme Formu&apos;nu ve Mesafeli Satış Sözleşmesi&apos;ni
                </Link>{' '}
                okudum, onaylıyorum.
              </span>
            </label>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            form="checkout-form"
            disabled={loading || controlsLocked || isDeliveryZoneBlocked || isBelowDeliveryMethodMinimum || authLoading || !hasRequiredLegalApprovals}
            className="app-btn-green flex w-full items-center justify-center gap-3 shadow-[0_12px_24px_rgba(152,205,0,0.35)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
          >
            <span className="font-google text-lg font-medium">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  İşleniyor...
                </span>
              ) : controlsLocked ? 'Servis Kontrol Ediliyor...' : 'Siparişi Tamamla'}
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

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onPhoneContinue={() => navigate('/login')}
        onGoogleContinue={() => navigate('/login')}
        onAppleContinue={() => navigate('/login')}
      />
    </div>
  );
}
