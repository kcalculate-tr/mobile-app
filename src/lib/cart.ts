import { CartSelectedOptions, SelectedOption } from '../types';

const toSafeString = (value: unknown) => String(value ?? '').trim();

const normalizeIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  return ids
    .map(toSafeString)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTemplateOptions = (
  options: unknown,
): SelectedOption[] | undefined => {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  const cleaned: SelectedOption[] = [];
  options.forEach((raw: any) => {
    if (!raw || typeof raw !== 'object') return;
    // Accept 0 as a legitimate id (virtual gramaj uses template_id: 0 and
    // value_id: 0..N as array index). Only reject when the field is absent
    // or non-numeric.
    if (raw.template_id == null || raw.value_id == null) return;
    const templateId = toFiniteNumber(raw.template_id, NaN);
    const valueId = toFiniteNumber(raw.value_id, NaN);
    if (!Number.isFinite(templateId) || !Number.isFinite(valueId)) return;
    cleaned.push({
      template_id: templateId,
      template_name: toSafeString(raw?.template_name),
      value_id: valueId,
      value_name: toSafeString(raw?.value_name),
      price_modifier: toFiniteNumber(raw?.price_modifier, 0),
      calorie_modifier: toFiniteNumber(raw?.calorie_modifier, 0),
      protein_modifier: toFiniteNumber(raw?.protein_modifier, 0),
      carbs_modifier: toFiniteNumber(raw?.carbs_modifier, 0),
      fats_modifier: toFiniteNumber(raw?.fats_modifier, 0),
    });
  });
  if (cleaned.length === 0) return undefined;
  cleaned.sort((a, b) => {
    if (a.template_id !== b.template_id) return a.template_id - b.template_id;
    return a.value_id - b.value_id;
  });
  return cleaned;
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

  const templateOptions = normalizeTemplateOptions(input?.templateOptions);

  const result: CartSelectedOptions = {
    byGroup: normalizedByGroup,
    extraPrice: Number.isFinite(extraPrice) ? Math.max(0, extraPrice) : 0,
    labels,
  };
  if (templateOptions) result.templateOptions = templateOptions;
  return result;
};

const buildSelectionSignature = (byGroup: Record<string, string[]>) => {
  return Object.entries(byGroup)
    .filter(([groupId, ids]) => !groupId.startsWith('_') && ids.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupId, ids]) => `${groupId}:${ids.join(',')}`)
    .join('|');
};

const buildTemplateOptionsSignature = (
  selectedOptions?: ReadonlyArray<SelectedOption> | null,
): string => {
  if (!selectedOptions || selectedOptions.length === 0) return '';
  const tokens = selectedOptions
    .map((opt) => `${Number(opt.template_id) || 0}:${Number(opt.value_id) || 0}`)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return tokens.length === 0 ? '' : `tpl[${tokens.join(',')}]`;
};

export const buildCartLineKey = (
  productId: string,
  byGroup: Record<string, string[]>,
  selectedOptions?: ReadonlyArray<SelectedOption> | null,
) => {
  const safeProductId = toSafeString(productId) || 'unknown';
  const groupSignature = buildSelectionSignature(byGroup);
  const tplSignature = buildTemplateOptionsSignature(selectedOptions);
  const parts = [groupSignature, tplSignature].filter(Boolean);
  const signature = parts.length === 0 ? 'default' : parts.join('|');
  return `${safeProductId}__${signature}`;
};
