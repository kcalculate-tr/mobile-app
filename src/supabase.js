import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '%c FATAL ERROR: Supabase yapılandırması eksik! ',
    'background:#ff0000;color:#ffffff;font-size:18px;font-weight:bold;padding:4px 8px;border-radius:4px'
  );
  console.error(
    '%c .env dosyasına VITE_SUPABASE_URL ve VITE_SUPABASE_KEY ekleyin.\n' +
      ' Mevcut değerler → URL: %s | KEY: %s',
    'color:#ff4444;font-size:14px;font-weight:bold',
    supabaseUrl ?? '(tanımsız)',
    supabaseKey ? '***gizli***' : '(tanımsız)'
  );
}

if (/localhost|127\.0\.0\.1/i.test(String(supabaseUrl || ''))) {
  console.warn(
    '%c Supabase URL localhost olarak ayarlanmış. Gerçek cihazda Vercel URL veya yerel ağ IP kullanın.',
    'color:#ff8800;font-size:12px'
  );
}

// Tüm Supabase REST isteklerine no-store/no-cache header ekler.
// Bu, mobil WebView / PWA'nın eski yanıtı cache'den sunmasını engeller.
function noStoreFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('Pragma', 'no-cache');
  return fetch(url, { ...options, headers });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: {
      schema: 'public',
    },
    global: {
      fetch: noStoreFetch,
    },
  }
);
