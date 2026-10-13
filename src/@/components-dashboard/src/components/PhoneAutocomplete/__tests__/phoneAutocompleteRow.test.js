import { describe, expect, it } from 'vitest'

import { fillCreateCustomerRow, fillPhoneAutocompleteRow } from '../phoneAutocompleteRow'

const XSS = '</strong><img src=x onerror=alert(1)>'

describe('fillPhoneAutocompleteRow', () => {
  it('renders a crafted customer name as text, not HTML', () => {
    const row = document.createElement('div')
    fillPhoneAutocompleteRow(row, {
      cellphone: '5551234567',
      name: XSS,
      query: '555'
    })

    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('strong').textContent).toBe('555')
    expect(row.textContent).toContain(XSS)
    expect(row.querySelector('input[type="hidden"]').value).toBe('5551234567')
  })

  it('renders a crafted cellphone as text, not HTML', () => {
    const row = document.createElement('div')
    fillPhoneAutocompleteRow(row, {
      cellphone: '<img src=x onerror=alert(1)>555',
      name: 'Jane',
      query: '<img'
    })

    expect(row.querySelector('img')).toBeNull()
    expect(row.textContent).toContain('<img src=x onerror=alert(1)>555')
  })
})

describe('fillCreateCustomerRow', () => {
  it('does not interpret the create-customer label as HTML', () => {
    const row = document.createElement('div')
    fillCreateCustomerRow(row, XSS)

    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('strong').textContent).toBe(XSS)
    expect(row.querySelector('input[type="hidden"]').value).toBe(XSS)
  })
})
