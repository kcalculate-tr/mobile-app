import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, MessageSquareReply, RotateCw, Send, X } from 'lucide-react';
import { supabase } from '../../supabase';

const STATUS_LABELS = {
  open: 'Açık',
  answered: 'Cevaplandı',
  closed: 'Kapalı',
};

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

function formatTicketShortId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return raw.substring(0, 8).toUpperCase();
}

async function sendTicketEmailNotification(email, ticketId, reply) {
  try {
    await fetch('/api/send-ticket-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        ticket_id: ticketId,
        reply,
      }),
    });
    console.log('Mail gönderildi', { email, ticketId });
  } catch (err) {
    console.warn('Mail bildirimi gönderilemedi:', err?.message || err);
  }
}

export default function AdminTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: responseError } = await supabase
        .from('support_tickets')
        .select('id,user_id,user_email,order_code,subject,message,admin_reply,status,created_at,updated_at')
        .order('created_at', { ascending: false });

      if (responseError) throw responseError;
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Destek talepleri alınamadı.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const sortedTickets = useMemo(() => {
    const priority = { open: 0, answered: 1, closed: 2 };
    return [...tickets].sort((a, b) => {
      const left = priority[String(a?.status || '').toLowerCase()] ?? 9;
      const right = priority[String(b?.status || '').toLowerCase()] ?? 9;
      if (left !== right) return left - right;
      return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
    });
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    if (filterStatus === 'all') return sortedTickets;
    return sortedTickets.filter((item) => String(item?.status || '').toLowerCase() === filterStatus);
  }, [filterStatus, sortedTickets]);

  const openReplyModal = (ticket) => {
    setSelectedTicket(ticket);
    setReplyText(String(ticket?.admin_reply || ''));
    setReplyModalOpen(true);
    setError('');
    setInfo('');
  };

  const closeReplyModal = () => {
    if (replySaving) return;
    setReplyModalOpen(false);
    setSelectedTicket(null);
    setReplyText('');
  };

  const handleReplySubmit = async () => {
    if (!selectedTicket?.id) return;

    const safeReply = String(replyText || '').trim();
    if (!safeReply) {
      setError('Yanıt metni boş olamaz.');
      return;
    }

    setReplySaving(true);
    setError('');
    setInfo('');

    try {
      const payload = {
        admin_reply: safeReply,
        status: 'answered',
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('support_tickets')
        .update(payload)
        .eq('id', selectedTicket.id);

      if (updateError) throw updateError;

      await sendTicketEmailNotification(selectedTicket.user_email, selectedTicket.id, safeReply);
      setTickets((prev) => prev.map((item) => (
        String(item.id) === String(selectedTicket.id)
          ? { ...item, ...payload }
          : item
      )));
      setInfo(`Talep #${formatTicketShortId(selectedTicket.id)} başarıyla yanıtlandı.`);
      closeReplyModal();
    } catch (err) {
      setError(err?.message || 'Yanıt gönderilemedi.');
    } finally {
      setReplySaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg px-4 pb-10 pt-6 text-brand-dark">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/boss')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-white shadow-sm"
            aria-label="Admin'e dön"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="mb-0 text-lg font-bold text-brand-dark">Destek Talepleri</h1>
            <p className="mb-0 text-xs text-brand-dark/65">Açık talepler üstte listelenir. Buradan cevaplayabilirsiniz.</p>
          </div>
          <button
            type="button"
            onClick={fetchTickets}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl bg-brand-white px-3 py-2 text-xs font-semibold text-brand-dark disabled:opacity-60"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
            Yenile
          </button>
        </header>

        <div className="mb-3 inline-flex rounded-xl bg-brand-white p-1">
          {[
            { key: 'all', label: `Tümü (${sortedTickets.length})` },
            { key: 'open', label: `Açık (${sortedTickets.filter((item) => String(item?.status || '').toLowerCase() === 'open').length})` },
            { key: 'answered', label: `Cevaplandı (${sortedTickets.filter((item) => String(item?.status || '').toLowerCase() === 'answered').length})` },
            { key: 'closed', label: `Kapalı (${sortedTickets.filter((item) => String(item?.status || '').toLowerCase() === 'closed').length})` },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilterStatus(option.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                filterStatus === option.key ? 'bg-brand-primary text-brand-white' : 'text-brand-dark'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && !replyModalOpen && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}
        {info && (
          <p className="mb-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{info}</p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-brand-secondary bg-brand-white shadow-sm">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-brand-secondary text-left text-xs text-brand-dark/70">
                <th className="px-3 py-3 font-semibold">Durum</th>
                <th className="px-3 py-3 font-semibold">Konu</th>
                <th className="px-3 py-3 font-semibold">Sipariş Kodu</th>
                <th className="px-3 py-3 font-semibold">Müşteri E-posta</th>
                <th className="px-3 py-3 font-semibold">Tarih</th>
                <th className="px-3 py-3 font-semibold">Mesaj</th>
                <th className="px-3 py-3 font-semibold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-10 text-center text-xs text-brand-dark/60" colSpan={7}>
                    Talepler yükleniyor...
                  </td>
                </tr>
              ) : visibleTickets.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-xs text-brand-dark/60" colSpan={7}>
                    Filtreye uygun talep bulunamadı.
                  </td>
                </tr>
              ) : (
                visibleTickets.map((ticket) => {
                  const normalizedStatus = String(ticket?.status || 'open').toLowerCase();
                  const statusClass = normalizedStatus === 'answered'
                    ? 'bg-green-100 text-green-700'
                    : normalizedStatus === 'closed'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-amber-100 text-amber-700';

                  return (
                    <tr key={ticket.id} className="border-b border-brand-secondary last:border-b-0">
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusClass}`}>
                          {STATUS_LABELS[normalizedStatus] || 'Açık'}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-brand-dark">{ticket?.subject || '—'}</td>
                      <td className="px-3 py-3 text-brand-dark/70">{ticket?.order_code || '—'}</td>
                      <td className="px-3 py-3 text-brand-dark/80">{ticket?.user_email || '—'}</td>
                      <td className="px-3 py-3 text-brand-dark/70">{formatDate(ticket?.created_at)}</td>
                      <td className="max-w-[280px] truncate px-3 py-3 text-brand-dark/70">{ticket?.message || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openReplyModal(ticket)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-brand-white"
                        >
                          <MessageSquareReply size={12} />
                          Cevapla
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {replyModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-xl rounded-2xl bg-brand-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="mb-0 text-sm font-bold text-brand-dark">Talep #{formatTicketShortId(selectedTicket.id)} için yanıt oluştur</p>
                <p className="mb-0 mt-0.5 text-xs text-brand-dark/65">{selectedTicket.user_email || '—'} • {selectedTicket.order_code || 'Sipariş kodu yok'}</p>
              </div>
              <button
                type="button"
                onClick={closeReplyModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg text-brand-dark"
                aria-label="Kapat"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mb-2 rounded-xl bg-brand-bg px-3 py-2 text-xs text-brand-dark">
              <p className="mb-1 font-semibold">Müşteri Mesajı</p>
              <p className="mb-0">{selectedTicket.message || '—'}</p>
            </div>

            <label className="mb-2 block text-xs font-semibold text-brand-dark/75">
              Admin Yanıtı
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={6}
                className="mt-1 w-full resize-none rounded-xl border border-brand-secondary bg-brand-white px-3 py-2 text-sm text-brand-dark"
                placeholder="Müşteriye gönderilecek yanıtı yazın..."
              />
            </label>

            {error && (
              <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleReplySubmit}
                disabled={replySaving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-white disabled:opacity-60"
              >
                {replySaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Yanıtı Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
