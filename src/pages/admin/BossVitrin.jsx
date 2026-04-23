/**
 * BossVitrin.jsx — Vitrin Yönetimi
 * Sekmeler: Bannerlar | Kampanyalar | Pop-up'lar
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, ToggleLeft, ToggleRight, X, Zap, Coins, LayoutGrid, ChevronUp, ChevronDown, Pencil, Plus } from 'lucide-react';
import BossMacro from './BossMacro';
import { supabase } from '../../supabase';
import ImageUploadField from '../../components/ImageUploadField';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'grid',   label: 'Grid Yönetimi', Icon: LayoutGrid },
  { key: 'popups', label: 'Pop-up\'lar',   Icon: Zap },
  { key: 'macro',  label: 'Macro',         Icon: Coins },
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
  const [tab, setTab] = useState('grid');

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
        {tab === 'grid'   && <BannerGridTab />}
        {tab === 'popups' && <PopupsTab />}
        {tab === 'macro'  && <BossMacro embedded />}
      </section>
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

// ─── GRID YÖNETİMİ ────────────────────────────────────────────────────────────
// banner_rows + banner_cells yeni sistem. Bu sekme sadece satır yönetimi:
// ekle, sil, sırala, grid_size ayarla, aktif/pasif. Hücre düzenleme ayrı prompt.

function BannerGridTab() {
  const [rows, setRows] = useState([]);
  const [cellCounts, setCellCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [editingRow, setEditingRow] = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('banner_rows')
      .select('*')
      .order('type')
      .order('order');
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    const list = data || [];
    setRows(list);

    const rowIds = list.map((r) => r.id);
    if (rowIds.length > 0) {
      const { data: cells, error: cellsErr } = await supabase
        .from('banner_cells')
        .select('row_id')
        .in('row_id', rowIds);
      if (!cellsErr && cells) {
        const counts = {};
        for (const c of cells) counts[c.row_id] = (counts[c.row_id] || 0) + 1;
        setCellCounts(counts);
      } else {
        setCellCounts({});
      }
    } else {
      setCellCounts({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const heroRows = rows.filter((r) => r.type === 'hero');
  const promoRows = rows.filter((r) => r.type === 'promo');

  const addRow = async (type) => {
    const peers = rows.filter((r) => r.type === type);
    const nextOrder = peers.length > 0 ? Math.max(...peers.map((r) => r.order)) + 1 : 0;
    setSaving(true); setErr(''); setOk('');
    const { error } = await supabase.from('banner_rows').insert({
      type,
      grid_size: type === 'hero' ? 1 : 2,
      order: nextOrder,
      is_active: true,
    });
    if (error) setErr(error.message);
    else { setOk(type === 'hero' ? 'Hero satırı eklendi.' : 'Promo satırı eklendi.'); await fetch_(); }
    setSaving(false);
  };

  const updateGridSize = async (row, newSize) => {
    const currentCount = cellCounts[row.id] || 0;
    if (newSize < currentCount) {
      const message = `Mevcut ${currentCount} hücre var. Grid ${newSize}'e düşürülürse position ${newSize}-${currentCount - 1} hücreleri gizlenir (silinmez, veritabanında kalır). Devam?`;
      if (!window.confirm(message)) return;
    }
    setSaving(true); setErr(''); setOk('');
    const { error } = await supabase.from('banner_rows').update({ grid_size: newSize }).eq('id', row.id);
    if (error) setErr(error.message);
    else { setOk('Grid boyutu güncellendi.'); await fetch_(); }
    setSaving(false);
  };

  const toggleActive = async (row) => {
    setSaving(true); setErr('');
    const { error } = await supabase.from('banner_rows').update({ is_active: !row.is_active }).eq('id', row.id);
    if (error) setErr(error.message);
    else await fetch_();
    setSaving(false);
  };

  const move = async (row, direction) => {
    const peers = rows.filter((r) => r.type === row.type);
    const idx = peers.findIndex((r) => r.id === row.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= peers.length) return;
    const other = peers[targetIdx];
    setSaving(true); setErr('');
    const { error: e1 } = await supabase.from('banner_rows').update({ order: other.order }).eq('id', row.id);
    const { error: e2 } = await supabase.from('banner_rows').update({ order: row.order }).eq('id', other.id);
    if (e1 || e2) setErr((e1 || e2).message);
    else await fetch_();
    setSaving(false);
  };

  const del = async (row) => {
    const cellCount = cellCounts[row.id] || 0;
    const msg = cellCount > 0
      ? `Bu satırı silmek istediğinize emin misiniz? ${cellCount} hücre de birlikte silinecek (CASCADE).`
      : 'Bu satırı silmek istediğinize emin misiniz?';
    if (!window.confirm(msg)) return;
    setSaving(true); setErr(''); setOk('');
    const { error } = await supabase.from('banner_rows').delete().eq('id', row.id);
    if (error) setErr(error.message);
    else { setOk('Satır silindi.'); await fetch_(); }
    setSaving(false);
  };

  const onEdit = (row) => {
    setEditingRow(row);
  };

  const renderRow = (row, idx, peers) => {
    const cellCount = cellCounts[row.id] || 0;
    const isFirst = idx === 0;
    const isLast = idx === peers.length - 1;
    const isHero = row.type === 'hero';
    return (
      <div
        key={row.id}
        className={`flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 transition hover:shadow-sm ${row.is_active ? '' : 'opacity-60'}`}
      >
        <span className="w-6 text-center text-xs font-mono text-gray-300">{row.order}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isHero ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isHero ? '🎠 Hero' : '📢 Promo'}
        </span>

        {!isHero && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Grid:</span>
            <select
              value={row.grid_size}
              onChange={(e) => updateGridSize(row, Number(e.target.value))}
              disabled={saving}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        <span className="text-xs text-gray-500">
          <span className={cellCount < row.grid_size ? 'text-amber-600 font-semibold' : 'text-gray-600 font-semibold'}>
            {cellCount}
          </span>
          /{row.grid_size} hücre dolu
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => toggleActive(row)}
          disabled={saving}
          className="shrink-0 disabled:opacity-50"
          title={row.is_active ? 'Aktif' : 'Pasif'}
        >
          {row.is_active
            ? <ToggleRight size={22} className="text-green-500" />
            : <ToggleLeft  size={22} className="text-gray-300" />}
        </button>

        <button
          type="button"
          onClick={() => move(row, 'up')}
          disabled={saving || isFirst}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Yukarı taşı"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => move(row, 'down')}
          disabled={saving || isLast}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Aşağı taşı"
        >
          <ChevronDown size={14} />
        </button>

        <button
          type="button"
          onClick={() => onEdit(row)}
          disabled={saving}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
          title="Hücreleri düzenle"
        >
          <Pencil size={14} />
        </button>

        <button
          type="button"
          onClick={() => del(row)}
          disabled={saving}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          title="Sil"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="p-5 space-y-5">
      <ErrBox msg={err} onClose={() => setErr('')} />
      <OkBox  msg={ok}  onClose={() => setOk('')} />

      {loading ? <Spinner /> : (
        <>
          {/* Hero Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">🎠 Hero Slayt</h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {heroRows.filter((r) => r.is_active).length} aktif / {heroRows.length} toplam
              </span>
            </div>
            {heroRows.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">Henüz hero satırı yok.</p>
            ) : (
              <div className="space-y-2">
                {heroRows.map((r, i) => renderRow(r, i, heroRows))}
              </div>
            )}
            <button
              type="button"
              onClick={() => addRow('hero')}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Yeni Hero Satırı Ekle
            </button>
          </div>

          {/* Promo Section */}
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 pt-2">
              <h2 className="text-sm font-bold text-gray-800">📢 Promo Kartlar</h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {promoRows.filter((r) => r.is_active).length} aktif / {promoRows.length} toplam
              </span>
            </div>
            {promoRows.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">Henüz promo satırı yok.</p>
            ) : (
              <div className="space-y-2">
                {promoRows.map((r, i) => renderRow(r, i, promoRows))}
              </div>
            )}
            <button
              type="button"
              onClick={() => addRow('promo')}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Yeni Promo Satırı Ekle
            </button>
          </div>
        </>
      )}

      {editingRow && (
        <BannerGridRowEditor
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={() => { fetch_(); setEditingRow(null); }}
        />
      )}
    </div>
  );
}

