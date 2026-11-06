// eatkcal v2 (G15-S5) — sipariş satırı/ürün fotoğrafı: ürün id → menü görseli.
// Kaynak: mevcut `fetchProducts` (herkese açık menü okuması, lib içinde önbellekli).
// Görsel yoksa satır fotoğrafsız çizilir (uydurma yok).
import { useEffect, useState } from 'react';
import { fetchProducts } from '../../../../../lib/products';
import { transformImageUrl, ImagePreset } from '../../../../../lib/imageUrl';

export function useProductImages(): (productId: string | null | undefined) => string | null {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    fetchProducts()
      .then((list) => {
        if (!alive) return;
        const next: Record<string, string> = {};
        for (const p of list ?? []) if (p?.img) next[String(p.id)] = p.img;
        setMap(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (id) => {
    const img = id ? map[id] : undefined;
    return img ? transformImageUrl(img, ImagePreset.productCard) ?? img : null;
  };
}
