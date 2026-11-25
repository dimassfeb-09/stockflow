export type Product = {
  id: number
  sku: string
  name: string
  price: number
  stock: number
  is_active: boolean
  created_at: string
  last_movement_at: string | null
}

export type StockMovement = {
  id: number
  product_id: number
  type: 'in' | 'out'
  qty: number
  note: string
  created_at: string
}

export type SalesOrderItem = {
  id: number
  order_id: number
  sku: string
  qty: number
  unit_price: number
}

export type SalesOrder = {
  id: number
  customer: string
  status: 'CREATED' | 'CANCELLED'
  total: number
  created_at: string
  cancelled_at: string | null
  items: SalesOrderItem[]
}

export type ListProductsResponse = {
  data: Product[]
  page: number
  limit: number
  total: number
}

export type MovementsResponse = {
  data: StockMovement[]
}

export type ApiError = {
  code: string
  message: string
  sku?: string
  available?: number
  fields?: Record<string, string>
}

export type ErrorEnvelope = {
  error: ApiError
}

export type CreateProductInput = {
  sku: string
  name: string
  price: number
}

export type UpdateProductInput = {
  name: string
  price: number
  is_active: boolean
}

export type AdjustStockInput = {
  type: 'in' | 'out'
  qty: number
  note: string
}

export type CreateOrderInput = {
  customer: string
  items: { sku: string; qty: number }[]
}

export type DailySalesResponse = {
  date: string
  order_count: number
  total_sales: number
}
