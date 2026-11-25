import { describe, it, expect } from 'vitest'
import { validateProductCreate, validateStockAdjust, validateOrder } from './validation'

describe('validateProductCreate', () => {
  it('requires sku and name', () => {
    const errs = validateProductCreate({ sku: '', name: '', price: 10 })
    expect(errs.sku).toBeTruthy()
    expect(errs.name).toBeTruthy()
  })
  it('accepts valid input', () => {
    const errs = validateProductCreate({ sku: 'A', name: 'B', price: 0 })
    expect(Object.keys(errs)).toHaveLength(0)
  })
})

describe('validateStockAdjust', () => {
  it('rejects non-positive qty', () => {
    const errs = validateStockAdjust({ type: 'in', qty: 0 })
    expect(errs.qty).toBeTruthy()
  })
  it('rejects invalid type', () => {
    const errs = validateStockAdjust({ type: 'x', qty: 1 })
    expect(errs.type).toBeTruthy()
  })
})

describe('validateOrder', () => {
  it('rejects empty items', () => {
    const errs = validateOrder({ customer: 'C', items: [] })
    expect(errs.items).toBeTruthy()
  })
  it('rejects duplicate sku', () => {
    const errs = validateOrder({ customer: 'C', items: [{ sku: 'A', qty: 1 }, { sku: 'A', qty: 2 }] })
    expect(Object.keys(errs).some((k) => k.includes('sku'))).toBe(true)
  })
  it('accepts valid order', () => {
    const errs = validateOrder({ customer: 'C', items: [{ sku: 'A', qty: 1 }] })
    expect(Object.keys(errs)).toHaveLength(0)
  })
})
