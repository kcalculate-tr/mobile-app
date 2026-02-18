/**
 * OptionGroups.jsx — Admin: Seçim Grubu Yönetimi
 *
 * Özellikler:
 *  - Tüm option_groups'u listele
 *  - Grup oluştur / düzenle (modal form)
 *  - Grup içindeki option_items'ı yönet (ekle, sil, sıra no düzenle)
 *  - Grup silme (bağlı product_option_groups cascade ile temizlenir)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabase';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';

// ─── Sabitler ────────────────────────────────────────────────────────────────
const EMPTY_GROUP = {
    name: '',
    description: '',
    min_selection: 0,
    max_selection: 1,
    is_required: false,
};

const EMPTY_ITEM = {
    name: '',
    price_adjustment: 0,
    is_available: true,
    sort_order: 0,
};

// ─── Küçük bileşenler ─────────────────────────────────────────────────────────
function Spinner() {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
        </div>
    );
}

function Badge({ label, color = 'green' }) {
    const cls = {
        green: 'bg-green-100 text-green-800',
        red: 'bg-red-100 text-red-800',
        blue: 'bg-blue-100 text-blue-800',
        gray: 'bg-gray-100 text-gray-600',
    }[color] || 'bg-gray-100 text-gray-600';
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
            {label}
        </span>
    );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export default function OptionGroups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Seçili grup (sağ panelde item yönetimi)
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [items, setItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(false);

    // Modal: grup oluştur / düzenle
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    // Modal: item ekle
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [saving, setSaving] = useState(false);

    // ── Grupları yükle ────────────────────────────────────────────────────────
    const fetchGroups = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: err } = await supabase
                .from('option_groups')
                .select('*')
                .order('name');
            if (err) throw err;
            setGroups(data || []);
        } catch (e) {
            setError(e.message || 'Gruplar yüklenemedi.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    // ── Grup itemlarını yükle ─────────────────────────────────────────────────
    const fetchItems = useCallback(async (groupId) => {
        setItemsLoading(true);
        try {
            const { data, error: err } = await supabase
                .from('option_items')
                .select('*')
                .eq('group_id', groupId)
                .order('sort_order', { ascending: true });
            if (err) throw err;
            setItems(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setItemsLoading(false);
        }
    }, []);

    const selectGroup = useCallback((group) => {
        setSelectedGroup(group);
        fetchItems(group.id);
    }, [fetchItems]);

    // ── Grup kaydet (oluştur/güncelle) ────────────────────────────────────────
    const saveGroup = async (form) => {
        setSaving(true);
        try {
            if (editingGroup) {
                const { error: err } = await supabase
                    .from('option_groups')
                    .update(form)
                    .eq('id', editingGroup.id);
                if (err) throw err;
            } else {
                const { error: err } = await supabase
                    .from('option_groups')
                    .insert(form);
                if (err) throw err;
            }
            setShowGroupModal(false);
            setEditingGroup(null);
            await fetchGroups();
        } catch (e) {
            alert('Hata: ' + (e.message || 'Kaydedilemedi'));
        } finally {
            setSaving(false);
        }
    };

    // ── Grup sil ──────────────────────────────────────────────────────────────
    const deleteGroup = async (group) => {
        if (!confirm(`"${group.name}" grubunu silmek istediğinizden emin misiniz?\nBağlı tüm ürün ilişkileri de silinecek.`)) return;
        const { error: err } = await supabase
            .from('option_groups')
            .delete()
            .eq('id', group.id);
        if (err) { alert(err.message); return; }
        if (selectedGroup?.id === group.id) { setSelectedGroup(null); setItems([]); }
        fetchGroups();
    };

    // ── Item kaydet ───────────────────────────────────────────────────────────
    const saveItem = async (form) => {
        setSaving(true);
        try {
            if (editingItem?.id) {
                const { error: err } = await supabase
                    .from('option_items')
                    .update(form)
                    .eq('id', editingItem.id);
                if (err) throw err;
            } else {
                const { error: err } = await supabase
                    .from('option_items')
                    .insert({ ...form, group_id: selectedGroup.id });
                if (err) throw err;
            }
            setShowItemModal(false);
            setEditingItem(null);
            await fetchItems(selectedGroup.id);
        } catch (e) {
            alert('Hata: ' + (e.message || 'Kaydedilemedi'));
        } finally {
            setSaving(false);
        }
    };

    // ── Item sil ──────────────────────────────────────────────────────────────
    const deleteItem = async (item) => {
        if (!confirm(`"${item.name}" seçeneğini silmek istediğinizden emin misiniz?`)) return;
        const { error: err } = await supabase
            .from('option_items')
            .delete()
            .eq('id', item.id);
        if (err) { alert(err.message); return; }
        fetchItems(selectedGroup.id);
    };

    // ── Item sıralama: yukarı / aşağı ─────────────────────────────────────────
    const moveItem = async (index, direction) => {
        const newItems = [...items];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= newItems.length) return;
        [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];

        // Optimistic UI
        setItems(newItems);

        // sort_order değerlerini yeniden ata ve toplu güncelle
        await Promise.all(
            newItems.map((item, i) =>
                supabase.from('option_items').update({ sort_order: i }).eq('id', item.id)
            )
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full flex-col gap-0">
            {/* Başlık */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                <div>
                    <h1 className="text-lg font-bold text-gray-900">Seçim Grupları</h1>
                    <p className="text-xs text-gray-500">
                        Ürünlere eklenebilen tekrar kullanılabilir opsiyon grupları
                    </p>
                </div>
                <button
                    onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
                    className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm active:scale-95"
                >
                    <Plus size={16} /> Yeni Grup
                </button>
            </div>

            {/* İçerik: Sol liste + Sağ panel */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sol: Grup Listesi */}
                <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-gray-50">
                    {loading && <Spinner />}
                    {error && (
                        <p className="p-4 text-xs text-red-500">{error}</p>
                    )}
                    {!loading && groups.length === 0 && (
                        <p className="p-6 text-center text-sm text-gray-400">
                            Henüz grup yok. "Yeni Grup" ile başlayın.
                        </p>
                    )}
                    {groups.map((g) => (
                        <button
                            key={g.id}
                            onClick={() => selectGroup(g)}
                            className={`group flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-white
                                ${selectedGroup?.id === g.id ? 'bg-white shadow-sm' : ''}`}
                        >
                            <div className="flex w-full items-center justify-between">
                                <span className="flex-1 truncate text-sm font-semibold text-gray-800">
                                    {g.name}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setShowGroupModal(true); }}
                                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteGroup(g); }}
                                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {g.is_required && <Badge label="Zorunlu" color="red" />}
                                <Badge
                                    label={`Min ${g.min_selection} / Max ${g.max_selection}`}
                                    color="gray"
                                />
                            </div>
                        </button>
                    ))}
                </div>

                {/* Sağ: Item Yönetimi */}
                <div className="flex flex-1 flex-col overflow-y-auto bg-white p-5">
                    {!selectedGroup && (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <path d="M14 17h7M17.5 14v7" />
                            </svg>
                            <p className="text-sm">Seçenekleri yönetmek için sol taraftan bir grup seçin</p>
                        </div>
                    )}

                    {selectedGroup && (
                        <>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-gray-900">{selectedGroup.name}</h2>
                                    <p className="text-xs text-gray-400">
                                        {selectedGroup.description || 'Açıklama yok'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setEditingItem(null); setShowItemModal(true); }}
                                    className="flex items-center gap-1.5 rounded-xl border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50"
                                >
                                    <Plus size={14} /> Seçenek Ekle
                                </button>
                            </div>

                            {itemsLoading && <Spinner />}

                            {!itemsLoading && items.length === 0 && (
                                <p className="py-10 text-center text-sm text-gray-400">
                                    Bu gruba henüz seçenek eklenmemiş.
                                </p>
                            )}

                            <div className="flex flex-col gap-2">
                                {items.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                                    >
                                        {/* Sıralama okları */}
                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                disabled={idx === 0}
                                                onClick={() => moveItem(idx, 'up')}
                                                className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-20"
                                            >
                                                <ArrowUp size={13} />
                                            </button>
                                            <button
                                                disabled={idx === items.length - 1}
                                                onClick={() => moveItem(idx, 'down')}
                                                className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-20"
                                            >
                                                <ArrowDown size={13} />
                                            </button>
                                        </div>

                                        {/* Sıra no */}
                                        <span className="w-5 text-center text-xs font-mono text-gray-300">
                                            {idx + 1}
                                        </span>

                                        {/* İsim */}
                                        <span className="flex-1 text-sm font-medium text-gray-800">
                                            {item.name}
                                        </span>

                                        {/* Fiyat */}
                                        <span className={`text-sm font-semibold ${item.price_adjustment > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                                            {item.price_adjustment > 0 ? `+${item.price_adjustment}₺` : 'Ücretsiz'}
                                        </span>

                                        {/* Stok durumu */}
                                        <Badge
                                            label={item.is_available ? 'Mevcut' : 'Tükendi'}
                                            color={item.is_available ? 'green' : 'red'}
                                        />

                                        {/* Düzenle / Sil */}
                                        <button
                                            onClick={() => { setEditingItem(item); setShowItemModal(true); }}
                                            className="rounded p-1.5 text-gray-400 hover:bg-gray-200"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => deleteItem(item)}
                                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal: Grup Oluştur/Düzenle */}
            {showGroupModal && (
                <GroupModal
                    initial={editingGroup}
                    onSave={saveGroup}
                    onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
                    saving={saving}
                />
            )}

            {/* Modal: Item Ekle/Düzenle */}
            {showItemModal && (
                <ItemModal
                    initial={editingItem}
                    onSave={saveItem}
                    onClose={() => { setShowItemModal(false); setEditingItem(null); }}
                    saving={saving}
                    existingCount={items.length}
                />
            )}
        </div>
    );
}

// ─── GroupModal ───────────────────────────────────────────────────────────────
function GroupModal({ initial, onSave, onClose, saving }) {
    const [form, setForm] = useState({
        ...EMPTY_GROUP,
        ...(initial ? {
            name: initial.name,
            description: initial.description || '',
            min_selection: initial.min_selection,
            max_selection: initial.max_selection,
            is_required: initial.is_required,
        } : {}),
    });

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    return (
        <ModalOverlay onClose={onClose}>
            <h2 className="mb-4 text-base font-bold text-gray-900">
                {initial ? 'Grubu Düzenle' : 'Yeni Grup Oluştur'}
            </h2>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Grup Adı *</label>
            <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Örn: İçecek Tercihi"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />

            <label className="block text-xs font-semibold text-gray-600 mb-1">Açıklama</label>
            <input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Opsiyonel kısa açıklama"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Min Seçim</label>
                    <input
                        type="number" min={0}
                        value={form.min_selection}
                        onChange={(e) => set('min_selection', parseInt(e.target.value) || 0)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Max Seçim</label>
                    <input
                        type="number" min={1}
                        value={form.max_selection}
                        onChange={(e) => set('max_selection', parseInt(e.target.value) || 1)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                </div>
            </div>

            <label className="mb-4 flex cursor-pointer items-center gap-2 select-none">
                <input
                    type="checkbox"
                    checked={form.is_required}
                    onChange={(e) => set('is_required', e.target.checked)}
                    className="h-4 w-4 rounded accent-green-600"
                />
                <span className="text-sm text-gray-700">Bu grup zorunlu (müşteri seçim yapmak zorunda)</span>
            </label>

            <div className="flex gap-2 justify-end">
                <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">
                    İptal
                </button>
                <button
                    disabled={!form.name.trim() || saving}
                    onClick={() => onSave(form)}
                    className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
            </div>
        </ModalOverlay>
    );
}

// ─── ItemModal ────────────────────────────────────────────────────────────────
function ItemModal({ initial, onSave, onClose, saving, existingCount }) {
    const [form, setForm] = useState({
        ...EMPTY_ITEM,
        sort_order: existingCount,
        ...(initial ? {
            name: initial.name,
            price_adjustment: initial.price_adjustment,
            is_available: initial.is_available,
            sort_order: initial.sort_order,
        } : {}),
    });

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    return (
        <ModalOverlay onClose={onClose}>
            <h2 className="mb-4 text-base font-bold text-gray-900">
                {initial?.id ? 'Seçeneği Düzenle' : 'Yeni Seçenek Ekle'}
            </h2>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Seçenek Adı *</label>
            <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Örn: Coca-Cola 250ml"
                className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Ekstra Fiyat (₺)</label>
                    <input
                        type="number" min={0} step={0.5}
                        value={form.price_adjustment}
                        onChange={(e) => set('price_adjustment', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Sıra No</label>
                    <input
                        type="number" min={0}
                        value={form.sort_order}
                        onChange={(e) => set('sort_order', parseInt(e.target.value) || 0)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                </div>
            </div>

            <label className="mb-4 flex cursor-pointer items-center gap-2 select-none">
                <input
                    type="checkbox"
                    checked={form.is_available}
                    onChange={(e) => set('is_available', e.target.checked)}
                    className="h-4 w-4 rounded accent-green-600"
                />
                <span className="text-sm text-gray-700">Stokta mevcut</span>
            </label>

            <div className="flex gap-2 justify-end">
                <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">
                    İptal
                </button>
                <button
                    disabled={!form.name.trim() || saving}
                    onClick={() => onSave(form)}
                    className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
            </div>
        </ModalOverlay>
    );
}

// ─── ModalOverlay ─────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div ref={ref} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100"
                >
                    <X size={18} />
                </button>
                {children}
            </div>
        </div>
    );
}
