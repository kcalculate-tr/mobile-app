import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Lock, Mail, Phone, User } from 'lucide-react';
import { supabase } from '../supabase';

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSocialClick = (provider) => {
    setError('');
    setInfo(`${provider} ile hızlı kayıt yakında aktif olacak.`);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    const trimmedName = formData.fullName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedName) {
      setError('Ad soyad alanını doldurun.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      setLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError('Devam etmek için sözleşmeyi onaylayın.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: formData.password,
        options: {
          data: {
            full_name: trimmedName,
            phone: trimmedPhone,
          },
        },
      });

      if (authError) {
        setError(authError.message || 'Hesap oluşturulamadı.');
        return;
      }

      if (data?.session) {
        navigate('/');
        return;
      }

      setInfo('Hesabın oluşturuldu. Giriş ekranına yönlendiriliyorsun.');
      setTimeout(() => navigate('/login'), 1200);
    } catch {
      setError('Kayıt tamamlanamadı. Lütfen yeniden dene.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F0F0] to-[#F0F0F0] text-brand-dark">
      <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-[max(1.8rem,env(safe-area-inset-bottom))] pt-4">
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-white/15 bg-[#F0F0F0]"
            aria-label="Geri"
          >
            <ArrowLeft size={17} />
          </button>
          <p className="mb-0 font-description text-[10px] font-bold uppercase tracking-[0.22em] text-brand-dark/45">KCAL</p>
          <div className="w-9" />
        </header>

        <section className="mt-5 rounded-3xl border border-brand-white/10 bg-[#F0F0F0] p-3.5">
          <img
            src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=80"
            alt="Sağlıklı yemek"
            className="h-[148px] w-full rounded-2xl object-cover"
          />
          <h1 className="mt-3.5 mb-1 text-[30px] font-extrabold leading-[1.02] text-brand-dark">Aramıza Katıl</h1>
          <p className="mb-0 text-[13px] text-brand-dark/60">30 saniyede hesabını oluştur, siparişe başla.</p>
        </section>

        <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
          <label className="block space-y-1.5">
            <span className="ml-1 font-description text-[10px] font-bold uppercase tracking-[0.14em] text-brand-dark/45">Ad Soyad</span>
            <span className="relative block">
              <User size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="text"
                required
                value={formData.fullName}
                placeholder="Ad Soyad"
                onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full rounded-2xl border border-brand-white/15 bg-[#F0F0F0] py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none placeholder:text-brand-dark/35 focus:border-[#98CD00]"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="ml-1 font-description text-[10px] font-bold uppercase tracking-[0.14em] text-brand-dark/45">E-posta</span>
            <span className="relative block">
              <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="email"
                required
                value={formData.email}
                placeholder="ornek@eposta.com"
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-2xl border border-brand-white/15 bg-[#F0F0F0] py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none placeholder:text-brand-dark/35 focus:border-[#98CD00]"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="ml-1 font-description text-[10px] font-bold uppercase tracking-[0.14em] text-brand-dark/45">Telefon (İsteğe Bağlı)</span>
            <span className="relative block">
              <Phone size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="tel"
                value={formData.phone}
                placeholder="05xx xxx xx xx"
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-2xl border border-brand-white/15 bg-[#F0F0F0] py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none placeholder:text-brand-dark/35 focus:border-[#98CD00]"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="ml-1 font-description text-[10px] font-bold uppercase tracking-[0.14em] text-brand-dark/45">Şifre</span>
            <span className="relative block">
              <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="password"
                required
                value={formData.password}
                placeholder="En az 6 karakter"
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full rounded-2xl border border-brand-white/15 bg-[#F0F0F0] py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none placeholder:text-brand-dark/35 focus:border-[#98CD00]"
              />
            </span>
          </label>

          <label htmlFor="terms" className="mt-2 flex cursor-pointer items-start gap-2 rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-3 py-2.5">
            <input
              id="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#98CD00]"
            />
            <span className="text-xs leading-relaxed text-brand-dark/65">
              Kullanım Koşulları ve Gizlilik Politikası’nı okudum, kabul ediyorum.
            </span>
          </label>

          {error && (
            <div className="inline-flex w-full items-center gap-2 rounded-xl border border-brand-secondary/40 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          {info && !error && (
            <div className="rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-white bg-[#98CD00] py-[0.82rem] text-[15px] font-bold text-[#F0F0F0] shadow-[0_10px_24px_rgba(152,205,0,0.35)] transition-all active:scale-[0.99] disabled:opacity-70"
          >
            {loading ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur'}
            {!loading && <ArrowRight size={17} />}
          </button>

          <div className="flex items-center gap-3 py-0.5">
            <div className="h-px flex-1 bg-brand-white/10" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-dark/40">Hızlı Kayıt</span>
            <div className="h-px flex-1 bg-brand-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSocialClick('Google')}
              className="rounded-xl border border-brand-white/15 bg-[#F0F0F0] py-2.5 text-[13px] font-semibold text-brand-dark"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialClick('Apple')}
              className="rounded-xl border border-brand-white/15 bg-[#F0F0F0] py-2.5 text-[13px] font-semibold text-brand-dark"
            >
              Apple
            </button>
          </div>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="mb-0 text-[13px] text-brand-dark/60">
            Zaten hesabın var mı?
            <Link to="/login" className="ml-1 font-bold text-brand-dark hover:underline">
              Giriş yap
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
