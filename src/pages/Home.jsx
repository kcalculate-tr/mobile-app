import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Bike,
    ChevronDown,
    ChevronsRight,
    Menu,
    Plus,
    Check,
    MapPin,
    Beef,
    Flame,
    Leaf,
    GlassWater,
    Milk,
    Loader2,
    X,
} from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { useProducts, sortByProductOrder } from '../context/ProductContext';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatCurrency';
import { AnimatePresence, motion } from 'framer-motion';

const trLowerCase = (str) => String(str || '').toLocaleLowerCase('tr-TR');
const CATEGORY_ALL_LABEL = 'Tümü';
const SORT_OPTIONS = [
    { key: 'default', label: 'Varsayılan Sıralama' },
    { key: 'price_asc', label: 'Fiyata Göre Artan' },
    { key: 'price_desc', label: 'Fiyata Göre Azalan' },
    { key: 'calories', label: 'Kaloriye Göre' },
];
const HOW_IT_WORKS_STEPS = [
    {
        id: 'pick',
        icon: Menu,
        title: 'Paketini Seç',
        description: 'Hedefine uygun menü ya da paketi seç.',
    },
    {
        id: 'address',
        icon: MapPin,
        title: 'Adresini Gir',
        description: 'Teslimat adresini belirle.',
    },
    {
        id: 'delivery',
        icon: Bike,
        title: 'Kapına Gelsin',
        description: 'Siparişin sıcak ve hızlı gelsin.',
    },
];
const CATEGORY_ICONS = {
    'Yüksek Proteinli Sporcu': Beef,
    'Yüksek Proteinli Yağ Yakımı': Flame,
    'Dengeli ve Sağlıklı': Leaf,
    'Taze Sıkım Detoks': GlassWater,
    'Protein Shake': Milk,
};
// Veri normalleştirme ve sıralama yardımcıları ProductContext'e taşındı.

function getDisplayName(user) {
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    if (fullName && String(fullName).trim()) return String(fullName).trim();
    const email = String(user?.email || '').trim();
    if (!email) return 'Kullanıcı';
    return email.split('@')[0];
}

