/**
 * BossDelivery.jsx — Teslimat Bölgeleri Yönetimi
 *
 * Tables:
 *   delivery_zones(id, city, district, neighborhood, min_order,
 *                  allow_immediate, allow_scheduled, is_active)
 *   delivery_settings(district TEXT PK, cargo_rules JSONB, updated_at)
 *
 * cargo_rules shape:
 *   { immediate: { active, min_order, shipping_fee, free_shipping_above },
 *     scheduled: { active, min_order, shipping_fee, free_shipping_above } }
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, MapPin, Save, ToggleLeft, ToggleRight, Truck, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { fetchAllDeliveryZones } from '../../lib/supabaseHelpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'immediate', label: 'Hemen Teslim',     Icon: Clock },
  { key: 'scheduled', label: 'Randevulu Teslim',  Icon: Truck },
];

const DEFAULT_RULES = {
  immediate: { active: true,  min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
  scheduled: { active: true,  min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
};

function getRules(settings, district) {
  const row = settings[district];
  if (!row) return structuredClone(DEFAULT_RULES);
  const r = typeof row === 'object' ? row : {};
  return {
    immediate: { ...DEFAULT_RULES.immediate, ...(r.immediate || {}) },
    scheduled: { ...DEFAULT_RULES.scheduled, ...(r.scheduled || {}) },
  };
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
    </div>
  );
}

function ErrBox({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {msg}<button type="button" onClick={onClose}><X size={14} /></button>
    </div>
  );
}

function OkBox({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
      {msg}<button type="button" onClick={onClose}><X size={14} /></button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BossDelivery() {
  const [tab, setTab]                       = useState('immediate');
  const [zones, setZones]                   = useState([]);
  const [settings, setSettings]             = useState({});  // { [district]: cargo_rules }
  const [loading, setLoading]               = useState(true);
  const [err, setErr]                       = useState('');
  const [ok, setOk]                         = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  // Per-district rule editor state (ephemeral, reset on district change)
  const [ruleDraft, setRuleDraft]           = useState(null);
  const [ruleSaving, setRuleSaving]         = useState(false);

  // Neighborhood toggle saving
  const [togglingId, setTogglingId]         = useState(null);
  const [bulkSaving, setBulkSaving]         = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [zones, settingsRes] = await Promise.all([
        // Paginated — PostgREST single-request cap of 1000 rows would drop
        // late-alphabetical districts once mahalleler grow past that threshold.
        fetchAllDeliveryZones({
          select: 'id, city, district, neighborhood, min_order, allow_immediate, allow_scheduled, is_active',
          orderBy: ['district', 'neighborhood'],
        }),
        supabase
          .from('delivery_settings')
          .select('district, cargo_rules'),
      ]);

      setZones(zones);

      if (!settingsRes.error && settingsRes.data) {
        const map = {};
        settingsRes.data.forEach(row => { map[row.district] = row.cargo_rules || {}; });
        setSettings(map);
      }
    } catch (e) {
      setErr(e?.message || 'Teslimat bölgeleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Districts list ────────────────────────────────────────────────────────
  const districts = useMemo(() => {
    const seen = new Set();
    const list = [];
    zones.forEach(z => {
      if (z.district && !seen.has(z.district)) {
        seen.add(z.district);
        list.push(z.district);
      }
    });
    return list.sort((a, b) => a.localeCompare(b, 'tr'));
  }, [zones]);

  // Auto-select first district
  useEffect(() => {
    if (!selectedDistrict && districts.length > 0) setSelectedDistrict(districts[0]);
  }, [districts, selectedDistrict]);

  // Reset draft when district or tab changes
  useEffect(() => {
    if (!selectedDistrict) return;
    const rules = getRules(settings, selectedDistrict);
    setRuleDraft(structuredClone(rules[tab]));
  }, [selectedDistrict, tab, settings]);

  // ── Neighborhoods for selected district ───────────────────────────────────
  const neighborhoods = useMemo(() => {
    if (!selectedDistrict) return [];
    return zones.filter(z => z.district === selectedDistrict);
  }, [zones, selectedDistrict]);

  // ── District stats ────────────────────────────────────────────────────────
  const districtStats = useMemo(() => {
    const map = {};
    districts.forEach(d => {
      const rows = zones.filter(z => z.district === d);
      const activeImm = rows.filter(r => r.allow_immediate).length;
      const activeSch = rows.filter(r => r.allow_scheduled).length;
      map[d] = { total: rows.length, activeImm, activeSch };
    });
    return map;
  }, [districts, zones]);

  // ── Save cargo rules (UPSERT delivery_settings) ───────────────────────────
  const saveRules = async () => {
    if (!selectedDistrict || !ruleDraft) return;
    setRuleSaving(true); setErr(''); setOk('');

    // Merge with existing other-tab rules
    const existingRules = getRules(settings, selectedDistrict);
    const otherKey = tab === 'immediate' ? 'scheduled' : 'immediate';
    const newRules = {
      [tab]: {
        active: ruleDraft.active,
        min_order: Number(ruleDraft.min_order) || 0,
        shipping_fee: Number(ruleDraft.shipping_fee) || 0,
        free_shipping_above: Number(ruleDraft.free_shipping_above) || 0,
      },
      [otherKey]: existingRules[otherKey],
    };

    const { error } = await supabase
      .from('delivery_settings')
      .upsert({ district: selectedDistrict, cargo_rules: newRules, updated_at: new Date().toISOString() }, { onConflict: 'district' });

    if (error) { setErr(error.message); }
    else {
      setSettings(prev => ({ ...prev, [selectedDistrict]: newRules }));
      setOk(`${selectedDistrict} teslimat kuralları kaydedildi.`);
    }
    setRuleSaving(false);
  };

  // ── Toggle neighborhood ───────────────────────────────────────────────────
  const toggleNeighborhood = async (zone) => {
    const field = tab === 'immediate' ? 'allow_immediate' : 'allow_scheduled';
    const newVal = !zone[field];
    setTogglingId(zone.id);
    const { error } = await supabase.from('delivery_zones').update({ [field]: newVal }).eq('id', zone.id);
    if (error) setErr(error.message);
    else setZones(prev => prev.map(z => z.id === zone.id ? { ...z, [field]: newVal } : z));
    setTogglingId(null);
  };

  // ── Bulk toggle ───────────────────────────────────────────────────────────
  const bulkToggle = async (value) => {
    if (!selectedDistrict) return;
    const field = tab === 'immediate' ? 'allow_immediate' : 'allow_scheduled';
    const ids = neighborhoods.map(z => z.id);
    if (ids.length === 0) return;
    setBulkSaving(true);
    const { error } = await supabase.from('delivery_zones').update({ [field]: value }).in('id', ids);
    if (error) setErr(error.message);
    else {
      setZones(prev => prev.map(z => z.district === selectedDistrict ? { ...z, [field]: value } : z));
      setOk(`${selectedDistrict}: tüm mahalleler ${value ? 'açıldı' : 'kapatıldı'}.`);
    }
    setBulkSaving(false);
  };

  const setDraft = (k, v) => setRuleDraft(prev => ({ ...prev, [k]: v }));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text">Teslimat Yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">İlçe ve mahalle bazında hemen / randevulu teslim ayarlarını yapın.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-geex-border bg-geex-bg px-3 py-1 text-xs font-semibold text-slate-500">
            <MapPin size={13} /> {zones.length} bölge
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-4 inline-flex rounded-2xl border border-geex-border bg-geex-bg p-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? 'bg-brand-primary text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]'
                  : 'text-geex-text hover:bg-white'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </section>

      {/* Hemen teslim info banner */}
      {tab === 'immediate' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>⏰ Hemen teslim</strong> siparişleri yalnızca <strong>09:00 – 21:00</strong> saatleri arasında alınır.
            Bu kural uygulama tarafında otomatik uygulanmaktadır.
          </span>
        </div>
      )}

      <ErrBox msg={err} onClose={() => setErr('')} />
      <OkBox  msg={ok}  onClose={() => setOk('')} />

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
          {/* ── Sol: İlçe listesi ── */}
          <section className="rounded-3xl border border-geex-border bg-geex-card p-4 shadow-geex-soft">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">İlçeler</p>
            <div className="space-y-1">
              {districts.length === 0 ? (
                <p className="text-sm text-slate-400">Veri yok.</p>
              ) : districts.map(d => {
                const stats = districtStats[d] || {};
                const activeCount = tab === 'immediate' ? stats.activeImm : stats.activeSch;
                const rules = getRules(settings, d);
                const isOpen = rules[tab]?.active;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDistrict(d)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      selectedDistrict === d
                        ? 'bg-brand-primary/10 font-bold text-green-800 border border-green-200'
                        : 'text-geex-text hover:bg-geex-bg'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${isOpen ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span>{d}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{activeCount}/{stats.total}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Sağ: İlçe detayları ── */}
          <div className="space-y-4">
            {!selectedDistrict ? (
              <div className="flex items-center justify-center rounded-3xl border border-geex-border bg-geex-card p-16 shadow-geex-soft">
                <p className="text-sm text-slate-400">Sol panelden bir ilçe seçin.</p>
              </div>
            ) : (
              <>
                {/* ── Kargo kuralları kartı ── */}
                <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-zalando text-geex-text">{selectedDistrict}</h2>
                      <p className="text-xs text-slate-500">
                        {tab === 'immediate' ? 'Hemen teslim' : 'Randevulu teslim'} kargo kuralları
                      </p>
                    </div>
                    {/* Teslimata Açık toggle */}
                    {ruleDraft && (
                      <button
                        type="button"
                        onClick={() => setDraft('active', !ruleDraft.active)}
                        className="flex items-center gap-2"
                      >
                        {ruleDraft.active
                          ? <ToggleRight size={32} className="text-green-500" />
                          : <ToggleLeft  size={32} className="text-gray-300" />}
                        <span className="text-sm font-semibold text-geex-text">
                          {ruleDraft.active ? 'Teslimata Açık' : 'Teslimata Kapalı'}
                        </span>
                      </button>
                    )}
                  </div>

                  {ruleDraft && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Min. Sepet Tutarı (₺)</label>
                        <input
                          type="number" min="0" step="1"
                          value={ruleDraft.min_order}
                          onChange={e => setDraft('min_order', e.target.value)}
                          className="w-full rounded-xl border border-geex-border bg-geex-bg px-3 py-2 text-sm text-geex-text outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Gönderim Ücreti (₺)</label>
                        <input
                          type="number" min="0" step="1"
                          value={ruleDraft.shipping_fee}
                          onChange={e => setDraft('shipping_fee', e.target.value)}
                          className="w-full rounded-xl border border-geex-border bg-geex-bg px-3 py-2 text-sm text-geex-text outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ücretsiz Gönderim Limiti (₺)</label>
                        <input
                          type="number" min="0" step="1"
                          value={ruleDraft.free_shipping_above}
                          onChange={e => setDraft('free_shipping_above', e.target.value)}
                          placeholder="0 = devre dışı"
                          className="w-full rounded-xl border border-geex-border bg-geex-bg px-3 py-2 text-sm text-geex-text outline-none focus:border-brand-primary"
                        />
                        {Number(ruleDraft.free_shipping_above) > 0 && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            ₺{Number(ruleDraft.free_shipping_above).toLocaleString('tr-TR')} üzeri ücretsiz
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={saveRules}
                      disabled={ruleSaving}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)] disabled:opacity-60"
                    >
                      {ruleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Kuralları Kaydet
                    </button>
                  </div>
                </section>

                {/* ── Mahalleler listesi ── */}
                <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-zalando text-base text-geex-text">Mahalleler</h3>
                      <p className="text-xs text-slate-500">
                        {tab === 'immediate' ? 'allow_immediate' : 'allow_scheduled'} toggle'ları
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => bulkToggle(true)}
                        disabled={bulkSaving}
                        className="rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        Tümünü Aç
                      </button>
                      <button
                        type="button"
                        onClick={() => bulkToggle(false)}
                        disabled={bulkSaving}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Tümünü Kapat
                      </button>
                    </div>
                  </div>

                  {neighborhoods.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">Bu ilçeye ait mahalle kaydı bulunamadı.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {/* Header row */}
                      <div className="grid grid-cols-[1fr_auto] gap-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <span>Mahalle</span>
                        <span>{tab === 'immediate' ? 'Hemen' : 'Programlı'}</span>
                      </div>

                      {neighborhoods.map(z => {
                        const isActive = tab === 'immediate' ? z.allow_immediate : z.allow_scheduled;
                        const isToggling = togglingId === z.id;
                        return (
                          <div key={z.id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <span className="truncate text-sm text-geex-text">{z.neighborhood || '—'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleNeighborhood(z)}
                              disabled={isToggling}
                              className="shrink-0"
                            >
                              {isToggling
                                ? <Loader2 size={20} className="animate-spin text-slate-400" />
                                : isActive
                                  ? <ToggleRight size={26} className={tab === 'immediate' ? 'text-green-500' : 'text-blue-500'} />
                                  : <ToggleLeft  size={26} className="text-gray-300" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
