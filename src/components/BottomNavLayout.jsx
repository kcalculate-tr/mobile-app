import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Activity, ShoppingBag, Heart, User } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { motion, useAnimationControls } from 'framer-motion';

export default function BottomNavLayout() {
  const { cart } = useContext(CartContext);
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + (item.quantity || 1), 0),
    [cart]
  );
  const prevCartCountRef = useRef(cartCount);
  const cartIconControls = useAnimationControls();

  useEffect(() => {
    if (cartCount > prevCartCountRef.current) {
      cartIconControls.start({
        y: [0, -10, 0],
        transition: { duration: 0.35, ease: 'easeOut' },
      });
    }
    prevCartCountRef.current = cartCount;
  }, [cartCount, cartIconControls]);

  return (
    <div className="min-h-screen bg-[#F0F0F0]">
      <Outlet />

      <nav className="pointer-events-none fixed bottom-4 left-4 right-4 z-50 sm:bottom-6">
        <div className="mx-auto max-w-[360px] pb-[max(0px,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto rounded-full bg-[#F0F0F0] px-4 py-2.5 shadow-[0_10px_18px_-10px_rgba(32,32,32,0.38)] backdrop-blur-md">
            <div className="flex items-end justify-between">
              <NavLink
                to="/"
                end
                aria-label="Ana Sayfa"
                className={({ isActive }) => `relative flex h-9 w-9 flex-col items-center justify-center transition-colors ${
                  isActive ? 'text-[#98CD00]' : 'text-brand-dark/70 hover:text-brand-dark'
                }`}
              >
                {({ isActive }) => (
                  <motion.span whileTap={{ scale: 0.95 }} className="inline-flex flex-col items-center justify-center">
                    <Home size={22} strokeWidth={2.2} />
                    <span className={`mt-1 h-1 w-1 rounded-full ${isActive ? 'bg-[#98CD00]' : 'opacity-0'}`} />
                  </motion.span>
                )}
              </NavLink>

              <NavLink
                to="/tracker"
                aria-label="Takip"
                className={({ isActive }) => `tour-kcal-tracker relative flex h-9 w-9 flex-col items-center justify-center transition-colors ${
                  isActive ? 'text-[#98CD00]' : 'text-brand-dark/70 hover:text-brand-dark'
                }`}
              >
                {({ isActive }) => (
                  <motion.span whileTap={{ scale: 0.95 }} className="inline-flex flex-col items-center justify-center">
                    <Activity size={22} strokeWidth={2.2} />
                    <span className={`mt-1 h-1 w-1 rounded-full ${isActive ? 'bg-[#98CD00]' : 'opacity-0'}`} />
                  </motion.span>
                )}
              </NavLink>

              <NavLink
                to="/cart"
                aria-label="Sepet"
                className={({ isActive }) => `tour-cart-delivery relative flex h-11 w-11 -translate-y-1.5 items-center justify-center rounded-full bg-[#98CD00] text-[#F0F0F0] shadow-[0_8px_18px_rgba(152,205,0,0.35)] transition-transform hover:-translate-y-2 ${
                  isActive ? 'ring-2 ring-brand-white/35' : ''
                }`}
              >
                <motion.span
                  whileTap={{ scale: 0.95 }}
                  animate={cartIconControls}
                  className="relative inline-flex items-center justify-center"
                >
                  <ShoppingBag size={22} strokeWidth={2.4} />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-brand-dark bg-[#FFFADC] px-1 text-[10px] font-bold leading-none text-[#202020]">
                      {cartCount}
                    </span>
                  )}
                </motion.span>
              </NavLink>

              <NavLink
                to="/subscription"
                aria-label="Favoriler"
                className={({ isActive }) => `relative flex h-9 w-9 flex-col items-center justify-center transition-colors ${
                  isActive ? 'text-[#98CD00]' : 'text-brand-dark/70 hover:text-brand-dark'
                }`}
              >
                {({ isActive }) => (
                  <motion.span whileTap={{ scale: 0.95 }} className="inline-flex flex-col items-center justify-center">
                    <Heart size={22} strokeWidth={2.2} />
                    <span className={`mt-1 h-1 w-1 rounded-full ${isActive ? 'bg-[#98CD00]' : 'opacity-0'}`} />
                  </motion.span>
                )}
              </NavLink>

              <NavLink
                to="/profile"
                aria-label="Profil"
                className={({ isActive }) => `relative flex h-9 w-9 flex-col items-center justify-center transition-colors ${
                  isActive ? 'text-[#98CD00]' : 'text-brand-dark/70 hover:text-brand-dark'
                }`}
              >
                {({ isActive }) => (
                  <motion.span whileTap={{ scale: 0.95 }} className="inline-flex flex-col items-center justify-center">
                    <User size={22} strokeWidth={2.2} />
                    <span className={`mt-1 h-1 w-1 rounded-full ${isActive ? 'bg-[#98CD00]' : 'opacity-0'}`} />
                  </motion.span>
                )}
              </NavLink>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
