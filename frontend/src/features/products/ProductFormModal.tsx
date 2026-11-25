import { useEffect, useState } from 'react'
import { api, ApiClientError } from '../../api/client'
import type { Product } from '../../types/api'
import { validateProductCreate, validateProductUpdate } from '../../lib/validation'
import { Modal, Button } from '../../components/ui'
import { useToast } from '../../components/Toast'

type Props = {
  open: boolean
  product: Product | null
  onClose: () => void
  onSaved: () => void
}

export function ProductFormModal({ open, product, onClose, onSaved }: Props) {
  const isEdit = product !== null
  const { toast } = useToast()

  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (product) {
      setSku(product.sku)
      setName(product.name)
      setPrice(String(product.price))
      setIsActive(product.is_active)
    } else {
      setSku('')
      setName('')
      setPrice('')
      setIsActive(true)
    }
    setErrors({})
    setServerError(null)
  }, [open, product])

  async function submit() {
    const priceNum = Number(price)
    const errs = isEdit
      ? validateProductUpdate({ name, price: priceNum })
      : validateProductCreate({ sku, name, price: priceNum })
    setErrors(errs)
    setServerError(null)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      if (isEdit && product) {
        await api.updateProduct(product.id, {
          name: name.trim(),
          price: priceNum,
          is_active: isActive,
        })
        toast('Product updated', 'success')
      } else {
        await api.createProduct({
          sku: sku.trim(),
          name: name.trim(),
          price: priceNum,
        })
        toast('Product created', 'success')
      }
      onSaved()
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === 'VALIDATION_ERROR' && e.fields) {
          setErrors(e.fields)
          setServerError('Validation failed')
        } else if (e.code === 'SKU_EXISTS') {
          setErrors({ sku: 'SKU already exists' })
          setServerError('SKU already exists')
        } else {
          setServerError(e.message)
        }
      } else {
        setServerError(e instanceof Error ? e.message : 'Failed to save product')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit product' : 'Add product'} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="product-sku" className="text-sm font-medium">SKU</label>
          <input
            id="product-sku"
            className="input"
            autoFocus={!isEdit}
            value={sku}
            disabled={isEdit || saving}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU-001"
          />
          {errors.sku ? <p className="text-xs text-destructive">{errors.sku}</p> : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="product-name" className="text-sm font-medium">Name</label>
          <input
            id="product-name"
            className="input"
            autoFocus={isEdit}
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
          />
          {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="product-price" className="text-sm font-medium">Price (IDR)</label>
          <input
            id="product-price"
            className="input"
            inputMode="numeric"
            value={price}
            disabled={saving}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
          {errors.price ? <p className="text-xs text-destructive">{errors.price}</p> : null}
        </div>

        {isEdit ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isActive}
              disabled={saving}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        ) : null}

        {serverError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}