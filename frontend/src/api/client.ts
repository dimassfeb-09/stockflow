import type {
  AdjustStockInput,
  ApiError,
  CreateOrderInput,
  CreateProductInput,
  DailySalesResponse,
  ErrorEnvelope,
  ListProductsResponse,
  MovementsResponse,
  Product,
  SalesOrder,
  UpdateProductInput,
} from '../types/api'

const BASE = '/api'

export class ApiClientError extends Error {
  code: string
  status: number
  sku?: string
  available?: number
  fields?: Record<string, string>

  constructor(status: number, err: ApiError) {
    super(err.message)
    this.name = 'ApiClientError'
    this.code = err.code
    this.status = status
    this.sku = err.sku
    this.available = err.available
    this.fields = err.fields
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let envelope: ErrorEnvelope | null = null
    try {
      envelope = (await res.json()) as ErrorEnvelope
    } catch {
      envelope = null
    }
    if (envelope?.error) {
      throw new ApiClientError(res.status, envelope.error)
    }
    throw new ApiClientError(res.status, { code: 'HTTP_ERROR', message: `HTTP ${res.status}` })
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export const api = {
  listProducts(search: string, filter: string, page: number, limit: number): Promise<ListProductsResponse> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filter === 'active') params.set('status', 'active')
    else if (filter === 'inactive') params.set('status', 'inactive')
    else if (filter === 'low') params.set('low_stock', 'true')
    params.set('page', String(page))
    params.set('limit', String(limit))
    return request<ListProductsResponse>(`/products?${params.toString()}`)
  },

  createProduct(input: CreateProductInput): Promise<Product> {
    return request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },

  deleteProduct(id: number): Promise<void> {
    return request<void>(`/products/${id}`, { method: 'DELETE' })
  },

  adjustStock(id: number, input: AdjustStockInput): Promise<Product> {
    return request<Product>(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getMovements(id: number): Promise<MovementsResponse> {
    return request<MovementsResponse>(`/products/${id}/movements`)
  },

  createOrder(input: CreateOrderInput, idempotencyKey?: string): Promise<SalesOrder> {
    const headers: Record<string, string> = {}
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    return request<SalesOrder>('/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })
  },

  getOrder(id: number): Promise<SalesOrder> {
    return request<SalesOrder>(`/orders/${id}`)
  },

  cancelOrder(id: number): Promise<SalesOrder> {
    return request<SalesOrder>(`/orders/${id}/cancel`, { method: 'POST' })
  },

  dailySales(date?: string): Promise<DailySalesResponse> {
    const params = new URLSearchParams()
    if (date) params.set('date', date)
    const qs = params.toString()
    return request<DailySalesResponse>(`/reports/daily-sales${qs ? `?${qs}` : ''}`)
  },
}
