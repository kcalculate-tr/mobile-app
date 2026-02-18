import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';

export const CartContext = createContext(null);
const CART_STORAGE_KEY = 'kcal_cart_items';

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

    const addToCart = useCallback((product, quantity = 1) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { ...product, quantity }];
        });
    }, []);

    const removeFromCart = useCallback((productId) => {
        setCart((prev) => prev.filter((item) => item.id !== productId));
    }, []);

    const updateQuantity = useCallback((productId, quantity) => {
        if (quantity <= 0) {
            setCart((prev) => prev.filter((item) => item.id !== productId));
            return;
        }
        setCart((prev) =>
            prev.map((item) =>
                item.id === productId ? { ...item, quantity } : item
            )
        );
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

    const totalAmount = useMemo(
        () => cart.reduce((sum, item) => sum + parseFloat(item.price || 0) * (item.quantity || 1), 0),
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
