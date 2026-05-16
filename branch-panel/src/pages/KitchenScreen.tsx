import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle, ChefHat, FileText, History, Loader2, Printer, Volume2, XCircle, Zap
} from 'lucide-react'
import { supabase } from '../supabase'
import { useBranch } from '../context/BranchContext'
import type { Order } from '../types'
import {
  parseItems,
  itemLabel,
  ItemOptions,
  orderCode,
  formatTime,
  formatDateTime,
  AddressBlock,
  printReceipt,
  ORDERS_WITH_ADDRESS_SELECT,
} from '../lib/orderHelpers'

const ALARM_SOUND_URL = '/sounds/notification.mp3'
const AUDIO_UNLOCKED_KEY = 'kitchen.audio.unlocked'

// Ödenmiş sipariş kontrolü — payment_status='paid' veya legacy paytr_oid dolu
function isOrderPaid(o: Order): boolean {
  if (o.payment_status === 'paid') return true
  if (o.payment_status == null) return Boolean(o.paytr_oid)
  return false
}
const BASE_DOC_TITLE = 'KCAL Mutfak'
const ALERT_DOC_TITLE = '🔔 Yeni Sipariş — KCAL Mutfak'

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────
function elapsed(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}


// ── TimerBadge ────────────────────────────────────────────────────────────────
function TimerBadge({ createdAt }: { createdAt: string }) {
  const [mins, setMins] = useState(elapsed(createdAt))
  useEffect(() => {
    const id = setInterval(() => setMins(elapsed(createdAt)), 10_000)
    return () => clearInterval(id)
  }, [createdAt])
  const cls = mins >= 20 ? 'bg-red-100 text-red-600 border-red-200'
    : mins >= 10 ? 'bg-amber-100 text-amber-600 border-amber-200'
    : 'bg-slate-100 text-slate-500 border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums ${cls}`}>
      {mins} dk
    </span>
  )
}

// ── İptal Modal ───────────────────────────────────────────────────────────────
interface CancelModalProps {
  orderCode: string
  onConfirm: (reason: string) => void
  onClose: () => void
  loading: boolean
}
function CancelModal({ orderCode: code, onConfirm, onClose, loading }: CancelModalProps) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-bold text-brand-dark mb-1">Siparişi İptal Et</h3>
        <p className="text-xs text-slate-400 mb-4"><span className="font-semibold text-slate-600">{code}</span> siparişini iptal etmek istediğinizden emin misiniz?</p>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">İptal Nedeni <span className="text-slate-400">(opsiyonel)</span></label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ör: Müşteri ulaşılamadı, ürün tükendi..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 disabled:opacity-50">
            Vazgeç
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            İptal Et
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Sipariş kartı ─────────────────────────────────────────────────────────────
interface OrderCardProps {
  order: Order
  saving: string | null
  onAccept: (id: string) => void
  onReady: (id: string) => void
  onDeliver: (id: string) => void
  onCancel: (order: Order) => void
  scheduledInfo?: string
  completed?: boolean
}

