import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Clock3, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

const ALARM_SOUND_URL = '/sounds/mixkit-uplifting-bells-notification-938.wav';
const AUTOPLAY_BLOCKED_MESSAGE = 'Tarayıcı otomatik ses çalmayı engelledi. Bir kez ekrana dokunup tekrar deneyin.';

function normalizeOrderStatus(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pending' || normalized === 'confirmed' || normalized === 'preparing' || normalized === 'on_way') return normalized;
  if (normalized === 'beklemede') return 'pending';
  if (normalized === 'confirmed') return 'confirmed';
  if (normalized === 'hazirlaniyor' || normalized.includes('hazır') || normalized.includes('hazir')) return 'preparing';
  if (normalized === 'yola_cikti' || normalized.includes('yol')) return 'on_way';
  return normalized || 'pending';
}

function getOrderCode(order) {
  const explicit = String(order?.order_code || '').trim();
  if (explicit) return explicit;

  const paytr = String(order?.paytr_oid || '').trim();
  if (paytr) return paytr;

  const rawId = String(order?.id || '').trim();
  if (!rawId) return 'KCAL-XXXX';
  return `KCAL-${rawId.slice(0, 8).toUpperCase()}`;
}

function formatOrderTime(iso) {
  if (!iso) return '--:--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWaitingMinutes(createdAt, nowMs) {
  const createdMs = new Date(createdAt || '').getTime();
  if (!Number.isFinite(createdMs)) return 0;
  return Math.max(0, Math.floor((nowMs - createdMs) / 60000));
}

function normalizeOrderItems(order) {
  const source = Array.isArray(order?.items) ? order.items : [];
  return source.map((item, index) => {
    const quantityRaw = Number(item?.quantity ?? 1);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
    const name = String(item?.name || item?.product_name || `Ürün ${index + 1}`).trim() || `Ürün ${index + 1}`;

    return {
      key: `${name}-${index}-${quantity}`,
      quantity,
      name,
    };
  });
}

