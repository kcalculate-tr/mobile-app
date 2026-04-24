import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabase';

// ── Sabitler ────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { key: 'marketing',     emoji: '🎁', label: 'Kampanya ve İndirim' },
  { key: 'transactional', emoji: '📦', label: 'Sipariş Bildirimi' },
  { key: 'reminder',      emoji: '⏰', label: 'Hatırlatma' },
  { key: 'behavioral',    emoji: '💡', label: 'Öneri' },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((acc, c) => {
  acc[c.key] = `${c.emoji} ${c.label}`;
  return acc;
}, {});

const DEEP_LINK_OPTIONS = [
  { value: '',                             label: 'Bildirim sadece görünsün (bir yere gitmesin)' },
  { value: 'Home',                         label: '🏠 Ana Sayfa' },
  { value: 'CategoryProducts:Tüm Ürünler', label: '🍱 Tüm Ürünler' },
  { value: 'Offers',                       label: '🎁 Fırsatlar' },
  { value: 'ProfileOrders',                label: '📦 Siparişlerim' },
  { value: 'ProfileCoupons',               label: '🎟 Kuponlarım' },
  { value: 'Subscriptions',                label: '⭐ Macro Üyelik' },
  { value: 'NutritionProfile',             label: '👤 Profilim' },
];

const TEMPLATE_NAMES = {
  order_confirmed:      { emoji: '🎉',     label: 'Sipariş alındı' },
  order_preparing:      { emoji: '👨‍🍳',   label: 'Sipariş hazırlanıyor' },
  order_shipped:        { emoji: '🚚',     label: 'Sipariş yolda' },
  order_delivered:      { emoji: '🍽',     label: 'Afiyet olsun' },
  payment_failed:       { emoji: '😕',     label: 'Ödeme tamamlanamadı' },
  cart_abandoned:       { emoji: '🛒',     label: 'Sepet hatırlatması' },
  macro_reminder:       { emoji: '📊',     label: 'Makro hatırlatması' },
  delivery_tomorrow:    { emoji: '📅',     label: 'Yarın teslimat' },
  coupon_expiring:      { emoji: '⏰',     label: 'Kupon süresi bitiyor' },
  subscription_renewal: { emoji: '🔄',     label: 'Macro üyelik yenileme' },
};

// {{var_name}} → kullanıcıya gösterilecek Türkçe etiket
const VAR_LABELS = {
  days:        'Gün sayısı',
  order_code:  'Sipariş kodu',
  order_id:    'Sipariş numarası',
  user_name:   'Kullanıcı adı',
  amount:      'Tutar',
  coupon_code: 'Kupon kodu',
  name:        'İsim',
  date:        'Tarih',
  time:        'Saat',
};

const STATUS_LABELS = {
  sent:      { label: '✓ Gönderildi',   cls: 'bg-emerald-100 text-emerald-700' },
  delivered: { label: '✓ Teslim edildi', cls: 'bg-emerald-100 text-emerald-700' },
  queued:    { label: 'Sırada',          cls: 'bg-sky-100 text-sky-700' },
  skipped:   { label: 'Atlandı',         cls: 'bg-slate-100 text-slate-600' },
  failed:    { label: '✗ Başarısız',     cls: 'bg-rose-100 text-rose-700' },
};

const TITLE_MAX = 50;
const BODY_MAX  = 120;

// ── Yardımcılar ──────────────────────────────────────────────────────────────
function extractTemplateVars(template) {
  if (!template) return [];
  const re = /\{\{(\w+)\}\}/g;
  const vars = new Set();
  for (const src of [template.title_template, template.body_template]) {
    const text = String(src || '');
    let m;
    while ((m = re.exec(text)) !== null) vars.add(m[1]);
  }
  return [...vars];
}

