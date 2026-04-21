import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Truck } from 'lucide-react';
import { supabase } from '../supabase';

const TOAST_DURATION_MS = 5000;

function normalizeOrderStatus(statusRaw) {
  const status = String(statusRaw || '').toLowerCase();
  if (!status) return '';
  if (status === 'hazirlaniyor' || status.includes('hazır') || status.includes('hazir')) return 'preparing';
  if (status === 'yola_cikti' || status.includes('yol')) return 'on_way';
  if (status === 'teslim_edildi' || status.includes('teslim')) return 'delivered';
  if (status === 'iptal' || status.includes('iptal') || status.includes('cancel')) return 'cancelled';
  return status;
}

function getOrderReference(order) {
  const orderCode = String(order?.order_code || order?.paytr_oid || '').trim();
  if (orderCode) return orderCode;

  const rawId = String(order?.id || '').trim();
  if (!rawId) return '#---';

  return `#${rawId.slice(0, 8).toUpperCase()}`;
}

function getNotificationMeta(status) {
  if (status === 'preparing') {
    return {
      message: 'Siparişiniz mutfak tarafından onaylandı ve hazırlanmaya başlandı! 👨‍🍳',
      Icon: BellRing,
      className: 'border-[#98CD00]/45 bg-[#98CD00]/15 text-[#D9F99D]',
      iconClassName: 'bg-[#98CD00]/20 text-[#D9F99D]',
    };
  }

  if (status === 'on_way') {
    return {
      message: 'Siparişiniz yola çıktı, kuryemiz size doğru geliyor! 🛵',
      Icon: Truck,
      className: 'border-sky-300/40 bg-sky-500/15 text-sky-100',
      iconClassName: 'bg-sky-400/20 text-sky-100',
    };
  }

  if (status === 'delivered') {
    return {
      message: 'Siparişiniz teslim edildi. Afiyet olsun! 🎉',
      Icon: CheckCircle2,
      className: 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100',
      iconClassName: 'bg-emerald-400/20 text-emerald-100',
    };
  }

  if (status === 'cancelled') {
    return {
      message: 'Siparişiniz iptal edildi. Lütfen destek ile iletişime geçin. ❌',
      Icon: AlertTriangle,
      className: 'border-rose-300/45 bg-rose-500/15 text-rose-100',
      iconClassName: 'bg-rose-400/20 text-rose-100',
    };
  }

  return null;
}

export default function CustomerNotificationListener() {
  const [userId, setUserId] = useState('');
  const [notifications, setNotifications] = useState([]);
  const timeoutMapRef = useRef(new Map());

  const removeNotification = useCallback((id) => {
    const timerId = timeoutMapRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timeoutMapRef.current.delete(id);
    }

    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushNotification = useCallback((item) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const nextItem = { ...item, id };

    setNotifications((prev) => {
      const next = [...prev, nextItem];
      return next.slice(-4);
    });

    const timeoutId = window.setTimeout(() => {
      removeNotification(id);
    }, TOAST_DURATION_MS);
    timeoutMapRef.current.set(id, timeoutId);
  }, [removeNotification]);

  useEffect(() => {
    let mounted = true;

    const hydrateUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setUserId(String(session?.user?.id || '').trim());
    };

    hydrateUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(String(session?.user?.id || '').trim());
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`customer-orders-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const previousStatus = normalizeOrderStatus(payload?.old?.status);
          const nextStatus = normalizeOrderStatus(payload?.new?.status);

          if (!nextStatus || previousStatus === nextStatus) return;

          const meta = getNotificationMeta(nextStatus);
          if (!meta) return;

          pushNotification({
            ...meta,
            orderRef: getOrderReference(payload?.new),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pushNotification, userId]);

  useEffect(() => {
    return () => {
      timeoutMapRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timeoutMapRef.current.clear();
    };
  }, []);

  const visibleNotifications = useMemo(() => notifications, [notifications]);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(92vw,430px)] flex-col gap-3">
      {visibleNotifications.map((item) => (
        <article
          key={item.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_14px_28px_rgba(0,0,0,0.28)] backdrop-blur-sm ${item.className}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconClassName}`}>
              <item.Icon size={18} />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">{item.message}</p>
              <p className="mt-1 text-xs font-medium opacity-90">Sipariş: {item.orderRef}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
