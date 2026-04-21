import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Clock, Eye, Filter, Loader2, Mail, MapPin,
  Phone, RefreshCw, RotateCcw, Save, Search, ShoppingBag,
  Truck, X, Zap, Building2, TrendingUp,
} from 'lucide-react';
import { supabase } from '../../supabase';

// ── Sabitler ──────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { key: 'all',             label: 'Tüm Durumlar' },
  { key: 'pending',         label: 'Bekliyor' },
  { key: 'confirmed',       label: 'Onaylandı' },
  { key: 'preparing',       label: 'Hazırlanıyor' },
  { key: 'on_way',          label: 'Yolda' },
  { key: 'delivered',       label: 'Teslim Edildi' },
  { key: 'cancelled',       label: 'İptal Edildi' },
  { key: 'refunded',        label: 'İade Edildi' },
  { key: 'pending_payment', label: 'Ödeme Bekliyor' },
];

const STATUS_UPDATE_OPTIONS = STATUS_OPTIONS.filter(o => o.key !== 'all');

// ── Yardımcılar ───────────────────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

function diffMinutes(start, end) {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.max(0, Math.round((e - s) / 60000));
}

function fmtMins(mins) {
  if (mins === null || mins === undefined) return '—';
  if (mins < 60) return `${mins} dk`;
  return `${Math.floor(mins / 60)}s ${mins % 60}dk`;
}

function normalizeStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'hazirlaniyor') return 'preparing';
  if (v === 'yola_cikti') return 'on_way';
  if (v === 'teslim_edildi') return 'delivered';
  if (v === 'iptal') return 'cancelled';
  if (v === 'beklemede') return 'pending';
  return v || 'pending';
}

function getStatusLabel(s) {
  return STATUS_OPTIONS.find(o => o.key === normalizeStatus(s))?.label || s || '—';
}

function getStatusCls(s) {
  const n = normalizeStatus(s);
  if (n === 'delivered')       return 'bg-emerald-100 text-emerald-700';
  if (n === 'preparing')       return 'bg-amber-100 text-amber-700';
  if (n === 'on_way')          return 'bg-sky-100 text-sky-700';
  if (n === 'cancelled')       return 'bg-rose-100 text-rose-700';
  if (n === 'refunded')        return 'bg-purple-100 text-purple-700';
  if (n === 'confirmed')       return 'bg-blue-100 text-blue-700';
  if (n === 'pending_payment') return 'bg-yellow-100 text-yellow-700';
  return 'bg-violet-100 text-violet-700';
}

function getOrderCode(order) {
  return order?.paytr_oid || order?.order_code || `KCAL-${String(order?.id || '').slice(-6).toUpperCase()}`;
}

