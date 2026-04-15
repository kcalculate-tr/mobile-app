// ─── Product ─────────────────────────────────────────────────────────────────

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
}

export interface OptionItem {
  id: string;
  groupId: string;
  name: string;
  priceAdjustment: number;
  sortOrder: number;
  isAvailable: boolean;
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

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartSelectedOptions {
  byGroup: Record<string, string[]>;
  extraPrice: number;
  labels: string[];
}

export interface CartItem {
  lineKey: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  img?: string;
  selectedOptions: CartSelectedOptions;
}

export interface CartMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface CartState {
  items: CartItem[];
  addItem: (product: Product, options: Partial<CartSelectedOptions>, quantity?: number) => void;
  removeItem: (lineKey: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotalMacros: () => CartMacros;
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
      };
    };
