import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Gift,
  Loader2,
  Users,
  X,
  Eye,
  Mail,
  Phone,
  MapPin,
  CalendarClock,
  CircleUserRound,
  ShoppingBag,
  Settings,
} from 'lucide-react';
import { supabase } from '../../supabase';

const COUPON_TABLE_CANDIDATES = ['coupons', 'campaigns'];
const ADDRESS_SELECT_COLUMNS = 'id,title,city,district,full_address,contact_phone,created_at';

const FIELD_LABEL_MAP = {
  id: 'Profil ID',
  user_id: 'Kullanıcı ID',
  full_name: 'Ad Soyad',
  name: 'Ad',
  email: 'E-posta',
  user_email: 'Kullanıcı E-postası',
  phone: 'Telefon',
  phone_number: 'Telefon Numarası',
  mobile: 'Mobil',
  contact_phone: 'İletişim Telefonu',
  macro_balance: 'Macro Bakiye',
  macro_points: 'Harcama Birikimi (₺)',
  total_macros_purchased: 'Toplam Alınan Macro',
  privileged_until: 'Üyelik Bitişi',
  created_at: 'Kayıt Tarihi',
  updated_at: 'Güncelleme Tarihi',
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

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function prettifyFieldLabel(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return 'Alan';
  if (FIELD_LABEL_MAP[normalized]) return FIELD_LABEL_MAP[normalized];
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatFieldValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('tr-TR') : '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';

    const asDate = new Date(trimmed);
    const looksLikeDate = /^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.includes('T');
    if (looksLikeDate && !Number.isNaN(asDate.getTime())) {
      return formatDate(trimmed);
    }

    return trimmed;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getMissingColumnName(errorObj) {
  const text = `${errorObj?.message || ''} ${errorObj?.details || ''}`;
  const patterns = [
    /could not find the ['"]([a-zA-Z0-9_]+)['"]\s+column/i,
    /column\s+"([a-zA-Z0-9_]+)"/i,
    /['"]([a-zA-Z0-9_]+)['"]\s+column/i,
    /\bcolumn\s+([a-zA-Z0-9_]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) continue;
    if (['of', 'in', 'the'].includes(candidate.toLowerCase())) continue;
    return candidate;
  }

  return '';
}

function getWritableErrorMessage(err, fallbackMessage) {
  const message = String(err?.message || fallbackMessage || 'İşlem başarısız');
  if (message.toLowerCase().includes('row-level security policy')) {
    return 'Bu tablo RLS nedeniyle yazmaya kapalı. İlgili tablo için INSERT policy tanımlayın.';
  }
  return message;
}

async function safeInsertWithMissingColumnFallback(table, payload) {
  const next = { ...payload };
  for (let i = 0; i < 25; i += 1) {
    if (Object.keys(next).length === 0) {
      throw new Error(`${table} tablosunda eklenebilir alan kalmadı.`);
    }

    const { error } = await supabase.from(table).insert([next]);
    if (!error) return;

    const missing = getMissingColumnName(error);
    if (missing && Object.prototype.hasOwnProperty.call(next, missing)) {
      delete next[missing];
      continue;
    }

    throw error;
  }

  throw new Error('Kupon ekleme fallback limiti aşıldı.');
}

function normalizeCustomer(row) {
  const id = String(row?.id || '').trim();
  const userId = String(row?.user_id || row?.id || '').trim();
  const emailRaw = String(row?.email || row?.user_email || row?.mail || '').trim();
  const phoneRaw = String(
    row?.phone || row?.phone_number || row?.mobile || row?.contact_phone || ''
  ).trim();
  const displayNameRaw = String(
    row?.full_name || row?.name || row?.display_name || row?.username || ''
  ).trim();

  return {
    id: id || userId,
    userId: userId || id,
    fullName: displayNameRaw || row?.email?.split('@')[0] || `Müşteri ${String(id || userId).slice(0, 8).toUpperCase()}`,
    email: row?.email || row?.user_email || row?.email_address || '',
    email: emailRaw || '—',
    phone: phoneRaw || '—',
    // macro_balance = fiili macro cüzdan; macro_points = TL harcama accumulator (order-earn pool)
    macroBalance: Math.max(0, toSafeNumber(row?.macro_balance, 0)),
    macroAccumulator: Math.max(0, toSafeNumber(row?.macro_points, 0)),
    privilegedUntil: row?.privileged_until || null,
    createdAt: row?.created_at || null,
    profile: row,
  };
}

function getRemainingProfileFields(profile = {}) {
  const excluded = new Set([
    'id',
    'user_id',
    'full_name',
    'name',
    'display_name',
    'username',
    'email',
    'user_email',
    'mail',
    'phone',
    'phone_number',
    'mobile',
    'contact_phone',
    'macro_balance',
    'macro_points',
    'total_macros_purchased',
    'privileged_until',
    'created_at',
    'updated_at',
  ]);

  return Object.entries(profile)
    .filter(([key, value]) => {
      if (excluded.has(key)) return false;
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && !value.trim()) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b, 'tr'));
}

async function fetchAddressesForCustomer(customer) {
  const candidateIds = Array.from(
    new Set([
      String(customer?.userId || '').trim(),
      String(customer?.id || '').trim(),
    ].filter(Boolean))
  );

  let firstError = null;
  const combinedRows = [];
  const seenIds = new Set();

  for (const targetUserId of candidateIds) {
    let response = await supabase
      .from('addresses')
      .select(ADDRESS_SELECT_COLUMNS)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (response.error) {
      const lower = `${response.error?.message || ''} ${response.error?.details || ''}`.toLowerCase();
      const createdAtMissing = lower.includes('created_at') && lower.includes('column');
      if (createdAtMissing) {
        response = await supabase
          .from('addresses')
          .select(ADDRESS_SELECT_COLUMNS)
          .eq('user_id', targetUserId)
          .order('id', { ascending: false });
      }
    }

    if (response.error) {
      if (!firstError) firstError = response.error;
      continue;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    rows.forEach((row) => {
      const rowId = String(row?.id || '').trim();
      if (rowId && seenIds.has(rowId)) return;
      if (rowId) seenIds.add(rowId);
      combinedRows.push(row);
    });
  }

  if (combinedRows.length > 0) {
    return combinedRows.sort((a, b) => (
      new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()
    ));
  }

  if (firstError) throw firstError;
  return [];
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponSaving, setCouponSaving] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailAddresses, setDetailAddresses] = useState([]);
  const [detailOrders, setDetailOrders] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Makro ekle modal

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let response = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (response.error) {
        const lower = `${response.error?.message || ''} ${response.error?.details || ''}`.toLowerCase();
        const createdAtMissing = lower.includes('created_at') && lower.includes('column');
        if (createdAtMissing) {
          response = await supabase
            .from('profiles')
            .select('*')
            .order('id', { ascending: false });
        }
      }

      if (response.error) throw response.error;

      const rows = Array.isArray(response.data) ? response.data : [];
      const normalized = rows
        .map(normalizeCustomer)
        .filter((item) => item.id)
        .sort((a, b) => {
          const dateDiff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          if (Number.isFinite(dateDiff) && dateDiff !== 0) return dateDiff;
          return a.fullName.localeCompare(b.fullName, 'tr');
        });

      setCustomers(normalized);
    } catch (err) {
      setCustomers([]);
      setError(err?.message || 'Müşteri listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const stats = useMemo(() => {
    const totalBalance = customers.reduce((sum, item) => sum + toSafeNumber(item.macroBalance, 0), 0);
    return {
      customerCount: customers.length,
      totalBalance,
    };
  }, [customers]);

  const remainingProfileFields = useMemo(() => {
    if (!detailCustomer?.profile) return [];
    return getRemainingProfileFields(detailCustomer.profile);
  }, [detailCustomer]);

  const openDetailModal = async (customer) => {
    setDetailCustomer(customer);
    setDetailAddresses([]);
    setDetailOrders([]);
    setDetailError('');
    setDetailLoading(true);
    setDetailModalOpen(true);

    try {
      const userId = customer.userId || customer.id;
      const [addressRows, ordersResp] = await Promise.all([
        fetchAddressesForCustomer(customer),
        supabase
          .from('orders')
          .select('id, created_at, total_amount, status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      setDetailAddresses(addressRows);
      setDetailOrders(ordersResp.data || []);
    } catch (err) {
      setDetailError(err?.message || 'Müşteri detayları alınamadı.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    if (detailLoading) return;
    setDetailModalOpen(false);
    setDetailCustomer(null);
    setDetailAddresses([]);
    setDetailOrders([]);
    setDetailError('');
  };

  const ORDER_STATUS = {
    pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor',
    on_way: 'Yolda', delivered: 'Teslim Edildi', cancelled: 'İptal',
  };

  const openCouponModal = (customer) => {
    setSelectedCustomer(customer);
    setCouponCode('');
    setCouponModalOpen(true);
    setError('');
    setInfo('');
  };

  const closeCouponModal = () => {
    if (couponSaving) return;
    setCouponModalOpen(false);
    setSelectedCustomer(null);
    setCouponCode('');
  };

  const handleAssignCoupon = async () => {
    if (!selectedCustomer?.id) return;

    const safeCode = String(couponCode || '').trim().toUpperCase();
    if (!safeCode) {
      setError('Kupon kodu boş olamaz.');
      return;
    }

    setCouponSaving(true);
    setError('');
    setInfo('');

    const nowIso = new Date().toISOString();
    const basePayload = {
      user_id: selectedCustomer.userId || selectedCustomer.id,
      profile_id: selectedCustomer.id,
      user_email: selectedCustomer.email !== '—' ? selectedCustomer.email : null,
      code: safeCode,
      title: `${safeCode} Özel Kupon`,
      description: `${selectedCustomer.fullName} müşterisi için admin tarafından tanımlandı.`,
      badge: 'Özel',
      discount_type: 'percent',
      discount_value: 10,
      max_discount: 0,
      min_cart_total: 0,
      start_date: null,
      end_date: null,
      order: 999,
      is_active: true,
      status: 'active',
      created_at: nowIso,
      updated_at: nowIso,
      image_url: null,
      color_from: '#98CD00',
      color_via: '#98CD00',
      color_to: '#98CD00',
    };

    let savedTable = '';
    let lastError = null;

    for (const tableName of COUPON_TABLE_CANDIDATES) {
      try {
        await safeInsertWithMissingColumnFallback(tableName, basePayload);
        savedTable = tableName;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!savedTable) {
      setCouponSaving(false);
      setError(getWritableErrorMessage(lastError, 'Kupon tanımlanamadı.'));
      return;
    }

    setCouponSaving(false);
    setCouponModalOpen(false);
    setInfo(`${selectedCustomer.fullName} için ${safeCode} kodu "${savedTable}" tablosuna kaydedildi.`);
    setSelectedCustomer(null);
    setCouponCode('');
  };

  return (
    <div className="space-y-6 text-geex-text">
      <header className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-0 text-2xl font-zalando text-geex-text">Müşteriler (CRM)</h1>
            <p className="mt-1 text-sm text-slate-500">
              Profilleri görüntüleyin, iletişim ve adres detaylarını inceleyin, kişiye özel kupon tanımlayın.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchCustomers}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold text-geex-text transition hover:bg-geex-bg disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            Yenile
          </button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
          <p className="text-sm font-semibold text-slate-500">Toplam Müşteri</p>
          <p className="mt-2 text-3xl font-zalando text-geex-text">{stats.customerCount.toLocaleString('tr-TR')}</p>
        </article>
        <article className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
          <p className="text-sm font-semibold text-slate-500">Toplam Macro Bakiye</p>
          <p className="mt-2 text-3xl font-zalando text-geex-text">{stats.totalBalance.toLocaleString('tr-TR')}</p>
        </article>
      </div>

      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}
      {info && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</p>
      )}

      <div className="overflow-x-auto rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-geex-border text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-4 font-semibold">Ad Soyad</th>
              <th className="px-5 py-4 font-semibold">E-posta</th>
              <th className="px-5 py-4 font-semibold">Macro Bakiye</th>
              <th className="px-5 py-4 font-semibold">Kayıt Tarihi</th>
              <th className="px-5 py-4 text-right font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={5}>
                  Müşteriler yükleniyor...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={5}>
                  Listelenecek müşteri bulunamadı.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-b border-geex-border last:border-b-0">
                  <td className="px-5 py-4 font-medium text-geex-text">{customer.fullName}
                      {customer.email && <p className="text-xs text-slate-400">{customer.email}</p>}</td>
                  <td className="px-5 py-4 text-geex-text">{customer.email}</td>
                  <td className="px-5 py-4 text-geex-text">{customer.macroBalance.toLocaleString('tr-TR')}</td>
                  <td className="px-5 py-4 text-slate-500">{formatDate(customer.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDetailModal(customer)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-geex-border bg-white px-3 text-xs font-semibold text-geex-text transition hover:bg-geex-bg"
                      >
                        <Eye size={12} />
                        İncele / Detay
                      </button>
                      <button
                        type="button"
                        onClick={() => openCouponModal(customer)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-primary px-3 text-xs font-semibold text-brand-white shadow-[0_10px_20px_rgba(152,205,0,0.25)]"
                      >
                        <Gift size={12} />
                        Kupon Tanımla
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailModalOpen && detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/35">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-geex-border bg-geex-card p-6 shadow-geex">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-zalando text-geex-text">Müşteri Detayı</p>
                <p className="mt-1 text-sm text-slate-500">
                  {detailCustomer.fullName} • {detailCustomer.email}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-geex-border bg-white text-geex-text"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <Link
                to="/boss/macro"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-geex-border bg-geex-bg px-4 text-sm font-semibold text-geex-text hover:bg-white"
                title="Macro bakiyeyi yönet"
              >
                <Settings size={14} />
                BossMacro'da Yönet
              </Link>
              <button
                type="button"
                onClick={() => openCouponModal(detailCustomer)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-brand-white shadow-[0_10px_20px_rgba(152,205,0,0.25)]"
              >
                <Gift size={14} />
                Kupon Tanımla
              </button>
            </div>

            <section className="mb-4 rounded-2xl border border-geex-border bg-geex-bg p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">İletişim Bilgileri</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-geex-border bg-geex-card p-3">
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <CircleUserRound size={12} /> Ad Soyad
                  </p>
                  <p className="mb-0 text-sm font-semibold text-geex-text">{detailCustomer.fullName}</p>
                </article>
                <article className="rounded-2xl border border-geex-border bg-geex-card p-3">
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Mail size={12} /> E-posta
                  </p>
                  <p className="mb-0 break-all text-sm font-semibold text-geex-text">{detailCustomer.email}</p>
                </article>
                <article className="rounded-2xl border border-geex-border bg-geex-card p-3 sm:col-span-2">
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Phone size={12} /> Telefon
                  </p>
                  <p className="mb-0 text-sm font-semibold text-geex-text">{detailCustomer.phone}</p>
                </article>
              </div>
            </section>

            <section className="mb-4 rounded-2xl border border-geex-border bg-geex-bg p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Hesap Özeti</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-geex-border bg-geex-card p-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">Macro Bakiye</p>
                  <p className="mb-0 text-2xl font-zalando text-geex-text">{detailCustomer.macroBalance.toLocaleString('tr-TR')}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Harcama birikimi: ₺{detailCustomer.macroAccumulator.toLocaleString('tr-TR')}
                  </p>
                </article>
                <article className="rounded-2xl border border-geex-border bg-geex-card p-3">
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <CalendarClock size={12} /> Kayıt Tarihi
                  </p>
                  <p className="mb-0 text-sm font-semibold text-geex-text">{formatDate(detailCustomer.createdAt)}</p>
                  {detailCustomer.privilegedUntil && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                      ⭐ Üyelik: {formatDate(detailCustomer.privilegedUntil)}
                    </p>
                  )}
                </article>
              </div>
            </section>

            <section className="mb-4 rounded-2xl border border-geex-border bg-geex-bg p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Son Siparişler</p>
              {detailLoading ? (
                <p className="text-sm text-slate-500 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Yükleniyor…</p>
              ) : detailOrders.length === 0 ? (
                <p className="text-sm text-slate-500">Henüz sipariş yok.</p>
              ) : (
                <div className="space-y-2">
                  {detailOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between rounded-2xl border border-geex-border bg-geex-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={13} className="text-slate-400" />
                        <span className="text-sm font-semibold text-geex-text">#{o.id}</span>
                        <span className="text-xs text-slate-400">{ORDER_STATUS[o.status] || o.status}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-geex-text">₺{Number(o.total_amount || 0).toLocaleString('tr-TR')}</p>
                        <p className="text-[11px] text-slate-400">{new Date(o.created_at).toLocaleDateString('tr-TR')}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400 pt-1">
                    Toplam harcama: ₺{detailOrders.reduce((s, o) => s + (o.total_amount || 0), 0).toLocaleString('tr-TR')} (son 5 sipariş)
                  </p>
                </div>
              )}
            </section>

            <section className="mb-4 rounded-2xl border border-geex-border bg-geex-bg p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Kayıtlı Adresler</p>

              {detailLoading ? (
                <p className="mb-0 inline-flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  Adresler yükleniyor...
                </p>
              ) : detailError ? (
                <p className="mb-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</p>
              ) : detailAddresses.length === 0 ? (
                <p className="mb-0 text-sm text-slate-500">Kayıtlı adres bulunamadı.</p>
              ) : (
                <div className="space-y-2">
                  {detailAddresses.map((address) => (
                    <article
                      key={address.id}
                      className="rounded-2xl border border-geex-border bg-geex-card p-3"
                    >
                      <p className="mb-1 text-sm font-semibold text-geex-text">{address?.title || 'Adres'}</p>
                      <p className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={12} />
                        {(address?.city || '—')} / {(address?.district || '—')}
                      </p>
                      <p className="mb-1 text-xs text-geex-text">{address?.full_address || 'Adres detayı yok'}</p>
                      {address?.contact_phone && (
                        <p className="mb-0 text-xs text-slate-500">İletişim: {address.contact_phone}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-geex-border bg-geex-bg p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Ek Profil Alanları</p>
              {remainingProfileFields.length === 0 ? (
                <p className="mb-0 text-sm text-slate-500">Listelenecek ek alan bulunamadı.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {remainingProfileFields.map(([key, value]) => (
                    <article key={`profile-field-${key}`} className="rounded-2xl border border-geex-border bg-geex-card p-3">
                      <p className="mb-1 text-xs font-semibold text-slate-500">{prettifyFieldLabel(key)}</p>
                      <p className="mb-0 break-words text-xs font-semibold text-geex-text">{formatFieldValue(value)}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {couponModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-zalando text-geex-text">Kupon Tanımla</p>
                <p className="mt-1 text-xs text-slate-500">{selectedCustomer.fullName} • {selectedCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={closeCouponModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-geex-border bg-white text-geex-text"
                aria-label="Kapat"
              >
                <X size={14} />
              </button>
            </div>

            <label className="block text-xs font-semibold text-slate-500">
              Kupon Kodu
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Örn: ILTER50"
                className="mt-1.5 h-11 w-full rounded-xl border border-geex-border bg-white px-3 text-sm font-medium text-geex-text"
              />
            </label>

            <p className="mt-2 text-xs text-slate-500">
              Kayıt, sırasıyla `coupons` ve `campaigns` tablosuna `user_id` eşleştirmesi ile denenir.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAssignCoupon}
                disabled={couponSaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-brand-white shadow-[0_10px_20px_rgba(152,205,0,0.25)] disabled:opacity-60"
              >
                {couponSaving ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
