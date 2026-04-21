/**
 * BossDashboard.jsx — Real Supabase data dashboard
 * Stats: total orders, today's revenue, new customers, pending orders
 * Chart: 7-day order trend
 * Activities: last 5 orders
 */
import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Loader2,
  ShoppingBag,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../supabase';

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('tr-TR');
}

function fmtCurrency(n) {
  if (n == null) return '—';
  return `₺${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function BossDashboard() {
  const [stats, setStats]       = useState(null);
  const [trend, setTrend]       = useState([]);
  const [activities, setActs]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayIso = todayStart.toISOString();

        // 7 days ago for trend
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const sevenDaysIso = sevenDaysAgo.toISOString();

        const [
          { count: totalOrders, error: e1 },
          { data: todayOrders, error: e2 },
          { count: totalCustomers, error: e3 },
          { count: pendingCount, error: e4 },
          { data: trendData, error: e5 },
          { data: lastOrders, error: e6 },
        ] = await Promise.all([
          // Total orders count
          supabase.from('orders').select('*', { count: 'exact', head: true }),
          // Today's revenue (sum of total_amount, exclude cancelled)
          supabase.from('orders').select('total_amount').gte('created_at', todayIso).neq('status', 'cancelled'),
          // Total profiles (customers)
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          // Pending orders
          supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          // Last 7 days orders for trend
          supabase.from('orders').select('created_at').gte('created_at', sevenDaysIso).order('created_at', { ascending: true }),
          // Last 5 orders for activity
          supabase.from('orders').select('id, created_at, total_amount, status').order('created_at', { ascending: false }).limit(5),
        ]);

        const errors = [e1, e2, e3, e4, e5, e6].filter(Boolean);
        if (errors.length > 0 && mounted) {
          setErr(errors[0].message);
        }

        // Today's ciro
        const todayCiro = (todayOrders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

        if (mounted) {
          setStats({
            totalOrders: totalOrders || 0,
            todayCiro,
            totalCustomers: totalCustomers || 0,
            pendingCount: pendingCount || 0,
          });

          // Build 7-day bar chart: group by day
          const dayMap = {};
          for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            dayMap[d.toISOString().slice(0, 10)] = 0;
          }
          (trendData || []).forEach(o => {
            const day = o.created_at.slice(0, 10);
            if (dayMap[day] !== undefined) dayMap[day]++;
          });
          const dayValues = Object.values(dayMap);
          const maxVal = Math.max(...dayValues, 1);
          setTrend(dayValues.map(v => Math.round((v / maxVal) * 100)));

          setActs(lastOrders || []);
        }
      } catch (ex) {
        if (mounted) setErr(ex.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const STATUS_LABELS = {
    pending: 'Bekliyor',
    confirmed: 'Onaylandı',
    preparing: 'Hazırlanıyor',
    on_way: 'Yolda',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    );
  }

  const STAT_CARDS = stats ? [
    {
      key: 'orders',
      title: 'Toplam Sipariş',
      value: fmt(stats.totalOrders),
      Icon: ShoppingBag,
      positive: true,
    },
    {
      key: 'customers',
      title: 'Toplam Müşteri',
      value: fmt(stats.totalCustomers),
      Icon: UserPlus,
      positive: true,
    },
    {
      key: 'revenue',
      title: 'Bugünkü Ciro',
      value: fmtCurrency(stats.todayCiro),
      Icon: CircleDollarSign,
      positive: stats.todayCiro > 0,
    },
    {
      key: 'pending',
      title: 'Bekleyen Sipariş',
      value: fmt(stats.pendingCount),
      Icon: Wallet,
      positive: stats.pendingCount === 0,
    },
  ] : [];

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((item) => {
          const TrendIcon = item.positive ? ArrowUpRight : ArrowDownRight;
          return (
            <article
              key={item.key}
              className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{item.title}</p>
                  <p className="mt-2 text-3xl font-zalando text-geex-text">{item.value}</p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-geex-bg text-geex-text">
                  <item.Icon size={18} />
                </span>
              </div>
              <div className="mt-5 inline-flex items-center gap-1 rounded-full bg-geex-bg px-2.5 py-1 text-xs font-semibold text-geex-text">
                <TrendIcon size={14} className={item.positive ? 'text-emerald-500' : 'text-rose-500'} />
                {item.positive ? 'İyi' : 'Dikkat'}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-zalando text-geex-text">Sipariş Trendi</h2>
            <span className="rounded-full bg-geex-bg px-3 py-1 text-xs font-semibold text-slate-500">Son 7 Gün</span>
          </div>

          <div className="flex h-56 items-end gap-2 rounded-2xl bg-geex-bg p-4">
            {(trend.length > 0 ? trend : Array(7).fill(10)).map((height, index) => (
              <div
                key={`bar-${index}`}
                className="flex-1 rounded-xl bg-brand-primary/90 transition-all"
                style={{ height: `${Math.max(height, 4)}%` }}
                title={`${height}%`}
              />
            ))}
          </div>

          <div className="mt-2 flex justify-between px-4 text-[10px] text-slate-400">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              return <span key={i}>{d.toLocaleDateString('tr-TR', { weekday: 'short' })}</span>;
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
          <h2 className="text-lg font-zalando text-geex-text">Son Siparişler</h2>
          <div className="mt-4 space-y-3">
            {activities.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">Henüz sipariş yok.</p>
            ) : activities.map((o) => (
              <div key={o.id} className="rounded-2xl bg-geex-bg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-geex-text">#{o.id}</p>
                  <span className="text-xs font-semibold text-slate-500">{fmtCurrency(o.total_amount)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">{STATUS_LABELS[o.status] || o.status}</p>
                  <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
