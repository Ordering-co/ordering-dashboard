// redesign UC-B7 (decision 1, auditor #3; analysis.md §8): the URL <-> state glue of the customers page. Every row of the
// deep-link table has a case: the old link opens the new place and is rewritten with `replaceState`; the new links and the
// params that are not the panel's (`enabled`, `page`, `pageSize`, `q`, `add`) are left alone.
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { parseCustomerQuery, useCustomerQuery } from '../useCustomerQuery'

const PATH = '/users/customers'
const setUrl = (search) => window.history.replaceState(null, '', `${PATH}${search}`)
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))

const mount = (search, options = {}) => {
  setUrl(search)
  return renderHook((props) => useCustomerQuery({ search: props.search, locationKey: props.key, ...options }), {
    initialProps: { search, key: 'k0' }
  })
}

beforeEach(() => setUrl(''))
afterEach(() => setUrl(''))

describe('parseCustomerQuery · every row of analysis.md §8', () => {
  const none = { wallet: null, customFields: false }
  // [main's link, the new state, is it a link to rewrite, the section/wallet the new URL carries]
  const ROWS = [
    ['?id=7', { id: 7, section: 'overview', ...none }, false, {}],
    ['?id=7&section=user_details', { id: 7, section: 'profile', ...none }, true, { section: 'profile' }],
    ['?id=7&section=user_details&tab=profile', { id: 7, section: 'profile', ...none }, true, { section: 'profile' }],
    ['?id=7&section=user_details&tab=saved_places', { id: 7, section: 'addresses', ...none }, true, { section: 'addresses' }],
    ['?id=7&section=user_details&tab=orders', { id: 7, section: 'orders', ...none }, true, { section: 'orders' }],
    ['?id=7&section=user_details&tab=push_tokens', { id: 7, section: 'push_tokens', ...none }, true, { section: 'push_tokens' }],
    ['?id=7&section=user_details&tab=school_students', { id: 7, section: 'school_students', ...none }, true, { section: 'school_students' }],
    ['?id=7&section=cash_wallet', { id: 7, section: 'wallet', wallet: 'cash', customFields: false }, true, { section: 'wallet', wallet: 'cash' }],
    ['?id=7&section=cash_wallet&tab=cash_wallet', { id: 7, section: 'wallet', wallet: 'cash', customFields: false }, true, { section: 'wallet', wallet: 'cash' }],
    ['?id=7&section=cash_wallet&tab=history', { id: 7, section: 'wallet', wallet: 'cash', customFields: false }, true, { section: 'wallet', wallet: 'cash' }],
    ['?id=7&section=points_wallet', { id: 7, section: 'wallet', wallet: 'points', customFields: false }, true, { section: 'wallet', wallet: 'points' }],
    ['?id=7&section=points_wallet&tab=history', { id: 7, section: 'wallet', wallet: 'points', customFields: false }, true, { section: 'wallet', wallet: 'points' }],
    ['?id=7&section=metafields', { id: 7, section: 'overview', wallet: null, customFields: true }, true, {}]
  ]

  it.each(ROWS)('%s → the new place', (search, state, legacy, query) => {
    const parsed = parseCustomerQuery(search)
    expect(parsed).toMatchObject(state)
    expect(parsed.legacy).toBe(legacy)
    expect(parsed.query).toEqual(query)
  })

  it('keeps the new values as they are (not legacy)', () => {
    expect(parseCustomerQuery('?id=7&section=wallet&wallet=points')).toMatchObject({ id: 7, section: 'wallet', wallet: 'points', legacy: false })
    expect(parseCustomerQuery('?id=7&section=orders')).toMatchObject({ section: 'orders', legacy: false })
  })

  it('an unknown section is the overview and counts as a link to rewrite', () => {
    expect(parseCustomerQuery('?id=7&section=nonsense')).toMatchObject({ section: 'overview', legacy: true, query: {} })
  })

  it('a wallet that is not cash or points is ignored', () => {
    expect(parseCustomerQuery('?id=7&section=wallet&wallet=gold')).toMatchObject({ section: 'wallet', wallet: null })
  })

  it('reads the id only when it is a positive whole number', () => {
    expect(parseCustomerQuery('?id=12').id).toBe(12)
    expect(parseCustomerQuery('?id=0').id).toBeNull()
    expect(parseCustomerQuery('?id=abc').id).toBeNull()
    expect(parseCustomerQuery('?id=1.5').id).toBeNull()
    expect(parseCustomerQuery('').id).toBeNull()
  })
})

