import { describe, expect, it } from 'vitest'
import { MAX_ORDER_ID, handleOrderIdKeyDown, sanitizeOrderId } from '../orderIdInput'

describe('order ID input', () => {
  it('keeps digits and drops letters, spaces and punctuation', () => {
    expect(sanitizeOrderId(' #82.22abc ')).toBe('8222')
    expect(sanitizeOrderId('')).toBe('')
  })

  it('allows any length up to the API maximum and refuses a bigger number', () => {
    expect(MAX_ORDER_ID).toBe(2147483647)
    expect(sanitizeOrderId(String(MAX_ORDER_ID))).toBe('2147483647')
    expect(sanitizeOrderId('2147483648')).toBeNull()
    expect(sanitizeOrderId('99999999999')).toBeNull()
    expect(sanitizeOrderId('0002147483647')).toBe('0002147483647')
  })

  it('blocks a letter key and lets a digit through', () => {
    const letter = { key: 'a', ctrlKey: false, metaKey: false, altKey: false, preventDefault: () => {} }
    const prevent = letter.preventDefault
    letter.preventDefault = () => { letter.blocked = true; prevent() }
    handleOrderIdKeyDown(letter)
    expect(letter.blocked).toBe(true)

    const digit = { key: '8', ctrlKey: false, metaKey: false, altKey: false, preventDefault: () => { digit.blocked = true } }
    handleOrderIdKeyDown(digit)
    expect(digit.blocked).toBeUndefined()
  })
})
