/**
 * Supabase Storage image transform helper.
 * Ham storage URL'lerine width/quality/resize parametreleri ekleyerek
 * bandwidth'i 5–10x düşürür (ör. 2.5 MB ham .webp → 80 KB ~400px card).
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 * URL dönüşümü: /storage/v1/object/public/...  →  /storage/v1/render/image/public/...?width=...&quality=...
 */

export type ImageTransform = {
  width?: number;
  height?: number;
  quality?: number; // 20-100, default 80
  resize?: 'cover' | 'contain' | 'fill';
};

// Her preset container aspect'iyle birebir uyumlu width+height+resize:'cover'
// ile server-side center-crop yaptırır. Böylece gelen bytes zaten container'a
// tam oturur ve expo-image'ın contentFit="cover" katmanı crop'u abartmaz.
// Piksel değerleri retina için container boyutunun ~2-3 katı seçildi.
export const ImagePreset = {
  // Ürün kartı container ~square
  productCard: { width: 400, height: 400, quality: 75, resize: 'cover' as const },
  // Ürün detay ana görsel (büyük, square)
  productDetail: { width: 800, height: 800, quality: 85, resize: 'cover' as const },
  // Kategori icon 64×64 container → 240×240 retina
  categoryIcon: { width: 240, height: 240, quality: 75, resize: 'cover' as const },
  // Hero banner 343×170 ≈ 2:1 container
  bannerLarge: { width: 1200, height: 600, quality: 80, resize: 'cover' as const },
  // Promo banner 155px height sabit, ~16:10 container
  bannerMedium: { width: 800, height: 500, quality: 80, resize: 'cover' as const },
  // Avatar
  avatarSmall: { width: 200, height: 200, quality: 75, resize: 'cover' as const },
  avatarLarge: { width: 600, height: 600, quality: 85, resize: 'cover' as const },
};

export function transformImageUrl(
  url: string | null | undefined,
  transform: ImageTransform,
): string | null {
  if (!url) return null;

  // Sadece Supabase Storage URL'lerini dönüştür — yabancı CDN URL'leri olduğu
  // gibi geçsin ki render endpoint hatası fırlatmayalım.
  if (!url.includes('/storage/v1/object/')) return url;

  const transformedUrl = url.replace(
    '/storage/v1/object/',
    '/storage/v1/render/image/',
  );

  const params = new URLSearchParams();
  if (transform.width) params.set('width', String(transform.width));
  if (transform.height) params.set('height', String(transform.height));
  if (transform.quality) params.set('quality', String(transform.quality));
  if (transform.resize) params.set('resize', transform.resize);

  const sep = transformedUrl.includes('?') ? '&' : '?';
  return `${transformedUrl}${sep}${params.toString()}`;
}
