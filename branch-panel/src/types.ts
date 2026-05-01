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
  created_at: string
  updated_at: string
  delivered_at?: string | null
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
