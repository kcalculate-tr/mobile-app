import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';

export const CartContext = createContext(null);
const CART_STORAGE_KEY = 'kcal_cart_items';

/**
 * Seçilen opsiyonlara göre benzersiz bir satır anahtarı üretir.
 * Aynı ürün, farklı seçimlerle ayrı satır olur.
 * selectedOptions: { [groupId]: itemId | itemId[] }
 */
export function buildCartLineKey(productId, selectedOptions = {}) {
    const sorted = Object.entries(selectedOptions)
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([gId, val]) => {
            const ids = Array.isArray(val) ? [...val].sort() : [val];
            return `${gId}:${ids.join(',')}`;
        })
        .join('|');
    return `${productId}__${sorted}`;
}

function readCartFromStorage() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => item && item.id !== undefined && item.id !== null)
            .map((item) => ({
                ...item,
                quantity: Math.max(1, Number(item.quantity || 1)),
                // Eski kayıtlar için geriye dönük uyumluluk
                lineKey: item.lineKey || buildCartLineKey(item.id, item.selectedOptions || {}),
            }));
    } catch {
        return [];
    }
}

export function CartProvider({ children }) {
    const [cart, setCart] = useState(() => readCartFromStorage());

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch {
            // no-op
        }
    }, [cart]);

    /**
     * addToCart(product, quantity, selectedOptions?)
     *
     * selectedOptions örneği:
     *   { "grp-uuid-1": "item-uuid-a", "grp-uuid-2": ["item-uuid-b","item-uuid-c"] }
     *
     * Aynı ürün + aynı opsiyonlar → miktarı artır.
     * Aynı ürün + farklı opsiyonlar → yeni satır ekle.
     */
    const addToCart = useCallback((product, quantity = 1, selectedOptions = {}) => {
        const lineKey = buildCartLineKey(product.id, selectedOptions);
        // Ekstra fiyat hesabı: seçilen her item'ın price_adjustment toplamı
        const extraPrice = selectedOptions._extraPrice || 0;

        setCart((prev) => {
            const existing = prev.find((item) => item.lineKey === lineKey);
            if (existing) {
                return prev.map((item) =>
                    item.lineKey === lineKey
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [
                ...prev,
                {
                    ...product,
                    quantity,
                    selectedOptions,
                    extraPrice,
                    lineKey,
                    // Sepette gösterilecek toplam birim fiyat
                    unitPrice: parseFloat(product.price || 0) + extraPrice,
                },
            ];
        });
    }, []);

    /** lineKey bazlı silme — opsiyon farkı olan aynı ürünleri karıştırmaz */
    const removeFromCart = useCallback((lineKey) => {
        setCart((prev) => prev.filter((item) => (item.lineKey || item.id) !== lineKey));
    }, []);

    /** lineKey bazlı miktar güncelleme */
    const updateQuantity = useCallback((lineKey, quantity) => {
        if (quantity <= 0) {
            setCart((prev) => prev.filter((item) => (item.lineKey || item.id) !== lineKey));
            return;
        }
        setCart((prev) =>
            prev.map((item) =>
                (item.lineKey || item.id) === lineKey ? { ...item, quantity } : item
            )
        );
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

    const totalAmount = useMemo(
        () => cart.reduce((sum, item) => {
            const unit = parseFloat(item.unitPrice ?? item.price ?? 0);
            return sum + unit * (item.quantity || 1);
        }, 0),
        [cart]
    );

    const value = useMemo(
        () => ({ cart, cartItems: cart, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount }),
        [cart, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount]
    );

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
}
