#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pop-up CRUD patch — BossVitrin.jsx
Çalıştırma: cd /Users/ilterozisseven/Desktop/kcal-mobile && python3 fix_popups.py
"""

VITRIN = 'admin-panel/src/pages/admin/BossVitrin.jsx'

def patch(filepath, old, new, label):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'⚠️  {label}: eşleşme bulunamadı')
        return False
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'✅ {label}')
    return True

# ── 1. Zap import'una Loader2 ekle ──────────────────────────────────────────
patch(VITRIN,
"import { Image, Megaphone, Percent, Trash2, ToggleLeft, ToggleRight, X, Zap } from 'lucide-react';",
"import { Image, Loader2, Megaphone, Percent, Trash2, ToggleLeft, ToggleRight, X, Zap } from 'lucide-react';",
'Import: Loader2 eklendi')

# ── 2. PopupsTab placeholder → tam CRUD ─────────────────────────────────────
patch(VITRIN,
'''// ─── POP-UP'LAR — Yakında placeholder ─────────────────────────────────────────
function PopupsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50">
        <Zap size={32} className="text-amber-400" />
      </div>
      <h3 className="text-lg font-zalando text-geex-text">Pop-up Yönetimi</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Pop-up yönetimi yakında kullanıma açılacak. Bu sekmede giriş pop-up'larını, duyuruları ve promosyon kartlarını yönetebileceksiniz.
      </p>
      <span className="mt-4 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-700">Yakında</span>
    </div>
  );
}''',
'''// ─── POP-UP'LAR ───────────────────────────────────────────────────────────────
const POPUP_EMPTY = {
  title: '',
  description: '',
  image_url: '',
  button_label: '',
  button_link: '',
  order_index: '',
  is_active: true,
  starts_at: '',
  ends_at: '',
};

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
      starts_at:    p.starts_at ? p.starts_at.slice(0, 16) : '',
      ends_at:      p.ends_at   ? p.ends_at.slice(0, 16)   : '',
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
      button_link:  form.button_link.trim()  || null,
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
            <label className="label-xs">Buton Linki</label>
            <input
              value={form.button_link}
              onChange={e => set('button_link', e.target.value)}
              placeholder="/kampanyalar"
              className="input-sm"
            />
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
}''',
"BossVitrin: PopupsTab tam CRUD")

print('\n✨ fix_popups.py tamamlandı.')
