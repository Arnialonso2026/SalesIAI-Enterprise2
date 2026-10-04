export interface User {
  id: number
  full_name: string
  email: string | null
  dni: string | null
  role: string
  company_id: number
  is_active: boolean
  password_configured: boolean
}

export interface Customer {
  id: number
  name: string
  email: string | null
  phone: string | null
  document_number: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
  description: string | null
}

export interface Product {
  id: number
  sku: string
  name: string
  description: string | null
  category_id: number | null
  price: number
  stock: number
  min_stock: number
  is_active: boolean
  category: Category | null
}

export interface SaleItem {
  id: number
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Payment {
  id: number
  amount: number
  method: string
  status: string
  paid_at: string
}

export interface Sale {
  id: number
  sale_number: string
  customer_id: number | null
  customer: Customer | null
  status: string
  subtotal: number
  discount: number
  tax: number
  total: number
  notes: string | null
  created_at: string
  items: SaleItem[]
  payments: Payment[]
}

export interface DashboardSummary {
  total_revenue: number
  month_revenue: number
  today_sales: number
  sales_count: number
  customers_count: number
  low_stock_count: number
  daily_sales: { date: string; total: number }[]
  recent_sales: { id: number; sale_number: string; total: number; status: string; created_at: string }[]
}

export interface InventoryMovement {
  id: number
  product_id: number
  sale_id: number | null
  movement_type: string
  quantity: number
  stock_after: number
  note: string | null
  created_at: string
}