describe('useCustomerQuery · load', () => {
  it('?id=N alone: opens nothing by itself, keeps the URL as it is and starts at the overview', () => {
    const { result } = mount('?id=7&enabled=inactive&page=2&pageSize=25')
    expect(result.current.initialId).toBe(7)
    expect(result.current.section).toBe('overview')
    expect(result.current.wallet).toBe('cash')
    expect(result.current.customFieldsOpen).toBe(false)
    expect(urlParams()).toEqual({ id: '7', enabled: 'inactive', page: '2', pageSize: '25' })
  })

  it.each([
    ['?id=7&section=user_details&tab=saved_places', 'addresses', 'cash', false, { id: '7', section: 'addresses' }],
    ['?id=7&section=user_details&tab=orders', 'orders', 'cash', false, { id: '7', section: 'orders' }],
    ['?id=7&section=cash_wallet&tab=history', 'wallet', 'cash', false, { id: '7', section: 'wallet', wallet: 'cash' }],
    ['?id=7&section=points_wallet', 'wallet', 'points', false, { id: '7', section: 'wallet', wallet: 'points' }],
    ['?id=7&section=metafields', 'overview', 'cash', true, { id: '7' }]
  ])('%s is translated and rewritten without `tab`', (search, section, wallet, customFields, url) => {
    const { result } = mount(search)
    expect(result.current.section).toBe(section)
    expect(result.current.wallet).toBe(wallet)
    expect(result.current.customFieldsOpen).toBe(customFields)
    expect(urlParams()).toEqual(url)
    expect(window.location.search).not.toContain('tab=')
  })

  it('a legacy link keeps the other params when it is rewritten', () => {
    mount('?id=7&section=cash_wallet&tab=history&enabled=inactive&page=3&pageSize=50&q=olivia')
    expect(urlParams()).toEqual({ id: '7', enabled: 'inactive', page: '3', pageSize: '50', q: 'olivia', section: 'wallet', wallet: 'cash' })
  })

  it('does not touch the URL of a new link', () => {
    mount('?id=7&section=wallet&wallet=points')
    expect(window.location.search).toBe('?id=7&section=wallet&wallet=points')
  })

  it('without ?id= there is nothing to rewrite', () => {
    mount('?section=cash_wallet&enabled=active')
    expect(window.location.search).toBe('?section=cash_wallet&enabled=active')
  })

  it('writes nothing to the URL when it is not enabled (no isUseQuery)', () => {
    const { result } = mount('?id=7&section=cash_wallet', { enabled: false })
    expect(result.current.section).toBe('wallet') // the state still follows the link
    expect(window.location.search).toBe('?id=7&section=cash_wallet')
    act(() => result.current.setSection('orders'))
    expect(result.current.section).toBe('orders')
    expect(window.location.search).toBe('?id=7&section=cash_wallet')
  })
})