function renderPreview(tpl, values) {
  return String(tpl || '').replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = String(values[k] ?? '').trim();
    return v || `{{${k}}}`;
  });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function displayNameFromProfile(p) {
  if (!p) return '';
  const fullName = String(p.full_name || '').trim();
  if (fullName) return fullName;
  const email = String(p.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return email || 'Kullanıcı';
}

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '👤';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PushTestPanel() {
  const [mode, setMode] = useState('custom'); // 'custom' | 'template'

  const [users, setUsers] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [tokenCountById, setTokenCountById] = useState({});

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [varValues, setVarValues] = useState({});

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [category, setCategory] = useState('marketing');

  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null); // { type, message }

  const [recentSends, setRecentSends] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [errorDetail, setErrorDetail] = useState(null);

  // ── Fetch'ler ──────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = (data ?? [])
        .map((p) => ({
          id: p.id,
          name: displayNameFromProfile(p),
          email: p.email || '',
          avatarUrl: p.avatar_url || null,
        }))
        .filter((u) => u.id);
      setUsers(rows);
      const byId = {};
      rows.forEach((u) => { byId[u.id] = u; });
      setUsersById(byId);
    } catch (e) {
      console.warn('[PushTestPanel] profiles fetch:', e?.message || e);
    }
  }, []);

  const fetchTokenCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('push_tokens')
        .select('user_id')
        .eq('is_active', true);
      if (error) throw error;
      const counts = {};
      (data ?? []).forEach((t) => {
        counts[t.user_id] = (counts[t.user_id] || 0) + 1;
      });
      setTokenCountById(counts);
    } catch (e) {
      console.warn('[PushTestPanel] tokens fetch:', e?.message || e);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      setTemplates(data ?? []);
    } catch (e) {
      console.warn('[PushTestPanel] templates fetch:', e?.message || e);
    }
  }, []);

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
      console.warn('[PushTestPanel] recent fetch:', e?.message || e);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTokenCounts();
    fetchTemplates();
    fetchRecent();
  }, [fetchUsers, fetchTokenCounts, fetchTemplates, fetchRecent]);

  useEffect(() => {
    const id = setInterval(fetchRecent, 5000);
    return () => clearInterval(id);
  }, [fetchRecent]);

  // Şablon değişince vars'ı sıfırla
  useEffect(() => {
    setVarValues({});
  }, [selectedTemplateKey]);

  // Toast otomatik kapanma
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 50);
  }, [users, userSearch]);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;
  const selectedUserTokenCount = tokenCountById[selectedUserId] || 0;

  const selectedTemplate = templates.find((t) => t.key === selectedTemplateKey) ?? null;
  const selectedTemplateVars = useMemo(
    () => (selectedTemplate ? extractTemplateVars(selectedTemplate) : []),
    [selectedTemplate]
  );

  const sortedTemplates = useMemo(() => {
    const rank = Object.keys(TEMPLATE_NAMES);
    return [...templates].sort((a, b) => {
      const ai = rank.indexOf(a.key); const bi = rank.indexOf(b.key);
      if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [templates]);

  const canSend = useMemo(() => {
    if (!selectedUserId) return { ok: false, reason: 'Önce bir müşteri seç' };
    if (mode === 'custom') {
      if (!title.trim()) return { ok: false, reason: 'Bildirim başlığı boş olamaz' };
      if (!body.trim()) return { ok: false, reason: 'Mesaj içeriği boş olamaz' };
      return { ok: true };
    }
    if (!selectedTemplateKey) return { ok: false, reason: 'Bir şablon seç' };
    const missing = selectedTemplateVars.find((v) => !String(varValues[v] ?? '').trim());
    if (missing) return { ok: false, reason: `"${VAR_LABELS[missing] || missing}" alanını doldur` };
    return { ok: true };
  }, [selectedUserId, mode, title, body, selectedTemplateKey, selectedTemplateVars, varValues]);

  // ── Gönder ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!canSend.ok || sending) return;
    setSending(true);
    try {
      let payload;
      if (mode === 'template') {
        const vars = {};
        selectedTemplateVars.forEach((v) => { vars[v] = String(varValues[v] ?? '').trim(); });
        payload = {
          mode: 'by_template_single',
          user_id: selectedUserId,
          template_key: selectedTemplateKey,
          vars,
        };
      } else {
        payload = {
          mode: 'by_content',
          user_ids: [selectedUserId],
          title: title.trim(),
          body: body.trim(),
          category,
          ...(deepLink ? { deep_link: deepLink } : {}),
        };
      }

      const { data, error } = await supabase.functions.invoke('send-notification', { body: payload });
      if (error) throw error;

      const result = data || {};
      if ((result.sent || 0) > 0) {
        setToast({ type: 'success', message: 'Bildirim gönderildi' });
      } else if ((result.skipped || 0) > 0) {
        setToast({
          type: 'error',
          message: 'Gönderilemedi: kullanıcının bildirim izinleri kapalı veya aktif cihazı yok',
        });
      } else if ((result.failed || 0) > 0) {
        const reason = result.details?.[0]?.error || 'bilinmeyen hata';
        setToast({ type: 'error', message: `Hata: ${reason}` });
      } else {
        setToast({ type: 'error', message: 'Beklenmeyen yanıt' });
      }
      fetchRecent();
    } catch (e) {
      setToast({ type: 'error', message: e?.message || String(e) });
    } finally {
      setSending(false);
    }
  };

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Başlık */}
      <header className="rounded-3xl border border-geex-border bg-geex-card px-6 py-5 shadow-geex-soft">
        <h1 className="text-2xl font-semibold text-geex-text">Bildirim Gönder</h1>
        <p className="mt-1 text-sm text-slate-500">
          Seçtiğin kullanıcıya anlık bildirim gönder. Hazır şablondan veya özel mesaj yazabilirsin.
        </p>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
        {/* ── SOL: form ── */}
        <section className="space-y-6">
          {/* Adım 1: mod */}
          <div className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
            <h2 className="mb-3 text-base font-semibold text-geex-text">Ne göndermek istiyorsun?</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: 'custom',   emoji: '✏️', title: 'Kendi mesajımı yazacağım', desc: 'Başlık ve içeriği sen yazarsın' },
                { key: 'template', emoji: '📋', title: 'Hazır şablon kullanacağım', desc: 'Hazır bildirimler arasından seç' },
              ].map((opt) => {
                const active = mode === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMode(opt.key)}
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      active
                        ? 'border-brand-primary bg-brand-primary/10'
                        : 'border-geex-border bg-white hover:bg-geex-bg'
                    }`}
                  >
                    <div className="text-2xl">{opt.emoji}</div>
                    <p className="mt-1 font-semibold text-geex-text">{opt.title}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Adım 2: hedef kullanıcı */}
          <div className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
            <h2 className="mb-3 text-base font-semibold text-geex-text">Kime gönderilsin?</h2>

            {selectedUser ? (
              <div className="rounded-2xl border-2 border-brand-primary bg-brand-primary/10 p-4">
                <div className="flex items-start gap-3">
                  {selectedUser.avatarUrl ? (
                    <img
                      src={selectedUser.avatarUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-brand-primary/30"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary/20 text-sm font-bold text-brand-primary">
                      {initialsFromName(selectedUser.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-geex-text">{selectedUser.name}</p>
                    <p className="truncate text-xs text-slate-600">📧 {selectedUser.email || '—'}</p>
                    <div className="mt-1.5">
                      {selectedUserTokenCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          🟢 {selectedUserTokenCount} aktif cihaz
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          ⚠️ Aktif cihaz yok — bildirim alamayabilir
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedUserId(''); setUserSearch(''); }}
                    className="shrink-0 rounded-lg border border-geex-border bg-white px-2 py-1 text-xs font-medium text-geex-text hover:bg-geex-bg"
                  >
                    Değiştir
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Müşterinin adı veya e-postası ile ara..."
                  className="mb-3 w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                />
                <div className="max-h-72 overflow-y-auto rounded-xl border border-geex-border bg-white">
                  {filteredUsers.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-400">
                      {userSearch.trim() ? 'Eşleşen müşteri bulunamadı' : 'Yüklenmiş müşteri yok'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-geex-border">
                      {filteredUsers.map((u) => {
                        const tc = tokenCountById[u.id] || 0;
                        return (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(u.id)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-geex-bg"
                            >
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                  {initialsFromName(u.name)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-geex-text">{u.name}</p>
                                <p className="truncate text-xs text-slate-500">{u.email || '—'}</p>
                              </div>
                              {tc > 0 ? (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  🟢 {tc}
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  —
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Adım 3: içerik */}
          {mode === 'custom' ? (
            <div className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
              <h2 className="mb-4 text-base font-semibold text-geex-text">Bildirim içeriği</h2>

              {/* Başlık */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-geex-text">Bildirim Başlığı</label>
                  <span className={`text-xs ${title.length >= TITLE_MAX - 5 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {title.length}/{TITLE_MAX}
                  </span>
                </div>
                <input
                  type="text"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Sürpriz İndirim! 🎉"
                  className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>

              {/* Mesaj */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-geex-text">Mesaj İçeriği</label>
                  <span className={`text-xs ${body.length >= BODY_MAX - 10 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {body.length}/{BODY_MAX}
                  </span>
                </div>
                <textarea
                  value={body}
                  maxLength={BODY_MAX}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Örn: Bugüne özel %30 indirim seni bekliyor. Kaçırma!"
                  className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>

              {/* Tür */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-geex-text">Bildirim Türü</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CATEGORY_OPTIONS.map((c) => {
                    const active = category === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCategory(c.key)}
                        className={`rounded-xl border-2 px-3 py-2 text-left text-sm transition ${
                          active
                            ? 'border-brand-primary bg-brand-primary/10'
                            : 'border-geex-border bg-white hover:bg-geex-bg'
                        }`}
                      >
                        <span className="mr-1.5">{c.emoji}</span>
                        <span className="font-medium text-geex-text">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Yönlendirme */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-geex-text">
                  Tıklayınca nereye gitsin?
                </label>
                <select
                  value={deepLink}
                  onChange={(e) => setDeepLink(e.target.value)}
                  className="w-full rounded-xl border border-geex-border bg-white px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                >
                  {DEEP_LINK_OPTIONS.map((d) => (
                    <option key={d.value || 'none'} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
              <h2 className="mb-3 text-base font-semibold text-geex-text">Hazır Şablonlar</h2>

              {sortedTemplates.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Şablon yüklü değil</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sortedTemplates.map((t) => {
                    const meta = TEMPLATE_NAMES[t.key] || { emoji: '📨', label: t.key };
                    const active = selectedTemplateKey === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setSelectedTemplateKey(t.key)}
                        className={`rounded-2xl border-2 p-3 text-left transition ${
                          active
                            ? 'border-brand-primary bg-brand-primary/10'
                            : 'border-geex-border bg-white hover:bg-geex-bg'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{meta.emoji}</span>
                          <span className="font-semibold text-geex-text">{meta.label}</span>
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-slate-700">
                          {t.title_template}
                        </p>
                        <p className="truncate text-xs text-slate-500">{t.body_template}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Dinamik değişken input'ları */}
              {selectedTemplate && selectedTemplateVars.length > 0 && (
                <div className="mt-4 rounded-2xl border border-geex-border bg-geex-bg p-4">
                  <p className="mb-2 text-sm font-semibold text-geex-text">
                    Bu şablon için bilgi girmen gerekiyor:
                  </p>
                  <div className="space-y-3">
                    {selectedTemplateVars.map((v) => (
                      <div key={v}>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          {VAR_LABELS[v] || v}
                        </label>
                        <input
                          type="text"
                          value={varValues[v] ?? ''}
                          onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                          placeholder={v === 'days' ? 'Örn: 3' : ''}
                          className="w-full rounded-xl border border-geex-border bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Önizleme */}
              {selectedTemplate && (
                <div className="mt-4 rounded-2xl border border-geex-border bg-white p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Önizleme
                  </p>
                  <p className="font-semibold text-geex-text">
                    {renderPreview(selectedTemplate.title_template, varValues)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {renderPreview(selectedTemplate.body_template, varValues)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Gönder */}
          <div className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend.ok || sending}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-bold transition ${
                canSend.ok && !sending
                  ? 'bg-brand-primary text-white shadow-[0_8px_20px_rgba(152,205,0,0.35)] hover:opacity-90'
                  : 'cursor-not-allowed bg-slate-200 text-slate-500'
              }`}
            >
              {sending ? 'Gönderiliyor...' : '✈️ Bildirimi Gönder'}
            </button>
            {!canSend.ok && (
              <p className="mt-2 text-center text-xs text-slate-500">{canSend.reason}</p>
            )}
          </div>
        </section>

        {/* ── SAĞ: son gönderilenler ── */}
        <section className="rounded-3xl border border-geex-border bg-white p-5 shadow-geex-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-geex-text">Son 20 Bildirim</h2>
            <button
              type="button"
              onClick={fetchRecent}
              disabled={recentLoading}
              className="rounded-lg border border-geex-border bg-white px-2 py-1 text-xs text-geex-text hover:bg-geex-bg disabled:opacity-50"
            >
              {recentLoading ? 'Yükleniyor...' : 'Yenile'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-geex-border text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Zaman</th>
                  <th className="py-2 pr-2">Kime</th>
                  <th className="py-2 pr-2">Başlık / Tür</th>
                  <th className="py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {recentSends.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Henüz bildirim yok
                    </td>
                  </tr>
                )}
                {recentSends.map((row) => {
                  const u = usersById[row.user_id];
                  const userName = u?.name
                    || (u?.email ? u.email.split('@')[0] : null)
                    || (row.user_id ? `${String(row.user_id).slice(0, 6)}…` : '—');
                  const statusCfg = STATUS_LABELS[row.status] || {
                    label: row.status || '—',
                    cls: 'bg-slate-100 text-slate-600',
                  };
                  const hasError = row.status === 'failed' || (row.status === 'skipped' && row.error_message);

                  return (
                    <tr key={row.id} className="border-b border-geex-border/60 align-top">
                      <td className="py-2 pr-2 text-slate-600">{fmtDateTime(row.created_at)}</td>
                      <td className="py-2 pr-2 font-medium text-geex-text">{userName}</td>
                      <td className="py-2 pr-2">
                        <p className="max-w-[220px] truncate font-medium text-geex-text" title={row.title || ''}>
                          {row.title || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {CATEGORY_LABELS[row.category] || row.category || '—'}
                        </p>
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                        {hasError && (
                          <button
                            type="button"
                            onClick={() =>
                              setErrorDetail({
                                userName,
                                title: row.title,
                                error: row.error_message,
                                time: row.created_at,
                              })
                            }
                            className="ml-1 text-[10px] font-medium text-rose-600 underline hover:text-rose-700"
                          >
                            nedeni gör
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Hata detay popup */}
      {errorDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setErrorDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-geex-text">Neden gönderilemedi</h3>
            <p className="text-xs text-slate-500">
              {fmtDateTime(errorDetail.time)} • {errorDetail.userName}
            </p>
            {errorDetail.title && (
              <p className="mt-2 font-medium text-geex-text">{errorDetail.title}</p>
            )}
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {errorDetail.error || 'Detay yok'}
            </div>
            <button
              type="button"
              onClick={() => setErrorDetail(null)}
              className="mt-4 w-full rounded-xl border border-geex-border bg-white py-2 text-sm font-medium text-geex-text hover:bg-geex-bg"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