function getInitials(name, email) {
    const safeName = String(name || '').trim();
    if (safeName) {
        const parts = safeName.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
    return String(email || 'K').slice(0, 1).toUpperCase();
}

const HomeBanner = React.memo(function HomeBanner({ banners, bannersLoading }) {
    const bannerRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setCurrentIndex(0);
    }, [banners]);

    useEffect(() => {
        if (banners.length <= 1) return undefined;

        const interval = window.setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex === banners.length - 1 ? 0 : prevIndex + 1));
        }, 3000);

        return () => window.clearInterval(interval);
    }, [banners]);

    useEffect(() => {
        if (!bannerRef.current || banners.length === 0) return;

        const scrollContainer = bannerRef.current;
        const targetCard = scrollContainer.children[currentIndex];
        if (!targetCard) return;

        const scrollLeft = targetCard.offsetLeft - (scrollContainer.clientWidth / 2) + (targetCard.clientWidth / 2);
        scrollContainer.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });
    }, [currentIndex, banners]);

    return (
        <section className="mt-6 mb-8 w-full">
            {banners.length > 0 ? (
                <div className="relative w-full">
                    <div
                        ref={bannerRef}
                        className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory px-8"
                        style={{ scrollBehavior: 'smooth' }}
                    >
                        {banners.map((item, index) => (
                            <div
                                key={`banner-${String(item?.id ?? index)}`}
                                className="min-w-full snap-center relative flex justify-center"
                            >
                                <div className="w-full rounded-2xl overflow-hidden">
                                    <img
                                        src={item.image_url || ''}
                                        alt={item.title || "Kampanya"}
                                        className="h-[200px] w-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                        onError={(event) => {
                                            event.currentTarget.style.display = 'none';
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : bannersLoading ? (
                <div className="px-4 w-full">
                    <div className="h-[200px] w-full rounded-2xl bg-gray-200 animate-pulse"></div>
                </div>
            ) : null}
        </section>
    );
});

function useCartQuantityActions() {
    const { cart, addToCart, removeFromCart, updateQuantity } = useContext(CartContext);

    const cartQuantityMap = useMemo(() => {
        const next = new Map();
        (cart || []).forEach((item) => {
            const key = String(item?.id ?? '');
            if (!key) return;
            next.set(key, Math.max(0, Number(item?.quantity || 0)));
        });
        return next;
    }, [cart]);

    const handleIncreaseFromCard = useCallback((event, product, currentQty) => {
        event.stopPropagation();
        if (!product?.isAvailable) return;

        if (currentQty > 0) {
            updateQuantity(product.id, currentQty + 1);
            return;
        }

        addToCart(product, 1);
    }, [addToCart, updateQuantity]);

    const handleDecreaseFromCard = useCallback((event, product, currentQty) => {
        event.stopPropagation();
        if (currentQty <= 0) return;

        if (currentQty === 1) {
            removeFromCart(product.id);
            return;
        }

        updateQuantity(product.id, currentQty - 1);
    }, [removeFromCart, updateQuantity]);

    return {
        cartQuantityMap,
        handleIncreaseFromCard,
        handleDecreaseFromCard,
    };
}

const HomeHeader = React.memo(function HomeHeader({
    selectedAddress,
    addresses,
    isAddressMenuOpen,
    addressMenuRef,
    setIsAddressMenuOpen,
    setSelectedAddress,
    setIsHowItWorksOpen,
    navigate,
}) {
    const { user: currentUser, avatarUrl, avatarUploading, uploadAvatar } = useContext(AuthContext);
    const avatarInputRef = useRef(null);

    const displayName = useMemo(() => getDisplayName(currentUser), [currentUser]);
    const userInitials = useMemo(() => getInitials(displayName, currentUser?.email), [displayName, currentUser?.email]);

    const handleAvatarUpload = useCallback(async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            await uploadAvatar(file);
        } catch (err) {
            console.error('Avatar yüklenemedi:', err);
        }
    }, [uploadAvatar]);

    return (
        <header className="relative rounded-b-[1.8rem] bg-[linear-gradient(to_bottom_left,#FFFADC_0%,#B6F500_33%,#A4DD00_66%,#98CD00_100%)] px-4 pt-4 pb-4 shadow-[0_12px_24px_rgba(152,205,0,0.24)] min-[390px]:px-5 min-[414px]:pt-5 min-[430px]:px-6">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2 flex-1">
                    <div className="relative h-10 w-10 shrink-0">
                        <div
                            className="h-10 w-10 overflow-hidden rounded-full border-[2px] border-white bg-brand-white"
                            aria-label="Profil fotoğrafı"
                        >
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    className="h-full w-full object-cover"
                                    alt={displayName}
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-[#98CD00] text-xs font-bold text-[#F0F0F0]">
                                    {userInitials}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={avatarUploading}
                            className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#98CD00] text-white disabled:opacity-70"
                            aria-label="Profil fotoğrafı yükle"
                        >
                            {avatarUploading ? (
                                <Loader2 size={10} className="animate-spin" />
                            ) : (
                                <Plus size={10} />
                            )}
                        </button>
                    </div>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={avatarUploading}
                    />

                    <button
                        onClick={() => setIsAddressMenuOpen((prev) => !prev)}
                        className="min-w-0 inline-flex items-center gap-1.5 text-left text-[#202020]"
                    >
                        <MapPin size={13} className="shrink-0" />
                        <span className="min-w-0">
                            <span className="block truncate font-zalando text-[14px] font-semibold leading-tight text-[#202020]">
                                {selectedAddress?.full_address || selectedAddress?.title || 'Adres seçin'}
                            </span>
                            <span className="block truncate font-google text-[10px] font-extralight text-[#202020]/80">
                                {selectedAddress?.city && selectedAddress?.district
                                    ? `${selectedAddress.city} / ${selectedAddress.district}`
                                    : 'İstanbul / Kadıköy'}
                            </span>
                        </span>
                        <ChevronDown size={14} className="shrink-0" />
                    </button>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate('/offers');
                    }}
                    aria-label="Bildirimler"
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-white bg-[#B6F500] text-[#202020]"
                >
                    <Bell size={18} />
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-brand-dark bg-[#FFFADC] px-1 text-xs font-semibold text-[#202020]">
                        7
                    </span>
                </button>
            </div>

            <div className="mt-3.5 flex min-h-[9.5rem] items-end justify-between gap-3 min-[390px]:min-h-[10rem]">
                <div>
                    <h1 className="font-zalando text-[48px] font-extrabold tracking-wide text-[#F0F0F0] leading-[48px]">
                        Sağlıklı
                        <br />
                        Kcal.
                    </h1>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsHowItWorksOpen(true)}
                        className="mt-3 inline-flex items-center rounded-full border border-[#F0F0F0] bg-transparent px-4 py-2 text-sm font-bold text-[#F0F0F0]"
                    >
                        Nasıl Çalışır?
                    </motion.button>
                </div>
                <img
                    src="/images/kcal-koli.png"
                    alt="Kcal koli"
                    className="-ml-4 w-48 max-w-none scale-110 object-contain min-[390px]:w-52"
                />
            </div>

            {isAddressMenuOpen && (
                <div
                    ref={addressMenuRef}
                    className="absolute left-4 right-4 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-[#F0F0F0] shadow-[0_20px_40px_rgba(32,32,32,0.22)] min-[390px]:left-5 min-[390px]:right-5 min-[430px]:left-6 min-[430px]:right-6"
                >
                    <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                        {addresses.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-brand-dark/60">Kayıtlı adres bulunamadı.</div>
                        ) : (
                            addresses.map((address, index) => {
                                const isSelected = String(selectedAddress?.id) === String(address.id);
                                return (
                                    <button
                                        key={`address-${String(address?.id ?? index)}`}
                                        onClick={() => {
                                            setSelectedAddress(address);
                                            setIsAddressMenuOpen(false);
                                        }}
                                        className={`w-full rounded-xl px-3 py-2.5 text-left ${
                                            isSelected ? 'bg-[#98CD00] text-[#F0F0F0]' : 'text-brand-dark/90 hover:bg-brand-dark/[0.03]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="mb-0 truncate text-sm font-bold">{address.title || 'Adres'}</p>
                                                <p className={`mb-0 truncate text-xs ${isSelected ? 'text-[#F0F0F0]/80' : 'text-brand-dark/65'}`}>
                                                    {address.full_address || 'Adres detayı yok'}
                                                </p>
                                            </div>
                                            {isSelected && <Check size={16} className="shrink-0" />}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    <div className="border-t border-brand-white/10 p-2">
                        <button
                            onClick={() => {
                                setIsAddressMenuOpen(false);
                                navigate('/profile/addresses');
                            }}
                            className="w-full rounded-xl bg-brand-dark/[0.04] px-3 py-2.5 text-left text-sm font-bold text-brand-dark hover:bg-brand-dark/[0.07]"
                        >
                            + Yeni Adres Ekle
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
});

const FavoritesRow = React.memo(function FavoritesRow({
    loading,
    error,
    favoriteProducts,
    hasNoProducts,
    fetchProducts,
    onProductNavigate,
}) {
    const { cartQuantityMap, handleIncreaseFromCard, handleDecreaseFromCard } = useCartQuantityActions();

    return (
        <section className="px-4 pt-4 min-[390px]:px-5 min-[430px]:px-6">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="mb-0 font-zalando text-lg font-semibold leading-none text-brand-dark">Favori Lezzetler</h3>
                <span className="inline-flex items-center gap-1 font-google text-[11px] font-extralight text-brand-dark/55">
                    Kaydır
                    <ChevronsRight size={14} />
                </span>
            </div>

            {loading ? (
                <p className="py-8 text-center text-sm text-brand-dark/60">Yükleniyor...</p>
            ) : error ? (
                <div className="rounded-2xl bg-[#F0F0F0] p-4 text-center shadow-[0_8px_18px_rgba(32,32,32,0.08)]">
                    <p className="text-sm text-brand-dark">{error}</p>
                    <button
                        onClick={fetchProducts}
                        className="mt-2 rounded-full bg-[#98CD00] px-4 py-2 text-xs font-bold text-[#F0F0F0]"
                    >
                        Tekrar Dene
                    </button>
                </div>
            ) : favoriteProducts.length === 0 ? (
                <p className="py-6 text-sm text-brand-dark/60">
                    {hasNoProducts ? 'Şu an ürün bulunamadı.' : 'Henüz favori ürün bulunmuyor.'}
                </p>
            ) : (
                <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 min-[390px]:-mx-5 min-[390px]:gap-2.5 min-[390px]:px-5 min-[430px]:-mx-6 min-[430px]:px-6">
                    {favoriteProducts.map((p, index) => {
                        const cartQty = cartQuantityMap.get(String(p.id)) || 0;
                        return (
                            <article
                                key={`deal-${String(p?.id ?? `idx-${index}`)}`}
                                onClick={() => {
                                    if (!p.isAvailable || !p?.id) return;
                                    onProductNavigate(p.id);
                                }}
                                className={`flex h-full w-[214px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[#F0F0F0] shadow-[0_8px_20px_rgba(32,32,32,0.08)] min-[390px]:w-[226px] min-[414px]:w-[234px] min-[430px]:w-[242px] ${
                                    p.isAvailable && p?.id ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'
                                }`}
                            >
                                <div className="relative aspect-[1260/1025] w-full overflow-hidden bg-brand-white">
                                    <img
                                        src={p.img}
                                        className="h-full w-full object-contain"
                                        alt={p.name}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <span className="absolute left-2 top-2 inline-flex items-center rounded-md bg-brand-white px-2 py-1 font-google text-[9px] font-extralight text-[#98CD00] shadow-[0_2px_6px_rgba(32,32,32,0.12)] min-[390px]:text-[10px]">
                                        {Math.max(0, Math.round(Number(p.cal || 0)))} kcal
                                    </span>
                                </div>
                                <div className="flex flex-1 flex-col space-y-0.5 p-2 min-[390px]:p-2.5">
                                    <div className="flex min-w-0 items-start justify-between gap-2">
                                        <h4
                                            className="mb-1 min-h-[40px] min-w-0 break-words text-[12px] font-zalando font-semibold leading-tight text-brand-dark"
                                            style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {p.name}
                                        </h4>
                                    </div>
                                    <p className="mb-0 line-clamp-1 font-google text-[12px] font-thin leading-snug text-brand-dark/60">{p.desc}</p>
                                    <div className="mt-auto flex items-center justify-between pt-0.5">
                                        <span className="font-google text-[14px] font-medium leading-tight text-brand-dark">{formatCurrency(p.price)}</span>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            {cartQty > 0 ? (
                                                <div className="inline-flex items-center gap-1 rounded-full bg-[#98CD00] px-1 py-0.5 text-[#F0F0F0]">
                                                    <motion.button
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={(e) => handleDecreaseFromCard(e, p, cartQty)}
                                                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-white/15 text-[11px] font-black leading-none"
                                                    >
                                                        -
                                                    </motion.button>
                                                    <span className="relative inline-flex min-w-[18px] justify-center overflow-hidden text-center font-google text-[14px] font-medium">
                                                        <AnimatePresence mode="wait" initial={false}>
                                                            <motion.span
                                                                key={`fav-qty-${p.id}-${cartQty}`}
                                                                initial={{ y: 10, opacity: 0 }}
                                                                animate={{ y: 0, opacity: 1 }}
                                                                exit={{ y: -10, opacity: 0 }}
                                                                transition={{ duration: 0.18 }}
                                                            >
                                                                {cartQty}
                                                            </motion.span>
                                                        </AnimatePresence>
                                                    </span>
                                                    <motion.button
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={(e) => handleIncreaseFromCard(e, p, cartQty)}
                                                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-white/15 text-[11px] font-black leading-none"
                                                    >
                                                        +
                                                    </motion.button>
                                                </div>
                                            ) : (
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => handleIncreaseFromCard(e, p, cartQty)}
                                                    disabled={!p.isAvailable}
                                                    className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#98CD00] text-[#F0F0F0] disabled:opacity-50 min-[390px]:h-6 min-[390px]:w-6"
                                                >
                                                    <Plus className="h-[11px] w-[11px] min-[390px]:h-3 min-[390px]:w-3" />
                                                </motion.button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
});

const ProductsGrid = React.memo(function ProductsGrid({
    error,
    recommendedProducts,
    hasNoProducts,
    onProductNavigate,
    fetchProducts,
}) {
    const { cartQuantityMap, handleIncreaseFromCard, handleDecreaseFromCard } = useCartQuantityActions();

    return (
        <section className="space-y-2.5 px-4 pb-24 pt-2.5 min-[390px]:px-5 min-[430px]:px-6">
            <div className="flex items-center justify-between gap-2">
                <h3 className="mb-0 font-zalando text-lg font-semibold leading-none text-brand-dark">Tüm Ürünler</h3>
            </div>

            {error ? (
                <div className="rounded-2xl bg-[#F0F0F0] p-6 text-center shadow-[0_8px_18px_rgba(32,32,32,0.08)]">
                    <p className="text-sm font-medium text-brand-dark">{error}</p>
                    <button
                        onClick={fetchProducts}
                        className="mt-3 rounded-full bg-[#98CD00] px-5 py-2.5 text-xs font-bold text-[#F0F0F0] active:scale-95 transition-transform"
                    >
                        Tekrar Dene
                    </button>
                </div>
            ) : recommendedProducts.length === 0 ? (
                <p className="py-3 text-sm text-brand-dark/60">
                    {hasNoProducts ? 'Şu an ürün bulunamadı.' : 'Bu kategoride öne çıkan ürün yok.'}
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-1.5 pb-2 min-[390px]:gap-2 min-[430px]:gap-2.5">
                    {recommendedProducts.map((p, index) => {
                        const cartQty = cartQuantityMap.get(String(p.id)) || 0;
                        return (
                            <article
                                key={`recommended-${String(p?.id ?? `idx-${index}`)}`}
                                onClick={() => {
                                    if (!p.isAvailable || !p?.id) return;
                                    onProductNavigate(p.id);
                                }}
                                className={`flex h-full flex-col overflow-hidden rounded-2xl bg-[#F0F0F0] shadow-[0_8px_18px_rgba(32,32,32,0.08)] ${
                                    p.isAvailable && p?.id ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'
                                }`}
                            >
                                <div className="relative aspect-[1260/1025] w-full overflow-hidden bg-brand-white">
                                    <img
                                        src={p.img}
                                        className="h-full w-full object-contain"
                                        alt={p.name}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <span className="absolute left-2 top-2 shrink-0 rounded-md bg-brand-white px-2 py-1 font-google text-[8px] font-extralight text-[#98CD00] shadow-[0_2px_6px_rgba(32,32,32,0.08)] min-[390px]:text-[9px]">
                                        {Math.max(0, Math.round(Number(p.cal || 0)))} kcal
                                    </span>
                                </div>
                                <div className="flex flex-1 flex-col space-y-0.5 p-2 min-[390px]:p-2.5">
                                    <div className="flex min-w-0 items-start justify-between gap-1.5">
                                        <h4
                                            className="mb-1 min-h-[40px] min-w-0 break-words text-[12px] font-zalando font-semibold leading-tight text-brand-dark"
                                            style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {p.name}
                                        </h4>
                                    </div>
                                    <p className="mb-0 line-clamp-1 font-google text-[12px] font-thin leading-snug text-brand-dark/55">{p.desc}</p>
                                    <div className="mt-auto flex items-center justify-between pt-0">
                                        <span className="font-google text-[14px] font-medium text-brand-dark">{formatCurrency(p.price)}</span>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            {cartQty > 0 ? (
                                                <div className="inline-flex items-center gap-1 rounded-full bg-[#98CD00] px-1 py-0.5 text-[#F0F0F0]">
                                                    <motion.button
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={(e) => handleDecreaseFromCard(e, p, cartQty)}
                                                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-white/15 text-[11px] font-black leading-none"
                                                    >
                                                        -
                                                    </motion.button>
                                                    <span className="relative inline-flex min-w-[18px] justify-center overflow-hidden text-center font-google text-[14px] font-medium">
                                                        <AnimatePresence mode="wait" initial={false}>
                                                            <motion.span
                                                                key={`grid-qty-${p.id}-${cartQty}`}
                                                                initial={{ y: 10, opacity: 0 }}
                                                                animate={{ y: 0, opacity: 1 }}
                                                                exit={{ y: -10, opacity: 0 }}
                                                                transition={{ duration: 0.18 }}
                                                            >
                                                                {cartQty}
                                                            </motion.span>
                                                        </AnimatePresence>
                                                    </span>
                                                    <motion.button
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={(e) => handleIncreaseFromCard(e, p, cartQty)}
                                                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-white/15 text-[11px] font-black leading-none"
                                                    >
                                                        +
                                                    </motion.button>
                                                </div>
                                            ) : (
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => handleIncreaseFromCard(e, p, cartQty)}
                                                    disabled={!p.isAvailable}
                                                    className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#98CD00] text-[#F0F0F0] disabled:opacity-50 min-[390px]:h-6 min-[390px]:w-6"
                                                >
                                                    <Plus className="h-[11px] w-[11px] min-[390px]:h-3 min-[390px]:w-3" />
                                                </motion.button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
});

export default function Home() {
    const navigate = useNavigate();

    // ── Context'ten gelen global veri (bir kez çekildi, sayfa geçişlerinde korunur) ──
    const {
        products: rawProducts,
        favoriteProducts,
        categoryRows,
        banners,
        bannersLoading,
        loading,
        error,
        refetchProducts,
    } = useProducts();

    // ── Sadece bu sayfaya ait UI state'i ─────────────────────────────────────
    const [activeCategory, setActiveCategory] = useState(CATEGORY_ALL_LABEL);
    const [searchTerm] = useState('');
    const [sortMode, setSortMode] = useState('default');
    const [addresses, setAddresses] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [isAddressMenuOpen, setIsAddressMenuOpen] = useState(false);
    const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
    const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);
    const addressMenuRef = useRef(null);

    // ── Adres çekme — isMounted guard ────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        async function fetchAddresses() {
            try {
                const {
                    data: { user },
                    error: userError,
                } = await supabase.auth.getUser();

                if (!isMounted) return;

                if (userError || !user) {
                    setAddresses([]);
                    setSelectedAddress(null);
                    return;
                }

                const { data, error: addrError } = await supabase
                    .from('addresses')
                    .select('id,title,full_address,city,district,created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (!isMounted) return;

                if (addrError) {
                    setAddresses([]);
                    setSelectedAddress(null);
                    return;
                }

                const rows = data || [];
                setAddresses(rows);
                setSelectedAddress((prev) => {
                    if (prev) {
                        const stillExists = rows.find((row) => String(row.id) === String(prev.id));
                        if (stillExists) return stillExists;
                    }
                    return rows[0] || null;
                });
            } catch {
                if (!isMounted) return;
                setAddresses([]);
                setSelectedAddress(null);
            }
        }

        fetchAddresses();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!isAddressMenuOpen) return undefined;

        const handleOutsideClick = (event) => {
            if (!addressMenuRef.current) return;
            if (!addressMenuRef.current.contains(event.target)) {
                setIsAddressMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [isAddressMenuOpen]);

    const normalizeCategoryValue = useCallback((value) => (
        String(value || '').trim().toLowerCase()
    ), []);

    const categories = useMemo(() => {
        const allCategory = { id: 'all', name: CATEGORY_ALL_LABEL };
        const dbCategories = categoryRows
            .map((item) => ({
                id: String(item?.id ?? item?.name ?? ''),
                name: String(item?.name || '').trim(),
            }))
            .filter((item) => item.name);

        return [allCategory, ...dbCategories];
    }, [categoryRows]);

    const effectiveActiveCategory = useMemo(() => {
        const hasActive = categories.some((category) => normalizeCategoryValue(category.name) === normalizeCategoryValue(activeCategory));
        return hasActive ? activeCategory : CATEGORY_ALL_LABEL;
    }, [activeCategory, categories, normalizeCategoryValue]);

    // Sıralama: context'teki ham liste üzerinde anlık (re-fetch yok)
    const sortedProducts = useMemo(() => {
        if (sortMode === 'price_asc')
            return [...rawProducts].sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
        if (sortMode === 'price_desc')
            return [...rawProducts].sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
        if (sortMode === 'calories')
            return [...rawProducts].sort((a, b) => Number(a?.cal || 0) - Number(b?.cal || 0));
        return rawProducts; // context zaten sortByProductOrder ile sıraladı
    }, [rawProducts, sortMode]);

    const searchFilteredProducts = useMemo(() => sortedProducts.filter((p) => {
        if (!searchTerm.trim()) return true;
        const search = trLowerCase(searchTerm);
        const nameText = trLowerCase(p.name || p.title);
        const descText = trLowerCase(p.desc || p.description);
        const categoryText = trLowerCase(p.category);

        return nameText.includes(search) || descText.includes(search) || categoryText.includes(search);
    }), [sortedProducts, searchTerm]);

    const categoryFilteredProducts = useMemo(() => searchFilteredProducts.filter((p) => {
        const normalizedSelected = normalizeCategoryValue(effectiveActiveCategory);
        const showAll = normalizedSelected === 'tümü' || normalizedSelected === 'all';
        if (showAll) return true;
        return normalizeCategoryValue(p?.category) === normalizedSelected;
    }), [searchFilteredProducts, effectiveActiveCategory, normalizeCategoryValue]);

    const recommendedProducts = categoryFilteredProducts;
    const hasNoProducts = !loading && !error && rawProducts.length === 0;

    const handleSortChange = useCallback((nextSortKey) => {
        setSortMode(nextSortKey);
        setIsSortSheetOpen(false);
    }, []);

    const handleProductNavigate = useCallback((id) => {
        if (!id) return;
        navigate(`/product/${id}`);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-[#F0F0F0] text-brand-dark pb-24">
            <HomeHeader
                selectedAddress={selectedAddress}
                addresses={addresses}
                isAddressMenuOpen={isAddressMenuOpen}
                addressMenuRef={addressMenuRef}
                setIsAddressMenuOpen={setIsAddressMenuOpen}
                setSelectedAddress={setSelectedAddress}
                setIsHowItWorksOpen={setIsHowItWorksOpen}
                navigate={navigate}
            />

            <AnimatePresence>
                {isHowItWorksOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-dark/35 px-5"
                        onClick={() => setIsHowItWorksOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="w-full max-w-sm rounded-3xl bg-brand-white p-4 shadow-[0_22px_44px_rgba(32,32,32,0.24)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="mb-0 text-lg font-bold text-brand-dark">Nasıl Çalışır?</h3>
                                <button
                                    type="button"
                                    onClick={() => setIsHowItWorksOpen(false)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg text-brand-dark"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="space-y-2.5">
                                {HOW_IT_WORKS_STEPS.map((step, index) => {
                                    const Icon = step.icon;
                                    return (
                                        <div key={step.id} className="flex items-start gap-3 rounded-2xl bg-brand-bg p-3">
                                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-white text-brand-primary">
                                                <Icon size={16} />
                                            </span>
                                            <div>
                                                <p className="mb-0 text-sm font-bold text-brand-dark">{`${index + 1}. ${step.title}`}</p>
                                                <p className="mb-0 mt-0.5 text-xs text-brand-dark/70">{step.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <FavoritesRow
                loading={loading}
                error={error}
                favoriteProducts={favoriteProducts}
                hasNoProducts={hasNoProducts}
                fetchProducts={refetchProducts}
                onProductNavigate={handleProductNavigate}
            />

            <HomeBanner banners={banners} bannersLoading={bannersLoading} />

            <section className="px-4 pt-3 min-[390px]:px-5 min-[430px]:px-6">
                <div className="mb-2.5 flex items-center justify-between">
                    <h3 className="mb-0 font-zalando text-lg font-semibold leading-none text-brand-dark">Kategoriler</h3>
                    <span className="font-google text-xs font-extralight text-brand-dark/50">Kaydır &raquo;</span>
                </div>

                <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-0.5 min-[390px]:gap-2">
                    {categories.map((c, index) => {
                        const isActive = normalizeCategoryValue(effectiveActiveCategory) === normalizeCategoryValue(c.name);
                        const Icon = CATEGORY_ICONS[c.name] || null;
                        return (
                            <motion.button
                                key={`category-${String(c?.id ?? c?.name ?? index)}`}
                                onClick={() => setActiveCategory(c.name)}
                                whileTap={{ scale: 0.95 }}
                                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 font-google text-[10px] font-medium transition-colors min-[390px]:px-3 min-[390px]:text-[11px] ${
                                    isActive
                                        ? 'bg-[#98CD00] text-[#F0F0F0]'
                                        : 'bg-[#F0F0F0] text-[#98CD00]'
                                }`}
                            >
                                {Icon && <Icon size={13} className="shrink-0" />}
                                <span className="font-zalando font-semibold">{c.name}</span>
                            </motion.button>
                        );
                    })}
                </div>
            </section>

            <ProductsGrid
                error={error}
                recommendedProducts={recommendedProducts}
                hasNoProducts={hasNoProducts}
                onProductNavigate={handleProductNavigate}
                fetchProducts={refetchProducts}
            />

            <AnimatePresence>
                {isSortSheetOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-brand-dark/35"
                        onClick={() => setIsSortSheetOpen(false)}
                    >
                        <motion.div
                            initial={{ y: 28, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 28, opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-brand-white p-4 shadow-[0_-18px_36px_rgba(32,32,32,0.18)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">Sıralama</h3>
                                <button
                                    type="button"
                                    onClick={() => setIsSortSheetOpen(false)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg text-brand-dark"
                                    aria-label="Kapat"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            <div className="space-y-2 pb-2">
                                {SORT_OPTIONS.map((option) => {
                                    const active = sortMode === option.key;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => handleSortChange(option.key)}
                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-3 font-google text-sm font-medium ${
                                                active ? 'bg-[#98CD00] text-[#F0F0F0]' : 'bg-brand-bg text-brand-dark'
                                            }`}
                                        >
                                            <span>{option.label}</span>
                                            {active && <Check size={16} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
