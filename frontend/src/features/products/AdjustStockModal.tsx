
import { useEffect, useState } from 'react'
import { api, ApiClientError } from '../../api/client'
import type { Product } from '../../types/api'
import { validateStockAdjust } from '../../lib/validation'
import { Modal, Button } from '../../components/ui'
import { useToast } from '../../components/Toast'

export function AdjustStockModal(props: {
  product: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const { product, onClose, onSaved } = props
  const open = product !== null

  const [type, setType] = useState<'in' | 'out'>('in')
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    if (!product) return

    setType('in')
    setQty('1')
    setNote('')
    setErrors({})
    setServerError(null)
    setAvailable(null)
  }, [product])

  const parsedQty = qty === '' ? NaN : Number(qty)
  const validQty =
    Number.isInteger(parsedQty) && parsedQty > 0 ? parsedQty : 0

  const validationErrors = validateStockAdjust({
    type,
    qty: parsedQty,
  })

  const projectedStock = product
    ? product.stock + (type === 'in' ? validQty : -validQty)
    : null

  const insufficientLocalStock =
    product !== null &&
    type === 'out' &&
    Number.isFinite(parsedQty) &&
    parsedQty > product.stock

  const canSubmit =
    Object.keys(validationErrors).length === 0 &&
    !saving &&
    !insufficientLocalStock

  function handleQtyChange(raw: string) {
    setQty(raw.replace(/[^0-9]/g, ''))
    setServerError(null)
  }

  function stepQty(delta: number) {
    const next = Math.max(1, validQty + delta)

    setQty(String(
      type === 'out' && product
        ? Math.min(product.stock, next)
        : next
    ))

    setServerError(null)
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!product) return

    const errs = validateStockAdjust({
      type,
      qty: parsedQty,
    })

    setErrors(errs)
    setServerError(null)
    setAvailable(null)

    if (Object.keys(errs).length > 0) return

    if (insufficientLocalStock) {
      setServerError('Quantity exceeds current available stock.')
      return
    }

    setSaving(true)

    try {
      await api.adjustStock(product.id, {
        type,
        qty: parsedQty,
        note: note.trim(),
      })

      toast('Stock adjusted successfully', 'success')
      onSaved()
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        err.code === 'INSUFFICIENT_STOCK'
      ) {
        const stock = err.available ?? 0
        setAvailable(stock)
        setServerError(
          `Insufficient stock. Only ${stock} units are available.`
        )
      } else {
        setServerError(
          err instanceof Error
            ? err.message
            : 'Failed to adjust stock.'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Adjust stock"
      onClose={onClose}
      size="sm"
    >
      {product && (
        <form onSubmit={submit} className="space-y-5">

          {/* Product */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {product.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {product.sku}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">
                Current stock
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {product.stock}
              </p>
            </div>
          </div>

          <div className="border-t" />

          {/* Adjustment type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Adjustment type
            </label>

            <div
              role="radiogroup"
              aria-label="Adjustment type"
              className="grid grid-cols-2 rounded-lg border p-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={type === 'in'}
                disabled={saving}
                onClick={() => {
                  setType('in')
                  setErrors({})
                  setServerError(null)
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  type === 'in'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                + Stock in
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={type === 'out'}
                disabled={saving}
                onClick={() => {
                  setType('out')
                  setErrors({})
                  setServerError(null)
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  type === 'out'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                − Stock out
              </button>
            </div>

            {errors.type && (
              <p className="text-xs text-destructive">
                {errors.type}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="adjust-qty"
                className="text-sm font-medium"
              >
                Quantity
              </label>

              {type === 'out' && (
                <span className="text-xs text-muted-foreground">
                  Available: {product.stock}
                </span>
              )}
            </div>

            <div className={`flex h-10 items-center rounded-lg border ${
              errors.qty || insufficientLocalStock
                ? 'border-destructive'
                : ''
            }`}>
              <button
                type="button"
                disabled={saving || validQty <= 1}
                onClick={() => stepQty(-1)}
                aria-label="Decrease quantity"
                className="h-full w-10 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                −
              </button>

              <input
                id="adjust-qty"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={saving}
                value={qty}
                onChange={(e) => handleQtyChange(e.target.value)}
                onBlur={() => {
                  if (!qty || Number(qty) < 1) {
                    setQty('1')
                  }
                }}
                className="h-full min-w-0 flex-1 border-x bg-transparent text-center text-sm font-semibold outline-none"
              />

              <button
                type="button"
                disabled={
                  saving ||
                  (type === 'out' && validQty >= product.stock)
                }
                onClick={() => stepQty(1)}
                aria-label="Increase quantity"
                className="h-full w-10 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                +
              </button>
            </div>

            {errors.qty && (
              <p className="text-xs text-destructive">
                {errors.qty}
              </p>
            )}

            {insufficientLocalStock && (
              <p className="text-xs text-destructive">
                Quantity exceeds available stock.
              </p>
            )}
          </div>

          {/* Stock preview */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">
              New stock
            </span>

            <span className={`text-sm font-semibold tabular-nums ${
              insufficientLocalStock
                ? 'text-destructive'
                : ''
            }`}>
              {projectedStock}
            </span>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="adjust-note"
                className="text-sm font-medium"
              >
                Note
              </label>

              <span className="text-xs text-muted-foreground">
                Optional
              </span>
            </div>

            <textarea
              id="adjust-note"
              rows={2}
              disabled={saving}
              className="input w-full resize-y rounded-lg px-3 py-2 text-sm"
              placeholder="Enter adjustment reason..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Error */}
          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"
            >
              {serverError}
              {available !== null && (
                <span> Available: {available} units.</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={!canSubmit}
            >
              {saving
                ? 'Saving...'
                : 'Save adjustment'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
