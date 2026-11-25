
import { useEffect, useMemo, useState } from 'react'
import { api, ApiClientError } from '../../api/client'
import type { Product, SalesOrder } from '../../types/api'
import { validateOrder } from '../../lib/validation'
import { formatIDR } from '../../lib/format'
import { Modal, Button } from '../../components/ui'
import { useToast } from '../../components/Toast'

type ItemRow = {
  sku: string
  qty: string
  search: string
  open: boolean
}

const emptyItem = (): ItemRow => ({
  sku: '',
  qty: '1',
  search: '',
  open: false,
})

export function CreateOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const [customer, setCustomer] = useState('')
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [failedSku, setFailedSku] = useState<string | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    if (!open) return

    setCustomer('')
    setItems([emptyItem()])
    setErrors({})
    setServerError(null)
    setFailedSku(null)
    setAvailable(null)
    setProducts([])
    setLoadingProducts(true)

    api.listProducts('', 'all', 1, 1000)
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false))
  }, [open])

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      )
    )
  }

  function selectProduct(index: number, product: Product) {
    updateItem(index, {
      sku: product.sku,
      search: '',
      open: false,
    })

    setErrors((prev) => {
      const next = { ...prev }
      delete next[`items.${index}.sku`]
      return next
    })
  }

  function filteredProducts(query: string) {
    const q = query.trim().toLowerCase()

    return products
      .filter((p) =>
        !q ||
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }

  async function submit() {
    const parsedItems = items.map((item) => ({
      sku: item.sku,
      qty: Number(item.qty),
    }))

    const errs = validateOrder({ customer, items: parsedItems })

    setErrors(errs)
    setServerError(null)
    setFailedSku(null)
    setAvailable(null)

    if (Object.keys(errs).length > 0) return

    setSaving(true)

    try {
      const order: SalesOrder = await api.createOrder(
        { customer, items: parsedItems },
        crypto.randomUUID()
      )

      toast('Order created successfully', 'success')
      onCreated(order.id)
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === 'INSUFFICIENT_STOCK') {
          setFailedSku(e.sku ?? null)
          setAvailable(e.available ?? null)
          setServerError(
            `Insufficient stock for ${e.sku ?? ''}. Available: ${e.available ?? 0}`
          )
        } else if (e.code === 'VALIDATION_ERROR' && e.fields) {
          setErrors(e.fields)
          setServerError('Please check the highlighted fields.')
        } else {
          setServerError(e.message)
        }
      } else {
        setServerError(
          e instanceof Error ? e.message : 'Something went wrong.'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const totalQty = useMemo(
    () => items.reduce(
      (sum, item) => sum + (Number(item.qty) || 0),
      0
    ),
    [items]
  )

  const selectedCount = items.filter((item) => item.sku).length

  const orderTotal = useMemo(
    () => items.reduce((sum, item) => {
      const product = products.find((p) => p.sku === item.sku)
      const qty = Number(item.qty)

      return sum + (
        product && Number.isFinite(qty)
          ? product.price * qty
          : 0
      )
    }, 0),
    [items, products]
  )

  const hasOverStock = items.some((item) => {
    const product = products.find((p) => p.sku === item.sku)
    const qty = Number(item.qty)

    return product && Number.isFinite(qty) && qty > product.stock
  })

  return (
    <Modal
      open={open}
      title="Create order"
      onClose={onClose}
      size="lg"
    >
      <div className="flex max-h-[85vh] flex-col -mx-1">

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-1 pb-5">

          {/* Customer */}
          <section className="space-y-2">
            <label
              htmlFor="order-customer"
              className="text-sm font-medium"
            >
              Customer name
              <span className="ml-1 text-destructive">*</span>
            </label>

            <input
              id="order-customer"
              autoFocus
              disabled={saving}
              className={`input w-full ${
                errors.customer ? 'border-destructive' : ''
              }`}
              placeholder="Enter customer name"
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value)
                setErrors((prev) => {
                  const next = { ...prev }
                  delete next.customer
                  return next
                })
              }}
            />

            {errors.customer && (
              <p className="text-xs text-destructive">
                {errors.customer}
              </p>
            )}
          </section>

          {/* Products */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  Order items
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select products and specify quantities.
                </p>
              </div>

              <span className="text-xs text-muted-foreground">
                {selectedCount} of {items.length} selected
              </span>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const selected = products.find(
                  (p) => p.sku === item.sku
                )
                const list = filteredProducts(item.search)
                const skuError = errors[`items.${index}.sku`]
                const qtyError = errors[`items.${index}.qty`]
                const failed = failedSku === item.sku && !!failedSku

                const qty = Number(item.qty)
                const lineTotal =
                  selected && Number.isFinite(qty)
                    ? selected.price * qty
                    : 0

                const overStock =
                  selected && Number.isFinite(qty) &&
                  qty > selected.stock

                return (
                  <div
                    key={index}
                    className="rounded-lg border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Item {index + 1}
                      </span>

                      <button
                        type="button"
                        disabled={items.length === 1 || saving}
                        onClick={() => setItems((prev) =>
                          prev.length === 1
                            ? prev
                            : prev.filter((_, i) => i !== index)
                        )}
                        className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Product search */}
                    <div className="relative space-y-1.5">
                      <label className="text-xs font-medium">
                        Product
                      </label>

                      <input
                        className={`input w-full ${
                          skuError ? 'border-destructive' : ''
                        }`}
                        placeholder={
                          loadingProducts
                            ? 'Loading products...'
                            : 'Search product by name or SKU'
                        }
                        value={
                          item.sku && selected
                            ? `${selected.name} (${selected.sku})`
                            : item.search
                        }
                        disabled={loadingProducts || saving}
                        onFocus={() =>
                          updateItem(index, { open: true })
                        }
                        onChange={(e) =>
                          updateItem(index, {
                            sku: '',
                            search: e.target.value,
                            open: true,
                          })
                        }
                        onBlur={() => setTimeout(
                          () => updateItem(index, { open: false }),
                          150
                        )}
                      />

                      {item.open && !item.sku && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-card p-1 shadow-lg">
                          {list.length === 0 ? (
                            <p className="p-4 text-center text-xs text-muted-foreground">
                              No products found.
                            </p>
                          ) : (
                            list.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectProduct(index, product)}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {product.sku}
                                  </p>
                                </div>

                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-medium">
                                    {formatIDR(product.price)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Stock: {product.stock}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {skuError && (
                        <p className="text-xs text-destructive">
                          {skuError}
                        </p>
                      )}
                    </div>

                    {/* Selected product details */}
                    {selected && (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {formatIDR(selected.price)} / unit
                        </span>
                        <span>
                          {selected.stock} available
                        </span>
                      </div>
                    )}

                    {/* Quantity and subtotal */}
                    <div className="flex items-end justify-between gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`qty-${index}`}
                          className="text-xs font-medium"
                        >
                          Quantity
                        </label>

                        <div className="flex h-9 w-32 overflow-hidden rounded-md border">
                          <button
                            type="button"
                            disabled={saving}
                            className="w-9 hover:bg-muted disabled:opacity-40"
                            onClick={() => updateItem(index, {
                              qty: String(Math.max(
                                1,
                                (Number(item.qty) || 1) - 1
                              )),
                            })}
                          >
                            −
                          </button>

                          <input
                            id={`qty-${index}`}
                            inputMode="numeric"
                            disabled={saving}
                            className="w-full min-w-0 border-x bg-transparent text-center text-sm outline-none"
                            value={item.qty}
                            onChange={(e) => updateItem(index, {
                              qty: e.target.value,
                            })}
                          />

                          <button
                            type="button"
                            disabled={saving}
                            className="w-9 hover:bg-muted disabled:opacity-40"
                            onClick={() => updateItem(index, {
                              qty: String((Number(item.qty) || 0) + 1),
                            })}
                          >
                            +
                          </button>
                        </div>

                        {qtyError && (
                          <p className="text-xs text-destructive">
                            {qtyError}
                          </p>
                        )}

                        {overStock && (
                          <p className="text-xs text-destructive">
                            Exceeds available stock ({selected.stock}).
                          </p>
                        )}
                      </div>

                      {selected && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            Subtotal
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatIDR(lineTotal)}
                          </p>
                        </div>
                      )}
                    </div>

                    {failed && (
                      <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        Insufficient stock. Only {available ?? 0} units available.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {errors.items && (
              <p className="text-xs text-destructive">
                {errors.items}
              </p>
            )}

            <button
              type="button"
              disabled={saving || loadingProducts}
              onClick={() => {
                setItems((prev) => [
                  ...prev.map((item) => ({ ...item, open: false })),
                  emptyItem(),
                ])
              }}
              className="w-full rounded-lg border border-dashed py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
            >
              + Add product
            </button>
          </section>

          {/* Summary */}
          <section className="border-t pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Total items
              </span>
              <span>{selectedCount} products · {totalQty} units</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Estimated total
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {formatIDR(orderTotal)}
              </span>
            </div>
          </section>

          {/* Server error */}
          {serverError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                Unable to create order
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {serverError}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t bg-card px-1 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            onClick={submit}
            disabled={
              saving ||
              loadingProducts ||
              selectedCount === 0 ||
              hasOverStock
            }
          >
            {saving ? 'Creating...' : 'Create order'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
