import React, { Component, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { supabase } from './supabase';

// ── Shell bileşenleri ────────────────────────────────────────────────────────
import NotificationListener from './components/NotificationListener';

// ── Sayfalar (lazy) ──────────────────────────────────────────────────────────
const Login           = React.lazy(() => import('./pages/Login'));
const StaffLogin      = React.lazy(() => import('./pages/StaffLogin'));

const Admin           = React.lazy(() => import('./pages/Admin'));
const BossLayout      = React.lazy(() => import('./pages/admin/BossLayout'));
const BossDashboard   = React.lazy(() => import('./pages/admin/BossDashboard'));
const BossCatalog     = React.lazy(() => import('./pages/admin/BossCatalog'));
const BossShowcase    = React.lazy(() => import('./pages/admin/BossShowcase'));
const BossVitrin      = React.lazy(() => import('./pages/admin/BossVitrin'));
const BossDelivery    = React.lazy(() => import('./pages/admin/BossDelivery'));
const BossDeliveryManagement = React.lazy(() => import('./pages/admin/BossDeliveryManagement'));
const BossBusinessHours = React.lazy(() => import('./pages/admin/BossBusinessHours'));
const BossSupport = React.lazy(() => import('./pages/admin/BossSupport'));
const BossMacro = React.lazy(() => import('./pages/admin/BossMacro'));
const BossSettings    = React.lazy(() => import('./pages/admin/BossSettings'));
const BossBranches    = React.lazy(() => import('./pages/admin/BossBranches'));
const BossFinance     = React.lazy(() => import('./pages/admin/BossFinance'));
const BossReviews     = React.lazy(() => import('./pages/admin/BossReviews'));
const AdminOrders     = React.lazy(() => import('./pages/admin/AdminOrders'));
const AdminCustomers  = React.lazy(() => import('./pages/admin/AdminCustomers'));
const AdminTickets         = React.lazy(() => import('./pages/admin/AdminTickets'));
const AdminOptionGroups = React.lazy(() => import('./pages/admin/OptionGroups'));
const AdminProductOpts  = React.lazy(() => import('./pages/admin/ProductOptionManager'));
const KitchenLayout   = React.lazy(() => import('./pages/admin/KitchenLayout'));
const KitchenDashboard = React.lazy(() => import('./pages/admin/KitchenDashboard'));

// ── Sayfa geçiş animasyonu ───────────────────────────────────────────────────
const PAGE_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const PAGE_TRANSITION = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1],
};

function PageTransition({ children, onStateChange }) {
  return (
    <m.div
      className="route-transition-page bg-[#F0F0F0]"
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
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return null;
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.replace('/boss');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F0F0F0] p-6 text-center">
          <div className="mx-auto w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">!</div>
            <h1 className="mb-2 text-xl font-bold text-[#202020]">Bir şeyler ters gitti</h1>
            <p className="mb-6 text-sm text-[#202020]/60">Sayfa yüklenirken beklenmeyen bir hata oluştu.</p>
            <button
              onClick={this.handleReset}
              className="w-full rounded-full bg-[#98CD00] px-6 py-3 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              Panele Dön
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Admin route guard ────────────────────────────────────────────────────────
function AdminRouteGuard({ page } = {}) {
  const [accessState, setAccessState] = useState('loading');

  useEffect(() => {
    let isMounted = true;

    async function verifyAccess() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (!isMounted) return;
      if (authError || !user) { setAccessState('unauthenticated'); return; }

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
    return () => { isMounted = false; };
  }, []);

  if (accessState === 'loading') {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center text-sm text-gray-500">
        Yetki kontrol ediliyor...
      </div>
    );
  }
  if (accessState === 'unauthenticated') return <Navigate to="/login" replace />;
  if (accessState === 'forbidden') return <Navigate to="/login" replace />;
  return page ?? <Admin />;
}