function getOrderAmount(order) {
  const n = Number(order?.total_amount ?? order?.total_price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeItems(order, fallback = []) {
  const src = Array.isArray(order?.items) && order.items.length > 0 ? order.items : fallback;
  return src.map((item, i) => {
    const qty = Number(item?.quantity ?? 1);
    const unitPrice = Number(item?.unit_price ?? item?.price ?? 0);
    const lineTotal = Number(item?.line_total ?? item?.total_price ?? qty * unitPrice);
    return {
      key: `${i}`,
      name: String(item?.name || item?.product_name || `Ürün ${i + 1}`),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      lineTotal: Number.isFinite(lineTotal) ? lineTotal : 0,
    };
  });
}

// ── Timing kartı ──────────────────────────────────────────────────────────────
function TimingCard({ order }) {
  // DB'de accepted_at / prepared_at yoksa updated_at + status'a göre kaba tahmin
  const createdAt   = order.created_at;
  const confirmedAt = order.confirmed_at || (normalizeStatus(order.status) !== 'pending' ? order.updated_at : null);
  const preparingAt = order.preparing_at;
  const onWayAt     = order.on_way_at;
  const deliveredAt = order.delivered_at;

  const totalMins     = diffMinutes(createdAt, deliveredAt);
  const confirmMins   = diffMinutes(createdAt, confirmedAt);
  const prepMins      = diffMinutes(confirmedAt, onWayAt);
  const deliveryMins  = diffMinutes(onWayAt, deliveredAt);

  const rows = [
    { label: 'Sipariş Verildi',     value: formatDate(createdAt),   icon: <ShoppingBag size={13} className="text-slate-400" /> },
    { label: 'Onaylandı',           value: formatDate(confirmedAt), icon: <Clock size={13} className="text-blue-400" />,     diff: confirmMins,  diffLabel: 'onaya kadar' },
    { label: 'Kuryeye Verildi',     value: formatDate(onWayAt),     icon: <Truck size={13} className="text-orange-400" />,  diff: prepMins,     diffLabel: 'hazırlama' },
    { label: 'Teslim Edildi',       value: formatDate(deliveredAt), icon: <TrendingUp size={13} className="text-emerald-400" />, diff: deliveryMins, diffLabel: 'teslimat' },
  ];

  return (
    <section className="rounded-2xl border border-geex-border bg-geex-bg p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Sipariş Zaman Çizelgesi</p>
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {row.icon}
              <span className="text-xs font-semibold text-slate-600">{row.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {row.diff !== null && row.diff !== undefined && (
                <span className="rounded-full bg-white border border-geex-border px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {fmtMins(row.diff)} {row.diffLabel}
                </span>
              )}
              <span className="text-xs text-slate-500 tabular-nums">{row.value}</span>
            </div>
          </div>
        ))}
      </div>
      {totalMins !== null && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-700">Toplam Süre</span>
          <span className="text-sm font-black text-emerald-700">{fmtMins(totalMins)}</span>
        </div>
      )}
    </section>
  );
}

