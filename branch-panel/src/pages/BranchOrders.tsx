import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle, Clock, Loader2, Truck, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useBranch } from '../context/BranchContext'
import type { Order, OrderItem } from '../types'

const COLUMNS: { statuses: Order['status'][]; label: string; dot: string; headerCls: string }[] = [
  {
    statuses:  ['pending', 'confirmed'],
    label:     'Yeni',
    dot:       'bg-amber-400',
    headerCls: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    statuses:  ['preparing'],
    label:     'Hazırlanıyor',
    dot:       'bg-blue-400',
    headerCls: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    statuses:  ['on_way'],
    label:     'Yolda',
    dot:       'bg-purple-400',
    headerCls: 'border-purple-200 bg-purple-50 text-purple-700',
  },
  {
    statuses:  ['delivered'],
    label:     'Teslim',
    dot:       'bg-green-400',
    headerCls: 'border-green-200 bg-green-50 text-green-700',
  },
]

const NEXT_STATUS: Partial<Record<Order['status'], Order['status']>> = {
  pending:   'preparing',
  confirmed: 'preparing',
  preparing: 'on_way',
  on_way:    'delivered',
}

const ACTION_LABEL: Partial<Record<Order['status'], string>> = {
  pending:   'Onayla',
  confirmed: 'Onayla',
  preparing: 'Kuryeye Ver',
  on_way:    'Teslim Et',
}

function elapsedLabel(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (mins < 60) return `${mins} dk`
  return `${Math.floor(mins / 60)} sa ${mins % 60} dk`
}

function elapsedColor(createdAt: string, status: Order['status']) {
  if (status === 'delivered' || status === 'cancelled') return 'text-slate-400'
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (mins >= 20) return 'text-red-500'
  if (mins >= 10) return 'text-amber-500'
  return 'text-slate-400'
}

function parseItems(raw: unknown): OrderItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as OrderItem[]
  try { return JSON.parse(raw as string) as OrderItem[] } catch { return [] }
}

function itemLabel(item: OrderItem): string {
  return item.name || (item as any).product_name || 'Ürün'
}

function itemOptions(item: OrderItem): string[] {
  if (item.selectedOptions?.labels?.length) return item.selectedOptions.labels
  if (Array.isArray(item.options) && item.options.length) return item.options
  return []
}

function OrderCard({
  order, onAction, onCancel, saving,
}: {
  order:    Order
  onAction: (id: string, next: Order['status']) => void
  onCancel: (id: string) => void
  saving:   string | null
}) {
  const next      = NEXT_STATUS[order.status]
  const isSaving  = saving === order.id
  const items     = parseItems(order.items)
  const orderCode = order.paytr_oid || `#${order.id.slice(-6).toUpperCase()}`

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-brand-dark">{orderCode}</p>
          {order.customer_name && (
            <p className="text-xs text-slate-400">{order.customer_name}</p>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${elapsedColor(order.created_at, order.status)}`}>
          <Clock size={12} />
          {elapsedLabel(order.created_at)}
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-1 border-t border-gray-50 pt-2">
        {items.length === 0 ? (
          <li className="text-xs italic text-slate-300">Ürün bilgisi yok</li>
        ) : (
          items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">
                {item.quantity}× {itemLabel(item)}
              </span>
              {itemOptions(item).length > 0 && (
                <span className="shrink-0 text-right text-[11px] text-slate-400">
                  {itemOptions(item).join(', ')}
                </span>
              )}
            </li>
          ))
        )}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-sm font-bold text-brand-primary">
          ₺{Number(order.total_price ?? 0).toFixed(2)}
        </span>
        <div className="flex items-center gap-1.5">
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <button
              onClick={() => onCancel(order.id)}
              disabled={isSaving}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100 disabled:opacity-40"
            >
              <X size={12} /> İptal
            </button>
          )}
          {next && (
            <button
              onClick={() => onAction(order.id, next)}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-secondary disabled:opacity-40"
            >
              {isSaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : next === 'delivered' ? (
                <CheckCircle size={12} />
              ) : next === 'on_way' ? (
                <Truck size={12} />
              ) : null}
              {ACTION_LABEL[order.status]}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BranchOrders() {
  const { branchId }  = useBranch()
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchOrders = useCallback(async () => {
    const query = supabase
      .from('orders')
      .select('*')
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'refunded')
      .not('status', 'eq', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(200)

    if (branchId) query.eq('branch_id', branchId)

    const { data, error } = await query
    if (error) console.error('[BranchOrders] fetch error:', error)
    setOrders((data ?? []) as Order[])
    setLoading(false)
  }, [branchId])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useEffect(() => {
    const channelName = branchId ? `orders-branch-${branchId}` : 'orders-all'
    const filter = branchId
      ? { event: '*' as const, schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` }
      : { event: '*' as const, schema: 'public', table: 'orders' }

    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', filter, () => fetchOrders())
      .subscribe()

    return () => { channelRef.current?.unsubscribe() }
  }, [branchId, fetchOrders])

  async function handleAction(id: string, next: Order['status']) {
    setSaving(id)
    await supabase.from('orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(null)
    fetchOrders()
  }

  async function handleCancel(id: string) {
    if (!confirm('Bu siparişi iptal etmek istediğinizden emin misiniz?')) return
    setSaving(id)
    await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(null)
    fetchOrders()
  }

  const byStatuses = (statuses: Order['status'][]) =>
    orders.filter(o => statuses.includes(o.status))

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  const activeCount = orders.filter(o => o.status !== 'delivered').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-dark">Siparişler</h1>
        <span className="rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-sm font-semibold text-slate-500 shadow-sm">
          {activeCount} aktif
        </span>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(col => {
          const colOrders = byStatuses(col.statuses)
          return (
            <section key={col.statuses.join('+')}>
              <div className={`mb-3 flex items-center justify-between rounded-xl border px-3 py-2 ${col.headerCls}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <p className="text-sm font-bold">{col.label}</p>
                </div>
                <span className="text-xs font-semibold opacity-60">{colOrders.length}</span>
              </div>
              <div className="space-y-3">
                {colOrders.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-300">—</p>
                ) : (
                  colOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAction={handleAction}
                      onCancel={handleCancel}
                      saving={saving}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
