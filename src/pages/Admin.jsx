import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  CheckCircle2,
  CalendarClock,
  ClipboardList,
  Clock3,
  ArrowUp,
  ArrowDown,
  Loader2,
  Megaphone,
  MessageSquare,
  Eye,
  EyeOff,
  Package,
  Plus,
  RotateCw,
  Save,
  Settings,
  Tags,
  GripVertical,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Users,
  Star,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Volume2,
  Wallet,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '../supabase';
import OptionGroups from './admin/OptionGroups';

const IMAGE_BUCKET = 'images';
const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const LOCAL_PRODUCTS_SYNC_KEY = 'kcal_local_products_sync_version';
const ALARM_SOUND_URL = '/sounds/mixkit-uplifting-bells-notification-938.wav';
const ORDER_SYNC_POLL_MS = 12000;
const AUTOPLAY_BLOCKED_MESSAGE = 'Tarayıcı otomatik ses çalmayı engelledi. Bir kez sayfaya tıklayıp tekrar deneyin.';
const RECEIPT_BUSINESS_NAME = 'KCAL';
const DAY_MS = 24 * 60 * 60 * 1000;
const FINANCE_PERIOD_OPTIONS = [
  { key: 'today', label: 'Bugün' },
  { key: 'yesterday', label: 'Dün' },
  { key: 'this_week', label: 'Bu Hafta' },
  { key: 'last_week', label: 'Geçen Hafta' },
  { key: 'this_month', label: 'Bu Ay' },
  { key: 'last_month', label: 'Geçen Ay' },
  { key: 'custom', label: 'Özel Aralık' },
];
const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const STATUS_LABELS = {
  pending_payment: 'Ödeme Bekliyor',
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  on_way: 'Yolda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
};
const PRODUCT_OPTION_GROUP_TABLE_CANDIDATES = ['product_option_groups', 'product_option_group'];