export default function KitchenDashboard() {
  const location = useLocation();
  const isCompletedTab = location.pathname.startsWith('/kitchen/completed');

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [panelError, setPanelError] = useState('');
  const [panelInfo, setPanelInfo] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [timeCursor, setTimeCursor] = useState(Date.now());
  const [audioHint, setAudioHint] = useState('');

  const notificationAudioRef = useRef(null);
  const isAlarmLoopActiveRef = useRef(false);
  const isAudioUnlockedRef = useRef(false);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setPanelError('');

    try {
      const baseQuery = supabase
        .from('orders')
        .select('*')
        .limit(250);

      const query = isCompletedTab
        ? baseQuery
          .or('status.eq.delivered,status.eq.cancelled')
          .order('created_at', { ascending: false })
        : baseQuery
          .or('status.eq.pending,status.eq.confirmed,status.eq.preparing,status.eq.on_way')
          .order('created_at', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrders([]);
      setPanelError(err?.message || 'Aktif siparişler alınamadı.');
    } finally {
      setOrdersLoading(false);
    }
  }, [isCompletedTab]);

  const pendingOrders = useMemo(() => (
    orders.filter((order) => { const s = normalizeOrderStatus(order?.status); return s === 'pending' || s === 'confirmed'; })
  ), [orders]);

  const visibleOrders = useMemo(() => {
    if (isCompletedTab) return orders;

    return [...orders].sort((a, b) => {
      const statusA = normalizeOrderStatus(a?.status);
      const statusB = normalizeOrderStatus(b?.status);

      if (statusA !== statusB) {
        if (statusA === 'confirmed' || statusA === 'pending') return -1;
        if (statusB === 'confirmed' || statusB === 'pending') return 1;
      }

      return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
    });
  }, [orders, isCompletedTab]);

  const immediateOrders = useMemo(() => visibleOrders.filter(o => {
    const dt = String(o?.delivery_type || o?.delivery_time_type || 'immediate').toLowerCase();
    return dt === 'immediate' || !dt;
  }), [visibleOrders]);

  const scheduledOrders = useMemo(() => visibleOrders.filter(o => {
    const dt = String(o?.delivery_type || o?.delivery_time_type || '').toLowerCase();
    return dt === 'scheduled';
  }), [visibleOrders]);

  const playNotificationSound = useCallback(async (options = {}) => {
    const { resetTime = true } = options;
    const player = notificationAudioRef.current;
    if (!player) return false;

    if (resetTime) {
      player.currentTime = 0;
    }

    try {
      await player.play();
      setAudioHint('');
      return true;
    } catch {
      setAudioHint(AUTOPLAY_BLOCKED_MESSAGE);
      return false;
    }
  }, []);

  const stopAlarmLoop = useCallback(() => {
    const player = notificationAudioRef.current;
    if (!player) return;

    player.pause();
    player.currentTime = 0;
    player.loop = false;
    isAlarmLoopActiveRef.current = false;
  }, []);

  const startAlarmLoop = useCallback(async () => {
    const player = notificationAudioRef.current;
    if (!player) return false;
    if (isAlarmLoopActiveRef.current) return true;

    player.loop = true;
    player.currentTime = 0;
    const ok = await playNotificationSound({ resetTime: false });

    if (ok) {
      isAlarmLoopActiveRef.current = true;
      return true;
    }

    player.loop = false;
    isAlarmLoopActiveRef.current = false;
    return false;
  }, [playNotificationSound]);

  const unlockAudioPlayback = useCallback(async () => {
    const player = notificationAudioRef.current;
    if (!player) return false;

    const previousMuted = player.muted;
    player.muted = true;
    player.currentTime = 0;

    try {
      await player.play();
      player.pause();
      player.currentTime = 0;
      isAudioUnlockedRef.current = true;
      setAudioHint('');
      return true;
    } catch {
      return false;
    } finally {
      player.muted = previousMuted;
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const ordersChannel = supabase
      .channel('kitchen-orders-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      stopAlarmLoop();
      supabase.removeChannel(ordersChannel);
    };
  }, [fetchOrders, stopAlarmLoop, isCompletedTab]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeCursor(Date.now());
    }, 30000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const unlockOnInteraction = () => {
      if (isAudioUnlockedRef.current) return;
      unlockAudioPlayback();
    };

    document.addEventListener('pointerdown', unlockOnInteraction);
    document.addEventListener('keydown', unlockOnInteraction);

    return () => {
      document.removeEventListener('pointerdown', unlockOnInteraction);
      document.removeEventListener('keydown', unlockOnInteraction);
    };
  }, [unlockAudioPlayback]);

  useEffect(() => {
    if (pendingOrders.length > 0) {
      startAlarmLoop();
      return;
    }

    stopAlarmLoop();
  }, [pendingOrders.length, startAlarmLoop, stopAlarmLoop]);

  const updateOrderStatus = async (order, nextStatus) => {
    const orderId = String(order?.id || '');
    if (!orderId) return;

    setStatusUpdatingId(orderId);
    setPanelError('');
    setPanelInfo('');

    try {
      const payload = {
        status: nextStatus,
      };

      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', order.id);

      if (error) throw error;

      setOrders((prev) => prev
        .map((item) => (String(item.id) === orderId ? { ...item, ...payload } : item))
        .filter((item) => {
          const normalized = normalizeOrderStatus(item?.status);
          return normalized === 'pending' || normalized === 'confirmed' || normalized === 'preparing' || normalized === 'on_way';
        }));

      if (nextStatus === 'preparing') {
        setPanelInfo(`${getOrderCode(order)} hazırlanmaya alındı.`);
      }
      if (nextStatus === 'on_way') {
        setPanelInfo(`${getOrderCode(order)} yola çıktı.`);
      }
      if (nextStatus === 'delivered') {
        setPanelInfo(`${getOrderCode(order)} teslim edildi.`);
      }
      if (nextStatus === 'cancelled') {
        setPanelInfo(`${getOrderCode(order)} siparişi iptal edildi.`);
      }
    } catch (err) {
      setPanelError(err?.message || 'Sipariş durumu güncellenemedi.');
    } finally {
      setStatusUpdatingId('');
    }
  };

  const handleCancelPending = async (order) => {
    const ok = window.confirm('İptal edilsin mi?');
    if (!ok) return;
    await updateOrderStatus(order, 'cancelled');
  };

  if (isCompletedTab) {
    return (
      <div className="space-y-5">
        <audio ref={notificationAudioRef} src={ALARM_SOUND_URL} preload="auto" className="hidden" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-zalando text-white">Tamamlananlar</h1>
          <p className="text-sm font-semibold text-white/75">{orders.length} fiş</p>
        </div>

        {orders.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-white/10 bg-kds-card p-6">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/75">
              <AlertTriangle size={16} className="text-white/55" />
              Bu oturumda tamamlanan sipariş bulunmuyor.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {orders.map((order) => {
              const status = normalizeOrderStatus(order?.status);
              const isDelivered = status === 'delivered';
              return (
              <article
                key={`completed-${String(order?.id || '')}-${String(order?.completed_at || '')}`}
                className="bg-kds-card border border-white/10 rounded-3xl p-5 shadow-2xl"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">Sipariş Kodu</p>
                    <p className="mt-1 text-2xl font-zalando text-white">{getOrderCode(order)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    🖨️ Yazdır
                  </button>
                </div>

                <div className={`mb-3 rounded-xl border px-3 py-2 text-sm font-black tracking-wide ${
                  isDelivered
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : 'border-rose-400/40 bg-rose-400/10 text-rose-300'
                }`}>
                  {isDelivered ? 'TESLİM EDİLDİ' : 'İPTAL EDİLDİ'}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-kds-cardDark px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Sipariş Saati</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatOrderTime(order?.created_at)}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {normalizeOrderItems(order).map((item) => (
                    <div key={item.key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white">
                      {item.quantity} x {item.name}
                    </div>
                  ))}
                </div>
              </article>
            );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <audio ref={notificationAudioRef} src={ALARM_SOUND_URL} preload="auto" className="hidden" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-zalando text-white">Aktif Siparişler</h1>
        <p className="text-sm font-semibold text-white/75">{visibleOrders.length} aktif fiş</p>
      </div>

      {audioHint && (
        <div className="rounded-2xl border border-yellow-300/40 bg-yellow-300/10 px-4 py-3 text-sm font-semibold text-yellow-200">
          {audioHint}
        </div>
      )}

      {panelError && (
        <div className="rounded-2xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200">
          {panelError}
        </div>
      )}

      {panelInfo && (
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200">
          {panelInfo}
        </div>
      )}

      {ordersLoading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-kds-card p-6">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/75">
            <Loader2 size={16} className="animate-spin" />
            Sipariş fişleri yükleniyor...
          </p>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-kds-card p-6">
          <p className="text-sm font-semibold text-white/75">Bekleyen, hazırlanan veya yolda sipariş bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Hemen Siparişler ── */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              ⚡ Hemen Siparişler
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-sm font-semibold text-white/70">{immediateOrders.length}</span>
            </h2>
            {immediateOrders.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-kds-card px-4 py-6 text-sm text-white/40">Bekleyen hemen sipariş yok.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {immediateOrders.map((order) => {
            const status = normalizeOrderStatus(order?.status);
            const isPending = status === 'pending' || status === 'confirmed';
            const isPreparing = status === 'preparing';
            const isOnWay = status === 'on_way';
            const rowSaving = statusUpdatingId === String(order?.id);
            const note = String(order?.customer_note || order?.note || order?.order_note || '').trim();
            const waitMinutes = getWaitingMinutes(order?.created_at, timeCursor);
            const waitClass = waitMinutes >= 20 ? 'text-red-400' : waitMinutes >= 10 ? 'text-yellow-300' : 'text-brand-primary';
            const items = normalizeOrderItems(order);

            return (
              <article
                key={String(order?.id || getOrderCode(order))}
                className="bg-kds-card border border-white/10 rounded-3xl p-5 shadow-2xl"
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">Sipariş Kodu</p>
                    <p className="mt-1 text-2xl font-zalando text-white">{getOrderCode(order)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    🖨️ Yazdır
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-kds-cardDark px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Sipariş Saati</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatOrderTime(order?.created_at)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-kds-cardDark px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65 inline-flex items-center gap-1">
                      <Clock3 size={12} /> Bekleme
                    </p>
                    <p className={`mt-1 text-xl font-bold ${waitClass}`}>{waitMinutes} dk</p>
                  </div>
                </div>

                {note && (
                  <div className="mb-3 rounded-xl border border-yellow-300/60 bg-yellow-300 px-3 py-2 text-sm font-semibold text-black">
                    <p className="text-[11px] uppercase tracking-wide">Müşteri Notu</p>
                    <p className="mt-1 text-sm leading-snug">{note}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70">
                      Ürün bilgisi bulunamadı.
                    </div>
                  ) : (
                    items.map((item) => (
                      <div key={item.key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base font-semibold text-white">
                        {item.quantity} x {item.name}
                      </div>
                    ))
                  )}
                </div>

                {isPending ? (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => handleCancelPending(order)}
                      disabled={rowSaving}
                      className="h-16 rounded-2xl border-2 border-red-500/50 text-red-500 hover:bg-red-500/10 text-base font-black tracking-wide transition disabled:opacity-60"
                    >
                      İPTAL ET
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order, 'preparing')}
                      disabled={rowSaving}
                      className="h-16 rounded-2xl bg-brand-primary text-black font-black text-base tracking-wide shadow-[0_16px_30px_rgba(152,205,0,0.35)] transition disabled:opacity-60"
                    >
                      {rowSaving ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 size={18} className="animate-spin" />
                          Güncelleniyor...
                        </span>
                      ) : 'KABUL ET & HAZIRLA'}
                    </button>
                  </div>
                ) : isPreparing ? (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order, 'on_way')}
                    disabled={rowSaving}
                    className="mt-4 h-16 w-full rounded-2xl bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-black font-black text-lg tracking-wide shadow-[0_16px_30px_rgba(249,115,22,0.35)] transition disabled:opacity-60"
                  >
                    {rowSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Güncelleniyor...
                      </span>
                    ) : 'KURYEYE VER (YOLDA)'}
                  </button>
                ) : isOnWay ? (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order, 'delivered')}
                    disabled={rowSaving}
                    className="mt-4 h-16 w-full rounded-2xl bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-white font-black text-lg tracking-wide shadow-[0_16px_30px_rgba(16,185,129,0.35)] transition disabled:opacity-60"
                  >
                    {rowSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Güncelleniyor...
                      </span>
                    ) : 'TESLİM EDİLDİ'}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>

  {/* ── Randevulu Siparişler ── */}
  {!isCompletedTab && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            📅 Randevulu Siparişler
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-sm font-semibold text-white/70">
              {scheduledOrders.length}
            </span>
          </h2>
          {scheduledOrders.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-kds-card px-4 py-6 text-sm text-white/40">
              Bekleyen randevulu sipariş yok.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {scheduledOrders.map((order) => {
                const status = normalizeOrderStatus(order?.status);
                const isPending = status === 'pending' || status === 'confirmed';
                const isPreparing = status === 'preparing';
                const isOnWay = status === 'on_way';
                const rowSaving = statusUpdatingId === String(order?.id);
                const note = String(order?.customer_note || order?.note || order?.order_note || '').trim();
                const waitMinutes = getWaitingMinutes(order?.created_at, timeCursor);
                const waitClass = waitMinutes >= 20 ? 'text-red-400' : waitMinutes >= 10 ? 'text-yellow-300' : 'text-brand-primary';
                const items = normalizeOrderItems(order);
                const scheduledInfo = [
                  order?.scheduled_date,
                  (order?.scheduled_time || order?.scheduled_slot || '').slice(0, 5),
                ].filter(Boolean).join(' ');

                return (
                  <article key={String(order?.id)} className="relative rounded-3xl border border-blue-400/30 bg-kds-card p-5 shadow-2xl">
                    {scheduledInfo && (
                      <div className="absolute -right-2 -top-2 rounded-xl border border-blue-400/60 bg-blue-500 px-2.5 py-1 shadow-lg">
                        <p className="text-[10px] font-black uppercase tracking-wide text-white">
                          📅 {scheduledInfo}
                        </p>
                      </div>
                    )}

                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">Sipariş Kodu</p>
                        <p className="mt-1 font-zalando text-2xl text-white">{getOrderCode(order)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                      >
                        🖨️ Yazdır
                      </button>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/10 bg-kds-cardDark px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">Sipariş Saati</p>
                        <p className="mt-1 text-xl font-bold text-white">{formatOrderTime(order?.created_at)}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-kds-cardDark px-3 py-2">
                        <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/65">
                          <Clock3 size={12} /> Bekleme
                        </p>
                        <p className={`mt-1 text-xl font-bold ${waitClass}`}>{waitMinutes} dk</p>
                      </div>
                    </div>

                    {note && (
                      <div className="mb-3 rounded-xl border border-yellow-300/60 bg-yellow-300 px-3 py-2 text-sm font-semibold text-black">
                        <p className="text-[11px] uppercase tracking-wide">Müşteri Notu</p>
                        <p className="mt-1 text-sm leading-snug">{note}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70">
                          Ürün bilgisi bulunamadı.
                        </div>
                      ) : (
                        items.map((item) => (
                          <div key={item.key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base font-semibold text-white">
                            {item.quantity} x {item.name}
                          </div>
                        ))
                      )}
                    </div>

                    {isPending ? (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleCancelPending(order)}
                          disabled={rowSaving}
                          className="h-16 rounded-2xl border-2 border-red-500/50 text-base font-black tracking-wide text-red-500 transition hover:bg-red-500/10 disabled:opacity-60"
                        >
                          İPTAL ET
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order, 'preparing')}
                          disabled={rowSaving}
                          className="h-16 rounded-2xl bg-brand-primary text-base font-black tracking-wide text-black shadow-[0_16px_30px_rgba(152,205,0,0.35)] transition disabled:opacity-60"
                        >
                          {rowSaving ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 size={18} className="animate-spin" />
                              Güncelleniyor...
                            </span>
                          ) : (
                            'KABUL ET & HAZIRLA'
                          )}
                        </button>
                      </div>
                    ) : isPreparing ? (
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order, 'on_way')}
                        disabled={rowSaving}
                        className="mt-4 h-16 w-full rounded-2xl bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-lg font-black tracking-wide text-black shadow-[0_16px_30px_rgba(249,115,22,0.35)] transition disabled:opacity-60"
                      >
                        {rowSaving ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            Güncelleniyor...
                          </span>
                        ) : (
                          'KURYEYE VER (YOLDA)'
                        )}
                      </button>
                    ) : isOnWay ? (
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order, 'delivered')}
                        disabled={rowSaving}
                        className="mt-4 h-16 w-full rounded-2xl bg-gradient-to-r from-[#0EA5E9] to-[#10B981] text-lg font-black tracking-wide text-white shadow-[0_16px_30px_rgba(16,185,129,0.35)] transition disabled:opacity-60"
                      >
                        {rowSaving ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            Güncelleniyor...
                          </span>
                        ) : (
                          'TESLİM EDİLDİ'
                        )}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
}
