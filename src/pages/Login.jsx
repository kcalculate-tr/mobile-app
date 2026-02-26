import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { supabase } from '../supabase';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSocialClick = (provider) => {
    setError('');
    setInfo(`${provider} ile devam etme özelliği yakında aktif olacak.`);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (authError) {
        setError('E-posta veya şifre yanlış.');
        return;
      }

      navigate('/');
    } catch {
      setError('Giriş yapılamadı. Lütfen yeniden deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg font-google text-brand-dark">
      <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-[max(1.8rem,env(safe-area-inset-bottom))] pt-4">
        <header className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-dark/10 bg-brand-white/80"
            aria-label="Geri"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="w-9" />
        </header>

        <section className="mt-5 rounded-[28px] bg-gradient-to-br from-brand-primary/20 via-brand-secondary/20 to-brand-white p-1.5 shadow-sm">
          <div className="overflow-hidden rounded-[22px] bg-brand-white">
            <img
              src="/images/kcal-banner-log.jpg"
              alt="Sağlıklı yemek"
              className="h-[172px] w-full object-cover sm:h-[186px]"
            />
          </div>
        </section>

        <form onSubmit={handleLogin} className="mt-5 space-y-3.5 font-google">
          <div className="flex justify-center overflow-visible pb-1">
            <img
              src="/images/kcal-logo-head.png"
              alt="Kcal"
              className="h-28 w-auto origin-center object-contain scale-[1.7] sm:h-32 sm:scale-[1.9]"
            />
          </div>

          <label className="block space-y-1.5">
            <span className="ml-1 font-google text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark/45">E-posta Adresi</span>
            <span className="relative block rounded-2xl border border-brand-dark/30">
              <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="email"
                required
                value={formData.email}
                placeholder="E-postanızı girin"
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full bg-transparent py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none ring-0 placeholder:text-brand-dark/55 focus:ring-0 font-google"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="ml-1 font-google text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark/45">Şifre</span>
            <span className="relative block rounded-2xl border border-brand-dark/30">
              <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                required
                value={formData.password}
                type={showPassword ? 'text' : 'password'}
                placeholder="Şifrenizi girin"
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full bg-transparent py-[0.82rem] pl-11 pr-12 text-[13px] text-brand-dark outline-none ring-0 placeholder:text-brand-dark/55 focus:ring-0 font-google"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-brand-dark/60"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {error && (
            <div className="inline-flex w-full items-center gap-2 rounded-xl border border-brand-secondary/40 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {info && !error && (
            <div className="rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-3 py-2 text-xs text-brand-dark/70">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand-primary py-[0.82rem] text-[15px] font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)] transition-all active:scale-[0.99] disabled:opacity-70 font-google"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                İşleniyor...
              </span>
            ) : 'Devam Et'}
          </button>

          <div className="flex items-center gap-3 py-0.5">
            <div className="h-px flex-1 bg-brand-white/10" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-dark/40">Hızlı Giriş</span>
            <div className="h-px flex-1 bg-brand-white/10" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSocialClick('Google')}
              className="rounded-xl border border-brand-dark/10 bg-brand-white py-2.5 text-[13px] font-semibold text-brand-dark font-google"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialClick('Apple')}
              className="rounded-xl border border-brand-dark/10 bg-brand-white py-2.5 text-[13px] font-semibold text-brand-dark font-google"
            >
              Apple
            </button>
            <button
              type="button"
              onClick={() => handleSocialClick('Facebook')}
              className="rounded-xl border border-brand-dark/10 bg-brand-white py-2.5 text-[13px] font-semibold text-brand-dark font-google"
            >
              Facebook
            </button>
          </div>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="mb-0 text-[13px] text-brand-dark/60">
            Hesabın yok mu?
            <Link to="/register" className="ml-1 font-bold text-brand-dark hover:underline">
              Kayıt ol
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
