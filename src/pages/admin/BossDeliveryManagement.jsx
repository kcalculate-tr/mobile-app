/**
 * BossDeliveryManagement.jsx — Birleşik Teslimat Yönetimi
 *
 * 2 üst seviye sekme ile ayrılmış teslimat paneli:
 *   - Hemen Teslimat
 *   - Randevulu Teslimat
 *
 * Kullanılan tablolar:
 *   - settings(id=1): working_days[], open_time, close_time,
 *                     closed_dates[], closed_dates_note jsonb
 *   - delivery_settings(district PK, cargo_rules jsonb, updated_at)
 *       → district = '__GLOBAL__' satırı genel varsayılanları tutar.
 *   - delivery_zones(id, city, district, neighborhood, min_order,
 *                    delivery_days int[], is_active, allow_immediate,
 *                    allow_scheduled,
 *                    delivery_fee_immediate, delivery_fee_scheduled,
 *                    free_shipping_above_immediate, free_shipping_above_scheduled,
 *                    min_order_immediate, min_order_scheduled,
 *                    estimated_delivery_minutes)
 *
 * Eski sayfalar (/boss/teslimat, /boss/business-hours) dokunulmadan kalır
 * ve fallback olarak erişilebilir.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
  Truck,
  X,
} from 'lucide-react';
import { supabase } from '../../supabase';
import { fetchAllDeliveryZones } from '../../lib/supabaseHelpers';

// ─── Sabitler ──────────────────────────────────────────────────────────────
const GLOBAL_KEY = '__GLOBAL__';

const DAY_OPTIONS = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
  { value: 0, label: 'Pazar' },
];

const DAY_FULL_TR = {
  0: 'Pazar', 1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba',
  4: 'Perşembe', 5: 'Cuma', 6: 'Cumartesi',
};

// Mirror of src/utils/deliveryDays.ts formatDeliveryDaysFull. Keep in sync —
// admin-panel can't import mobile utils.
// Day numbering: 0=Pazar … 6=Cumartesi (JS Date.getDay()). Weekdays: [1..5].
function formatDeliveryDays(days) {
  if (!Array.isArray(days) || days.length === 0) return 'Belirtilmemiş';
  const unique = Array.from(new Set(days.map(Number)))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
  if (unique.length === 0) return 'Belirtilmemiş';

  if (unique.length === 7) return 'Her gün';
  if (unique.length === 2 && unique[0] === 0 && unique[1] === 6) return 'Hafta sonu';

  const weekdays = [1, 2, 3, 4, 5];
  const hasAllWeekdays = weekdays.every((d) => unique.includes(d));
  if (hasAllWeekdays) {
    if (unique.length === 5) return 'Hafta içi her gün';
    if (unique.length === 6) {
      if (unique.includes(6)) return 'Hafta içi her gün ve Cumartesi';
      if (unique.includes(0)) return 'Hafta içi her gün ve Pazar';
    }
  }

  return unique.map((d) => DAY_FULL_TR[d]).join(', ');
}

const DEFAULT_RULES = {
  immediate: { active: true, min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
  scheduled: { active: true, min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
};

function normalizeRules(row) {
  if (!row || typeof row !== 'object') return structuredClone(DEFAULT_RULES);
  return {
    immediate: { ...DEFAULT_RULES.immediate, ...(row.immediate || {}) },
    scheduled: { ...DEFAULT_RULES.scheduled, ...(row.scheduled || {}) },
  };
}

function toNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toStrOrEmpty(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

// ─── Yardımcı bileşenler ────────────────────────────────────────────────────
function Toggle({ on, onClick, disabled, accent = 'green' }) {
  const onCls = accent === 'blue' ? 'text-blue-500' : 'text-green-500';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 inline-flex items-center"
      aria-pressed={!!on}
    >
      {on
        ? <ToggleRight size={26} className={onCls} />
        : <ToggleLeft size={26} className="text-gray-300" />}
    </button>
  );
}

function Pill({ active, onClick, children, disabled, accent = 'green' }) {
  const activeCls = accent === 'blue'
    ? 'bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)]'
    : 'bg-green-500 text-white shadow-[0_4px_12px_rgba(152,205,0,0.35)]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? activeCls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function NumInput({ value, onChange, placeholder, id }) {
  return (
    <input
      id={id}
      type="number"
      min="0"
      step="1"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-geex-text placeholder:text-gray-400 outline-none focus:border-brand-primary"
    />
  );
}

function Banner({ type, msg, onClose }) {
  if (!msg) return null;
  const cls = type === 'err'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <span>{msg}</span>
      <button type="button" onClick={onClose}><X size={14} /></button>
    </div>
  );
}

// ─── Ana bileşen ────────────────────────────────────────────────────────────
export default function BossDeliveryManagement() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // ── Aktif sekme ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('immediate'); // 'immediate' | 'scheduled'

  // ── Genel ayarlar ─────────────────────────────────────────────
  const [general, setGeneral] = useState({
    working_days: [1, 2, 3, 4, 5],
    open_time: '09:00',
    close_time: '21:00',
    closed_dates: [],
    closed_dates_note: {},
    immediate: { min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
    scheduled: { min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
  });
  const [generalDirty, setGeneralDirty] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newDateNote, setNewDateNote] = useState('');

  // ── İlçe kartları ─────────────────────────────────────────────
  const [districts, setDistricts] = useState([]);
  const [dirtyDistricts, setDirtyDistricts] = useState(new Set());
  const [savingDistrict, setSavingDistrict] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [expandedNeighborhoods, setExpandedNeighborhoods] = useState({});

  // ── Filtre ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  // ── Veri yükle ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [settingsRes, globalRes, zoneRows] = await Promise.all([
        supabase
          .from('settings')
          .select('working_days, open_time, close_time, closed_dates, closed_dates_note')
          .eq('id', 1)
          .maybeSingle(),
        supabase
          .from('delivery_settings')
          .select('district, cargo_rules')
          .eq('district', GLOBAL_KEY)
          .maybeSingle(),
        fetchAllDeliveryZones(),
      ]);

      const s = settingsRes.data || {};
      const globalRules = normalizeRules(globalRes.data?.cargo_rules);

      setGeneral({
        working_days: Array.isArray(s.working_days) ? s.working_days : [1, 2, 3, 4, 5],
        open_time: (s.open_time || '09:00').slice(0, 5),
        close_time: (s.close_time || '21:00').slice(0, 5),
        closed_dates: Array.isArray(s.closed_dates) ? s.closed_dates : [],
        closed_dates_note: (s.closed_dates_note && typeof s.closed_dates_note === 'object') ? s.closed_dates_note : {},
        immediate: {
          min_order: Number(globalRules.immediate.min_order) || 0,
          shipping_fee: Number(globalRules.immediate.shipping_fee) || 0,
          free_shipping_above: Number(globalRules.immediate.free_shipping_above) || 0,
        },
        scheduled: {
          min_order: Number(globalRules.scheduled.min_order) || 0,
          shipping_fee: Number(globalRules.scheduled.shipping_fee) || 0,
          free_shipping_above: Number(globalRules.scheduled.free_shipping_above) || 0,
        },
      });
      setGeneralDirty(false);

      const rows = zoneRows;
      const grouped = new Map();
      rows.forEach((r) => {
        const d = String(r?.district || '').trim();
        if (!d) return;
        if (!grouped.has(d)) grouped.set(d, []);
        grouped.get(d).push(r);
      });

      const sanitizeDays = (arr) =>
        Array.isArray(arr) && arr.length > 0
          ? arr.map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
          : null;

      const list = Array.from(grouped.entries())
        .map(([district, rawRows]) => {
          const sortedRows = [...rawRows].sort((a, b) =>
            String(a?.neighborhood || '').localeCompare(String(b?.neighborhood || ''), 'tr')
          );
          const first = sortedRows[0] || {};
          const legacyDays = sanitizeDays(first?.delivery_days);
          const immediateDays =
            sanitizeDays(first?.delivery_days_immediate) ?? legacyDays ?? [1, 2, 3, 4, 5];
          const scheduledDays =
            sanitizeDays(first?.delivery_days_scheduled) ?? legacyDays ?? [1, 2, 3, 4, 5];
          return {
            district,
            city: String(first?.city || 'İzmir').trim() || 'İzmir',
            rows: sortedRows.map((r) => ({
              id: r.id,
              neighborhood: String(r?.neighborhood || '').trim(),
              allow_immediate: !!r?.allow_immediate,
              allow_scheduled: !!r?.allow_scheduled,
            })),
            is_active: !!first?.is_active,
            deliveryDaysImmediate: immediateDays,
            deliveryDaysScheduled: scheduledDays,
            min_order: Number(first?.min_order || 0),
            delivery_fee_immediate: toStrOrEmpty(first?.delivery_fee_immediate),
            delivery_fee_scheduled: toStrOrEmpty(first?.delivery_fee_scheduled),
            free_shipping_above_immediate: toStrOrEmpty(first?.free_shipping_above_immediate),
            free_shipping_above_scheduled: toStrOrEmpty(first?.free_shipping_above_scheduled),
            min_order_immediate: toStrOrEmpty(first?.min_order_immediate),
            min_order_scheduled: toStrOrEmpty(first?.min_order_scheduled),
            estimated_delivery_minutes: toStrOrEmpty(first?.estimated_delivery_minutes),
          };
        })
        .sort((a, b) => a.district.localeCompare(b.district, 'tr'));

      setDistricts(list);
      setDirtyDistricts(new Set());
    } catch (e) {
      console.error('load failed', e);
      setErr(e.message || 'Veri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── General field setters ─────────────────────────────────────
  const patchGeneral = (patch) => {
    setGeneral((prev) => ({ ...prev, ...patch }));
    setGeneralDirty(true);
  };

  const patchGeneralRule = (key, field, value) => {
    setGeneral((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setGeneralDirty(true);
  };

  const toggleWorkingDay = (d) => {
    setGeneral((prev) => {
      const has = prev.working_days.includes(d);
      const next = has ? prev.working_days.filter((x) => x !== d) : [...prev.working_days, d].sort();
      return { ...prev, working_days: next };
    });
    setGeneralDirty(true);
  };

  const addClosedDate = () => {
    if (!newDate) { setErr('Tarih seçin.'); return; }
    if (general.closed_dates.includes(newDate)) { setErr('Bu tarih zaten ekli.'); return; }
    const nextDates = [...general.closed_dates, newDate].sort();
    const nextNotes = { ...general.closed_dates_note, [newDate]: newDateNote.trim() || 'Kapalı' };
    setGeneral((prev) => ({ ...prev, closed_dates: nextDates, closed_dates_note: nextNotes }));
    setGeneralDirty(true);
    setNewDate('');
    setNewDateNote('');
    setErr('');
  };

  const removeClosedDate = (d) => {
    setGeneral((prev) => {
      const nextNotes = { ...prev.closed_dates_note };
      delete nextNotes[d];
      return {
        ...prev,
        closed_dates: prev.closed_dates.filter((x) => x !== d),
        closed_dates_note: nextNotes,
      };
    });
    setGeneralDirty(true);
  };

  // ── General save ──────────────────────────────────────────────
  // Her iki sekme de aynı satırlara (settings id=1 + delivery_settings __GLOBAL__)
  // yazar, ancak sekmeye özgü alanlar farklıdır:
  //   - Hemen: working_days/open_time/close_time/closed_dates + cargo_rules.immediate
  //   - Randevulu: sadece cargo_rules.scheduled (çalışma saatleri Hemen sekmesine özgü)
  // Not: cargo_rules tek jsonb kolonu olduğu için upsert'lerde her iki anahtarı
  //      da koruyarak yazıyoruz (yoksa diğer sekmenin verisi silinir).
  const saveGeneral = async () => {
    setGeneralSaving(true); setErr(''); setOk('');
    try {
      const globalRules = {
        immediate: {
          active: true,
          min_order: Number(general.immediate.min_order) || 0,
          shipping_fee: Number(general.immediate.shipping_fee) || 0,
          free_shipping_above: Number(general.immediate.free_shipping_above) || 0,
        },
        scheduled: {
          active: true,
          min_order: Number(general.scheduled.min_order) || 0,
          shipping_fee: Number(general.scheduled.shipping_fee) || 0,
          free_shipping_above: Number(general.scheduled.free_shipping_above) || 0,
        },
      };
      const deliveryUpsert = supabase.from('delivery_settings').upsert(
        { district: GLOBAL_KEY, cargo_rules: globalRules, updated_at: new Date().toISOString() },
        { onConflict: 'district' }
      );

      const promises = [deliveryUpsert];

      // Çalışma saatleri sadece Hemen sekmesinde düzenlenir.
      if (activeTab === 'immediate') {
        const settingsUpdate = supabase.from('settings').update({
          working_days: general.working_days,
          open_time: general.open_time,
          close_time: general.close_time,
          closed_dates: general.closed_dates,
          closed_dates_note: general.closed_dates_note,
        }).eq('id', 1);
        promises.unshift(settingsUpdate);
      }

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r.error) throw r.error;
      }

      setGeneralDirty(false);
      setOk('Genel ayarlar kaydedildi.');
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Genel ayarlar kaydedilemedi.');
    } finally {
      setGeneralSaving(false);
    }
  };

  // ── District helpers ──────────────────────────────────────────
  const markDistrictDirty = (district) => {
    setDirtyDistricts((prev) => {
      if (prev.has(district)) return prev;
      const n = new Set(prev);
      n.add(district);
      return n;
    });
  };

  const patchDistrict = (district, patch) => {
    setDistricts((prev) => prev.map((d) => (d.district === district ? { ...d, ...patch } : d)));
    markDistrictDirty(district);
  };

  // field = 'deliveryDaysImmediate' | 'deliveryDaysScheduled'
  const toggleDistrictDay = (district, day, field) => {
    setDistricts((prev) => prev.map((d) => {
      if (d.district !== district) return d;
      const current = Array.isArray(d[field]) ? d[field] : [];
      const has = current.includes(day);
      const next = has
        ? current.filter((x) => x !== day)
        : [...current, day].sort((a, b) => a - b);
      return { ...d, [field]: next };
    }));
    markDistrictDirty(district);
  };

  const setDistrictDays = (district, days, field) => {
    setDistricts((prev) => prev.map((d) => (
      d.district === district
        ? { ...d, [field]: [...days].sort((a, b) => a - b) }
        : d
    )));
    markDistrictDirty(district);
  };

  const toggleNeighborhood = (district, id, field) => {
    setDistricts((prev) => prev.map((d) => {
      if (d.district !== district) return d;
      return {
        ...d,
        rows: d.rows.map((r) => (r.id === id ? { ...r, [field]: !r[field] } : r)),
      };
    }));
    markDistrictDirty(district);
  };

  const bulkSetNeighborhoods = (district, field, value) => {
    setDistricts((prev) => prev.map((d) => {
      if (d.district !== district) return d;
      return { ...d, rows: d.rows.map((r) => ({ ...r, [field]: value })) };
    }));
    markDistrictDirty(district);
  };

  // ── Save district ─────────────────────────────────────────────
  // Kullanıcı sekmeler arasında gezerken edit'ler kaybolmasın diye
  // çalışma alanındaki TÜM alanları yazıyoruz (shared + her iki sekmeye özgü
  // alanlar). Böylece dirty state sekme değişikliğinde de korunur.
  const saveDistrict = async (districtName) => {
    const d = districts.find((x) => x.district === districtName);
    if (!d) return;
    setSavingDistrict(districtName); setErr(''); setOk('');
    try {
      const immediateDays = Array.isArray(d.deliveryDaysImmediate) && d.deliveryDaysImmediate.length > 0
        ? d.deliveryDaysImmediate
        : [1, 2, 3, 4, 5];
      const scheduledDays = Array.isArray(d.deliveryDaysScheduled) && d.deliveryDaysScheduled.length > 0
        ? d.deliveryDaysScheduled
        : [1, 2, 3, 4, 5];

      const districtLevelPayload = {
        is_active: !!d.is_active,
        delivery_days_immediate: immediateDays,
        delivery_days_scheduled: scheduledDays,
        // Keep legacy column in sync for any consumer still reading it.
        delivery_days: immediateDays,
        min_order: Number(d.min_order) || 0,
        delivery_fee_immediate: toNumOrNull(d.delivery_fee_immediate),
        delivery_fee_scheduled: toNumOrNull(d.delivery_fee_scheduled),
        free_shipping_above_immediate: toNumOrNull(d.free_shipping_above_immediate),
        free_shipping_above_scheduled: toNumOrNull(d.free_shipping_above_scheduled),
        min_order_immediate: toNumOrNull(d.min_order_immediate),
        min_order_scheduled: toNumOrNull(d.min_order_scheduled),
        estimated_delivery_minutes: d.estimated_delivery_minutes === '' ? null : (Number(d.estimated_delivery_minutes) || null),
        updated_at: new Date().toISOString(),
      };

      await Promise.all(d.rows.map((r) => (
        supabase
          .from('delivery_zones')
          .update({
            ...districtLevelPayload,
            allow_immediate: !!r.allow_immediate,
            allow_scheduled: !!r.allow_scheduled,
          })
          .eq('id', r.id)
          .then(({ error }) => { if (error) throw error; })
      )));

      setDirtyDistricts((prev) => {
        const n = new Set(prev);
        n.delete(districtName);
        return n;
      });
      setOk(`"${districtName}" kaydedildi.`);
    } catch (e) {
      console.error(e);
      setErr(e.message || 'İlçe kaydedilemedi.');
    } finally {
      setSavingDistrict('');
    }
  };

  // ── Filtre ────────────────────────────────────────────────────
  const filteredDistricts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return districts.filter((d) => {
      if (!q) return true;
      if (d.district.toLocaleLowerCase('tr-TR').includes(q)) return true;
      return d.rows.some((r) => r.neighborhood.toLocaleLowerCase('tr-TR').includes(q));
    });
  }, [districts, search]);

  const activeCount = districts.filter((d) => d.is_active).length;

  const formatClosedDate = (d) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return d; }
  };

  // Sekmeye göre tema/renk yardımcıları
  const isImmediate = activeTab === 'immediate';
  const accent = isImmediate ? 'green' : 'blue';
  const saveBtnClass = isImmediate
    ? 'bg-brand-primary shadow-[0_10px_24px_rgba(152,205,0,0.35)]'
    : 'bg-blue-500 shadow-[0_10px_24px_rgba(59,130,246,0.35)]';

  // ─── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-geex-text">
      {/* ── Başlık ── */}
      <header className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text flex items-center gap-2">
              <Truck size={22} className="text-brand-primary" /> Teslimat Yönetimi
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Genel ayarlar, ilçe bazlı kargo kuralları, mahalle toggle'ları ve çalışma saatleri tek panelde.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-geex-border bg-geex-bg px-3 py-1 text-xs font-semibold text-slate-500">
            <MapPin size={13} /> {districts.length} ilçe · {activeCount} aktif
          </span>
        </div>
      </header>

      {/* ── Tab strip ── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('immediate')}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'immediate'
              ? 'bg-green-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🚀 Hemen Teslimat
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scheduled')}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'scheduled'
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📅 Randevulu Teslimat
        </button>
      </div>

      <Banner type="err" msg={err} onClose={() => setErr('')} />
      <Banner type="ok" msg={ok} onClose={() => setOk('')} />

      {/* ── Genel Ayarlar ── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-zalando text-geex-text flex items-center gap-2">
            <Clock size={18} className={isImmediate ? 'text-brand-primary' : 'text-blue-500'} />
            Genel Ayarlar — {isImmediate ? 'Hemen Teslimat' : 'Randevulu Teslimat'}
          </h2>
          <button
            type="button"
            onClick={saveGeneral}
            disabled={!generalDirty || generalSaving}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:shadow-none ${saveBtnClass}`}
          >
            {generalSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Kaydet
          </button>
        </div>

        {/* Paylaşılan kargo kuralları (tek sekmeye göre renderlanıyor) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Varsayılan Kargo Ücreti (₺)
            </label>
            <NumInput
              value={isImmediate ? general.immediate.shipping_fee : general.scheduled.shipping_fee}
              onChange={(v) => patchGeneralRule(activeTab, 'shipping_fee', v)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Ücretsiz Kargo Eşiği (₺)
            </label>
            <NumInput
              value={isImmediate ? general.immediate.free_shipping_above : general.scheduled.free_shipping_above}
              onChange={(v) => patchGeneralRule(activeTab, 'free_shipping_above', v)}
              placeholder="0 = devre dışı"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Min. Sepet Tutarı (₺)
            </label>
            <NumInput
              value={isImmediate ? general.immediate.min_order : general.scheduled.min_order}
              onChange={(v) => patchGeneralRule(activeTab, 'min_order', v)}
            />
          </div>
        </div>

        {/* Çalışma saatleri / günleri / kapalı günler — sadece Hemen sekmesinde */}
        {isImmediate && (
          <>
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-500 mb-2">Çalışma Günleri</p>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map(({ value, label }) => (
                  <Pill
                    key={value}
                    active={general.working_days.includes(value)}
                    onClick={() => toggleWorkingDay(value)}
                    accent="green"
                  >
                    {label}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Açılış Saati</label>
                <input
                  type="time"
                  value={general.open_time}
                  onChange={(e) => patchGeneral({ open_time: e.target.value })}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Kapanış Saati</label>
                <input
                  type="time"
                  value={general.close_time}
                  onChange={(e) => patchGeneral({ close_time: e.target.value })}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                <CalendarDays size={13} /> Kapalı Günler
              </p>
              <div className="flex flex-wrap gap-3 items-end mb-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] text-slate-400 mb-1">Açıklama</label>
                  <input
                    value={newDateNote}
                    onChange={(e) => setNewDateNote(e.target.value)}
                    placeholder="Ör: Kurban Bayramı"
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={addClosedDate}
                  className="h-10 inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white"
                >
                  <Plus size={14} /> Ekle
                </button>
              </div>
              {general.closed_dates.length === 0 ? (
                <p className="text-xs text-slate-400">Kapalı gün eklenmedi.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {general.closed_dates.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700">
                      <CalendarDays size={12} className="text-gray-400" />
                      <span className="font-semibold">{formatClosedDate(d)}</span>
                      <span className="text-gray-400">
                        {general.closed_dates_note?.[d] ? `· ${general.closed_dates_note[d]}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeClosedDate(d)}
                        className="ml-1 text-gray-400 hover:text-rose-500"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!isImmediate && (
          <p className="text-xs text-slate-400 italic">
            Çalışma saatleri ve kapalı günler, Hemen Teslimat sekmesinden yönetilir.
            Randevulu teslimat tarihleri sipariş anında kullanıcı tarafından seçilir.
          </p>
        )}
      </section>

      {/* ── Filtre bar ── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İlçe veya mahalle ara..."
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-brand-primary"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {filteredDistricts.length} / {districts.length} ilçe
        </span>
      </section>

      {/* ── İlçe kartları ── */}
      {filteredDistricts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-sm text-slate-400">
          Filtreye uyan ilçe yok. Mahalle verisi henüz yoksa eski Admin panelindeki
          "İzmir mahallelerini içe aktar" aksiyonunu kullanabilirsiniz.
        </div>
      ) : (
        <div>
          {filteredDistricts.map((d) => {
            const isOpen = expanded === d.district;
            const isDirty = dirtyDistricts.has(d.district);
            const neighOpen = !!expandedNeighborhoods[d.district];
            const saving = savingDistrict === d.district;

            // Sekmeye özgü sayaç + bayrak
            const allowField = isImmediate ? 'allow_immediate' : 'allow_scheduled';
            const enabledNeighborhoodsCount = d.rows.filter((r) => r[allowField]).length;
            const allAllowedOn = d.rows.length > 0 && d.rows.every((r) => r[allowField]);
            const tabInactive = !d.is_active || enabledNeighborhoodsCount === 0;

            return (
              <div
                key={d.district}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4 ${
                  tabInactive ? 'opacity-60' : ''
                }`}
              >
                {/* Kart header */}
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => (prev === d.district ? null : d.district))}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    <div className="min-w-0">
                      <p className="font-zalando text-base text-geex-text truncate">{d.district}</p>
                      <p className="text-xs text-slate-500">
                        {enabledNeighborhoodsCount} / {d.rows.length} mahalle · {formatDeliveryDays(
                          isImmediate ? d.deliveryDaysImmediate : d.deliveryDaysScheduled
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold">
                        Kaydedilmedi
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      d.is_active && enabledNeighborhoodsCount > 0
                        ? (isImmediate ? 'bg-green-500 text-white' : 'bg-blue-500 text-white')
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {d.is_active && enabledNeighborhoodsCount > 0 ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </button>

                {/* Expand */}
                {isOpen && (
                  <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
                    {/* Master toggle — tüm mahallelere bu sekmenin allow_* alanını uygular */}
                    <div className="flex items-center gap-3">
                      <Toggle
                        on={allAllowedOn}
                        accent={accent}
                        onClick={() => bulkSetNeighborhoods(d.district, allowField, !allAllowedOn)}
                      />
                      <span className="text-sm font-semibold text-geex-text">
                        {isImmediate ? 'Hemen teslimat' : 'Randevulu teslimat'}{' '}
                        {allAllowedOn ? 'aktif' : 'pasif'} (tüm mahalleler için)
                      </span>
                    </div>

                    {/* İlçe aktif/pasif — paylaşılan */}
                    <div className="flex items-center gap-3 pt-1 border-t border-gray-50 pt-3">
                      <Toggle
                        on={d.is_active}
                        accent={accent}
                        onClick={() => patchDistrict(d.district, { is_active: !d.is_active })}
                      />
                      <span className="text-sm font-semibold text-geex-text">
                        İlçe {d.is_active ? 'aktif' : 'pasif'} <span className="text-[11px] font-normal text-slate-400">(her iki teslimat türünü etkiler)</span>
                      </span>
                    </div>

                    {/* Teslimat günleri — sekmeye özgü */}
                    {(() => {
                      const daysField = isImmediate ? 'deliveryDaysImmediate' : 'deliveryDaysScheduled';
                      const currentDays = Array.isArray(d[daysField]) ? d[daysField] : [];
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-slate-500">
                              Teslimat Günleri
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setDistrictDays(d.district, [1, 2, 3, 4, 5], daysField)}
                                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-gray-50"
                              >
                                Hafta İçi
                              </button>
                              <button
                                type="button"
                                onClick={() => setDistrictDays(d.district, [0, 1, 2, 3, 4, 5, 6], daysField)}
                                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-gray-50"
                              >
                                Her Gün
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {DAY_OPTIONS.map(({ value, label }) => (
                              <Pill
                                key={value}
                                active={currentDays.includes(value)}
                                accent={accent}
                                onClick={() => toggleDistrictDay(d.district, value, daysField)}
                              >
                                {label}
                              </Pill>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sekmeye özgü kargo alanları */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                      <p className={`text-sm font-bold mb-3 ${isImmediate ? 'text-green-700' : 'text-blue-700'}`}>
                        {isImmediate ? 'Hemen Teslimat Ayarları' : 'Randevulu Teslimat Ayarları'}
                      </p>
                      <div className={`grid grid-cols-1 ${isImmediate ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Kargo Ücreti (₺)</label>
                          <NumInput
                            value={isImmediate ? d.delivery_fee_immediate : d.delivery_fee_scheduled}
                            placeholder={String(isImmediate ? general.immediate.shipping_fee : general.scheduled.shipping_fee)}
                            onChange={(v) => patchDistrict(d.district, isImmediate
                              ? { delivery_fee_immediate: v }
                              : { delivery_fee_scheduled: v }
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Ücretsiz Kargo Eşiği (₺)</label>
                          <NumInput
                            value={isImmediate ? d.free_shipping_above_immediate : d.free_shipping_above_scheduled}
                            placeholder={String(isImmediate ? general.immediate.free_shipping_above : general.scheduled.free_shipping_above)}
                            onChange={(v) => patchDistrict(d.district, isImmediate
                              ? { free_shipping_above_immediate: v }
                              : { free_shipping_above_scheduled: v }
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Min. Sepet (₺)</label>
                          <NumInput
                            value={isImmediate ? d.min_order_immediate : d.min_order_scheduled}
                            placeholder={String(isImmediate ? general.immediate.min_order : general.scheduled.min_order)}
                            onChange={(v) => patchDistrict(d.district, isImmediate
                              ? { min_order_immediate: v }
                              : { min_order_scheduled: v }
                            )}
                          />
                        </div>
                        {isImmediate && (
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Ortalama Teslimat Süresi (dk)</label>
                            <NumInput
                              value={d.estimated_delivery_minutes}
                              placeholder="Örn: 45"
                              onChange={(v) => patchDistrict(d.district, { estimated_delivery_minutes: v })}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mahalleler */}
                    <div className="rounded-xl border border-gray-100 p-4">
                      <button
                        type="button"
                        onClick={() => setExpandedNeighborhoods((prev) => ({ ...prev, [d.district]: !prev[d.district] }))}
                        className="w-full flex items-center justify-between gap-2 text-left"
                      >
                        <span className="text-sm font-bold text-geex-text flex items-center gap-2">
                          {neighOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          Mahalleler ({d.rows.length})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {enabledNeighborhoodsCount} {isImmediate ? 'hemen' : 'randevulu'} aktif
                        </span>
                      </button>

                      {neighOpen && (
                        <>
                          <div className="flex flex-wrap gap-2 mt-3 mb-2">
                            <button
                              type="button"
                              onClick={() => bulkSetNeighborhoods(d.district, allowField, true)}
                              className={`rounded-lg border px-3 py-1 text-[11px] font-semibold ${
                                isImmediate
                                  ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              Tümünü Aç
                            </button>
                            <button
                              type="button"
                              onClick={() => bulkSetNeighborhoods(d.district, allowField, false)}
                              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100"
                            >
                              Tümünü Kapa
                            </button>
                          </div>

                          {d.rows.length === 0 ? (
                            <p className="text-center text-xs text-slate-400 py-4">Mahalle yok.</p>
                          ) : (
                            <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
                              <div className="grid grid-cols-[1fr_auto] gap-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sticky top-0 bg-white">
                                <span>Mahalle</span>
                                <span>{isImmediate ? 'Hemen' : 'Randevulu'}</span>
                              </div>
                              {d.rows.map((r) => (
                                <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2">
                                  <span className="truncate text-sm text-geex-text">{r.neighborhood || '—'}</span>
                                  <Toggle
                                    on={r[allowField]}
                                    accent={accent}
                                    onClick={() => toggleNeighborhood(d.district, r.id, allowField)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Save */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => saveDistrict(d.district)}
                        disabled={!isDirty || saving}
                        className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 disabled:shadow-none ${saveBtnClass}`}
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Kaydet
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bilgi kutusu / eski panel bağlantısı */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-bold mb-1">Daha fazla özellik</p>
        <p className="text-[13px]">
          İzmir mahallelerini turkiyeapi.dev üzerinden toplu içe aktarmak için{' '}
          <a href="/boss" className="underline font-semibold">Eski admin paneli → Teslimat sekmesi</a>
          {' '}kullanılabilir. Eski tek-ilçe cargo_rules düzenleyicisi için{' '}
          <a href="/boss/teslimat" className="underline font-semibold">/boss/teslimat</a>
          {' '}hâlâ erişilebilir. Çalışma saatleri için eski{' '}
          <a href="/boss/business-hours" className="underline font-semibold">/boss/business-hours</a>
          {' '}sayfası da çalışmaya devam eder.
        </p>
      </section>
    </div>
  );
}
