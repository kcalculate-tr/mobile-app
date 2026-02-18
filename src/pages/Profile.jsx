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
  Award,
  BadgeCheck,
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
        whileTap={{ scale: 0.95 }}
        key={item.key}
        onClick={() => navigate(item.to)}
        className="w-full flex items-center gap-4 p-4 bg-brand-white rounded-xl shadow-md active:scale-[0.98]"
      >
        <span className="w-10 h-10 rounded-lg bg-brand-bg flex items-center justify-center shrink-0">
          <Icon size={18} className="text-brand-primary" />
        </span>
        <span className="flex-1 text-left font-semibold text-brand-dark truncate">{item.label}</span>
        <ChevronRight size={18} className="text-brand-dark/60" />
      </motion.button>
    );
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#F0F0F0] p-8 text-center text-brand-dark/60">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-brand-dark flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen px-5 pb-28 pt-10">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <label className="relative block w-14 h-14 cursor-pointer rounded-full border-2 border-[#98CD00] p-0.5 bg-[#F0F0F0] shadow-lg overflow-hidden">
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
                <div className="w-full h-full rounded-full bg-[#F0F0F0] text-brand-dark flex items-center justify-center text-lg font-bold">
                  {initials}
                </div>
              )}
              {avatarUploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-brand-dark/35 text-brand-white">
                  <Loader2 size={16} className="animate-spin" />
                </span>
              )}
            </label>
            <div className="min-w-0">
              <h1 className="mb-0 truncate text-2xl font-bold leading-tight text-brand-dark">{displayName}</h1>
              <p className="mb-0 mt-0.5 truncate text-sm text-brand-dark/55">{user?.email || '-'}</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/profile/security')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-white shadow-sm border border-[#82CD47] shrink-0"
            aria-label="Ayarlar"
          >
            <Settings size={18} className="text-[#202020]" />
          </motion.button>
        </header>

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-yellow-500 bg-brand-white px-3 py-1.5">
          <Award size={14} className="text-yellow-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-600">Altın Seviye</span>
        </div>
        {avatarError && <p className="mt-2 text-xs text-[#98CD00]">{avatarError}</p>}

        <section className="mt-4 rounded-2xl bg-brand-white p-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-0 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/80">Sadakat Puanı</p>
              <p className="mb-0 mt-1 text-2xl font-semibold text-brand-dark">1,250</p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-2.5 py-1 text-xs font-semibold text-brand-dark">
              <BadgeCheck size={12} className="text-brand-primary" />
              Altın Seviye
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-brand-dark/75">
              <span>Platin Seviyeye İlerleme</span>
              <span className="font-semibold">%75</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-brand-white/70">
              <div className="h-full w-3/4 rounded-full bg-brand-primary" />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-0 text-[30px] leading-none text-brand-dark">Genel</h2>
          <div className="mt-3 space-y-3">
            {generalItems.map(renderMenuButton)}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-4 bg-brand-white rounded-xl shadow-md active:scale-[0.98]"
            >
              <span className="w-10 h-10 rounded-lg bg-brand-bg flex items-center justify-center shrink-0">
                <LogOut size={18} className="text-brand-primary" />
              </span>
              <span className="flex-1 text-left font-semibold text-brand-dark truncate">Çıkış Yap</span>
              <ChevronRight size={18} className="text-brand-dark/60" />
            </motion.button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-3 py-2 text-xs text-brand-dark">
              {error}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
