import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TaxBillRows } from '../../../Shared/UI/TaxBillRows'

const tax = (name) => ({ id: 1, name, target: 'product', type: 2, rate: 5, summary: { tax: 3 } })
const renderTax = (name, t) => render(
  <table>
    <tbody>
      <TaxBillRows taxes={[tax(name)]} target='product' parsePrice={value => `$${value}`} parseNumber={value => value} t={t} />
    </tbody>
  </table>
)

// What the language context does with a key the dictionary does not have.
const untranslated = (key, fallback = null) => fallback || key

describe('TaxBillRows label fallback', () => {
  it('writes a raw key readably when there is no translation', () => {
    renderTax('DELIVERY_TAX', untranslated)
    expect(screen.getByText('Delivery tax')).toBeInTheDocument()
    expect(screen.queryByText('DELIVERY_TAX')).toBeNull()
  })

  it('keeps a translated label exactly as the dictionary says', () => {
    renderTax('DELIVERY_TAX', key => (key === 'DELIVERY_TAX' ? 'Impuesto de envío' : key))
    expect(screen.getByText('Impuesto de envío')).toBeInTheDocument()
  })

  it('keeps a readable name and an acronym as they are', () => {
    const { unmount } = renderTax('City tax', untranslated)
    expect(screen.getByText('City tax')).toBeInTheDocument()
    unmount()
    renderTax('VAT', untranslated)
    expect(screen.getByText('VAT')).toBeInTheDocument()
  })
})
