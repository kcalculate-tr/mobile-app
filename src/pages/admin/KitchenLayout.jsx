import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Flame, Loader2, Store, TimerReset } from 'lucide-react';
import { supabase } from '../../supabase';

const SETTINGS_ROW_ID = 1;

const NAV_ITEMS = [
  { key: 'active', label: 'Aktif Siparişler', to: '/kitchen', end: true, Icon: ClipboardList },
  { key: 'completed', label: 'Tamamlananlar', to: '/kitchen/completed', end: false, Icon: CheckCircle2 },
];

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'active'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'inactive'].includes(normalized)) return false;
  }
  return fallback;
}

export default function KitchenLayout() {
  const [shopOpen, setShopOpen] = useState(true);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');

  useEffect(() => {
    let mounted = true;

    const fetchShopSetting = async () => {
      setShopLoading(true);
      setShopError('');

      try {
        const { data, error } = await supabase
          .from('settings')
          .select('id,is_shop_open')
          .eq('id', SETTINGS_ROW_ID)
          .maybeSingle();

        if (error) throw error;

        if (!mounted) return;
        setShopOpen(normalizeBoolean(data?.is_shop_open, true));
      } catch (err) {
        if (!mounted) return;
        setShopError(err?.message || 'Mağaza durumu alınamadı.');
      } finally {
        if (mounted) setShopLoading(false);
      }
    };

    fetchShopSetting();

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleShop = async () => {
    if (shopLoading || shopSaving) return;

    const next = !shopOpen;
    setShopSaving(true);
    setShopError('');

    try {
      const { error } = await supabase
        .from('settings')
        .update({ is_shop_open: next })
        .eq('id', SETTINGS_ROW_ID);

      if (error) throw error;
      setShopOpen(next);
    } catch (err) {
      setShopError(err?.message || 'Mağaza durumu güncellenemedi.');
    } finally {
      setShopSaving(false);
    }
  };

  return (
    <div className="kds-shell safe-inset-y min-h-screen bg-kds-bg text-white font-google">
      <header className="border-b border-white/10 bg-kds-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary/15 text-brand-primary">
              <Flame size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Kitchen KDS</p>
              <p className="text-lg font-bold text-white">Mutfak Operasyon Paneli</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 rounded-2xl border border-white/10 bg-kds-bg p-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (
                  `inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-white/75 hover:bg-white/5 hover:text-white'
                  }`
                )}
              >
                <item.Icon size={14} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-brand-primary/35 bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-primary">
              <TimerReset size={16} />
              İstasyon: Merkez Şube Izgara
            </div>

            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-kds-bg px-3 py-2">
              <div className="text-right leading-tight">
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  <Store size={12} />
                  Mağaza
                </p>
                <p className={`text-sm font-black ${shopOpen ? 'text-brand-primary' : 'text-rose-400'}`}>
                  {shopLoading ? 'Yükleniyor...' : shopOpen ? 'Açık' : 'Kapalı'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleShop}
                disabled={shopLoading || shopSaving}
                className={`relative inline-flex h-10 w-20 items-center rounded-full p-1 transition ${
                  shopOpen ? 'bg-brand-primary' : 'bg-white/20'
                } ${(shopLoading || shopSaving) ? 'opacity-60' : ''}`}
                aria-label="Mağaza Açık/Kapalı"
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-black text-kds-bg transition-transform ${
                    shopOpen ? 'translate-x-10' : 'translate-x-0'
                  }`}
                >
                  {shopSaving ? <Loader2 size={12} className="animate-spin" /> : shopOpen ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {shopError && (
          <p className="mx-auto mt-3 w-full max-w-[1920px] rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
            {shopError}
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1920px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
