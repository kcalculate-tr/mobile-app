import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import { supabase } from '../supabase';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim(),
        password,
      });

      if (authError) {
        setError('Giriş yapılamadı. E-posta veya şifreyi kontrol edin.');
        return;
      }

      let userId = String(authData?.user?.id || '').trim();
      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = String(user?.id || '').trim();
      }

      if (!userId) {
        setError('Kullanıcı bilgisi alınamadı. Lütfen tekrar deneyin.');
        return;
      }

      let profileResponse = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (profileResponse.error && String(profileResponse.error.code || '') === '42703') {
        profileResponse = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .limit(1)
          .maybeSingle();
      }

      if (profileResponse.error) {
        throw profileResponse.error;
      }

      const role = String(profileResponse.data?.role || '').trim().toLowerCase();

      if (role === 'boss') {
        navigate('/boss', { replace: true });
        return;
      }

      if (role === 'kitchen') {
        navigate('/kitchen', { replace: true });
        return;
      }

      await supabase.auth.signOut();
      setError('Bu hesap için personel paneli yetkisi bulunmuyor.');
    } catch (err) {
      setError(err?.message || 'Personel girişi sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-geex-bg px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-3xl border border-geex-border bg-white p-6 shadow-geex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Personel Girişi</p>
            <h1 className="mt-2 text-2xl font-zalando text-geex-text">Operasyon Paneli</h1>
            <p className="mt-1 text-sm text-slate-500">E-posta ve şifrenizle sisteme giriş yapın.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">E-posta</span>
              <span className="relative block">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-geex-border bg-white pl-10 pr-3 text-sm font-medium text-geex-text placeholder:text-slate-400"
                  placeholder="ornek@kcal.com"
                  required
                />
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Şifre</span>
              <span className="relative block">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-geex-border bg-white pl-10 pr-3 text-sm font-medium text-geex-text placeholder:text-slate-400"
                  placeholder="Şifreniz"
                  required
                />
              </span>
            </label>

            {error && (
              <div className="inline-flex w-full items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary text-sm font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
