/**
 * ProductContext
 * ──────────────
 * Ürün, kategori ve banner verilerini uygulamanın en tepesinde (App.jsx) tek
 * bir kez çeker ve tüm sayfalara dağıtır.
 *
 * Neden önemli:
 *  - Ana sayfa → ürün detay → geri gelince liste sıfırdan yüklenmez.
 *  - isMounted + AbortController ile unmount sonrası state güncellenmez (memory leak yok).
 *  - 3 deneme + 1 s bekleme ile ağ kararsızlığına dayanıklı.
 *  - Realtime Supabase kanalları da buradan yönetilir.
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { supabase } from '../supabase';

// ── Sabitler ─────────────────────────────────────────────────────────────────
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;
const IS_DEBUG = import.meta.env.DEV || Boolean(localStorage.getItem('debugMode'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Dev yardımcıları ─────────────────────────────────────────────────────────
const devLog = (...args) => {
    if (import.meta.env.DEV) console.log('[ProductCtx]', ...args);
};
const devError = (...args) => {
    if (import.meta.env.DEV) console.error('[ProductCtx]', ...args);
};

// ── Veri normalleştirici ─────────────────────────────────────────────────────
export const normalizeProductRow = (row) => ({
    ...row,
    desc: row.desc ?? row.description,
    name: row.name || row.title,
    img: row.img || row.image,
    cal: Number(row.cal ?? row.kcal ?? row.calories ?? 0),
    protein: Number(row.protein ?? 0),
    isAvailable: !(
        row?.in_stock === false ||
        row?.is_available === false ||
        row?.is_active === false
    ),
});

export const isMealProduct = (row) => row?.type !== 'package';

export const sortByProductOrder = (a, b) => {
    const orderA = Number(a?.order ?? a?.sort_order);
    const orderB = Number(b?.order ?? b?.sort_order);
    const normA = Number.isFinite(orderA) ? orderA : Number.MAX_SAFE_INTEGER;
    const normB = Number.isFinite(orderB) ? orderB : Number.MAX_SAFE_INTEGER;
    if (normA !== normB) return normA - normB;
    const idA = Number(a?.id);
    const idB = Number(b?.id);
    if (Number.isFinite(idA) && Number.isFinite(idB)) return idB - idA;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr');
};

export const sortByFavoriteOrder = (a, b) => {
    const oA = Number(a?.favorite_order ?? a?.featured_order);
    const oB = Number(b?.favorite_order ?? b?.featured_order);
    const hA = Number.isFinite(oA);
    const hB = Number.isFinite(oB);
    if (hA && hB && oA !== oB) return oA - oB;
    if (hA && !hB) return -1;
    if (!hA && hB) return 1;
    return sortByProductOrder(a, b);
};

// ── Debug Overlay ─────────────────────────────────────────────────────────────
// App seviyesinde render edildiği için sayfa geçişlerinden etkilenmez.
const DebugOverlay = React.memo(function DebugOverlay({ logs }) {
    if (!IS_DEBUG || logs.length === 0) return null;
    return (
        <div
            className="fixed bottom-0 left-0 z-[9999] w-full max-h-40 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.82)', pointerEvents: 'none' }}
        >
            <div className="px-3 py-2 space-y-0.5">
                {logs.map((entry, i) => (
                    <p
                        key={i}
                        className="m-0 font-mono text-[10px] leading-tight"
                        style={{ color: entry.isError ? '#ff6b6b' : '#a3e635' }}
                    >
                        {`[${entry.time}] ${entry.msg}`}
                    </p>
                ))}
            </div>
        </div>
    );
});

// ── Context ───────────────────────────────────────────────────────────────────
export const ProductContext = createContext(null);

export function useProducts() {
    const ctx = useContext(ProductContext);
    if (!ctx) throw new Error('useProducts, ProductProvider dışında kullanılamaz.');
    return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [favoriteProducts, setFavoriteProducts] = useState([]);
    const [categoryRows, setCategoryRows] = useState([]);
    const [banners, setBanners] = useState([]);
    const [bannersLoading, setBannersLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [debugLogs, setDebugLogs] = useState([]);

    // ── Debug log pusher ──────────────────────────────────────────────────────
    const pushDebugLog = useCallback((msg, isError = false) => {
        if (!IS_DEBUG) return;
        const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
        setDebugLogs((prev) => [...prev.slice(-29), { time, msg, isError }]);
    }, []);

    // ── fetchProducts — retry destekli, abort destekli ───────────────────────
    const fetchProducts = useCallback(async (signal) => {
        pushDebugLog('fetchProducts başlatıldı...');
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
            if (signal?.aborted) return;

            try {
                pushDebugLog(`Deneme ${attempt}/${MAX_FETCH_ATTEMPTS}...`);

                const { data, error: queryError } = await supabase
                    .from('products')
                    .select('*');

                if (signal?.aborted) return;

                if (queryError) {
                    pushDebugLog(`Supabase hatası: ${queryError.message} (${queryError.code})`, true);
                    throw queryError;
                }

                const rawRows = Array.isArray(data) ? data : [];
                pushDebugLog(`Ham satır: ${rawRows.length}`);

                if (rawRows.length === 0) {
                    pushDebugLog('Tablo boş / RLS kısıtlı — hata değil.');
                    setProducts([]);
                    setFavoriteProducts([]);
                    return;
                }

                const rows = rawRows
                    .filter(isMealProduct)
                    .filter((row) => row?.in_stock !== false && row?.is_active !== false)
                    .map(normalizeProductRow)
                    .sort(sortByProductOrder);

                pushDebugLog(`Başarılı: ${rows.length} ürün yüklendi`);
                devLog('Ürünler yüklendi:', rows.length);

                setProducts(rows);
                setFavoriteProducts(
                    rows
                        .filter((r) => r?.is_favorite === true || r?.is_featured === true)
                        .sort(sortByFavoriteOrder)
                        .slice(0, 8)
                );
                setError(null);
                return; // başarı — döngüden çık

            } catch (err) {
                if (signal?.aborted) return;
                lastError = err;
                pushDebugLog(`Deneme ${attempt} başarısız: ${err?.message}`, true);
                console.error(
                    `%c ProductContext: ürün hatası (deneme ${attempt}) `,
                    'background:#ff0000;color:#fff;font-weight:bold',
                    err
                );

                if (attempt < MAX_FETCH_ATTEMPTS) {
                    pushDebugLog(`${RETRY_DELAY_MS / 1000}s bekleniyor...`);
                    await sleep(RETRY_DELAY_MS);
                }
            }
        }

        if (!signal?.aborted) {
            pushDebugLog(`Tüm denemeler başarısız: ${lastError?.message}`, true);
            setProducts([]);
            setFavoriteProducts([]);
            setError('Bağlantı hatası. Lütfen tekrar deneyin.');
        }
    }, [pushDebugLog]);

    // ── Products effect — isMounted + AbortController ─────────────────────────
    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;

        setLoading(true);
        fetchProducts(controller.signal).finally(() => {
            if (isMounted) setLoading(false);
        });

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [fetchProducts]);

    // ── Realtime: products tablosu değişince yeniden çek ─────────────────────
    useEffect(() => {
        let isMounted = true;

        const channel = supabase
            .channel('pc-products-stream')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                if (!isMounted) return;
                fetchProducts(null);
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [fetchProducts]);

    // ── Categories — isMounted guard ─────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        async function fetchCategories() {
            try {
                let response = await supabase
                    .from('categories')
                    .select('id,name,order')
                    .order('order', { ascending: true });

                if (response.error) {
                    response = await supabase
                        .from('categories')
                        .select('id,name')
                        .order('id', { ascending: true });
                }

                if (!isMounted) return;

                if (response.error) {
                    devError('Kategoriler alınamadı:', response.error);
                    setCategoryRows([]);
                    return;
                }

                setCategoryRows(
                    (Array.isArray(response.data) ? response.data : []).filter(
                        (row) => String(row?.name || '').trim()
                    )
                );
            } catch (err) {
                if (!isMounted) return;
                devError('Kategoriler alınamadı:', err);
                setCategoryRows([]);
            }
        }

        fetchCategories();

        const channel = supabase
            .channel('pc-categories-stream')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                if (!isMounted) return;
                fetchCategories();
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    // ── Banners — isMounted guard ─────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;
        setBannersLoading(true);

        async function fetchBanners() {
            try {
                const { data, error: queryError } = await supabase
                    .from('banners')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!isMounted) return;

                if (queryError) {
                    devError('Bannerlar alınamadı:', queryError);
                    setBanners([]);
                } else {
                    setBanners(Array.isArray(data) && data.length > 0 ? data : []);
                }
            } catch (err) {
                if (!isMounted) return;
                devError('Bannerlar alınamadı:', err);
                setBanners([]);
            } finally {
                if (isMounted) setBannersLoading(false);
            }
        }

        fetchBanners();

        return () => {
            isMounted = false;
        };
    }, []);

    const refetchProducts = useCallback(() => fetchProducts(null), [fetchProducts]);

    const value = useMemo(() => ({
        products,
        favoriteProducts,
        categoryRows,
        banners,
        bannersLoading,
        loading,
        error,
        refetchProducts,
    }), [products, favoriteProducts, categoryRows, banners, bannersLoading, loading, error, refetchProducts]);

    return (
        <ProductContext.Provider value={value}>
            {children}
            {/* Debug overlay: App seviyesinde — sayfa geçişlerinde kaybolmaz */}
            <DebugOverlay logs={debugLogs} />
        </ProductContext.Provider>
    );
}
