export interface Branch {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface BranchUser {
  id: string
  user_id: string
  branch_id: string
  role: 'manager' | 'staff' | 'kitchen'
}

export interface Order {
  id: string
  branch_id: string | null
  order_code?: string | null
  // real column name in DB
  paytr_oid: string | null
  payment_status?: 'paid' | 'pending' | 'failed' | 'refunded' | null
  status: 'pending' | 'preparing' | 'on_way' | 'delivered' | 'cancelled' | 'confirmed' | 'refunded'
  total_price: number
  items: OrderItem[]
  customer_name: string | null
  phone: string | null
  customer_note?: string | null
  note?: string | null
  is_privileged?: boolean
  delivery_type?: string | null
  delivery_time_type?: string | null
  scheduled_date?: string | null
  scheduled_time?: string
  address?: string | null
  address_id?: string | null
  // addresses tablosundan JOIN sonucu (orders.address_id FK ile bağlı)
  address_record?: {
    id: string
    title?: string | null
    full_address?: string | null
    neighbourhood?: string | null
    district?: string | null
    city?: string | null
    street?: string | null
    building_no?: string | null
    floor?: string | null
    apartment_no?: string | null
    building_name?: string | null
    contact_name?: string | null
    contact_phone?: string | null
  } | null
  created_at: string
  updated_at: string
  delivered_at?: string | null
}

export interface SelectedOptionSnapshot {
  template_id: number
  template_name: string
  value_id: number
  value_name: string
  price_modifier?: number
  calorie_modifier?: number
  protein_modifier?: number
  carbs_modifier?: number
  fats_modifier?: number
}

export interface OrderItem {
  id?: string
  product_id?: string
  // real column name from mobile app
  name: string
  quantity: number
  unitPrice?: number
  unit_price?: number
  selectedOptions?: { labels?: string[] }
  options?: string[]
  selected_options?: SelectedOptionSnapshot[]
}

export interface Product {
  id: number
  name: string
  price: number
  is_available: boolean
  in_stock: boolean
  img?: string | null
  cal?: number | null
  category?: string | null
}
