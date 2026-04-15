import { useCallback, useEffect, useState } from 'react'
import { Loader2, Package, Search } from 'lucide-react'
import { supabase } from '../supabase'
import type { Product } from '../types'

// branch_stock table does not exist in DB.
// Manage availability directly on the products table (is_available boolean).

export default function StockScreen() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<number | null>(null)
  const [search,   setSearch]   = useState('')
  const [error,    setError]    = useState('')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('products')
      .select('id, name, price, is_available, in_stock, cal, category')
      .order('name', { ascending: true })

    if (err) {
      setError('Ürünler yüklenirken hata: ' + err.message)
      setLoading(false)
      return
    }
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  async function toggleAvailable(product: Product) {
    setSaving(product.id)
    const { error: err } = await supabase
      .from('products')
      .update({ is_available: !product.is_available })
      .eq('id', product.id)

    if (!err) {
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, is_available: !product.is_available } : p)
      )
    }
    setSaving(null)
  }

  const filtered       = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const availableCount = filtered.filter(p => p.is_available).length

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Stok Durumu</h1>
          <p className="mt-1 text-sm text-slate-400">Ürünlerin satışa açık/kapalı durumunu yönetin.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
          <span className="text-2xl font-bold text-brand-primary tabular-nums">{availableCount}</span>
          <span className="text-sm text-slate-400">/ {filtered.length} stokta</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Ürün veya kategori ara…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-dark placeholder:text-slate-300 outline-none transition focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(132,204,22,0.1)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-20 shadow-sm">
          <Package size={40} strokeWidth={1.5} className="text-slate-200" />
          <p className="mt-3 text-sm font-medium text-slate-400">Ürün bulunamadı.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-brand-input text-left">
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Ürün</th>
                <th className="hidden px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:table-cell">Kategori</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Fiyat</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(product => {
                const isSaving = saving === product.id
                return (
                  <tr key={product.id} className="transition hover:bg-brand-input">
                    <td className="px-5 py-3.5 font-medium text-brand-dark">
                      {product.name}
                      {product.cal ? (
                        <span className="ml-2 text-xs text-slate-400">{product.cal} kcal</span>
                      ) : null}
                    </td>
                    <td className="hidden px-5 py-3.5 text-slate-400 sm:table-cell">
                      {product.category ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-600">
                      ₺{Number(product.price).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => toggleAvailable(product)}
                        disabled={isSaving}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                          product.is_available
                            ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                            : 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        {isSaving && <Loader2 size={11} className="animate-spin" />}
                        {product.is_available ? '✓ Var' : '✗ Yok'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
