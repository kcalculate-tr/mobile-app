import { getSupabaseClient } from './supabase';
import type { ProductOptionLink, OptionTemplate, OptionTemplateValue } from '../types';

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeValue = (row: any): OptionTemplateValue => ({
  id: toNumber(row?.id, 0),
  template_id: toNumber(row?.template_id, 0),
  name: String(row?.name ?? '').trim(),
  price_modifier: toNumber(row?.price_modifier, 0),
  calorie_modifier: toNumber(row?.calorie_modifier, 0),
  protein_modifier: toNumber(row?.protein_modifier, 0),
  carbs_modifier: toNumber(row?.carbs_modifier, 0),
  fats_modifier: toNumber(row?.fats_modifier, 0),
  is_default: Boolean(row?.is_default),
  display_order: toNumber(row?.display_order, 0),
});

export async function fetchProductOptionLinks(productId: number | string): Promise<ProductOptionLink[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('product_option_links')
    .select(`
      id, product_id, template_id, is_required_override,
      min_selections_override, max_selections_override, display_order,
      template:product_option_templates (
        id, name, description, selection_type,
        is_required_default, min_selections, max_selections, is_active,
        values:product_option_template_values (
          id, template_id, name, price_modifier,
          calorie_modifier, protein_modifier, carbs_modifier, fats_modifier,
          is_default, display_order, is_active
        )
      )
    `)
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[productOptions] fetch failed', error);
    return [];
  }

  return (Array.isArray(data) ? data : [])
    .map((rawLink: any) => {
      const rawTpl = Array.isArray(rawLink?.template) ? rawLink.template[0] : rawLink?.template;
      if (!rawTpl || rawTpl.is_active === false) return null;

      const activeValues = (Array.isArray(rawTpl.values) ? rawTpl.values : [])
        .filter((v: any) => v?.is_active !== false)
        .map(normalizeValue)
        .sort((a: OptionTemplateValue, b: OptionTemplateValue) => a.display_order - b.display_order);

      const template: OptionTemplate = {
        id: toNumber(rawTpl.id, 0),
        name: String(rawTpl.name ?? '').trim(),
        description: rawTpl.description ?? null,
        selection_type: rawTpl.selection_type === 'multiple' ? 'multiple' : 'single',
        is_required_default: Boolean(rawTpl.is_required_default),
        min_selections: toNumber(rawTpl.min_selections, 0),
        max_selections: rawTpl.max_selections == null ? null : toNumber(rawTpl.max_selections, 0),
        values: activeValues,
      };

      const isRequiredOverride =
        rawLink.is_required_override == null ? null : Boolean(rawLink.is_required_override);
      const minOverride =
        rawLink.min_selections_override == null ? null : toNumber(rawLink.min_selections_override, 0);
      const maxOverride =
        rawLink.max_selections_override == null ? null : toNumber(rawLink.max_selections_override, 0);

      const link: ProductOptionLink = {
        id: toNumber(rawLink.id, 0),
        product_id: toNumber(rawLink.product_id, 0),
        template_id: toNumber(rawLink.template_id, 0),
        is_required_override: isRequiredOverride,
        min_selections_override: minOverride,
        max_selections_override: maxOverride,
        display_order: toNumber(rawLink.display_order, 0),
        template,
        effective_required: isRequiredOverride ?? template.is_required_default,
        effective_min: minOverride ?? template.min_selections,
        effective_max: maxOverride ?? template.max_selections,
      };
      return link;
    })
    .filter((l): l is ProductOptionLink => l !== null);
}
