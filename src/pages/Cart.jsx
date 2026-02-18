import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { formatCurrency } from '../utils/formatCurrency';
import { AnimatePresence, motion } from 'framer-motion';

// Hızlı geri alma için: beğenmezsen bunu `false` yapman yeterli.
const SHOW_CART_MACRO_BADGES = true;
const LIST_STAGGER = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.04,
    },
  },
};
const LIST_ITEM = {
  initial: { y: 14, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.28, ease: 'easeOut' } },
};
const MACRO_DEFINITIONS = [
  { key: 'kcal', label: 'Kalori', suffix: ' kcal', color: '#F97316', max: 1200, borderClass: 'border-orange-400' },
  { key: 'protein', label: 'Protein', suffix: 'g', color: '#3B82F6', max: 120, borderClass: 'border-blue-400' },
  { key: 'carbs', label: 'Karb', suffix: 'g', color: '#EAB308', max: 160, borderClass: 'border-yellow-400' },
  { key: 'fats', label: 'Yağ', suffix: 'g', color: '#EF4444', max: 80, borderClass: 'border-red-400' },
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMacroValuesFromItem(item) {
  return {
    kcal: Math.max(0, Math.round(toNumber(item?.cal ?? item?.kcal ?? item?.calories))),
    protein: Math.max(0, Math.round(toNumber(item?.protein))),
    carbs: Math.max(0, Math.round(toNumber(item?.carbs))),
    fats: Math.max(0, Math.round(toNumber(item?.fats ?? item?.fat))),
  };
}

function MacroGrid({ values, compact = false }) {
  const radius = compact ? 10 : 12;
  const stroke = compact ? 2.6 : 3;
  const viewBoxSize = 36;
  const circleCenter = viewBoxSize / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
      {MACRO_DEFINITIONS.map((macro) => {
        const amount = Math.max(0, Math.round(toNumber(values?.[macro.key])));
        const ratio = Math.min(100, (amount / macro.max) * 100);
        const dashOffset = circumference - ((ratio / 100) * circumference);

        return (
          <div
            key={macro.key}
            className={`rounded-2xl border ${macro.borderClass} bg-brand-white ${compact ? 'p-2' : 'p-3'}`}
          >
            <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
              <div className={`relative shrink-0 ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}>
                <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="h-full w-full">
                  <circle
                    cx={circleCenter}
                    cy={circleCenter}
                    r={radius}
                    fill="none"
                    stroke="#F0F0F0"
                    strokeWidth={stroke}
                  />
                  <circle
                    cx={circleCenter}
                    cy={circleCenter}
                    r={radius}
                    fill="none"
                    stroke={macro.color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${circleCenter} ${circleCenter})`}
                  />
                </svg>
                <span
                  className={`absolute inset-0 m-auto rounded-full ${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'}`}
                  style={{ backgroundColor: macro.color }}
                />
              </div>

              <div className="min-w-0">
                <p className={`mb-0 font-extrabold leading-none text-brand-dark ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
                  {amount}
                  {macro.suffix}
                </p>
                <p className={`mb-0 mt-1 leading-none text-brand-dark/60 ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
                  {macro.label}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Cart() {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart, clearCart, totalAmount } = useContext(CartContext);
  const [promoCode, setPromoCode] = useState('');
  const [promoHint, setPromoHint] = useState('');

  const deliveryFee = 0;
  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    [cart]
  );
  const cartMacroTotals = useMemo(() => {
    return cart.reduce((totals, item) => {
      const quantity = Math.max(0, Number(item?.quantity || 0));
      const values = getMacroValuesFromItem(item);

      totals.kcal += values.kcal * quantity;
      totals.protein += values.protein * quantity;
      totals.carbs += values.carbs * quantity;
      totals.fats += values.fats * quantity;
      return totals;
    }, {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
    });
  }, [cart]);
  const payableTotal = useMemo(() => totalAmount + deliveryFee, [totalAmount, deliveryFee]);

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-brand-dark">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-36">
        <header className="sticky top-0 z-40 border-b border-brand-white/10 bg-[#F0F0F0]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-white/15 bg-[#F0F0F0]"
              aria-label="Geri"
            >
              <ChevronLeft size={18} className="text-brand-dark" />
            </motion.button>

            <div className="flex-1 text-center">
              <h1 className="mb-0 text-xl text-brand-dark">Sepetim</h1>
              <p className="mb-0 text-[11px] text-brand-dark/55">{itemCount} ürün</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={clearCart}
              className="inline-flex h-10 items-center justify-center rounded-full border border-brand-white/15 bg-[#F0F0F0] px-3 text-xs font-bold text-brand-dark/80"
              aria-label="Sepeti temizle"
            >
              Temizle
            </motion.button>
          </div>
        </header>

        <main className="flex-1 space-y-4 px-5 py-4">
          {cart.length === 0 ? (
            <div className="rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-7 text-center">
              <ShoppingBag size={26} className="mx-auto text-brand-dark/60" />
              <p className="mt-3 text-brand-dark/65">Sepetiniz şu anda boş.</p>
              <button
                onClick={() => navigate('/')}
                className="mt-2 rounded-full bg-[#98CD00] px-4 py-2 text-sm font-bold text-[#F0F0F0]"
              >
                Ürünlere Dön
              </button>
            </div>
          ) : (
            <>
              <motion.div variants={LIST_STAGGER} initial="initial" animate="animate" className="space-y-4">
              {cart.map((item) => (
                <motion.article key={item.id} variants={LIST_ITEM} className="rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-3.5">
                  <div className="flex gap-3">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-brand-white">
                      {item.img || item.image ? (
                        <img
                          src={item.img || item.image}
                          alt={item.name}
                          className="h-full w-full bg-brand-white object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-bold text-brand-dark/65">
                          Paket
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate pr-1 text-base font-bold text-brand-dark">{item.name}</h3>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => removeFromCart(item.id)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0F0F0] text-brand-dark/60"
                          aria-label="Kaldır"
                        >
                          <Trash2 size={13} />
                        </motion.button>
                      </div>

                      <p className="mb-0 mt-1 line-clamp-1 text-xs text-brand-dark/55">{item.desc || item.description}</p>

                      {SHOW_CART_MACRO_BADGES && (
                        <div className="mt-2.5">
                          <MacroGrid values={getMacroValuesFromItem(item)} compact />
                        </div>
                      )}

                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <p className="mb-0 text-[11px] font-medium text-brand-dark/45">
                            Birim <span className="font-price font-semibold">{formatCurrency(item.price)}</span>
                          </p>
                          <p className="font-price mb-0 text-lg font-semibold text-brand-dark">
                            {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
                          </p>
                        </div>

                        <div className="inline-flex items-center rounded-full border border-brand-white/10 bg-[#F0F0F0] p-1">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-dark/70"
                            aria-label="Azalt"
                          >
                            <Minus size={15} />
                          </motion.button>
                          <span className="relative inline-flex w-8 justify-center overflow-hidden text-center text-lg font-bold text-brand-dark">
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={`cart-qty-${item.id}-${item.quantity || 1}`}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -10, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                              >
                                {item.quantity || 1}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#98CD00] text-[#F0F0F0]"
                            aria-label="Arttır"
                          >
                            <Plus size={15} />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
              </motion.div>

              <div className="rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-3">
                <div className="relative flex items-center">
                  <input
                    className="input-no-stroke w-full rounded-xl border-none bg-[#F0F0F0] py-3 pl-4 pr-24 text-sm text-brand-dark placeholder:text-brand-dark/35 outline-none"
                    placeholder="Kupon kodu"
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => {
                      if (!promoCode.trim()) {
                        setPromoHint('Önce bir kupon kodu girin.');
                        return;
                      }
                      setPromoHint('Kupon uygulaması ödeme adımında yapılır.');
                    }}
                    className="absolute right-1.5 rounded-lg bg-[#98CD00] px-4 py-2 text-xs font-bold text-[#F0F0F0]"
                  >
                    Uygula
                  </motion.button>
                </div>
                {promoHint && <p className="mb-0 mt-2 text-[11px] text-brand-dark/60">{promoHint}</p>}
              </div>

              <div className="rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-4">
                <div className="mb-3 rounded-2xl border border-brand-primary/20 bg-brand-bg p-3">
                  <p className="mb-2 text-xs font-semibold text-brand-dark/65">Sepet Toplam Makro</p>
                  <MacroGrid values={cartMacroTotals} compact />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-brand-white/10 pt-3">
                  <span className="text-lg font-bold text-brand-dark">Toplam</span>
                  <span className="font-price text-2xl font-semibold text-brand-dark">{formatCurrency(payableTotal)}</span>
                </div>
              </div>
            </>
          )}
        </main>

        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-brand-white/10 bg-[#F0F0F0]/95 px-5 pb-[max(1.6rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
            <div className="mx-auto max-w-md">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/checkout')}
                className="flex w-full items-center justify-between rounded-full bg-[#98CD00] px-6 py-4 text-lg font-google font-medium text-[#F0F0F0] transition-transform active:scale-[0.98]"
              >
                <span>Ödemeye Geç</span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-5 w-px bg-brand-white/35" />
                  <span className="font-price font-semibold">{formatCurrency(payableTotal)}</span>
                </span>
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
