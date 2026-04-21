import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChefHat,
  Clock,
  Loader2,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from '../../supabase';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmtTime(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

function fmtMoney(v) {
  const n = Number(v || 0);
  return `${Number.isFinite(n) ? n.toFixed(2) : '0.00'} ₺`;
}

function parseItems(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function getOrderCode(o) {
  return o.paytr_oid || `KCAL-${String(o.id || '').slice(-4).toUpperCase()}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ─── Status config ───────────────────────────────────────────────────────── */
const STATUS_CFG = {
  pending:    { label: 'Bekliyor',       color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  confirmed:  { label: 'Onaylandı',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  preparing:  { label: 'Hazırlanıyor',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  ready:      { label: 'Hazır',          color: 'bg-green-100 text-green-700 border-green-200' },
  ready_soon: { label: 'Yakında Hazır',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  on_way:     { label: 'Yolda',          color: 'bg-sky-100 text-sky-700 border-sky-200' },
  delivered:  { label: 'Teslim Edildi',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:  { label: 'İptal',          color: 'bg-red-100 text-red-700 border-red-200' },
};

const STATUS_FILTERS = [
  { value: 'all',       label: 'Tümü' },
  { value: 'pending',   label: 'Bekliyor' },
  { value: 'confirmed', label: 'Onaylandı' },
  { value: 'preparing', label: 'Hazırlanıyor' },
  { value: 'ready',     label: 'Hazır' },
];

const STATUS_UPDATE_OPTIONS = [
  'pending', 'confirmed', 'preparing', 'ready', 'ready_soon', 'on_way', 'delivered', 'cancelled',
];

function statusCfg(s) {
  return STATUS_CFG[s] || { label: s || '—', color: 'bg-gray-100 text-gray-600 border-gray-200' };
}

/* ─── Prep time helpers ───────────────────────────────────────────────────── */
function calcPrepMins(order) {
  const items = parseItems(order.items);
  const total = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
  return Math.max(total * 8, 15);
}

function calcPrepStart(order) {
  if (!order.scheduled_time) return null;
  const [hh, mm] = String(order.scheduled_time).split(':').map(Number);
  const startMins = hh * 60 + mm - calcPrepMins(order);
  if (startMins < 0) return null;
  return `${String(Math.floor(startMins / 60)).padStart(2, '0')}:${String(startMins % 60).padStart(2, '0')}`;
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = statusCfg(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function BossScheduledOrders() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const alertedRef = useRef(new Set());
  const printRef = useRef(null);

  /* ── Fetch ────────────────────────────────────────────────────────────── */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_type', 'scheduled')
        .eq('scheduled_date', selectedDate)
        .order('scheduled_time', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('BossScheduledOrders fetch:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /* ── Realtime ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const channel = supabase
      .channel('boss-scheduled-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.delivery_type === 'scheduled' && row?.scheduled_date === selectedDate) {
          fetchOrders();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchOrders]);

  /* ── 30-Minute rule — check every 60 seconds ─────────────────────────── */
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      orders.forEach(async (order) => {
        if (order.scheduled_date !== today) return;
        if (!order.scheduled_time) return;
        const st = String(order.status || '');
        if (!['pending', 'confirmed', 'preparing'].includes(st)) return;
        if (alertedRef.current.has(order.id)) return;

        const [hh, mm] = String(order.scheduled_time).split(':').map(Number);
        const scheduled = new Date(now);
        scheduled.setHours(hh, mm, 0, 0);
        const diffMin = (scheduled.getTime() - now.getTime()) / 60000;

        if (diffMin > 0 && diffMin <= 30) {
          alertedRef.current.add(order.id);
          const code = getOrderCode(order);
          setAlerts((prev) => [
            ...prev,
            { id: `${order.id}-${Date.now()}`, orderId: order.id, message: `⚠️ ${code} siparişi ${Math.round(diffMin)} dakika sonra teslim edilecek!` },
          ]);
          if (st !== 'ready_soon') {
            await supabase.from('orders').update({ status: 'ready_soon' }).eq('id', order.id).catch(() => {});
          }
        }
      });
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [orders]);

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const updateStatus = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      setOrders((prev) => prev.map((o) => String(o.id) === String(orderId) ? { ...o, status: newStatus } : o));
      if (selectedOrder && String(selectedOrder.id) === String(orderId)) {
        setSelectedOrder((prev) => ({ ...prev, status: newStatus }));
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── Derived data ─────────────────────────────────────────────────────── */
  const filteredOrders = useMemo(() => orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (timeFilter && o.scheduled_time && !String(o.scheduled_time).startsWith(timeFilter)) return false;
    return true;
  }), [orders, statusFilter, timeFilter]);

  const kitchenGroups = useMemo(() => {
    const groups = {};
    orders.forEach((o) => {
      const t = o.scheduled_time ? String(o.scheduled_time).slice(0, 5) : '??:??';
      const hourKey = t.slice(0, 2) + ':00';
      if (!groups[hourKey]) groups[hourKey] = [];
      groups[hourKey].push(o);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  const handlePrint = () => window.print();

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* ── Alert banners ── */}
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-center justify-between gap-3 rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800 shadow-sm">
          <span className="flex items-center gap-2"><AlertTriangle size={15} /> {alert.message}</span>
          <button type="button" onClick={() => setAlerts((p) => p.filter((a) => a.id !== alert.id))} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}

      {/* ── Header + Filters ── */}
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-0 flex items-center gap-2 text-2xl font-zalando text-geex-text">
              <CalendarClock size={22} className="text-brand-primary" />
              Randevulu Siparişler
            </h1>
            <p className="mt-1 text-sm text-slate-500">Randevulu teslimat siparişlerini tarih bazlı planlayın ve yönetin.</p>
          </div>
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold text-geex-text transition hover:bg-geex-bg disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Yenile
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedOrder(null); }}
            className="h-10 rounded-2xl border border-geex-border bg-white px-3 text-sm font-medium text-geex-text focus:border-brand-primary focus:outline-none"
          />
          <input
            type="time"
            value={timeFilter ? `${timeFilter}:00` : ''}
            onChange={(e) => setTimeFilter(e.target.value ? e.target.value.slice(0, 2) : '')}
            className="h-10 rounded-2xl border border-geex-border bg-white px-3 text-sm font-medium text-geex-text focus:border-brand-primary focus:outline-none"
            placeholder="Saat filtrele"
          />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`h-9 rounded-2xl px-3 text-xs font-semibold transition ${
                  statusFilter === opt.value
                    ? 'bg-brand-primary text-white shadow-[0_4px_14px_rgba(152,205,0,0.35)]'
                    : 'border border-geex-border bg-white text-geex-text hover:bg-geex-bg'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3-Column Layout ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Left: Order List */}
        <section className="overflow-hidden rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
          <div className="flex items-center justify-between border-b border-geex-border px-5 py-3.5">
            <p className="font-zalando text-sm text-geex-text">
              Sipariş Listesi
              <span className="ml-2 text-xs font-medium text-slate-400">({filteredOrders.length})</span>
            </p>
          </div>

          <div className="divide-y divide-geex-border overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 size={24} className="animate-spin text-brand-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-14 text-center">
                <CalendarClock size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">Bu tarihte randevulu sipariş yok.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrder && String(selectedOrder.id) === String(order.id);
                const items = parseItems(order.items);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className={`w-full px-4 py-3.5 text-left transition hover:bg-slate-50 ${isSelected ? 'border-l-[3px] border-brand-primary bg-brand-primary/5' : 'border-l-[3px] border-transparent'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-geex-text">{getOrderCode(order)}</p>
                        <p className="truncate text-xs text-slate-500">{order.customer_name || '—'}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-primary">
                          <Clock size={11} /> {fmtTime(order.scheduled_time)}
                        </p>
                        <p className="text-[11px] text-slate-400">{items.length} ürün · {fmtMoney(order.total_price)}</p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'preparing'); }}
                      disabled={['preparing', 'ready', 'delivered'].includes(order.status)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-1.5 text-[11px] font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChefHat size={12} /> Mutfağa İlet
                    </button>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Middle: Detail */}
        <section className="overflow-hidden rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
          <div className="border-b border-geex-border px-5 py-3.5">
            <p className="font-zalando text-sm text-geex-text">Sipariş Detayı</p>
          </div>

          {!selectedOrder ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <CalendarClock size={40} className="mb-3" />
              <p className="text-sm font-medium">Soldaki listeden sipariş seçin</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto p-5" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-geex-text">{getOrderCode(selectedOrder)}</p>
                  <p className="text-sm text-slate-500">{selectedOrder.customer_name || '—'}</p>
                  <p className="text-sm text-slate-400">{selectedOrder.phone || '—'}</p>
                </div>
                <StatusBadge status={selectedOrder.status} />
              </div>

              {/* Delivery info */}
              <div className="rounded-2xl border border-geex-border p-3.5 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Teslimat Bilgisi</p>
                <p className="flex items-center gap-2 text-sm text-geex-text">
                  <span className="text-brand-primary font-semibold">📅</span> {selectedOrder.scheduled_date || '—'}
                </p>
                <p className="flex items-center gap-2 text-sm text-geex-text">
                  <Clock size={13} className="text-brand-primary" /> {fmtTime(selectedOrder.scheduled_time)}
                </p>
                {selectedOrder.address && (
                  <p className="text-sm text-slate-500">{selectedOrder.address}</p>
                )}
              </div>

              {/* Items */}
              <div className="rounded-2xl border border-geex-border p-3.5">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ürünler</p>
                <div className="space-y-2.5">
                  {parseItems(selectedOrder.items).map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="shrink-0 rounded-lg bg-brand-primary/10 px-2 py-0.5 text-xs font-bold text-brand-primary">
                        {item.quantity || 1}x
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-geex-text">{item.name || item.title || 'Ürün'}</p>
                        {item.selectedOptions?.labels?.length > 0 && (
                          <p className="text-[11px] text-slate-400">{item.selectedOptions.labels.join(', ')}</p>
                        )}
                        {item.note && (
                          <p className="text-[11px] italic text-slate-400">Not: {item.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-geex-border pt-2.5 text-right text-sm font-bold text-geex-text">
                  {fmtMoney(selectedOrder.total_price)}
                </div>
              </div>

              {/* Prep estimate */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                <p className="text-xs font-semibold text-amber-700">⏱ Hazırlama Süresi Tahmini</p>
                <p className="mt-1 text-sm font-semibold text-amber-800">
                  ~{calcPrepMins(selectedOrder)} dakika
                </p>
                {calcPrepStart(selectedOrder) && (
                  <p className="text-sm text-amber-700">
                    Hazırlama Başlasın: <span className="font-bold">{calcPrepStart(selectedOrder)}</span>
                  </p>
                )}
              </div>

              {/* Notes */}
              {selectedOrder.note && (
                <div className="rounded-2xl border border-geex-border p-3.5">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sipariş Notu</p>
                  <p className="text-sm text-geex-text">{selectedOrder.note}</p>
                </div>
              )}

              {/* Status update */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Durum Güncelle</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_UPDATE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateStatus(selectedOrder.id, s)}
                      disabled={updatingStatus || selectedOrder.status === s}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        selectedOrder.status === s
                          ? 'bg-brand-primary text-white'
                          : 'border border-geex-border bg-white text-geex-text hover:bg-geex-bg'
                      }`}
                    >
                      {updatingStatus && selectedOrder.status !== s ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        statusCfg(s).label
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right: Kitchen Output */}
        <section className="overflow-hidden rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
          <div className="flex items-center justify-between border-b border-geex-border px-5 py-3.5">
            <p className="font-zalando text-sm text-geex-text">Mutfak Listesi</p>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-geex-border bg-white px-3 py-1.5 text-xs font-semibold text-geex-text transition hover:bg-geex-bg"
            >
              <Printer size={13} /> Yazdır
            </button>
          </div>

          <div ref={printRef} className="print-area overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            <p className="hidden text-base font-bold print:block">
              Randevulu Siparişler — {selectedDate}
            </p>
            {kitchenGroups.length === 0 ? (
              <div className="py-14 text-center">
                <ChefHat size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">Bu tarihte sipariş yok.</p>
              </div>
            ) : (
              kitchenGroups.map(([hourKey, groupOrders]) => {
                const endHour = String(Number(hourKey.slice(0, 2)) + 1).padStart(2, '0');
                return (
                  <div key={hourKey} className="kitchen-group">
                    <div className="mb-2 flex items-center justify-between rounded-xl bg-geex-bg px-3 py-2">
                      <p className="text-xs font-bold text-geex-text">
                        {hourKey} – {endHour}:00 arası
                      </p>
                      <span className="text-[11px] font-semibold text-slate-400">{groupOrders.length} sipariş</span>
                    </div>
                    <div className="space-y-2">
                      {groupOrders.map((o) => {
                        const items = parseItems(o.items);
                        const summary = items.map((i) => `${i.quantity || 1}x ${i.name || i.title || 'Ürün'}`).join(', ');
                        return (
                          <div key={o.id} className="rounded-xl border border-geex-border bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-geex-text">{getOrderCode(o)}</p>
                              <span className="text-[11px] font-semibold text-brand-primary">{fmtTime(o.scheduled_time)}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{summary || '—'}</p>
                            {o.note && (
                              <p className="mt-1 text-[11px] italic text-slate-400">Not: {o.note}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