// ── Animated routes ──────────────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();
  const [isRouteAnimating, setIsRouteAnimating] = useState(false);

  useEffect(() => { setIsRouteAnimating(true); }, [location.pathname]);

  const wrap = useCallback(
    (node) => <PageTransition onStateChange={setIsRouteAnimating}>{node}</PageTransition>,
    []
  );

  return (
    <div className={`bg-[#F0F0F0] min-h-screen ${isRouteAnimating ? 'route-animating' : ''}`}>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          {/* ── Boss (admin) ── */}
          <Route path="/boss" element={<AdminRouteGuard page={<BossLayout />} />}>
            <Route index element={wrap(<BossDashboard />)} />
            <Route path="siparisler" element={wrap(<AdminOrders />)} />
            <Route path="customers" element={wrap(<AdminCustomers />)} />
            <Route path="catalog" element={wrap(<BossCatalog />)} />
            <Route path="showcase" element={wrap(<BossShowcase />)} />
            <Route path="vitrin" element={wrap(<BossVitrin />)} />
            <Route path="teslimat" element={wrap(<BossDelivery />)} />
            <Route path="delivery-management" element={wrap(<BossDeliveryManagement />)} />
            <Route path="yorumlar" element={wrap(<BossReviews />)} />
            <Route path="branches" element={wrap(<BossBranches />)} />
            <Route path="subeler" element={<Navigate to="/boss/branches" replace />} />
            <Route path="finance" element={wrap(<BossFinance />)} />
            <Route path="finans" element={<Navigate to="/boss/finance" replace />} />
            <Route path="reviews" element={wrap(<BossReviews />)} />
            <Route path="business-hours" element={wrap(<BossBusinessHours />)} />
            <Route path="support" element={wrap(<BossSupport />)} />
            <Route path="macro" element={wrap(<BossMacro />)} />
            <Route path="settings" element={wrap(<BossSettings />)} />
            <Route path="ayarlar" element={<Navigate to="/boss/settings" replace />} />
            <Route path="option-groups" element={wrap(<AdminOptionGroups />)} />
            <Route path="product-options" element={wrap(<AdminProductOpts />)} />
            <Route path="tickets" element={wrap(<AdminTickets />)} />
          </Route>

          {/* ── Kitchen (KDS) ── */}
          <Route path="/kitchen" element={<AdminRouteGuard page={<KitchenLayout />} />}>
            <Route index element={wrap(<KitchenDashboard />)} />
            <Route path="completed" element={wrap(<KitchenDashboard />)} />
          </Route>

          {/* ── Auth ── */}
          <Route path="/login" element={wrap(<Login />)} />
          <Route path="/staff" element={wrap(<StaffLogin />)} />

          {/* ── Yönlendirmeler ── */}
          <Route path="/admin" element={<Navigate to="/boss" replace />} />
          <Route path="/admin/*" element={<Navigate to="/boss" replace />} />
          <Route path="/" element={<Navigate to="/boss" replace />} />
          <Route path="*" element={<Navigate to="/boss" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

// ── Loading fallback ─────────────────────────────────────────────────────────
function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-5 bg-[#F0F0F0]" role="status">
      <div className="rounded-full bg-black/20 p-2">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#98CD00] border-t-transparent" />
          <div
            className="absolute inset-[6px] rounded-full border-[3px] border-white border-b-transparent"
            style={{ animation: 'spin 0.75s linear infinite reverse' }}
          />
        </div>
      </div>
      <p className="text-[13px] font-medium tracking-widest text-[#202020]/40 uppercase">Kcal Admin</p>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user" transition={PAGE_TRANSITION}>
              <div className="relative min-h-screen" style={{ overflowX: 'clip' }}>
                <NotificationListener />
                <Suspense fallback={<PageLoadingFallback />}>
                  <AnimatedRoutes />
                </Suspense>
              </div>
            </MotionConfig>
          </LazyMotion>
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
