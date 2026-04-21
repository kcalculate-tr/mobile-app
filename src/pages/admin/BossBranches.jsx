import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Loader2, MapPin, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../../supabase';

const initialFormState = {
  name: '',
  address: '',
  slug: '',
};

function generateSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BossBranches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let response = await supabase
        .from('branches')
        .select('id,name,address,slug,created_at')
        .order('created_at', { ascending: false });

      if (response.error) {
        const message = `${response.error.message || ''} ${response.error.details || ''}`.toLowerCase();
        const createdAtMissing = message.includes('created_at') && message.includes('column');

        if (createdAtMissing) {
          response = await supabase
            .from('branches')
            .select('id,name,address,slug,created_at')
            .order('id', { ascending: false });
        }
      }

      if (response.error) throw response.error;
      setBranches(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setBranches([]);
      setError(err?.message || 'Şubeler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingBranch(null);
    setForm(initialFormState);
  };

  const openCreateModal = () => {
    setError('');
    setInfo('');
    setEditingBranch(null);
    setForm(initialFormState);
    setModalOpen(true);
  };

  const openEditModal = (branch) => {
    setError('');
    setInfo('');
    setEditingBranch(branch);
    setForm({
      name: String(branch?.name || ''),
      address: String(branch?.address || ''),
      slug: String(branch?.slug || generateSlug(branch?.name || '')),
    });
    setModalOpen(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-generate slug from name if slug hasn't been manually edited
      if (name === 'name' && (!prev.slug || prev.slug === generateSlug(prev.name))) {
        next.slug = generateSlug(value);
      }
      return next;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');

    const payload = {
      name: String(form.name || '').trim(),
      address: String(form.address || '').trim(),
      slug: String(form.slug || generateSlug(form.name || '')).trim() || null,
    };

    if (!payload.name || !payload.address) {
      setError('Şube adı ve adres alanları zorunludur.');
      return;
    }

    setSaving(true);

    try {
      if (editingBranch?.id) {
        const { error: updateError } = await supabase
          .from('branches')
          .update(payload)
          .eq('id', editingBranch.id);

        if (updateError) throw updateError;
        setInfo('Şube bilgileri güncellendi.');
      } else {
        const { error: insertError } = await supabase
          .from('branches')
          .insert([payload]);

        if (insertError) throw insertError;
        setInfo('Yeni şube eklendi.');
      }

      closeModal();
      fetchBranches();
    } catch (err) {
      setError(err?.message || 'Şube kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch) => {
    const id = String(branch?.id || '');
    if (!id) return;

    const branchName = String(branch?.name || 'bu şube');
    const confirmed = window.confirm(`${branchName} kaydını silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    setError('');
    setInfo('');
    setDeletingId(id);

    try {
      const { error: deleteError } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setInfo('Şube kaydı silindi.');
      setBranches((prev) => prev.filter((item) => String(item?.id) !== id));
    } catch (err) {
      setError(err?.message || 'Şube silinemedi.');
    } finally {
      setDeletingId('');
    }
  };

  const modalTitle = useMemo(
    () => (editingBranch ? 'Şube Düzenle' : 'Yeni Şube Ekle'),
    [editingBranch]
  );

  return (
    <div className="space-y-6 text-geex-text">
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-0 text-2xl font-zalando text-geex-text">Şubeler Yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">Şube kayıtlarını buradan ekleyin, düzenleyin ve yönetin.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchBranches}
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold text-geex-text transition hover:bg-geex-bg disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Yenile
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand-primary px-4 text-sm font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]"
            >
              <Plus size={14} />
              Yeni Şube Ekle
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {info && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {info}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-geex-bg text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Şube Adı</th>
                <th className="px-5 py-3">Slug</th>
                <th className="px-5 py-3">Adres</th>
                <th className="px-5 py-3">Eklenme Tarihi</th>
                <th className="px-5 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" />
                      Şubeler yükleniyor...
                    </span>
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    Kayıtlı şube bulunamadı.
                  </td>
                </tr>
              ) : (
                branches.map((branch) => {
                  const id = String(branch?.id || '');
                  const isDeleting = deletingId === id;
                  return (
                    <tr key={id || `${branch?.name}-${branch?.created_at || ''}`} className="border-t border-geex-border/80 text-sm">
                      <td className="px-5 py-4">
                        <p className="mb-0 font-semibold text-geex-text">{branch?.name || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        {branch?.slug ? (
                          <span className="inline-flex flex-col">
                            <span className="text-xs font-mono text-slate-600">{branch.slug}.eatkcal.com</span>
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <p className="mb-0 inline-flex items-start gap-2 text-slate-600">
                          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                          <span>{branch?.address || '—'}</span>
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(branch?.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(branch)}
                            className="inline-flex h-9 items-center gap-1 rounded-xl border border-geex-border bg-white px-3 text-xs font-semibold text-geex-text transition hover:bg-geex-bg"
                          >
                            <Edit3 size={13} />
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(branch)}
                            disabled={isDeleting}
                            className="inline-flex h-9 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-geex-text/45 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="mb-0 text-xl font-zalando text-geex-text">{modalTitle}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-geex-border bg-white text-geex-text"
                aria-label="Kapat"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Şube Adı</span>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Örn: Merkez Şube"
                  className="h-11 w-full rounded-2xl border border-geex-border bg-white px-3 text-sm font-medium text-geex-text placeholder:text-slate-400"
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL Slug</span>
                <input
                  type="text"
                  name="slug"
                  value={form.slug}
                  onChange={handleFormChange}
                  placeholder="merkez-sube"
                  className="h-11 w-full rounded-2xl border border-geex-border bg-white px-3 text-sm font-mono text-geex-text placeholder:text-slate-400"
                />
                {form.slug && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Önizleme: <span className="font-semibold text-slate-600">{form.slug}.eatkcal.com</span>
                  </p>
                )}
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adres</span>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Şubenin açık adresini yazın"
                  className="w-full rounded-2xl border border-geex-border bg-white px-3 py-2.5 text-sm font-medium text-geex-text placeholder:text-slate-400"
                  required
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex h-11 items-center rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold text-geex-text transition hover:bg-geex-bg disabled:opacity-60"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand-primary px-4 text-sm font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)] disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
