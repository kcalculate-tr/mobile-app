import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Calendar, Clock, Edit3, Eye, Loader2, Megaphone,
  Plus, RefreshCw, Send, Trash2, X, XCircle,
} from 'lucide-react';
import { supabase } from '../../supabase';

// ── Sabitler ────────────────────────────────────────────────────────────────
const AUDIENCE_OPTIONS = [
  { key: 'all',               emoji: '👥', label: 'Tüm kullanıcılar',         desc: 'Uygulamayı kullanan herkes' },
  { key: 'macro_members',     emoji: '🏆', label: 'Macro Üyeler',             desc: 'Aktif premium üyelik' },
  { key: 'active_users',      emoji: '📦', label: 'Son 30 gün sipariş verenler', desc: 'Aktif müşteriler' },
  { key: 'inactive_users',    emoji: '😴', label: 'Son 30 gündür giriş yapmamış', desc: 'Geri kazanılacak kitle' },
  { key: 'never_ordered',     emoji: '🌱', label: 'Henüz sipariş vermemiş',   desc: 'Yeni kayıtlar' },
  { key: 'has_macro_balance', emoji: '🪙', label: 'Macro bakiyesi olanlar',   desc: 'Kullanılmayı bekleyen puanlar' },
];

const AUDIENCE_LABELS = AUDIENCE_OPTIONS.reduce((acc, o) => {
  acc[o.key] = `${o.emoji} ${o.label}`;
  return acc;
}, {});

const DEEP_LINK_OPTIONS = [
  { value: '',                             label: 'Bildirim sadece görünsün (bir yere gitmesin)' },
  { value: 'Home',                         label: '🏠 Ana Sayfa' },
  { value: 'CategoryProducts:Tüm Ürünler', label: '🍱 Tüm Ürünler' },
  { value: 'Offers',                       label: '🎁 Fırsatlar' },
  { value: 'ProfileOrders',                label: '📦 Siparişlerim' },
  { value: 'ProfileCoupons',               label: '🎟 Kuponlarım' },
  { value: 'Subscriptions',                label: '⭐ Macro Üyelik' },
  { value: 'NutritionProfile',             label: '👤 Profilim' },
];

const STATUS_META = {
  draft:     { emoji: '📝', label: 'Taslak',         cls: 'bg-slate-100 text-slate-600' },
  scheduled: { emoji: '🕐', label: 'Zamanlandı',     cls: 'bg-amber-100 text-amber-700' },
  sending:   { emoji: '⏳', label: 'Gönderiliyor',   cls: 'bg-sky-100 text-sky-700' },
  sent:      { emoji: '✓',  label: 'Gönderildi',     cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { emoji: '⊘',  label: 'İptal edildi',   cls: 'bg-slate-100 text-slate-500' },
  failed:    { emoji: '✗',  label: 'Başarısız',      cls: 'bg-rose-100 text-rose-700' },
};

const TITLE_MAX = 50;
const BODY_MAX  = 120;

// ── Yardımcılar ─────────────────────────────────────────────────────────────
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateTimeLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minScheduleLocal() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  return fmtDateTimeLocalInput(d.toISOString());
}

function relativeLabel(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'geçmiş tarih';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} dk sonra`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} saat sonra`;
  const days = Math.round(hrs / 24);
  return `${days} gün sonra`;
}

const EMPTY_FORM = {
  name: '',
  title: '',
  body: '',
  deep_link: '',
  target_type: 'all',
  sendWhen: 'now',        // 'now' | 'schedule'
  scheduledAtLocal: '',   // datetime-local value
};

