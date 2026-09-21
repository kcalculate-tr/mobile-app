import { createClient } from '@supabase/supabase-js'

/**
 * Ortam değişkenleri panel dışından (Vercel) geliyor. Kopyala-yapıştır
 * sırasında sona kaçan bir satır sonu / boşluk tüm istekleri geçersiz
 * bir URL'e yollar ve panel sessizce çalışmaz hale gelir. Bu yüzden
 * değerleri kullanmadan önce temizliyoruz.
 */
const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''

const url = clean(import.meta.env.VITE_SUPABASE_URL)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

if (!url || !key) {
  throw new Error(
    'Supabase yapılandırması eksik: VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı olmalı.'
  )
}

export const supabase = createClient(url, key)
