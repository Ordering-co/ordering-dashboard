/* eslint-disable import/first */
// redesign OC-C (contact): what the contact actions of a cart are, what each one does, and that the email never outgrows
// a mailto: link. The helpers (parsePrice, buildCartEmail, buildMailtoHref, copyText) are the real ones.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), configs: {} }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils,
    useToast: () => [{}, { showToast: mocks.showToast }],
    ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' }
  }
})

import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'
import { MAILTO_MAX } from '../../../../../../utils/openCarts'
import { contactNavigation, useCartContact } from '../useCartContact'

const cart = (user = {}, extra = {}) => ({
  id: 90012,
  uuid: 'uuid-90012',
  user_id: 7,
  status: 0,
  updated_at: '2026-10-09 12:00:00',
  business: { name: 'Sample Burgers' },
  user: { name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com', cellphone: '+1 555 0100', ...user },
  ...extra
})

const detail = (products = [{ name: 'Hamburger', quantity: 2, total: 26.86 }, { name: 'Fries', quantity: 1, total: 4.3 }], total = 34.2) => ({
  total,
  products
})

const harness = {}
const Probe = ({ target, detailCart }) => {
  const [{ parsePrice }] = useUtils()
  harness.parsePrice = parsePrice
  harness.result = useCartContact(target, detailCart)
  return null
}
const setup = (target, detailCart) => render(<UtilsProviders><Probe target={target} detailCart={detailCart} /></UtilsProviders>)
const action = (key) => harness.result.actions.find(item => item.key === key)
const bodyOf = (href) => decodeURIComponent(href.split('body=')[1])

let open
beforeEach(() => {
  mocks.configs = {}
  open = vi.spyOn(contactNavigation, 'open').mockImplementation(() => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } })
  document.execCommand = vi.fn(() => false)
})
afterEach(() => { vi.restoreAllMocks() })

describe('useCartContact actions: only what has its datum', () => {
  it('a customer with email and phone gets the four actions, named by their object', () => {
    setup(cart(), detail())
    expect(harness.result.actions.map(item => [item.key, item.label])).toEqual([
      ['email', 'Email customer'],
      ['call', 'Call +1 555 0100'],
      ['copyPhone', 'Copy phone'],
      ['copyEmail', 'Copy email']
    ])
    expect(harness.result.actions.every(item => typeof item.onSelect === 'function' && item.icon)).toBe(true)
    expect(harness.result.contact).toMatchObject({ name: 'Ana Ruiz', email: 'ana@example.com', phone: '+1 555 0100', hasContact: true })
  })

  it('only an email: no Call, no Copy phone', () => {
    setup(cart({ cellphone: '', phone: '' }), detail())
    expect(harness.result.actions.map(item => item.key)).toEqual(['email', 'copyEmail'])
  })

  it('only a phone: no Email, no Copy email', () => {
    setup(cart({ email: '' }), detail())
    expect(harness.result.actions.map(item => item.key)).toEqual(['call', 'copyPhone'])
  })

  it('a guest has no actions and says so', () => {
    setup(cart({ name: '', lastname: '', email: '', cellphone: '', phone: '' }), detail())
    expect(harness.result.actions).toEqual([])
    expect(harness.result.contact.isGuest).toBe(true)
  })

  it('without a cart it has nothing to offer', () => {
    setup(null, null)
    expect(harness.result.actions).toEqual([])
  })
})

describe('Call', () => {
  it('opens a tel: link with the number as dialled (no spaces)', () => {
    setup(cart({ cellphone: '+1 (555) 010-0' }), detail())
    action('call').onSelect()
    expect(open).toHaveBeenCalledWith('tel:+15550100')
  })

  it('falls back to the landline when there is no cellphone', () => {
    setup(cart({ cellphone: '', phone: '555 0199' }), detail())
    expect(action('call').label).toBe('Call 555 0199')
  })
})

