import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChefHat, Truck } from 'lucide-react';
import { supabase } from '../supabase';

const TOAST_DURATION_MS = 5000;

function normalizeOrderStatus(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  if (!status) return '';
  if (status === 'hazirlaniyor' || status.includes('hazır') || status.includes('hazir')) return 'preparing';
  if (status === 'yola_cikti' || status.includes('yol')) return 'on_way';
  if (status === 'teslim_edildi' || status.includes('teslim')) return 'delivered';
  if (status === 'iptal' || status.includes('iptal') || status.includes('cancel')) return 'cancelled';
  return status;
}

function getOrderRef(order) {
  const orderCode = String(order?.order_code || order?.paytr_oid || '').trim();
  if (orderCode) return orderCode;

  const rawId = String(order?.id || '').trim();
  if (!rawId) return '#---';
  return `#${rawId.slice(0, 8).toUpperCase()}`;
}

function getNotificationConfig(status) {
  if (status === 'preparing') {
    return {
      message: 'Siparişiniz onaylandı, hazırlanmaya başlandı! 👨‍🍳',
      Icon: ChefHat,
      ringClassName: 'ring-[#FACC15]/35',
      iconClassName: 'bg-[#FEF9C3] text-[#CA8A04]',
    };
  }

  if (status === 'on_way') {
    return {
      message: 'Siparişiniz yola çıktı, kuryemiz geliyor! 🛵',
      Icon: Truck,
      ringClassName: 'ring-sky-300/35',
      iconClassName: 'bg-sky-100 text-sky-600',
    };
  }

  if (status === 'delivered') {
    return {
      message: 'Afiyet olsun! Siparişiniz teslim edildi. 🎉',
      Icon: CheckCircle2,
      ringClassName: 'ring-emerald-300/35',
      iconClassName: 'bg-emerald-100 text-emerald-600',
    };
  }

  if (status === 'cancelled') {
    return {
      message: 'Siparişiniz iptal edildi. Destek hattına ulaşabilirsiniz. ❌',
      Icon: AlertTriangle,
      ringClassName: 'ring-rose-300/35',
      iconClassName: 'bg-rose-100 text-rose-600',
    };
  }

  return null;
}

export default function NotificationListener() {
  const [userId, setUserId] = useState('');
  const [notifications, setNotifications] = useState([]);
  const timeoutMapRef = useRef(new Map());

  const removeNotification = useCallback((id) => {
    const timeoutId = timeoutMapRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(id);
    }

    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushNotification = useCallback((notification) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const nextNotification = { ...notification, id };

    setNotifications((prev) => [...prev, nextNotification].slice(-4));

    const timeoutId = window.setTimeout(() => {
      removeNotification(id);
    }, TOAST_DURATION_MS);
    timeoutMapRef.current.set(id, timeoutId);
  }, [removeNotification]);

  useEffect(() => {
    let isMounted = true;

    const hydrateUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (error) {
        setUserId('');
        return;
      }

      setUserId(String(data?.user?.id || '').trim());
    };

    hydrateUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      hydrateUser();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`customer-notification-orders-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldStatus = normalizeOrderStatus(payload?.old?.status);
          const nextStatus = normalizeOrderStatus(payload?.new?.status);
          if (!nextStatus || oldStatus === nextStatus) return;

          const config = getNotificationConfig(nextStatus);
          if (!config) return;

          pushNotification({
            ...config,
            orderRef: getOrderRef(payload?.new),
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
      timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current.clear();
    };
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[9999] flex w-[min(92vw,430px)] flex-col gap-3">
      {notifications.map((item) => (
        <article
          key={item.id}
          className={`pointer-events-auto rounded-2xl bg-white/95 px-4 py-3 text-brand-dark shadow-[0_16px_34px_rgba(15,23,42,0.16)] ring-1 ${item.ringClassName}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconClassName}`}>
              <item.Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">{item.message}</p>
              <p className="mt-1 text-xs font-medium text-brand-dark/60">Sipariş: {item.orderRef}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
