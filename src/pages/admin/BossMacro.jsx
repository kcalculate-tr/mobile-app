import React, { useCallback, useEffect, useState } from 'react';
import {
  Crown, Loader2, RefreshCw, Save, Search,
  TrendingUp, Users, Wallet, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../../supabase';

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(v) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(Number(v || 0));
}

function daysLeft(until) {
  if (!until) return 0;
  const diff = new Date(until).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function isPrivileged(until) {
  if (!until) return false;
  return new Date(until) > new Date();
}

// ── Ayarlar ───────────────────────────────────────────────────────────────────
function SettingsPanel({ onSaved }) {
  const [settings, setSettings] = useState({ macro_price: 1500, macro_threshold: 15, macro_membership_days: 30 });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [ok,       setOk]       = useState('');
  const [err,      setErr]      = useState('');

  useEffect(() => {
    supabase.from('settings').select('macro_price,macro_threshold,macro_membership_days').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data) setSettings({ macro_price: data.macro_price ?? 1500, macro_threshold: data.macro_threshold ?? 15, macro_membership_days: data.macro_membership_days ?? 30 });
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true); setErr(''); setOk('');
    const { error } = await supabase.from('settings').update({
      macro_price: Number(settings.macro_price),
      macro_threshold: Number(settings.macro_threshold),
      macro_membership_days: Number(settings.macro_membership_days),
    }).eq('id', 1);
    if (error) setErr(error.message);
    else { setOk('Ayarlar kaydedildi.'); onSaved?.(); }
    setSaving(false);
  };

  if (loading) return <div className="py-8 text-center text-slate-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>;

  return (
    <div className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft space-y-4">
      <p className="text-sm font-bold text-geex-text">Macro Ayarları</p>

      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      {ok  && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { key: 'macro_price',           label: 'Macro Fiyatı (₺)',      min: 100,  step: 100 },
          { key: 'macro_threshold',        label: 'Üyelik İçin Macro Sayısı', min: 1, step: 1   },
          { key: 'macro_membership_days',  label: 'Üyelik Süresi (Gün)',   min: 1,  step: 1   },
        ].map(({ key, label, min, step }) => (
          <div key={key}>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</label>
            <input
              type="number" min={min} step={step}
              value={settings[key]}
              onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
              className="h-11 w-full rounded-xl border border-geex-border bg-white px-3 text-sm font-semibold text-geex-text focus:border-brand-primary focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand-primary px-5 text-sm font-bold text-white shadow-[0_10px_20px_rgba(152,205,0,0.25)] disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Kaydet
        </button>
      </div>
    </div>
  );
}

// ── Üye listesi ───────────────────────────────────────────────────────────────
function MembersPanel() {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all'); // all | privileged | regular
  const [expanded, setExpanded] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txData,    setTxData]    = useState({});

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone, macro_balance, macro_points, privileged_until, total_macros_purchased, created_at')
      .order('macro_balance', { ascending: false })
      .limit(500);
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const adjustMacro = async (userId, delta) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('macro_balance, privileged_until')
      .eq('id', userId)
      .maybeSingle();
    const newBalance = Math.max(0, (profile?.macro_balance ?? 0) + delta);
    let privilegedUntil = profile?.privileged_until;
    if (newBalance >= 15) {
      const base = privilegedUntil && new Date(privilegedUntil) > new Date()
        ? new Date(privilegedUntil) : new Date();
      base.setDate(base.getDate() + 30);
      privilegedUntil = base.toISOString();
    }
    await supabase.from('profiles').update({
      macro_balance: newBalance,
      ...(privilegedUntil !== profile?.privileged_until ? { privileged_until: privilegedUntil } : {}),
    }).eq('id', userId);
    await supabase.from('macro_transactions').insert({
      user_id: userId,
      type: delta > 0 ? 'reward' : 'adjustment',
      amount: delta,
      note: `Boss panel ${delta > 0 ? 'ekleme' : 'çıkarma'}`,
    });
    fetchMembers();
  };

  const fetchTransactions = async (userId) => {
    if (txData[userId]) { setExpanded(expanded === userId ? null : userId); return; }
    setTxLoading(true);
    setExpanded(userId);
    const { data } = await supabase
      .from('macro_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    setTxData(prev => ({ ...prev, [userId]: data || [] }));
    setTxLoading(false);
  };

  const filtered = members.filter(m => {
    const name  = String(m.full_name || '').toLowerCase();
    const phone = String(m.phone || '').toLowerCase();
    const q     = search.toLowerCase();
    if (q && !name.includes(q) && !phone.includes(q)) return false;
    if (filter === 'privileged' && !isPrivileged(m.privileged_until)) return false;
    if (filter === 'regular'    &&  isPrivileged(m.privileged_until)) return false;
    return true;
  });

  const privilegedCount = members.filter(m => isPrivileged(m.privileged_until)).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Toplam Üye',        value: members.length,      icon: <Users size={16} className="text-slate-400" /> },
          { label: 'Ayrıcalıklı',       value: privilegedCount,     icon: <Crown size={16} className="text-amber-500" /> },
          { label: 'Toplam Macro',       value: members.reduce((s, m) => s + (m.macro_balance || 0), 0), icon: <TrendingUp size={16} className="text-brand-primary" /> },
          { label: 'Toplam Alım',        value: members.reduce((s, m) => s + (m.total_macros_purchased || 0), 0), icon: <Wallet size={16} className="text-indigo-500" /> },
        ].map((s, i) => (
          <div key={i} className="rounded-3xl border border-geex-border bg-geex-card p-4 shadow-geex-soft">
            <div className="flex items-center justify-between mb-1">{s.icon}<span /></div>
            <p className="text-2xl font-zalando text-geex-text">{s.value.toLocaleString('tr-TR')}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-geex-border bg-geex-card p-4 shadow-geex-soft flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="İsim veya telefon ara..."
            className="h-10 w-full rounded-2xl border border-geex-border bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-brand-primary" />
        </div>
        <div className="flex rounded-2xl border border-geex-border bg-white p-1 gap-1">
          {[
            { key: 'all',        label: 'Tümü' },
            { key: 'privileged', label: '⭐ Ayrıcalıklı' },
            { key: 'regular',    label: 'Normal' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${filter === f.key ? 'bg-brand-primary text-white' : 'text-slate-500 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={fetchMembers} disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold disabled:opacity-60">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* Liste */}
      <div className="rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft overflow-hidden">
        {loading ? (
          <div className="py-12 text-center"><Loader2 size={20} className="animate-spin mx-auto text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Üye bulunamadı.</div>
        ) : (
          <div className="divide-y divide-geex-border">
            {filtered.map(m => {
              const priv    = isPrivileged(m.privileged_until);
              const days    = daysLeft(m.privileged_until);
              const isOpen  = expanded === m.id;
              const txs     = txData[m.id] || [];

              return (
                <div key={m.id}>
                  <button
                    onClick={() => fetchTransactions(m.id)}
                    className="w-full text-left px-5 py-4 hover:bg-geex-bg/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white ${priv ? 'bg-gradient-to-br from-amber-400 to-rose-500' : 'bg-slate-200 text-slate-500'}`}>
                        {priv ? '⭐' : (m.full_name?.[0]?.toUpperCase() || '?')}
                      </div>

                      {/* İsim */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-geex-text">{m.full_name || 'İsimsiz'}</p>
                          {priv && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              ⭐ Ayrıcalıklı • {days} gün
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{m.phone || 'Telefon yok'}</p>
                      </div>

                      {/* Macro stats */}
                      <div className="hidden sm:flex items-center gap-6 text-center">
                        <div>
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={(e) => { e.stopPropagation(); adjustMacro(m.id, -1); }} className="w-6 h-6 rounded-full bg-red-100 text-red-600 font-black text-sm leading-none">−</button>
                            <p className="text-sm font-black text-geex-text w-6">{m.macro_balance ?? 0}</p>
                            <button onClick={(e) => { e.stopPropagation(); adjustMacro(m.id, +1); }} className="w-6 h-6 rounded-full bg-green-100 text-green-600 font-black text-sm leading-none">+</button>
                          </div>
                          <p className="text-[10px] text-slate-400">Bakiye</p>
                        </div>
                        <div>
                          <p className="text-sm font-black text-geex-text">{m.total_macros_purchased ?? 0}</p>
                          <p className="text-[10px] text-slate-400">Toplam Alım</p>
                        </div>
                        <div>
                          <p className="text-sm font-black text-geex-text">{m.macro_points ?? 0}</p>
                          <p className="text-[10px] text-slate-400">Macro Pts</p>
                        </div>
                      </div>

                      {/* Expand icon */}
                      <div className="shrink-0 text-slate-400">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* İşlem geçmişi */}
                  {isOpen && (
                    <div className="border-t border-geex-border bg-geex-bg/50 px-5 py-4">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">İşlem Geçmişi</p>

                      {/* Üyelik bilgisi */}
                      {priv && (
                        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-xs font-semibold text-amber-800">
                            ⭐ Ayrıcalıklı Üyelik — {formatDate(m.privileged_until)} tarihine kadar ({days} gün kaldı)
                          </p>
                        </div>
                      )}

                      {txLoading ? (
                        <div className="py-4 text-center"><Loader2 size={16} className="animate-spin mx-auto text-slate-400" /></div>
                      ) : txs.length === 0 ? (
                        <p className="text-xs text-slate-400">İşlem geçmişi yok.</p>
                      ) : (
                        <div className="space-y-2">
                          {txs.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between rounded-xl border border-geex-border bg-white px-3 py-2.5">
                              <div>
                                <p className="text-xs font-semibold text-geex-text">
                                  {tx.type === 'purchase'           ? '🛒 Satın Alma'
                                   : tx.type === 'reward'            ? '🎁 Kazanım'
                                   : tx.type === 'membership_unlock' ? '⭐ Üyelik Aktifleşti'
                                   : tx.type}
                                </p>
                                {tx.note && <p className="text-[11px] text-slate-400">{tx.note}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                {tx.amount !== 0 && (
                                  <p className={`text-sm font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount} Macro
                                  </p>
                                )}
                                {tx.price_paid && (
                                  <p className="text-[11px] text-slate-400">{formatCurrency(tx.price_paid)}</p>
                                )}
                                <p className="text-[10px] text-slate-300">{formatDate(tx.created_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Manuel macro ekle */}
                      <ManualMacroForm userId={m.id} onDone={() => {
                        setTxData(prev => { const n = {...prev}; delete n[m.id]; return n; });
                        fetchMembers();
                        fetchTransactions(m.id);
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manuel macro ekle ─────────────────────────────────────────────────────────
function ManualMacroForm({ userId, onDone }) {
  const [amount,  setAmount]  = useState('');
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  const save = async () => {
    const n = parseInt(amount);
    if (!Number.isFinite(n) || n === 0) { setErr('Geçerli miktar girin.'); return; }
    setSaving(true); setErr('');
    try {
      // Balance güncelle
      const { data: profile } = await supabase.from('profiles').select('macro_balance, privileged_until').eq('id', userId).maybeSingle();
      const newBalance = Math.max(0, (profile?.macro_balance ?? 0) + n);
      await supabase.from('profiles').update({ macro_balance: newBalance }).eq('id', userId);

      // Transaction kaydet
      await supabase.from('macro_transactions').insert({
        user_id: userId, type: 'reward', amount: n,
        note: note.trim() || `Manuel ${n > 0 ? 'ekleme' : 'düzeltme'}`,
      });

      setAmount(''); setNote('');
      onDone?.();
    } catch (e) { setErr(e?.message || 'Hata'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-4 rounded-xl border border-geex-border bg-white p-3">
      <p className="mb-2 text-xs font-bold text-slate-500">Manuel Macro Ekle / Düzelt</p>
      {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
      <div className="flex gap-2">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="±Miktar (örn: 5 veya -2)"
          className="h-9 flex-1 rounded-xl border border-geex-border px-3 text-sm focus:outline-none focus:border-brand-primary" />
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="Not (opsiyonel)"
          className="h-9 flex-1 rounded-xl border border-geex-border px-3 text-sm focus:outline-none focus:border-brand-primary" />
        <button onClick={save} disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-60">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Kaydet
        </button>
      </div>
    </div>
  );
}

// ── Ana sayfa ─────────────────────────────────────────────────────────────────
export default function BossMacro({ embedded = false }) {
  const [tab, setTab] = useState('members');

  return (
    <div className={embedded ? 'p-5 space-y-4 text-geex-text' : 'space-y-5 text-geex-text'}>
      <header className={embedded ? 'hidden' : 'rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text flex items-center gap-2">
              <Crown size={22} className="text-amber-500" /> Macro Yönetimi
            </h1>
            <p className="mt-1 text-sm text-slate-500">Macro Coin fiyatı, üyelik eşiği ve ayrıcalıklı üyeler.</p>
          </div>
        </div>
        <div className="mt-4 inline-flex rounded-2xl border border-geex-border bg-geex-bg p-1 gap-1">
          {[
            { key: 'members',  label: 'Üyeler & Geçmiş' },
            { key: 'settings', label: 'Ayarlar' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-brand-primary text-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]' : 'text-geex-text hover:bg-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'members'  && <MembersPanel />}
      {tab === 'settings' && <SettingsPanel onSaved={() => setTab('members')} />}
    </div>
  );
}
