/**
 * BossVitrin.jsx — Vitrin Yönetimi
 * Sekmeler: Bannerlar | Kampanyalar | Pop-up'lar
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Loader2, Megaphone, Percent, Trash2, ToggleLeft, ToggleRight, X, Zap, Coins } from 'lucide-react';
import BossMacro from './BossMacro';
import { supabase } from '../../supabase';
import ImageUploadField from '../../components/ImageUploadField';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'banners',   label: 'Bannerlar',   Icon: Image },
  { key: 'campaigns', label: 'Kampanyalar', Icon: Percent },
  { key: 'popups',    label: 'Pop-up\'lar', Icon: Zap },
  { key: 'macro',     label: 'Macro',       Icon: Coins },
];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
    </div>
  );
}

function ErrBox({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {msg}
      <button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

function OkBox({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
      {msg}
      <button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export default function BossVitrin() {
  const [tab, setTab] = useState('banners');

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text">Vitrin Yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">Banner, kampanya ve pop-up içeriklerini yönetin.</p>
          </div>
        </div>
        <div className="mt-4 inline-flex rounded-2xl border border-geex-border bg-geex-bg p-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                tab === key
                  ? 'bg-brand-primary text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]'
                  : 'text-geex-text hover:bg-white'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft overflow-hidden">
        {tab === 'banners'   && <BannersTab />}
        {tab === 'campaigns' && <CampaignsTab />}
        {tab === 'popups'    && <PopupsTab />}
        {tab === 'macro'     && <BossMacro embedded />}
      </section>
    </div>
  );
}

// ─── BANNERLAR ────────────────────────────────────────────────────────────────
// Real schema: id, title, image_url, link (not link_url), order (not order_index), is_active
const BANNER_EMPTY = { title: '', image_url: '', link: '', order: '', is_active: true, navigate_to: 'Home', section: 'slider' };

function BannersTab() {
  const [categories, setCategories] = React.useState([]);
  React.useEffect(() => {
    supabase.from('categories').select('id, name').is('parent_id', null).order('name')
      .then(({ data }) => setCategories(data || []));
  }, []);
  const [banners, setBanners]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [ok, setOk]             = useState('');
  const [form, setForm]         = useState(BANNER_EMPTY);
  const [editId, setEditId]     = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('banners').select('*').order('order');
    if (error) setErr(error.message);
    else setBanners(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const resetForm = () => { setForm(BANNER_EMPTY); setEditId(null); };

  const startEdit = (b) => {
    setForm({
      title: b.title || '',
      image_url: b.image_url || '',
      link: b.link || '',
      order: String(b.order ?? ''),
      is_active: b.is_active ?? true,
      navigate_to: b.navigate_to || 'Home',
      section: b.section || 'slider',
    });
    setEditId(b.id);
  };

  const save = async () => {
    if (!form.image_url.trim()) { setErr('Resim zorunlu.'); return; }
    setSaving(true); setErr(''); setOk('');
    const payload = {
      title: form.title.trim(),
      image_url: form.image_url.trim(),
      link: form.link.trim() || null,
      order: Number(form.order) || 0,
      is_active: form.is_active,
      navigate_to: form.navigate_to || 'Home',
      section: form.section || 'slider',
    };
    const { error } = editId
      ? await supabase.from('banners').update(payload).eq('id', editId)
      : await supabase.from('banners').insert(payload);
    if (error) setErr(error.message);
    else { setOk(editId ? 'Banner güncellendi.' : 'Banner eklendi.'); resetForm(); fetch_(); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!confirm('Banneri silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) setErr(error.message);
    else { setOk('Banner silindi.'); fetch_(); }
  };

  const toggleActive = async (b) => {
    await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id);
    fetch_();
  };

  return (
    <div className="p-5 space-y-4">
      <ErrBox msg={err} onClose={() => setErr('')} />
      <OkBox  msg={ok}  onClose={() => setOk('')} />

      {/* Form */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-bold text-gray-800">{editId ? 'Banner Düzenle' : 'Yeni Banner Ekle'}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-xs">Başlık</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Banner başlığı" className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Link (opsiyonel)</label>
            <input value={form.link} onChange={e => set('link', e.target.value)} placeholder="/teklifler" className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Bölüm</label>
            <select value={form.section || 'slider'} onChange={e => set('section', e.target.value)} className="input-sm">
              <option value="slider">🎠 Ana Slayt</option>
              <option value="promo">📢 Promo Banner (Bu Hafta Popüler)</option>
            </select>
          </div>
          <div>
            <label className="label-xs">Yönlendir →</label>
            <select value={form.navigate_to || 'Home'} onChange={e => set('navigate_to', e.target.value)} className="input-sm">
              <optgroup label="Sayfalar">
                <option value="Home">Anasayfa</option>
                <option value="Categories">Tüm Kategoriler</option>
                <option value="Offers">Teklifler</option>
                <option value="Addresses">Adreslerim</option>
                <option value="ProfileOrders">Siparişlerim</option>
                <option value="ProfileCoupons">Kuponlarım</option>
                <option value="Subscriptions">Macro</option>
                <option value="NutritionProfile">Beslenme Profili</option>
                <option value="ProfileSupport">Destek</option>
              </optgroup>
              {categories.length > 0 && (
                <optgroup label="Kategoriler">
                  {categories.map(cat => (
                    <option key={cat.id} value={`CategoryProducts:${cat.name}`}>{cat.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="label-xs">Sıra No</label>
            <input type="number" min="0" value={form.order} onChange={e => set('order', e.target.value)} placeholder="0" className="input-sm" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button type="button" onClick={() => set('is_active', !form.is_active)} className="text-gray-500">
              {form.is_active ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} />}
            </button>
            <span className="text-sm text-gray-600">{form.is_active ? 'Aktif' : 'Pasif'}</span>
          </div>
        </div>
        <ImageUploadField
          label="Banner Görseli *"
          value={form.image_url}
          onUploaded={v => set('image_url', v)}
          folder="banners"
          aspectRatio={2}
          aspectLabel="2:1"
          recommendedSize="1600×800"
          showMobilePreview
        />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Kaydediliyor…' : editId ? 'Güncelle' : 'Ekle'}
          </button>
          {editId && <button onClick={resetForm} className="btn-ghost text-sm">İptal</button>}
        </div>
      </div>

      {/* Liste */}
      {loading ? <Spinner /> : banners.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Henüz banner yok.</p>
      ) : (
        <div className="space-y-2">
          {banners.map(b => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <span className="w-6 text-center text-xs font-mono text-gray-300">{b.order}</span>
              {b.image_url && <img src={b.image_url} alt={b.title} className="h-12 w-20 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">{b.title || '(Başlıksız)'}</p>
                <p className="truncate text-xs text-gray-400 flex items-center gap-1">
                  <span>{b.link || '—'}</span>
                  <span className="rounded-full bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-primary">→ {b.navigate_to || 'Home'}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{b.section === 'promo' ? '📢 Promo' : '🎠 Slayt'}</span>
                </p>
              </div>
              <button type="button" onClick={() => toggleActive(b)} className="shrink-0">
                {b.is_active ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-300" />}
              </button>
              <button onClick={() => startEdit(b)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => del(b.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KAMPANYALAR ──────────────────────────────────────────────────────────────
// Real schema: id, title, code, badge, discount_type (percent|fixed), discount_value,
//   max_discount, min_cart_total, start_date, end_date, is_active, order,
//   image_url, color_from, color_via, color_to, created_at
const CAMP_EMPTY = {
  title: '', code: '', badge: '', discount_type: 'percent', discount_value: '',
  max_discount: '', min_cart_total: '', start_date: '', end_date: '',
  is_active: true, order: '', image_url: '',
  color_from: '#98CD00', color_via: '', color_to: '#5a7a00',
};

function CampaignsTab() {
  const [camps, setCamps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const [ok, setOk]           = useState('');
  const [form, setForm]       = useState(CAMP_EMPTY);
  const [editId, setEditId]   = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('campaigns').select('*').order('order', { ascending: true });
    if (error) setErr(error.message);
    else setCamps(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const resetForm = () => { setForm(CAMP_EMPTY); setEditId(null); };

  const startEdit = (c) => {
    setForm({
      title: c.title || '',
      code: c.code || '',
      badge: c.badge || '',
      discount_type: c.discount_type || 'percent',
      discount_value: String(c.discount_value ?? ''),
      max_discount: String(c.max_discount ?? ''),
      min_cart_total: String(c.min_cart_total ?? ''),
      start_date: c.start_date ? c.start_date.slice(0, 16) : '',
      end_date: c.end_date ? c.end_date.slice(0, 16) : '',
      is_active: c.is_active ?? true,
      order: String(c.order ?? ''),
      image_url: c.image_url || '',
      color_from: c.color_from || '#98CD00',
      color_via: c.color_via || '',
      color_to: c.color_to || '#5a7a00',
    });
    setEditId(c.id);
  };

  const save = async () => {
    if (!form.title.trim()) { setErr('Kampanya başlığı zorunlu.'); return; }
    if (!form.code.trim()) { setErr('Kupon kodu zorunlu.'); return; }
    const val = parseFloat(form.discount_value);
    if (!Number.isFinite(val) || val <= 0) { setErr('İndirim değeri geçersiz.'); return; }
    setSaving(true); setErr(''); setOk('');
    const payload = {
      title: form.title.trim(),
      code: form.code.trim().toUpperCase(),
      badge: form.badge.trim() || null,
      discount_type: form.discount_type,
      discount_value: val,
      max_discount: parseFloat(form.max_discount) || 0,
      min_cart_total: parseFloat(form.min_cart_total) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_active: form.is_active,
      order: Number(form.order) || 0,
      image_url: form.image_url.trim() || null,
      color_from: form.color_from || null,
      color_via: form.color_via || null,
      color_to: form.color_to || null,
    };
    const { error } = editId
      ? await supabase.from('campaigns').update(payload).eq('id', editId)
      : await supabase.from('campaigns').insert(payload);
    if (error) setErr(error.message);
    else { setOk(editId ? 'Kampanya güncellendi.' : 'Kampanya eklendi.'); resetForm(); fetch_(); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!confirm('Kampanyayı silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) setErr(error.message);
    else { setOk('Kampanya silindi.'); fetch_(); }
  };

  const toggleActive = async (c) => {
    await supabase.from('campaigns').update({ is_active: !c.is_active }).eq('id', c.id);
    fetch_();
  };

  const isLive = (c) => {
    if (!c.is_active) return false;
    const now = new Date();
    if (c.start_date && new Date(c.start_date) > now) return false;
    if (c.end_date   && new Date(c.end_date)   < now) return false;
    return true;
  };

  return (
    <div className="p-5 space-y-4">
      <ErrBox msg={err} onClose={() => setErr('')} />
      <OkBox  msg={ok}  onClose={() => setOk('')} />

      {/* Form */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-bold text-gray-800">{editId ? 'Kampanya Düzenle' : 'Yeni Kampanya'}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-xs">Başlık *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Yaz Kampanyası" className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Kupon Kodu *</label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="YAZ2025" className="input-sm font-mono" />
          </div>
          <div>
            <label className="label-xs">Rozet / Etiket</label>
            <input value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="Popüler" className="input-sm" />
          </div>
          <div>
            <label className="label-xs">İndirim Türü</label>
            <select value={form.discount_type} onChange={e => set('discount_type', e.target.value)} className="input-sm">
              <option value="percent">Yüzde (%)</option>
              <option value="fixed">Sabit Tutar (₺)</option>
            </select>
          </div>
          <div>
            <label className="label-xs">İndirim Değeri *</label>
            <input type="number" min="0" step="0.01" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} placeholder={form.discount_type === 'percent' ? '10' : '25'} className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Max. İndirim (₺)</label>
            <input type="number" min="0" step="0.01" value={form.max_discount} onChange={e => set('max_discount', e.target.value)} placeholder="Opsiyonel" className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Min. Sepet Tutarı (₺)</label>
            <input type="number" min="0" step="0.01" value={form.min_cart_total} onChange={e => set('min_cart_total', e.target.value)} placeholder="0" className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Sıra No</label>
            <input type="number" min="0" value={form.order} onChange={e => set('order', e.target.value)} placeholder="0" className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Başlangıç Tarihi</label>
            <input type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Bitiş Tarihi</label>
            <input type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="input-sm" />
          </div>
          <div>
            <label className="label-xs">Renk Başlangıç</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color_from} onChange={e => set('color_from', e.target.value)} className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
              <input value={form.color_from} onChange={e => set('color_from', e.target.value)} className="input-sm" />
            </div>
          </div>
          <div>
            <label className="label-xs">Renk Bitiş</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color_to} onChange={e => set('color_to', e.target.value)} className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
              <input value={form.color_to} onChange={e => set('color_to', e.target.value)} className="input-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4 sm:col-span-2">
            <button type="button" onClick={() => set('is_active', !form.is_active)}>
              {form.is_active ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} className="text-gray-300" />}
            </button>
            <span className="text-sm text-gray-600">{form.is_active ? 'Aktif' : 'Pasif'}</span>
          </div>
        </div>
        <ImageUploadField label="Kampanya Görseli" value={form.image_url} onUploaded={v => set('image_url', v)} folder="campaigns" />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Kaydediliyor…' : editId ? 'Güncelle' : 'Ekle'}
          </button>
          {editId && <button onClick={resetForm} className="btn-ghost text-sm">İptal</button>}
        </div>
      </div>

      {/* Liste */}
      {loading ? <Spinner /> : camps.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Henüz kampanya yok.</p>
      ) : (
        <div className="space-y-2">
          {camps.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ background: c.color_from ? `linear-gradient(135deg, ${c.color_from}, ${c.color_to || c.color_from})` : '#98CD00' }}
              >
                {c.discount_type === 'percent' ? `%${c.discount_value}` : `${c.discount_value}₺`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-800">{c.title}</p>
                  {c.badge && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{c.badge}</span>}
                </div>
                <p className="text-xs text-gray-400 font-mono">{c.code}{c.min_cart_total > 0 ? ` · Min. ${c.min_cart_total}₺` : ''}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isLive(c) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                {isLive(c) ? 'Aktif' : 'Pasif'}
              </span>
              <button type="button" onClick={() => toggleActive(c)}>
                {c.is_active ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-300" />}
              </button>
              <button onClick={() => startEdit(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => del(c.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── POP-UP'LAR ───────────────────────────────────────────────────────────────
const POPUP_EMPTY = {
  title: '',
  description: '',
  image_url: '',
  button_label: '',
  button_link: '',
  button_navigate_to: 'Home',
  order_index: '',
  is_active: true,
  starts_at: '',
  ends_at: '',
};

const POPUP_PAGES = [
  { value: 'Home',             label: 'Anasayfa' },
  { value: 'Categories',       label: 'Kategoriler' },
  { value: 'Offers',           label: 'Teklifler' },
  { value: 'Addresses',        label: 'Adreslerim' },
  { value: 'ProfileOrders',    label: 'Siparişlerim' },
  { value: 'ProfileCoupons',   label: 'Kuponlar & Kampanyalar' },
  { value: 'Subscriptions',    label: 'Macro' },
  { value: 'NutritionProfile', label: 'Beslenme Profili' },
  { value: 'ProfileSupport',   label: 'Destek' },
  { value: 'Feedback',         label: 'Öneri & Görüş' },
];

function PopupsTab() {
  const [popups,  setPopups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [ok,      setOk]      = useState('');
  const [form,    setForm]    = useState(POPUP_EMPTY);
  const [editId,  setEditId]  = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('popups')
      .select('*')
      .order('order_index', { ascending: true });
    if (error) setErr(error.message);
    else setPopups(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const resetForm = () => { setForm(POPUP_EMPTY); setEditId(null); };

  const startEdit = (p) => {
    setForm({
      title:        p.title        || '',
      description:  p.description  || '',
      image_url:    p.image_url    || '',
      button_label: p.button_label || '',
      button_link:  p.button_link  || '',
      order_index:  String(p.order_index ?? ''),
      is_active:    p.is_active    ?? true,
      starts_at:         p.starts_at ? p.starts_at.slice(0, 16) : '',
      ends_at:           p.ends_at   ? p.ends_at.slice(0, 16)   : '',
      button_navigate_to: p.button_navigate_to || 'Home',
    });
    setEditId(p.id);
  };

  const isLive = (p) => {
    if (!p.is_active) return false;
    const now = new Date();
    if (p.starts_at && new Date(p.starts_at) > now) return false;
    if (p.ends_at   && new Date(p.ends_at)   < now) return false;
    return true;
  };

  const save = async () => {
    setSaving(true); setErr(''); setOk('');
    const payload = {
      title:        form.title.trim()        || null,
      description:  form.description.trim()  || null,
      image_url:    form.image_url.trim()    || null,
      button_label: form.button_label.trim() || null,
      button_link:      form.button_link.trim()  || null,
      button_navigate_to: form.button_navigate_to || 'Home',
      order_index:  Number(form.order_index) || 0,
      is_active:    form.is_active,
      starts_at:    form.starts_at || null,
      ends_at:      form.ends_at   || null,
    };
    const { error } = editId
      ? await supabase.from('popups').update(payload).eq('id', editId)
      : await supabase.from('popups').insert(payload);
    if (error) setErr(error.message);
    else { setOk(editId ? 'Pop-up güncellendi.' : 'Pop-up eklendi.'); resetForm(); fetch_(); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!confirm('Pop-up\'ı silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.from('popups').delete().eq('id', id);
    if (error) setErr(error.message);
    else { setOk('Pop-up silindi.'); fetch_(); }
  };

  const toggleActive = async (p) => {
    await supabase.from('popups').update({ is_active: !p.is_active }).eq('id', p.id);
    fetch_();
  };

  return (
    <div className="p-5 space-y-4">
      <ErrBox msg={err} onClose={() => setErr('')} />
      <OkBox  msg={ok}  onClose={() => setOk('')} />

      {/* Bilgi kutusu */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
        <Zap size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-xs text-amber-700">
          Pop-up'lar müşteri uygulamasında <strong>HomeScreen'e ilk girişte</strong> oturum başına bir kez gösterilir.
          Birden fazla aktif pop-up varsa <strong>order_index</strong> sırasıyla gösterilir.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-bold text-gray-800">{editId ? 'Pop-up Düzenle' : 'Yeni Pop-up Ekle'}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-xs">Başlık</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Hoşgeldin! 🎉"
              className="input-sm"
            />
          </div>
          <div>
            <label className="label-xs">Sıra No</label>
            <input
              type="number" min="0"
              value={form.order_index}
              onChange={e => set('order_index', e.target.value)}
              placeholder="0"
              className="input-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-xs">Açıklama</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Kısa açıklama veya kampanya metni..."
              className="input-sm resize-none"
            />
          </div>
          <div>
            <label className="label-xs">Buton Metni</label>
            <input
              value={form.button_label}
              onChange={e => set('button_label', e.target.value)}
              placeholder="Hemen İncele"
              className="input-sm"
            />
          </div>
          <div>
            <label className="label-xs">Buton Linki (opsiyonel)</label>
            <input
              value={form.button_link}
              onChange={e => set('button_link', e.target.value)}
              placeholder="/kampanyalar"
              className="input-sm"
            />
          </div>
          <div>
            <label className="label-xs">Yönlendir →</label>
            <select value={form.button_navigate_to || 'Home'} onChange={e => set('button_navigate_to', e.target.value)} className="input-sm">
              {POPUP_PAGES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-xs">Yayın Başlangıcı</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={e => set('starts_at', e.target.value)}
              className="input-sm"
            />
          </div>
          <div>
            <label className="label-xs">Yayın Bitişi</label>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={e => set('ends_at', e.target.value)}
              className="input-sm"
            />
          </div>
          <div className="flex items-center gap-2 pt-4 sm:col-span-2">
            <button type="button" onClick={() => set('is_active', !form.is_active)}>
              {form.is_active
                ? <ToggleRight size={28} className="text-green-500" />
                : <ToggleLeft  size={28} className="text-gray-300" />}
            </button>
            <span className="text-sm text-gray-600">{form.is_active ? 'Aktif' : 'Pasif'}</span>
          </div>
        </div>

        <ImageUploadField
          label="Pop-up Görseli"
          value={form.image_url}
          onUploaded={v => set('image_url', v)}
          folder="popups"
        />

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Kaydediliyor…' : editId ? 'Güncelle' : 'Ekle'}
          </button>
          {editId && <button onClick={resetForm} className="btn-ghost text-sm">İptal</button>}
        </div>
      </div>

      {/* Liste */}
      {loading ? <Spinner /> : popups.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Henüz pop-up yok.</p>
      ) : (
        <div className="space-y-2">
          {popups.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <span className="w-6 shrink-0 text-center text-xs font-mono text-gray-300">{p.order_index}</span>

              {p.image_url ? (
                <img src={p.image_url} alt={p.title} className="h-12 w-20 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Zap size={18} className="text-gray-300" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">{p.title || '(Başlıksız)'}</p>
                <p className="truncate text-xs text-gray-400">{p.description || '—'}</p>
                {p.button_label && (
                  <span className="mt-0.5 inline-block rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
                    {p.button_label} → {p.button_link || '#'}
                  </span>
                )}
              </div>

              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isLive(p) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {isLive(p) ? 'Yayında' : 'Pasif'}
              </span>

              <button type="button" onClick={() => toggleActive(p)} className="shrink-0">
                {p.is_active
                  ? <ToggleRight size={24} className="text-green-500" />
                  : <ToggleLeft  size={24} className="text-gray-300" />}
              </button>

              <button onClick={() => startEdit(p)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>

              <button onClick={() => del(p.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
