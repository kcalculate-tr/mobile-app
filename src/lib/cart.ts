import { CartSelectedOptions } from '../types';

const toSafeString = (value: unknown) => String(value ?? '').trim();

const normalizeIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  return ids
    .map(toSafeString)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
};

export const normalizeSelectedOptions = (
  input?: Partial<CartSelectedOptions>,
): CartSelectedOptions => {
  const byGroupInput = input?.byGroup ?? {};
  const normalizedByGroup = Object.entries(byGroupInput)
    .map(([groupId, ids]) => [toSafeString(groupId), normalizeIds(ids)] as const)
    .filter(([groupId, ids]) => groupId && ids.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, string[]>>((acc, [groupId, ids]) => {
      acc[groupId] = ids;
      return acc;
    }, {});

  const extraPrice = Number(input?.extraPrice ?? 0);
  const labels = Array.isArray(input?.labels)
    ? input.labels.map(toSafeString).filter(Boolean)
    : [];

  return {
    byGroup: normalizedByGroup,
    extraPrice: Number.isFinite(extraPrice) ? Math.max(0, extraPrice) : 0,
    labels,
  };
};

const buildSelectionSignature = (byGroup: Record<string, string[]>) => {
  return Object.entries(byGroup)
    .filter(([groupId, ids]) => !groupId.startsWith('_') && ids.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupId, ids]) => `${groupId}:${ids.join(',')}`)
    .join('|');
};

export const buildCartLineKey = (
  productId: string,
  byGroup: Record<string, string[]>,
) => {
  const safeProductId = toSafeString(productId) || 'unknown';
  const signature = buildSelectionSignature(byGroup) || 'default';
  return `${safeProductId}__${signature}`;
};
