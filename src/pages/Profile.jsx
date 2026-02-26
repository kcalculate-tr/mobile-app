import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  MapPin,
  CreditCard,
  TicketPercent,
  Shield,
  FileText,
  LogOut,
  Package,
  Settings,
  Headset,
  Loader2,
} from 'lucide-react';
import { supabase } from '../supabase';
import { motion } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';

const menuItems = [
  { key: 'orders', label: 'Siparişlerim', icon: Package, to: '/orders' },
  { key: 'addresses', label: 'Adreslerim', icon: MapPin, to: '/profile/addresses' },
  { key: 'cards', label: 'Kayıtlı Kartlarım', icon: CreditCard, to: '/profile/cards' },
  { key: 'coupons', label: 'İndirim Kuponlarım', icon: TicketPercent, to: '/profile/coupons' },
  { key: 'support', label: 'Destek & Yardım', icon: Headset, to: '/profile/support' },
  { key: 'security', label: 'Şifre ve Güvenlik', icon: Shield, to: '/profile/security' },
  { key: 'contracts', label: 'Sözleşmeler', icon: FileText, to: '/profile/contracts' },
];

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

export default function Profile() {
  const navigate = useNavigate();
  const { user, avatarUrl, avatarUploading, uploadAvatar, authLoading } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [macroPoints, setMacroPoints] = useState(0);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
    }
  }, [authLoading, navigate, user]);

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const initials = useMemo(() => getInitials(displayName, user?.email), [displayName, user?.email]);
  const generalItems = useMemo(
    () => menuItems,
    []
  );
  const formattedMacroPoints = useMemo(
    () => Math.max(0, Number(macroPoints || 0)).toLocaleString('tr-TR'),
    [macroPoints]
  );
  const macroProgressPercent = useMemo(
    () => Math.min(100, (Math.max(0, Number(macroPoints || 0)) / 2000) * 100),
    [macroPoints]
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchMacroPoints() {
      if (authLoading || !user?.id) {
        if (isMounted) setMacroPoints(0);
        return;
      }

      try {
        let pointsValue = 0;

        const profileByUserId = await supabase
          .from('profiles')
          .select('macro_points')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profileByUserId.error && profileByUserId.data) {
          pointsValue = Number(profileByUserId.data?.macro_points || 0);
        } else {
          const profileById = await supabase
            .from('profiles')
            .select('macro_points')
            .eq('id', user.id)
            .maybeSingle();

          if (!profileById.error && profileById.data) {
            pointsValue = Number(profileById.data?.macro_points || 0);
          }
        }

        if (isMounted) setMacroPoints(Math.max(0, Number(pointsValue) || 0));
      } catch {
        if (isMounted) setMacroPoints(0);
      }
    }

    fetchMacroPoints();
    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.id]);

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?.id) return;
    setAvatarError('');

    try {
      await uploadAvatar(file);
    } catch (err) {
      setAvatarError(err?.message || 'Avatar yüklenemedi.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const renderMenuButton = (item) => {
    const Icon = item.icon;
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        key={item.key}
        onClick={() => navigate(item.to)}
        className="flex w-full items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:scale-[0.98]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
          <Icon size={18} className="text-gray-600" />
        </span>
        <span className="flex-1 truncate text-left text-sm font-semibold text-gray-900">{item.label}</span>
        <ChevronRight size={16} className="text-gray-300" />
      </motion.button>
    );
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#98CD00] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#F0F0F0]">
      <div className="app-page-padding w-full max-w-[430px] min-h-screen pb-28 pt-10">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <label className="relative block h-14 w-14 cursor-pointer overflow-hidden rounded-full border-2 border-[#98CD00] p-0.5 shadow-lg">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={avatarUploading}
              />
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600">
                  {initials}
                </div>
              )}
              {avatarUploading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                  <Loader2 size={16} className="animate-spin text-white" />
                </span>
              )}
            </label>
            <div className="min-w-0">
              <h1 className="mb-0 truncate text-xl font-bold leading-tight text-gray-900">{displayName}</h1>
              <p className="mb-0 mt-0.5 truncate text-sm text-gray-400">{user?.email || '-'}</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/profile/security')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm"
            aria-label="Ayarlar"
          >
            <Settings size={18} className="text-gray-600" />
          </motion.button>
        </header>

        {avatarError && <p className="mt-2 text-xs text-[#98CD00]">{avatarError}</p>}

        <section className="mt-4 rounded-2xl bg-[#202020] p-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-0 text-[11px] font-semibold uppercase tracking-wider text-white/70">Makro Puan</p>
              <p className="mb-0 mt-1 text-2xl font-semibold text-white">{formattedMacroPoints}</p>
            </div>
            <div className="inline-flex items-center rounded-full border border-white/25 px-2.5 py-1 text-xs font-semibold text-white">
              Aktif
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/75">
              <span>Sipariş verdikçe Makro Puan kazan, indirimleri yakala.</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white" style={{ width: `${macroProgressPercent}%` }} />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="app-heading-secondary mb-0 leading-none">Genel</h2>
          <div className="mt-3 space-y-3">
            {generalItems.map(renderMenuButton)}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleLogout}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-red-100 bg-white p-4 shadow-sm active:scale-[0.98]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <LogOut size={18} className="text-red-500" />
              </span>
              <span className="flex-1 truncate text-left text-sm font-semibold text-red-500">Çıkış Yap</span>
              <ChevronRight size={16} className="text-red-200" />
            </motion.button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
