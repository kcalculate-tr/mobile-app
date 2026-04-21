import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../../supabase';

const DAY_NAMES = {
  1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba',
  4: 'Perşembe',  5: 'Cuma',  6: 'Cumartesi', 7: 'Pazar',
};

const NATIONAL_HOLIDAYS_2026 = [
  { date: '2026-01-01', note: 'Yılbaşı' },
  { date: '2026-04-23', note: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2026-05-01', note: 'Emek ve Dayanışma Günü' },
  { date: '2026-05-19', note: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
  { date: '2026-07-15', note: 'Demokrasi ve Millî Birlik Günü' },
  { date: '2026-08-30', note: 'Zafer Bayramı' },
  { date: '2026-10-29', note: 'Cumhuriyet Bayramı' },
];

export default function BossBusinessHours() {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [ok,       setOk]       = useState('');

  const [workingDays,  setWorkingDays]  = useState([1,2,3,4,5]);
  const [openTime,     setOpenTime]     = useState('09:00');
  const [closeTime,    setCloseTime]    = useState('21:00');
  const [closedDates,  setClosedDates]  = useState([]);
  const [closedNotes,  setClosedNotes]  = useState({});
  const [newDate,      setNewDate]      = useState('');
  const [newNote,      setNewNote]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('settings')
      .select('working_days, open_time, close_time, closed_dates, closed_dates_note')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      setWorkingDays(data.working_days ?? [1,2,3,4,5]);
      setOpenTime((data.open_time ?? '09:00').slice(0,5));
      setCloseTime((data.close_time ?? '21:00').slice(0,5));
      setClosedDates(data.closed_dates ?? []);
      setClosedNotes(data.closed_dates_note ?? {});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setErr(''); setOk('');
    const { error } = await supabase.from('settings').update({
      working_days: workingDays,
      open_time: openTime,
      close_time: closeTime,
      closed_dates: closedDates,
      closed_dates_note: closedNotes,
    }).eq('id', 1);
    if (error) setErr(error.message);
    else setOk('Ayarlar kaydedildi.');
    setSaving(false);
  };

  const toggleDay = (d) => {
    setWorkingDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    );
  };

  const addDate = () => {
    if (!newDate) { setErr('Tarih seçin.'); return; }
    if (closedDates.includes(newDate)) { setErr('Bu tarih zaten ekli.'); return; }
    setClosedDates(prev => [...prev, newDate].sort());
    setClosedNotes(prev => ({ ...prev, [newDate]: newNote.trim() || 'Kapalı' }));
    setNewDate(''); setNewNote(''); setErr('');
  };

  const removeDate = (d) => {
    setClosedDates(prev => prev.filter(x => x !== d));
    setClosedNotes(prev => { const n = {...prev}; delete n[d]; return n; });
  };

  const addHolidays = () => {
    const toAdd = NATIONAL_HOLIDAYS_2026.filter(h => !closedDates.includes(h.date));
    if (toAdd.length === 0) { setOk('Tüm resmi tatiller zaten ekli.'); return; }
    setClosedDates(prev => [...prev, ...toAdd.map(h => h.date)].sort());
    setClosedNotes(prev => {
      const n = {...prev};
      toAdd.forEach(h => { n[h.date] = h.note; });
      return n;
    });
    setOk(`${toAdd.length} resmi tatil eklendi.`);
  };

  const formatDate = (d) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' }); }
    catch { return d; }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-brand-primary" />
    </div>
  );

  return (
    <div className="space-y-5 text-geex-text">

      {/* ── Header ── */}
      <header className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-zalando text-geex-text flex items-center gap-2">
              <Clock size={22} className="text-brand-primary" /> Çalışma Saatleri & Tatil
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Hemen/gel-al teslimat için çalışma saatlerini, randevulu teslimat için kapalı günleri yönetin.
            </p>
          </div>
          <button onClick={save} disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand-primary px-5 text-sm font-bold text-white shadow-[0_10px_20px_rgba(152,205,0,0.25)] disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Kaydet
          </button>
        </div>
        {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        {ok  && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      </header>

      {/* ── Çalışma Günleri ── */}
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <p className="mb-4 text-sm font-bold text-geex-text">Çalışma Günleri</p>
        <p className="mb-4 text-xs text-slate-400">Hemen ve gel-al teslimat için geçerli çalışma günleri.</p>
        <div className="flex flex-wrap gap-2">
          {[1,2,3,4,5,6,7].map(d => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                workingDays.includes(d)
                  ? 'bg-brand-primary text-white shadow-[0_4px_14px_rgba(152,205,0,0.35)]'
                  : 'border border-geex-border bg-white text-geex-text hover:bg-geex-bg'
              } ${d >= 6 ? 'opacity-60' : ''}`}>
              {DAY_NAMES[d]}
              {d >= 6 && <span className="ml-1 text-[10px]">(Hafta sonu)</span>}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          ℹ️ Hafta sonları randevulu teslimat için her zaman kapalıdır.
        </p>
      </section>

      {/* ── Çalışma Saatleri ── */}
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <p className="mb-4 text-sm font-bold text-geex-text">Çalışma Saatleri</p>
        <p className="mb-4 text-xs text-slate-400">Hemen ve gel-al teslimat bu saatler dışında kapalı görünür.</p>
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Açılış Saati</label>
            <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)}
              className="h-11 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold focus:border-brand-primary focus:outline-none" />
          </div>
          <div className="text-slate-400 text-lg">—</div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Kapanış Saati</label>
            <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)}
              className="h-11 rounded-2xl border border-geex-border bg-white px-4 text-sm font-semibold focus:border-brand-primary focus:outline-none" />
          </div>
          <div className="mt-5 rounded-2xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-2.5">
            <p className="text-sm font-bold text-geex-text">{openTime} – {closeTime}</p>
            <p className="text-xs text-slate-500">aktif çalışma saatleri</p>
          </div>
        </div>
      </section>

      {/* ── Kapalı Günler ── */}
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <p className="text-sm font-bold text-geex-text">Kapalı Günler ve Resmi Tatiller</p>
            <p className="mt-1 text-xs text-slate-400">Bu günlerde hemen/gel-al ve randevulu teslimat yapılmaz.</p>
          </div>
          <button onClick={addHolidays}
            className="inline-flex items-center gap-2 rounded-2xl border border-geex-border bg-white px-4 py-2 text-sm font-semibold text-geex-text hover:bg-geex-bg transition">
            <CalendarDays size={14} /> 2026 Resmi Tatillerini Ekle
          </button>
        </div>

        {/* Yeni tarih ekle */}
        <div className="mb-4 rounded-2xl border border-geex-border bg-geex-bg p-4">
          <p className="mb-3 text-xs font-semibold text-slate-500">Yeni Kapalı Gün Ekle</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Tarih</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().slice(0,10)}
                className="h-10 rounded-xl border border-geex-border bg-white px-3 text-sm focus:outline-none focus:border-brand-primary" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="mb-1 block text-xs text-slate-400">Açıklama</label>
              <input value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="Ör: Kurban Bayramı"
                className="h-10 w-full rounded-xl border border-geex-border bg-white px-3 text-sm focus:outline-none focus:border-brand-primary" />
            </div>
            <button onClick={addDate}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white">
              <Plus size={14} /> Ekle
            </button>
          </div>
        </div>

        {/* Liste */}
        {closedDates.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Henüz kapalı gün eklenmedi.</p>
        ) : (
          <div className="space-y-2">
            {closedDates.map(d => (
              <div key={d} className="flex items-center justify-between rounded-2xl border border-geex-border bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-geex-text">{formatDate(d)}</p>
                  <p className="text-xs text-slate-400">{closedNotes[d] || '—'}</p>
                </div>
                <button onClick={() => removeDate(d)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Bilgi kutusu ── */}
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-bold text-amber-800 mb-2">Kurallar Özeti</p>
        <ul className="space-y-1.5 text-sm text-amber-700">
          <li>• <strong>Hemen / Gel-Al:</strong> Sadece çalışma günleri ve saatleri içinde sipariş alınır.</li>
          <li>• <strong>Randevulu:</strong> Hafta sonları (Cmt-Paz) ve kapalı günlerde seçilemez.</li>
          <li>• <strong>Tüm tipler:</strong> Kapalı günlerde sipariş alınmaz.</li>
        </ul>
      </section>
    </div>
  );
}
