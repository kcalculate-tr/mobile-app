import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Send, XCircle } from 'lucide-react';
import { supabase } from '../../supabase';

const CATEGORIES = [
  { key: 'marketing',     label: 'Marketing' },
  { key: 'transactional', label: 'Transactional' },
  { key: 'reminder',      label: 'Reminder' },
  { key: 'behavioral',    label: 'Behavioral' },
];

const DEEP_LINKS = [
  { key: '',                label: '— yok —' },
  { key: 'Home',            label: 'Home (ana sayfa)' },
  { key: 'ProfileOrders',   label: 'Profilim > Siparişler' },
  { key: 'ProfileCoupons',  label: 'Profilim > Kuponlar' },
  { key: 'Subscriptions',   label: 'Abonelikler' },
];

function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function statusBadge(status) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold';
  switch (status) {
    case 'sent':
    case 'delivered':
      return <span className={`${base} bg-emerald-100 text-emerald-700`}><CheckCircle2 size={11} />{status}</span>;
    case 'queued':
      return <span className={`${base} bg-sky-100 text-sky-700`}><Clock size={11} />{status}</span>;
    case 'skipped':
      return <span className={`${base} bg-slate-100 text-slate-600`}>{status}</span>;
    case 'failed':
      return <span className={`${base} bg-rose-100 text-rose-700`}><XCircle size={11} />{status}</span>;
    default:
      return <span className={`${base} bg-slate-100 text-slate-600`}>{status || '—'}</span>;
  }
}

