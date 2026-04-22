import { getSupabaseClient } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeliveryType = 'immediate' | 'scheduled';

export interface DeliveryTypeDefaults {
  min_order: number;
  shipping_fee: number;
  free_shipping_above: number;
}

export interface DeliveryGlobals {
  immediate: DeliveryTypeDefaults;
  scheduled: DeliveryTypeDefaults;
}

/**
 * Shape of a row from the `delivery_zones` table as consumed by this module.
 * Only the fields we care about are declared; extra columns are tolerated.
 *
 * Per-type override columns are nullable — a `null` means "use global default".
 */
export interface DeliveryZoneRow {
  district?: string | null;
  neighborhood?: string | null;
  neighbourhood?: string | null;
  mahalle?: string | null;
  is_active?: boolean | null;
  // Legacy / shared
  min_order?: number | null;
  // Per-type overrides (nullable → fall back to globals)
  min_order_immediate?: number | null;
  min_order_scheduled?: number | null;
  delivery_fee_immediate?: number | null;
  delivery_fee_scheduled?: number | null;
  free_shipping_above_immediate?: number | null;
  free_shipping_above_scheduled?: number | null;
  allow_immediate?: boolean | null;
  allow_scheduled?: boolean | null;
  [key: string]: unknown;
}

// ─── Globals fetcher ─────────────────────────────────────────────────────────

/**
 * Reads the global delivery defaults from `delivery_settings` sentinel row
 * `district = '__GLOBAL__'`. Returns `null` if not configured.
 *
 * Expected shape of `cargo_rules`:
 * ```
 * {
 *   immediate: { min_order, shipping_fee, free_shipping_above },
 *   scheduled: { min_order, shipping_fee, free_shipping_above },
 * }
 * ```
 */
export async function fetchGlobalDeliverySettings(): Promise<DeliveryGlobals | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('delivery_settings')
      .select('cargo_rules')
      .eq('district', '__GLOBAL__')
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn('[delivery] fetchGlobalDeliverySettings error:', error.message);
      }
      return null;
    }
    if (!data?.cargo_rules) return null;

    const rules = data.cargo_rules as Record<string, unknown>;
    return {
      immediate: pickTypeDefaults(rules.immediate),
      scheduled: pickTypeDefaults(rules.scheduled),
    };
  } catch (e) {
    if (__DEV__) {
      console.warn('[delivery] fetchGlobalDeliverySettings threw:', e);
    }
    return null;
  }
}

function pickTypeDefaults(raw: unknown): DeliveryTypeDefaults {
  const m = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) || {};
  return {
    min_order: toNonNegativeNumber(m.min_order),
    shipping_fee: toNonNegativeNumber(m.shipping_fee),
    free_shipping_above: toNonNegativeNumber(m.free_shipping_above),
  };
}

function toNonNegativeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isMeaningfulOverride(v: unknown): boolean {
  if (v == null) return false; // null or undefined → not set
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

// ─── Resolvers ───────────────────────────────────────────────────────────────

/**
 * Resolves the effective minimum order amount.
 *
 * Fallback chain:
 *   1. Per-type override on the district row (`min_order_immediate`/`min_order_scheduled`)
 *   2. Global default for the delivery type
 *   3. Legacy `delivery_zones.min_order`
 *   4. `0`
 */
export function resolveMinOrder(
  districtRule: DeliveryZoneRow | null | undefined,
  globals: DeliveryGlobals | null | undefined,
  type: DeliveryType,
): number {
  const key = type === 'immediate' ? 'min_order_immediate' : 'min_order_scheduled';
  const override = districtRule?.[key];
  if (isMeaningfulOverride(override)) return Number(override);

  const globalVal = globals?.[type]?.min_order;
  if (isMeaningfulOverride(globalVal)) return Number(globalVal);

  const legacy = districtRule?.min_order;
  if (isMeaningfulOverride(legacy)) return Number(legacy);

  return 0;
}

/**
 * Resolves the effective shipping fee given the current subtotal. Returns 0
 * when the subtotal crosses the free-shipping threshold.
 *
 * Fee fallback chain:     district per-type → global per-type → 0
 * FreeAbove fallback:     district per-type → global per-type → Infinity
 */
export function resolveShippingFee(
  districtRule: DeliveryZoneRow | null | undefined,
  globals: DeliveryGlobals | null | undefined,
  type: DeliveryType,
  subtotal: number,
): number {
  const feeKey = type === 'immediate' ? 'delivery_fee_immediate' : 'delivery_fee_scheduled';
  const freeKey =
    type === 'immediate' ? 'free_shipping_above_immediate' : 'free_shipping_above_scheduled';

  const districtFee = districtRule?.[feeKey];
  const fee = districtFee != null
    ? Math.max(0, Number(districtFee) || 0)
    : Math.max(0, Number(globals?.[type]?.shipping_fee ?? 0) || 0);

  const districtFree = districtRule?.[freeKey];
  const freeAbove = districtFree != null
    ? Math.max(0, Number(districtFree) || 0)
    : (() => {
        const g = Number(globals?.[type]?.free_shipping_above ?? 0);
        return g > 0 ? g : Infinity;
      })();

  if (freeAbove > 0 && freeAbove !== Infinity && subtotal >= freeAbove) return 0;
  if (freeAbove === Infinity && fee === 0) return 0;
  return fee;
}

/**
 * Resolves the free-shipping threshold (0 = no threshold configured).
 * Same fallback chain as {@link resolveShippingFee} but without the subtotal.
 */
export function resolveFreeShippingAbove(
  districtRule: DeliveryZoneRow | null | undefined,
  globals: DeliveryGlobals | null | undefined,
  type: DeliveryType,
): number {
  const freeKey =
    type === 'immediate' ? 'free_shipping_above_immediate' : 'free_shipping_above_scheduled';
  const districtFree = districtRule?.[freeKey];
  if (districtFree != null) return Math.max(0, Number(districtFree) || 0);
  return Math.max(0, Number(globals?.[type]?.free_shipping_above ?? 0) || 0);
}