// ─── GRID ROW EDITOR MODAL ────────────────────────────────────────────────────
// Tek bir banner_rows satırının hücrelerini (banner_cells) toplu düzenleme.
// Local state'te çalışır, Kaydet'e tıklanınca DB'ye insert/update/delete yazar.

function BannerGridRowEditor({ row, onClose, onSaved }) {
  const [cells, setCells] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // NOT: categories tablosunda is_active kolonu yok → filtresiz fetch.
      // products.is_available = true (is_active değil) → mobile'ın da
      // kullandığı flag.
      const [cellsRes, catsRes, prodsRes] = await Promise.all([
        supabase
          .from('banner_cells')
          .select('*')
          .eq('row_id', row.id)
          .order('position'),
        supabase
          .from('categories')
          .select('id, name, parent_id')
          .order('name'),
        supabase
          .from('products')
          .select('id, name, category')
          .eq('is_available', true)
          .order('name'),
      ]);
      if (cancelled) return;
      if (cellsRes.error) {
        setErr(cellsRes.error.message);
        setLoading(false);
        return;
      }
      setCells(cellsRes.data || []);
      setCategories(catsRes.data || []);
      setProducts(prodsRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [row.id]);

  // Kategori hiyerarşisi: önce parent'lar, her parent'ın hemen altında
  // kendi child'ları. Orphan child'lar (parent'ı mevcut değilse) sona.
  const sortedCategories = useMemo(() => {
    const result = [];
    const mains = categories.filter((c) => !c.parent_id);
    const childrenByParent = new Map();
    for (const c of categories) {
      if (c.parent_id) {
        const arr = childrenByParent.get(c.parent_id) || [];
        arr.push(c);
        childrenByParent.set(c.parent_id, arr);
      }
    }
    for (const m of mains) {
      result.push({ ...m, depth: 0 });
      const children = childrenByParent.get(m.id) || [];
      for (const ch of children) result.push({ ...ch, depth: 1 });
    }
    // Orphan child'lar (parent_id var ama parent kayıp)
    const seen = new Set(result.map((c) => c.id));
    for (const c of categories) {
      if (!seen.has(c.id)) result.push({ ...c, depth: 1 });
    }
    return result;
  }, [categories]);

  const updateCell = (position, patch) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.position === position);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      const blank = {
        row_id: row.id,
        position,
        image_url: null,
        title: null,
        link: null,
        navigate_to: 'Home',
        is_active: true,
      };
      return [...prev, { ...blank, ...patch }].sort((a, b) => a.position - b.position);
    });
  };

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      const toInsert = cells.filter((c) => !c.id && c.image_url);
      const toUpdate = cells.filter((c) => c.id && c.image_url);
      const toDelete = cells.filter((c) => c.id && !c.image_url);

      const ops = [];
      if (toInsert.length > 0) {
        ops.push(
          supabase.from('banner_cells').insert(
            toInsert.map((c) => ({
              row_id: row.id,
              position: c.position,
              image_url: c.image_url,
              title: c.title || null,
              link: c.link || null,
              navigate_to: c.navigate_to || 'Home',
              is_active: c.is_active ?? true,
            })),
          ),
        );
      }
      for (const c of toUpdate) {
        ops.push(
          supabase
            .from('banner_cells')
            .update({
              image_url: c.image_url,
              title: c.title || null,
              link: c.link || null,
              navigate_to: c.navigate_to || 'Home',
              is_active: c.is_active ?? true,
            })
            .eq('id', c.id),
        );
      }
      if (toDelete.length > 0) {
        ops.push(
          supabase
            .from('banner_cells')
            .delete()
            .in('id', toDelete.map((c) => c.id)),
        );
      }

      const results = await Promise.all(ops);
      const firstErr = results.find((r) => r?.error);
      if (firstErr) throw new Error(firstErr.error.message);

      onSaved();
    } catch (e) {
      setErr(e?.message || 'Kaydetme hatası.');
      setSaving(false);
    }
  };

  const slotIndices = Array.from({ length: row.grid_size }, (_, i) => i);
  const extraCells = cells
    .filter((c) => c.position >= row.grid_size)
    .sort((a, b) => a.position - b.position);
  const getCellAt = (position) => cells.find((c) => c.position === position);

  const renderCellForm = (position) => {
    const cell = getCellAt(position);
    const current = cell || {
      position,
      image_url: '',
      title: '',
      link: '',
      navigate_to: 'Home',
      is_active: true,
    };

    return (
      <div key={position} className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800">Hücre {position + 1} / {row.grid_size}</p>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={current.is_active ?? true}
              onChange={(e) => updateCell(position, { is_active: e.target.checked })}
            />
            Aktif
          </label>
        </div>

        <ImageUploadField
          label="Görsel"
          value={current.image_url || ''}
          onUploaded={(url) => updateCell(position, { image_url: url || null })}
          folder="banner_cells"
          aspectRatio={2}
          aspectLabel="2:1"
          recommendedSize="1600×800"
          showMobilePreview
        />

        <div>
          <label className="label-xs">Başlık (opsiyonel)</label>
          <input
            type="text"
            value={current.title || ''}
            onChange={(e) => updateCell(position, { title: e.target.value })}
            placeholder="Opsiyonel başlık / alt metin"
            maxLength={100}
            className="input-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-xs">Link (opsiyonel)</label>
            <input
              type="text"
              value={current.link || ''}
              onChange={(e) => updateCell(position, { link: e.target.value })}
              placeholder="/teklifler"
              className="input-sm"
            />
          </div>
          <div>
            <label className="label-xs">Yönlendir →</label>
            <select
              value={current.navigate_to || 'Home'}
              onChange={(e) => updateCell(position, { navigate_to: e.target.value })}
              className="input-sm"
            >
              <optgroup label="📄 Sayfalar">
                <option value="Home">Ana Sayfa</option>
                <option value="Categories">Tüm Kategoriler</option>
                <option value="Offers">Teklifler</option>
                <option value="Addresses">Adreslerim</option>
                <option value="ProfileOrders">Siparişlerim</option>
                <option value="ProfileCoupons">Kuponlarım</option>
                <option value="Subscriptions">Abonelik</option>
                <option value="NutritionProfile">Beslenme Profili</option>
                <option value="ProfileSupport">Destek</option>
              </optgroup>
              {sortedCategories.length > 0 && (
                <optgroup label="📁 Kategoriler">
                  {sortedCategories.map((cat) => (
                    <option key={cat.id} value={`CategoryProducts:${cat.name}`}>
                      {cat.depth > 0 ? '  └─ ' : ''}{cat.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {products.length > 0 && (
                <optgroup label="🍱 Ürünler">
                  {products.map((p) => (
                    <option key={p.id} value={`ProductDetail:${p.id}`}>
                      {p.category ? `[${p.category}] ${p.name}` : p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {row.type === 'hero' ? '🎠 Hero' : '📢 Promo'} satırı düzenle
            </p>
            <p className="text-xs text-gray-500">Grid: {row.grid_size} hücre</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {err && (
            <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
          )}

          <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">
            <p className="font-semibold">Önerilen boyut: 1600×800 (2:1)</p>
            <p className="mt-0.5">
              Grid &gt; 1 satırlarda kenarlar kırpılır. Ana içeriği merkez 800×800 alana yerleştir.
            </p>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <div className="space-y-4">
              {slotIndices.map((pos) => renderCellForm(pos))}

              {extraCells.length > 0 && (
                <div className="mt-6 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">⚠️ Grid Dışı Hücreler</p>
                  <p className="text-xs text-amber-700">
                    Mevcut grid_size = {row.grid_size}. Position {extraCells.map((c) => c.position).join(', ')} hücreleri gizli — silinmedi, grid'i büyütünce tekrar görünür.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {extraCells.map((c) => (
                      <div
                        key={c.id || `extra-${c.position}`}
                        className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-amber-900"
                      >
                        <span className="font-mono text-amber-500">pos {c.position}</span>
                        {c.image_url && (
                          <img
                            src={c.image_url}
                            alt=""
                            className="h-8 w-14 rounded-lg border border-amber-200 object-cover"
                          />
                        )}
                        <span className="truncate flex-1">{c.title || '(başlıksız)'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
