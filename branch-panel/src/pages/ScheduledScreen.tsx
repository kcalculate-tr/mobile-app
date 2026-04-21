import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, CheckCircle, ClipboardList, Loader2, XCircle, BellRing } from 'lucide-react'
import { supabase } from '../supabase'
import type { Order, OrderItem } from '../types'

// ── Order modification request types ──────────────────────────────────────────
type ModType = 'cancel' | 'date_change' | 'address_change'
type ModStatus = 'pending' | 'approved' | 'rejected'

interface OrderModification {
  id: string
  order_id: string
  user_id: string
  type: ModType
  status: ModStatus
  old_scheduled_date: string | null
  new_scheduled_date: string | null
  old_scheduled_time: string | null
  new_scheduled_time: string | null
  old_address_id: string | null
  new_address_id: string | null
  new_address_text: string | null
  reject_reason: string | null
  customer_note: string | null
  created_at: string
}

const MOD_TYPE_LABEL: Record<ModType, string> = {
  cancel: 'İptal Talebi',
  date_change: 'Tarih Değişikliği',
  address_change: 'Adres Değişikliği',
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────
function parseItems(raw: unknown): OrderItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as OrderItem[]
  try { return JSON.parse(raw as string) as OrderItem[] } catch { return [] }
}
function itemLabel(item: OrderItem) { return item.name || 'Ürün' }
function orderCode(order: Order) {
  return order.paytr_oid || `#${String(order.id).slice(-6).toUpperCase()}`
}
function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) } catch { return "" }
}
function formatDateTime(iso: string) { return `${formatDate(iso)} ${formatTime(iso)}` }
function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) } catch { return '--:--' }
}

// ── Web Audio — 2 tonlu bip (randevulu) ───────────────────────────────────────
function playScheduledBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const play = (freq: number, start: number, dur: number) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }
    play(880, 0,    0.18)
    play(660, 0.22, 0.18)
    play(880, 0.44, 0.25)
  } catch { /* tarayıcı izin vermedi */ }
}

