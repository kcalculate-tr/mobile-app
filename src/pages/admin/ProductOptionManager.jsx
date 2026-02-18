/**
 * ProductOptionManager.jsx — Admin: Ürüne Seçim Grubu Bağlama
 *
 * Özellikler:
 *  - Ürün arama ve seçme
 *  - Ürüne bağlı grupları listeleme (product_option_groups)
 *  - Tüm gruplardan seçerek ürüne ekleme
 *  - Grup sıralamasını ↑↓ oklarıyla değiştirme (sort_order güncellenir)
 *  - Gruptan bağı kaldırma (ürün veya grup silinmez)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';

// ─── Küçük araçlar ────────────────────────────────────────────────────────────
function Spinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
        </div>
    );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export default function ProductOptionManager() {
    // Ürün arama
    const [productQuery, setProductQuery] = useState('');
    const [allProducts, setAllProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);

    // Seçili ürün
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Ürüne bağlı gruplar
    const [boundGroups, setBoundGroups] = useState([]); // product_option_groups rows (join group info)
    const [boundLoading, setBoundLoading] = useState(false);

    // Tüm mevcut gruplar (ekleme seçicisi için)
    const [allGroups, setAllGroups] = useState([]);
    const [allGroupsLoading, setAllGroupsLoading] = useState(false);

    const [saving, setSaving] = useState(false);

    // ── Ürün ara ──────────────────────────────────────────────────────────────
    const searchProducts = useCallback(async (q) => {
        setProductsLoading(true);
        try {
            let query = supabase.from('products').select('id, name, img, image').order('name');
            if (q.trim()) query = query.ilike('name', `%${q}%`);
            const { data, error } = await query.limit(30);
            if (error) throw error;
            setAllProducts(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setProductsLoading(false);
        }
    }, []);

    useEffect(() => { searchProducts(productQuery); }, [productQuery, searchProducts]);

    // ── Tüm grupları yükle ────────────────────────────────────────────────────
    const fetchAllGroups = useCallback(async () => {
        setAllGroupsLoading(true);
        try {
            const { data, error } = await supabase
                .from('option_groups')
                .select('*')
                .order('name');
            if (error) throw error;
            setAllGroups(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setAllGroupsLoading(false);
        }
    }, []);

    useEffect(() => { fetchAllGroups(); }, [fetchAllGroups]);

    // ── Ürüne bağlı grupları yükle ─────────────────────────────────────────────
    const fetchBoundGroups = useCallback(async (productId) => {
        setBoundLoading(true);
        try {
            const { data, error } = await supabase
                .from('product_option_groups')
                .select('id, sort_order, option_groups(id, name, description, min_selection, max_selection, is_required)')
                .eq('product_id', productId)
                .order('sort_order', { ascending: true });
            if (error) throw error;
            // Flatten: { pogId, sort_order, ...group }
            setBoundGroups(
                (data || []).map((row) => ({
                    pogId: row.id,
                    sort_order: row.sort_order,
                    ...row.option_groups,
                }))
            );
        } catch (e) {
            console.error(e);
        } finally {
            setBoundLoading(false);
        }
    }, []);

    const selectProduct = useCallback((product) => {
        setSelectedProduct(product);
        fetchBoundGroups(product.id);
    }, [fetchBoundGroups]);

    // ── Ürüne grup ekle ───────────────────────────────────────────────────────
    const addGroup = async (group) => {
        if (!selectedProduct) return;
        // Zaten eklenmiş mi?
        if (boundGroups.some((bg) => bg.id === group.id)) {
            alert(`"${group.name}" zaten bu ürüne eklenmiş.`);
            return;
        }
        setSaving(true);
        try {
            const nextSortOrder = boundGroups.length; // en sona ekle
            const { error } = await supabase
                .from('product_option_groups')
                .insert({
                    product_id: selectedProduct.id,
                    group_id: group.id,
                    sort_order: nextSortOrder,
                });
            if (error) throw error;
            await fetchBoundGroups(selectedProduct.id);
        } catch (e) {
            alert('Hata: ' + (e.message || 'Eklenemedi'));
        } finally {
            setSaving(false);
        }
    };

    // ── Üründen grup bağını kaldır ────────────────────────────────────────────
    const removeGroup = async (boundGroup) => {
        if (!confirm(`"${boundGroup.name}" grubunu bu üründen kaldırmak istiyor musunuz?\n(Grup ve seçenekleri silinmez, sadece bu üründen ayrılır.)`)) return;
        const { error } = await supabase
            .from('product_option_groups')
            .delete()
            .eq('id', boundGroup.pogId);
        if (error) { alert(error.message); return; }
        await fetchBoundGroups(selectedProduct.id);
    };

    // ── Grup sıralamasını değiştir ────────────────────────────────────────────
    const moveGroup = async (index, direction) => {
        const newGroups = [...boundGroups];
        const swapIdx = direction === 'up' ? index - 1 : index + 1;
        if (swapIdx < 0 || swapIdx >= newGroups.length) return;
        [newGroups[index], newGroups[swapIdx]] = [newGroups[swapIdx], newGroups[index]];

        // Optimistic UI
        setBoundGroups(newGroups);

        // DB: sort_order toplu güncelle
        await Promise.all(
            newGroups.map((g, i) =>
                supabase
                    .from('product_option_groups')
                    .update({ sort_order: i })
                    .eq('id', g.pogId)
            )
        );
    };

    // ── Filtrelenmiş ürün listesi ──────────────────────────────────────────────
    const filteredProducts = allProducts.filter((p) =>
        !productQuery || p.name?.toLowerCase().includes(productQuery.toLowerCase())
    );

    // ── Eklenebilir gruplar (henüz eklenmemiş) ────────────────────────────────
    const boundGroupIds = new Set(boundGroups.map((g) => g.id));
    const availableGroups = allGroups.filter((g) => !boundGroupIds.has(g.id));

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full flex-col">
            {/* Başlık */}
            <div className="border-b border-gray-100 bg-white px-5 py-4">
                <h1 className="text-lg font-bold text-gray-900">Ürün → Seçim Grubu Bağlama</h1>
                <p className="text-xs text-gray-500">
                    Bir ürün seçin, ardından seçim gruplarını ekleyin ve sıralayın
                </p>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* ── Sol: Ürün Listesi ── */}
                <div className="flex w-72 shrink-0 flex-col border-r border-gray-100 bg-gray-50">
                    {/* Arama */}
                    <div className="relative p-3">
                        <Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={productQuery}
                            onChange={(e) => setProductQuery(e.target.value)}
                            placeholder="Ürün ara…"
                            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-green-500"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {productsLoading && <Spinner />}
                        {!productsLoading && filteredProducts.length === 0 && (
                            <p className="p-4 text-center text-xs text-gray-400">Ürün bulunamadı</p>
                        )}
                        {filteredProducts.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => selectProduct(p)}
                                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white
                                    ${selectedProduct?.id === p.id ? 'bg-white shadow-sm' : ''}`}
                            >
                                {(p.img || p.image) ? (
                                    <img
                                        src={p.img || p.image}
                                        alt={p.name}
                                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-200" />
                                )}
                                <span className="flex-1 truncate text-sm font-medium text-gray-800">
                                    {p.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Orta: Bağlı Gruplar ── */}
                <div className="flex flex-1 flex-col overflow-y-auto bg-white p-5">
                    {!selectedProduct && (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <p className="text-sm">Sol taraftan bir ürün seçin</p>
                        </div>
                    )}

                    {selectedProduct && (
                        <>
                            {/* Ürün başlığı */}
                            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 p-3">
                                {(selectedProduct.img || selectedProduct.image) && (
                                    <img
                                        src={selectedProduct.img || selectedProduct.image}
                                        alt={selectedProduct.name}
                                        className="h-12 w-12 rounded-xl object-cover"
                                    />
                                )}
                                <div>
                                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Seçili Ürün</p>
                                    <p className="font-bold text-gray-900">{selectedProduct.name}</p>
                                </div>
                            </div>

                            <h3 className="mb-3 text-sm font-bold text-gray-700">
                                Bağlı Seçim Grupları ({boundGroups.length})
                            </h3>

                            {boundLoading && <Spinner />}

                            {!boundLoading && boundGroups.length === 0 && (
                                <p className="mb-4 rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                                    Bu ürüne henüz grup eklenmemiş.
                                    <br />
                                    Sağ taraftan bir grup seçin.
                                </p>
                            )}

                            {/* Bağlı grup listesi */}
                            <div className="mb-6 flex flex-col gap-2">
                                {boundGroups.map((bg, idx) => (
                                    <div
                                        key={bg.pogId}
                                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                                    >
                                        {/* Sıra okları */}
                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                disabled={idx === 0}
                                                onClick={() => moveGroup(idx, 'up')}
                                                className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-20"
                                            >
                                                <ArrowUp size={13} />
                                            </button>
                                            <button
                                                disabled={idx === boundGroups.length - 1}
                                                onClick={() => moveGroup(idx, 'down')}
                                                className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-20"
                                            >
                                                <ArrowDown size={13} />
                                            </button>
                                        </div>

                                        {/* Sıra no */}
                                        <span className="w-6 text-center text-xs font-mono font-bold text-green-600">
                                            #{idx + 1}
                                        </span>

                                        {/* Bilgi */}
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-gray-800">{bg.name}</p>
                                            <p className="text-xs text-gray-400">
                                                {bg.is_required ? 'Zorunlu' : 'Opsiyonel'} •{' '}
                                                min {bg.min_selection} / max {bg.max_selection} seçim
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => removeGroup(bg)}
                                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Sağ: Eklenebilir Gruplar ── */}
                {selectedProduct && (
                    <div className="flex w-64 shrink-0 flex-col border-l border-gray-100 bg-gray-50">
                        <div className="border-b border-gray-100 px-4 py-3">
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                                Eklenebilir Gruplar
                            </p>
                            <p className="text-[11px] text-gray-400">
                                Tıklayarak ürüne ekleyin
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {allGroupsLoading && <Spinner />}
                            {!allGroupsLoading && availableGroups.length === 0 && (
                                <p className="p-4 text-center text-xs text-gray-400">
                                    Tüm gruplar zaten eklenmiş.
                                </p>
                            )}
                            {availableGroups.map((g) => (
                                <button
                                    key={g.id}
                                    onClick={() => addGroup(g)}
                                    disabled={saving}
                                    className="mb-1.5 flex w-full items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-green-400 hover:bg-green-50 disabled:opacity-50"
                                >
                                    <Plus size={14} className="mt-0.5 shrink-0 text-green-600" />
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-gray-800">{g.name}</p>
                                        <p className="text-[11px] text-gray-400">
                                            {g.is_required ? 'Zorunlu' : 'Opsiyonel'} •{' '}
                                            max {g.max_selection}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
