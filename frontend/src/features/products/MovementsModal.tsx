import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Product, StockMovement } from '../../types/api'
import { Modal, Button, LoadingState, ErrorState, EmptyState } from '../../components/ui'

type Props = {
  product: Product | null
  open: boolean
  onClose: () => void
}

export function MovementsModal({ product, open, onClose }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!product) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getMovements(product.id)
      setMovements(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load movements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && product) {
      void load()
    } else {
      setMovements([])
      setError(null)
    }
  }, [open, product])

  return (
    <Modal open={open} title={`Movement history · ${product?.sku ?? ''}`} onClose={onClose} size="md">
      {product ? (
        <div className="space-y-4">
          {loading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} onRetry={load} /> : null}
          {!loading && !error && movements.length === 0 ? (
            <EmptyState message="No movement history yet" />
          ) : null}
          {!loading && !error && movements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Note</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-medium ${
                            m.type === 'in' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {m.type === 'in' ? 'Stock in' : 'Stock out'}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{m.qty}</td>
                      <td className="px-3 py-3 text-muted-foreground">{m.note || '-'}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="sticky bottom-0 z-10 -mx-1 bg-card pt-2">
            <div className="flex justify-end border-t pt-4">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}