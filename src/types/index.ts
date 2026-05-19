// ─── Product ─────────────────────────────────────────────────────────────────

export interface GramajOption {
  name: string;
  price_modifier: number;
  calorie_modifier: number;
  protein_modifier: number;
  carbs_modifier: number;
  fats_modifier: number;
  is_default: boolean;
  display_order: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  desc?: string;
  img?: string;
  category?: string;
  slug?: string;
  type?: string;
  calories?: number;
  cal?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  in_stock?: boolean;
  is_available?: boolean;
  order?: number;
  is_favorite?: boolean;
  favorite_order?: number;
  discount_type?: 'percent' | 'fixed' | string | null;
  discount_value?: number | null;
  gramaj_options?: GramajOption[];
  // Bundle (çoklu ürün) ürünü mü — true ise makrolar seçilen
  // option_items'lardan runtime toplanır (YENİ uuid opsiyon sistemi).
  is_bundle?: boolean;
}

export interface OptionItem {
  id: string;
  groupId: string;
  name: string;
  priceAdjustment: number;
  sortOrder: number;
  isAvailable: boolean;
  // Bundle senaryosu: bu opsiyon gerçek bir ürünü temsil ediyorsa,
  // makrolar linked product'tan (yoksa option_items kolonlarından) gelir.
  // Tekli ürün opsiyonlarında undefined kalır, mevcut davranış korunur.
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  linkedProductId?: number | null;
}

export interface OptionGroup {
  id: string;
  name: string;
  description: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  sortOrder: number;
  items: OptionItem[];
}

// Bundle (çoklu ürün) sepet kalemindeki tek bir slot seçimi. Self-contained:
// isim + makro burada saklanır ki sipariş kaydından (order_items.selected_options)
// pantry'ye genişletme ekstra sorgu gerektirmesin.
export interface BundleSelection {
  slot_name: string; // "1. Öğün Seçimi"
  option_item_id: string; // option_items.id (uuid)
  linked_product_id: number | null;
  name: string; // "Basmati Üzeri Tavuk Fileto ve Brokoli"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ─── Option Templates (new reusable model) ───────────────────────────────────

export interface OptionTemplateValue {
  id: number;
  template_id: number;
  name: string;
  price_modifier: number;
  calorie_modifier: number;
  protein_modifier: number;
  carbs_modifier: number;
  fats_modifier: number;
  is_default: boolean;
  display_order: number;
}

export interface OptionTemplate {
  id: number;
  name: string;
  description?: string | null;
  selection_type: 'single' | 'multiple';
  is_required_default: boolean;
  min_selections: number;
  max_selections: number | null;
  values: OptionTemplateValue[];
}

export interface ProductOptionLink {
  id: number;
  product_id: number;
  template_id: number;
  is_required_override: boolean | null;
  min_selections_override: number | null;
  max_selections_override: number | null;
  display_order: number;
  template?: OptionTemplate;
  effective_required: boolean;
  effective_min: number;
  effective_max: number | null;
}

export interface SelectedOption {
  template_id: number;
  template_name: string;
  value_id: number;
  value_name: string;
  price_modifier: number;
  calorie_modifier: number;
  protein_modifier: number;
  carbs_modifier: number;
  fats_modifier: number;
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartSelectedOptions {
  byGroup: Record<string, string[]>;
  extraPrice: number;
  labels: string[];
  templateOptions?: SelectedOption[];
  // Bundle ürünlerde her slot için seçilen öğünler (FIX: bundle pantry akışı).
  bundleSelections?: BundleSelection[];
}

export interface CartItem {
  lineKey: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  discountType?: string | null;
  discountValue?: number | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  img?: string;
  selectedOptions: CartSelectedOptions;
  selected_options?: SelectedOption[];
  // Bundle parent kalemin slot kırılımı (boşsa normal ürün davranışı).
  bundle_selections?: BundleSelection[];
  // FIX 5 grup UI: bu kalem bir ana kalemin ekstrası ise, ana kalemin
  // lineKey'i. Doluysa CartScreen'de top-level değil, parent altında
  // indent child olarak render edilir; parent silinince cascade silinir.
  parentLineKey?: string;
  effective_calories?: number;
  effective_protein?: number;
  effective_carbs?: number;
  effective_fats?: number;
}

export interface CartMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface AppliedCoupon {
  code: string;
  campaignId: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  title?: string;
  campaign: {
    id?: string;
    code?: string;
    title?: string;
    discount_type?: string;
    discount_value?: number;
    max_discount?: number;
    min_cart_total?: number;
  };
}

export interface CartState {
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  addItem: (
    product: Product,
    options: Partial<CartSelectedOptions>,
    quantity?: number,
    parentLineKey?: string,
  ) => void;
  removeItem: (lineKey: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotalMacros: () => CartMacros;
  setCoupon: (coupon: AppliedCoupon) => void;
  clearCoupon: () => void;
  getDiscountAmount: (subtotal: number) => number;
}

// ─── Address ──────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  user_id?: string;
  title: string;
  // eski alan — geriye dönük uyumluluk için kalabilir
  contact_name: string;
  // yeni alanlar
  first_name?: string;
  last_name?: string;
  contact_phone: string;
  contact_email: string;
  full_address: string;
  city: string;
  district: string;
  neighbourhood: string | null;
  building_no?: string;
  floor?: string;
  apartment_no?: string;
  building_name?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Coupon ───────────────────────────────────────────────────────────────────

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  discountAmount: number;
  campaign: {
    id?: string;
    code?: string;
    title?: string;
    discount_type?: string;
    discount_value?: number;
    max_discount?: number;
    min_cart_total?: number;
    [key: string]: unknown;
  } | null;
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

export type DeliveryRuleStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      data: {
        district: string;
        neighbourhood: string | null;
        isActive: boolean;
        minOrder: number;
        allowImmediate: boolean;
        allowScheduled: boolean;
        // Full zone row (raw) so resolvers can access per-type override columns:
        //  - min_order_immediate / min_order_scheduled
        //  - delivery_fee_immediate / delivery_fee_scheduled
        //  - free_shipping_above_immediate / free_shipping_above_scheduled
        zoneRow?: Record<string, unknown> | null;
      };
    };