function OrderCard({ order, saving, onAccept, onReady, onDeliver, onCancel, scheduledInfo, completed }: OrderCardProps) {
  const items       = parseItems(order.items)
  const isSaving    = saving === order.id
  const code        = orderCode(order)
  const isPending   = order.status === 'pending' || order.status === 'confirmed'
  const isPreparing = order.status === 'preparing'
  const isOnWay     = order.status === 'on_way'
  const isDelivered = order.status === 'delivered'
  const isCancelled = order.status === 'cancelled'
  const note        = order.customer_note || (order as any).note || ''

  return (
    <div className={`rounded-2xl border bg-white shadow-sm transition-all ${
      completed
        ? isDelivered ? 'border-emerald-100' : 'border-red-100 opacity-75'
        : isPending    ? 'border-amber-300 ring-2 ring-amber-100'
        : isPreparing  ? 'border-blue-200 ring-1 ring-blue-100'
        : isOnWay      ? 'border-purple-200 ring-1 ring-purple-100'
        : 'border-gray-100'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-lg font-black text-brand-dark tracking-tight leading-none">{code}</p>
            {completed && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isDelivered ? 'bg-emerald-100 text-emerald-700'
                  : isOnWay ? 'bg-purple-100 text-purple-700'
                  : isCancelled ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {isDelivered ? '✓ Teslim'
                  : isOnWay ? '🚴 Yolda'
                  : isCancelled ? '✗ İptal'
                  : order.status}
              </span>
            )}
          </div>
          {/* Müşteri bilgileri */}
          {order.customer_name && (
            <p className="mt-1 text-xs font-semibold text-slate-600">{order.customer_name}</p>
          )}
          {order.is_privileged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C6F04F]/20 border border-[#C6F04F] px-2 py-0.5 text-[10px] font-black text-black mt-0.5">
              ⭐ Ayrıcalıklı Üye
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {!completed && <><TimerBadge createdAt={order.created_at} /><p className="text-[10px] text-slate-400 tabular-nums">{formatDateTime(order.created_at)}</p></>}
          {completed && <p className="text-xs text-slate-400">{formatTime(order.created_at)}</p>}
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            isPending    ? 'border-amber-300 bg-amber-50 text-amber-700'
            : isPreparing  ? 'border-blue-200 bg-blue-50 text-blue-600'
            : isOnWay      ? 'border-purple-200 bg-purple-50 text-purple-700'
            : isDelivered  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : isCancelled  ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-gray-200 bg-gray-50 text-gray-500'
          }`}>
            {isPending ? '🔔 Yeni'
              : isPreparing ? 'Hazırlanıyor'
              : isOnWay ? '🚴 Yolda'
              : isDelivered ? 'Teslim Edildi'
              : isCancelled ? 'İptal'
              : order.status}
          </span>
        </div>
      </div>

      {/* Randevu */}
      {scheduledInfo && (
        <div className="mx-4 mb-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5">
          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Randevu</p>
          <p className="text-sm font-bold text-brand-dark">{scheduledInfo}</p>
        </div>
      )}

      {/* Müşteri notu */}
      {note && (
        <div className="mx-4 mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 uppercase tracking-wide">
            <FileText size={10} /> Müşteri Notu
          </p>
          <p className="text-xs font-medium text-brand-dark">{note}</p>
        </div>
      )}

      {/* Teslimat bilgileri — kurye için kritik */}
      <AddressBlock order={order} />

      {/* Ürünler */}
      <div className="px-4 pb-2 border-t border-gray-50 pt-2 space-y-1.5">
        {items.length === 0 ? (
          <p className="text-xs italic text-slate-300">Ürün bilgisi yok</p>
        ) : (
          items.map((item, i) => (
            <div key={i}>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-primary/15 text-xs font-black text-brand-primary">
                  {item.quantity}
                </span>
                <span className="text-sm font-semibold text-brand-dark leading-tight">{itemLabel(item)}</span>
              </div>
              <ItemOptions item={item} />
            </div>
          ))
        )}
      </div>

      {/* Toplam + Fiş */}
      <div className="mx-4 mb-3 flex items-center justify-between">
        {order.total_price ? (
          <p className="text-sm font-black text-brand-dark">₺{Number(order.total_price).toFixed(2)}</p>
        ) : <span />}
        <button
          onClick={() => printReceipt(order)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-gray-50"
        >
          <Printer size={12} /> Fiş
        </button>
      </div>

      {/* Aksiyon butonları */}
      {!completed && (
        <div className="px-4 pb-4 space-y-2">
          {isPending && (
            <>
              <button
                onClick={() => onAccept(order.id)}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(132,204,22,0.3)] transition hover:bg-brand-secondary active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                KABUL ET &amp; HAZIRLA
              </button>
              <button
                onClick={() => onCancel(order)}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition disabled:opacity-50"
              >
                <XCircle size={16} /> İptal Et
              </button>
            </>
          )}
          {isPreparing && (
            <button
              onClick={() => onReady(order.id)}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(249,115,22,0.25)] transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Hazırlandı → Kuryeye Ver
            </button>
          )}
          {isOnWay && (
            <button
              onClick={() => onDeliver(order.id)}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(147,51,234,0.25)] transition hover:bg-purple-700 active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Müşteriye Teslim Et
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ana component ─────────────────────────────────────────────────────────────
type Tab = 'immediate' | 'completed'

export default function KitchenScreen() {
  const { branchId: _branchId } = useBranch()
  const [orders,     setOrders]     = useState<Order[]>([])
  const [completed,  setCompleted]  = useState<Order[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState<string | null>(null)
  const [tab,        setTab]        = useState<Tab>('immediate')
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
  const [cancelling,  setCancelling]  = useState(false)

  const initialUnlocked = (() => {
    try { return localStorage.getItem(AUDIO_UNLOCKED_KEY) === '1' } catch { return false }
  })()
  const [showAudioPrompt, setShowAudioPrompt] = useState(!initialUnlocked)
  const channelRef         = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const audioRef           = useRef<HTMLAudioElement | null>(null)
  const prevPendingRef     = useRef(0)
  const isAudioUnlockedRef = useRef(initialUnlocked)
  const titleFlashRef      = useRef(false)

  const markAudioUnlocked = useCallback(() => {
    isAudioUnlockedRef.current = true
    try { localStorage.setItem(AUDIO_UNLOCKED_KEY, '1') } catch {}
  }, [])

  // Autoplay unlock — herhangi bir click/key user gesture sayilir
  useEffect(() => {
    const unlock = () => {
      if (isAudioUnlockedRef.current || !audioRef.current) return
      const a = audioRef.current
      a.muted = true
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; markAudioUnlocked() }).catch(() => {})
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock) }
  }, [markAudioUnlocked])

  const playNotification = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !isAudioUnlockedRef.current) return
    // Loop "Zil" effect'i ayri yonetiyor; burada yalnizca bir tetikleyici.
    audio.currentTime = 0
    audio.play().catch((e) => { if (import.meta.env.DEV) console.warn('autoplay blocked', e) })
  }, [])

  const flashTitle = useCallback(() => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') return
    titleFlashRef.current = true
    document.title = ALERT_DOC_TITLE
  }, [])

  // Sayfa gorunur olunca title'i normalize et
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && titleFlashRef.current) {
        document.title = BASE_DOC_TITLE
        titleFlashRef.current = false
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (document.visibilityState === 'visible') {
      document.title = BASE_DOC_TITLE
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.title = BASE_DOC_TITLE
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    const [active, done] = await Promise.all([
      supabase.from('orders').select(ORDERS_WITH_ADDRESS_SELECT).in('status', ['pending', 'confirmed', 'preparing', 'on_way']).order('created_at', { ascending: true }),
      supabase.from('orders').select(ORDERS_WITH_ADDRESS_SELECT).in('status', ['delivered', 'cancelled']).order('updated_at', { ascending: false }).limit(30),
    ])

    const userIds = Array.from(new Set(
      [...(active.data ?? []), ...(done.data ?? [])]
        .map((o: any) => o.user_id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    ))

    const privilegedMap = new Map<string, string | null>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, privileged_until')
        .in('id', userIds)
      for (const p of profiles ?? []) {
        privilegedMap.set((p as any).id, (p as any).privileged_until ?? null)
      }
    }

    const now = Date.now()
    const mapPrivileged = (o: any): Order => {
      const until = o.user_id ? privilegedMap.get(o.user_id) : null
      return {
        ...o,
        is_privileged: until ? new Date(until).getTime() > now : false,
      }
    }
    setOrders((active.data ?? []).map(mapPrivileged))
    setCompleted((done.data ?? []).map(mapPrivileged))
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useEffect(() => {
    channelRef.current = supabase
      .channel('kitchen-all-orders')
      .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'INSERT' as const, schema: 'public', table: 'orders' }, (payload) => {
        const status = (payload.new as { status?: string } | null)?.status
        if (status === 'pending' || status === 'confirmed') {
          playNotification()
          flashTitle()
        }
      })
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [fetchOrders, playNotification, flashTitle])

  const pendingOrders   = useMemo(
    () => orders.filter(o => (o.status === 'pending' || o.status === 'confirmed') && isOrderPaid(o)),
    [orders],
  )
  const immediateOrders = useMemo(() => orders.filter(o => {
    if (!isOrderPaid(o)) return false
    const dt = o.delivery_type || o.delivery_time_type || 'immediate'
    return dt === 'immediate' || !dt
  }), [orders])

  // Zil
  useEffect(() => {
    const count = pendingOrders.length
    const audio = audioRef.current
    if (!audio) return
    if (count > prevPendingRef.current && isAudioUnlockedRef.current) {
      audio.loop = true; audio.currentTime = 0; audio.play().catch(() => {})
    } else if (count === 0) {
      audio.pause(); audio.currentTime = 0; audio.loop = false
    }
    prevPendingRef.current = count
  }, [pendingOrders.length])

  async function markAccept(id: string) {
    const target = orders.find(o => String(o.id) === String(id))
    if (target && !isOrderPaid(target)) {
      alert('Bu sipariş henüz ödenmemiş. Kabul edilemez.')
      return
    }
    setSaving(id)
    const { error } = await supabase.from('orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(null)
    if (error) {
      console.error('markAccept error:', error)
      alert('Sipariş kabul edilemedi: ' + error.message)
      return
    }
    await fetchOrders()
  }

  async function markReady(id: string) {
    setSaving(id)
    const { error } = await supabase.from('orders').update({ status: 'on_way', updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(null)
    if (error) {
      console.error('markReady error:', error)
      alert('Kuryeye verme işaretlenemedi: ' + error.message)
      return
    }
    await fetchOrders()
  }

  async function markDelivered(id: string) {
    setSaving(id)
    const now = new Date().toISOString()
    const { error } = await supabase.from('orders').update({ status: 'delivered', delivered_at: now, updated_at: now }).eq('id', id)
    setSaving(null)
    if (error) {
      console.error('markDelivered error:', error)
      alert('Teslim işaretleme başarısız: ' + error.message)
      return
    }
    await fetchOrders()
  }

  async function handleCancelConfirm(reason: string) {
    if (!cancelOrder) return
    setCancelling(true)
    await supabase.from('orders').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      ...(reason ? { cancel_reason: reason } : {}),
    }).eq('id', cancelOrder.id)
    setCancelling(false)
    setCancelOrder(null)
    fetchOrders()
  }

  const testAudio = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.loop = false
    audio.currentTime = 0
    audio.muted = false
    audio.play().then(() => {
      markAudioUnlocked()
    }).catch(() => {
      alert('Ses çalınamadı. Tarayıcı ayarlarından sesi açın.')
    })
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number; color: string }[] = [
    { key: 'immediate', label: 'Hemen',      icon: <Zap size={14} />,          count: immediateOrders.length, color: tab === 'immediate' ? 'bg-white border-b-2 border-brand-primary text-slate-800 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-gray-50' },
    { key: 'completed', label: 'Tamamlanan', icon: <History size={14} />,       count: completed.length,       color: tab === 'completed'  ? 'bg-white border-b-2 border-slate-700 text-slate-800 font-semibold shadow-sm'      : 'text-slate-600 hover:text-slate-800 hover:bg-gray-50' },
  ]

  return (
    <div className="p-4 md:p-6">
      <audio ref={audioRef} src={ALARM_SOUND_URL} preload="auto" className="hidden" />

      {/* Ses aktivasyon prompt */}
      {showAudioPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <Volume2 size={28} className="text-brand-primary" />
            </div>
            <h3 className="text-lg font-black text-brand-dark mb-2">Zil Sesini Deneyin</h3>
            <p className="text-sm text-slate-500 mb-6">
              Zil sesini test edin. Cihaz sesinin açık olduğundan emin olun.
            </p>
            <button
              onClick={() => {
                const audio = audioRef.current
                if (audio) {
                  audio.loop = false
                  audio.muted = false
                  audio.currentTime = 0
                  audio.play().then(() => {
                    markAudioUnlocked()
                    setShowAudioPrompt(false)
                  }).catch(() => {
                    alert('Ses çalınamadı. Tarayıcı ayarlarından sesi açın.')
                  })
                }
              }}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-black text-white shadow-[0_4px_12px_rgba(132,204,22,0.3)] hover:bg-brand-secondary"
            >
              <span className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,165.63V90.37l56-43.58ZM216,128a87.55,87.55,0,0,1-17.23,52.28,8,8,0,0,1-12.88-9.48A71.55,71.55,0,0,0,200,128a71.55,71.55,0,0,0-14.11-42.8,8,8,0,1,1,12.88-9.48A87.55,87.55,0,0,1,216,128Z"/></svg>
                Sesi Dene
              </span>
            </button>
            <button
              onClick={() => setShowAudioPrompt(false)}
              className="mt-2 w-full rounded-xl py-2 text-xs text-slate-400 hover:text-slate-600"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* İptal modal */}
      {cancelOrder && (
        <CancelModal
          orderCode={orderCode(cancelOrder)}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelOrder(null)}
          loading={cancelling}
        />
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ChefHat size={20} className="text-brand-primary" />
          <h1 className="text-xl font-black text-brand-dark">Mutfak</h1>
        </div>
        <div className="flex items-center gap-2">
          {pendingOrders.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 animate-pulse">
              🔔 {pendingOrders.length} yeni
            </span>
          )}
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            {orders.length} aktif
          </span>
          <button
            onClick={testAudio}
            title="Zil sesini test et"
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition"
          >
            <Volume2 size={14} />
            Sesi Test Et
          </button>
        </div>
      </div>

      {/* Tab navigasyon */}
      <div className="mb-5 flex rounded-2xl border border-gray-200 bg-white p-1 gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm transition ${t.color}`}
            style={tab === t.key
              ? { borderBottom: '2px solid #22c55e', color: '#1e293b', fontWeight: 600, background: 'white' }
              : { color: '#475569' }
            }
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                tab === t.key ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-slate-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Hemen ── */}
      {tab === 'immediate' && (
        immediateOrders.length === 0 ? (
          <EmptyState icon={<Zap size={36} className="text-slate-200" />} text="Bekleyen hemen sipariş yok" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {immediateOrders.map(order => (
              <OrderCard key={order.id} order={order} saving={saving} onAccept={markAccept} onReady={markReady} onDeliver={markDelivered} onCancel={setCancelOrder} />
            ))}
          </div>
        )
      )}

      {/* ── Tamamlananlar ── */}
      {tab === 'completed' && (
        completed.length === 0 ? (
          <EmptyState icon={<History size={36} className="text-slate-200" />} text="Tamamlanan sipariş yok" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {completed.map(order => (
              <OrderCard key={order.id} order={order} saving={saving} onAccept={markAccept} onReady={markReady} onDeliver={markDelivered} onCancel={setCancelOrder} completed />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16">
      {icon}
      <p className="mt-3 text-sm font-bold text-slate-400">{text}</p>
    </div>
  )
}