function formatCurrency(value) {
  const amount = Number(value || 0);
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toMoneyText(value) {
  const amount = Number(value || 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe.toFixed(2)} TL`;
}

function toPositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 ? parsed : fallback;
}

function calculateReceiptMacroTotals(items) {
  const source = Array.isArray(items) ? items : [];

  return source.reduce((totals, item) => {
    const quantityRaw = toPositiveNumber(item?.quantity, 1);
    const quantity = quantityRaw > 0 ? quantityRaw : 1;
    const calories = toPositiveNumber(item?.cal ?? item?.kcal ?? item?.calories, 0);
    const protein = toPositiveNumber(item?.protein, 0);
    const carbs = toPositiveNumber(item?.carbs, 0);
    const fats = toPositiveNumber(item?.fats ?? item?.fat, 0);

    totals.calories += calories * quantity;
    totals.protein += protein * quantity;
    totals.carbs += carbs * quantity;
    totals.fats += fats * quantity;
    return totals;
  }, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
}

function buildReceiptLine(name, quantity, amount) {
  const leftRaw = `${quantity} x ${name || 'Ürün'}`.replace(/\s+/g, ' ').trim();
  const right = toMoneyText(amount);
  const maxChars = 34;
  const leftMax = Math.max(8, maxChars - right.length - 2);
  const left = leftRaw.length > leftMax ? `${leftRaw.slice(0, leftMax - 1)}…` : leftRaw;
  const dots = '.'.repeat(Math.max(2, maxChars - left.length - right.length));
  return `${left}${dots}${right}`;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date, days) {
  return new Date(date.getTime() + (days * DAY_MS));
}

function getWeekStart(date) {
  const start = getDayStart(date);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  return start;
}

function getPresetRange(periodKey, nowDate = new Date()) {
  const todayStart = getDayStart(nowDate);
  const tomorrowStart = addDays(todayStart, 1);

  if (periodKey === 'today') {
    return { key: periodKey, label: 'Bugün', start: todayStart, endExclusive: tomorrowStart };
  }
  if (periodKey === 'yesterday') {
    const yesterdayStart = addDays(todayStart, -1);
    return { key: periodKey, label: 'Dün', start: yesterdayStart, endExclusive: todayStart };
  }
  if (periodKey === 'this_week') {
    const thisWeekStart = getWeekStart(nowDate);
    return { key: periodKey, label: 'Bu Hafta', start: thisWeekStart, endExclusive: tomorrowStart };
  }
  if (periodKey === 'last_week') {
    const thisWeekStart = getWeekStart(nowDate);
    const lastWeekStart = addDays(thisWeekStart, -7);
    return { key: periodKey, label: 'Geçen Hafta', start: lastWeekStart, endExclusive: thisWeekStart };
  }
  if (periodKey === 'this_month') {
    const thisMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
    return { key: periodKey, label: 'Bu Ay', start: thisMonthStart, endExclusive: tomorrowStart };
  }
  if (periodKey === 'last_month') {
    const thisMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
    const lastMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1, 0, 0, 0, 0);
    return { key: periodKey, label: 'Geçen Ay', start: lastMonthStart, endExclusive: thisMonthStart };
  }

  return { key: 'today', label: 'Bugün', start: todayStart, endExclusive: tomorrowStart };
}

function parseDateInputValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isDateInRange(date, start, endExclusive) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (start && date < start) return false;
  if (endExclusive && date >= endExclusive) return false;
  return true;
}

function calculateGrowthPercent(currentValue, previousValue) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function summarizeOrdersForRange(orders, start, endExclusive) {
  const scoped = orders.filter((item) => isDateInRange(item.analyticsDate, start, endExclusive));
  const revenue = scoped.reduce((sum, item) => sum + Number(item.analyticsRevenue || 0), 0);
  const orderCount = scoped.length;
  const averageBasket = orderCount > 0 ? revenue / orderCount : 0;
  return {
    orders: scoped,
    revenue,
    orderCount,
    averageBasket,
  };
}

function normalizeOrderStatus(statusRaw) {
  const status = String(statusRaw || '').toLowerCase();
  if (!status) return 'pending';
  if (status === 'hazirlaniyor') return 'preparing';
  if (status === 'yola_cikti') return 'on_way';
  if (status === 'teslim_edildi') return 'delivered';
  if (status === 'iptal') return 'cancelled';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'canceled') return 'cancelled';
  if (status === 'beklemede') return 'pending';
  if (status.includes('hazır')) return 'preparing';
  if (status.includes('yol')) return 'on_way';
  if (status.includes('teslim')) return 'delivered';
  if (status.includes('iptal') || status.includes('cancel')) return 'cancelled';
  if (status === 'pending_payment') return 'pending_payment';
  if (['pending', 'confirmed', 'preparing', 'on_way', 'delivered', 'cancelled'].includes(status)) return status;
  return 'pending';
}

function normalizeDeliveryTimeType(value) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return 'immediate';
  if (normalized === 'scheduled') return 'scheduled';
  if (normalized === 'immediate') return 'immediate';
  if (normalized.includes('randevu') || normalized.includes('ileri') || normalized.includes('schedule')) return 'scheduled';
  return 'immediate';
}

function parseTimeFromSlot(slotValue) {
  const raw = String(slotValue || '').trim();
  if (!raw) return null;

  const match = raw.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function parseScheduledDateTime(order) {
  const dateRaw = String(order?.scheduled_date || '').trim();
  if (!dateRaw) return null;

  const slotTime = parseTimeFromSlot(order?.scheduled_time || order?.scheduled_slot);
  if (!slotTime) return null;

  const dateMatch = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const next = new Date(year, month, day, slotTime.hour, slotTime.minute, 0, 0);
  if (Number.isNaN(next.getTime())) return null;

  return next;
}

function getMinutesToScheduled(order, nowDate) {
  const scheduledAt = parseScheduledDateTime(order);
  if (!scheduledAt) return null;
  return Math.floor((scheduledAt.getTime() - nowDate.getTime()) / 60000);
}

function isScheduledApproaching(order, nowDate) {
  const minutesLeft = getMinutesToScheduled(order, nowDate);
  if (minutesLeft === null) return false;
  return minutesLeft <= 60;
}

function getStatusClass(status) {
  if (status === 'pending_payment') return 'bg-amber-100 text-amber-700';
  if (status === 'preparing') return 'bg-brand-secondary text-brand-dark';
  if (status === 'on_way') return 'bg-brand-secondary text-brand-dark';
  if (status === 'delivered') return 'bg-brand-secondary text-brand-dark';
  if (status === 'cancelled') return 'bg-brand-secondary text-brand-dark';
  return 'bg-brand-bg text-brand-dark';
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
  const lower = message.toLowerCase();

  if (lower.includes('row-level security policy')) {
    return 'Bu tablo RLS nedeniyle yazmaya kapalı. Supabase SQL Editor üzerinden ilgili tabloya INSERT/UPDATE policy ekleyin.';
  }

  return message;
}

function getDetailedErrorMessage(err, fallbackMessage) {
  const base = getWritableErrorMessage(err, fallbackMessage);
  const details = [err?.details, err?.hint]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' | ');
  return details ? `${base} (${details})` : base;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'active'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'inactive'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeTextForCompare(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function emitProductsSyncSignal() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_PRODUCTS_SYNC_KEY, String(Date.now()));
    window.dispatchEvent(new CustomEvent('kcal-products-sync'));
  } catch {
    // no-op
  }
}

async function safeUpdateById(table, id, payload) {
  const next = { ...payload };
  for (let i = 0; i < 25; i += 1) {
    if (Object.keys(next).length === 0) {
      throw new Error(`${table} tablosunda güncellenebilir alan bulunamadı.`);
    }

    const { data, error } = await supabase.from(table).update(next).eq('id', id).select('*');
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return row;
      // RLS select engeli: update başarılı ama satır dönmedi → id ile fallback
      return { id, ...next };
    }

    const missing = getMissingColumnName(error);
    if (missing && Object.prototype.hasOwnProperty.call(next, missing)) {
      delete next[missing];
      continue;
    }
    throw error;
  }
  throw new Error('Güncelleme fallback limiti aşıldı');
}

async function safeInsert(table, payload) {
  const next = { ...payload };
  for (let i = 0; i < 25; i += 1) {
    if (Object.keys(next).length === 0) {
      throw new Error(`${table} tablosunda eklenebilir alan bulunamadı.`);
    }

    const { data, error } = await supabase.from(table).insert([next]).select('*');
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return row;
      throw new Error(`${table} tablosuna kayıt eklendi ama sonuç satırı alınamadı.`);
    }

    const missing = getMissingColumnName(error);
    if (missing && Object.prototype.hasOwnProperty.call(next, missing)) {
      delete next[missing];
      continue;
    }
    throw error;
  }
  throw new Error('Insert fallback limiti aşıldı');
}

async function safeDeleteById(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

function getProductName(product) {
  return product?.name || product?.title || 'Ürün';
}

function getProductDescription(product) {
  return product?.desc || product?.description || '';
}

function getProductImage(product) {
  return (
    product?.img ||
    product?.image ||
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'
  );
}

function getProductOrder(product) {
  const numeric = Number(product?.order ?? product?.sort_order ?? product?.display_order ?? product?.position);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

function compareProductsByOrder(a, b) {
  const orderDiff = getProductOrder(a) - getProductOrder(b);
  if (orderDiff !== 0) return orderDiff;

  const idA = Number(a?.id);
  const idB = Number(b?.id);
  if (Number.isFinite(idA) && Number.isFinite(idB)) return idB - idA;

  return getProductName(a).localeCompare(getProductName(b), 'tr');
}

function getAvailability(product) {
  if (product?.in_stock === false) return false;
  if (product?.is_available === false) return false;
  if (product?.is_active === false) return false;
  return true;
}

function getFavoriteFlag(product) {
  if (product?.is_favorite !== undefined && product?.is_favorite !== null) {
    return normalizeBoolean(product.is_favorite, false);
  }
  return normalizeBoolean(product?.is_featured, false);
}

function getFavoriteOrder(product) {
  const numeric = Number(product?.favorite_order ?? product?.featured_order);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

function compareFavoriteProducts(a, b) {
  const orderDiff = getFavoriteOrder(a) - getFavoriteOrder(b);
  if (orderDiff !== 0) return orderDiff;
  return compareProductsByOrder(a, b);
}

function getCategoryOrder(category) {
  const numeric = Number(category?.order ?? category?.sort_order ?? category?.position);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

function buildStoragePath(folder, fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ext.replace(/[^a-z0-9]/gi, '');
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
}

function extractStoragePathFromPublicUrl(url, bucket = IMAGE_BUCKET) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return '';
    const storagePath = parsed.pathname.slice(markerIndex + marker.length).replace(/^\/+/, '');
    return decodeURIComponent(storagePath);
  } catch {
    return '';
  }
}

function ImageUploadField({ label, value, onUploaded, folder = 'admin' }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Desteklenmeyen format. JPG, PNG, WEBP veya GIF yükleyin.');
      event.target.value = '';
      return;
    }

    const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`Dosya boyutu en fazla ${MAX_IMAGE_SIZE_MB}MB olabilir.`);
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const storagePath = buildStoragePath(folder, file.name);
      const { error: uploadErrorResponse } = await supabase
        .storage
        .from(IMAGE_BUCKET)
        .upload(storagePath, file, { upsert: false, cacheControl: '3600' });

      if (uploadErrorResponse) {
        throw uploadErrorResponse;
      }

      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
      const publicUrl = data?.publicUrl || '';

      if (!publicUrl) {
        throw new Error('Public URL alınamadı.');
      }

      onUploaded(publicUrl);
    } catch (err) {
      const message = String(err?.message || 'Görsel yükleme hatası');
      if (message.toLowerCase().includes('bucket')) {
        setUploadError('Storage bucket bulunamadı. Supabase tarafında images bucket oluşturun.');
      } else {
        setUploadError(message);
      }
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-brand-dark">{label}</p>
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-secondary text-sm cursor-pointer hover:bg-brand-bg">
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? 'Yükleniyor...' : 'Görsel Yükle'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
      </label>

      {uploadError && (
        <p className="text-xs text-brand-dark">{uploadError}</p>
      )}

      {value ? (
        <div className="rounded-xl border border-brand-secondary p-2">
          <img src={value} alt="Yüklenen görsel" className="w-full h-28 object-cover rounded-lg bg-brand-bg" />
          <p className="text-[11px] text-brand-dark mt-1 truncate">{value}</p>
        </div>
      ) : (
        <p className="text-[11px] text-brand-dark">Henüz görsel yüklenmedi.</p>
      )}
    </div>
  );
}

function CategoryRow({ category, indent, onEdit, onDelete, deletingId }) {
  const isDeleting = deletingId === String(category.id);
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-brand-secondary bg-brand-bg px-3 py-2 ${indent ? 'ml-6' : ''}`}>
      {indent && <span className="shrink-0 text-sm text-brand-dark opacity-40">↳</span>}
      <div className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-brand-secondary bg-brand-white">
        {category.image_url ? (
          <>
            <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-brand-dark/50 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-[9px] font-bold text-white">Değiştir</span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg text-brand-dark opacity-25">+</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-brand-dark">{category.name || 'Kategori'}</p>
        <p className="text-[11px] text-brand-dark">
          Sıra: {getCategoryOrder(category) === Number.MAX_SAFE_INTEGER ? '—' : getCategoryOrder(category)}
          {category.discount_type && (
            <span className="ml-2 rounded-full bg-brand-secondary px-1.5 py-0.5 text-[10px] font-bold text-brand-primary">
              {category.discount_type === 'percent' ? `%${category.discount_value}` : `₺${category.discount_value}`} indirim
            </span>
          )}
        </p>
      </div>
      <button
        onClick={() => onEdit(category)}
        className="inline-flex items-center gap-1 rounded-lg bg-brand-white border border-brand-secondary px-3 py-1.5 text-xs font-bold text-brand-dark"
      >
        Düzenle
      </button>
      <button
        onClick={() => onDelete(category)}
        disabled={isDeleting}
        className="inline-flex items-center gap-1 rounded-lg bg-brand-secondary px-3 py-1.5 text-xs font-bold text-brand-dark disabled:opacity-60"
      >
        {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        Sil
      </button>
    </div>
  );
}

export default function Admin({
  initialTab = 'orders',
  forcedTab = '',
  visibleTabs = null,
  hideAdminChrome = false,
  disableNotifications = false,
} = {}) {
  const navigate = useNavigate();

  const availableTabKeys = [
    'orders',
    'products',
    'showcase',
    'campaigns',
    'categories',
    'options',
    'delivery_zones',
    'settings',
    'finance',
    'reviews',
  ];

  const isTabAllowed = (tabKey) => {
    if (!Array.isArray(visibleTabs) || visibleTabs.length === 0) return true;
    return visibleTabs.includes(tabKey);
  };

  const resolveTabKey = (candidate) => {
    const normalized = availableTabKeys.includes(candidate) ? candidate : 'orders';
    if (isTabAllowed(normalized)) return normalized;
    return availableTabKeys.find((item) => isTabAllowed(item)) || 'orders';
  };

  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState(() => resolveTabKey(forcedTab || initialTab));
  const [ordersSubTab, setOrdersSubTab] = useState('incoming');
  const [productCategoryFilter, setProductCategoryFilter] = useState('Tümü');
  const [isFinanceUnlocked, setIsFinanceUnlocked] = useState(true);
  const [financePinInput, setFinancePinInput] = useState('');
  const [financePinError, setFinancePinError] = useState('');
  const [financePeriod, setFinancePeriod] = useState('today');
  const [financeCustomStartDate, setFinanceCustomStartDate] = useState(() => {
    const now = new Date();
    return formatDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [financeCustomEndDate, setFinanceCustomEndDate] = useState(() => formatDateInputValue(new Date()));
  const [financeProductSortBy, setFinanceProductSortBy] = useState('revenue');
  const [timeCursor, setTimeCursor] = useState(Date.now());

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState('');

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productSaving, setProductSaving] = useState(false);
  const [productRowSavingId, setProductRowSavingId] = useState('');
  const [productCrosssellSavingId, setProductCrosssellSavingId] = useState('');
  const [productCrosssellOnly, setProductCrosssellOnly] = useState(false);
  const [productsReorderSaving, setProductsReorderSaving] = useState(false);
  const [productDeleteId, setProductDeleteId] = useState('');
  const [productPriceDrafts, setProductPriceDrafts] = useState({});
  const [productOrderDrafts, setProductOrderDrafts] = useState({});
  const [productNameDrafts, setProductNameDrafts] = useState({});
  const [productDescriptionDrafts, setProductDescriptionDrafts] = useState({});
  const [productCategoryDrafts, setProductCategoryDrafts] = useState({});
  const [draggedProductId, setDraggedProductId] = useState('');
  const [dragOverProductId, setDragOverProductId] = useState('');
  const [favoriteSelectionIds, setFavoriteSelectionIds] = useState([]);
  const [favoriteOrderDrafts, setFavoriteOrderDrafts] = useState({});
  const [favoriteBulkSaving, setFavoriteBulkSaving] = useState(false);
  const [favoriteSavingId, setFavoriteSavingId] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [catalogOptionGroups, setCatalogOptionGroups] = useState([]);
  const [catalogOptionGroupsLoading, setCatalogOptionGroupsLoading] = useState(false);
  const [productSelectedGroupIds, setProductSelectedGroupIds] = useState([]);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormOrder, setCategoryFormOrder] = useState('');
  const [categoryFormImageUrl, setCategoryFormImageUrl] = useState('');
  const [categoryFormDiscountType, setCategoryFormDiscountType] = useState('');
  const [categoryFormDiscountValue, setCategoryFormDiscountValue] = useState('');
  const [categoryFormParentId, setCategoryFormParentId] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDeleteId, setCategoryDeleteId] = useState('');
  const [categoryEditModal, setCategoryEditModal] = useState(false);
  const [categoryEditItem, setCategoryEditItem] = useState(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [categoryEditOrder, setCategoryEditOrder] = useState('');
  const [categoryEditImageUrl, setCategoryEditImageUrl] = useState('');
  const [categoryEditDiscountType, setCategoryEditDiscountType] = useState('');
  const [categoryEditDiscountValue, setCategoryEditDiscountValue] = useState('');
  const [categoryEditParentId, setCategoryEditParentId] = useState('');
  const [categoryEditSaving, setCategoryEditSaving] = useState(false);
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  const [categoryNewImageFile, setCategoryNewImageFile] = useState(null);
  const [categoryNewImagePreview, setCategoryNewImagePreview] = useState('');
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    description: '',
    imageUrl: '',
    category: '',
    order: '1',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    allow_immediate: true,
    allow_scheduled: true,
    discount_type: '',
    discount_value: '',
    is_crosssell: false,
  });

  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerDeleteId, setBannerDeleteId] = useState('');
  const [bannerForm, setBannerForm] = useState({
    title: '',
    image_url: '',
    link: '/offers',
    order: '1',
    is_active: true,
  });

  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    description: '',
    code: '',
    badge: 'Fırsat',
    discount_type: 'percent',
    discount_value: '10',
    max_discount: '0',
    min_cart_total: '0',
    start_date: '',
    end_date: '',
    order: '1',
    is_active: true,
    image_url: '',
    color_from: '#98CD00',
    color_via: '#98CD00',
    color_to: '#98CD00',
  });

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [minCartAmount, setMinCartAmount] = useState(0);
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [deliveryZonesLoading, setDeliveryZonesLoading] = useState(false);
  const [deliveryZonesImporting, setDeliveryZonesImporting] = useState(false);
  const [deliveryZoneUpdatingKey, setDeliveryZoneUpdatingKey] = useState('');
  const [deliveryZoneBulkUpdatingField, setDeliveryZoneBulkUpdatingField] = useState('');
  const [selectedDeliveryDistrict, setSelectedDeliveryDistrict] = useState('');
  const [deliveryDistrictDrafts, setDeliveryDistrictDrafts] = useState({});
  const [deliveryDistrictSavingKey, setDeliveryDistrictSavingKey] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsFilter, setReviewsFilter] = useState('all');
  const [reviewUpdateId, setReviewUpdateId] = useState('');
  const [reviewOrderMeta, setReviewOrderMeta] = useState({});

  const [panelError, setPanelError] = useState('');
  const [panelInfo, setPanelInfo] = useState('');
  const [printableOrder, setPrintableOrder] = useState(null);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const notificationAudioRef = useRef(null);
  const isAlarmLoopActiveRef = useRef(false);
  const isAudioUnlockedRef = useRef(false);
  const hasShownAutoplayErrorRef = useRef(false);
  const scheduleAlertIdsRef = useRef(new Set());
  const draggedProductIdRef = useRef('');
  const hasBootstrappedScheduleAlertsRef = useRef(false);
  const lastProcessedTickRef = useRef(timeCursor);
  const visibleTabsKey = useMemo(
    () => (Array.isArray(visibleTabs) ? visibleTabs.join(',') : ''),
    [visibleTabs]
  );

  useEffect(() => {
    setActiveTab((prev) => {
      const next = resolveTabKey(forcedTab || prev);
      return prev === next ? prev : next;
    });
  }, [forcedTab, visibleTabsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const nowDate = useMemo(() => new Date(timeCursor), [timeCursor]);
  const printableOrderMacroTotals = useMemo(() => (
    calculateReceiptMacroTotals(printableOrder?.items)
  ), [printableOrder]);

  const incomingOrders = useMemo(() => {
    return orders.filter((item) => {
      const status = normalizeOrderStatus(item.status);
      if (status !== 'pending' && status !== 'confirmed' && status !== 'preparing') return false;

      const deliveryTimeType = normalizeDeliveryTimeType((item.delivery_type || item.delivery_time_type));
      if (deliveryTimeType === 'immediate') return true;
      return isScheduledApproaching(item, nowDate);
    });
  }, [orders, nowDate]);

  const scheduledOrders = useMemo(() => {
    return orders.filter((item) => {
      const status = normalizeOrderStatus(item.status);
      if (status !== 'pending') return false;

      const deliveryTimeType = normalizeDeliveryTimeType((item.delivery_type || item.delivery_time_type));
      if (deliveryTimeType !== 'scheduled') return false;
      return !isScheduledApproaching(item, nowDate);
    });
  }, [orders, nowDate]);

  const historyOrders = useMemo(() => {
    return orders.filter((item) => {
      const status = normalizeOrderStatus(item.status);
      return status === 'on_way' || status === 'delivered' || status === 'cancelled';
    });
  }, [orders]);

  const visibleOrders = useMemo(() => {
    if (ordersSubTab === 'incoming') return incomingOrders;
    if (ordersSubTab === 'scheduled') return scheduledOrders;
    return historyOrders;
  }, [ordersSubTab, incomingOrders, scheduledOrders, historyOrders]);

  const pendingIncomingOrders = useMemo(() => {
    return incomingOrders.filter((item) => normalizeOrderStatus(item.status) === 'pending');
  }, [incomingOrders]);

  const approachingScheduledIds = useMemo(() => {
    const ids = new Set();

    orders.forEach((item) => {
      const status = normalizeOrderStatus(item.status);
      const deliveryTimeType = normalizeDeliveryTimeType((item.delivery_type || item.delivery_time_type));
      if ((status === 'pending' || status === 'preparing') && deliveryTimeType === 'scheduled' && isScheduledApproaching(item, nowDate)) {
        ids.add(String(item.id));
      }
    });

    return ids;
  }, [orders, nowDate]);

  const productCategoryOptions = useMemo(() => {
    const nextSet = new Set();
    categories.forEach((item) => {
      const value = String(item?.name || '').trim();
      if (value) nextSet.add(value);
    });

    const formCategory = String(productForm.category || '').trim();
    if (formCategory) nextSet.add(formCategory);

    return Array.from(nextSet).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [categories, productForm.category]);

  const getEffectiveProductOrder = useCallback((item) => {
    const dbOrder = Number(item?.order ?? item?.sort_order ?? item?.display_order ?? item?.position);
    if (Number.isFinite(dbOrder)) return dbOrder;
    return Number.MAX_SAFE_INTEGER;
  }, []);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const orderDiff = getEffectiveProductOrder(a) - getEffectiveProductOrder(b);
      if (orderDiff !== 0) return orderDiff;
      return compareProductsByOrder(a, b);
    });
  }, [products, getEffectiveProductOrder]);

  const favoriteProducts = useMemo(() => (
    products.filter(getFavoriteFlag).sort(compareFavoriteProducts)
  ), [products]);

  const favoriteIdSet = useMemo(() => {
    return new Set(favoriteProducts.map((item) => String(item.id)));
  }, [favoriteProducts]);

  const favoriteCandidateProducts = useMemo(() => {
    return [...sortedProducts];
  }, [sortedProducts]);

  const filteredProducts = useMemo(() => {
    let list = sortedProducts;
    if (productCategoryFilter !== 'Tümü') {
      const normalizedSelected = String(productCategoryFilter || '').trim().toLocaleLowerCase('tr-TR');
      list = list.filter((item) => String(item?.category || '').trim().toLocaleLowerCase('tr-TR') === normalizedSelected);
    }
    if (productCrosssellOnly) {
      list = list.filter((item) => Boolean(item?.is_crosssell));
    }
    return list;
  }, [sortedProducts, productCategoryFilter, productCrosssellOnly]);

  const deliveryDistrictOptions = useMemo(() => {
    const names = new Set();
    deliveryZones.forEach((item) => {
      const districtName = String(item?.district || '').trim();
      if (districtName) names.add(districtName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [deliveryZones]);

  const deliveryDistrictSettings = useMemo(() => {
    const districtMap = new Map();

    deliveryZones.forEach((item) => {
      const districtName = String(item?.district || '').trim();
      if (!districtName) return;

      const key = normalizeTextForCompare(districtName);
      const minOrder = Math.max(0, Number(item?.min_order || 0));
      const cityName = String(item?.city || 'İzmir').trim() || 'İzmir';
      const zoneId = String(item?.id || '').trim();

      if (!districtMap.has(key)) {
        districtMap.set(key, {
          key,
          district: districtName,
          city: cityName,
          is_active: normalizeBoolean(item?.is_active, false),
          min_order: minOrder,
          zoneIds: zoneId ? [zoneId] : [],
        });
        return;
      }

      const current = districtMap.get(key);
      current.is_active = current.is_active || normalizeBoolean(item?.is_active, false);
      current.min_order = Math.max(current.min_order, minOrder);
      if (!current.city && cityName) current.city = cityName;
      if (zoneId) current.zoneIds.push(zoneId);
    });

    return Array.from(districtMap.values()).sort((a, b) => (
      String(a?.district || '').localeCompare(String(b?.district || ''), 'tr')
    ));
  }, [deliveryZones]);

  const selectedDeliveryDistrictKey = useMemo(
    () => normalizeTextForCompare(selectedDeliveryDistrict),
    [selectedDeliveryDistrict]
  );

  const selectedDeliveryDistrictSetting = useMemo(() => (
    deliveryDistrictSettings.find((item) => item.key === selectedDeliveryDistrictKey) || null
  ), [deliveryDistrictSettings, selectedDeliveryDistrictKey]);

  const selectedDeliveryDistrictDraft = useMemo(() => {
    if (!selectedDeliveryDistrictKey) return null;

    const fallback = {
      city: selectedDeliveryDistrictSetting?.city || 'İzmir',
      district: selectedDeliveryDistrictSetting?.district || selectedDeliveryDistrict,
      is_active: Boolean(selectedDeliveryDistrictSetting?.is_active),
      min_order: String(selectedDeliveryDistrictSetting?.min_order ?? 0),
    };

    const draft = deliveryDistrictDrafts[selectedDeliveryDistrictKey];
    if (!draft) return fallback;

    return {
      ...fallback,
      ...draft,
      is_active: typeof draft?.is_active === 'boolean' ? draft.is_active : fallback.is_active,
      min_order: draft?.min_order !== undefined ? draft.min_order : fallback.min_order,
    };
  }, [
    deliveryDistrictDrafts,
    selectedDeliveryDistrict,
    selectedDeliveryDistrictKey,
    selectedDeliveryDistrictSetting,
  ]);

  const selectedDistrictDeliveryZones = useMemo(() => {
    if (!selectedDeliveryDistrict) return [];
    const normalizedSelected = normalizeTextForCompare(selectedDeliveryDistrict);
    return deliveryZones
      .filter((item) => normalizeTextForCompare(item?.district) === normalizedSelected)
      .sort((a, b) => String(a?.neighborhood || '').localeCompare(String(b?.neighborhood || ''), 'tr'));
  }, [deliveryZones, selectedDeliveryDistrict]);

  const districtAllImmediateEnabled = useMemo(() => (
    selectedDistrictDeliveryZones.length > 0
    && selectedDistrictDeliveryZones.every((item) => normalizeBoolean(item?.allow_immediate, false))
  ), [selectedDistrictDeliveryZones]);

  const districtAllScheduledEnabled = useMemo(() => (
    selectedDistrictDeliveryZones.length > 0
    && selectedDistrictDeliveryZones.every((item) => normalizeBoolean(item?.allow_scheduled, false))
  ), [selectedDistrictDeliveryZones]);

  useEffect(() => {
    setDeliveryDistrictDrafts((prev) => {
      const next = {};
      deliveryDistrictSettings.forEach((item) => {
        const existing = prev[item.key];
        next[item.key] = {
          city: item.city || 'İzmir',
          district: item.district,
          is_active: typeof existing?.is_active === 'boolean' ? existing.is_active : item.is_active,
          min_order: existing?.min_order !== undefined ? existing.min_order : String(item.min_order),
        };
      });
      return next;
    });
  }, [deliveryDistrictSettings]);

  useEffect(() => {
    if (productCategoryFilter === 'Tümü') return;
    if (!productCategoryOptions.includes(productCategoryFilter)) {
      setProductCategoryFilter('Tümü');
    }
  }, [productCategoryFilter, productCategoryOptions]);

  useEffect(() => {
    if (deliveryDistrictOptions.length === 0) {
      setSelectedDeliveryDistrict('');
      return;
    }

    if (!selectedDeliveryDistrict || !deliveryDistrictOptions.includes(selectedDeliveryDistrict)) {
      setSelectedDeliveryDistrict(deliveryDistrictOptions[0]);
    }
  }, [deliveryDistrictOptions, selectedDeliveryDistrict]);

  useEffect(() => {
    setFavoriteSelectionIds((prev) => prev.filter((id) => products.some((item) => String(item.id) === String(id))));
  }, [products]);

  const filteredReviews = useMemo(() => {
    if (reviewsFilter === 'approved') return reviews.filter((item) => normalizeBoolean(item?.is_approved, false));
    if (reviewsFilter === 'pending') return reviews.filter((item) => !normalizeBoolean(item?.is_approved, false));
    return reviews;
  }, [reviews, reviewsFilter]);

  const financeProductLookup = useMemo(() => {
    const nextMap = new Map();
    products.forEach((product) => {
      if (product?.id !== undefined && product?.id !== null) {
        nextMap.set(String(product.id), product);
      }
    });
    return nextMap;
  }, [products]);

  const deliveredOrders = useMemo(() => {
    return orders
      .filter((item) => normalizeOrderStatus(item.status) === 'delivered')
      .map((item) => {
        const analyticsDate = new Date(item.delivered_at || item.updated_at || item.created_at || '');
        if (Number.isNaN(analyticsDate.getTime())) return null;
        const amount = Number(item.total_price || 0);
        return {
          ...item,
          analyticsDate,
          analyticsRevenue: Number.isFinite(amount) ? amount : 0,
        };
      })
      .filter(Boolean);
  }, [orders]);

  const financeSelectedRange = useMemo(() => {
    if (financePeriod !== 'custom') {
      return { ...getPresetRange(financePeriod, nowDate), isValid: true };
    }

    const rawStart = parseDateInputValue(financeCustomStartDate);
    const rawEnd = parseDateInputValue(financeCustomEndDate);
    if (!rawStart || !rawEnd) {
      return {
        key: 'custom',
        label: 'Özel Aralık',
        start: null,
        endExclusive: null,
        isValid: false,
      };
    }

    const start = rawStart <= rawEnd ? rawStart : rawEnd;
    const end = rawStart <= rawEnd ? rawEnd : rawStart;
    return {
      key: 'custom',
      label: 'Özel Aralık',
      start,
      endExclusive: addDays(end, 1),
      isValid: true,
    };
  }, [financePeriod, financeCustomStartDate, financeCustomEndDate, nowDate]);

  const financeSelectedRangeLabel = useMemo(() => {
    if (financeSelectedRange.key !== 'custom') return financeSelectedRange.label;
    if (!financeSelectedRange.isValid) return 'Özel Aralık (Tarih seçin)';
    return `${financeCustomStartDate} - ${financeCustomEndDate}`;
  }, [financeSelectedRange, financeCustomStartDate, financeCustomEndDate]);

  const financeRangeSummary = useMemo(() => {
    if (!financeSelectedRange.isValid) {
      return {
        orders: [],
        revenue: 0,
        orderCount: 0,
        averageBasket: 0,
      };
    }
    return summarizeOrdersForRange(
      deliveredOrders,
      financeSelectedRange.start,
      financeSelectedRange.endExclusive
    );
  }, [deliveredOrders, financeSelectedRange]);

  const financeComparison = useMemo(() => {
    const todayRange = getPresetRange('today', nowDate);
    const yesterdayRange = getPresetRange('yesterday', nowDate);
    const thisWeekRange = getPresetRange('this_week', nowDate);
    const lastWeekRange = getPresetRange('last_week', nowDate);
    const thisMonthRange = getPresetRange('this_month', nowDate);
    const lastMonthRange = getPresetRange('last_month', nowDate);

    const todayRevenue = summarizeOrdersForRange(deliveredOrders, todayRange.start, todayRange.endExclusive).revenue;
    const yesterdayRevenue = summarizeOrdersForRange(deliveredOrders, yesterdayRange.start, yesterdayRange.endExclusive).revenue;
    const thisWeekRevenue = summarizeOrdersForRange(deliveredOrders, thisWeekRange.start, thisWeekRange.endExclusive).revenue;
    const lastWeekRevenue = summarizeOrdersForRange(deliveredOrders, lastWeekRange.start, lastWeekRange.endExclusive).revenue;
    const thisMonthRevenue = summarizeOrdersForRange(deliveredOrders, thisMonthRange.start, thisMonthRange.endExclusive).revenue;
    const lastMonthRevenue = summarizeOrdersForRange(deliveredOrders, lastMonthRange.start, lastMonthRange.endExclusive).revenue;

    return {
      todayRevenue,
      yesterdayRevenue,
      thisWeekRevenue,
      lastWeekRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      todayGrowthPercent: calculateGrowthPercent(todayRevenue, yesterdayRevenue),
      weekGrowthPercent: calculateGrowthPercent(thisWeekRevenue, lastWeekRevenue),
      monthGrowthPercent: calculateGrowthPercent(thisMonthRevenue, lastMonthRevenue),
    };
  }, [deliveredOrders, nowDate]);

  const financeSalesTrend = useMemo(() => {
    const trend = [];
    const todayStart = getDayStart(nowDate);

    for (let offset = 6; offset >= 0; offset -= 1) {
      const dayStart = addDays(todayStart, -offset);
      const dayEnd = addDays(dayStart, 1);
      const revenue = summarizeOrdersForRange(deliveredOrders, dayStart, dayEnd).revenue;
      trend.push({
        key: formatDateInputValue(dayStart),
        label: dayStart.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        revenue,
      });
    }

    return trend;
  }, [deliveredOrders, nowDate]);

  const financeProductPerformance = useMemo(() => {
    const statsMap = new Map();

    financeRangeSummary.orders.forEach((order) => {
      const orderItems = Array.isArray(order.items) ? order.items : [];

      orderItems.forEach((item) => {
        const rawProductId = item?.product_id ?? item?.id ?? '';
        const lookupProduct = rawProductId ? financeProductLookup.get(String(rawProductId)) : null;
        const productName = item?.name || getProductName(lookupProduct) || 'Ürün';
        const productKey = rawProductId ? `id:${rawProductId}` : `name:${String(productName).toLowerCase()}`;
        const category = item?.category || lookupProduct?.category || 'Belirsiz';
        const quantityValue = Number(item?.quantity || 1);
        const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
        const unitPriceValue = Number(item?.unit_price ?? item?.price ?? 0);
        const unitPrice = Number.isFinite(unitPriceValue) ? unitPriceValue : 0;
        const lineRevenue = quantity * unitPrice;
        const stockLabel = lookupProduct ? (getAvailability(lookupProduct) ? 'Stokta' : 'Tükendi') : 'Bilinmiyor';

        const existing = statsMap.get(productKey);
        if (!existing) {
          statsMap.set(productKey, {
            productKey,
            productId: rawProductId ? String(rawProductId) : '',
            productName,
            category,
            soldQty: quantity,
            revenue: lineRevenue,
            stockLabel,
          });
          return;
        }

        existing.soldQty += quantity;
        existing.revenue += lineRevenue;
        if (existing.stockLabel === 'Bilinmiyor' && stockLabel !== 'Bilinmiyor') {
          existing.stockLabel = stockLabel;
        }
      });
    });

    return Array.from(statsMap.values());
  }, [financeRangeSummary.orders, financeProductLookup]);

  const financePopularCategory = useMemo(() => {
    const categoryMap = new Map();
    financeProductPerformance.forEach((item) => {
      const key = item.category || 'Belirsiz';
      categoryMap.set(key, (categoryMap.get(key) || 0) + item.soldQty);
    });

    let winner = 'Veri yok';
    let maxQty = 0;
    categoryMap.forEach((qty, category) => {
      if (qty > maxQty) {
        maxQty = qty;
        winner = category;
      }
    });
    return winner;
  }, [financeProductPerformance]);

  const financeTopProducts = useMemo(() => {
    return [...financeProductPerformance]
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 5);
  }, [financeProductPerformance]);

  const financeSortedProductPerformance = useMemo(() => {
    const nextRows = [...financeProductPerformance];
    if (financeProductSortBy === 'quantity') {
      nextRows.sort((a, b) => b.soldQty - a.soldQty);
      return nextRows;
    }
    nextRows.sort((a, b) => b.revenue - a.revenue);
    return nextRows;
  }, [financeProductPerformance, financeProductSortBy]);

  const financeDeliveryMix = useMemo(() => {
    const mix = { pickup: 0, delivery: 0 };

    financeRangeSummary.orders.forEach((order) => {
      const rawMethod = String(order?.delivery_method || '').toLowerCase();
      const isPickup = rawMethod.includes('pickup') || rawMethod.includes('gel') || rawMethod.includes('take');
      if (isPickup) {
        mix.pickup += 1;
      } else {
        mix.delivery += 1;
      }
    });

    return mix;
  }, [financeRangeSummary.orders]);

  const financeTrendPath = useMemo(() => {
    if (financeSalesTrend.length === 0) return '';
    const maxRevenue = Math.max(...financeSalesTrend.map((item) => item.revenue), 1);
    return financeSalesTrend
      .map((point, index) => {
        const x = (index / Math.max(financeSalesTrend.length - 1, 1)) * 100;
        const y = 100 - ((point.revenue / maxRevenue) * 100);
        return `${x},${y}`;
      })
      .join(' ');
  }, [financeSalesTrend]);

  const financeTopProductMaxQty = useMemo(() => {
    return Math.max(...financeTopProducts.map((item) => item.soldQty), 1);
  }, [financeTopProducts]);

  const financeDeliveryTotal = financeDeliveryMix.pickup + financeDeliveryMix.delivery;
  const financeDeliveryPct = financeDeliveryTotal > 0
    ? (financeDeliveryMix.delivery / financeDeliveryTotal) * 100
    : 0;
  const financePickupPct = financeDeliveryTotal > 0
    ? (financeDeliveryMix.pickup / financeDeliveryTotal) * 100
    : 0;

  const playNotificationSound = useCallback(async (options = {}) => {
    const { resetTime = true } = options;
    const player = notificationAudioRef.current;
    if (!player) return false;

    if (resetTime) {
      player.currentTime = 0;
    }

    try {
      await player.play();
      hasShownAutoplayErrorRef.current = false;
      return true;
    } catch {
      hasShownAutoplayErrorRef.current = true;
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

  const unlockAudioPlayback = async () => {
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
      hasShownAutoplayErrorRef.current = false;
      setPanelError((prev) => (prev === AUTOPLAY_BLOCKED_MESSAGE ? '' : prev));
      return true;
    } catch {
      return false;
    } finally {
      player.muted = previousMuted;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    fetchProducts();
    fetchCategories();
    fetchCatalogOptionGroups();

    if (disableNotifications) return undefined;

    fetchOrders();
    fetchBanners();
    fetchCampaigns();
    fetchStoreSetting();
    fetchDeliveryZones();
    fetchReviews();

    const ordersChannel = supabase
      .channel('admin-orders-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();

        const nextOrder = payload?.new;
        const deliveryTimeType = normalizeDeliveryTimeType((nextOrder?.delivery_type || nextOrder?.delivery_time_type));
        const nextStatus = normalizeOrderStatus(nextOrder?.status);
        if (deliveryTimeType === 'immediate') {
          playNotificationSound();
          if (nextStatus === 'pending') {
            startAlarmLoop();
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();

        const previousOrder = payload?.old || {};
        const nextOrder = payload?.new || {};
        const now = new Date();

        const previousStatus = normalizeOrderStatus(previousOrder.status);
        const nextStatus = normalizeOrderStatus(nextOrder.status);
        const previousType = normalizeDeliveryTimeType((previousOrder.delivery_type || previousOrder.delivery_time_type));
        const nextType = normalizeDeliveryTimeType((nextOrder.delivery_type || nextOrder.delivery_time_type));

        const previousUrgent = (
          (previousStatus === 'pending' || previousStatus === 'preparing')
          && (
            previousType === 'immediate'
            || (previousType === 'scheduled' && isScheduledApproaching(previousOrder, now))
          )
        );

        const nextUrgent = (
          (nextStatus === 'pending' || nextStatus === 'preparing')
          && (
            nextType === 'immediate'
            || (nextType === 'scheduled' && isScheduledApproaching(nextOrder, now))
          )
        );

        if (!previousUrgent && nextUrgent) {
          playNotificationSound();
          startAlarmLoop();
        }

        if (nextType === 'immediate' && nextStatus === 'pending') {
          startAlarmLoop();
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    const reviewsChannel = supabase
      .channel('admin-reviews-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, fetchReviews)
      .subscribe();

    const categoriesChannel = supabase
      .channel('admin-categories-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchCategories)
      .subscribe();

    const deliveryZonesChannel = supabase
      .channel('admin-delivery-zones-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_zones' }, fetchDeliveryZones)
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(deliveryZonesChannel);
    };
  }, [isAuthenticated, playNotificationSound, startAlarmLoop]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (disableNotifications) return undefined;

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
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const pollId = setInterval(() => {
      fetchOrders();
    }, ORDER_SYNC_POLL_MS);

    return () => {
      clearInterval(pollId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'reviews') return undefined;

    const pollId = setInterval(() => {
      fetchReviews();
    }, 15000);

    return () => {
      clearInterval(pollId);
    };
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const intervalId = setInterval(() => {
      setTimeCursor(Date.now());
    }, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (!hasBootstrappedScheduleAlertsRef.current) {
      scheduleAlertIdsRef.current = new Set(approachingScheduledIds);
      hasBootstrappedScheduleAlertsRef.current = true;
      lastProcessedTickRef.current = timeCursor;
      return;
    }

    if (lastProcessedTickRef.current === timeCursor) {
      scheduleAlertIdsRef.current = new Set(approachingScheduledIds);
      return;
    }

    const previousIds = scheduleAlertIdsRef.current;
    approachingScheduledIds.forEach((id) => {
      if (!previousIds.has(id)) {
        playNotificationSound();
      }
    });

    scheduleAlertIdsRef.current = new Set(approachingScheduledIds);
    lastProcessedTickRef.current = timeCursor;
  }, [approachingScheduledIds, isAuthenticated, playNotificationSound, timeCursor]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrintMode(false);
      setPrintableOrder(null);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (disableNotifications) return undefined;

    if (pendingIncomingOrders.length === 0) {
      stopAlarmLoop();
      return undefined;
    }

    startAlarmLoop();
    return undefined;
  }, [isAuthenticated, pendingIncomingOrders.length, startAlarmLoop, stopAlarmLoop]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      setPanelError(err?.message || 'Siparişler alınamadı.');
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,order_id,user_id,rating,comment,is_approved,created_at')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;

      let nextReviews = data || [];
      const autoApproveIds = nextReviews
        .filter((item) => Number(item?.rating || 0) >= 4 && !normalizeBoolean(item?.is_approved, false))
        .map((item) => item.id);

      if (autoApproveIds.length > 0) {
        const { error: autoApproveError } = await supabase
          .from('reviews')
          .update({ is_approved: true })
          .in('id', autoApproveIds);

        if (!autoApproveError) {
          const approvedSet = new Set(autoApproveIds.map((id) => String(id)));
          nextReviews = nextReviews.map((item) => (
            approvedSet.has(String(item.id)) ? { ...item, is_approved: true } : item
          ));
        }
      }

      setReviews(nextReviews);

      const orderIds = [...new Set(nextReviews.map((item) => item.order_id).filter(Boolean))];
      if (orderIds.length > 0) {
        const { data: orderMetaRows, error: orderMetaError } = await supabase
          .from('orders')
          .select('id,paytr_oid,customer_name')
          .in('id', orderIds);

        if (!orderMetaError && Array.isArray(orderMetaRows)) {
          const nextOrderMap = {};
          orderMetaRows.forEach((item) => {
            nextOrderMap[String(item.id)] = item;
          });
          setReviewOrderMeta(nextOrderMap);
        }
      } else {
        setReviewOrderMeta({});
      }
    } catch (err) {
      setPanelError(err?.message || 'Yorumlar alınamadı.');
    } finally {
      setReviewsLoading(false);
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      let finalData = null;
      let lastError = null;

      for (const tableName of PRODUCT_OPTION_GROUP_TABLE_CANDIDATES) {
        const response = await supabase
          .from('products')
          .select(`*, ${tableName}!${tableName}_product_id_fkey(group_id,sort_order)`)
          .or('type.eq.meal,type.is.null')
          .order('order', { ascending: true });

        if (!response.error) {
          finalData = (Array.isArray(response.data) ? response.data : []).map((row) => {
            const rawGroups = Array.isArray(row?.[tableName]) ? row[tableName] : [];
            const normalizedGroups = rawGroups
              .map((item) => ({
                group_id: String(item?.group_id ?? '').trim(),
                sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : 0,
              }))
              .filter((item) => item.group_id)
              .sort((a, b) => a.sort_order - b.sort_order);

            const next = { ...row, product_option_groups: normalizedGroups };
            if (tableName !== 'product_option_groups' && Object.prototype.hasOwnProperty.call(next, tableName)) {
              delete next[tableName];
            }
            return next;
          });
          break;
        }

        lastError = response.error;
        const lower = `${response.error?.message || ''} ${response.error?.details || ''}`.toLowerCase();
        const relationMissing = lower.includes('does not exist') || lower.includes('could not find the table') || response.error?.code === '42P01';
        if (!relationMissing) break;
      }

      if (!finalData) {
        console.error('Ürünler ilişki verisiyle çekilemedi:', lastError);
        throw (lastError || new Error('Ürünler alınamadı.'));
      }

      setProducts(finalData);
    } catch (err) {
      setPanelError(err?.message || 'Ürünler alınamadı.');
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      let response = await supabase
        .from('categories')
        .select('*')
        .order('order', { ascending: true });

      if (response.error) {
        response = await supabase
          .from('categories')
          .select('*')
          .order('id', { ascending: true });
      }

      if (response.error) throw response.error;

      const rows = Array.isArray(response.data) ? response.data : [];
      const normalized = rows
        .filter((item) => String(item?.name || '').trim())
        .sort((a, b) => {
          const orderDiff = getCategoryOrder(a) - getCategoryOrder(b);
          if (orderDiff !== 0) return orderDiff;
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr');
        });

      setCategories(normalized);
    } catch (err) {
      setPanelError(err?.message || 'Kategoriler alınamadı.');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchCatalogOptionGroups = async () => {
    setCatalogOptionGroupsLoading(true);
    try {
      let response = await supabase
        .from('option_groups')
        .select('id,name')
        .order('name', { ascending: true });

      if (response.error) {
        response = await supabase
          .from('option_groups')
          .select('id,name')
          .order('id', { ascending: true });
      }

      if (response.error) throw response.error;
      setCatalogOptionGroups(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setPanelError(err?.message || 'Seçim grupları alınamadı.');
      setCatalogOptionGroups([]);
    } finally {
      setCatalogOptionGroupsLoading(false);
    }
  };

  const fetchProductGroupLinks = async (productId) => {
    if (!productId) return [];
    let finalResponse = null;
    let finalTable = '';
    let lastError = null;

    for (const tableName of PRODUCT_OPTION_GROUP_TABLE_CANDIDATES) {
      let response = await supabase
        .from(tableName)
        .select('group_id,sort_order')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

      if (response.error) {
        response = await supabase
          .from(tableName)
          .select('group_id,sort_order')
          .eq('product_id', productId)
          .order('id', { ascending: true });
      }

      if (!response.error) {
        finalResponse = response;
        finalTable = tableName;
        break;
      }

      lastError = response.error;
      const lower = `${response.error?.message || ''} ${response.error?.details || ''}`.toLowerCase();
      const relationMissing = lower.includes('does not exist') || lower.includes('could not find the table') || response.error?.code === '42P01';
      if (!relationMissing) {
        break;
      }
    }

    if (!finalResponse) {
      console.error('Ürüne bağlı seçim grupları çekilemedi:', lastError);
      throw lastError || new Error('Ürüne bağlı seçim grupları çekilemedi.');
    }

    if (finalTable !== 'product_option_groups') {
      console.warn('Seçim grupları için fallback tablo kullanıldı:', finalTable);
    }

    return (Array.isArray(finalResponse.data) ? finalResponse.data : [])
      .map((row) => String(row?.group_id || '').trim())
      .filter(Boolean);
  };

  const syncProductGroupLinks = async (productId, selectedGroupIds = []) => {
    if (!productId) return;
    const normalizedProductIdRaw = String(productId ?? '').trim();
    if (!normalizedProductIdRaw) return;
    const normalizedProductIdNumber = Number(normalizedProductIdRaw);
    const normalizedProductId = Number.isFinite(normalizedProductIdNumber)
      ? normalizedProductIdNumber
      : normalizedProductIdRaw;

    const normalizedIds = [];
    const seenGroupIds = new Set();
    selectedGroupIds.forEach((value) => {
      const normalizedValue = String(value ?? '').trim();
      if (!normalizedValue || seenGroupIds.has(normalizedValue)) return;
      seenGroupIds.add(normalizedValue);
      normalizedIds.push(normalizedValue);
    });

    const payload = normalizedIds.map((groupId, index) => ({
      product_id: normalizedProductId,
      group_id: groupId,
      sort_order: index,
    }));
    console.log('Seçim grupları veritabanına gönderiliyor...', {
      productId: normalizedProductId,
      selectedGroupIds,
      payload,
    });
    let selectedTable = '';
    let lastError = null;

    for (const tableName of PRODUCT_OPTION_GROUP_TABLE_CANDIDATES) {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('product_id', normalizedProductId);

      if (deleteError) {
        lastError = deleteError;
        const lower = `${deleteError?.message || ''} ${deleteError?.details || ''}`.toLowerCase();
        const relationMissing = lower.includes('does not exist') || lower.includes('could not find the table') || deleteError?.code === '42P01';
        if (relationMissing) continue;
        console.error(`${tableName} silme hatası:`, deleteError);
        throw deleteError;
      }

      selectedTable = tableName;
      break;
    }

    if (!selectedTable) {
      console.error('Seçim grubu eşleşmelerini silecek tablo bulunamadı:', lastError);
      throw lastError || new Error('Seçim grubu eşleşmelerini silecek tablo bulunamadı.');
    }

    if (normalizedIds.length === 0) return;
    const { error: insertError } = await supabase
      .from(selectedTable)
      .insert(payload);
    if (insertError) {
      console.error(`${selectedTable} insert hatası:`, insertError);
      throw insertError;
    }

    if (selectedTable !== 'product_option_groups') {
      console.warn('Seçim grupları için fallback tabloya yazıldı:', selectedTable);
    }
  };

  const refetchProductsAndNotify = async () => {
    await fetchProducts();
    emitProductsSyncSignal();
  };

  const fetchBanners = async () => {
    setBannersLoading(true);
    try {
      let response = await supabase
        .from('banners')
        .select('id,title,image_url,link,is_active,order')
        .order('order', { ascending: true });

      if (response.error) {
        response = await supabase
          .from('banners')
          .select('id,image_url,link,is_active,order')
          .order('order', { ascending: true });
      }

      if (response.error) throw response.error;
      setBanners(response.data || []);
    } catch (err) {
      setPanelError(err?.message || 'Banner verisi alınamadı. banners tablosunu kontrol edin.');
    } finally {
      setBannersLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      let response = await supabase
        .from('campaigns')
        .select('id,title,description,code,badge,discount_type,discount_value,max_discount,min_cart_total,start_date,end_date,is_active,order,image_url,color_from,color_via,color_to')
        .order('order', { ascending: true });

      if (response.error) {
        response = await supabase
          .from('campaigns')
          .select('id,title,description,code,badge,is_active,order')
          .order('order', { ascending: true });
      }

      if (response.error) throw response.error;
      setCampaigns(response.data || []);
    } catch (err) {
      setPanelError(err?.message || 'Kampanyalar alınamadı.');
    } finally {
      setCampaignsLoading(false);
    }
  };

  const fetchStoreSetting = async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('id,is_shop_open,min_cart_amount')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setStoreOpen(true);
        setMinCartAmount(0);
        return;
      }

      const nextValue = normalizeBoolean(data.is_shop_open, true);
      setStoreOpen(nextValue);
      setMinCartAmount(Number(data.min_cart_amount || 0));
    } catch (err) {
      console.log('settings fallback mode:', err?.message || err);
      setStoreOpen(true);
      setMinCartAmount(0);
      setPanelInfo('Ayarlar tablosu bulunamadı. Şimdilik yerel/simülasyon modunda çalışıyor.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchDeliveryZones = async () => {
    setDeliveryZonesLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('district', { ascending: true });

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      setDeliveryZones(rows.map((item) => ({
        ...item,
        city: String(item?.city || '').trim(),
        district: String(item?.district || '').trim(),
        neighborhood: String(item?.neighborhood || '').trim(),
        is_active: normalizeBoolean(item?.is_active, false),
        min_order: Math.max(0, Number(item?.min_order || 0)),
        allow_immediate: normalizeBoolean(item?.allow_immediate, false),
        allow_scheduled: normalizeBoolean(item?.allow_scheduled, false),
      })).sort((a, b) => {
        const districtDiff = String(a?.district || '').localeCompare(String(b?.district || ''), 'tr');
        if (districtDiff !== 0) return districtDiff;
        return String(a?.neighborhood || '').localeCompare(String(b?.neighborhood || ''), 'tr');
      }));
    } catch (err) {
      setPanelError(getDetailedErrorMessage(err, 'Teslimat bölgeleri alınamadı.'));
      setDeliveryZones([]);
    } finally {
      setDeliveryZonesLoading(false);
    }
  };

  const importIzmirNeighborhoods = async () => {
    setDeliveryZonesImporting(true);
    setPanelError('');
    setPanelInfo('');

    try {
      const provinceResponse = await fetch('https://turkiyeapi.dev/api/v1/provinces/35');
      if (!provinceResponse.ok) {
        throw new Error(`İzmir verisi alınamadı (${provinceResponse.status})`);
      }

      const provinceJson = await provinceResponse.json();
      const districts = Array.isArray(provinceJson?.data?.districts) ? provinceJson.data.districts : [];
      if (districts.length === 0) {
        throw new Error('İzmir ilçeleri API yanıtında bulunamadı.');
      }

      const districtDetails = await Promise.all(districts.map(async (district) => {
        const districtId = district?.id;
        const districtName = String(district?.name || '').trim();
        if (!districtId || !districtName) return [];

        try {
          const districtResponse = await fetch(`https://turkiyeapi.dev/api/v1/districts/${districtId}`);
          if (!districtResponse.ok) return [];
          const districtJson = await districtResponse.json();
          const neighborhoods = Array.isArray(districtJson?.data?.neighborhoods) ? districtJson.data.neighborhoods : [];

          return neighborhoods
            .map((neighborhood) => String(neighborhood?.name || '').trim())
            .filter(Boolean)
            .map((neighborhoodName) => ({
              district: districtName,
              neighborhood: neighborhoodName,
              is_active: false,
              allow_immediate: false,
              allow_scheduled: false,
            }));
        } catch {
          return [];
        }
      }));

      const importedRows = districtDetails.flat();
      if (importedRows.length === 0) {
        throw new Error('İzmir mahalleleri alınamadı.');
      }

      const existingResponse = await supabase
        .from('delivery_zones')
        .select('district,neighborhood');

      if (existingResponse.error) throw existingResponse.error;

      const existingKeySet = new Set(
        (Array.isArray(existingResponse.data) ? existingResponse.data : [])
          .map((item) => `${normalizeTextForCompare(item?.district)}|${normalizeTextForCompare(item?.neighborhood)}`)
      );

      const dedupedRows = [];
      const newKeySet = new Set();
      importedRows.forEach((row) => {
        const key = `${normalizeTextForCompare(row.district)}|${normalizeTextForCompare(row.neighborhood)}`;
        if (!row.district || !row.neighborhood) return;
        if (existingKeySet.has(key)) return;
        if (newKeySet.has(key)) return;
        newKeySet.add(key);
        dedupedRows.push(row);
      });

      if (dedupedRows.length === 0) {
        setPanelInfo('İzmir mahalleleri zaten içe aktarılmış.');
        await fetchDeliveryZones();
        return;
      }

      const chunkSize = 400;
      for (let i = 0; i < dedupedRows.length; i += chunkSize) {
        const chunk = dedupedRows.slice(i, i + chunkSize);
        const { error: insertError } = await supabase.from('delivery_zones').insert(chunk);
        if (insertError) throw insertError;
      }

      await fetchDeliveryZones();
      setPanelInfo(`İzmir mahalleleri içe aktarıldı. Eklenen kayıt: ${dedupedRows.length}`);
    } catch (err) {
      setPanelError(getDetailedErrorMessage(err, 'İzmir mahalleleri içe aktarılamadı.'));
    } finally {
      setDeliveryZonesImporting(false);
    }
  };

  const updateDeliveryZoneToggle = async (zoneId, field, nextValue) => {
    if (!zoneId || !field) return;
    const normalizedField = String(field);
    const allowedFields = new Set(['is_active', 'allow_immediate', 'allow_scheduled']);
    if (!allowedFields.has(normalizedField)) return;

    setDeliveryZoneUpdatingKey(`${zoneId}:${normalizedField}`);
    setPanelError('');

    try {
      const updated = await safeUpdateById('delivery_zones', zoneId, {
        [normalizedField]: Boolean(nextValue),
      });

      setDeliveryZones((prev) => prev.map((item) => {
        if (String(item.id) !== String(zoneId)) return item;
        return {
          ...item,
          ...updated,
          is_active: normalizeBoolean(updated?.is_active ?? item?.is_active, false),
          allow_immediate: normalizeBoolean(updated?.allow_immediate ?? item?.allow_immediate, false),
          allow_scheduled: normalizeBoolean(updated?.allow_scheduled ?? item?.allow_scheduled, false),
        };
      }));
    } catch (err) {
      setPanelError(getDetailedErrorMessage(err, 'Teslimat bölgesi güncellenemedi.'));
    } finally {
      setDeliveryZoneUpdatingKey('');
    }
  };

  const updateSelectedDistrictDeliveryField = async (field, nextValue) => {
    const normalizedField = String(field);
    const allowedFields = new Set(['allow_immediate', 'allow_scheduled']);
    if (!allowedFields.has(normalizedField)) return;

    const districtName = String(selectedDeliveryDistrict || '').trim();
    if (!districtName) return;

    setDeliveryZoneBulkUpdatingField(normalizedField);
    setPanelError('');

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({ [normalizedField]: Boolean(nextValue) })
        .eq('district', districtName);

      if (error) throw error;

      const normalizedDistrict = normalizeTextForCompare(districtName);
      setDeliveryZones((prev) => prev.map((item) => {
        if (normalizeTextForCompare(item?.district) !== normalizedDistrict) return item;
        return {
          ...item,
          [normalizedField]: Boolean(nextValue),
        };
      }));
      setPanelInfo(
        normalizedField === 'allow_immediate'
          ? `“${districtName}” ilçesi için Hemen Teslim ${nextValue ? 'açıldı' : 'kapatıldı'}.`
          : `“${districtName}” ilçesi için Randevulu Teslim ${nextValue ? 'açıldı' : 'kapatıldı'}.`
      );
    } catch (err) {
      setPanelError(getDetailedErrorMessage(err, 'İlçe bazlı toplu teslimat güncellemesi yapılamadı.'));
    } finally {
      setDeliveryZoneBulkUpdatingField('');
    }
  };

  const updateDeliveryDistrictDraft = (districtKey, field, value) => {
    if (!districtKey || !field) return;
    setDeliveryDistrictDrafts((prev) => {
      const current = prev[districtKey] || {};
      return {
        ...prev,
        [districtKey]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const saveDeliveryDistrictRule = async (districtKey) => {
    const draft = deliveryDistrictDrafts[districtKey];
    if (!draft) return;

    const districtName = String(draft?.district || '').trim();
    if (!districtName) {
      setPanelError('İlçe adı boş olamaz.');
      return;
    }

    const parsedMinOrder = Number(String(draft?.min_order || '').replace(',', '.'));
    if (!Number.isFinite(parsedMinOrder) || parsedMinOrder < 0) {
      setPanelError('Minimum sepet için 0 veya daha büyük bir tutar girin.');
      return;
    }

    const payload = {
      city: String(draft?.city || 'İzmir').trim() || 'İzmir',
      district: districtName,
      is_active: Boolean(draft?.is_active),
      min_order: parsedMinOrder,
      updated_at: new Date().toISOString(),
    };

    setDeliveryDistrictSavingKey(districtKey);
    setPanelError('');
    setPanelInfo('');

    try {
      const existing = deliveryDistrictSettings.find((item) => item.key === districtKey);
      if (existing && Array.isArray(existing.zoneIds) && existing.zoneIds.length > 0) {
        const updatedRows = await Promise.all(
          existing.zoneIds.map((zoneId) => safeUpdateById('delivery_zones', zoneId, payload))
        );

        const updatedById = new Map(updatedRows.map((row) => [String(row?.id || ''), row]));
        setDeliveryZones((prev) => prev.map((item) => {
          const matched = updatedById.get(String(item?.id || ''));
          if (!matched) return item;
          return {
            ...item,
            ...matched,
            city: String(matched?.city || item?.city || '').trim(),
            district: String(matched?.district || item?.district || '').trim(),
            neighborhood: String(matched?.neighborhood || item?.neighborhood || '').trim(),
            is_active: normalizeBoolean(matched?.is_active ?? item?.is_active, false),
            min_order: Math.max(0, Number(matched?.min_order ?? item?.min_order ?? 0)),
            allow_immediate: normalizeBoolean(matched?.allow_immediate ?? item?.allow_immediate, false),
            allow_scheduled: normalizeBoolean(matched?.allow_scheduled ?? item?.allow_scheduled, false),
          };
        }));
      } else {
        const created = await safeInsert('delivery_zones', payload);
        const normalizedCreated = {
          ...created,
          city: String(created?.city || '').trim(),
          district: String(created?.district || '').trim(),
          neighborhood: String(created?.neighborhood || '').trim(),
          is_active: normalizeBoolean(created?.is_active, false),
          min_order: Math.max(0, Number(created?.min_order || 0)),
          allow_immediate: normalizeBoolean(created?.allow_immediate, false),
          allow_scheduled: normalizeBoolean(created?.allow_scheduled, false),
        };
        setDeliveryZones((prev) => [...prev, normalizedCreated].sort((a, b) => {
          const districtDiff = String(a?.district || '').localeCompare(String(b?.district || ''), 'tr');
          if (districtDiff !== 0) return districtDiff;
          return String(a?.neighborhood || '').localeCompare(String(b?.neighborhood || ''), 'tr');
        }));
      }

      setPanelInfo(`"${districtName}" için teslimat ve minimum sepet ayarı kaydedildi.`);
    } catch (err) {
      setPanelError(getDetailedErrorMessage(err, 'İlçe ayarı kaydedilemedi.'));
    } finally {
      setDeliveryDistrictSavingKey('');
    }
  };

  const saveCategory = async () => {
    const nextName = String(categoryFormName || '').trim();
    if (!nextName) {
      setPanelError('Kategori adı zorunlu.');
      return;
    }

    const exists = categories.some((item) => String(item?.name || '').trim().toLocaleLowerCase('tr-TR') === nextName.toLocaleLowerCase('tr-TR'));
    if (exists) {
      setPanelError('Bu kategori zaten mevcut.');
      return;
    }

    const maxOrder = categories.reduce((max, item) => {
      const value = getCategoryOrder(item);
      return Number.isFinite(value) && value !== Number.MAX_SAFE_INTEGER ? Math.max(max, value) : max;
    }, 0);
    const parsedOrder = Number(String(categoryFormOrder || '').trim());
    const hasManualOrder = String(categoryFormOrder || '').trim() !== '';
    if (hasManualOrder && (!Number.isFinite(parsedOrder) || parsedOrder < 0)) {
      setPanelError('Kategori sırası için 0 veya daha büyük sayı girin.');
      return;
    }

    setCategorySaving(true);
    setPanelError('');
    setPanelInfo('');

    try {
      const parsedDiscountVal = categoryFormDiscountValue !== '' ? Number(categoryFormDiscountValue) : null;
      const created = await safeInsert('categories', {
        name: nextName,
        order: hasManualOrder ? Math.round(parsedOrder) : maxOrder + 10,
        image_url: null,
        discount_type: categoryFormDiscountType || null,
        discount_value: (categoryFormDiscountType && Number.isFinite(parsedDiscountVal)) ? parsedDiscountVal : null,
        parent_id: categoryFormParentId || null,
      });

      // Upload image after we have the ID
      if (categoryNewImageFile && created?.id) {
        try {
          const url = await uploadCategoryImage(created.id, categoryNewImageFile);
          await supabase.from('categories').update({ image_url: url, img: url }).eq('id', created.id);
          created.image_url = url;
        } catch (_) { /* image upload failure is non-fatal */ }
      }

      setCategories((prev) => [...prev, created].sort((a, b) => {
        const orderDiff = getCategoryOrder(a) - getCategoryOrder(b);
        if (orderDiff !== 0) return orderDiff;
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr');
      }));
      setCategoryFormName('');
      setCategoryFormOrder('');
      setCategoryFormImageUrl('');
      setCategoryFormDiscountType('');
      setCategoryFormDiscountValue('');
      setCategoryFormParentId('');
      setCategoryNewImageFile(null);
      setCategoryNewImagePreview('');
      setPanelInfo('Kategori eklendi.');
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Kategori eklenemedi.'));
    } finally {
      setCategorySaving(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!category?.id) return;
    const categoryName = String(category?.name || 'Kategori').trim();
    const confirmed = window.confirm(`"${categoryName}" kategorisini silmek istiyor musunuz?`);
    if (!confirmed) return;

    setCategoryDeleteId(String(category.id));
    setPanelError('');
    setPanelInfo('');

    try {
      await safeDeleteById('categories', category.id);
      setCategories((prev) => prev.filter((item) => String(item.id) !== String(category.id)));
      setPanelInfo('Kategori silindi.');
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Kategori silinemedi.'));
    } finally {
      setCategoryDeleteId('');
    }
  };

  const uploadCategoryImage = async (categoryId, file) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `categories/${categoryId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return publicUrl;
  };

  const openCategoryEdit = (category) => {
    setCategoryEditItem(category);
    setCategoryEditName(String(category.name || ''));
    const ord = getCategoryOrder(category);
    setCategoryEditOrder(ord === Number.MAX_SAFE_INTEGER ? '' : String(ord));
    setCategoryEditImageUrl(String(category.image_url || ''));
    setCategoryEditDiscountType(String(category.discount_type || ''));
    setCategoryEditDiscountValue(category.discount_value != null ? String(category.discount_value) : '');
    setCategoryEditParentId(String(category.parent_id || ''));
    setCategoryEditModal(true);
  };

  const closeCategoryEdit = () => {
    if (categoryEditSaving || categoryImageUploading) return;
    setCategoryEditModal(false);
    setCategoryEditItem(null);
  };

  const handleCategoryEditImageUpload = async (file) => {
    if (!file || !categoryEditItem?.id) return;
    setCategoryImageUploading(true);
    setPanelError('');
    try {
      const url = await uploadCategoryImage(categoryEditItem.id, file);
      const { error } = await supabase.from('categories').update({ image_url: url, img: url }).eq('id', categoryEditItem.id);
      if (error) throw error;
      setCategoryEditImageUrl(url);
      setCategories((prev) => prev.map((c) => String(c.id) === String(categoryEditItem.id) ? { ...c, image_url: url } : c));
    } catch (err) {
      setPanelError(err?.message || 'Görsel yüklenemedi.');
    } finally {
      setCategoryImageUploading(false);
    }
  };

  const saveCategoryEdit = async () => {
    if (!categoryEditItem?.id) return;
    const name = String(categoryEditName || '').trim();
    if (!name) { setPanelError('Kategori adı zorunlu.'); return; }
    setCategoryEditSaving(true);
    setPanelError('');
    setPanelInfo('');
    try {
      const parsedOrder = Number(String(categoryEditOrder || '').trim());
      const hasOrder = String(categoryEditOrder || '').trim() !== '';
      const parsedDiscountVal = categoryEditDiscountValue !== '' ? Number(categoryEditDiscountValue) : null;
      const payload = {
        name,
        ...(hasOrder && Number.isFinite(parsedOrder) && parsedOrder >= 0 ? { order: Math.round(parsedOrder) } : {}),
        image_url: categoryEditImageUrl || null,
        img: categoryEditImageUrl || null,
        discount_type: categoryEditDiscountType || null,
        discount_value: (categoryEditDiscountType && Number.isFinite(parsedDiscountVal) && parsedDiscountVal >= 0) ? parsedDiscountVal : null,
        parent_id: categoryEditParentId || null,
      };
      const { error } = await supabase.from('categories').update(payload).eq('id', categoryEditItem.id);
      if (error) throw error;
      setCategories((prev) =>
        prev.map((c) => String(c.id) === String(categoryEditItem.id) ? { ...c, ...payload } : c)
          .sort((a, b) => {
            const diff = getCategoryOrder(a) - getCategoryOrder(b);
            return diff !== 0 ? diff : String(a.name || '').localeCompare(String(b.name || ''), 'tr');
          })
      );
      setPanelInfo('Kategori güncellendi.');
      closeCategoryEdit();
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Kategori güncellenemedi.'));
    } finally {
      setCategoryEditSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setIsFinanceUnlocked(false);
    setFinancePinInput('');
    setFinancePinError('');
    hasBootstrappedScheduleAlertsRef.current = false;
    isAudioUnlockedRef.current = false;
    isAlarmLoopActiveRef.current = false;
    scheduleAlertIdsRef.current = new Set();
    lastProcessedTickRef.current = Date.now();
    hasShownAutoplayErrorRef.current = false;
    setReviews([]);
    setReviewOrderMeta({});
    setReviewsFilter('all');
    setReviewUpdateId('');
    stopAlarmLoop();
    navigate('/login', { replace: true });
  };

  const handlePrintOrder = (order) => {
    setPrintableOrder(order);
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
    }, 80);
  };

  const handleFinanceUnlock = (e) => {
    e.preventDefault();
    setFinancePinError('');
    setIsFinanceUnlocked(true);
    setFinancePinInput('');
  };

  const toggleReviewApproval = async (review) => {
    if (!review?.id) return;

    setPanelError('');
    setPanelInfo('');
    setReviewUpdateId(String(review.id));

    const nextApproved = !normalizeBoolean(review.is_approved, false);

    try {
      const updated = await safeUpdateById('reviews', review.id, { is_approved: nextApproved });
      const updatedFlag = normalizeBoolean(updated?.is_approved, nextApproved);

      setReviews((prev) => prev.map((item) => (
        String(item.id) === String(review.id)
          ? { ...item, ...updated, is_approved: updatedFlag }
          : item
      )));

      setPanelInfo(updatedFlag ? 'Yorum onaylandı ve vitrinde gösterime hazır.' : 'Yorum vitrinden gizlendi.');
    } catch (err) {
      setPanelError(err?.message || 'Yorum durumu güncellenemedi.');
    } finally {
      setReviewUpdateId('');
    }
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    setPanelError('');
    setPanelInfo('');

    try {
      await safeUpdateById('orders', orderId, { status: nextStatus });
      setOrders((prev) => prev.map((order) => (
        order.id === orderId ? { ...order, status: nextStatus } : order
      )));
      setPanelInfo('Sipariş durumu güncellendi.');
    } catch (err) {
      setPanelError(err?.message || 'Sipariş statüsü güncellenemedi.');
    }
  };

  const toggleProductGroupSelection = (groupId, checked) => {
    const normalizedId = String(groupId);
    setProductSelectedGroupIds((prev) => {
      if (checked) {
        if (prev.includes(normalizedId)) return prev;
        return [...prev, normalizedId];
      }
      return prev.filter((id) => id !== normalizedId);
    });
  };

  const moveProductGroupSelection = (groupId, direction) => {
    const normalizedId = String(groupId);
    setProductSelectedGroupIds((prev) => {
      const index = prev.indexOf(normalizedId);
      if (index < 0) return prev;
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const openCreateProduct = () => {
    if (catalogOptionGroups.length === 0) {
      fetchCatalogOptionGroups();
    }
    const nextOrder = products.reduce((max, item) => {
      const current = Number(item?.order ?? item?.sort_order);
      return Number.isFinite(current) ? Math.max(max, current) : max;
    }, 0) + 1;
    const fallbackCategory = productCategoryOptions[0] || '';

    setEditingProduct(null);
    setProductSelectedGroupIds([]);
    setProductForm({
      name: '',
      price: '',
      description: '',
      imageUrl: '',
      category: fallbackCategory,
      order: String(nextOrder),
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
      allow_immediate: true,
      allow_scheduled: true,
      discount_type: '',
      discount_value: '',
      is_crosssell: false,
    });
    setProductModalOpen(true);
  };

  const openEditProduct = async (product) => {
    if (catalogOptionGroups.length === 0) {
      fetchCatalogOptionGroups();
    }
    const fallbackOrder = products.reduce((max, item) => {
      const current = Number(item?.order ?? item?.sort_order);
      return Number.isFinite(current) ? Math.max(max, current) : max;
    }, 0) + 1;
    const fallbackCategory = productCategoryOptions[0] || '';

    const selectedProduct = products.find((item) => String(item?.id) === String(product?.id)) || product;

    setEditingProduct(selectedProduct);
    setProductForm({
      name: getProductName(selectedProduct),
      price: String(selectedProduct?.price ?? ''),
      description: getProductDescription(selectedProduct),
      imageUrl: selectedProduct?.img || selectedProduct?.image || '',
      category: selectedProduct?.category || fallbackCategory,
      order: String(selectedProduct?.order ?? selectedProduct?.sort_order ?? fallbackOrder),
      calories: String(selectedProduct?.calories ?? selectedProduct?.cal ?? selectedProduct?.kcal ?? ''),
      protein: String(selectedProduct?.protein ?? ''),
      carbs: String(selectedProduct?.carbs ?? ''),
      fats: String(selectedProduct?.fats ?? selectedProduct?.fat ?? ''),
      allow_immediate: selectedProduct?.allow_immediate !== false,
      allow_scheduled: selectedProduct?.allow_scheduled !== false,
      discount_type: selectedProduct?.discount_type || '',
      discount_value: String(selectedProduct?.discount_value ?? ''),
      is_crosssell: Boolean(selectedProduct?.is_crosssell),
    });
    const embeddedGroups = Array.isArray(selectedProduct?.product_option_groups) ? selectedProduct.product_option_groups : [];
    const embeddedSelectedGroupIds = embeddedGroups
      .map((row) => {
        const groupId = String(row?.group_id ?? row?.groupId ?? row?.option_groups?.id ?? row?.id ?? '').trim();
        const rawOrder = Number(row?.sort_order ?? row?.sortOrder ?? 0);
        return {
          groupId,
          sortOrder: Number.isFinite(rawOrder) ? rawOrder : 0,
        };
      })
      .filter((row) => row.groupId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => row.groupId);

    setProductSelectedGroupIds(embeddedSelectedGroupIds);
    try {
      const selectedGroupIds = await fetchProductGroupLinks(selectedProduct?.id);
      const normalizedSelected = selectedGroupIds
        .map((id) => String(id || '').trim())
        .filter(Boolean);
      setProductSelectedGroupIds(normalizedSelected);
    } catch (err) {
      setProductSelectedGroupIds(embeddedSelectedGroupIds);
      console.error('Ürün düzenleme modalı için seçim grupları yüklenemedi:', err);
      setPanelError(err?.message || 'Ürüne bağlı seçim grupları alınamadı.');
    }
    setProductModalOpen(true);
  };

  const saveProduct = async () => {
    setPanelError('');
    setPanelInfo('');
    console.log('Ürün kaydet işlemi başlatıldı. Seçili seçim grupları:', productSelectedGroupIds);

    if (!productForm.name.trim()) {
      setPanelError('Ürün adı zorunlu.');
      return;
    }

    const parsedPrice = Number(productForm.price || 0);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setPanelError('Geçerli bir fiyat girin.');
      return;
    }

    const parsedOrder = Number(productForm.order || 0);
    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      setPanelError('Geçerli bir sıra değeri girin.');
      return;
    }

    const parseOptionalMacro = (value, label) => {
      const normalized = String(value ?? '').trim().replace(',', '.');
      if (!normalized) return 0;
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setPanelError(`${label} için geçerli bir sayı girin.`);
        return null;
      }
      return parsed;
    };

    const parsedCalories = parseOptionalMacro(productForm.calories, 'Kalori');
    if (parsedCalories === null) return;
    const parsedProtein = parseOptionalMacro(productForm.protein, 'Protein');
    if (parsedProtein === null) return;
    const parsedCarbs = parseOptionalMacro(productForm.carbs, 'Karbonhidrat');
    if (parsedCarbs === null) return;
    const parsedFats = parseOptionalMacro(productForm.fats, 'Yağ');
    if (parsedFats === null) return;

    setProductSaving(true);

    try {
      const normalizedCategory = String(productForm.category || '').trim();
      const canonicalPayload = {
        name: productForm.name.trim(),
        price: parsedPrice,
        desc: productForm.description.trim(),
        description: productForm.description.trim(),
        img: productForm.imageUrl.trim(),
        category: normalizedCategory,
        order: Math.round(parsedOrder),
        sort_order: Math.round(parsedOrder),
        display_order: Math.round(parsedOrder),
        position: Math.round(parsedOrder),
        calories: parsedCalories,
        cal: parsedCalories,
        kcal: parsedCalories,
        protein: parsedProtein,
        carbs: parsedCarbs,
        fats: parsedFats,
        fat: parsedFats,
        allow_immediate: productForm.allow_immediate,
        allow_scheduled: productForm.allow_scheduled,
        discount_type: productForm.discount_type || null,
        discount_value: productForm.discount_value ? Number(productForm.discount_value) : null,
        is_crosssell: Boolean(productForm.is_crosssell),
      };

      if (editingProduct?.id) {
        const payload = {};
        const hasColumn = (columnName) => Object.prototype.hasOwnProperty.call(editingProduct || {}, columnName);

        ['name', 'title'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.name;
        });
        ['desc', 'description'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.desc;
        });
        ['img', 'image', 'image_url'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.img;
        });
        ['category'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.category;
        });
        ['price', 'cost', 'amount'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.price;
        });
        ['order', 'sort_order', 'display_order', 'position'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.order;
        });
        ['calories', 'cal', 'kcal'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.calories;
        });
        ['protein'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.protein;
        });
        ['carbs'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.carbs;
        });
        ['fats', 'fat'].forEach((columnName) => {
          if (hasColumn(columnName)) payload[columnName] = canonicalPayload.fats;
        });
        payload.is_crosssell = Boolean(productForm.is_crosssell);

        if (Object.keys(payload).length === 0) {
          setPanelError('Bu ürün için güncellenebilir alan bulunamadı.');
          return;
        }

        const updated = await safeUpdateById('products', editingProduct.id, payload);
        await syncProductGroupLinks(updated?.id || editingProduct.id, productSelectedGroupIds);
        setPanelInfo('Ürün güncellendi.');
        await fetchProducts();
        emitProductsSyncSignal();
      } else {
        const created = await safeInsert('products', { ...canonicalPayload, type: 'meal' });
        await syncProductGroupLinks(created?.id, productSelectedGroupIds);
        setPanelInfo('Yeni ürün eklendi.');
        await fetchProducts();
        emitProductsSyncSignal();
      }

      setProductModalOpen(false);
    } catch (err) {
      console.error('Ürün kaydetme hatası (grup senkronu dahil):', err);
      setPanelError(getDetailedErrorMessage(err, 'Ürün kaydedilemedi.'));
    } finally {
      setProductSaving(false);
    }
  };

  const toggleProductCrosssell = async (product) => {
    if (!product?.id) return;
    setPanelError('');
    setPanelInfo('');
    setProductCrosssellSavingId(String(product.id));
    try {
      const nextValue = !Boolean(product?.is_crosssell);
      const updated = await safeUpdateById('products', product.id, { is_crosssell: nextValue });
      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setPanelInfo(nextValue ? 'Ürün sepette önerilenlere eklendi.' : 'Ürün sepette önerilenlerden çıkarıldı.');
      emitProductsSyncSignal();
    } catch (err) {
      setPanelError(err?.message || 'Sepette öner durumu güncellenemedi.');
    } finally {
      setProductCrosssellSavingId('');
    }
  };

  const toggleProductAvailability = async (product) => {
    setPanelError('');
    setPanelInfo('');

    const nextValue = !getAvailability(product);
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(product || {}, 'in_stock')) payload.in_stock = nextValue;
    if (Object.prototype.hasOwnProperty.call(product || {}, 'is_available')) payload.is_available = nextValue;
    if (Object.prototype.hasOwnProperty.call(product || {}, 'is_active')) payload.is_active = nextValue;

    if (Object.keys(payload).length === 0) {
      setPanelError('Stok durumu için güncellenebilir alan bulunamadı.');
      return;
    }

    try {
      const updated = await safeUpdateById('products', product.id, payload);

      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setPanelInfo('Stok durumu güncellendi.');
      emitProductsSyncSignal();
    } catch (err) {
      setPanelError(err?.message || 'Stok durumu güncellenemedi.');
    }
  };

  const clearInlineDrafts = (productId) => {
    setProductNameDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setProductDescriptionDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setProductCategoryDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setProductPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setProductOrderDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const saveInlineProductRow = async (product) => {
    const rawName = productNameDrafts[product.id] ?? getProductName(product);
    const rawDescription = productDescriptionDrafts[product.id] ?? getProductDescription(product);
    const rawCategory = productCategoryDrafts[product.id] ?? String(product?.category || '');
    const rawPrice = productPriceDrafts[product.id] ?? product?.price ?? '';
    const rawOrder = productOrderDrafts[product.id]
      ?? product?.order
      ?? product?.sort_order
      ?? product?.display_order
      ?? product?.position
      ?? '';

    const nextName = String(rawName || '').trim();
    const nextDescription = String(rawDescription || '').trim();
    const normalizedCategory = String(rawCategory || '').trim();
    const nextCategory = normalizedCategory;
    const nextPrice = Number(
      typeof rawPrice === 'string'
        ? rawPrice.trim().replace(',', '.')
        : rawPrice
    );
    const nextOrder = Number(rawOrder);

    if (!nextName) {
      setPanelError('Ürün adı boş olamaz.');
      return;
    }
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setPanelError('Geçerli bir fiyat girin.');
      return;
    }
    if (!Number.isFinite(nextOrder) || nextOrder < 0) {
      setPanelError('Sıra için 0 veya daha büyük bir sayı girin.');
      return;
    }
    const roundedNextOrder = Math.round(nextOrder);
    const hasColumn = (columnName) => Object.prototype.hasOwnProperty.call(product || {}, columnName);
    const payload = {};

    const applyColumns = (columns, value) => {
      let supported = false;
      columns.forEach((columnName) => {
        if (hasColumn(columnName)) {
          payload[columnName] = value;
          supported = true;
        }
      });
      return supported;
    };

    applyColumns(['name', 'title'], nextName);
    applyColumns(['desc', 'description'], nextDescription);
    applyColumns(['category'], nextCategory);
    applyColumns(['price', 'cost', 'amount'], nextPrice);
    applyColumns(['order', 'sort_order', 'display_order', 'position'], roundedNextOrder);

    if (Object.keys(payload).length === 0) {
      setPanelError('Bu ürün için güncellenebilir alan bulunamadı.');
      return;
    }

    setProductRowSavingId(String(product.id));
    setPanelError('');
    setPanelInfo('');

    try {
      let updatedRow = product;
      if (Object.keys(payload).length > 0) {
        updatedRow = await safeUpdateById('products', product.id, payload);
      }

      setProducts((prev) => prev.map((item) => (item.id === updatedRow.id ? updatedRow : item)));

      clearInlineDrafts(product.id);
      setPanelInfo('Ürün bilgileri güncellendi.');
      await refetchProductsAndNotify();
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Ürün güncellenemedi.'));
    } finally {
      setProductRowSavingId('');
    }
  };

  const toggleProductFavorite = async (product, nextValue) => {
    if (!product?.id) return;

    setFavoriteSavingId(String(product.id));
    setPanelError('');
    setPanelInfo('');

    try {
      const currentMaxFavoriteOrder = favoriteProducts.reduce((max, item) => {
        const current = Number(item?.favorite_order);
        return Number.isFinite(current) ? Math.max(max, current) : max;
      }, 0);

      const nextFavoriteOrder = nextValue ? currentMaxFavoriteOrder + 10 : null;
      const { data, error } = await supabase
        .from('products')
        .update({
          is_favorite: nextValue,
          favorite_order: nextFavoriteOrder,
        })
        .eq('id', product.id)
        .select('*')
        .single();

      if (error) throw error;

      setProducts((prev) => prev
        .map((item) => (item.id === product.id ? { ...item, ...data } : item))
        .sort((a, b) => getEffectiveProductOrder(a) - getEffectiveProductOrder(b)));
      if (!nextValue) {
        setFavoriteOrderDrafts((prev) => {
          const next = { ...prev };
          delete next[product.id];
          return next;
        });
      }

      setPanelInfo(nextValue ? 'Ürün favori lezzetlere eklendi.' : 'Ürün favori lezzetlerden kaldırıldı.');
      emitProductsSyncSignal();
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Favori durumu güncellenemedi.'));
    } finally {
      setFavoriteSavingId('');
    }
  };

  const saveFavoriteOrder = async (product) => {
    const rawValue = favoriteOrderDrafts[product.id] ?? product?.favorite_order ?? '';
    const parsedOrder = Number(rawValue);

    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      setPanelError('Favori sıra için 0 veya daha büyük bir sayı girin.');
      return;
    }

    const roundedOrder = Math.round(parsedOrder);
    const currentOrder = Number.isFinite(getFavoriteOrder(product)) ? Math.round(getFavoriteOrder(product)) : -1;

    if (roundedOrder === currentOrder) {
      setPanelError('');
      setPanelInfo('Favori sırası zaten güncel.');
      setFavoriteOrderDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      return;
    }

    setFavoriteSavingId(String(product.id));
    setPanelError('');
    setPanelInfo('');

    try {
      const updated = await safeUpdateById('products', product.id, {
        is_favorite: true,
        favorite_order: roundedOrder,
      });
      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setFavoriteOrderDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setPanelInfo('Favori ürün sırası güncellendi.');
      emitProductsSyncSignal();
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Favori ürün sırası güncellenemedi.'));
    } finally {
      setFavoriteSavingId('');
    }
  };

  const handleFavoriteSelectionChange = (event) => {
    const selectedValues = Array.from(event.target.selectedOptions || []).map((option) => String(option.value));
    setFavoriteSelectionIds(selectedValues);
  };

  const addSelectedProductsToFavorites = async () => {
    if (favoriteSelectionIds.length === 0) {
      setPanelError('Favorilere eklemek için en az bir ürün seçin.');
      return;
    }

    const selectedSet = new Set(favoriteSelectionIds.map((id) => String(id)));
    const selectedProducts = favoriteCandidateProducts.filter((item) => selectedSet.has(String(item.id)));
    if (selectedProducts.length === 0) {
      setPanelError('Seçili ürünler bulunamadı.');
      return;
    }

    let maxFavoriteOrder = favoriteProducts.reduce((max, item) => {
      const current = Number(item?.favorite_order);
      return Number.isFinite(current) ? Math.max(max, current) : max;
    }, 0);

    setFavoriteBulkSaving(true);
    setPanelError('');
    setPanelInfo('');

    try {
      const persistedFavoriteOrderMap = {};
      for (const product of selectedProducts) {
        const alreadyFavorite = getFavoriteFlag(product);
        const payload = {
          is_favorite: true,
        };

        if (!alreadyFavorite) {
          maxFavoriteOrder += 10;
          payload.favorite_order = maxFavoriteOrder;
        } else {
          const currentOrder = getFavoriteOrder(product);
          if (!Number.isFinite(currentOrder)) {
            maxFavoriteOrder += 10;
            payload.favorite_order = maxFavoriteOrder;
          }
        }

        const updated = await safeUpdateById('products', product.id, payload);
        const persistedOrder = Number(updated?.favorite_order);
        if (Number.isFinite(persistedOrder)) {
          persistedFavoriteOrderMap[String(product.id)] = persistedOrder;
        } else if (Number.isFinite(Number(payload.favorite_order))) {
          persistedFavoriteOrderMap[String(product.id)] = Number(payload.favorite_order);
        }
        setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }

      if (Object.keys(persistedFavoriteOrderMap).length > 0) {
        setProducts((prev) => prev.map((item) => {
          const nextOrder = persistedFavoriteOrderMap[String(item.id)];
          if (!Number.isFinite(nextOrder)) return item;
          return { ...item, favorite_order: nextOrder };
        }));
      }

      setFavoriteSelectionIds([]);
      setPanelInfo(`${selectedProducts.length} ürün favori lezzetlere eklendi/güncellendi.`);
      emitProductsSyncSignal();
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Favori ürünler eklenemedi.'));
    } finally {
      setFavoriteBulkSaving(false);
    }
  };

  const handleProductDragStart = (event, productId) => {
    if (productCategoryFilter !== 'Tümü') return;
    const nextId = String(productId);
    draggedProductIdRef.current = nextId;
    setDraggedProductId(nextId);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', nextId);
    }
  };

  const handleProductDrop = async (targetId, droppedProductId = '') => {
    const sourceId = String(droppedProductId || draggedProductIdRef.current || draggedProductId || '').trim();

    if (!sourceId || !targetId || sourceId === String(targetId)) {
      draggedProductIdRef.current = '';
      setDraggedProductId('');
      setDragOverProductId('');
      return;
    }

    if (productCategoryFilter !== 'Tümü') {
      setPanelError('Sıralama yapmak için kategori filtresini "Tümü" yapmalısınız.');
      draggedProductIdRef.current = '';
      setDraggedProductId('');
      setDragOverProductId('');
      return;
    }

    const sorted = [...products].sort((a, b) => {
      const orderDiff = getEffectiveProductOrder(a) - getEffectiveProductOrder(b);
      if (orderDiff !== 0) return orderDiff;
      return compareProductsByOrder(a, b);
    });
    const sourceIndex = sorted.findIndex((item) => String(item.id) === sourceId);
    const targetIndex = sorted.findIndex((item) => String(item.id) === String(targetId));
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reorderedList = [...sorted];
    const [movedItem] = reorderedList.splice(sourceIndex, 1);
    reorderedList.splice(targetIndex, 0, movedItem);

    const updates = reorderedList.map((product, index) => ({
      id: product.id,
      order: (index + 1) * 10,
    }));

    setProducts((prev) => prev
      .map((item) => {
        const update = updates.find((row) => String(row.id) === String(item.id));
        return update ? { ...item, order: update.order } : item;
      })
      .sort((a, b) => getEffectiveProductOrder(a) - getEffectiveProductOrder(b)));

    setProductsReorderSaving(true);
    setPanelError('');
    setPanelInfo('Sıralama güncelleniyor...');

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update({ order: update.order })
          .eq('id', update.id);
        if (error) throw error;
      }
      setPanelInfo('Ürün sıralaması başarıyla kaydedildi.');
      await fetchProducts();
      emitProductsSyncSignal();
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Sıralama kaydedilirken hata oluştu.'));
      await fetchProducts();
    } finally {
      setProductsReorderSaving(false);
      draggedProductIdRef.current = '';
      setDraggedProductId('');
      setDragOverProductId('');
    }
  };

  const deleteProduct = async (product) => {
    if (!product?.id) return;

    const confirmed = window.confirm(`"${getProductName(product)}" ürününü silmek istiyor musunuz?`);
    if (!confirmed) return;

    setProductDeleteId(String(product.id));
    setPanelError('');
    setPanelInfo('');

    try {
      await safeDeleteById('products', product.id);
      setProducts((prev) => prev.filter((item) => String(item.id) !== String(product.id)));
      setProductNameDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setProductDescriptionDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setProductCategoryDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setProductPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setProductOrderDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setFavoriteOrderDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setPanelInfo('Ürün silindi.');
      emitProductsSyncSignal();
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Ürün silinemedi.'));
    } finally {
      setProductDeleteId('');
    }
  };

  const openCreateBanner = () => {
    setEditingBanner(null);
    setBannerForm({ title: '', image_url: '', link: '/offers', order: '1', is_active: true });
    setBannerModalOpen(true);
  };

  const openEditBanner = (banner) => {
    setEditingBanner(banner);
    setBannerForm({
      title: banner?.title || '',
      image_url: banner?.image_url || '',
      link: banner?.link || '/offers',
      order: String(banner?.order ?? 1),
      is_active: Boolean(banner?.is_active),
    });
    setBannerModalOpen(true);
  };

  const saveBanner = async () => {
    setPanelError('');
    setPanelInfo('');

    if (!bannerForm.image_url.trim()) {
      setPanelError('Banner görseli zorunlu.');
      return;
    }

    setBannerSaving(true);

    try {
      const payload = {
        title: String(bannerForm.title || '').trim(),
        image_url: bannerForm.image_url.trim(),
        link: bannerForm.link.trim() || '/offers',
        order: Number(bannerForm.order || 0),
        is_active: Boolean(bannerForm.is_active),
      };

      if (editingBanner?.id) {
        const updated = await safeUpdateById('banners', editingBanner.id, payload);
        setBanners((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setPanelInfo('Banner güncellendi.');
      } else {
        const created = await safeInsert('banners', payload);
        setBanners((prev) => [...prev, created].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)));
        setPanelInfo('Yeni banner eklendi.');
      }

      setBannerModalOpen(false);
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Banner kaydedilemedi.'));
    } finally {
      setBannerSaving(false);
    }
  };

  const deleteBanner = async (banner) => {
    if (!banner?.id) return;

    const confirmed = window.confirm('Bu bannerı silmek istediğinize emin misiniz?');
    if (!confirmed) return;

    setPanelError('');
    setPanelInfo('');
    setBannerDeleteId(String(banner.id));

    try {
      const storagePath = extractStoragePathFromPublicUrl(banner?.image_url, IMAGE_BUCKET);
      let storageWarning = '';

      if (storagePath) {
        const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
        if (storageError) {
          storageWarning = ' Görsel dosyası storage tarafında silinemedi.';
        }
      }

      await safeDeleteById('banners', banner.id);
      setBanners((prev) => prev.filter((item) => String(item.id) !== String(banner.id)));
      if (String(editingBanner?.id || '') === String(banner.id)) {
        setBannerModalOpen(false);
        setEditingBanner(null);
      }

      const successMessage = `Banner başarıyla silindi.${storageWarning}`;
      setPanelInfo(successMessage);
      window.alert('Banner başarıyla silindi.');
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Banner silinemedi.'));
    } finally {
      setBannerDeleteId('');
    }
  };

  const openCreateCampaign = () => {
    setEditingCampaign(null);
    setCampaignForm({
      title: '',
      description: '',
      code: '',
      badge: 'Fırsat',
      discount_type: 'percent',
      discount_value: '10',
      max_discount: '0',
      min_cart_total: '0',
      start_date: '',
      end_date: '',
      order: '1',
      is_active: true,
      image_url: '',
      color_from: '#98CD00',
      color_via: '#98CD00',
      color_to: '#98CD00',
    });
    setCampaignModalOpen(true);
  };

  const openEditCampaign = (campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      title: campaign?.title || '',
      description: campaign?.description || '',
      code: campaign?.code || '',
      badge: campaign?.badge || 'Fırsat',
      discount_type: campaign?.discount_type || 'percent',
      discount_value: String(campaign?.discount_value ?? 10),
      max_discount: String(campaign?.max_discount ?? 0),
      min_cart_total: String(campaign?.min_cart_total ?? 0),
      start_date: campaign?.start_date || '',
      end_date: campaign?.end_date || '',
      order: String(campaign?.order ?? 1),
      is_active: Boolean(campaign?.is_active),
      image_url: campaign?.image_url || '',
      color_from: campaign?.color_from || '#98CD00',
      color_via: campaign?.color_via || '#98CD00',
      color_to: campaign?.color_to || '#98CD00',
    });
    setCampaignModalOpen(true);
  };

  const saveCampaign = async () => {
    setPanelError('');
    setPanelInfo('');

    if (!campaignForm.title.trim() || !campaignForm.code.trim()) {
      setPanelError('Kampanya başlığı ve kod zorunlu.');
      return;
    }

    setCampaignSaving(true);

    try {
      const payload = {
        title: campaignForm.title.trim(),
        description: campaignForm.description.trim(),
        code: campaignForm.code.trim(),
        badge: campaignForm.badge.trim() || 'Fırsat',
        discount_type: campaignForm.discount_type,
        discount_value: Number(campaignForm.discount_value || 0),
        max_discount: Number(campaignForm.max_discount || 0),
        min_cart_total: Number(campaignForm.min_cart_total || 0),
        start_date: campaignForm.start_date || null,
        end_date: campaignForm.end_date || null,
        order: Number(campaignForm.order || 0),
        is_active: Boolean(campaignForm.is_active),
        image_url: campaignForm.image_url || null,
        color_from: campaignForm.color_from || '#98CD00',
        color_via: campaignForm.color_via || '#98CD00',
        color_to: campaignForm.color_to || '#98CD00',
      };

      if (editingCampaign?.id) {
        const updated = await safeUpdateById('campaigns', editingCampaign.id, payload);
        setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setPanelInfo('Kampanya güncellendi.');
      } else {
        const created = await safeInsert('campaigns', payload);
        setCampaigns((prev) => [...prev, created].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)));
        setPanelInfo('Yeni kampanya eklendi.');
      }

      setCampaignModalOpen(false);
    } catch (err) {
      setPanelError(getWritableErrorMessage(err, 'Kampanya kaydedilemedi.'));
    } finally {
      setCampaignSaving(false);
    }
  };

  const saveStoreSetting = async () => {
    setPanelError('');
    setPanelInfo('');
    setSettingsSaving(true);

    try {
      const payload = {
        id: 1,
        is_shop_open: storeOpen,
        min_cart_amount: Number(minCartAmount || 0),
      };

      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;
      setPanelInfo('Mağaza ayarı kaydedildi.');
    } catch (err) {
      console.log('settings save simulated:', err?.message || err);
      setPanelInfo('Ayarlar tablosu yok. Değer simülasyon modunda tutuldu.');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-brand-white rounded-2xl shadow-xl border border-brand-secondary p-6">
          <h1 className="text-xl font-bold text-brand-dark text-center mb-3">Yönetici Erişimi</h1>
          <p className="text-sm text-brand-dark text-center">Yetkiniz sonlandırıldı.</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 w-full py-3 bg-brand-primary text-brand-white shadow-md font-bold rounded-xl hover:opacity-90 transition-colors"
          >
            Giriş Ekranına Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-skin ${hideAdminChrome ? '' : 'min-h-screen pb-8'}`}>
      <audio ref={notificationAudioRef} src={ALARM_SOUND_URL} preload="auto" className="hidden" />
      <style>
        {`
          @media print {
            @page {
              size: 80mm auto;
              margin: 4mm;
            }
            body * {
              visibility: hidden !important;
            }
            #print-receipt, #print-receipt * {
              visibility: visible !important;
            }
            #print-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
              margin: 0;
              padding: 0;
              background: #FFFFFF;
              color: #202020;
              font-family: "Courier New", monospace;
            }
          }
        `}
      </style>
      {!hideAdminChrome && (
      <header className="admin-topbar sticky top-0 z-40 bg-brand-white border-b border-brand-secondary px-4 py-3">
        <div className="admin-topbar-inner flex justify-between items-center">
          <h1 className="text-lg font-bold text-brand-dark">Admin Paneli</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => playNotificationSound()}
              className="px-3 h-9 rounded-lg inline-flex items-center justify-center gap-1.5 border border-brand-secondary bg-brand-secondary text-brand-dark text-xs font-semibold hover:bg-brand-secondary transition-colors"
              title="Sesi Test Et"
            >
              <Volume2 size={14} />
              Sesi Test Et
            </button>
            <button
              type="button"
              onClick={() => navigate('/boss/tickets')}
              className="px-3 h-9 rounded-lg inline-flex items-center justify-center gap-1.5 border border-brand-secondary bg-brand-bg text-brand-dark text-xs font-semibold hover:bg-brand-bg transition-colors"
              title="Destek Talepleri"
            >
              <MessageSquare size={14} />
              Destek Talepleri
            </button>
            <button
              type="button"
              onClick={() => navigate('/boss/customers')}
              className="px-3 h-9 rounded-lg inline-flex items-center justify-center gap-1.5 border border-brand-secondary bg-brand-bg text-brand-dark text-xs font-semibold hover:bg-brand-bg transition-colors"
              title="Müşteriler"
            >
              <Users size={14} />
              Müşteriler
            </button>
            <button onClick={() => navigate('/')} className="text-sm text-brand-primary font-medium">
              Ana Sayfa
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-secondary hover:bg-brand-secondary text-brand-dark transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        <div className="admin-sidebar-nav mt-3 grid grid-cols-3 sm:grid-cols-10 gap-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'orders' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <ClipboardList size={14} /> Sipariş
          </button>
          <button
            type="button"
            onClick={() => navigate('/boss/scheduled-orders')}
            className="py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 bg-brand-bg text-brand-dark"
          >
            <CalendarClock size={14} /> Randevulu
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'products' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <Package size={14} /> Katalog
          </button>
          <button
            onClick={() => setActiveTab('showcase')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'showcase' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <Megaphone size={14} /> Vitrin
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'categories' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <Tags size={14} /> Kategoriler
          </button>
          <button
            onClick={() => setActiveTab('options')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'options' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <Tags size={14} /> Seçenekler
          </button>
          <button
            onClick={() => setActiveTab('delivery_zones')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'delivery_zones' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <Truck size={14} /> Teslimat Bölgeleri
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'settings' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <Settings size={14} /> Ayarlar
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'finance' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <Wallet size={14} /> Kasa
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'reviews' ? 'bg-brand-primary text-brand-white shadow-md' : 'bg-brand-bg text-brand-dark'
            }`}
          >
            <MessageSquare size={14} /> Yorumlar
          </button>
        </div>
      </header>
      )}

      {(panelError || panelInfo) && (
        <div className="admin-alert-stack px-4 pt-3 space-y-2">
          {panelError && (
            <div className="bg-brand-secondary border border-brand-secondary rounded-xl px-3 py-2 text-xs text-brand-dark">{panelError}</div>
          )}
          {panelInfo && (
            <div className="bg-brand-secondary border border-brand-secondary rounded-xl px-3 py-2 text-xs text-brand-dark">{panelInfo}</div>
          )}
        </div>
      )}

      <main className={`admin-content ${hideAdminChrome ? '' : 'p-4'}`}>
        {activeTab === 'orders' && (
          <section>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => setOrdersSubTab('incoming')}
                className={`py-2 rounded-xl text-xs font-bold ${
                  ordersSubTab === 'incoming'
                    ? 'bg-brand-primary text-brand-white shadow-md'
                    : 'bg-brand-white border border-brand-secondary text-brand-dark'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <BellRing size={12} /> Gelen ({incomingOrders.length})
                </span>
              </button>
              <button
                onClick={() => setOrdersSubTab('scheduled')}
                className={`py-2 rounded-xl text-xs font-bold ${
                  ordersSubTab === 'scheduled'
                    ? 'bg-brand-primary text-brand-white shadow-md'
                    : 'bg-brand-white border border-brand-secondary text-brand-dark'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={12} /> Randevulu ({scheduledOrders.length})
                </span>
              </button>
              <button
                onClick={() => setOrdersSubTab('history')}
                className={`py-2 rounded-xl text-xs font-bold ${
                  ordersSubTab === 'history'
                    ? 'bg-brand-primary text-brand-white shadow-md'
                    : 'bg-brand-white border border-brand-secondary text-brand-dark'
                }`}
              >
                Geçmiş ({historyOrders.length})
              </button>
            </div>

            {ordersLoading ? (
              <p className="text-brand-dark text-center py-8">Yükleniyor...</p>
            ) : visibleOrders.length === 0 ? (
              <p className="text-brand-dark text-center py-8">
                {ordersSubTab === 'incoming' && 'Gelen / acil sipariş bulunmuyor.'}
                {ordersSubTab === 'scheduled' && 'Randevulu sipariş bulunmuyor.'}
                {ordersSubTab === 'history' && 'Geçmiş sipariş bulunmuyor.'}
              </p>
            ) : (
              <div className="space-y-3">
                {visibleOrders.map((order) => {
                  const normalizedStatus = normalizeOrderStatus(order.status);
                  const deliveryTimeType = normalizeDeliveryTimeType((order.delivery_type || order.delivery_time_type));
                  const minutesToScheduled = getMinutesToScheduled(order, nowDate);
                  const isApproachingScheduled = deliveryTimeType === 'scheduled' && isScheduledApproaching(order, nowDate);
                  const isBlinkingAlert = ordersSubTab === 'incoming' && normalizedStatus === 'pending';
                  const isExpanded = expandedOrderId === String(order.id);
                  const orderItems = Array.isArray(order.items) ? order.items : [];
                  const note = order.customer_note || order.note || order.order_note || '';
                  const completionDate = order.updated_at || order.delivered_at || order.created_at;
                  const scheduledDateTime = parseScheduledDateTime(order);

                  const nextAction = (() => {
                    if (
                      ordersSubTab === 'scheduled' &&
                      normalizedStatus === 'pending' &&
                      deliveryTimeType === 'scheduled'
                    ) {
                      return {
                        label: 'Beklemede',
                        status: null,
                        className: 'bg-brand-bg text-brand-dark border border-brand-secondary',
                        icon: Clock3,
                        disabled: true,
                      };
                    }

                    if (normalizedStatus === 'pending') {
                      return {
                        label: 'Onayla & Hazırla',
                        status: 'preparing',
                        className: 'bg-brand-secondary text-brand-dark',
                        icon: CheckCircle2,
                        disabled: false,
                      };
                    }
                    if (normalizedStatus === 'preparing') {
                      return {
                        label: 'Kuryeye Ver',
                        status: 'on_way',
                        className: 'bg-brand-secondary text-brand-dark',
                        icon: Truck,
                        disabled: false,
                      };
                    }
                    if (normalizedStatus === 'on_way') {
                      return {
                        label: 'Teslim Et & Tamamla',
                        status: 'delivered',
                        className: 'bg-brand-secondary text-brand-dark',
                        icon: CheckCircle2,
                        disabled: false,
                      };
                    }
                    return null;
                  })();

                  return (
                    <article
                      key={order.id}
                      className={`bg-brand-white rounded-2xl border shadow-sm overflow-hidden ${
                        isBlinkingAlert
                          ? 'border-brand-secondary animate-pulse bg-brand-secondary/40'
                          : 'border-brand-secondary'
                      }`}
                    >
                      <button
                        onClick={() => setExpandedOrderId((prev) => (prev === String(order.id) ? '' : String(order.id)))}
                        className="w-full px-4 py-3 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-brand-dark">{formatDate(order.created_at)}</p>
                            <p className="text-sm font-bold text-brand-primary">{order.paytr_oid || order.id}</p>
                            <p className="text-xs text-brand-dark mt-0.5">{order.customer_name || 'Müşteri'} · {order.phone || '-'}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                deliveryTimeType === 'scheduled'
                                  ? 'bg-brand-secondary text-brand-dark'
                                  : 'bg-brand-secondary text-brand-dark'
                              }`}>
                                {deliveryTimeType === 'scheduled' ? 'Randevulu' : 'Hemen'}
                              </span>
                              {isApproachingScheduled && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-secondary text-brand-dark">
                                  ⏰ Randevu Saati Yaklaştı!
                                </span>
                              )}
                              {deliveryTimeType === 'scheduled' && scheduledDateTime && (
                                <span className="text-[10px] text-brand-dark">
                                  {minutesToScheduled !== null ? `${Math.max(minutesToScheduled, 0)} dk` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusClass(normalizedStatus)}`}>
                            {STATUS_LABELS[normalizedStatus] || normalizedStatus}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 border-t border-brand-secondary">
                          <div className="mt-3 rounded-xl border border-dashed border-brand-secondary p-3 space-y-1.5">
                            <p className="text-[11px] text-brand-dark">Adisyon Bilgisi</p>
                            <p className="text-sm font-semibold text-brand-dark">Müşteri: {order.customer_name || '—'}</p>
                            <p className="text-sm text-brand-dark">Telefon: {order.phone || '—'}</p>
                            <p className="text-sm text-brand-dark">Adres: {order.address || '—'}</p>
                            <p className="text-sm text-brand-dark">
                              Teslimat: {deliveryTimeType === 'scheduled' ? 'Randevulu' : 'Hemen'}
                            </p>
                            {deliveryTimeType === 'scheduled' && (
                              <p className="text-sm text-brand-dark">
                                Randevu: {scheduledDateTime ? formatDate(scheduledDateTime.toISOString()) : `${order.scheduled_date || '—'} ${order.scheduled_slot || ''}`}
                              </p>
                            )}
                            {note && <p className="text-sm text-brand-dark">Not: {note}</p>}
                          </div>

                          <div className="mt-2 text-sm">
                            <p className="text-xs text-brand-dark mb-1">Ürünler</p>
                            {orderItems.length > 0 ? (
                              <ul className="space-y-1">
                                {orderItems.map((item, i) => (
                                  <li key={`${order.id}-${i}`} className="text-brand-dark">
                                    {(item.quantity || 1)} x {item.name || 'Ürün'}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-brand-dark text-xs">Ürün detayı yok</p>
                            )}
                          </div>

                          <p className="mt-2 text-base font-bold text-brand-primary">{formatCurrency(order.total_price)}</p>
                        </div>
                      )}

                      <div className="px-4 pb-4 pt-2 border-t border-brand-secondary flex items-center justify-between gap-2">
                        <div>
                          {nextAction ? (
                            <button
                              onClick={() => nextAction.status && updateOrderStatus(order.id, nextAction.status)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${nextAction.className} ${
                                nextAction.disabled ? 'cursor-not-allowed' : ''
                              }`}
                              disabled={nextAction.disabled}
                            >
                              <nextAction.icon size={12} /> {nextAction.label}
                            </button>
                          ) : normalizedStatus === 'delivered' ? (
                            <p className="text-xs font-bold text-brand-dark">
                              Tamamlandı • {formatDate(completionDate)}
                            </p>
                          ) : normalizedStatus === 'cancelled' ? (
                            <p className="text-xs font-bold text-brand-dark">
                              İptal Edildi • {formatDate(completionDate)}
                            </p>
                          ) : null}
                        </div>
                        <button
                          onClick={() => handlePrintOrder(order)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-bg text-brand-dark hover:bg-brand-bg"
                        >
                          🖨️ Yazdır (Fiş)
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'products' && (
          <section>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl border border-brand-secondary text-xs font-semibold text-brand-dark bg-brand-white"
                >
                  <option value="Tümü">Tümü</option>
                  {productCategoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl border border-brand-secondary text-xs font-semibold text-brand-dark bg-brand-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productCrosssellOnly}
                    onChange={(e) => setProductCrosssellOnly(e.target.checked)}
                    className="accent-green-600"
                  />
                  Sadece Crosssell
                </label>
              </div>
              <button
                onClick={openCreateProduct}
                className="px-3 py-2 rounded-xl bg-brand-primary text-brand-white shadow-md hover:opacity-90 text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus size={14} /> Yeni Ürün Ekle
              </button>
            </div>

            <p className="mb-3 text-[11px] text-brand-dark">
              Masaüstü kullanım için optimize edildi: Sürükle-bırak ile sıralama yapın, satırdaki tüm alanları düzenleyip tek `Kaydet` ile güncelleyin. (Drag-drop yalnızca `Tümü`)
            </p>

            {productsLoading ? (
              <p className="text-brand-dark text-center py-8">Yükleniyor...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-brand-dark text-center py-8">
                {productCrosssellOnly ? 'Sepette önerilecek ürün bulunamadı.' : 'Seçili kategoride ürün bulunamadı.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {filteredProducts.map((product, index) => {
                  const available = getAvailability(product);
                  const isFavorite = favoriteIdSet.has(String(product.id));
                  const inlineDescriptionValue = productDescriptionDrafts[product.id] ?? getProductDescription(product);
                  const inlinePriceValue = productPriceDrafts[product.id] ?? String(product?.price ?? '');
                  const inlineOrderValue = productOrderDrafts[product.id] ?? (
                    (() => {
                      const rawOrder = getEffectiveProductOrder(product);
                      if (!Number.isFinite(rawOrder) || rawOrder === Number.MAX_SAFE_INTEGER) return '';
                      return String(rawOrder);
                    })()
                  );
                  const inlineNameValue = productNameDrafts[product.id] ?? getProductName(product);
                  const inlineCategoryValue = productCategoryDrafts[product.id] ?? String(product?.category || '');
                  const isDragOver = String(dragOverProductId) === String(product.id);
                  const isDragging = String(draggedProductId) === String(product.id);
                  const effectiveOrder = getEffectiveProductOrder(product);
                  const visualOrder = Number.isFinite(effectiveOrder) && effectiveOrder !== Number.MAX_SAFE_INTEGER
                    ? effectiveOrder
                    : index + 1;

                  return (
                    <article
                      key={product.id}
                      onDragOver={(e) => {
                        if (productCategoryFilter !== 'Tümü') return;
                        e.preventDefault();
                        if (e.dataTransfer) {
                          e.dataTransfer.dropEffect = 'move';
                        }
                        setDragOverProductId(String(product.id));
                      }}
                      onDragLeave={() => {
                        if (String(dragOverProductId) === String(product.id)) {
                          setDragOverProductId('');
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceId = e.dataTransfer?.getData('text/plain') || '';
                        handleProductDrop(product.id, sourceId);
                      }}
                      onDragEnd={() => {
                        draggedProductIdRef.current = '';
                        setDraggedProductId('');
                        setDragOverProductId('');
                      }}
                      className={`bg-brand-white rounded-2xl border border-brand-secondary shadow-sm px-3 py-2.5 transition-all ${
                        isDragOver ? 'ring-2 ring-brand-primary/45' : ''
                      } ${isDragging ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          draggable={productCategoryFilter === 'Tümü'}
                          onDragStart={(e) => handleProductDragStart(e, product.id)}
                          onDragEnd={() => {
                            draggedProductIdRef.current = '';
                            setDraggedProductId('');
                            setDragOverProductId('');
                          }}
                          className={`inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-bg text-brand-dark ${
                            productCategoryFilter === 'Tümü' ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-40'
                          }`}
                          aria-label="Sürükle bırak ile sırala"
                        >
                          <GripVertical size={14} />
                        </button>
                        <img
                          src={getProductImage(product)}
                          alt={getProductName(product)}
                          className="h-10 w-10 shrink-0 rounded-xl bg-brand-bg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-brand-dark leading-tight">{getProductName(product)}</p>
                          <p className="text-[11px] text-brand-dark leading-tight">{product.category || '—'} · #{visualOrder}</p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-brand-dark whitespace-nowrap">
                          {toMoneyText(product.price)}
                        </span>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="text-[11px] text-brand-dark hidden sm:inline">{available ? 'Stokta' : 'Tükendi'}</span>
                          <button
                            onClick={() => toggleProductAvailability(product)}
                            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-all ${available ? 'bg-brand-primary' : 'bg-brand-bg border border-brand-secondary'}`}
                            aria-label="Stok durumunu değiştir"
                          >
                            <span className={`block h-5 w-5 rounded-full bg-brand-white shadow-sm transition-all ${available ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="text-[11px] text-brand-dark hidden sm:inline">Sepette Öner</span>
                          <button
                            onClick={() => toggleProductCrosssell(product)}
                            disabled={productCrosssellSavingId === String(product.id)}
                            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-all disabled:opacity-60 ${Boolean(product?.is_crosssell) ? 'bg-brand-primary' : 'bg-brand-bg border border-brand-secondary'}`}
                            aria-label="Sepette öner durumunu değiştir"
                            title="Sepette Öner (is_crosssell)"
                          >
                            <span className={`block h-5 w-5 rounded-full bg-brand-white shadow-sm transition-all ${Boolean(product?.is_crosssell) ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <button
                            onClick={() => toggleProductFavorite(product, !isFavorite)}
                            disabled={favoriteSavingId === String(product.id)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-60 ${
                              isFavorite ? 'bg-brand-secondary text-brand-primary' : 'bg-brand-bg text-brand-dark'
                            }`}
                            title={isFavorite ? 'Favoriden Çıkar' : 'Favori Yap'}
                          >
                            {favoriteSavingId === String(product.id) ? <Loader2 size={12} className="animate-spin" /> : <Star size={13} className={isFavorite ? 'fill-current' : ''} />}
                          </button>
                          <button
                            onClick={() => openEditProduct(product)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-bg text-brand-dark"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => deleteProduct(product)}
                            disabled={productDeleteId === String(product.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-brand-secondary text-brand-dark inline-flex items-center gap-1 disabled:opacity-60"
                          >
                            {productDeleteId === String(product.id) ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <datalist id="admin-category-options">
              {productCategoryOptions.map((category) => (
                <option key={`admin-category-opt-${category}`} value={category} />
              ))}
            </datalist>

            <div className="mt-5 rounded-2xl border border-brand-secondary bg-brand-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-brand-dark">Favori Lezzetler Yönetimi</h3>
                <span className="text-xs font-semibold text-brand-dark">{favoriteProducts.length} ürün</span>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-brand-dark">
                  Tüm ürünlerden birden fazla seçim yapabilirsiniz. Masaüstünde `Ctrl/Cmd` ile çoklu seçim yapın.
                </p>
                <select
                  multiple
                  value={favoriteSelectionIds}
                  onChange={handleFavoriteSelectionChange}
                  className="h-36 w-full rounded-lg border border-brand-secondary bg-brand-white px-3 py-2 text-sm"
                >
                  {favoriteCandidateProducts.map((product) => (
                    <option key={`favorite-candidate-${product.id}`} value={String(product.id)}>
                      {getProductName(product)} {product?.category ? `• ${product.category}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addSelectedProductsToFavorites}
                  disabled={favoriteSelectionIds.length === 0 || favoriteBulkSaving}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-primary px-3 py-2 text-sm font-bold text-brand-white hover:opacity-90 disabled:opacity-60"
                >
                  {favoriteBulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Seçilenleri Favoriye Ekle
                </button>
              </div>

              {favoriteProducts.length === 0 ? (
                <p className="mt-3 text-xs text-brand-dark">Henüz favori lezzet ürünü seçilmedi.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {favoriteProducts.map((product, index) => (
                    <div
                      key={`favorite-row-${product.id}`}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-brand-secondary bg-brand-bg px-3 py-2 md:grid-cols-[1fr_120px_auto_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-brand-dark">{index + 1}. {getProductName(product)}</p>
                        <p className="text-[11px] text-brand-dark">{product?.category || 'Kategori yok'}</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={favoriteOrderDrafts[product.id] ?? String(product?.favorite_order ?? product?.featured_order ?? '')}
                        onChange={(e) => setFavoriteOrderDrafts((prev) => ({ ...prev, [product.id]: e.target.value }))}
                        className="w-full rounded-lg border border-brand-secondary bg-brand-white px-3 py-1.5 text-xs"
                        placeholder="Favori sıra"
                      />
                      <button
                        onClick={() => saveFavoriteOrder(product)}
                        disabled={favoriteSavingId === String(product.id)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-brand-white hover:opacity-90 disabled:opacity-60"
                      >
                        {favoriteSavingId === String(product.id) ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Sıra
                      </button>
                      <button
                        onClick={() => toggleProductFavorite(product, false)}
                        disabled={favoriteSavingId === String(product.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-white px-3 py-1.5 text-xs font-bold text-brand-dark disabled:opacity-60"
                      >
                        {favoriteSavingId === String(product.id) ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                        Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'categories' && (
          <section className="space-y-4">
            {/* ─── YENİ KATEGORİ EKLE ─── */}
            <div className="rounded-2xl border border-brand-secondary bg-brand-white p-4 shadow-sm">
              <p className="text-sm font-bold text-brand-dark">Yeni Kategori Ekle</p>
              <p className="mt-1 text-xs text-brand-dark">Kategoriler mobil ve admin tarafında anlık kullanılacaktır.</p>

              {/* Görsel seçici */}
              <div className="mt-3 flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-secondary bg-brand-bg">
                  {categoryNewImagePreview ? (
                    <img src={categoryNewImagePreview} alt="Önizleme" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-brand-dark opacity-30">+</div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-secondary bg-brand-bg px-3 py-1.5 text-xs font-bold text-brand-dark hover:bg-brand-secondary">
                    <Upload size={12} />
                    Görsel Seç
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setCategoryNewImageFile(f);
                        setCategoryNewImagePreview(URL.createObjectURL(f));
                      }}
                    />
                  </label>
                  {categoryNewImagePreview && (
                    <button
                      type="button"
                      onClick={() => { setCategoryNewImageFile(null); setCategoryNewImagePreview(''); }}
                      className="text-[11px] text-rose-500 hover:underline text-left"
                    >
                      Görseli Kaldır
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={categoryFormName}
                  onChange={(e) => setCategoryFormName(e.target.value)}
                  placeholder="Kategori adı *"
                  className="rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={categoryFormOrder}
                  onChange={(e) => setCategoryFormOrder(e.target.value)}
                  placeholder="Sıra No"
                  className="rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                />
                <select
                  value={categoryFormParentId}
                  onChange={(e) => setCategoryFormParentId(e.target.value)}
                  className="rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                >
                  <option value="">Üst Kategori — Yok (Ana Kategori)</option>
                  {categories.filter((c) => !c.parent_id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <select
                    value={categoryFormDiscountType}
                    onChange={(e) => setCategoryFormDiscountType(e.target.value)}
                    className="flex-1 rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                  >
                    <option value="">İndirim Yok</option>
                    <option value="percent">Yüzde (%)</option>
                    <option value="fixed">Sabit (₺)</option>
                  </select>
                  {categoryFormDiscountType && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={categoryFormDiscountValue}
                      onChange={(e) => setCategoryFormDiscountValue(e.target.value)}
                      placeholder={categoryFormDiscountType === 'percent' ? 'Oran (%)' : 'Tutar (₺)'}
                      className="w-28 rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                    />
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={saveCategory}
                  disabled={categorySaving}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-white shadow-md hover:opacity-90 disabled:opacity-60"
                >
                  {categorySaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Kategori Ekle
                </button>
              </div>
            </div>

            {/* ─── KATEGORİ LİSTESİ ─── */}
            <div className="rounded-2xl border border-brand-secondary bg-brand-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-brand-dark">Kategori Listesi</p>
                <span className="text-xs font-semibold text-brand-dark">{categories.length} kayıt</span>
              </div>

              {categoriesLoading ? (
                <p className="py-6 text-center text-sm text-brand-dark">Kategoriler yükleniyor...</p>
              ) : categories.length === 0 ? (
                <p className="py-6 text-center text-sm text-brand-dark">Henüz kategori bulunmuyor.</p>
              ) : (
                <div className="space-y-1.5">
                  {[
                    ...categories.filter((c) => !c.parent_id),
                    ...categories.filter((c) => c.parent_id && !categories.find((p) => String(p.id) === String(c.parent_id))),
                  ].map((parent) => {
                    const children = categories.filter((c) => String(c.parent_id) === String(parent.id));
                    const isOrphan = !!parent.parent_id;
                    return (
                      <React.Fragment key={parent.id}>
                        <CategoryRow
                          category={parent}
                          indent={isOrphan}
                          onEdit={openCategoryEdit}
                          onDelete={deleteCategory}
                          deletingId={categoryDeleteId}
                        />
                        {children.map((child) => (
                          <CategoryRow
                            key={child.id}
                            category={child}
                            indent
                            onEdit={openCategoryEdit}
                            onDelete={deleteCategory}
                            deletingId={categoryDeleteId}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── KATEGORİ DÜZENLEME MODALİ ─── */}
            {categoryEditModal && categoryEditItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/40 px-4">
                <div className="w-full max-w-md rounded-3xl border border-brand-secondary bg-brand-white p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-brand-dark">Kategori Düzenle</p>
                    <button
                      type="button"
                      onClick={closeCategoryEdit}
                      disabled={categoryEditSaving || categoryImageUploading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-bg text-brand-dark disabled:opacity-60"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Görsel yönetimi */}
                  <div className="mb-4 flex items-start gap-4 rounded-xl border border-brand-secondary bg-brand-bg p-3">
                    <div className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl border border-brand-secondary bg-brand-white">
                      {categoryEditImageUrl ? (
                        <img src={categoryEditImageUrl} alt="Kategori görseli" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl text-brand-dark opacity-20">+</div>
                      )}
                      {categoryImageUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-brand-white/80">
                          <Loader2 size={22} className="animate-spin text-brand-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-brand-dark">Kategori Görseli</p>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-secondary bg-brand-white px-3 py-1.5 text-xs font-bold text-brand-dark hover:bg-brand-bg disabled:opacity-60">
                        <Upload size={12} />
                        Görsel Yükle
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={categoryImageUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCategoryEditImageUpload(f);
                          }}
                        />
                      </label>
                      {categoryEditImageUrl && (
                        <button
                          type="button"
                          onClick={() => setCategoryEditImageUrl('')}
                          disabled={categoryImageUploading}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-60"
                        >
                          <Trash2 size={11} />
                          Görseli Kaldır
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form alanları */}
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={categoryEditName}
                      onChange={(e) => setCategoryEditName(e.target.value)}
                      placeholder="Kategori adı *"
                      className="rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={categoryEditOrder}
                      onChange={(e) => setCategoryEditOrder(e.target.value)}
                      placeholder="Sıra No"
                      className="rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                    />
                    <select
                      value={categoryEditParentId}
                      onChange={(e) => setCategoryEditParentId(e.target.value)}
                      className="rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                    >
                      <option value="">Üst Kategori — Yok (Ana Kategori)</option>
                      {categories.filter((c) => !c.parent_id && String(c.id) !== String(categoryEditItem.id)).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <select
                        value={categoryEditDiscountType}
                        onChange={(e) => setCategoryEditDiscountType(e.target.value)}
                        className="flex-1 rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                      >
                        <option value="">İndirim Yok</option>
                        <option value="percent">Yüzde (%)</option>
                        <option value="fixed">Sabit (₺)</option>
                      </select>
                      {categoryEditDiscountType && (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={categoryEditDiscountValue}
                          onChange={(e) => setCategoryEditDiscountValue(e.target.value)}
                          placeholder={categoryEditDiscountType === 'percent' ? 'Oran (%)' : 'Tutar (₺)'}
                          className="w-28 rounded-xl border border-brand-secondary px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeCategoryEdit}
                      disabled={categoryEditSaving || categoryImageUploading}
                      className="rounded-xl border border-brand-secondary bg-brand-bg px-4 py-2 text-sm font-bold text-brand-dark disabled:opacity-60"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={saveCategoryEdit}
                      disabled={categoryEditSaving || categoryImageUploading}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-white shadow-md disabled:opacity-60"
                    >
                      {categoryEditSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {(activeTab === 'showcase' || activeTab === 'campaigns') && (
          <section className="space-y-5">
            {activeTab !== 'campaigns' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-brand-dark inline-flex items-center gap-2">
                  <Megaphone size={15} className="text-brand-primary" /> Banner Yönetimi
                </h2>
                <button
                  onClick={openCreateBanner}
                  className="px-3 py-2 rounded-xl bg-brand-primary text-brand-white shadow-md hover:opacity-90 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus size={14} /> Banner Ekle
                </button>
              </div>

              {bannersLoading ? (
                <p className="text-brand-dark text-center py-6">Yükleniyor...</p>
              ) : banners.length === 0 ? (
                <p className="text-brand-dark text-sm">Henüz banner yok.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-brand-dark">Mevcut Bannerlar</h3>
                    <span className="text-xs font-semibold text-brand-dark">{banners.length} kayıt</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {banners.map((banner) => (
                    <article key={banner.id} className="relative bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-3">
                      <img
                        src={banner.image_url}
                        alt={banner?.title || 'Banner'}
                        className="w-full h-32 object-cover rounded-xl bg-brand-bg"
                      />
                      <div className="mt-2">
                        <p className="text-sm font-bold text-brand-dark truncate">{banner?.title || banner?.link || `Banner #${banner.id}`}</p>
                        <p className="text-xs text-brand-dark truncate">{banner.link || '/offers'}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-xs text-brand-dark">Sıra: {Number(banner.order || 0)}</p>
                          <p className="text-xs font-semibold text-brand-dark">{banner.is_active ? 'Aktif' : 'Pasif'}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() => openEditBanner(banner)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-bg text-brand-dark"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => deleteBanner(banner)}
                          disabled={bannerDeleteId === String(banner.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {bannerDeleteId === String(banner.id) ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Sil
                        </button>
                      </div>
                    </article>
                  ))}
                  </div>
                </div>
              )}
            </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-brand-dark inline-flex items-center gap-2">
                  <Sparkles size={15} className="text-brand-primary" /> Kampanya Yönetimi
                </h2>
                <button
                  onClick={openCreateCampaign}
                  className="px-3 py-2 rounded-xl bg-brand-primary text-brand-white shadow-md hover:opacity-90 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus size={14} /> Kampanya Ekle
                </button>
              </div>

              {campaignsLoading ? (
                <p className="text-brand-dark text-center py-6">Yükleniyor...</p>
              ) : campaigns.length === 0 ? (
                <p className="text-brand-dark text-sm">Henüz kampanya yok.</p>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => {
                    const discountType = campaign?.discount_type === 'fixed' ? '₺' : '%';
                    const discountValue = Number(campaign?.discount_value || 0);

                    return (
                      <article key={campaign.id} className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-3 flex items-center gap-3">
                        {campaign?.image_url ? (
                          <img src={campaign.image_url} alt={campaign.title} className="w-20 h-16 rounded-lg object-cover bg-brand-bg" />
                        ) : (
                          <div className="w-20 h-16 rounded-lg bg-brand-primary/10 text-brand-primary text-[11px] font-bold flex items-center justify-center">
                            Kampanya
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-brand-dark truncate">{campaign.title || 'Kampanya'}</p>
                          <p className="text-xs text-brand-dark truncate">Kod: {campaign.code || '-'}</p>
                          <p className="text-xs text-brand-primary font-semibold mt-1">
                            İndirim: {discountType}{discountType === '%' ? discountValue.toFixed(0) : discountValue.toFixed(2)}
                          </p>
                          <p className={`text-xs font-semibold mt-1 ${campaign.is_active ? 'text-brand-dark' : 'text-brand-dark'}`}>
                            {campaign.is_active ? 'Aktif' : 'Pasif'}
                          </p>
                        </div>

                        <button
                          onClick={() => openEditCampaign(campaign)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-bg text-brand-dark"
                        >
                          Düzenle
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'delivery_zones' && (
          <section className="space-y-4">
            <div className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-brand-dark inline-flex items-center gap-2">
                    <Truck size={15} className="text-brand-primary" /> Teslimat Bölgeleri
                  </h2>
                  <p className="text-xs text-brand-dark mt-1">
                    İlçe bazında teslimat durumunu ve minimum sepet tutarını yönetin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={importIzmirNeighborhoods}
                  disabled={deliveryZonesImporting}
                  className="px-3 py-2 rounded-xl bg-brand-primary text-brand-white shadow-md hover:opacity-90 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-60"
                >
                  {deliveryZonesImporting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  İzmir Mahallelerini İçe Aktar
                </button>
              </div>
            </div>

            {deliveryZonesLoading ? (
              <p className="text-brand-dark text-center py-8">Teslimat bölgeleri yükleniyor...</p>
            ) : deliveryDistrictOptions.length === 0 ? (
              <div className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-5 text-center">
                <p className="text-sm text-brand-dark">Kayıtlı teslimat bölgesi yok.</p>
                <p className="text-xs text-brand-dark mt-1">Yukarıdaki buton ile İzmir mahallelerini içe aktarabilirsiniz.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-[260px,1fr]">
                <aside className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-3">
                  <p className="text-xs font-bold text-brand-dark mb-2">İlçeler</p>
                  <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
                    {deliveryDistrictOptions.map((districtName) => (
                      <button
                        key={districtName}
                        type="button"
                        onClick={() => setSelectedDeliveryDistrict(districtName)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${
                          selectedDeliveryDistrict === districtName
                            ? 'bg-brand-primary text-brand-white shadow-sm'
                            : 'bg-brand-bg text-brand-dark'
                        }`}
                      >
                        {districtName}
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-brand-dark">{selectedDeliveryDistrict || 'İlçe seçin'}</p>
                    <span className="text-xs font-semibold text-brand-dark">
                      {selectedDistrictDeliveryZones.length} mahalle
                    </span>
                  </div>

                  {selectedDeliveryDistrictDraft && (
                    <div className="mb-3 rounded-xl border border-brand-secondary bg-brand-bg px-3 py-2.5">
                      <p className="text-xs font-semibold text-brand-dark">İlçe Ayarı</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[auto,160px,auto]">
                        <div className="rounded-lg border border-brand-secondary bg-brand-white px-2 py-1.5 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-brand-dark">İlçe Aktif</p>
                          <button
                            type="button"
                            onClick={() => updateDeliveryDistrictDraft(selectedDeliveryDistrictKey, 'is_active', !selectedDeliveryDistrictDraft.is_active)}
                            className={`w-11 h-6 rounded-full p-0.5 transition ${selectedDeliveryDistrictDraft.is_active ? 'bg-brand-primary' : 'bg-brand-bg'}`}
                            aria-label={`${selectedDeliveryDistrictDraft.district || selectedDeliveryDistrict} aktiflik`}
                          >
                            <span className={`block w-5 h-5 rounded-full bg-brand-white transition-transform ${selectedDeliveryDistrictDraft.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="rounded-lg border border-brand-secondary bg-brand-white px-2 py-1.5">
                          <p className="mb-1 text-[11px] font-semibold text-brand-dark/70">Minimum Sepet (TL)</p>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={selectedDeliveryDistrictDraft.min_order}
                            onChange={(e) => updateDeliveryDistrictDraft(selectedDeliveryDistrictKey, 'min_order', e.target.value)}
                            className="w-full bg-transparent text-sm font-semibold text-brand-dark outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => saveDeliveryDistrictRule(selectedDeliveryDistrictKey)}
                          disabled={deliveryDistrictSavingKey === selectedDeliveryDistrictKey}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-brand-white disabled:opacity-60"
                        >
                          {deliveryDistrictSavingKey === selectedDeliveryDistrictKey ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          {deliveryDistrictSavingKey === selectedDeliveryDistrictKey ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedDistrictDeliveryZones.length > 0 && (
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => updateSelectedDistrictDeliveryField('allow_immediate', !districtAllImmediateEnabled)}
                        disabled={deliveryZoneBulkUpdatingField === 'allow_immediate'}
                        className="inline-flex items-center justify-center rounded-lg border border-brand-secondary bg-brand-bg px-3 py-2 text-xs font-semibold text-brand-dark disabled:opacity-60"
                      >
                        {deliveryZoneBulkUpdatingField === 'allow_immediate'
                          ? 'Güncelleniyor...'
                          : `Tümüne Hemen Teslim ${districtAllImmediateEnabled ? 'Kapat' : 'Aç'}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedDistrictDeliveryField('allow_scheduled', !districtAllScheduledEnabled)}
                        disabled={deliveryZoneBulkUpdatingField === 'allow_scheduled'}
                        className="inline-flex items-center justify-center rounded-lg border border-brand-secondary bg-brand-bg px-3 py-2 text-xs font-semibold text-brand-dark disabled:opacity-60"
                      >
                        {deliveryZoneBulkUpdatingField === 'allow_scheduled'
                          ? 'Güncelleniyor...'
                          : `Tümüne Randevulu Teslim ${districtAllScheduledEnabled ? 'Kapat' : 'Aç'}`}
                      </button>
                    </div>
                  )}

                  {selectedDistrictDeliveryZones.length === 0 ? (
                    <p className="text-xs text-brand-dark">Bu ilçe için mahalle kaydı bulunamadı.</p>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                      {selectedDistrictDeliveryZones.map((zone) => (
                        <article
                          key={zone.id}
                          className="rounded-xl border border-brand-secondary bg-brand-bg px-3 py-2.5"
                        >
                          <p className="text-sm font-semibold text-brand-dark">{zone.neighborhood || 'Mahalle'}</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {[
                              { field: 'allow_immediate', label: 'Hemen Teslim' },
                              { field: 'allow_scheduled', label: 'Randevulu Teslim' },
                            ].map((toggle) => {
                              const checked = normalizeBoolean(zone?.[toggle.field], false);
                              const rowUpdateKey = `${zone.id}:${toggle.field}`;
                              const updating = deliveryZoneUpdatingKey === rowUpdateKey || deliveryZoneBulkUpdatingField === toggle.field;

                              return (
                                <div
                                  key={`${zone.id}-${toggle.field}`}
                                  className="rounded-lg border border-brand-secondary bg-brand-white px-2 py-1.5 flex items-center justify-between gap-2"
                                >
                                  <p className="text-[11px] font-semibold text-brand-dark">{toggle.label}</p>
                                  <button
                                    type="button"
                                    onClick={() => updateDeliveryZoneToggle(zone.id, toggle.field, !checked)}
                                    disabled={updating}
                                    className={`w-11 h-6 rounded-full p-0.5 transition ${
                                      checked ? 'bg-brand-primary' : 'bg-brand-bg'
                                    } ${updating ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    aria-label={toggle.label}
                                  >
                                    <span className={`block w-5 h-5 rounded-full bg-brand-white transition-transform ${
                                      checked ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'settings' && (
          <section>
            <div className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-brand-dark inline-flex items-center gap-2">
                    <Store size={15} className="text-brand-primary" /> Mağaza Durumu
                  </h2>
                  <p className="text-xs text-brand-dark mt-1">Kapalıyken müşteri tarafında sipariş alımını durdurmak için kullanılacak.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStoreOpen((prev) => !prev)}
                  className={`w-12 h-7 rounded-full p-1 transition-all ${storeOpen ? 'bg-brand-secondary' : 'bg-brand-bg'}`}
                  disabled={settingsLoading || settingsSaving}
                >
                  <span className={`block w-5 h-5 rounded-full bg-brand-white transition-all ${storeOpen ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className={`text-sm font-semibold ${storeOpen ? 'text-brand-dark' : 'text-brand-dark'}`}>
                  {storeOpen ? 'Mağaza Açık' : 'Mağaza Kapalı'}
                </p>
                <button
                  onClick={saveStoreSetting}
                  disabled={settingsLoading || settingsSaving}
                  className="px-3 py-2 rounded-xl bg-brand-primary text-brand-white hover:opacity-90 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-60"
                >
                  {settingsSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Kaydet
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'reviews' && (
          <section className="space-y-3">
            <div className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex p-1 rounded-xl bg-brand-bg">
                  <button
                    onClick={() => setReviewsFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      reviewsFilter === 'all' ? 'bg-brand-white text-brand-dark shadow-sm' : 'text-brand-dark'
                    }`}
                  >
                    Tümü ({reviews.length})
                  </button>
                  <button
                    onClick={() => setReviewsFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      reviewsFilter === 'pending' ? 'bg-brand-white text-brand-dark shadow-sm' : 'text-brand-dark'
                    }`}
                  >
                    Bekleyen ({reviews.filter((item) => !normalizeBoolean(item.is_approved, false)).length})
                  </button>
                  <button
                    onClick={() => setReviewsFilter('approved')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      reviewsFilter === 'approved' ? 'bg-brand-white text-brand-dark shadow-sm' : 'text-brand-dark'
                    }`}
                  >
                    Onaylı ({reviews.filter((item) => normalizeBoolean(item.is_approved, false)).length})
                  </button>
                </div>
                <button
                  onClick={fetchReviews}
                  className="px-3 py-2 rounded-lg bg-brand-bg text-brand-dark text-xs font-bold inline-flex items-center gap-1"
                  disabled={reviewsLoading}
                >
                  {reviewsLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                  Yenile
                </button>
              </div>
              <p className="mt-2 text-[11px] text-brand-dark">
                4 ve 5 yıldızlı yorumlar otomatik onaylanır. Diğer yorumları buradan elle onaylayabilir veya gizleyebilirsiniz.
              </p>
            </div>

            {reviewsLoading ? (
              <p className="text-brand-dark text-center py-8">Yorumlar yükleniyor...</p>
            ) : filteredReviews.length === 0 ? (
              <p className="text-brand-dark text-center py-8">Seçili filtrede yorum bulunamadı.</p>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((review) => {
                  const isApproved = normalizeBoolean(review.is_approved, false);
                  const rating = Math.max(1, Math.min(5, Number(review.rating || 0)));
                  const orderMeta = reviewOrderMeta[String(review.order_id)];

                  return (
                    <article key={review.id} className="bg-brand-white rounded-2xl border border-brand-secondary shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-brand-dark truncate">
                            {orderMeta?.paytr_oid || `Sipariş #${review.order_id || '—'}`}
                          </p>
                          <p className="text-xs text-brand-dark mt-0.5">
                            {orderMeta?.customer_name || 'Müşteri bilgisi yok'} · {formatDate(review.created_at)}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isApproved ? 'bg-brand-secondary text-brand-dark' : 'bg-brand-secondary text-brand-dark'
                        }`}>
                          {isApproved ? 'Onaylı' : 'Beklemede'}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const starNumber = index + 1;
                          const active = starNumber <= rating;
                          return (
                            <Star
                              key={`${review.id}-star-${starNumber}`}
                              size={14}
                              className={active ? 'text-brand-dark fill-brand-secondary' : 'text-brand-dark'}
                            />
                          );
                        })}
                        <span className="ml-1 text-xs font-semibold text-brand-dark">{rating}/5</span>
                      </div>

                      <p className="mt-2 text-sm text-brand-dark whitespace-pre-wrap">
                        {String(review.comment || '').trim() || 'Yorum metni yok.'}
                      </p>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => toggleReviewApproval(review)}
                          disabled={reviewUpdateId === String(review.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                            isApproved
                              ? 'bg-brand-secondary text-brand-dark border border-brand-secondary'
                              : 'bg-brand-secondary text-brand-dark border border-brand-secondary'
                          } disabled:opacity-60`}
                        >
                          {reviewUpdateId === String(review.id) ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isApproved ? (
                            <EyeOff size={12} />
                          ) : (
                            <Eye size={12} />
                          )}
                          {isApproved ? 'Gizle' : 'Onayla'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'options' && (
          <section className="min-h-[600px] rounded-2xl bg-brand-white border border-brand-secondary shadow-sm overflow-hidden">
            <OptionGroups products={products} />
          </section>
        )}

        {activeTab === 'finance' && (
          <section>
            {!isFinanceUnlocked ? (
              <div className="bg-brand-bg rounded-2xl border border-brand-secondary shadow-sm p-5 max-w-md mx-auto text-brand-dark">
                <h2 className="text-base font-bold">Yönetici Erişimi</h2>
                <p className="text-xs text-brand-dark mt-1">Kasa verilerini görmek için 4 haneli PIN girin.</p>
                <form onSubmit={handleFinanceUnlock} className="mt-3 space-y-3">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={financePinInput}
                    onChange={(e) => setFinancePinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="PIN"
                    className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary bg-brand-bg text-sm text-brand-dark"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-brand-primary text-brand-white shadow-md hover:opacity-90 text-sm font-bold"
                  >
                    Erişimi Aç
                  </button>
                  {financePinError && <p className="text-xs text-brand-dark">{financePinError}</p>}
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setIsFinanceUnlocked(false);
                      setFinancePinInput('');
                      setFinancePinError('');
                    }}
                    className="px-3 py-2 rounded-xl bg-brand-bg text-brand-dark text-xs font-bold"
                  >
                    Kasayı Kilitle
                  </button>
                </div>

                <div className="bg-brand-bg rounded-2xl border border-brand-secondary p-4 text-brand-dark">
                  <p className="text-xs uppercase tracking-wider text-brand-dark">Dönem Seçimi</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FINANCE_PERIOD_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setFinancePeriod(option.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          financePeriod === option.key
                            ? 'bg-brand-white text-brand-dark border-brand-white'
                            : 'bg-brand-bg text-brand-dark border-brand-secondary'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid sm:grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={financeCustomStartDate}
                      onChange={(e) => {
                        setFinanceCustomStartDate(e.target.value);
                        setFinancePeriod('custom');
                      }}
                      className="w-full py-2 px-3 rounded-lg border border-brand-secondary bg-brand-bg text-sm text-brand-dark"
                    />
                    <input
                      type="date"
                      value={financeCustomEndDate}
                      onChange={(e) => {
                        setFinanceCustomEndDate(e.target.value);
                        setFinancePeriod('custom');
                      }}
                      className="w-full py-2 px-3 rounded-lg border border-brand-secondary bg-brand-bg text-sm text-brand-dark"
                    />
                  </div>
                  <p className="mt-3 text-xs text-brand-dark">
                    Aktif dönem: <span className="font-semibold">{financeSelectedRangeLabel}</span>
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <p className="text-xs text-brand-dark">Bugün vs Dün</p>
                    <p className="mt-1 text-sm font-semibold text-brand-dark">
                      {formatCurrency(financeComparison.todayRevenue)} / {formatCurrency(financeComparison.yesterdayRevenue)}
                    </p>
                    <div className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${
                      financeComparison.todayGrowthPercent >= 0 ? 'text-brand-dark' : 'text-brand-dark'
                    }`}>
                      {financeComparison.todayGrowthPercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {financeComparison.todayGrowthPercent >= 0 ? '+' : '-'}
                      {Math.abs(financeComparison.todayGrowthPercent).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <p className="text-xs text-brand-dark">Bu Hafta vs Geçen Hafta</p>
                    <p className="mt-1 text-sm font-semibold text-brand-dark">
                      {formatCurrency(financeComparison.thisWeekRevenue)} / {formatCurrency(financeComparison.lastWeekRevenue)}
                    </p>
                    <div className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${
                      financeComparison.weekGrowthPercent >= 0 ? 'text-brand-dark' : 'text-brand-dark'
                    }`}>
                      {financeComparison.weekGrowthPercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {financeComparison.weekGrowthPercent >= 0 ? '+' : '-'}
                      {Math.abs(financeComparison.weekGrowthPercent).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <p className="text-xs text-brand-dark">Bu Ay vs Geçen Ay</p>
                    <p className="mt-1 text-sm font-semibold text-brand-dark">
                      {formatCurrency(financeComparison.thisMonthRevenue)} / {formatCurrency(financeComparison.lastMonthRevenue)}
                    </p>
                    <div className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${
                      financeComparison.monthGrowthPercent >= 0 ? 'text-brand-dark' : 'text-brand-dark'
                    }`}>
                      {financeComparison.monthGrowthPercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {financeComparison.monthGrowthPercent >= 0 ? '+' : '-'}
                      {Math.abs(financeComparison.monthGrowthPercent).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-brand-dark">Toplam Ciro</p>
                      <DollarSign size={16} className="text-brand-dark" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-brand-dark">{formatCurrency(financeRangeSummary.revenue)}</p>
                    <p className="mt-1 text-[11px] text-brand-dark">Seçili dönemde teslim edilen siparişlerin cirosu</p>
                  </div>
                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-brand-dark">Sipariş Hacmi</p>
                      <Users size={16} className="text-brand-dark" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-brand-dark">{financeRangeSummary.orderCount}</p>
                    <p className="mt-1 text-[11px] text-brand-dark">Toplam teslim edilen sipariş adedi</p>
                  </div>
                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-brand-dark">Ortalama Sepet (AOV)</p>
                      <TrendingUp size={16} className="text-brand-dark" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-brand-dark">{formatCurrency(financeRangeSummary.averageBasket)}</p>
                    <p className="mt-1 text-[11px] text-brand-dark">Ciro / Sipariş adedi</p>
                  </div>
                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-brand-dark">Popüler Kategori</p>
                      <Package size={16} className="text-brand-dark" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-brand-dark truncate">{financePopularCategory}</p>
                    <p className="mt-1 text-[11px] text-brand-dark">Adet bazında en güçlü kategori</p>
                  </div>
                </div>

                <div className="grid xl:grid-cols-3 gap-3">
                  <div className="xl:col-span-2 bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <p className="text-sm font-bold text-brand-dark">Satış Trendi (Son 7 Gün)</p>
                    <div className="mt-4">
                      <svg viewBox="0 0 100 100" className="w-full h-44">
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#F0F0F0" strokeWidth="1" />
                        <line x1="0" y1="75" x2="100" y2="75" stroke="#F0F0F0" strokeWidth="1" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#F0F0F0" strokeWidth="1" />
                        <line x1="0" y1="25" x2="100" y2="25" stroke="#F0F0F0" strokeWidth="1" />
                        {financeTrendPath && (
                          <polyline
                            fill="none"
                            stroke="#98CD00"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={financeTrendPath}
                          />
                        )}
                      </svg>
                      <div className="mt-2 grid grid-cols-7 gap-1 text-[10px] text-brand-dark">
                        {financeSalesTrend.map((item) => (
                          <div key={item.key} className="text-center">{item.label}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                    <p className="text-sm font-bold text-brand-dark">Teslimat Tipi Dağılımı</p>
                    <div className="mt-4 flex items-center justify-center">
                      <div
                        className="w-40 h-40 rounded-full"
                        style={{
                          background: financeDeliveryTotal > 0
                            ? `conic-gradient(#98CD00 0% ${financeDeliveryPct}%, #82CD47 ${financeDeliveryPct}% 100%)`
                            : '#F0F0F0',
                        }}
                      />
                    </div>
                    <div className="mt-4 space-y-1 text-xs">
                      <p className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-brand-secondary" /> Eve Teslimat
                        </span>
                        <span className="font-semibold">{financeDeliveryPct.toFixed(1)}%</span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-brand-secondary" /> Gel-Al
                        </span>
                        <span className="font-semibold">{financePickupPct.toFixed(1)}%</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                  <p className="text-sm font-bold text-brand-dark">En Çok Satan 5 Ürün (Adet)</p>
                  <div className="mt-3 space-y-3">
                    {financeTopProducts.length === 0 ? (
                      <p className="text-xs text-brand-dark">Seçili dönemde ürün verisi bulunmuyor.</p>
                    ) : (
                      financeTopProducts.map((item) => {
                        const width = Math.max((item.soldQty / financeTopProductMaxQty) * 100, 4);
                        return (
                          <div key={item.productKey}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold text-brand-dark truncate pr-2">{item.productName}</span>
                              <span className="text-brand-dark">{item.soldQty} adet</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-brand-bg overflow-hidden">
                              <div className="h-full rounded-full bg-brand-primary" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-brand-white rounded-2xl border border-brand-secondary p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-brand-dark">Ürün Performans Analizi</p>
                    <div className="inline-flex rounded-lg border border-brand-secondary p-1">
                      <button
                        onClick={() => setFinanceProductSortBy('revenue')}
                        className={`px-2.5 py-1 text-xs rounded ${
                          financeProductSortBy === 'revenue' ? 'bg-brand-bg text-brand-dark' : 'text-brand-dark'
                        }`}
                      >
                        En Çok Getiren
                      </button>
                      <button
                        onClick={() => setFinanceProductSortBy('quantity')}
                        className={`px-2.5 py-1 text-xs rounded ${
                          financeProductSortBy === 'quantity' ? 'bg-brand-bg text-brand-dark' : 'text-brand-dark'
                        }`}
                      >
                        En Çok Satılan
                      </button>
                    </div>
                  </div>

                  {financeSortedProductPerformance.length === 0 ? (
                    <p className="mt-4 text-xs text-brand-dark">Seçili dönemde listelenecek ürün performansı yok.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-brand-dark border-b border-brand-secondary">
                            <th className="pb-2 font-semibold">Ürün Adı</th>
                            <th className="pb-2 font-semibold">Satış Adedi</th>
                            <th className="pb-2 font-semibold">Toplam Getiri</th>
                            <th className="pb-2 font-semibold">Stok Durumu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financeSortedProductPerformance.map((row) => (
                            <tr key={row.productKey} className="border-b border-brand-secondary last:border-0">
                              <td className="py-2 text-brand-dark font-medium">{row.productName}</td>
                              <td className="py-2 text-brand-dark">{row.soldQty}</td>
                              <td className="py-2 text-brand-dark">{formatCurrency(row.revenue)}</td>
                              <td className="py-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  row.stockLabel === 'Stokta'
                                    ? 'bg-brand-secondary text-brand-dark'
                                    : row.stockLabel === 'Tükendi'
                                      ? 'bg-brand-secondary text-brand-dark'
                                      : 'bg-brand-bg text-brand-dark'
                                }`}>
                                  {row.stockLabel}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <div id="print-receipt" data-print-mode={isPrintMode ? '1' : '0'} className="fixed -left-[9999px] top-0 z-[9999]">
        {printableOrder && (
          <div style={{ width: '80mm', padding: '2mm', fontSize: '12px', lineHeight: 1.35 }}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '16px' }}>{RECEIPT_BUSINESS_NAME}</div>
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>{formatDate(printableOrder.created_at)}</div>

            <div style={{ fontWeight: 700 }}>Müşteri: {printableOrder.customer_name || '—'}</div>
            <div>Telefon: {printableOrder.phone || '—'}</div>
            <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '4px' }}>
              Adres: {printableOrder.address || '—'}
            </div>
            {(printableOrder.customer_note || printableOrder.note || printableOrder.order_note) && (
              <div style={{ fontWeight: 700, marginTop: '4px' }}>
                Not: {printableOrder.customer_note || printableOrder.note || printableOrder.order_note}
              </div>
            )}

            <div style={{ margin: '6px 0' }}>-----------------------------------</div>
            <div>
              {(Array.isArray(printableOrder.items) ? printableOrder.items : []).map((item, index) => {
                const quantity = Number(item?.quantity || 1);
                const unitPrice = Number(item?.unit_price ?? item?.price ?? 0);
                const rowTotal = quantity * (Number.isFinite(unitPrice) ? unitPrice : 0);
                const rowText = buildReceiptLine(item?.name || 'Ürün', quantity, rowTotal);
                return (
                  <div key={`receipt-item-${index}`}>{rowText}</div>
                );
              })}
            </div>
            <div style={{ margin: '6px 0' }}>-----------------------------------</div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              TOPLAM: {toMoneyText(printableOrder.total_price)}
            </div>
            <div style={{ margin: '6px 0' }}>-----------------------------------</div>
            <div style={{ fontWeight: 700 }}>TOPLAM BESIN DEGERLERI:</div>
            <div>
              Kalori: {Math.round(printableOrderMacroTotals.calories)} kcal  | Prot: {Math.round(printableOrderMacroTotals.protein)}g
            </div>
            <div>
              Karb: {Math.round(printableOrderMacroTotals.carbs)}g       | Yag: {Math.round(printableOrderMacroTotals.fats)}g
            </div>
            <div style={{ margin: '6px 0' }}>-----------------------------------</div>
            <div style={{ marginTop: '8px', textAlign: 'center' }}>Afiyet Olsun!</div>
          </div>
        )}
      </div>

      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#F0F0F0]/35 flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:max-w-lg bg-brand-white rounded-t-3xl sm:rounded-2xl p-4 border-t border-brand-secondary shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-brand-dark">{editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</p>
              <button onClick={() => setProductModalOpen(false)} className="w-8 h-8 rounded-full bg-brand-bg inline-flex items-center justify-center">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Ürün Adı *</p>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ürün adı"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Fiyat (₺) *</p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Kategori</p>
                <input
                  type="text"
                  list="admin-category-options"
                  value={productForm.category}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Kategori seçin"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              <div className="rounded-xl border border-gray-300 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-brand-dark">Seçim Grupları</p>
                  <button
                    type="button"
                    onClick={fetchCatalogOptionGroups}
                    className="text-[11px] text-brand-dark underline underline-offset-2"
                  >
                    Yenile
                  </button>
                </div>

                {catalogOptionGroupsLoading ? (
                  <p className="mt-2 text-xs text-brand-dark">Gruplar yükleniyor...</p>
                ) : catalogOptionGroups.length === 0 ? (
                  <p className="mt-2 text-xs text-brand-dark">Henüz seçim grubu bulunamadı. Önce Seçenekler sekmesinden grup ekleyin.</p>
                ) : (
                  <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {catalogOptionGroups.map((group) => {
                      const groupId = String(group.id);
                      const selectedIndex = productSelectedGroupIds.indexOf(groupId);
                      const isSelected = selectedIndex !== -1;

                      return (
                        <div key={`product-group-${groupId}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-1.5 bg-brand-white">
                          <label className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleProductGroupSelection(groupId, e.target.checked)}
                            />
                            <span className="text-xs text-brand-dark truncate">{group.name || `Grup #${groupId}`}</span>
                          </label>

                          {isSelected && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-semibold text-brand-dark">#{selectedIndex + 1}</span>
                              <button
                                type="button"
                                onClick={() => moveProductGroupSelection(groupId, 'up')}
                                disabled={selectedIndex === 0}
                                className="w-6 h-6 rounded-md border border-gray-200 inline-flex items-center justify-center disabled:opacity-40"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveProductGroupSelection(groupId, 'down')}
                                disabled={selectedIndex === productSelectedGroupIds.length - 1}
                                className="w-6 h-6 rounded-md border border-gray-200 inline-flex items-center justify-center disabled:opacity-40"
                              >
                                <ArrowDown size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Görüntülenme Sırası</p>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.order}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, order: e.target.value }))}
                  placeholder="1"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Besin Değerleri</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.calories}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, calories: e.target.value }))}
                    placeholder="Kalori (kcal)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={productForm.protein}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, protein: e.target.value }))}
                    placeholder="Protein (g)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={productForm.carbs}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, carbs: e.target.value }))}
                    placeholder="Karbonhidrat (g)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={productForm.fats}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, fats: e.target.value }))}
                    placeholder="Yağ (g)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                </div>
              </div>

              {/* Teslimat seçenekleri */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600">Teslimat Türü</p>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={productForm.allow_immediate}
                    onChange={e => setProductForm(p => ({ ...p, allow_immediate: e.target.checked }))}
                    className="accent-green-600" />
                  Hemen Teslim (allow_immediate)
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={productForm.allow_scheduled}
                    onChange={e => setProductForm(p => ({ ...p, allow_scheduled: e.target.checked }))}
                    className="accent-green-600" />
                  Programlı Teslimat (allow_scheduled)
                </label>
              </div>

              {/* Sepette Öner (cross-sell) */}
              <div className="rounded-xl border border-gray-200 p-3">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={productForm.is_crosssell}
                    onChange={e => setProductForm(p => ({ ...p, is_crosssell: e.target.checked }))}
                    className="accent-green-600" />
                  <span className="font-semibold">Sepette Öner</span>
                  <span className="text-gray-500">(is_crosssell — "Bunlar da ilgini çekebilir" bölümünde gösterilir)</span>
                </label>
              </div>

              {/* İndirim */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-600">İndirim Türü</p>
                  <select value={productForm.discount_type}
                    onChange={e => setProductForm(p => ({ ...p, discount_type: e.target.value }))}
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary">
                    <option value="">— Yok —</option>
                    <option value="percent">Yüzde (%)</option>
                    <option value="fixed">Sabit (₺)</option>
                  </select>
                </div>
                {productForm.discount_type && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-gray-600">İndirim Değeri</p>
                    <input type="number" min="0" step="0.01"
                      value={productForm.discount_value}
                      onChange={e => setProductForm(p => ({ ...p, discount_value: e.target.value }))}
                      placeholder={productForm.discount_type === 'percent' ? '10' : '25'}
                      className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary" />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Açıklama</p>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="İçerik, malzemeler, besin bilgisi..."
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm resize-none outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              <ImageUploadField
                label="Ürün Görseli"
                value={productForm.imageUrl}
                onUploaded={(url) => setProductForm((prev) => ({ ...prev, imageUrl: url }))}
                folder="products"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setProductModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-brand-secondary text-sm font-semibold text-brand-dark"
                disabled={productSaving}
              >
                İptal
              </button>
              <button
                onClick={saveProduct}
                disabled={productSaving}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary text-brand-white hover:opacity-90 text-sm font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {productSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {productSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bannerModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#F0F0F0]/35 flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:max-w-lg bg-brand-white rounded-t-3xl sm:rounded-2xl p-4 border-t border-brand-secondary shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-brand-dark">{editingBanner ? 'Banner Düzenle' : 'Yeni Banner'}</p>
              <button onClick={() => setBannerModalOpen(false)} className="w-8 h-8 rounded-full bg-brand-bg inline-flex items-center justify-center">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={bannerForm.title}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Banner başlığı (opsiyonel)"
                className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-sm"
              />

              <ImageUploadField
                label="Banner Görseli"
                value={bannerForm.image_url}
                onUploaded={(url) => setBannerForm((prev) => ({ ...prev, image_url: url }))}
                folder="banners"
              />

              <input
                type="text"
                value={bannerForm.link}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, link: e.target.value }))}
                placeholder="Yönlenecek link (örn: /offers)"
                className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-sm"
              />

              <input
                type="number"
                min="0"
                value={bannerForm.order}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, order: e.target.value }))}
                placeholder="Sıra"
                className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-sm"
              />

              <label className="inline-flex items-center gap-2 text-sm text-brand-dark">
                <input
                  type="checkbox"
                  checked={bannerForm.is_active}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Aktif
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setBannerModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-brand-secondary text-sm font-semibold text-brand-dark"
                disabled={bannerSaving}
              >
                İptal
              </button>
              <button
                onClick={saveBanner}
                disabled={bannerSaving}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary text-brand-white hover:opacity-90 text-sm font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {bannerSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {bannerSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {campaignModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#F0F0F0]/35 flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:max-w-xl bg-brand-white rounded-t-3xl sm:rounded-2xl p-4 border-t border-brand-secondary shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-brand-dark">{editingCampaign ? 'Kampanya Düzenle' : 'Yeni Kampanya'}</p>
              <button onClick={() => setCampaignModalOpen(false)} className="w-8 h-8 rounded-full bg-brand-bg inline-flex items-center justify-center">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={campaignForm.title}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Kampanya başlığı"
                className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-sm"
              />

              <textarea
                rows={2}
                value={campaignForm.description}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Kampanya açıklaması"
                className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-sm resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={campaignForm.code}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="Kod"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-sm"
                />
                <input
                  type="text"
                  value={campaignForm.badge}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, badge: e.target.value }))}
                  placeholder="Rozet"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={campaignForm.discount_type}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, discount_type: e.target.value }))}
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                >
                  <option value="percent">Yüzde</option>
                  <option value="fixed">Sabit Tutar</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignForm.discount_value}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, discount_value: e.target.value }))}
                  placeholder="İndirim"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignForm.max_discount}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, max_discount: e.target.value }))}
                  placeholder="Maks. indirim"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={campaignForm.min_cart_total}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, min_cart_total: e.target.value }))}
                  placeholder="Min. sepet"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
                <input
                  type="date"
                  value={campaignForm.start_date}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
                <input
                  type="date"
                  value={campaignForm.end_date}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={campaignForm.color_from}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, color_from: e.target.value }))}
                  placeholder="Renk 1"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
                <input
                  type="text"
                  value={campaignForm.color_via}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, color_via: e.target.value }))}
                  placeholder="Renk 2"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
                <input
                  type="text"
                  value={campaignForm.color_to}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, color_to: e.target.value }))}
                  placeholder="Renk 3"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={campaignForm.order}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, order: e.target.value }))}
                  placeholder="Sıra"
                  className="w-full py-2.5 px-3 rounded-xl border border-brand-secondary text-xs"
                />
                <label className="inline-flex items-center gap-2 text-sm text-brand-dark py-2">
                  <input
                    type="checkbox"
                    checked={campaignForm.is_active}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Aktif
                </label>
              </div>

              <ImageUploadField
                label="Kampanya Görseli"
                value={campaignForm.image_url}
                onUploaded={(url) => setCampaignForm((prev) => ({ ...prev, image_url: url }))}
                folder="campaigns"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setCampaignModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-brand-secondary text-sm font-semibold text-brand-dark"
                disabled={campaignSaving}
              >
                İptal
              </button>
              <button
                onClick={saveCampaign}
                disabled={campaignSaving}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary text-brand-white hover:opacity-90 text-sm font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {campaignSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {campaignSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