export default function PushTestPanel() {
  const [mode, setMode] = useState('content'); // 'content' | 'template'
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [templateVars, setTemplateVars] = useState('{}');

  const [title, setTitle] = useState('Test bildirimi');
  const [body, setBody] = useState('Admin panelden gönderildi.');
  const [deepLink, setDeepLink] = useState('');
  const [category, setCategory] = useState('marketing');

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState('');

  const [recentSends, setRecentSends] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // ── Fetch users (profiles) ────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, user_email')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? [])
        .map((row) => ({
          userId: row.user_id || row.id,
          name: row.full_name || row.email || row.user_email || '',
          email: row.email || row.user_email || '',
        }))
        .filter((u) => u.userId);
      setUsers(rows);
    } catch (e) {
      console.warn('[PushTestPanel] user fetch failed:', e?.message || e);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // ── Fetch templates ───────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('key', { ascending: true });
      if (error) throw error;
      setTemplates(data ?? []);
    } catch (e) {
      console.warn('[PushTestPanel] template fetch failed:', e?.message || e);
    }
  }, []);

  // ── Fetch recent notification_sends ───────────────────────────────────────
  const fetchRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_sends')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setRecentSends(data ?? []);
    } catch (e) {
      console.warn('[PushTestPanel] recent fetch failed:', e?.message || e);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTemplates();
    fetchRecent();
  }, [fetchUsers, fetchTemplates, fetchRecent]);

  useEffect(() => {
    const id = setInterval(fetchRecent, 5000);
    return () => clearInterval(id);
  }, [fetchRecent]);

  // ── Filter users ──────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 200);
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    ).slice(0, 200);
  }, [users, userSearch]);

  const selectedUser = useMemo(
    () => users.find((u) => u.userId === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    setSendError('');
    setSendResult(null);

    if (!selectedUserId) {
      setSendError('Kullanıcı seçilmeli.');
      return;
    }

    let payload;
    if (mode === 'template') {
      if (!selectedTemplateKey) {
        setSendError('Template seçilmeli.');
        return;
      }
      let vars = {};
      try {
        vars = templateVars.trim() ? JSON.parse(templateVars) : {};
        if (typeof vars !== 'object' || Array.isArray(vars)) throw new Error('object bekleniyor');
      } catch (e) {
        setSendError(`Vars JSON parse hatası: ${e?.message || e}`);
        return;
      }
      payload = {
        mode: 'by_template_single',
        user_id: selectedUserId,
        template_key: selectedTemplateKey,
        vars,
      };
    } else {
      if (!title.trim() || !body.trim()) {
        setSendError('Title ve body boş olamaz.');
        return;
      }
      payload = {
        mode: 'by_content',
        user_ids: [selectedUserId],
        title: title.trim(),
        body: body.trim(),
        category,
        ...(deepLink ? { deep_link: deepLink } : {}),
      };
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: payload,
      });
      if (error) throw error;
      setSendResult(data);
      fetchRecent();
    } catch (e) {
      setSendError(e?.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.key === selectedTemplateKey) ?? null;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-geex-border bg-geex-card px-6 py-5 shadow-geex-soft">
        <h1 className="text-xl font-semibold text-geex-text">Push Notification Test</h1>
        <p className="mt-1 text-sm text-slate-500">
          send-notification Edge Function'ı manuel tetikle. Preferences & token kontrolleri Edge Function'da yapılır.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Sol: form ── */}
        <section className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mod</span>
            <div className="inline-flex rounded-xl border border-geex-border bg-white p-1">
              {[
                { key: 'content',  label: 'Custom içerik' },
                { key: 'template', label: 'Template' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMode(opt.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    mode === opt.key
                      ? 'bg-brand-primary text-white'
                      : 'text-geex-text hover:bg-geex-bg'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hedef */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hedef kullanıcı
            </label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="İsim / email / user_id ile ara"
              className="mb-2 w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm"
            />
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              size={6}
              className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm"
            >
              {usersLoading && <option>Yükleniyor…</option>}
              {!usersLoading && filteredUsers.length === 0 && (
                <option disabled>— eşleşen kullanıcı yok —</option>
              )}
              {filteredUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.name || '(isimsiz)'} — {u.email || u.userId.slice(0, 8)}
                </option>
              ))}
            </select>
            {selectedUser && (
              <p className="mt-1 text-[11px] text-slate-500">
                user_id: <code className="rounded bg-geex-bg px-1.5 py-0.5">{selectedUser.userId}</code>
              </p>
            )}
          </div>

          {/* Mode: content */}
          {mode === 'content' && (
            <>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Kategori
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Deep link
                  </label>
                  <select
                    value={deepLink}
                    onChange={(e) => setDeepLink(e.target.value)}
                    className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm"
                  >
                    {DEEP_LINKS.map((d) => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Mode: template */}
          {mode === 'template' && (
            <>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Template
                </label>
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                  className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm"
                >
                  <option value="">— seç —</option>
                  {templates.map((t) => (
                    <option key={t.key} value={t.key}>
                      [{t.category}] {t.key}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTemplate && (
                <div className="mb-3 rounded-xl border border-geex-border bg-geex-bg px-3 py-2 text-xs text-geex-text">
                  <p className="font-semibold">{selectedTemplate.title_template}</p>
                  <p className="mt-0.5 text-slate-600">{selectedTemplate.body_template}</p>
                  {selectedTemplate.deep_link && (
                    <p className="mt-1 text-slate-500">deep_link: {selectedTemplate.deep_link}</p>
                  )}
                </div>
              )}
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vars (JSON) — örn: {`{"days":"3"}`}
                </label>
                <textarea
                  value={templateVars}
                  onChange={(e) => setTemplateVars(e.target.value)}
                  rows={3}
                  placeholder="{}"
                  className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 font-mono text-xs"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !selectedUserId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Send size={14} />
            {sending ? 'Gönderiliyor…' : 'Gönder'}
          </button>

          {sendError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}

          {sendResult && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <p className="font-semibold">Sonuç</p>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px]">
                {JSON.stringify(sendResult, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* ── Sağ: recent sends tablosu ── */}
        <section className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-geex-text">
              Son 20 push (notification_sends)
            </h2>
            <button
              type="button"
              onClick={fetchRecent}
              disabled={recentLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-geex-border bg-white px-2 py-1 text-xs text-geex-text hover:bg-geex-bg disabled:opacity-50"
            >
              <RefreshCw size={11} className={recentLoading ? 'animate-spin' : ''} />
              Yenile
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-geex-border text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Zaman</th>
                  <th className="py-2 pr-2">Kullanıcı</th>
                  <th className="py-2 pr-2">Template / Kategori</th>
                  <th className="py-2 pr-2">Durum</th>
                  <th className="py-2">Hata</th>
                </tr>
              </thead>
              <tbody>
                {recentSends.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Kayıt yok
                    </td>
                  </tr>
                )}
                {recentSends.map((row) => (
                  <tr key={row.id} className="border-b border-geex-border/60">
                    <td className="py-2 pr-2 text-slate-600">{fmtDateTime(row.created_at)}</td>
                    <td className="py-2 pr-2 font-mono text-[11px] text-slate-700">
                      {String(row.user_id || '').slice(0, 8)}…
                    </td>
                    <td className="py-2 pr-2 text-slate-700">
                      {row.template_key ? (
                        <code className="rounded bg-geex-bg px-1.5 py-0.5">{row.template_key}</code>
                      ) : (
                        <span className="text-slate-400">custom</span>
                      )}
                      <span className="ml-1 text-[10px] text-slate-500">({row.category})</span>
                    </td>
                    <td className="py-2 pr-2">{statusBadge(row.status)}</td>
                    <td className="py-2 max-w-[200px] truncate text-slate-500" title={row.error_message || ''}>
                      {row.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
