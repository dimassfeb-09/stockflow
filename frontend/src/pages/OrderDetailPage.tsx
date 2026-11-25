import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, ApiClientError } from '../api/client'
import type { SalesOrder } from '../types/api'
import { formatIDR } from '../lib/format'
import { Modal, Button, LoadingState, ErrorState, EmptyState } from '../components/ui'

export function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const orderId = Number(id)

  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const o = await api.getOrder(orderId)
      setOrder(o)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [orderId])

  async function cancel() {
    if (!order) return
    setCancelling(true)
    try {
      const updated = await api.cancelOrder(order.id)
      setOrder(updated)
      setConfirmCancel(false)
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : 'Failed')
      }
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!order) return <EmptyState message="Order not found" />

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <a className="text-lg font-bold" href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>StockFlow</a>
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <a className="hover:text-foreground" href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>Products</a>
            <span>/ Order {order.id}</span>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="card p-6">
          <h2 className="mb-4 text-xl font-semibold">Order #{order.id}</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Customer</dt><dd className="font-medium">{order.customer}</dd></div>
            <div><dt className="text-muted-foreground">Status</dt><dd className="font-medium">{order.status}</dd></div>
            <div><dt className="text-muted-foreground">Total</dt><dd className="font-medium">{formatIDR(order.total)}</dd></div>
            <div><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{new Date(order.created_at).toLocaleString()}</dd></div>
            {order.cancelled_at ? (
              <div><dt className="text-muted-foreground">Cancelled</dt><dd className="font-medium">{new Date(order.cancelled_at).toLocaleString()}</dd></div>
            ) : null}
          </dl>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">SKU</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Unit price</th>
                  <th className="px-3 py-2 font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-b">
                    <td className="px-3 py-3 font-medium">{it.sku}</td>
                    <td className="px-3 py-3">{it.qty}</td>
                    <td className="px-3 py-3">{formatIDR(it.unit_price)}</td>
                    <td className="px-3 py-3">{formatIDR(it.unit_price * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {order.status === 'CREATED' ? (
            <div className="mt-4">
              <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                Cancel order
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Modal open={confirmCancel} title="Cancel order?" onClose={() => setConfirmCancel(false)}>
        <p className="text-sm text-muted-foreground">Stock will be restored. Continue?</p>
        <div className="mt-4 flex gap-2">
          <Button variant="destructive" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Confirm cancel'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
            Keep order
          </Button>
        </div>
      </Modal>
    </>
  )
}