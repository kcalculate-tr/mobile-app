/**
 * BossReviews.jsx — Müşteri Yorumları Yönetimi
 * Filtreler: tümü | bekleyenler | onaylananlar
 * Aksiyonlar: onayla, onayı geri al, yanıtla (inline)
 *
 * Real schema: reviews.is_approved BOOLEAN (true=approved, false/null=pending)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Loader2, MessageCircle, MessageSquare, Star, X, XCircle } from 'lucide-react';
import { supabase } from '../../supabase';

// ─── Helpers ─────────────────────────────────────────────────────────────────
// 'all' = no filter, 'pending' = is_approved IS NOT TRUE, 'approved' = is_approved = true
const FILTERS = [
  { key: 'all',      label: 'Tümü' },
  { key: 'pending',  label: 'Bekleyenler' },
  { key: 'approved', label: 'Onaylananlar' },
];

function Stars({ rating }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={13}
          className={i < rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
        />
      ))}
    </span>
  );
}

function StatusBadge({ isApproved }) {
  if (isApproved === true) {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">Onaylı</span>;
  }
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Bekliyor</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export default function BossReviews() {
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [err, setErr]             = useState('');
  const [ok, setOk]               = useState('');
  const [replies, setReplies]     = useState({});
  const [savingId, setSavingId]   = useState(null);
  const [openReply, setOpenReply] = useState({});

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('reviews')
      .select('id, user_id, order_id, rating, comment, is_approved, admin_reply, created_at')
      .order('created_at', { ascending: false });

    if (filter === 'approved') q = q.eq('is_approved', true);
    if (filter === 'pending')  q = q.neq('is_approved', true);

    const { data, error } = await q;
    if (error) setErr(error.message);
    else setReviews(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const setApproved = async (id, value) => {
    setSavingId(id);
    const { error } = await supabase.from('reviews').update({ is_approved: value }).eq('id', id);
    if (error) setErr(error.message);
    else { setOk(value ? 'Yorum onaylandı.' : 'Yorum onayı geri alındı.'); fetchReviews(); }
    setSavingId(null);
  };

  const saveReply = async (id) => {
    const text = (replies[id] || '').trim();
    if (!text) return;
    setSavingId(id);
    const { error } = await supabase.from('reviews').update({ admin_reply: text }).eq('id', id);
    if (error) setErr(error.message);
    else {
      setOk('Yanıt kaydedildi.');
      setReplies(p => ({ ...p, [id]: '' }));
      setOpenReply(p => ({ ...p, [id]: false }));
      fetchReviews();
    }
    setSavingId(null);
  };

  const pendingCount   = reviews.filter(r => r.is_approved !== true).length;
  const approvedCount  = reviews.filter(r => r.is_approved === true).length;

  const countFor = (key) => {
    if (key === 'all')      return reviews.length;
    if (key === 'pending')  return pendingCount;
    if (key === 'approved') return approvedCount;
    return 0;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text">Müşteri Yorumları</h1>
            <p className="mt-1 text-sm text-slate-500">Yorumları moderasyon edin, yanıtlayın ve yönetin.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-geex-border bg-geex-bg px-3 py-1 text-xs font-semibold text-slate-500">
            <MessageSquare size={13} /> {reviews.length} yorum
          </span>
        </div>

        {/* Filtreler */}
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map(f => {
            const count = countFor(f.key);
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-brand-primary text-brand-white shadow-[0_8px_20px_rgba(152,205,0,0.3)]'
                    : 'border border-geex-border bg-geex-bg text-slate-600 hover:bg-white'
                }`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-black/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bildirimler */}
      {err && (
        <div className="mx-1 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}<button onClick={() => setErr('')}><X size={14} /></button>
        </div>
      )}
      {ok && (
        <div className="mx-1 flex items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {ok}<button onClick={() => setOk('')}><X size={14} /></button>
        </div>
      )}

      {/* Liste */}
      <section className="rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft overflow-hidden">
        {loading ? <Spinner /> : reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <MessageCircle size={48} strokeWidth={1.2} />
            <p className="text-sm">Bu filtrede yorum yok.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {reviews.map(r => (
              <div key={r.id} className="px-5 py-4 space-y-3">
                {/* Üst satır */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stars rating={r.rating} />
                      <StatusBadge isApproved={r.is_approved} />
                      {r.admin_reply && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Yanıtlandı</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {r.order_id && <span>Sipariş #{r.order_id}</span>}
                      <span>{new Date(r.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Aksiyon butonları */}
                  <div className="flex items-center gap-2 shrink-0">
                    {r.is_approved !== true ? (
                      <button
                        onClick={() => setApproved(r.id, true)}
                        disabled={savingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-green-700"
                      >
                        {savingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
                        Onayla
                      </button>
                    ) : (
                      <button
                        onClick={() => setApproved(r.id, false)}
                        disabled={savingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50 hover:bg-amber-100"
                      >
                        {savingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
                        Onayı Geri Al
                      </button>
                    )}
                    <button
                      onClick={() => setOpenReply(p => ({ ...p, [r.id]: !p[r.id] }))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      <MessageCircle size={13} />
                      Yanıtla
                    </button>
                  </div>
                </div>

                {/* Yorum metni */}
                {r.comment && (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 leading-relaxed">
                    {r.comment}
                  </p>
                )}

                {/* Mevcut admin yanıtı */}
                {r.admin_reply && (
                  <div className="ml-4 rounded-xl border-l-2 border-green-400 bg-green-50 px-4 py-3">
                    <p className="mb-1 text-[11px] font-bold text-green-700">Admin Yanıtı</p>
                    <p className="text-sm text-green-800">{r.admin_reply}</p>
                  </div>
                )}

                {/* Inline yanıt formu */}
                {openReply[r.id] && (
                  <div className="ml-4 space-y-2">
                    <textarea
                      value={replies[r.id] || ''}
                      onChange={e => setReplies(p => ({ ...p, [r.id]: e.target.value }))}
                      rows={3}
                      placeholder="Müşteriye yanıtınızı yazın…"
                      className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveReply(r.id)}
                        disabled={savingId === r.id || !(replies[r.id] || '').trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {savingId === r.id ? <Loader2 size={12} className="animate-spin" /> : null}
                        Yanıtı Kaydet
                      </button>
                      <button
                        onClick={() => setOpenReply(p => ({ ...p, [r.id]: false }))}
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
