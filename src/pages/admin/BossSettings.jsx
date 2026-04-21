/**
 * BossSettings.jsx — Genel Mağaza Ayarları
 * Loads from / saves to `settings` table (key/value store)
 * Keys: store_name, store_phone, store_email, min_cart_amount, currency, notification_email
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Settings, X } from 'lucide-react';
import { supabase } from '../../supabase';

const SETTING_KEYS = [
  'store_name',
  'store_phone',
  'store_email',
  'min_cart_amount',
  'currency',
  'notification_email',
];

const LABELS = {
  store_name: 'Mağaza Adı',
  store_phone: 'Mağaza Telefonu',
  store_email: 'Mağaza E-postası',
  min_cart_amount: 'Min. Sepet Tutarı (₺)',
  currency: 'Para Birimi Gösterimi',
  notification_email: 'Bildirim E-postası',
};

const PLACEHOLDERS = {
  store_name: 'EatKcal',
  store_phone: '+90 212 000 00 00',
  store_email: 'info@eatkcal.com',
  min_cart_amount: '50',
  currency: '₺',
  notification_email: 'admin@eatkcal.com',
};

const TYPES = {
  min_cart_amount: 'number',
};

export default function BossSettings() {
  const [values, setValues]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const [ok, setOk]           = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setErr('');
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', SETTING_KEYS);

    if (error) {
      setErr(error.message);
    } else {
      const map = {};
      (data || []).forEach(row => { map[row.key] = row.value ?? ''; });
      // fill missing keys with empty string
      SETTING_KEYS.forEach(k => { if (map[k] === undefined) map[k] = ''; });
      setValues(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const set = (k, v) => setValues(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(''); setOk('');
    const upserts = SETTING_KEYS.map(k => ({ key: k, value: String(values[k] ?? '') }));
    const { error } = await supabase
      .from('settings')
      .upsert(upserts, { onConflict: 'key' });

    if (error) setErr(error.message);
    else setOk('Ayarlar kaydedildi.');
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text">Genel Ayarlar</h1>
            <p className="mt-1 text-sm text-slate-500">Mağaza adı, iletişim bilgileri, sepet limiti ve gösterim ayarlarını yönetin.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-geex-border bg-geex-bg px-3 py-1 text-xs font-semibold text-slate-500">
            <Settings size={13} /> Mağaza Ayarları
          </span>
        </div>
      </section>

      {err && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}<button onClick={() => setErr('')}><X size={14} /></button>
        </div>
      )}
      {ok && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {ok}<button onClick={() => setOk('')}><X size={14} /></button>
        </div>
      )}

      <section className="rounded-3xl border border-geex-border bg-geex-card p-6 shadow-geex-soft">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-brand-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {SETTING_KEYS.map(k => (
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  {LABELS[k]}
                </label>
                <input
                  type={TYPES[k] || 'text'}
                  value={values[k] ?? ''}
                  onChange={e => set(k, e.target.value)}
                  placeholder={PLACEHOLDERS[k] || ''}
                  className="w-full rounded-xl border border-geex-border bg-geex-bg px-3 py-2.5 text-sm text-geex-text outline-none focus:border-brand-primary"
                />
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)] disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Ayarları Kaydet
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
