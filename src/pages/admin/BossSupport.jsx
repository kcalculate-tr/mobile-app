import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle, ChevronDown, ChevronUp, Loader2,
  MessageSquare, RefreshCw, Send, Star, X,
} from 'lucide-react';
import { supabase } from '../../supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_CFG = {
  open:     { label: 'Açık',       cls: 'bg-amber-100 text-amber-700' },
  answered: { label: 'Yanıtlandı', cls: 'bg-emerald-100 text-emerald-700' },
  closed:   { label: 'Kapalı',     cls: 'bg-slate-100 text-slate-500' },
  new:      { label: 'Yeni',       cls: 'bg-blue-100 text-blue-700' },
};

const FEEDBACK_CAT = {
  general: 'Genel', food: 'Yemek Kalitesi', delivery: 'Teslimat',
  app: 'Uygulama', service: 'Müşteri Hizmetleri', price: 'Fiyat / Ürün',
};

// ── Destek Talebi Satırı ──────────────────────────────────────────────────────
function TicketRow({ ticket, onReply, onClose }) {
  const [open,    setOpen]    = useState(false);
  const [reply,   setReply]   = useState(ticket.admin_reply || '');
  const [saving,  setSaving]  = useState(false);
  const cfg = STATUS_CFG[ticket.status] ?? STATUS_CFG.open;

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSaving(true);
    await onReply(ticket.id, reply.trim(), ticket.user_id, ticket.user_email);
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-geex-border bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 text-left hover:bg-geex-bg/50 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cfg.cls}`}>{cfg.label}</span>
              <p className="text-sm font-bold text-geex-text truncate">{ticket.subject}</p>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {ticket.user_email || '—'} · {formatDate(ticket.created_at)}
              {ticket.order_code && <span className="ml-2 font-mono text-brand-primary">{ticket.order_code}</span>}
            </p>
          </div>
          <div className="shrink-0 text-slate-400">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-geex-border bg-geex-bg/30 px-5 py-4 space-y-4">
          {/* Müşteri mesajı */}
          <div className="rounded-xl border border-geex-border bg-white p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Müşteri Mesajı</p>
            <p className="text-sm text-geex-text leading-relaxed">{ticket.message}</p>
          </div>

          {/* Mevcut cevap */}
          {ticket.admin_reply && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1">
                Verilen Cevap · {formatDate(ticket.admin_reply_at)}
              </p>
              <p className="text-sm text-geex-text leading-relaxed">{ticket.admin_reply}</p>
            </div>
          )}

          {/* Cevap yaz */}
          {ticket.status !== 'closed' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                {ticket.admin_reply ? 'Cevabı Güncelle' : 'Cevap Yaz'}
              </p>
              <textarea
                rows={3}
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Müşteriye cevabınızı yazın..."
                className="w-full resize-none rounded-xl border border-geex-border bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => onClose(ticket.id)}
                  className="rounded-xl border border-geex-border px-4 py-2 text-sm text-slate-500 hover:bg-geex-bg"
                >
                  Kapat
                </button>
                <button
                  onClick={sendReply}
                  disabled={saving || !reply.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Gönder & Bildir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Geri Bildirim Satırı ──────────────────────────────────────────────────────
function FeedbackRow({ fb }) {
  const [open, setOpen] = useState(false);
  const stars = fb.rating ?? 0;

  return (
    <div className="rounded-2xl border border-geex-border bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-5 py-4 text-left hover:bg-geex-bg/50 transition">
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 shrink-0">
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={14} className={i <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
            ))}
          </div>
          <span className="rounded-full border border-geex-border bg-geex-bg px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {FEEDBACK_CAT[fb.category] ?? fb.category}
          </span>
          <p className="flex-1 min-w-0 truncate text-sm text-geex-text">{fb.message}</p>
          <span className="shrink-0 text-xs text-slate-400">{formatDate(fb.created_at)}</span>
          {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-geex-border bg-geex-bg/30 px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">{fb.user_email || '—'}</p>
          <p className="text-sm text-geex-text leading-relaxed">{fb.message}</p>
        </div>
      )}
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function BossSupport() {
  const [tab,      setTab]      = useState('tickets');
  const [tickets,  setTickets]  = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [info,     setInfo]     = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [t, f] = await Promise.all([
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setTickets(Array.isArray(t.data) ? t.data : []);
    setFeedback(Array.isArray(f.data) ? f.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleReply = async (ticketId, replyText, userId, userEmail) => {
    const { error } = await supabase.from('support_tickets').update({
      admin_reply: replyText,
      admin_reply_at: new Date().toISOString(),
      status: 'answered',
      updated_at: new Date().toISOString(),
    }).eq('id', ticketId);

    if (error) { setInfo('Hata: ' + error.message); return; }

    // Push notification gönder
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: profile.push_token,
            title: 'Destek Talebiniz Yanıtlandı',
            body: 'Destek talebinize yanıt verildi. Görüntülemek için tıklayın.',
            data: { type: 'support_reply', ticketId },
          }),
        }).catch(() => {});
      }

      // Log
      await supabase.from('push_notifications').insert({
        user_id: userId,
        title: 'Destek Talebiniz Yanıtlandı',
        body: replyText.slice(0, 100),
        data: { type: 'support_reply', ticketId },
      }).catch(() => {});
    }

    setInfo('Cevap gönderildi, bildirim iletildi.');
    fetchAll();
    setTimeout(() => setInfo(''), 4000);
  };

  const handleClose = async (ticketId) => {
    await supabase.from('support_tickets').update({
      status: 'closed', updated_at: new Date().toISOString(),
    }).eq('id', ticketId);
    fetchAll();
  };

  const filteredTickets = tickets.filter(t =>
    filter === 'all' ? true : t.status === filter
  );

  const avgRating = feedback.length > 0
    ? (feedback.reduce((s, f) => s + (f.rating ?? 0), 0) / feedback.length).toFixed(1)
    : '—';

  const openCount     = tickets.filter(t => t.status === 'open' || t.status === 'new').length;
  const answeredCount = tickets.filter(t => t.status === 'answered').length;

  return (
    <div className="space-y-5 text-geex-text">
      {/* ── Header ── */}
      <header className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text flex items-center gap-2">
              <MessageSquare size={22} className="text-brand-primary" /> Destek & Geri Bildirim
            </h1>
            <p className="mt-1 text-sm text-slate-500">Müşteri destek taleplerini yanıtlayın, geri bildirimleri inceleyin.</p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Yenile
          </button>
        </div>
        {info && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
      </header>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Açık Talepler',    value: openCount,        cls: 'text-amber-600' },
          { label: 'Yanıtlanan',        value: answeredCount,    cls: 'text-emerald-600' },
          { label: 'Toplam Talep',      value: tickets.length,   cls: '' },
          { label: 'Ort. Puan',         value: avgRating + ' ★', cls: 'text-amber-500' },
        ].map((s, i) => (
          <div key={i} className="rounded-3xl border border-geex-border bg-geex-card p-4 shadow-geex-soft">
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-zalando ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <div className="inline-flex rounded-2xl border border-geex-border bg-geex-bg p-1 gap-1">
        {[
          { key: 'tickets',  label: `Destek Talepleri (${tickets.length})` },
          { key: 'feedback', label: `Geri Bildirimler (${feedback.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'bg-brand-primary text-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]' : 'text-geex-text hover:bg-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Destek Talepleri ── */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          {/* Filtre */}
          <div className="flex flex-wrap gap-2">
            {[
              { k: 'all',      l: 'Tümü' },
              { k: 'new',      l: 'Yeni' },
              { k: 'open',     l: 'Açık' },
              { k: 'answered', l: 'Yanıtlandı' },
              { k: 'closed',   l: 'Kapalı' },
            ].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  filter === f.k ? 'bg-brand-primary text-white' : 'border border-geex-border bg-white text-geex-text hover:bg-geex-bg'
                }`}>
                {f.l}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : filteredTickets.length === 0 ? (
            <div className="rounded-3xl border border-geex-border bg-geex-card py-12 text-center text-sm text-slate-400">
              Talep bulunamadı.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map(t => (
                <TicketRow key={t.id} ticket={t} onReply={handleReply} onClose={handleClose} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Geri Bildirimler ── */}
      {tab === 'feedback' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : feedback.length === 0 ? (
            <div className="rounded-3xl border border-geex-border bg-geex-card py-12 text-center text-sm text-slate-400">
              Henüz geri bildirim yok.
            </div>
          ) : (
            feedback.map(f => <FeedbackRow key={f.id} fb={f} />)
          )}
        </div>
      )}
    </div>
  );
}
