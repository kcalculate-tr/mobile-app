import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BellRing,
  ChefHat,
  ClipboardList,
  Headphones,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Megaphone,
  Package,
  Search,
  Settings,
  Truck,
  Users,
  Wallet,
  Coins,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    to: '/boss',
    icon: LayoutGrid,
    matchPrefixes: ['/boss'],
    exact: true,
  },
  {
    key: 'orders',
    label: 'Siparişler',
    to: '/boss/siparisler',
    icon: ClipboardList,
    matchPrefixes: ['/boss/siparisler', '/boss/option-groups', '/boss/product-options'],
  },
  {
    key: 'customers',
    label: 'Müşteriler',
    to: '/boss/customers',
    icon: Users,
    matchPrefixes: ['/boss/customers'],
  },
  {
    key: 'catalog',
    label: 'Katalog',
    to: '/boss/catalog',
    icon: Package,
    matchPrefixes: ['/boss/catalog'],
  },
  {
    key: 'vitrin',
    label: 'Vitrin',
    to: '/boss/vitrin',
    icon: Megaphone,
    matchPrefixes: ['/boss/vitrin', '/boss/showcase'],
  },
  {
    key: 'delivery-management',
    label: 'Teslimat ve Çalışma Saatleri',
    to: '/boss/delivery-management',
    icon: Truck,
    matchPrefixes: ['/boss/delivery-management', '/boss/teslimat'],
  },
  {
    key: 'branches',
    label: 'Şubeler',
    to: '/boss/branches',
    icon: MapPin,
    matchPrefixes: ['/boss/branches', '/boss/subeler'],
  },
  {
    key: 'settings',
    label: 'Ayarlar',
    to: '/boss/settings',
    icon: Settings,
    matchPrefixes: ['/boss/settings', '/boss/ayarlar'],
  },
  {
    key: 'finance',
    label: 'Kasa',
    to: '/boss/finance',
    icon: Wallet,
    matchPrefixes: ['/boss/finance', '/boss/finans'],
  },
  {
    key: 'reviews',
    label: 'Yorumlar',
    to: '/boss/yorumlar',
    icon: MessageSquare,
    matchPrefixes: ['/boss/yorumlar', '/boss/reviews'],
  },
  {
    key: 'support',
    label: 'Destek',
    to: '/boss/support',
    icon: Headphones,
    matchPrefixes: ['/boss/support'],
  },
  {
    key: 'macro',
    label: 'Macro Üyelik',
    to: '/boss/macro',
    icon: Coins,
    matchPrefixes: ['/boss/macro'],
  },
  {
    key: 'push-test',
    label: 'Push Test',
    to: '/boss/push-test',
    icon: BellRing,
    matchPrefixes: ['/boss/push-test'],
  },
  {
    key: 'kitchen',
    label: 'Mutfak (KDS)',
    to: '/kitchen',
    icon: ChefHat,
    matchPrefixes: ['/kitchen'],
  },
];

function isActiveItem(item, pathname) {
  if (item.exact) {
    return pathname === item.to;
  }

  return item.matchPrefixes.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
}

export default function BossLayout() {
  const location = useLocation();

  return (
    <div className="boss-shell safe-inset-y min-h-screen bg-geex-bg text-geex-text">
      <div className="mx-auto flex w-full max-w-[1920px] gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <aside className="sticky top-[calc(env(safe-area-inset-top)+1.5rem)] h-[calc(100vh-env(safe-area-inset-top)-3rem)] w-[272px] shrink-0 rounded-3xl bg-geex-sidebar p-5 shadow-geex">
          <div className="mb-8">
            <p className="font-zalando text-2xl tracking-tight text-brand-white">KCAL</p>
            <p className="mt-1 text-xs text-geex-muted">Boss Panel</p>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActiveItem(item, location.pathname);

              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-semibold transition-all ${
                    active
                      ? 'border-transparent bg-brand-primary text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]'
                      : 'border-geex-sidebarSoft bg-geex-sidebar text-geex-muted hover:bg-geex-sidebarSoft hover:text-brand-white'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-6 flex items-center justify-between rounded-3xl border border-geex-border bg-geex-card px-5 py-4 shadow-geex-soft">
            <div className="relative w-full max-w-lg">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Patron panelinde ara"
                className="h-12 w-full rounded-2xl border border-geex-border bg-white pl-11 pr-4 text-sm font-medium text-geex-text placeholder:text-slate-400"
              />
            </div>

            <div className="ml-4 flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-geex-border bg-white px-3 py-2.5">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary text-xs font-bold text-brand-white">
                  BP
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-geex-text">Boss User</p>
                  <p className="text-xs text-slate-500">Patron Paneli</p>
                </div>
              </div>
            </div>
          </header>

          <main className="space-y-6">
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  );
}