// ── Ana component ─────────────────────────────────────────────────────────────
export default function AdminOrders() {
  const [orders,         setOrders]         = useState([]);
  const [branches,       setBranches]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [info,           setInfo]           = useState('');

  // Filtreler
  const [searchText,     setSearchText]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [typeFilter,     setTypeFilter]     = useState('all'); // all | immediate | scheduled
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [branchFilter,   setBranchFilter]   = useState('all');

  // Detail modal
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailOrder,    setDetailOrder]    = useState(null);
  const [detailItems,    setDetailItems]    = useState([]);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [detailError,    setDetailError]    = useState('');
  const [statusDraft,    setStatusDraft]    = useState('pending');
  const [statusSaving,   setStatusSaving]   = useState(false);

  // İade modal
  const [refundOpen,     setRefundOpen]     = useState(false);
  const [refundAmount,   setRefundAmount]   = useState('');
  const [refundReason,   setRefundReason]   = useState('');
  const [refundSaving,   setRefundSaving]   = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let q = supabase
        .from('orders')
        .select('*, profile:profiles(full_name, phone, email, privileged_until)')
        .order('created_at', { ascending: false })
        .limit(1000);

      const { data, error: err } = await q;
      if (err) {
        // profiles join yoksa plain
        const { data: d2, error: e2 } = await supabase
          .from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
        if (e2) throw e2;
        setOrders(Array.isArray(d2) ? d2 : []);
      } else {
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setError(e?.message || 'Siparişler alınamadı.');
      setOrders([]);
    } finally { setLoading(false); }
  }, []);

  const fetchBranches = useCallback(async () => {
    const { data } = await supabase.from('branches').select('id, name').order('name');
    setBranches(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { fetchOrders(); fetchBranches(); }, [fetchOrders, fetchBranches]);

  // ── Filtreli liste ────────────────────────────────────────────────────────
  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach(b => m.set(String(b.id), b.name));
    return m;
  }, [branches]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const status = normalizeStatus(order.status);
      const dt     = order.delivery_type || order.delivery_time_type || 'immediate';
      const code   = getOrderCode(order).toLowerCase();
      const name   = String(order.customer_name || order.profile?.full_name || '').toLowerCase();
      const phone  = String(order.phone || order.profile?.phone || '').toLowerCase();

      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (typeFilter   === 'immediate' && dt !== 'immediate') return false;
      if (typeFilter   === 'scheduled' && dt !== 'scheduled') return false;
      if (branchFilter !== 'all' && String(order.branch_id) !== branchFilter) return false;

      if (dateFrom) {
        const orderDate = new Date(order.created_at);
        if (orderDate < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const orderDate = new Date(order.created_at);
        const end = new Date(dateTo); end.setDate(end.getDate() + 1);
        if (orderDate >= end) return false;
      }

      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !phone.includes(q)) return false;
      }

      return true;
    });
  }, [orders, statusFilter, typeFilter, dateFrom, dateTo, branchFilter, searchText]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = filteredOrders.length;
    const active  = filteredOrders.filter(o => ['pending', 'confirmed', 'preparing', 'on_way'].includes(normalizeStatus(o.status))).length;
    const done    = filteredOrders.filter(o => normalizeStatus(o.status) === 'delivered').length;
    const revenue = filteredOrders.filter(o => normalizeStatus(o.status) === 'delivered').reduce((s, o) => s + getOrderAmount(o), 0);
    return { total, active, done, revenue };
  }, [filteredOrders]);

  // ── Detail ────────────────────────────────────────────────────────────────
  const openDetail = async (order) => {
    setDetailOpen(true);
    setDetailOrder(order);
    setStatusDraft(normalizeStatus(order.status));
    setDetailError('');
    const init = normalizeItems(order);
    setDetailItems(init);
    if (init.length > 0) { setDetailLoading(false); return; }
    setDetailLoading(true);
    try {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id).order('id');
      setDetailItems(normalizeItems(order, data || []));
    } catch (e) { setDetailError(e?.message || 'Ürünler alınamadı.'); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => {
    if (statusSaving) return;
    setDetailOpen(false); setDetailOrder(null); setDetailItems([]);
    setDetailError(''); setRefundOpen(false);
  };

  const handleStatusSave = async () => {
    if (!detailOrder?.id) return;
    setStatusSaving(true); setDetailError('');
    try {
      const { error: e } = await supabase.from('orders')
        .update({ status: statusDraft, updated_at: new Date().toISOString() })
        .eq('id', detailOrder.id);
      if (e) throw e;
      setOrders(prev => prev.map(o => String(o.id) === String(detailOrder.id) ? { ...o, status: statusDraft } : o));
      setDetailOrder(prev => prev ? { ...prev, status: statusDraft } : prev);
      setInfo(`${getOrderCode(detailOrder)} durumu güncellendi.`);
    } catch (e) { setDetailError(e?.message || 'Güncelleme başarısız.'); }
    finally { setStatusSaving(false); }
  };

  const handleRefund = async () => {
    const amount = parseFloat(refundAmount);
    const max    = getOrderAmount(detailOrder);
    if (!Number.isFinite(amount) || amount <= 0) { setDetailError('Geçerli tutar girin.'); return; }
    if (amount > max) { setDetailError(`Max ${formatCurrency(max)}`); return; }
    if (!refundReason.trim()) { setDetailError('Neden zorunlu.'); return; }
    setRefundSaving(true); setDetailError('');
    try {
      await supabase.from('orders').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', detailOrder.id);
      await supabase.from('refunds').insert({ order_id: detailOrder.id, amount, reason: refundReason.trim(), created_at: new Date().toISOString() }).catch(() => {});
      setOrders(prev => prev.map(o => String(o.id) === String(detailOrder.id) ? { ...o, status: 'refunded' } : o));
      setDetailOrder(prev => prev ? { ...prev, status: 'refunded' } : prev);
      setStatusDraft('refunded');
      setRefundOpen(false); setRefundAmount(''); setRefundReason('');
      setInfo(`${getOrderCode(detailOrder)} için ${formatCurrency(amount)} iade işlendi.`);
    } catch (e) { setDetailError(e?.message || 'İade başarısız.'); }
    finally { setRefundSaving(false); }
  };

  const getCustomerName = (o) => o?.profile?.full_name || o?.customer_name || 'Müşteri';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 text-geex-text">

      {/* ── Header ── */}
      <header className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text">Siparişler</h1>
            <p className="mt-1 text-sm text-slate-500">Tüm siparişleri görüntüleyin, filtreleyin ve analiz edin.</p>
          </div>
          <button onClick={fetchOrders} disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold transition hover:bg-geex-bg disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Yenile
          </button>
        </div>
      </header>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Toplam', value: stats.total },
          { label: 'Aktif',  value: stats.active },
          { label: 'Teslim', value: stats.done },
          { label: 'Ciro',   value: formatCurrency(stats.revenue), small: true },
        ].map((s, i) => (
          <article key={i} className="rounded-3xl border border-geex-border bg-geex-card p-4 shadow-geex-soft">
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            <p className={`mt-1 font-zalando ${s.small ? 'text-xl' : 'text-3xl'}`}>{s.value}</p>
          </article>
        ))}
      </div>

      {/* ── Filtreler ── */}
      <section className="rounded-3xl border border-geex-border bg-geex-card p-4 shadow-geex-soft">
        <div className="flex flex-wrap gap-3">
          {/* Arama */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Sipariş kodu, müşteri, telefon..."
              className="h-10 w-full rounded-2xl border border-geex-border bg-white pl-9 pr-3 text-sm font-medium focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Durum */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-10 rounded-2xl border border-geex-border bg-white px-3 text-sm font-medium focus:outline-none">
            {STATUS_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>

          {/* Teslimat tipi */}
          <div className="flex rounded-2xl border border-geex-border bg-white p-1 gap-1">
            {[
              { key: 'all', label: 'Tümü', icon: null },
              { key: 'immediate', label: 'Hemen', icon: <Zap size={12} /> },
              { key: 'scheduled', label: 'Randevulu', icon: <CalendarClock size={12} /> },
            ].map(t => (
              <button key={t.key} onClick={() => setTypeFilter(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  typeFilter === t.key ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-500 hover:bg-gray-50'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Tarih aralığı */}
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-10 rounded-2xl border border-geex-border bg-white px-3 text-sm font-medium focus:outline-none" />
            <span className="text-slate-400 text-xs">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-10 rounded-2xl border border-geex-border bg-white px-3 text-sm font-medium focus:outline-none" />
          </div>

          {/* Şube */}
          {branches.length > 0 && (
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
              className="h-10 rounded-2xl border border-geex-border bg-white px-3 text-sm font-medium focus:outline-none">
              <option value="all">Tüm Şubeler</option>
              {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </select>
          )}

          {/* Reset */}
          {(searchText || statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo || branchFilter !== 'all') && (
            <button onClick={() => { setSearchText(''); setStatusFilter('all'); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setBranchFilter('all'); }}
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100">
              <X size={12} /> Temizle
            </button>
          )}
        </div>
      </section>

      {/* ── Mesajlar ── */}
      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {info  && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</p>}

      {/* ── Tablo ── */}
      <div className="overflow-x-auto rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-geex-border text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-5 py-4 font-semibold">Sipariş</th>
              <th className="px-5 py-4 font-semibold">Müşteri</th>
              <th className="px-5 py-4 font-semibold">Tarih / Saat</th>
              <th className="px-5 py-4 font-semibold">Tip</th>
              <th className="px-5 py-4 font-semibold">Şube</th>
              <th className="px-5 py-4 font-semibold">Tutar</th>
              <th className="px-5 py-4 font-semibold">Durum</th>
              <th className="px-5 py-4 text-right font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-5 py-12 text-center text-slate-400" colSpan={8}>
                <Loader2 size={20} className="animate-spin mx-auto" />
              </td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td className="px-5 py-12 text-center text-sm text-slate-400" colSpan={8}>
                <Filter size={20} className="mx-auto mb-2 text-slate-300" />
                Filtreye uyan sipariş bulunamadı.
              </td></tr>
            ) : filteredOrders.map(order => {
              const dt          = order.delivery_type || order.delivery_time_type || 'immediate';
              const isScheduled = dt === 'scheduled';
              const branchName  = branchMap.get(String(order.branch_id)) || '—';

              return (
                <tr key={order.id} className="border-b border-geex-border last:border-b-0 hover:bg-geex-bg/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-geex-text">{getOrderCode(order)}</p>
                    {isScheduled && order.scheduled_date && (
                      <p className="text-[11px] text-indigo-500 mt-0.5">
                        📅 {order.scheduled_date} {String(order.scheduled_time || '').slice(0,5)}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-geex-text">{getCustomerName(order)}</p>
                    {(order.phone || order.profile?.phone) && (
                      <p className="text-[11px] text-slate-400">{order.phone || order.profile?.phone}</p>
                    )}
                    {order.profile?.privileged_until && new Date(order.profile.privileged_until) > new Date() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#C6F04F]/20 border border-[#C6F04F] px-2 py-0.5 text-[10px] font-black text-black mt-0.5">
                        ⭐ Ayrıcalıklı
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 tabular-nums text-xs">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    {isScheduled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                        <CalendarClock size={11} /> Randevulu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        <Zap size={11} /> Hemen
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Building2 size={12} className="text-slate-300" />
                      {branchName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-geex-text">
                    {formatCurrency(getOrderAmount(order))}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusCls(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => openDetail(order)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-geex-border bg-white px-3 text-xs font-semibold transition hover:bg-geex-bg">
                      <Eye size={12} /> İncele
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-geex-border px-5 py-3 text-xs text-slate-400">
          {filteredOrders.length.toLocaleString('tr-TR')} sipariş gösteriliyor
          {orders.length !== filteredOrders.length && ` (toplam ${orders.length.toLocaleString('tr-TR')} içinden)`}
        </div>
      </div>

      {/* ── İade Modal ── */}
      {refundOpen && detailOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-zalando text-geex-text">İade İşlemi</p>
                <p className="mt-1 text-xs text-slate-500">{getOrderCode(detailOrder)} • Max: {formatCurrency(getOrderAmount(detailOrder))}</p>
              </div>
              <button onClick={() => setRefundOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-geex-border bg-white">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">
                İade Tutarı (₺) *
                <input type="number" min="0.01" step="0.01" max={getOrderAmount(detailOrder)}
                  value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-geex-border bg-white px-3 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                İade Nedeni *
                <textarea rows={3} value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  className="mt-1.5 w-full resize-none rounded-xl border border-geex-border bg-white px-3 py-2 text-sm" />
              </label>
              {detailError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{detailError}</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRefundOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">İptal</button>
              <button onClick={handleRefund} disabled={refundSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {refundSaving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                İadeyi Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detay Modal ── */}
      {detailOpen && detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-geex-border bg-geex-card shadow-geex">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-geex-border px-6 py-4">
              <div>
                <p className="text-lg font-zalando text-geex-text">{getOrderCode(detailOrder)}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusCls(detailOrder.status)}`}>
                    {getStatusLabel(detailOrder.status)}
                  </span>
                  {(() => {
                    const dt = detailOrder.delivery_type || detailOrder.delivery_time_type || 'immediate';
                    return dt === 'scheduled'
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700"><CalendarClock size={11} /> Randevulu</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700"><Zap size={11} /> Hemen</span>;
                  })()}
                  {branchMap.get(String(detailOrder.branch_id)) && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Building2 size={11} /> {branchMap.get(String(detailOrder.branch_id))}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={closeDetail} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-geex-border bg-white text-geex-text">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-130px)] space-y-4 overflow-y-auto px-6 py-5">

              {/* Müşteri */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-geex-border bg-geex-bg p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Müşteri</p>
                  <p className="mt-1 text-sm font-semibold text-geex-text">{getCustomerName(detailOrder)}</p>
                  {(detailOrder.phone || detailOrder.profile?.phone) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Phone size={11} />{detailOrder.phone || detailOrder.profile?.phone}
                    </p>
                  )}
                  {detailOrder.profile?.email && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Mail size={11} />{detailOrder.profile.email}
                    </p>
                  )}
                </article>
                <article className="rounded-2xl border border-geex-border bg-geex-bg p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tutar</p>
                  <p className="mt-1 text-lg font-semibold text-geex-text">{formatCurrency(getOrderAmount(detailOrder))}</p>
                  {detailOrder.coupon_code && (
                    <p className="mt-0.5 text-xs text-slate-400">Kupon: {detailOrder.coupon_code}</p>
                  )}
                </article>
                {(detailOrder.delivery_type || detailOrder.delivery_time_type) === 'scheduled' ? (
                  <article className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Randevu</p>
                    <p className="mt-1 text-sm font-bold text-indigo-800">{detailOrder.scheduled_date}</p>
                    <p className="text-sm font-bold text-indigo-800">{String(detailOrder.scheduled_time || '').slice(0,5)}</p>
                  </article>
                ) : (
                  <article className="rounded-2xl border border-geex-border bg-geex-bg p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sipariş Tarihi</p>
                    <p className="mt-1 text-sm font-semibold text-geex-text">{formatDate(detailOrder.created_at)}</p>
                  </article>
                )}
              </section>

              {/* Adres */}
              {detailOrder.address && (
                <section className="rounded-2xl border border-geex-border bg-geex-bg p-3.5">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <MapPin size={11} /> Teslimat Adresi
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{detailOrder.address}</p>
                </section>
              )}

              {/* Zaman çizelgesi */}
              <TimingCard order={detailOrder} />

              {/* Ürünler */}
              <section className="rounded-2xl border border-geex-border bg-geex-bg p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sipariş Ürünleri</p>
                  <span className="rounded-full bg-white border border-geex-border px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {detailItems.length} kalem
                  </span>
                </div>
                {detailLoading ? (
                  <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Yükleniyor...</p>
                ) : detailItems.length === 0 ? (
                  <p className="text-sm text-slate-400">Ürün bilgisi bulunamadı.</p>
                ) : (
                  <div className="space-y-2">
                    {detailItems.map(item => (
                      <div key={item.key} className="flex items-center justify-between rounded-xl border border-geex-border bg-white px-3 py-2.5">
                        <p className="text-sm font-medium text-geex-text">{item.quantity} x {item.name}</p>
                        <p className="text-sm font-semibold text-geex-text">{formatCurrency(item.lineTotal)}</p>
                      </div>
                    ))}
                    <div className="flex justify-end pt-1">
                      <p className="text-sm font-black text-geex-text">{formatCurrency(getOrderAmount(detailOrder))}</p>
                    </div>
                  </div>
                )}
              </section>

              {/* Müşteri notu */}
              {(detailOrder.customer_note || detailOrder.note) && (
                <section className="rounded-2xl border border-amber-100 bg-amber-50 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Müşteri Notu</p>
                  <p className="mt-1 text-sm text-amber-800">{detailOrder.customer_note || detailOrder.note}</p>
                </section>
              )}

              {/* Durum güncelle */}
              <section className="rounded-2xl border border-geex-border bg-geex-bg p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Durum Güncelle</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select value={statusDraft} onChange={e => setStatusDraft(e.target.value)}
                    className="h-11 w-full rounded-xl border border-geex-border bg-white px-3 text-sm font-medium sm:w-[260px]">
                    {STATUS_UPDATE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <button onClick={handleStatusSave} disabled={statusSaving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(152,205,0,0.25)] disabled:opacity-60">
                    {statusSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Kaydet
                  </button>
                  {normalizeStatus(detailOrder.status) === 'delivered' && (
                    <button onClick={() => { setRefundAmount(''); setRefundReason(''); setRefundOpen(true); }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                      <RotateCcw size={14} /> İade İşle
                    </button>
                  )}
                </div>
                {detailError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</p>}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
