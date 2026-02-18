import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Headset } from 'lucide-react';
import { supabase } from '../supabase';
import { motion } from 'framer-motion';

const TOPIC_OPTIONS = [
  'Sipariş Sorunu',
  'İade Talebi',
  'Bozuk/Eksik Ürün',
  'Teslimat Gecikmesi',
  'Diğer',
];

function splitNameParts(fullName, email) {
  const safe = String(fullName || '').trim();
  if (safe) {
    const parts = safe.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  const fallback = String(email || '').split('@')[0];
  return { firstName: fallback || '', lastName: '' };
}

export default function Support() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(TOPIC_OPTIONS[0]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const nameFromMeta = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
      const parts = splitNameParts(nameFromMeta, user?.email);
      setFirstName(parts.firstName);
      setLastName(parts.lastName);
      setEmail(String(user?.email || ''));
      setLoading(false);
    }

    loadUser();
  }, [navigate]);

  const fullName = useMemo(() => {
    const combined = `${firstName} ${lastName}`.trim();
    return combined || '-';
  }, [firstName, lastName]);

  const handleSubmit = (event) => {
    event.preventDefault();
    alert('Talebiniz alındı. En kısa sürede dönüş yapacağız.');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] p-8 text-center text-brand-dark/60">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F0F0] px-5 pb-10 pt-6 text-brand-dark">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="mb-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-white shadow-sm"
            aria-label="Geri"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="mb-0 text-xl text-brand-dark">Destek & Yardım</h1>
            <p className="mb-0 text-xs text-brand-dark/60">Müşteri hizmetleri talep formu</p>
          </div>
        </header>

        <section className="rounded-2xl border border-brand-primary bg-orange-50/50 p-4 shadow-sm">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-white px-3 py-1.5 text-xs text-brand-dark/75">
            <Headset size={14} className="text-brand-primary" />
            Destek Masası
          </div>

          <div className="mb-4 inline-flex w-full items-start gap-2 rounded-xl border border-brand-primary/35 bg-brand-white px-3 py-2 text-xs text-brand-dark/75">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-brand-primary" />
            Formu gönderdiğinizde ekibimiz en kısa sürede sizinle iletişime geçer.
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-brand-dark/70">Ad</span>
                <input
                  value={firstName}
                  readOnly
                  className="w-full rounded-xl bg-brand-white px-3 py-2 text-sm text-brand-dark"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-brand-dark/70">Soyad</span>
                <input
                  value={lastName}
                  readOnly
                  className="w-full rounded-xl bg-brand-white px-3 py-2 text-sm text-brand-dark"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs text-brand-dark/70">E-posta</span>
              <input
                value={email}
                readOnly
                className="w-full rounded-xl bg-brand-white px-3 py-2 text-sm text-brand-dark"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-brand-dark/70">Konu Seçimi</span>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-xl bg-brand-white px-3 py-2 text-sm text-brand-dark"
              >
                {TOPIC_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-brand-dark/70">Mesajınız</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                required
                placeholder={`${fullName}, talebinizi buraya detaylı yazabilirsiniz...`}
                className="w-full resize-none rounded-xl bg-brand-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark/50"
              />
            </label>

            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-3 font-normal text-brand-white"
            >
              Talebi Gönder
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
