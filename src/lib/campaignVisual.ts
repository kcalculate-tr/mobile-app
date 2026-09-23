import { Campaign } from './offers'

/**
 * Kampanya kartlarının ortak görsel mantığı.
 *
 * Kampanyaların çoğunda `image_url` yok. Görsel hazırlanana kadar ekranın boş
 * ya da çirkin görünmemesi için, marka renklerinden okunabilir bir gradyan
 * kart üretiliyor. Hem "Kampanyalar & Kuponlar" ekranı hem Macro sayfasındaki
 * kaydırmalı şerit buradan besleniyor ki iki yer birbirinden ayrışmasın.
 */

/** Kartın üzerindeki büyük indirim yazısı. */
export const indirimEtiketi = (c: Campaign): string => {
  if (c.discount_type === 'free_item') return 'ÜCRETSİZ\nÖĞÜN'
  if (c.discount_value == null) return c.title.toUpperCase()
  if (c.discount_type === 'percent') return `%${Number(c.discount_value)}\nİNDİRİM`
  return `${Number(c.discount_value)}₺\nİNDİRİM`
}

/** Görsel yoksa kullanılacak gradyan. */
export const gradyan = (c: Campaign): [string, string, string] => {
  if (c.color_from && c.color_to) {
    return [c.color_from, c.color_via ?? c.color_from, c.color_to]
  }
  if (c.source === 'macro_reward') return ['#0D0D0D', '#14260A', '#1F3D0C']
  if (c.discount_type === 'percent') return ['#0D0D0D', '#1A1A1A', '#2A2A2A']
  return ['#123F1E', '#1B5E2A', '#2E7D32']
}

/** Bitişe kaç gün kaldı — null ise bitiş tarihi yok. */
export const gunKaldi = (iso?: string | null): number | null => {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

export const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}