// ════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════
export default function Campaigns() {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [editingId, setEditingId] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const [audienceCounts, setAudienceCounts] = useState({});

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState(''); // 'draft' | 'send' | 'schedule'

  const [toast, setToast] = useState(null);
  const [detailCampaign, setDetailCampaign] = useState(null);
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchCampaigns = useCallback(async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setCampaigns(data ?? []);
    } catch (e) {
      console.warn('[Campaigns] fetch failed:', e?.message || e);
    } finally {
      setListLoading(false);
    }
  }, []);

  const fetchAudienceCounts = useCallback(async () => {
    try {
      const promises = AUDIENCE_OPTIONS.map((opt) =>
        supabase.rpc('get_campaign_audience_count', { p_target_type: opt.key })
          .then(({ data, error }) => [opt.key, error ? null : (data ?? 0)])
      );
      const entries = await Promise.all(promises);
      const counts = {};
      entries.forEach(([k, v]) => { counts[k] = v; });
      setAudienceCounts(counts);
    } catch (e) {
      console.warn('[Campaigns] audience count failed:', e?.message || e);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetchAudienceCounts();
  }, [fetchCampaigns, fetchAudienceCounts]);

  // List ekranındayken otomatik yenileme (sending/scheduled durumlarını yakalamak için)
  useEffect(() => {
    if (view !== 'list') return undefined;
    const id = setInterval(fetchCampaigns, 7000);
    return () => clearInterval(id);
  }, [view, fetchCampaigns]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Editor helpers ───────────────────────────────────────────────────────
  const openNew = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setView('editor');
  }, []);

  const openEdit = useCallback((c) => {
    setForm({
      name: c.name || '',
      title: c.title || '',
      body: c.body || '',
      deep_link: c.deep_link || '',
      target_type: c.target_type || 'all',
      sendWhen: c.scheduled_at ? 'schedule' : 'now',
      scheduledAtLocal: c.scheduled_at ? fmtDateTimeLocalInput(c.scheduled_at) : '',
    });
    setEditingId(c.id);
    setView('editor');
  }, []);

  const backToList = useCallback(() => {
    setView('list');
    setEditingId(null);
    fetchCampaigns();
  }, [fetchCampaigns]);

  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  // ── Validation ───────────────────────────────────────────────────────────
  const validation = useMemo(() => {
    if (!form.name.trim()) return { ok: false, reason: 'Kampanya adı boş olamaz' };
    if (!form.title.trim()) return { ok: false, reason: 'Bildirim başlığı boş olamaz' };
    if (!form.body.trim()) return { ok: false, reason: 'Mesaj içeriği boş olamaz' };
    if (!AUDIENCE_OPTIONS.find((o) => o.key === form.target_type)) {
      return { ok: false, reason: 'Hedef kitle seç' };
    }
    if (form.sendWhen === 'schedule') {
      if (!form.scheduledAtLocal) return { ok: false, reason: 'Gönderim tarihi seç' };
      const t = new Date(form.scheduledAtLocal).getTime();
      if (Number.isNaN(t)) return { ok: false, reason: 'Geçersiz tarih' };
      if (t < Date.now() + 60 * 1000) return { ok: false, reason: 'Tarih geçmiş veya çok yakın (en az 1 dk sonra)' };
    }
    return { ok: true };
  }, [form]);

  // ── Save handlers ────────────────────────────────────────────────────────
  const basePayload = useCallback(() => ({
    name: form.name.trim(),
    title: form.title.trim(),
    body: form.body.trim(),
    deep_link: form.deep_link || null,
    target_type: form.target_type,
  }), [form]);

  const upsertCampaign = async (extra) => {
    const payload = { ...basePayload(), ...extra };
    if (editingId) {
      const { data, error } = await supabase
        .from('notification_campaigns')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase
      .from('notification_campaigns')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const saveDraft = async () => {
    if (!form.name.trim()) {
      setToast({ type: 'error', message: 'Kampanya adı boş olamaz' });
      return;
    }
    setSaving(true); setSavingIntent('draft');
    try {
      await upsertCampaign({ status: 'draft', scheduled_at: null });
      setToast({ type: 'success', message: 'Taslak kaydedildi' });
      backToList();
    } catch (e) {
      setToast({ type: 'error', message: e?.message || String(e) });
    } finally {
      setSaving(false); setSavingIntent('');
    }
  };

  const saveScheduled = async () => {
    if (!validation.ok) { setToast({ type: 'error', message: validation.reason }); return; }
    const iso = new Date(form.scheduledAtLocal).toISOString();
    setSaving(true); setSavingIntent('schedule');
    try {
      await upsertCampaign({ status: 'scheduled', scheduled_at: iso });
      setToast({ type: 'success', message: 'Kampanya zamanlandı' });
      backToList();
    } catch (e) {
      setToast({ type: 'error', message: e?.message || String(e) });
    } finally {
      setSaving(false); setSavingIntent('');
    }
  };

  const saveAndSendNow = async () => {
    if (!validation.ok) { setToast({ type: 'error', message: validation.reason }); return; }
    setSaving(true); setSavingIntent('send');
    try {
      // 1) Kaydet (status=sending olarak işaretleme Edge Function'da yapılır)
      const saved = await upsertCampaign({
        status: 'sending',
        scheduled_at: new Date().toISOString(),
      });
      // Edge Function status'u kontrol edip 'already sending' diye skip etmesin:
      // by_campaign 'sent', 'sending', 'cancelled' olanları skip ediyor.
      // Bu yüzden burada 'scheduled' olarak yazıp Edge Function'ın 'sending'e çekmesini bırakıyoruz.
      await supabase
        .from('notification_campaigns')
        .update({ status: 'scheduled' })
        .eq('id', saved.id);

      // 2) Edge Function dispatch
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: { mode: 'by_campaign', campaign_id: saved.id },
      });
      if (error) throw error;

      if (data?.error) {
        setToast({ type: 'error', message: `Hata: ${data.error}` });
      } else if (typeof data?.sent === 'number') {
        setToast({
          type: 'success',
          message: `Kampanya gönderildi — ${data.sent} başarılı, ${data.skipped} atlandı, ${data.failed} başarısız`,
        });
      } else {
        setToast({ type: 'success', message: 'Kampanya gönderildi' });
      }
      backToList();
    } catch (e) {
      setToast({ type: 'error', message: e?.message || String(e) });
    } finally {
      setSaving(false); setSavingIntent('');
    }
  };

  // ── List actions ─────────────────────────────────────────────────────────
  const deleteCampaign = (c) => {
    setConfirm({
      message: `"${c.name}" kampanyasını silmek istediğine emin misin?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('notification_campaigns').delete().eq('id', c.id);
          if (error) throw error;
          setToast({ type: 'success', message: 'Kampanya silindi' });
          fetchCampaigns();
        } catch (e) {
          setToast({ type: 'error', message: e?.message || String(e) });
        }
      },
    });
  };

  const cancelScheduled = (c) => {
    setConfirm({
      message: `"${c.name}" zamanlamasını iptal etmek istediğine emin misin? Kampanya taslak olarak kalır.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('notification_campaigns')
            .update({ status: 'cancelled' }).eq('id', c.id);
          if (error) throw error;
          setToast({ type: 'success', message: 'Zamanlama iptal edildi' });
          fetchCampaigns();
        } catch (e) {
          setToast({ type: 'error', message: e?.message || String(e) });
        }
      },
    });
  };

  const retryFailed = async (c) => {
    try {
      const newTime = new Date(Date.now() + 60 * 1000).toISOString();
      const { error } = await supabase.from('notification_campaigns')
        .update({ status: 'scheduled', scheduled_at: newTime })
        .eq('id', c.id);
      if (error) throw error;
      setToast({ type: 'success', message: '1 dk sonra tekrar denenecek' });
      fetchCampaigns();
    } catch (e) {
      setToast({ type: 'error', message: e?.message || String(e) });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
          toast.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          {toast.type === 'success' ? '✓ ' : '✗ '}{toast.message}
        </div>
      )}

      {view === 'list' ? (
        <ListView
          campaigns={campaigns}
          listLoading={listLoading}
          onNew={openNew}
          onEdit={openEdit}
          onDelete={deleteCampaign}
          onCancelScheduled={cancelScheduled}
          onRetry={retryFailed}
          onDetail={(c) => setDetailCampaign(c)}
          onRefresh={fetchCampaigns}
        />
      ) : (
        <EditorView
          form={form}
          updateForm={updateForm}
          audienceCounts={audienceCounts}
          validation={validation}
          editingId={editingId}
          onBack={backToList}
          saving={saving}
          savingIntent={savingIntent}
          onSaveDraft={saveDraft}
          onSaveScheduled={saveScheduled}
          onSaveAndSendNow={saveAndSendNow}
        />
      )}

      {/* Detail modal */}
      {detailCampaign && (
        <DetailModal
          campaign={detailCampaign}
          onClose={() => setDetailCampaign(null)}
        />
      )}

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={async () => {
            await confirm.onConfirm();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// List View
// ════════════════════════════════════════════════════════════════════════════
function ListView({
  campaigns, listLoading, onNew, onEdit, onDelete,
  onCancelScheduled, onRetry, onDetail, onRefresh,
}) {
  return (
    <>
      <header className="flex items-start justify-between gap-4 rounded-3xl border border-geex-border bg-geex-card px-6 py-5 shadow-geex-soft">
        <div>
          <h1 className="text-2xl font-semibold text-geex-text">Bildirim Kampanyaları</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kullanıcılarına toplu bildirim gönder. Hemen gönderebilir veya ileri bir tarihe zamanlayabilirsin.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={listLoading}
            className="rounded-xl border border-geex-border bg-white px-3 py-2 text-xs font-medium text-geex-text hover:bg-geex-bg disabled:opacity-50"
          >
            <RefreshCw size={12} className={`inline-block ${listLoading ? 'animate-spin' : ''}`} />
            <span className="ml-1">Yenile</span>
          </button>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white shadow-[0_8px_20px_rgba(152,205,0,0.35)] hover:opacity-90"
          >
            <Plus size={16} />
            Yeni Kampanya
          </button>
        </div>
      </header>

      <div className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Megaphone size={32} className="text-slate-300" />
            <p className="text-sm font-semibold text-geex-text">Henüz kampanya yok</p>
            <p className="text-xs text-slate-500">İlk kampanyanı oluşturmak için sağ üstteki butonu kullan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-geex-border text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-3">Durum</th>
                  <th className="py-3 pr-3">Kampanya</th>
                  <th className="py-3 pr-3">Hedef</th>
                  <th className="py-3 pr-3">Tarih</th>
                  <th className="py-3 pr-3">Gönderim</th>
                  <th className="py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const meta = STATUS_META[c.status] || { emoji: '?', label: c.status, cls: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={c.id} className="border-b border-geex-border/60 align-top">
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                          {c.status === 'sending'
                            ? <Loader2 size={11} className="animate-spin" />
                            : <span>{meta.emoji}</span>}
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-geex-text">{c.name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500" title={c.title}>{c.title}</p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-geex-text">
                        {AUDIENCE_LABELS[c.target_type] || c.target_type}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600">
                        {c.status === 'sent' && c.sent_at ? (
                          <>
                            <span className="text-slate-500">Gönderim:</span><br />
                            {fmtDateTime(c.sent_at)}
                          </>
                        ) : c.status === 'scheduled' && c.scheduled_at ? (
                          <>
                            <span className="text-slate-500">Planlanan:</span><br />
                            {fmtDateTime(c.scheduled_at)}
                            <span className="block text-[10px] text-amber-600">({relativeLabel(c.scheduled_at)})</span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {c.status === 'sent' ? (
                          <span className="font-semibold text-emerald-700">
                            {c.sent_count ?? 0}/{c.target_count ?? 0} gönderildi
                            {c.failed_count > 0 && (
                              <span className="ml-1 text-rose-600">({c.failed_count} başarısız)</span>
                            )}
                          </span>
                        ) : c.status === 'sending' ? (
                          <span className="text-sky-700">—</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex gap-1">
                          {['draft', 'scheduled'].includes(c.status) && (
                            <IconButton title="Düzenle" onClick={() => onEdit(c)}>
                              <Edit3 size={13} />
                            </IconButton>
                          )}
                          {c.status === 'sent' && (
                            <IconButton title="Detay" onClick={() => onDetail(c)}>
                              <Eye size={13} />
                            </IconButton>
                          )}
                          {c.status === 'scheduled' && (
                            <IconButton title="Zamanlamayı iptal et" onClick={() => onCancelScheduled(c)} tone="warning">
                              <XCircle size={13} />
                            </IconButton>
                          )}
                          {c.status === 'failed' && (
                            <IconButton title="Tekrar dene" onClick={() => onRetry(c)}>
                              <RefreshCw size={13} />
                            </IconButton>
                          )}
                          {['draft', 'cancelled', 'failed'].includes(c.status) && (
                            <IconButton title="Sil" onClick={() => onDelete(c)} tone="danger">
                              <Trash2 size={13} />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function IconButton({ onClick, title, children, tone = 'neutral' }) {
  const toneCls = tone === 'danger'
    ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
    : tone === 'warning'
      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
      : 'border-geex-border text-geex-text hover:bg-geex-bg';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border bg-white transition ${toneCls}`}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Editor View
// ════════════════════════════════════════════════════════════════════════════
function EditorView({
  form, updateForm, audienceCounts, validation, editingId,
  onBack, saving, savingIntent, onSaveDraft, onSaveScheduled, onSaveAndSendNow,
}) {
  const selectedAudience = AUDIENCE_OPTIONS.find((o) => o.key === form.target_type);
  const selectedAudienceCount = audienceCounts[form.target_type];

  return (
    <>
      <header className="flex items-center justify-between gap-4 rounded-3xl border border-geex-border bg-geex-card px-6 py-5 shadow-geex-soft">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-geex-border bg-white hover:bg-geex-bg"
            title="Geri dön"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-geex-text">
              {editingId ? `Kampanyayı Düzenle${form.name ? `: ${form.name}` : ''}` : 'Yeni Kampanya'}
            </h1>
            <p className="text-xs text-slate-500">Adımları doldur, alt butonlardan birini seç.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr),minmax(0,1fr)]">
        {/* SOL: form */}
        <section className="space-y-5">
          {/* 1. Ad */}
          <Card>
            <Label>1. Kampanya Adı</Label>
            <p className="mb-2 text-xs text-slate-500">
              Sadece sen göreceksin. Kullanıcıya gönderilen mesajda yer almaz.
            </p>
            <input
              type="text"
              value={form.name}
              maxLength={100}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="Örn: 24 Nisan %20 İndirim"
              className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
            />
          </Card>

          {/* 2. Hedef */}
          <Card>
            <Label>2. Kime gönderilsin?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AUDIENCE_OPTIONS.map((opt) => {
                const active = form.target_type === opt.key;
                const count = audienceCounts[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => updateForm({ target_type: opt.key })}
                    className={`rounded-2xl border-2 p-3 text-left transition ${
                      active
                        ? 'border-brand-primary bg-brand-primary/10'
                        : 'border-geex-border bg-white hover:bg-geex-bg'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-geex-text">
                          <span className="mr-1.5">{opt.emoji}</span>{opt.label}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        active ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {count == null ? '…' : `${count} kişi`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedAudience && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                ✉️ <strong>{selectedAudienceCount == null ? '…' : selectedAudienceCount} kişiye</strong> gönderilecek
              </div>
            )}
          </Card>

          {/* 3. İçerik */}
          <Card>
            <Label>3. Bildirim İçeriği</Label>

            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-geex-text">Başlık</span>
                <span className={`text-xs ${form.title.length >= TITLE_MAX - 5 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {form.title.length}/{TITLE_MAX}
                </span>
              </div>
              <input
                type="text"
                value={form.title}
                maxLength={TITLE_MAX}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder="Örn: Sürpriz İndirim! 🎉"
                className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-geex-text">Mesaj</span>
                <span className={`text-xs ${form.body.length >= BODY_MAX - 10 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {form.body.length}/{BODY_MAX}
                </span>
              </div>
              <textarea
                value={form.body}
                maxLength={BODY_MAX}
                onChange={(e) => updateForm({ body: e.target.value })}
                rows={3}
                placeholder="Örn: Bugüne özel %30 indirim seni bekliyor. Kaçırma!"
                className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-geex-text">Tıklayınca nereye gitsin?</span>
              <select
                value={form.deep_link}
                onChange={(e) => updateForm({ deep_link: e.target.value })}
                className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
              >
                {DEEP_LINK_OPTIONS.map((d) => (
                  <option key={d.value || 'none'} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* 4. Zamanlama */}
          <Card>
            <Label>4. Ne zaman gönderilsin?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { key: 'now',      emoji: '⚡', title: 'Hemen gönder',    desc: 'Butona basınca anında' },
                { key: 'schedule', emoji: '🕐', title: 'Zamanla',         desc: 'İleri bir tarihe planla' },
              ].map((opt) => {
                const active = form.sendWhen === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => updateForm({ sendWhen: opt.key })}
                    className={`rounded-2xl border-2 p-3 text-left transition ${
                      active
                        ? 'border-brand-primary bg-brand-primary/10'
                        : 'border-geex-border bg-white hover:bg-geex-bg'
                    }`}
                  >
                    <p className="text-sm font-semibold text-geex-text">
                      <span className="mr-1.5">{opt.emoji}</span>{opt.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {form.sendWhen === 'schedule' && (
              <div className="mt-3">
                <span className="mb-1.5 block text-sm font-medium text-geex-text">Gönderim Tarihi</span>
                <input
                  type="datetime-local"
                  value={form.scheduledAtLocal}
                  min={minScheduleLocal()}
                  onChange={(e) => updateForm({ scheduledAtLocal: e.target.value })}
                  className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                />
                {form.scheduledAtLocal && (
                  <p className="mt-1.5 text-xs text-slate-600">
                    <Clock size={11} className="mr-1 inline-block" />
                    {fmtDateTime(new Date(form.scheduledAtLocal).toISOString())}
                    <span className="ml-1 text-amber-700">({relativeLabel(new Date(form.scheduledAtLocal).toISOString())})</span>
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* 5. Aksiyon butonları */}
          <Card>
            {!validation.ok && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠️ {validation.reason}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={saving || !form.name.trim()}
                className="inline-flex items-center gap-2 rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm font-semibold text-geex-text hover:bg-geex-bg disabled:opacity-50"
              >
                {saving && savingIntent === 'draft' ? <Loader2 size={14} className="animate-spin" /> : '💾'} Taslak Kaydet
              </button>

              {form.sendWhen === 'now' ? (
                <button
                  type="button"
                  onClick={onSaveAndSendNow}
                  disabled={saving || !validation.ok}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-base font-bold text-white shadow-[0_8px_20px_rgba(152,205,0,0.35)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && savingIntent === 'send'
                    ? <><Loader2 size={16} className="animate-spin" /> Gönderiliyor...</>
                    : <><Send size={16} /> Oluştur ve Şimdi Gönder</>}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSaveScheduled}
                  disabled={saving || !validation.ok}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-base font-bold text-white shadow-[0_8px_20px_rgba(152,205,0,0.35)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && savingIntent === 'schedule'
                    ? <><Loader2 size={16} className="animate-spin" /> Kaydediliyor...</>
                    : <><Calendar size={16} /> Zamanla</>}
                </button>
              )}
            </div>
          </Card>
        </section>

        {/* SAĞ: önizleme */}
        <section className="lg:sticky lg:top-6">
          <Card>
            <Label>Önizleme</Label>
            <p className="mb-3 text-xs text-slate-500">Kullanıcı bildirimi bu şekilde görecek.</p>

            <PhonePreview
              title={form.title || '(başlık)'}
              body={form.body || '(mesaj)'}
            />

            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Hedef:</span>
                <span className="font-medium text-geex-text">
                  {AUDIENCE_LABELS[form.target_type] || '—'} ({selectedAudienceCount ?? '…'} kişi)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Yönlendirme:</span>
                <span className="font-medium text-geex-text">
                  {DEEP_LINK_OPTIONS.find((d) => d.value === form.deep_link)?.label || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Gönderim:</span>
                <span className="font-medium text-geex-text">
                  {form.sendWhen === 'now' ? 'Hemen' : (form.scheduledAtLocal ? fmtDateTime(new Date(form.scheduledAtLocal).toISOString()) : '—')}
                </span>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
      {children}
    </div>
  );
}

function Label({ children }) {
  return <h2 className="mb-3 text-base font-semibold text-geex-text">{children}</h2>;
}

function PhonePreview({ title, body }) {
  return (
    <div className="mx-auto w-full max-w-[320px] rounded-[2rem] border-[6px] border-slate-900 bg-slate-900 p-1.5 shadow-xl">
      <div className="rounded-[1.6rem] bg-gradient-to-br from-slate-800 to-slate-700 p-3">
        <div className="rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-xs font-bold text-white">
              K
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-semibold uppercase text-slate-500">kcal</p>
                <p className="text-[10px] text-slate-400">şimdi</p>
              </div>
              <p className="mt-0.5 font-semibold text-slate-900 line-clamp-2">{title}</p>
              <p className="mt-0.5 text-xs text-slate-700 line-clamp-3">{body}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Detail modal
// ════════════════════════════════════════════════════════════════════════════
function DetailModal({ campaign, onClose }) {
  const meta = STATUS_META[campaign.status] || { emoji: '?', label: campaign.status, cls: 'bg-slate-100 text-slate-600' };
  const successRate = campaign.target_count
    ? Math.round(((campaign.sent_count ?? 0) / campaign.target_count) * 100)
    : 0;
  const openRate = campaign.sent_count
    ? Math.round(((campaign.opened_count ?? 0) / campaign.sent_count) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-geex-text">{campaign.name}</h3>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
              {meta.emoji} {meta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-geex-bg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <DetailRow label="Gönderim Zamanı" value={fmtDateTime(campaign.sent_at)} />
          <DetailRow label="Hedef Kitle" value={`${AUDIENCE_LABELS[campaign.target_type] || campaign.target_type} (${campaign.target_count ?? 0} kişi)`} />
          <DetailRow label="Başarılı Gönderim" value={<span className="font-semibold text-emerald-700">{campaign.sent_count ?? 0}</span>} />
          <DetailRow label="Başarısız" value={<span className={`font-semibold ${(campaign.failed_count ?? 0) > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{campaign.failed_count ?? 0}</span>} />
          <DetailRow label="Başarı Oranı" value={`%${successRate}`} />
          <DetailRow label="Tıklanma" value={`${campaign.opened_count ?? 0} (%${openRate})`} />
        </div>

        <div className="mt-4 rounded-2xl border border-geex-border bg-geex-bg p-3 text-xs">
          <p className="font-semibold text-geex-text">{campaign.title}</p>
          <p className="mt-1 text-slate-700">{campaign.body}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-geex-border bg-white py-2.5 text-sm font-medium text-geex-text hover:bg-geex-bg"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-geex-border/60 pb-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Confirm modal
// ════════════════════════════════════════════════════════════════════════════
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-geex-text">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-geex-border bg-white py-2 text-sm font-medium text-geex-text hover:bg-geex-bg"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Evet, Onayla
          </button>
        </div>
      </div>
    </div>
  );
}
