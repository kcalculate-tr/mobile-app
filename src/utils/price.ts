type DiscountType = string | null | undefined;

type DiscountSource = {
  price?: number;
  discount_type?: string | null;
  discount_value?: number | null;
};

export function calculateDiscountedPrice(
  price: number,
  discountType: DiscountType,
  discountValue: number | null | undefined,
): number {
  const basePrice = Number(price) || 0;
  const value = Number(discountValue);
  if (!discountType || !Number.isFinite(value) || value <= 0) return basePrice;
  if (discountType === 'percent') {
    return Math.max(0, basePrice * (1 - value / 100));
  }
  if (discountType === 'fixed') {
    return Math.max(0, basePrice - value);
  }
  return basePrice;
}

export function hasDiscount(product: DiscountSource | null | undefined): boolean {
  if (!product) return false;
  const value = Number(product.discount_value);
  return Boolean(product.discount_type) && Number.isFinite(value) && value > 0;
}

export function getEffectivePrice(product: DiscountSource | null | undefined): number {
  if (!product) return 0;
  return calculateDiscountedPrice(
    Number(product.price) || 0,
    product.discount_type ?? null,
    product.discount_value ?? null,
  );
}

export function formatDiscountBadge(
  discountType: DiscountType,
  discountValue: number | null | undefined,
): string | null {
  const value = Number(discountValue);
  if (!discountType || !Number.isFinite(value) || value <= 0) return null;
  if (discountType === 'percent') return `-%${value}`;
  if (discountType === 'fixed') return `-₺${value}`;
  return null;
}

type OptionPriceLike = { price_modifier?: number | null };

export function calculateOptionsPriceModifier(
  selectedOptions: ReadonlyArray<OptionPriceLike> | null | undefined,
): number {
  if (!selectedOptions || selectedOptions.length === 0) return 0;
  return selectedOptions.reduce((sum, opt) => sum + (Number(opt?.price_modifier) || 0), 0);
}

export function getProductPriceWithOptions(
  product: DiscountSource | null | undefined,
  selectedOptions: ReadonlyArray<OptionPriceLike> | null | undefined,
): number {
  const baseEffective = getEffectivePrice(product);
  const optionsMod = calculateOptionsPriceModifier(selectedOptions);
  return Math.max(0, baseEffective + optionsMod);
}
