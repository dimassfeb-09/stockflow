export function validateProductCreate(input: { sku: string; name: string; price: number }): Record<string, string> {
  const fields: Record<string, string> = {}
  if (!input.sku.trim()) fields.sku = 'SKU is required'
  if (!input.name.trim()) fields.name = 'Name is required'
  if (!Number.isInteger(input.price) || input.price < 0) fields.price = 'Price must be >= 0 integer'
  return fields
}

export function validateProductUpdate(input: { name: string; price: number }): Record<string, string> {
  const fields: Record<string, string> = {}
  if (!input.name.trim()) fields.name = 'Name is required'
  if (!Number.isInteger(input.price) || input.price < 0) fields.price = 'Price must be >= 0 integer'
  return fields
}

export function validateStockAdjust(input: { type: string; qty: number }): Record<string, string> {
  const fields: Record<string, string> = {}
  if (input.type !== 'in' && input.type !== 'out') fields.type = 'Type must be in or out'
  if (!Number.isInteger(input.qty) || input.qty <= 0) fields.qty = 'Qty must be integer > 0'
  return fields
}

export function validateOrder(input: { customer: string; items: { sku: string; qty: number }[] }): Record<string, string> {
  const fields: Record<string, string> = {}
  if (!input.customer.trim()) fields.customer = 'Customer is required'
  if (input.items.length === 0) fields.items = 'At least one item is required'
  const seen = new Set<string>()
  input.items.forEach((it, i) => {
    if (!it.sku.trim()) fields[`items.${i}.sku`] = 'SKU is required'
    if (!Number.isInteger(it.qty) || it.qty <= 0) fields[`items.${i}.qty`] = 'Qty must be integer > 0'
    if (it.sku && seen.has(it.sku)) fields[`items.${i}.sku`] = 'Duplicate SKU in order'
    seen.add(it.sku)
  })
  return fields
}
