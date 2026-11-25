
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiClientError } from '../api/client'
import type { Product } from '../types/api'
import { useDebounce } from '../hooks/useDebounce'
import { formatIDR, formatRelative, isLowStock } from '../lib/format'
import { AdjustStockModal } from '../features/products/AdjustStockModal'
import { ProductFormModal } from '../features/products/ProductFormModal'
import { MovementsModal } from '../features/products/MovementsModal'
import { CreateOrderModal } from '../features/orders/CreateOrderModal'
import { useToast } from '../components/Toast'
import { Button, EmptyState, ErrorState, Modal } from '../components/ui'

type Filter = 'all' | 'active' | 'inactive' | 'low'

export function ProductsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const debouncedSearch = useDebounce(search, 300)

  const rawFilter = searchParams.get('filter')
  const filter: Filter =
    rawFilter === 'active' ||
    rawFilter === 'inactive' ||
    rawFilter === 'low' ||
    rawFilter === 'all'
      ? (rawFilter as Filter)
      : 'all'

  const rawPage = Number(searchParams.get('page') || '1')
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const limit = 10
  const query = searchParams.get('q') || ''

  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summaryProducts, setSummaryProducts] = useState<Product[]>([])
  const [todaySales, setTodaySales] = useState<{
    count: number
    total: number
  } | null>(null)

  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null)
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmSku, setDeleteConfirmSku] = useState('')

  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [res, summary] = await Promise.all([
        api.listProducts(query, filter, page, limit),
        api.listProducts('', 'all', 1, 1000),
      ])

      setProducts(res.data)
      setTotal(res.total)
      setSummaryProducts(summary.data)

      try {
        const ds = await api.dailySales(
          new Date().toISOString().slice(0, 10)
        )

        setTodaySales({
          count: ds.order_count,
          total: ds.total_sales,
        })
      } catch {
        setTodaySales(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [query, filter, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const currentQ = prev.get('q') || ''
        if (debouncedSearch === currentQ) return prev

        const next = new URLSearchParams(prev)
        if (debouncedSearch) next.set('q', debouncedSearch)
        else next.delete('q')
        next.delete('page')
        return next
      },
      { replace: true }
    )
  }, [debouncedSearch, setSearchParams])

  useEffect(() => {
    const urlQ = searchParams.get('q') || ''
    if (urlQ !== search) setSearch(urlQ)
  }, [searchParams])

  const filtered = products

  const totalProducts = summaryProducts.length
  const activeProducts = summaryProducts.filter((p) => p.is_active).length
  const totalStockValue = summaryProducts.reduce(
    (sum, p) => sum + p.price * p.stock,
    0
  )
  const lowStockCount = summaryProducts.filter(
    (p) => isLowStock(p.stock)
  ).length

  const stats = [
    { label: 'Total products', value: totalProducts },
    { label: 'Active products', value: activeProducts },
    { label: 'Stock value', value: formatIDR(totalStockValue) },
    { label: 'Low stock', value: lowStockCount },
  ]

  const filters: { label: string; value: Filter }[] = [
    { label: 'All products', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Low stock', value: 'low' },
  ]

  const totalPages = Math.max(1, Math.ceil(total / limit))

  async function handleDeleteProduct() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteProduct(deleteTarget.id)
      toast('Product deleted', 'success')
      setDeleteTarget(null)
      void load()
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'PRODUCT_HAS_HISTORY') {
        setDeleteError('Cannot delete a product with movement history.')
      } else {
        setDeleteError(e instanceof Error ? e.message : 'Failed to delete product')
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Navigation */}
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="text-base font-bold tracking-tight">
            StockFlow
          </a>

          <nav className="flex items-center gap-5 text-sm">
            <a href="/" className="font-medium text-foreground">
              Products
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6">

        {/* Page heading */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Products
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your inventory and stock levels.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditingProduct(null)
                setProductFormOpen(true)
              }}
            >
              Add product
            </Button>
            <Button onClick={() => setCreateOrderOpen(true)}>
              Create order
            </Button>
          </div>
        </div>

        {/* Overview */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border bg-card p-4"
            >
              <p className="text-xs text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* Today's sales */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            Today's sales
          </p>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {todaySales
                ? `${todaySales.count} orders`
                : 'No sales data'}
            </span>
            <span className="font-semibold tabular-nums">
              {todaySales ? formatIDR(todaySales.total) : '—'}
            </span>
          </div>
        </div>

        {/* Products table */}
        <section className="overflow-hidden rounded-lg border bg-card">

          {/* Toolbar */}
          <div className="space-y-3 border-b p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>

                <input
                  className="input w-full pl-9"
                  placeholder="Search products by name or SKU..."
                  value={search}
                  onChange={(e) => {
                    const value = e.target.value
                    setSearch(value)

                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev)
                        next.delete('page')
                        return next
                      },
                      { replace: true }
                    )
                  }}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev)
                        if (item.value === 'all') next.delete('filter')
                        else next.set('filter', item.value)
                        return next
                      },
                      { replace: true }
                    )
                  }}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === item.value
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  {item.label}
                  {item.value === 'low' && (
                    <span className="ml-1.5 text-muted-foreground">
                      {lowStockCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="skeleton h-3 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4">
              <ErrorState message={error} onRetry={load} />
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState message="No products found" />
          )}

          {/* Table */}
          {!loading && !error && filtered.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Last movement</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <div className="font-medium">
                            {p.name}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {p.sku}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 tabular-nums">
                          {formatIDR(p.price)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className="font-medium tabular-nums">
                            {p.stock}
                          </span>
                          {isLowStock(p.stock) && (
                            <span className="ml-2 text-xs text-amber-600">
                              Low
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className={`text-xs font-medium ${
                            p.is_active
                              ? 'text-emerald-700'
                              : 'text-muted-foreground'
                          }`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                          {formatRelative(p.last_movement_at)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setAdjustProduct(p)}
                            >
                              Adjust stock
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMovementsProduct(p)}
                            >
                              History
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProduct(p)
                                setProductFormOpen(true)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDeleteError(null)
                                setDeleteConfirmSku('')
                                setDeleteTarget(p)
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {total === 0
                    ? 'No products'
                    : `${(page - 1) * limit + 1}–${Math.min(
                        page * limit,
                        total
                      )} of ${total} products`}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setSearchParams(
                        (prev) => {
                          const next = new URLSearchParams(prev)
                          const nextIndex = Math.max(1, page - 1)
                          if (nextIndex <= 1) next.delete('page')
                          else next.set('page', String(nextIndex))
                          return next
                        },
                        { replace: true }
                      )
                    }}
                  >
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => {
                      setSearchParams(
                        (prev) => {
                          const next = new URLSearchParams(prev)
                          next.set('page', String(page + 1))
                          return next
                        },
                        { replace: true }
                      )
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {/* Modals */}
      <ProductFormModal
        open={productFormOpen}
        product={editingProduct}
        onClose={() => {
          setProductFormOpen(false)
          setEditingProduct(null)
        }}
        onSaved={() => {
          setProductFormOpen(false)
          setEditingProduct(null)
          void load()
        }}
      />

      <Modal
        open={deleteTarget !== null}
        title="Delete product?"
        onClose={() => {
          setDeleteTarget(null)
          setDeleteError(null)
          setDeleteConfirmSku('')
        }}
        size="sm"
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Delete <span className="font-medium text-foreground">{deleteTarget.sku}</span>? This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="delete-confirm-sku" className="text-sm font-medium">
                Type the SKU to confirm
              </label>
              <input
                id="delete-confirm-sku"
                className="input"
                value={deleteConfirmSku}
                disabled={deleting}
                onChange={(e) => setDeleteConfirmSku(e.target.value)}
                placeholder={deleteTarget.sku}
              />
            </div>
            {deleteError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteError(null)
                  setDeleteConfirmSku('')
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProduct}
                disabled={deleting || deleteConfirmSku !== deleteTarget.sku}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <MovementsModal
        product={movementsProduct}
        open={movementsProduct !== null}
        onClose={() => setMovementsProduct(null)}
      />

      <AdjustStockModal
        product={adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onSaved={() => {
          setAdjustProduct(null)
          void load()
        }}
      />

      <CreateOrderModal
        open={createOrderOpen}
        onClose={() => setCreateOrderOpen(false)}
        onCreated={(id) => {
          setCreateOrderOpen(false)
          navigate(`/orders/${id}`)
        }}
      />
    </>
  )
}
