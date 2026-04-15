import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Loader2 } from 'lucide-react'

export default function BranchLogin() {
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const slug        = window.location.hostname.split('.')[0]
  const isLocalhost = slug === 'localhost' || slug === '127'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Giriş başarısız.')
      setLoading(false)
      return
    }

    const { data: bu } = await supabase
      .from('branch_users')
      .select('branch_id')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (!bu) {
      await supabase.auth.signOut()
      setError('Bu hesaba bağlı şube bulunamadı.')
      setLoading(false)
      return
    }

    navigate('/dashboard/kitchen', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-dark">
            <span className="text-xl font-black tracking-tight text-white">KC</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-dark">Şube Girişi</h1>
          {!isLocalhost && (
            <p className="mt-1 text-sm text-slate-500">{slug}.eatkcal.com</p>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="sube@eatkcal.com"
                className="w-full rounded-xl border border-gray-200 bg-brand-input px-4 py-3 text-sm text-brand-dark placeholder:text-slate-300 outline-none transition focus:border-brand-primary focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 bg-brand-input px-4 py-3 text-sm text-brand-dark placeholder:text-slate-300 outline-none transition focus:border-brand-primary focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(132,204,22,0.35)] transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