describe('Email customer', () => {
  it('opens a mailto: with the subject, the greeting, the lines of the cart, the total and the sign-off', () => {
    setup(cart(), detail())
    action('email').onSelect()
    const href = open.mock.calls[0][0]
    expect(href.startsWith('mailto:ana@example.com?subject=Your%20cart%20at%20Sample%20Burgers&body=')).toBe(true)
    const { parsePrice } = harness
    expect(bodyOf(href)).toBe([
      'Hi Ana,',
      `2× Hamburger — ${parsePrice(26.86)}\n1× Fries — ${parsePrice(4.3)}`,
      `Total: ${parsePrice(34.2)}`,
      'Can we help you finish your order?'
    ].join('\n\n'))
  })

  it('greets without a name as «Hi,»', () => {
    setup(cart({ name: '', lastname: '' }), detail())
    action('email').onSelect()
    expect(bodyOf(open.mock.calls[0][0]).startsWith('Hi,\n\n')).toBe(true)
  })

  it('without the detail yet it still writes the greeting and the sign-off, with no lines and no total', () => {
    setup(cart(), null)
    action('email').onSelect()
    expect(bodyOf(open.mock.calls[0][0])).toBe('Hi Ana,\n\nCan we help you finish your order?')
  })

  it('encodes what needs it: accents, ampersands, hashes and line breaks, and keeps the @ of the address', () => {
    setup(cart({ name: 'Zoë', email: 'zoe+cart@example.com' }), detail([{ name: 'Mac & Cheese #2', quantity: 1, total: 9 }], 9))
    action('email').onSelect()
    const href = open.mock.calls[0][0]
    expect(href.startsWith('mailto:zoe%2Bcart@example.com?')).toBe(true)
    expect(href.slice(1)).not.toMatch(/[#]/) // no raw # anywhere in the link
    expect(href.split('&body=')[1]).toContain('Mac%20%26%20Cheese%20%232')
    expect(bodyOf(href)).toContain('1× Mac & Cheese #2')
    expect(href).toContain('Hi%20Zo%C3%AB')
  })

  it('cuts a long cart so the whole link stays within MAILTO_MAX, and counts what it left out', () => {
    const products = Array.from({ length: 80 }, (_, index) => ({ name: `Product number ${index + 1} with a long name`, quantity: 1, total: 10 }))
    setup(cart(), detail(products, 800))
    action('email').onSelect()
    const href = open.mock.calls[0][0]
    expect(href.length).toBeLessThanOrEqual(MAILTO_MAX)
    const body = bodyOf(href)
    expect(body).toMatch(/\+\d+ more items/)
    const kept = body.split('\n').filter(line => line.includes(' — ')).length
    const left = Number(body.match(/\+(\d+) more items/)[1])
    expect(kept + left).toBe(80)
    expect(body).toContain(`Total: ${harness.parsePrice(800)}`)
  })

  it('a long address leaves less room for the cart: the link still fits', () => {
    const products = Array.from({ length: 40 }, (_, index) => ({ name: `Product ${index + 1} with a long name`, quantity: 2, total: 12.5 }))
    setup(cart({ email: `${'a'.repeat(60)}@${'b'.repeat(60)}.example.com` }), detail(products, 500))
    action('email').onSelect()
    expect(open.mock.calls[0][0].length).toBeLessThanOrEqual(MAILTO_MAX)
  })
})

describe('Copy', () => {
  it('copies the phone and says «Phone copied»', async () => {
    setup(cart(), detail())
    await act(async () => { await action('copyPhone').onSelect() })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('+1 555 0100')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Phone copied')
  })

  it('copies the email and says «Email copied»', async () => {
    setup(cart(), detail())
    await act(async () => { await action('copyEmail').onSelect() })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ana@example.com')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Email copied')
  })

  it('when the browser refuses both ways, it says so and tells what to do instead', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'))
    setup(cart(), detail())
    await act(async () => { await action('copyPhone').onSelect() })
    expect(mocks.showToast).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', "Couldn't copy. Select the text and copy it.")
  })
})

describe('contactNavigation.open', () => {
  it('assigns the link to the window location', () => {
    open.mockRestore()
    const original = window.location
    delete window.location
    window.location = { href: '' }
    try {
      contactNavigation.open('tel:+15550100')
      expect(window.location.href).toBe('tel:+15550100')
    } finally {
      window.location = original
    }
  })
})