// ── İptal Modal ───────────────────────────────────────────────────────────────
function CancelModal({ code, onConfirm, onClose, loading }: {
  code: string; onConfirm: (r: string) => void; onClose: () => void; loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-bold text-brand-dark mb-1">Siparişi İptal Et</h3>
        <p className="text-xs text-slate-400 mb-4">
          <span className="font-semibold text-slate-600">{code}</span> siparişini iptal etmek istiyor musunuz?
        </p>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            İptal Nedeni <span className="text-slate-400">(opsiyonel)</span>
          </label>
          <textarea
            rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Ör: Müşteri ulaşılamadı, ürün tükendi..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 disabled:opacity-50">
            Vazgeç
          </button>
          <button onClick={() => onConfirm(reason)} disabled={loading}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            İptal Et
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hazırlık Listesi ──────────────────────────────────────────────────────────
function PrepList({ orders }: { orders: Order[] }) {
  const prepList = useMemo(() => {
    const map = new Map<string, number>()
    orders.forEach(o => parseItems(o.items).forEach(item => {
      const name = itemLabel(item)
      map.set(name, (map.get(name) ?? 0) + (item.quantity ?? 1))
    }))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [orders])

  const slots = useMemo(() => {
    const map = new Map<string, number>()
    orders.forEach(o => {
      const key = [o.scheduled_date, (o.scheduled_time || '').slice(0, 5)].filter(Boolean).join(' ')
      if (key) map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort()
  }, [orders])

  if (prepList.length === 0) return null

  return (
    <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={16} className="text-indigo-500" />
        <p className="text-sm font-bold text-indigo-800">Mutfak Hazırlık Listesi</p>
        <span className="ml-auto text-xs text-indigo-400">{orders.length} sipariş toplamı</span>
      </div>
      {slots.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {slots.map(([slot, count]) => (
            <span key={slot} className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700">
              🕐 {slot} — {count} sipariş
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {prepList.map(([name, qty]) => (
          <div key={name} className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-sm font-black text-indigo-700">{qty}</span>
            <span className="text-sm font-semibold text-brand-dark leading-tight">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sipariş Kartı ─────────────────────────────────────────────────────────────
function OrderCard({ order, saving, pendingMod, onAccept, onReady, onCancel }: {
  order: Order; saving: string | null; pendingMod?: OrderModification
  onAccept: (id: string) => void; onReady: (id: string) => void; onCancel: (o: Order) => void
}) {
  const items       = parseItems(order.items)
  const isSaving    = saving === order.id
  const isPending   = order.status === 'pending' || order.status === 'confirmed'
  const isPreparing = order.status === 'preparing'
  const code        = orderCode(order)
  const note        = order.customer_note || (order as any).note || ''
  const scheduledInfo = [order.scheduled_date, (order.scheduled_time || '').slice(0, 5)].filter(Boolean).join(' ')

  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${isPending ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-blue-200 ring-1 ring-blue-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-brand-dark tracking-tight">{code}</p>
          {order.customer_name && <p className="mt-0.5 text-xs font-semibold text-slate-600">{order.customer_name}</p>}
          <p className="mt-0.5 text-[11px] text-slate-300 tabular-nums">{formatDateTime(order.created_at)}</p>
          {(order as any).phone && <p className="mt-0.5 text-xs text-slate-400">📞 {(order as any).phone}</p>}
          {(order as any).address && <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">📍 {(order as any).address}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-slate-400">{formatTime(order.created_at)}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            isPending ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-blue-200 bg-blue-50 text-blue-600'
          }`}>
            {isPending ? '📅 Bekliyor' : 'Hazırlanıyor'}
          </span>
          {pendingMod && (
            <span className="rounded-full border border-orange-300 bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
              {MOD_TYPE_LABEL[pendingMod.type]}
            </span>
          )}
        </div>
      </div>

      {/* Randevu zamanı */}
      {scheduledInfo && (
        <div className="mx-4 mb-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5">
          <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">Randevu Zamanı</p>
          <p className="text-sm font-bold text-brand-dark">{scheduledInfo}</p>
        </div>
      )}

      {/* Müşteri notu */}
      {note && (
        <div className="mx-4 mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5">
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Müşteri Notu</p>
          <p className="text-xs font-medium text-brand-dark">{note}</p>
        </div>
      )}

      {/* Ürünler */}
      <div className="px-4 pb-2 border-t border-gray-50 pt-2 space-y-1.5">
        {items.length === 0
          ? <p className="text-xs italic text-slate-300">Ürün bilgisi yok</p>
          : items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-xs font-black text-indigo-700">{item.quantity}</span>
              <span className="text-sm font-semibold text-brand-dark leading-tight">{itemLabel(item)}</span>
            </div>
          ))
        }
      </div>

      {/* Toplam */}
      {order.total_price && (
        <div className="mx-4 mb-2">
          <p className="text-sm font-black text-brand-dark">₺{Number(order.total_price).toFixed(2)}</p>
        </div>
      )}

      {/* Butonlar */}
      <div className="px-4 pb-4 space-y-2">
        {isPending && (
          <>
            <button onClick={() => onAccept(order.id)} disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              KABUL ET &amp; HAZIRLA
            </button>
            <button onClick={() => onCancel(order)} disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition disabled:opacity-50">
              <XCircle size={16} /> İptal Et
            </button>
          </>
        )}
        {isPreparing && (
          <button onClick={() => onReady(order.id)} disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(249,115,22,0.25)] transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Hazırlandı → Kuryeye Ver
          </button>
        )}
      </div>
    </div>
  )
}

// ── Ana component ─────────────────────────────────────────────────────────────
export default function ScheduledScreen() {
  const [orders,      setOrders]      = useState<Order[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState<string | null>(null)
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
  const [cancelling,  setCancelling]  = useState(false)
  const [modifications,    setModifications]    = useState<OrderModification[]>([])
  const [rejectingMod,     setRejectingMod]     = useState<OrderModification | null>(null)
  const [rejectReasonText, setRejectReasonText] = useState('')
  const [modBusy,          setModBusy]          = useState<string | null>(null)

  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const modChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const prevCountRef  = useRef(0)
  const unlockedRef   = useRef(false)

  // Unlock Web Audio on first interaction
  useEffect(() => {
    const unlock = () => { unlockedRef.current = true }
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_type', 'scheduled')
      .in('status', ['pending', 'confirmed', 'preparing'])
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
    if (error) console.error('[ScheduledScreen] fetch error:', error)
    setOrders((data ?? []) as Order[])
    setLoading(false)
  }, [])

  const fetchModifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('order_modifications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[ScheduledScreen] modifications fetch error:', error)
      return
    }
    setModifications((data ?? []) as OrderModification[])
  }, [])

  useEffect(() => { fetchOrders(); fetchModifications() }, [fetchOrders, fetchModifications])

  useEffect(() => {
    channelRef.current = supabase
      .channel('scheduled-orders')
      .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [fetchOrders])

  useEffect(() => {
    modChannelRef.current = supabase
      .channel('scheduled-order-modifications')
      .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'order_modifications' }, () => fetchModifications())
      .subscribe()
    return () => { modChannelRef.current?.unsubscribe() }
  }, [fetchModifications])

  async function approveModification(mod: OrderModification) {
    setModBusy(mod.id)
    try {
      const now = new Date().toISOString()
      // 1) Apply the change to the order
      if (mod.type === 'cancel') {
        const { error } = await supabase.from('orders')
          .update({ status: 'cancelled', updated_at: now })
          .eq('id', mod.order_id)
        if (error) throw error
      } else if (mod.type === 'date_change') {
        const patch: Record<string, unknown> = { updated_at: now }
        if (mod.new_scheduled_date) patch.scheduled_date = mod.new_scheduled_date
        if (mod.new_scheduled_time) patch.scheduled_time = mod.new_scheduled_time
        const { error } = await supabase.from('orders').update(patch).eq('id', mod.order_id)
        if (error) throw error
      } else if (mod.type === 'address_change') {
        const patch: Record<string, unknown> = { updated_at: now }
        if (mod.new_address_id) patch.address_id = mod.new_address_id
        if (mod.new_address_text) patch.address = mod.new_address_text
        const { error } = await supabase.from('orders').update(patch).eq('id', mod.order_id)
        if (error) throw error
      }

      // 2) Mark modification approved
      const { error: modErr } = await supabase.from('order_modifications')
        .update({ status: 'approved', reviewed_at: now, updated_at: now })
        .eq('id', mod.id)
      if (modErr) throw modErr

      // 3) Notify the user (best-effort)
      try {
        await supabase.from('notifications').insert([{
          user_id: mod.user_id,
          type: `order_modification_${mod.type}_approved`,
          title: `${MOD_TYPE_LABEL[mod.type]} onaylandı`,
          body: 'Talebiniz ekibimiz tarafından onaylandı.',
          data: { order_id: mod.order_id, modification_id: mod.id },
        }])
      } catch (notifErr) {
        console.warn('[ScheduledScreen] notification insert failed:', notifErr)
      }

      await Promise.all([fetchModifications(), fetchOrders()])
    } catch (err) {
      console.error('[ScheduledScreen] approve error:', err)
      alert('Onay başarısız. Lütfen tekrar deneyin.')
    } finally {
      setModBusy(null)
    }
  }

  async function rejectModification(mod: OrderModification, reason: string) {
    setModBusy(mod.id)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase.from('order_modifications')
        .update({
          status: 'rejected',
          reviewed_at: now,
          updated_at: now,
          reject_reason: reason || null,
        })
        .eq('id', mod.id)
      if (error) throw error

      try {
        await supabase.from('notifications').insert([{
          user_id: mod.user_id,
          type: `order_modification_${mod.type}_rejected`,
          title: `${MOD_TYPE_LABEL[mod.type]} reddedildi`,
          body: reason || 'Talebiniz reddedildi.',
          data: { order_id: mod.order_id, modification_id: mod.id, reject_reason: reason || null },
        }])
      } catch (notifErr) {
        console.warn('[ScheduledScreen] notification insert failed:', notifErr)
      }

      await fetchModifications()
    } catch (err) {
      console.error('[ScheduledScreen] reject error:', err)
      alert('Reddetme başarısız. Lütfen tekrar deneyin.')
    } finally {
      setModBusy(null)
      setRejectingMod(null)
      setRejectReasonText('')
    }
  }

  const modsByOrderId = useMemo(() => {
    const map = new Map<string, OrderModification>()
    modifications.forEach((mod) => { map.set(String(mod.order_id), mod) })
    return map
  }, [modifications])

  // Bip: yeni randevulu sipariş gelince
  useEffect(() => {
    const count = orders.length
    if (count > prevCountRef.current && unlockedRef.current) {
      // 3 kez çal
      playScheduledBeep()
      setTimeout(playScheduledBeep, 600)
      setTimeout(playScheduledBeep, 1200)
    }
    prevCountRef.current = count
  }, [orders.length])

  async function markAccept(id: string) {
    setSaving(id)
    await supabase.from('orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(null); fetchOrders()
  }

  async function markReady(id: string) {
    setSaving(id)
    await supabase.from('orders').update({ status: 'on_way', updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(null); fetchOrders()
  }

  async function handleCancelConfirm(reason: string) {
    if (!cancelOrder) return
    setCancelling(true)
    await supabase.from('orders').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      ...(reason ? { cancel_reason: reason } : {}),
    }).eq('id', cancelOrder.id)
    setCancelling(false); setCancelOrder(null); fetchOrders()
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      {cancelOrder && (
        <CancelModal
          code={orderCode(cancelOrder)}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelOrder(null)}
          loading={cancelling}
        />
      )}

      {rejectingMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-brand-dark mb-1">Talebi Reddet</h3>
            <p className="text-xs text-slate-400 mb-4">
              {MOD_TYPE_LABEL[rejectingMod.type]} — müşteriye gösterilecek bir neden yazın.
            </p>
            <textarea
              rows={3}
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              placeholder="Ör: Mutfak randevu saatini karşılayamıyor..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectingMod(null); setRejectReasonText('') }}
                disabled={modBusy === rejectingMod.id}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={() => rejectModification(rejectingMod, rejectReasonText.trim())}
                disabled={modBusy === rejectingMod.id}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {modBusy === rejectingMod.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reddet
              </button>
            </div>
          </div>
        </div>
      )}

      {modifications.length > 0 && (
        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BellRing size={16} className="text-orange-600" />
            <p className="text-sm font-bold text-orange-800">
              Müşteri Değişiklik Talepleri ({modifications.length})
            </p>
          </div>
          <div className="space-y-2">
            {modifications.map((mod) => {
              const busy = modBusy === mod.id
              const relatedOrder = orders.find((o) => String(o.id) === String(mod.order_id))
              const displayCode = relatedOrder ? orderCode(relatedOrder) : `#${String(mod.order_id).slice(-6).toUpperCase()}`
              return (
                <div key={mod.id} className="rounded-xl border border-orange-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full border border-orange-300 bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                          {MOD_TYPE_LABEL[mod.type]}
                        </span>
                        <span className="text-xs font-bold text-brand-dark">{displayCode}</span>
                      </div>
                      {mod.type === 'date_change' && (
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="line-through">{mod.old_scheduled_date ?? '—'} {(mod.old_scheduled_time || '').slice(0,5)}</span>
                          {' → '}
                          <span className="font-semibold text-brand-dark">
                            {mod.new_scheduled_date ?? '—'} {(mod.new_scheduled_time || '').slice(0,5)}
                          </span>
                        </p>
                      )}
                      {mod.type === 'address_change' && (
                        <p className="mt-1 text-xs text-slate-500">
                          Yeni adres: <span className="font-semibold text-brand-dark">{mod.new_address_text || '—'}</span>
                        </p>
                      )}
                      {mod.customer_note && (
                        <p className="mt-1 text-[11px] italic text-slate-400">Not: {mod.customer_note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveModification(mod)}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Onayla
                    </button>
                    <button
                      onClick={() => { setRejectingMod(mod); setRejectReasonText('') }}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle size={12} /> Reddet
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-indigo-500" />
          <h1 className="text-xl font-black text-brand-dark">Randevulu Siparişler</h1>
        </div>
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              📅 {orders.length} bekliyor
            </span>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16">
          <CalendarClock size={40} strokeWidth={1.5} className="text-slate-200" />
          <p className="mt-3 text-sm font-bold text-slate-400">Bekleyen randevulu sipariş yok</p>
        </div>
      ) : (
        <>
          <PrepList orders={orders} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orders.map(order => (
              <OrderCard
                key={order.id} order={order} saving={saving}
                pendingMod={modsByOrderId.get(String(order.id))}
                onAccept={markAccept} onReady={markReady} onCancel={setCancelOrder}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
