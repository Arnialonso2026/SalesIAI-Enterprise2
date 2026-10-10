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

export interface Branch {
  id: number
  company_id: number
  name: string
  address: string | null
  latitude: number
  longitude: number
  is_active: boolean
  created_at: string
}

export interface AuditLog {
  id: number
  company_id: number
  user_id: number | null
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: number | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditLogPage {
  items: AuditLog[]
  total: number
  limit: number
  offset: number
}

export interface LocationData {
  ip_address: string
  country: string
  region: string
  city: string
  latitude: number
  longitude: number
  postal_code: string | null
}

export interface IpRegistryEntry {
  ip_address: string
  last_seen: string
  action_count: number
  users: number[]
  user_agents: string[]
  country: string
  region: string
  city: string
  latitude: number | null
  longitude: number | null
}

export interface Document {
  id: number
  company_id: number
  uploaded_by_id: number | null
  title: string
  filename: string
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface Customer {
  id: number
  name: string
  email: string | null
  phone: string | null
  document_number: string | null
  address: string | null
  customer_type: 'individual' | 'business'
  contact_name: string | null
  industry: string | null
  preferred_contact_method: 'whatsapp' | 'phone' | 'email'
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface CustomerSalesSummary {
  customer_id: number
  sales_count: number
  total_spent: number
  average_ticket: number
  last_purchase_at: string | null
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

export interface PurchaseItem {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  quantity: number
  unit_cost: number
  line_total: number
}

export interface Purchase {
  id: number
  purchase_number: string
  supplier_name: string
  supplier_document_number: string | null
  supplier_address: string | null
  created_by_id: number | null
  created_by_name: string
  total: number
  notes: string | null
  created_at: string
  items: PurchaseItem[]
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

export interface SalesDocumentItem {
  id: number
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface SalesDocument {
  id: number
  sale_id: number
  document_type: 'boleta' | 'factura'
  document_number: string
  customer_name: string
  customer_document: string | null
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
  currency: string
  subtotal: number
  discount: number
  tax: number
  total: number
  issued_at: string
  items: SalesDocumentItem[]
}

export interface PaymentReceipt extends SalesDocument {
  sale_number: string
  sale_created_at: string
}

export interface SaleCreator {
  id: number
  full_name: string
  role: string
}

export interface Sale {
  id: number
  sale_number: string
  created_by_id: number | null
  created_by: SaleCreator | null
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
  document: SalesDocument | null
}

export interface Receivable {
  sale: Sale
  paid_amount: number
  balance: number
}

export interface DashboardSummary {
  total_revenue: number
  month_revenue: number
  previous_period_revenue: number
  month_revenue_change_percent: number | null
  today_sales: number
  sales_count: number
  customers_count: number
  low_stock_count: number
  daily_sales: { date: string; total: number; count?: number }[]
  recent_sales: { id: number; sale_number: string; total: number; status: string; created_at: string; created_by: string | null }[]
}

export interface InventoryMovement {
  id: number
  product_id: number
  sale_id: number | null
  purchase_id: number | null
  movement_type: string
  quantity: number
  stock_after: number
  note: string | null
  created_at: string
}

export interface AnalyticsDashboard {
  start_date: string
  end_date: string
  revenue: number
  previous_revenue: number
  revenue_change_percent: number | null
  sales_count: number
  average_ticket: number
  active_customers: number
  low_stock_products: number
  daily_sales: { date: string; total: number }[]
  top_products: { name: string; quantity: number; revenue: number }[]
  payment_methods: { method: string; amount: number }[]
  sales_by_seller: { user_id: number; seller_name: string; sales_count: number; revenue: number; average_ticket: number }[]
}

export interface StatisticalAnalysis {
  id: number
  name: string
  analysis_type: string
  created_at: string
  results: Record<string, number | number[] | null>
}

export interface StatisticalCalculation {
  id: number
  dataset_id: number
  name: string
  results: Record<string, number | number[] | null>
}

export interface LinearAnalysisCalculation {
  id: number
  dataset_id: number
  name: string
  variable_x: string
  variable_y: string
  results: {
    count: number
    covariance_population: number
    pearson_correlation: number | null
    linear_regression_slope: number | null
    linear_regression_intercept: number | null
    vector_dot_product: number
    vector_sum: number[]
    vector_difference: number[]
    vector_x_norm: number
    vector_y_norm: number
  }
}

export interface BayesianAnalysis {
  id: number
  name: string
  question: string
  prior_probability: number | null
  posterior_probability: number | null
  created_at: string
}

export interface InsightEvidence {
  description: string
  evidence: Record<string, unknown>
}

export interface Insight {
  id: number
  title: string
  description: string
  severity: 'info' | 'positive' | 'warning'
  status: 'new' | 'read' | 'dismissed'
  created_at: string
  evidence: InsightEvidence[]
}

export interface AnalyticsReport {
  id: number
  name: string
  report_type: string
  status: string
  parameters: Record<string, unknown>
  created_at: string
  generated_at: string | null
}