describe('useCustomerQuery · writing', () => {
  it('setSection writes ?section= (replace) and the overview removes it', () => {
    const { result } = mount('?id=7&page=2')
    act(() => result.current.setSection('orders'))
    expect(result.current.section).toBe('orders')
    expect(urlParams()).toEqual({ id: '7', page: '2', section: 'orders' })
    act(() => result.current.setSection('overview'))
    expect(urlParams()).toEqual({ id: '7', page: '2' })
  })

  it('replaces the history entry instead of adding one', () => {
    const { result } = mount('?id=7')
    const before = window.history.length
    act(() => result.current.setSection('profile'))
    act(() => result.current.setSection('orders'))
    expect(window.history.length).toBe(before)
  })

  it('the wallet is in the URL only while the Wallet section is: leaving it takes ?wallet= away, coming back brings it', () => {
    const { result } = mount('?id=7&section=wallet&wallet=points')
    act(() => result.current.setSection('orders'))
    expect(urlParams()).toEqual({ id: '7', section: 'orders' })
    act(() => result.current.setSection('wallet'))
    expect(urlParams()).toEqual({ id: '7', section: 'wallet', wallet: 'points' })
  })

  it('a wallet picked from the Overview (wallet first, then the section) lands as section=wallet&wallet=points', () => {
    const { result } = mount('?id=7')
    act(() => {
      result.current.setWallet('points')
      result.current.setSection('wallet')
    })
    expect(result.current.wallet).toBe('points')
    expect(urlParams()).toEqual({ id: '7', section: 'wallet', wallet: 'points' })
  })

  it('switching wallet inside the Wallet section rewrites ?wallet=', () => {
    const { result } = mount('?id=7&section=wallet&wallet=cash')
    act(() => result.current.setWallet('points'))
    expect(urlParams()).toEqual({ id: '7', section: 'wallet', wallet: 'points' })
  })

  it('the Custom fields dialog is state only: opening it adds nothing to the URL', () => {
    const { result } = mount('?id=7')
    act(() => result.current.setCustomFieldsOpen(true))
    expect(result.current.customFieldsOpen).toBe(true)
    expect(window.location.search).toBe('?id=7')
    act(() => result.current.setCustomFieldsOpen(false))
    expect(result.current.customFieldsOpen).toBe(false)
  })

  it('open(id) of another customer writes ?id=, goes back to the overview and drops section and wallet', () => {
    const { result } = mount('?id=7&section=wallet&wallet=points&page=2')
    act(() => { result.current.adopt(7) })
    act(() => result.current.setCustomFieldsOpen(true))
    act(() => result.current.open(9))
    expect(result.current.section).toBe('overview')
    expect(result.current.wallet).toBe('cash')
    expect(result.current.customFieldsOpen).toBe(false)
    expect(urlParams()).toEqual({ id: '9', page: '2' })
  })

  it('open(id) of the customer that is open keeps its section', () => {
    const { result } = mount('?id=7&section=orders')
    act(() => { result.current.adopt(7) })
    act(() => result.current.open(7))
    expect(result.current.section).toBe('orders')
    expect(urlParams()).toEqual({ id: '7', section: 'orders' })
  })

  it('close() removes id, section, wallet and tab and leaves the rest', () => {
    const { result } = mount('?id=7&section=wallet&wallet=points&enabled=inactive&page=2&pageSize=25')
    act(() => result.current.close())
    expect(urlParams()).toEqual({ enabled: 'inactive', page: '2', pageSize: '25' })
    expect(result.current.section).toBe('overview')
    expect(result.current.wallet).toBe('cash')
  })

  it('close() with nothing else in the URL leaves the bare path', () => {
    const { result } = mount('?id=7&section=orders')
    act(() => result.current.close())
    expect(window.location.search).toBe('')
  })
})

describe('useCustomerQuery · the router moves while the page is open (⌘K)', () => {
  // (1): a request changes nothing until the page accepts it (a draft may be open behind the guard)
  it('a navigation to another ?id= is a request, with its section translated; accepting it opens that place', () => {
    const { result, rerender } = mount('?id=7')
    act(() => result.current.adopt(7))
    expect(result.current.request).toBeNull()
    setUrl('?id=9&section=cash_wallet')
    rerender({ search: '?id=9&section=cash_wallet', key: 'k1' })
    expect(result.current.request).toMatchObject({ key: 'k1', id: 9, place: { section: 'wallet', wallet: 'cash', customFieldsOpen: false } })
    expect(result.current.section).toBe('overview')
    expect(result.current.wallet).toBe('cash')
    act(() => result.current.accept(result.current.request))
    expect(result.current.section).toBe('wallet')
    expect(result.current.wallet).toBe('cash')
    expect(urlParams()).toEqual({ id: '9', section: 'wallet', wallet: 'cash' })
  })

  it('restore() keeps the open customer and gives the address back to it, section and wallet included', () => {
    const { result, rerender } = mount('?id=7')
    act(() => result.current.adopt(7))
    act(() => result.current.setWallet('points'))
    act(() => result.current.setSection('wallet'))
    setUrl('?id=9&section=orders')
    rerender({ search: '?id=9&section=orders', key: 'k1' })
    expect(result.current.section).toBe('wallet')
    expect(result.current.wallet).toBe('points')
    act(() => result.current.restore())
    expect(result.current.section).toBe('wallet')
    expect(urlParams()).toEqual({ id: '7', section: 'wallet', wallet: 'points' })
  })

  it('the same address with a new key is a new request', () => {
    const { result, rerender } = mount('?id=7')
    rerender({ search: '?id=7', key: 'k1' })
    expect(result.current.request).toMatchObject({ key: 'k1', id: 7 })
    rerender({ search: '?id=7', key: 'k2' })
    expect(result.current.request).toMatchObject({ key: 'k2', id: 7 })
  })

  it('a navigation without ?id= (the ?q= hand-off) is not a request', () => {
    const { result, rerender } = mount('?id=7')
    rerender({ search: '?q=olivia', key: 'k1' })
    expect(result.current.request).toBeNull()
  })
})
