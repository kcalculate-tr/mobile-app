import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  HelpCircle,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { buildCartLineKey } from '../context/CartContext';
import { useProducts } from '../context/ProductContext';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatCurrency';
import { AnimatePresence, motion } from 'framer-motion';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ProductDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { cart, addToCart, updateQuantity } = useContext(CartContext);
  const { products: cachedProducts } = useProducts();

  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [product, setProduct] = useState(() =>
    cachedProducts.find((p) => String(p.id) === String(id)) || null
  );
  const [loading, setLoading] = useState(() =>
    !cachedProducts.find((p) => String(p.id) === String(id))
  );
  const [error, setError] = useState(null);

  // ── Opsiyon Grupları ────────────────────────────────────────────────────────
  // Her grup: { id, name, min_selection, max_selection, is_required, sort_order, items: [] }
  const [optionGroups, setOptionGroups] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Kullanıcının seçimleri: { [groupId]: Set<itemId> }
  const [selections, setSelections] = useState({});

  useEffect(() => {
    // Context cache'de varsa ağa gitme — anında göster
    const cached = cachedProducts.find((p) => String(p.id) === String(id));
    if (cached) {
      setProduct(cached);
      setLoading(false);
      setError(null);
      return;
    }

    // Cache'de yoksa (ör. direkt URL'den girildi) Supabase'den çek
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchProduct() {
      try {
        const { data, error: queryError } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!isMounted) return;

        if (queryError) {
          setProduct(null);
          setError('Ürün bilgisi alınamadı. Lütfen tekrar deneyin.');
          return;
        }

        if (!data) {
          setProduct(null);
          setError('Ürün bulunamadı.');
          return;
        }

        setProduct(data);
        setQuantity(1);
        setIsAdded(false);
      } catch {
        if (!isMounted) return;
        setProduct(null);
        setError('Ürün bilgisi alınamadı. Lütfen tekrar deneyin.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProduct();
    return () => { isMounted = false; };
  }, [id, cachedProducts]);

  // ── Ürün opsiyon gruplarını çek ────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setOptionsLoading(true);
    setSelections({});

    async function fetchOptions() {
      try {
        // product_option_groups → option_groups → option_items (sort_order ile)
        const { data: pogRows, error: pogErr } = await supabase
          .from('product_option_groups')
          .select(`
            id,
            sort_order,
            option_groups (
              id,
              name,
              description,
              min_selection,
              max_selection,
              is_required,
              option_items (
                id,
                name,
                price_adjustment,
                is_available,
                sort_order
              )
            )
          `)
          .eq('product_id', id)
          .order('sort_order', { ascending: true });

        if (pogErr || !isMounted) return;

        const groups = (pogRows || [])
          .map((row) => ({
            pogId: row.id,
            sort_order: row.sort_order,
            ...row.option_groups,
            items: [...(row.option_groups?.option_items || [])]
              .sort((a, b) => a.sort_order - b.sort_order),
          }))
          .filter((g) => g.id);

        if (!isMounted) return;
        setOptionGroups(groups);

        // Zorunlu + tek seçimli gruplar için ilk available item'ı ön-seç
        const initialSelections = {};
        groups.forEach((g) => {
          if (g.is_required && g.max_selection === 1) {
            const first = g.items.find((item) => item.is_available);
            if (first) initialSelections[g.id] = new Set([first.id]);
          }
        });
        setSelections(initialSelections);
      } catch (e) {
        console.error('[ProductDetail] options fetch error:', e);
      } finally {
        if (isMounted) setOptionsLoading(false);
      }
    }

    fetchOptions();
    return () => { isMounted = false; };
  }, [id]);

  // ── Seçim değiştirme ───────────────────────────────────────────────────────
  const toggleItem = useCallback((group, itemId) => {
    setSelections((prev) => {
      const current = new Set(prev[group.id] || []);
      const isSingle = group.max_selection === 1;

      if (isSingle) {
        // Radio: sadece bu item seçili olsun
        return { ...prev, [group.id]: new Set([itemId]) };
      }

      // Checkbox (multi)
      if (current.has(itemId)) {
        current.delete(itemId);
      } else if (current.size < group.max_selection) {
        current.add(itemId);
      }
      return { ...prev, [group.id]: current };
    });
  }, []);

  // ── Seçim geçerli mi? (tüm zorunlu gruplar dolu) ──────────────────────────
  const selectionsValid = useMemo(() => {
    return optionGroups
      .filter((g) => g.is_required)
      .every((g) => {
        const sel = selections[g.id];
        return sel && sel.size >= (g.min_selection || 1);
      });
  }, [optionGroups, selections]);

  // ── Ekstra fiyat toplamı ───────────────────────────────────────────────────
  const extraPrice = useMemo(() => {
    let total = 0;
    optionGroups.forEach((g) => {
      const sel = selections[g.id];
      if (!sel) return;
      g.items.forEach((item) => {
        if (sel.has(item.id)) total += parseFloat(item.price_adjustment || 0);
      });
    });
    return total;
  }, [optionGroups, selections]);

  // ── selectedOptions objesini CartContext formatına çevir ──────────────────
  const selectedOptionsForCart = useMemo(() => {
    const obj = { _extraPrice: extraPrice };
    Object.entries(selections).forEach(([gId, set]) => {
      obj[gId] = set.size === 1 ? [...set][0] : [...set];
    });
    return obj;
  }, [selections, extraPrice]);

  // lineKey: opsiyonlar değiştikçe yeniden hesaplanır
  const currentLineKey = useMemo(
    () => product?.id ? buildCartLineKey(product.id, selectedOptionsForCart) : null,
    [product?.id, selectedOptionsForCart]
  );

  const cartQuantity = useMemo(() => {
    if (!currentLineKey) return 0;
    return Math.max(
      0,
      Number((cart || []).find((item) => item.lineKey === currentLineKey)?.quantity || 0)
    );
  }, [cart, currentLineKey]);

  useEffect(() => {
    if (!product?.id) return;

    if (cartQuantity > 0) {
      setQuantity((prev) => (prev === cartQuantity ? prev : cartQuantity));
      setIsAdded(true);
      return;
    }

    setIsAdded(false);
    setQuantity((prev) => (prev === 1 ? prev : 1));
  }, [cartQuantity, product?.id]);

  const imageUrl = useMemo(
    () => product?.img || product?.image ||
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200',
    [product]
  );

  const productName = product?.name || 'Ürün';
  const productDesc = product?.desc || product?.description || 'Ürün açıklaması bulunamadı.';
  const productPrice = toNumber(product?.price);
  const unitPrice = productPrice + extraPrice;
  const primaryActionTotal = formatCurrency(unitPrice * Math.max(1, quantity));

  // product değişmediği sürece SVG arc hesaplamaları tekrarlanmaz
  const macroCards = useMemo(() => {
    const RADIUS = 14;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const raw = {
      kcal:    Math.max(0, Math.round(toNumber(product?.cal ?? product?.kcal ?? product?.calories))),
      carbs:   Math.max(0, Math.round(toNumber(product?.carbs))),
      protein: Math.max(0, Math.round(toNumber(product?.protein))),
      fats:    Math.max(0, Math.round(toNumber(product?.fats ?? product?.fat))),
    };
    return [
      { key: 'kcal',    label: 'Kalori',   displayValue: `${raw.kcal} kcal`, color: '#F97316', ratio: Math.min(100, (raw.kcal    / 1200) * 100) },
      { key: 'protein', label: 'Protein',  displayValue: `${raw.protein}g`,  color: '#3B82F6', ratio: Math.min(100, (raw.protein / 120)  * 100) },
      { key: 'carbs',   label: 'Karb',     displayValue: `${raw.carbs}g`,    color: '#EAB308', ratio: Math.min(100, (raw.carbs   / 160)  * 100) },
      { key: 'fats',    label: 'Yağ',      displayValue: `${raw.fats}g`,     color: '#EF4444', ratio: Math.min(100, (raw.fats    / 80)   * 100) },
    ].map((m) => ({
      ...m,
      circumference: CIRCUMFERENCE,
      dashOffset: CIRCUMFERENCE - (m.ratio / 100) * CIRCUMFERENCE,
    }));
  }, [product]);

  const handlePrimaryAction = () => {
    if (!product) return;

    if (cartQuantity > 0 || isAdded) {
      navigate('/cart');
      return;
    }

    addToCart(product, quantity, selectedOptionsForCart);
    setIsAdded(true);
  };

  const handleIncrease = () => {
    if (!product) return;
    const next = quantity + 1;
    setQuantity(next);

    if (cartQuantity > 0 && currentLineKey) {
      updateQuantity(currentLineKey, next);
      return;
    }

    addToCart(product, next, selectedOptionsForCart);
    setIsAdded(true);
  };

  const handleDecrease = () => {
    if (!product) return;
    if (quantity <= 1) return;
    const next = quantity - 1;
    setQuantity(next);

    if (cartQuantity > 0 && currentLineKey) {
      updateQuantity(currentLineKey, next);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F0F0F0] text-brand-dark flex items-center justify-center">Yükleniyor...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-[#F0F0F0] text-brand-dark flex items-center justify-center px-6 text-center">{error}</div>;
  }

  if (!product) {
    return <div className="min-h-screen bg-[#F0F0F0] text-brand-dark flex items-center justify-center">Ürün bulunamadı.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-32 text-brand-dark">
      <header className="fixed left-0 right-0 top-0 z-50 mx-auto flex w-full max-w-[430px] items-center justify-between bg-[#F0F0F0]/95 px-4 py-2.5 backdrop-blur min-[390px]:py-3 min-[430px]:px-5">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F0F0] min-[390px]:h-9 min-[390px]:w-9"
        >
          <ChevronLeft className="h-4 w-4 text-brand-dark min-[390px]:h-[18px] min-[390px]:w-[18px]" />
        </motion.button>
        <div className="w-8 min-[390px]:w-9" />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/profile/support')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F0F0] min-[390px]:h-9 min-[390px]:w-9"
          aria-label="Destek"
        >
          <HelpCircle className="h-4 w-4 min-[390px]:h-[17px] min-[390px]:w-[17px] text-brand-dark" />
        </motion.button>
      </header>

      <main className="mx-auto w-full max-w-[430px] pb-32">
        <section className="px-4 pt-13 min-[390px]:pt-14 min-[430px]:px-5">
          <div className="w-full max-h-[280px] bg-white flex items-center justify-center overflow-hidden rounded-3xl">
            <img src={imageUrl} alt={productName} className="w-full h-full max-h-[280px] object-contain rounded-3xl" />
          </div>
        </section>

        <section className="px-4 pb-5 pt-3.5 min-[390px]:pt-4 min-[430px]:px-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="mb-0 flex-1 font-zalando text-lg font-semibold leading-tight text-brand-dark">
              {productName}
            </h1>
            <div className="shrink-0 rounded-full bg-[#98CD00] px-4 py-1 font-google font-medium text-white">
              {formatCurrency(productPrice)}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {macroCards.map((macro) => (
              <div
                key={macro.key}
                className="rounded-2xl border bg-brand-white p-3"
                style={{ borderColor: macro.color }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-9 w-9">
                      <circle cx="18" cy="18" r={14} fill="none" stroke="#F0F0F0" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r={14}
                        fill="none"
                        stroke={macro.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={macro.circumference}
                        strokeDashoffset={macro.dashOffset}
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <span
                      className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: macro.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-google text-[13px] font-medium leading-none text-brand-dark">{macro.displayValue}</p>
                    <p className="mt-1 font-google text-[11px] font-extralight leading-none text-brand-dark/60">{macro.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 rounded-2xl bg-[#F0F0F0] p-3 shadow-[0_4px_12px_rgba(32,32,32,0.08)] min-[390px]:mt-3 min-[390px]:p-3.5">
            <p className="mb-0 font-google text-[12px] font-thin leading-relaxed text-black min-[390px]:text-[13px]">{productDesc}</p>
          </div>

          {/* ── Opsiyon Grupları ──────────────────────────────────────────── */}
          {optionsLoading && (
            <div className="mt-4 flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#98CD00] border-t-transparent" />
            </div>
          )}

          {!optionsLoading && optionGroups.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {optionGroups.map((group) => {
                const isSingle = group.max_selection === 1;
                const currentSel = selections[group.id] || new Set();

                return (
                  <div key={group.id} className="rounded-2xl bg-brand-white overflow-hidden shadow-[0_2px_8px_rgba(32,32,32,0.06)]">
                    {/* Grup başlığı */}
                    <div className="flex items-center justify-between bg-[#202020] px-4 py-2.5">
                      <div>
                        <p className="font-google text-[13px] font-semibold text-white">
                          {group.name}
                        </p>
                        {group.description && (
                          <p className="text-[11px] text-white/60">{group.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {group.is_required && (
                          <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                            Zorunlu
                          </span>
                        )}
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                          {isSingle ? '1 seçim' : `max ${group.max_selection}`}
                        </span>
                      </div>
                    </div>

                    {/* Seçenekler */}
                    <div className="divide-y divide-gray-100">
                      {group.items.map((item) => {
                        const isSelected = currentSel.has(item.id);
                        const isDisabled = !item.is_available || (
                          !isSelected &&
                          !isSingle &&
                          currentSel.size >= group.max_selection
                        );

                        return (
                          <button
                            key={item.id}
                            disabled={isDisabled}
                            onClick={() => toggleItem(group, item.id)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors
                              ${isSelected ? 'bg-[#98CD00]/10' : 'hover:bg-gray-50'}
                              ${isDisabled && !isSelected ? 'opacity-40' : ''}
                            `}
                          >
                            {/* Radio / Checkbox ikonu */}
                            {isSelected
                              ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#98CD00]" />
                              : <Circle className={`h-5 w-5 shrink-0 ${isSingle ? 'text-gray-300' : 'text-gray-300'}`} />
                            }

                            {/* Ad */}
                            <span className={`flex-1 font-google text-[13px] font-medium
                              ${isSelected ? 'text-[#202020]' : 'text-brand-dark/80'}
                              ${!item.is_available ? 'line-through' : ''}
                            `}>
                              {item.name}
                              {!item.is_available && (
                                <span className="ml-1.5 text-[11px] font-normal text-red-400">(Tükendi)</span>
                              )}
                            </span>

                            {/* Ekstra fiyat */}
                            {item.price_adjustment > 0 && (
                              <span className={`shrink-0 font-google text-[12px] font-semibold
                                ${isSelected ? 'text-[#98CD00]' : 'text-gray-400'}
                              `}>
                                +{formatCurrency(item.price_adjustment)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Seçim özeti / ekstra fiyat */}
              {extraPrice > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-[#98CD00]/10 px-4 py-3">
                  <span className="font-google text-[13px] text-brand-dark/70">Ekstralar</span>
                  <span className="font-google text-[13px] font-bold text-[#98CD00]">
                    +{formatCurrency(extraPrice)}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#F0F0F0]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur min-[390px]:pt-3 min-[430px]:px-5">
        <div className="mx-auto flex max-w-[430px] items-center gap-2.5 min-[390px]:gap-3">
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleDecrease}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F0F0] text-brand-dark/80 min-[390px]:h-9 min-[390px]:w-9"
            >
              <Minus className="h-[15px] w-[15px] min-[390px]:h-4 min-[390px]:w-4" />
            </motion.button>
            <span className="relative inline-flex w-5 justify-center overflow-hidden text-center font-google text-[18px] leading-none font-medium text-brand-dark min-[390px]:text-[20px]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`detail-qty-${quantity}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {quantity}
                </motion.span>
              </AnimatePresence>
            </span>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleIncrease}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F0F0] text-brand-dark min-[390px]:h-9 min-[390px]:w-9"
            >
              <Plus className="h-[15px] w-[15px] min-[390px]:h-4 min-[390px]:w-4" />
            </motion.button>
          </div>

          <motion.button
            whileTap={selectionsValid ? { scale: 0.95 } : {}}
            onClick={selectionsValid ? handlePrimaryAction : undefined}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 font-google text-[13px] font-medium transition-all min-[390px]:h-10 min-[390px]:px-3.5 min-[390px]:text-sm
              ${selectionsValid
                ? 'bg-[#98CD00] text-[#F0F0F0] active:scale-95'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
          >
            <ShoppingCart className="h-[14px] w-[14px] min-[390px]:h-[15px] min-[390px]:w-[15px]" />
            <span>
              {!selectionsValid
                ? 'Seçim yapın'
                : (cartQuantity > 0 || isAdded) ? `Sepete Git (${quantity})` : 'Sepete Ekle'
              }
            </span>
            {selectionsValid && !(cartQuantity > 0 || isAdded) && (
              <span className="font-google font-medium">{primaryActionTotal}</span>
            )}
          </motion.button>
        </div>
      </footer>
    </div>
  );
}
