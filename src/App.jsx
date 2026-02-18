import React, { Component, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'framer-motion';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { ProductProvider } from './context/ProductContext';
import { supabase } from './supabase';

// ── Kritik yol (Critical path) — hemen açılması gereken sayfalar ─────────────
// Bunlar eager-loaded: ilk render'da hazır olmaları gerekiyor.
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BottomNavLayout from './components/BottomNavLayout';

// ── Lazy-loaded sayfalar ──────────────────────────────────────────────────────
// İlk açılışta parse edilmez; kullanıcı bu route'a gittiğinde yüklenir.
// Özellikle Admin (4 K+ satır) kritik yolda olmamalı.
const ProductDetail  = React.lazy(() => import('./pages/ProductDetail'));
const Cart           = React.lazy(() => import('./pages/Cart'));
const Checkout       = React.lazy(() => import('./pages/Checkout'));
const Success        = React.lazy(() => import('./pages/Success'));
const Payment        = React.lazy(() => import('./pages/Payment'));
const Fail           = React.lazy(() => import('./pages/Fail'));
const Tracker        = React.lazy(() => import('./pages/Tracker'));
const Offers         = React.lazy(() => import('./pages/Offers'));
const Subscription   = React.lazy(() => import('./pages/Subscription'));
const Profile        = React.lazy(() => import('./pages/Profile'));
const Orders         = React.lazy(() => import('./pages/Orders'));
const OrderDetail    = React.lazy(() => import('./pages/OrderDetail'));
const Support        = React.lazy(() => import('./pages/Support'));
const Addresses      = React.lazy(() => import('./pages/profile/Addresses'));
const Cards          = React.lazy(() => import('./pages/profile/Cards'));
const Coupons        = React.lazy(() => import('./pages/profile/Coupons'));
const Security       = React.lazy(() => import('./pages/profile/Security'));
const Contracts      = React.lazy(() => import('./pages/profile/Contracts'));
const Admin          = React.lazy(() => import('./pages/Admin'));

// Sadece opacity fade: transform/will-change KULLANMA.
// transform içeren animasyonlar position:fixed elementleri (modal, sticky footer)
// viewport yerine animate container'a göre konumlandırır ve kırar.
const PAGE_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const PAGE_TRANSITION = {
  duration: 0.18,
  ease: 'easeInOut',
};

function PageTransition({ children, onStateChange }) {
  return (
    <m.div
      className="route-transition-page"
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={PAGE_TRANSITION}
      onAnimationStart={() => onStateChange?.(true)}
      onAnimationComplete={() => onStateChange?.(false)}
    >
      {children}
    </m.div>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      '%c AppErrorBoundary: Uygulama çöktü ',
      'background:#ff0000;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px',
      error,
      errorInfo
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.replace('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F0F0F0] p-6 text-center">
          <div className="mx-auto w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              !
            </div>
            <h1 className="mb-2 text-xl font-bold text-[#202020]">Bir şeyler ters gitti</h1>
            <p className="mb-6 text-sm text-[#202020]/60">
              Sayfa yüklenirken beklenmeyen bir hata oluştu.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full rounded-full bg-[#98CD00] px-6 py-3 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AdminRouteGuard() {
  const [accessState, setAccessState] = useState('loading');

  useEffect(() => {
    let isMounted = true;

    async function verifyAccess() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      if (authError || !user) {
        setAccessState('unauthenticated');
        return;
      }

      let response = await supabase
        .from('admin_allowlist')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (response.error && String(response.error.code || '') === '42703' && user.email) {
        response = await supabase
          .from('admin_allowlist')
          .select('id')
          .eq('email', user.email)
          .limit(1)
          .maybeSingle();
      }

      if (!isMounted) return;

      if (response.error) {
        console.error('Admin yetki kontrolü başarısız:', response.error);
        setAccessState('forbidden');
        return;
      }

      setAccessState(response.data ? 'allowed' : 'forbidden');
    }

    verifyAccess();
    return () => {
      isMounted = false;
    };
  }, []);

  if (accessState === 'loading') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-sm text-brand-dark">
        Yetki kontrol ediliyor...
      </div>
    );
  }

  if (accessState === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (accessState === 'forbidden') {
    return <Navigate to="/" replace />;
  }

  return <Admin />;
}

function AnimatedRoutes() {
  const location = useLocation();
  const [isRouteAnimating, setIsRouteAnimating] = useState(false);

  useEffect(() => {
    setIsRouteAnimating(true);
  }, [location.pathname]);

  const withPageTransition = useCallback(
    (node) => <PageTransition onStateChange={setIsRouteAnimating}>{node}</PageTransition>,
    []
  );

  return (
    <div className={isRouteAnimating ? 'route-animating' : ''}>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<BottomNavLayout />}>
            <Route index element={withPageTransition(<Home />)} />
            <Route path="tracker" element={withPageTransition(<Tracker />)} />
            <Route path="offers" element={withPageTransition(<Offers />)} />
            <Route path="subscription" element={withPageTransition(<Subscription />)} />
            <Route path="profile" element={withPageTransition(<Profile />)} />
          </Route>

          <Route path="/product/:id" element={withPageTransition(<ProductDetail />)} />
          <Route path="/cart" element={withPageTransition(<Cart />)} />
          <Route path="/checkout" element={withPageTransition(<Checkout />)} />
          <Route path="/payment" element={withPageTransition(<Payment />)} />
          <Route path="/success" element={withPageTransition(<Success />)} />
          <Route path="/orders" element={withPageTransition(<Orders />)} />
          <Route path="/order-detail/:id" element={withPageTransition(<OrderDetail />)} />
          <Route path="/profile/orders" element={<Navigate to="/orders" replace />} />
          <Route path="/profile/addresses" element={withPageTransition(<Addresses />)} />
          <Route path="/profile/cards" element={withPageTransition(<Cards />)} />
          <Route path="/profile/coupons" element={withPageTransition(<Coupons />)} />
          <Route path="/profile/support" element={withPageTransition(<Support />)} />
          <Route path="/profile/security" element={withPageTransition(<Security />)} />
          <Route path="/profile/contracts" element={withPageTransition(<Contracts />)} />
          <Route path="/admin" element={withPageTransition(<AdminRouteGuard />)} />
          <Route path="/fail" element={withPageTransition(<Fail />)} />
          <Route path="/login" element={withPageTransition(<Login />)} />
          <Route path="/register" element={withPageTransition(<Register />)} />
          <Route path="/account" element={<Navigate to="/profile" replace />} />
          <Route path="/subscriptions" element={<Navigate to="/subscription" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

// Sayfa yükleme beklerken gösterilecek hafif fallback.
// Suspense, lazy-loaded sayfaların yüklenirken beyaz ekran vermesini önler.
function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F0F0F0]">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#98CD00] border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        {/* ProductProvider: ürünleri App seviyesinde bir kez çeker,
            sayfa geçişlerinde yeniden fetch yapılmaz. */}
        <ProductProvider>
          <CartProvider>
            <BrowserRouter>
              <LazyMotion features={domAnimation}>
                <MotionConfig reducedMotion="user" transition={PAGE_TRANSITION}>
                  <div className="relative min-h-screen" style={{ overflowX: 'clip' }}>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <AnimatedRoutes />
                    </Suspense>
                  </div>
                </MotionConfig>
              </LazyMotion>
            </BrowserRouter>
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
