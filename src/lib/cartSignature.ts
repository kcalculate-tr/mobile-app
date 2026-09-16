import type { CartItem } from '../types';

// Sepet "hash"i — bir ödeme taslağının oluşturulduğu andaki sepetle, ödeme
// başlamadan hemen önceki güncel sepeti karşılaştırmak için. Kasıtlı olarak
// bağımsız bir modül: hiçbir Supabase/React Native importu yok, birim
// testlerde yan etkisiz çalışır (bkz. src/lib/__tests__/cartSignature.test.ts).
//
// Yalnızca ürün adedi+ara toplam+kupon YETERSİZDİ: aynı fiyatlı iki farklı
// ürünün takasını (ör. ikisi de 450 TL) yakalamıyordu. Artık satır bazlı
// (product_id + seçili opsiyonlar + adet, sıralı) + teslimat bağlamı
// (adres/yöntem/tip/randevu) + kupon karşılaştırılıyor.

export type CartSignatureLine = {
  productId: string;
  optionsSignature: string;
  quantity: number;
};

export type CartSignatureContext = {
  couponCode?: string | null;
  addressId?: string | null;
  deliveryMethod?: string | null;
  deliveryType?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
};

// scheduled_time DB'den 'HH:MM:SS', istemciden 'HH:MM' gelebilir — ilk 5
// karaktere normalize edilmezse aynı randevu saati "değişmiş" görünürdü.
export const normalizeTime = (t: string | null | undefined): string | null =>
  t ? String(t).slice(0, 5) : null;

export const buildOptionsSignature = (options: unknown): string => {
  const list = Array.isArray(options) ? options : [];
  return list
    .map((o) => {
      const rec = (o ?? {}) as Record<string, unknown>;
      return `${rec.template_id ?? ''}:${rec.value_id ?? ''}`;
    })
    .sort()
    .join(',');
};

export const buildCartSignatureLines = (cartItems: CartItem[]): CartSignatureLine[] =>
  cartItems.map((item) => ({
    productId: String(item.productId),
    optionsSignature: buildOptionsSignature(item.selected_options),
    quantity: item.quantity,
  }));

export const computeCartSignature = (
  lines: CartSignatureLine[],
  ctx: CartSignatureContext,
): string => {
  const sortedLines = [...lines]
    .sort((a, b) => {
      const byProduct = a.productId.localeCompare(b.productId);
      return byProduct !== 0 ? byProduct : a.optionsSignature.localeCompare(b.optionsSignature);
    })
    .map((l) => `${l.productId}:${l.optionsSignature}:${l.quantity}`)
    .join(',');

  return [
    sortedLines,
    ctx.couponCode || 'none',
    ctx.addressId || 'none',
    ctx.deliveryMethod || 'none',
    ctx.deliveryType || 'none',
    ctx.scheduledDate || 'none',
    normalizeTime(ctx.scheduledTime) || 'none',
  ].join('|');
};
