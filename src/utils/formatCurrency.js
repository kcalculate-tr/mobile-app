export function formatCurrency(value) {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `₺ ${safeAmount.toFixed(2)}`;
}

