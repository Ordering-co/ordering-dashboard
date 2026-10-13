import { describe, expect, it } from 'vitest'
import { describeRecordChange, isChangeApplied } from '../records'

// Route params of the 9 writes, as in apiv4 docs/clasificacion-capas.csv
const WRITES = [
  ['Business.update', { business: 3 }, 3, { business_id: 3 }],
  ['Category.update', { business_id: 3, category_id: 11 }, 11, { business_id: 3, category_id: 11 }],
  ['Product.update', { business_id: 3, category_id: 11, product_id: 220 }, 220, { business_id: 3, category_id: 11, product_id: 220 }],
  ['Extra.update', { business_id: 3, extra_id: 5 }, 5, { business_id: 3, extra_id: 5 }],
  ['ExtraOption.update.put', { business_id: 3, extra_id: 5, option_id: 9 }, 9, { business_id: 3, extra_id: 5, option_id: 9 }],
  ['ExtraOptionSuboption.update.put', { business_id: 3, extra_id: 5, option_id: 9, suboption_id: 4 }, 4, { business_id: 3, extra_id: 5, option_id: 9, suboption_id: 4 }],
  ['Menu.update', { business_id: 3, menu_id: 2 }, 2, { business_id: 3, menu_id: 2 }],
  ['Offer.update.put', { business_id: 3, offer_id: 8 }, 8, { business_id: 3, offer_id: 8 }],
  ['Order.update.put', { order: 1234 }, 1234, { order_id: 1234 }]
]

describe('describeRecordChange', () => {
  it.each(WRITES)('reads %s', (operationId, pathParams, id, ids) => {
    expect(describeRecordChange({ operation_id: operationId, path_params: pathParams, after: { name: 'x' } })).toEqual({
      entity: operationId.split('.')[0],
      id,
      ids,
      after: { name: 'x' }
    })
  })

  it('accepts ids as digit strings and ignores what is not an id', () => {
    expect(describeRecordChange({ operation_id: 'Product.update', path_params: { business_id: '3', category_id: 'x', product_id: '220' } }))
      .toEqual({ entity: 'Product', id: 220, ids: { business_id: 3, product_id: 220 }, after: null })
    expect(describeRecordChange({ operation_id: 'Menu.update', path_params: null })).toEqual({ entity: 'Menu', id: null, ids: {}, after: null })
  })
})

describe('isChangeApplied', () => {
  it('counts executed changes and unknown ones that read as applied', () => {
    expect(isChangeApplied({ status: 'executed' })).toBe(true)
    expect(isChangeApplied({ status: 'unknown', observed: 'applied' })).toBe(true)
    expect(isChangeApplied({ status: 'unknown', observed: 'not_applied' })).toBe(false)
    expect(isChangeApplied({ status: 'unknown', observed: 'unreadable' })).toBe(false)
    expect(isChangeApplied({ status: 'failed' })).toBe(false)
    expect(isChangeApplied({ status: 'cancelled' })).toBe(false)
  })
})
