import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, Package, Search } from 'lucide-react'
import { supabase } from '../supabase'
import { useBranch } from '../context/BranchContext'
import type { Product } from '../types'

// ŞUBE BAZLI STOK (13.10.2026)
// Eskiden bu ekran doğrudan products.is_available yazıyordu: Bayraklı bir
// ürünü kapattığında Basın Sitesi'nde de kapanıyordu (ve tersi).
// Artık kapatma `branch_product_stock` tablosuna, YALNIZ bu şube için yazılır.
//   · products.is_available = false  → yönetici ürünü TÜM şubelerde kapatmış;
//     şube paneli bunu açamaz (sadece bilgi olarak gösterilir).
//   · branch_product_stock satırı yok → o şubede AÇIK (varsayılan).

interface SubeStok {
  product_id: number
  is_available: boolean
}

export default function StockScreen() {
  const { branchId, branch } = useBranch()
  const [products, setProducts] = useState<Product[]>([])
  const [subeKapali, setSubeKapali] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    if (!branchId) {
      setProducts([])
      setSubeKapali(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')

    const [urunler, stok] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, price, is_available, in_stock, cal, category')
        .order('name', { ascending: true }),
      supabase
        .from('branch_product_stock')
        .select('product_id, is_available')
        .eq('branch_id', branchId),
    ])

    if (urunler.error) {
      setError('Ürünler yüklenirken hata: ' + urunler.error.message)
      setLoading(false)
      return
    }
    if (stok.error) {
      setError('Şube stok durumu okunamadı: ' + stok.error.message)
      setLoading(false)
      return
    }

    setProducts((urunler.data ?? []) as Product[])
    setSubeKapali(
      new Set(
        ((stok.data ?? []) as SubeStok[])
          .filter((r) => r.is_available === false)
          .map((r) => Number(r.product_id)),
      ),
    )
    setLoading(false)
  }, [branchId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Yönetici tüm şubelerde kapattı mı?
  const genelKapali = (p: Product) => p.is_available === false || p.in_stock === false

  async function toggleAvailable(product: Product) {
    if (!branchId) return
    if (genelKapali(product)) {
      setError(`"${product.name}" yönetici tarafından tüm şubelerde kapatılmış. Şube panelinden açılamaz.`)
      return
    }

    const suAnKapali = subeKapali.has(Number(product.id))
    const yeniDurum = suAnKapali // kapalıysa aç → is_available = true

    setError('')
    setSaving(Number(product.id))

    const { error: err } = await supabase.rpc('fn_set_branch_product_availability', {
      p_branch_id: branchId,
      p_product_id: product.id,
      p_is_available: yeniDurum,
    })

    if (err) {
      setError('Güncellenemedi: ' + err.message)
      setSaving(null)
      return
    }

    setSubeKapali((prev) => {
      const next = new Set(prev)
      if (yeniDurum) next.delete(Number(product.id))
      else next.add(Number(product.id))
      return next
    })
    setSaving(null)
  }

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.category ?? '').toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  )

  const acikSayi = filtered.filter((p) => !genelKapali(p) && !subeKapali.has(Number(p.id))).length

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  if (!branchId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Hesabınız bir şubeye bağlı değil. Stok yönetimi için yöneticinize başvurun.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Stok Durumu</h1>
          <p className="mt-1 text-sm text-slate-400">
            Yaptığınız değişiklik <span className="font-semibold text-slate-500">yalnız {branch?.name ?? 'bu şube'}</span> için geçerlidir.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
          <span className="text-2xl font-bold text-brand-primary tabular-nums">{acikSayi}</span>
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
          onChange={(e) => setSearch(e.target.value)}
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
                <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Bu Şubede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((product) => {
                const pid = Number(product.id)
                const isSaving = saving === pid
                const kilitli = genelKapali(product)
                const kapali = kilitli || subeKapali.has(pid)
                return (
                  <tr key={product.id} className="transition hover:bg-brand-input">
                    <td className="px-5 py-3.5 font-medium text-brand-dark">
                      {product.name}
                      {product.cal ? (
                        <span className="ml-2 text-xs text-slate-400">{product.cal} kcal</span>
                      ) : null}
                      {kilitli ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          <Lock size={10} /> Tüm şubelerde kapalı
                        </span>
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
                        disabled={isSaving || kilitli}
                        title={kilitli ? 'Yönetici tüm şubelerde kapattı — şubeden açılamaz' : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          !kapali
                            ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                            : 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        {isSaving && <Loader2 size={11} className="animate-spin" />}
                        {!kapali ? '✓ Var' : '✗ Yok'}
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
