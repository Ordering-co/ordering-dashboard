// redesign BO-B3 (decision 1, auditor #3; analysis.md §2): the URL <-> state glue of the staff pages. The address keeps MAIN's
// parameters (`?id=` and `?tab=`), so no old link is rewritten. The params that are not the panel's (`enabled`, `page`,
// `pageSize`, `q`, `add`) are never touched, except `id` and `tab`.
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { parseStaffQuery, useStaffQuery } from '../useStaffQuery'

const PATH = '/users/business-owners'
const setUrl = (search) => window.history.replaceState(null, '', `${PATH}${search}`)
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))

const mount = (search, options = {}) => {
  setUrl(search)
  return renderHook((props) => useStaffQuery({ search: props.search, locationKey: props.key, ...options }), {
    initialProps: { search, key: 'k0' }
  })
}

beforeEach(() => setUrl(''))
afterEach(() => setUrl(''))

describe('parseStaffQuery', () => {
  it('reads ?id= only when it is a positive whole number', () => {
    expect(parseStaffQuery('?id=12').id).toBe(12)
    expect(parseStaffQuery('?id=0').id).toBeNull()
    expect(parseStaffQuery('?id=abc').id).toBeNull()
    expect(parseStaffQuery('?id=1.5').id).toBeNull()
    expect(parseStaffQuery('').id).toBeNull()
  })

  it('maps ?tab= with fromStaffTab', () => {
    expect(parseStaffQuery('?id=7&tab=businesses')).toMatchObject({ id: 7, section: 'businesses', customFields: false })
    expect(parseStaffQuery('?id=7&tab=metafields')).toMatchObject({ section: 'profile', customFields: true })
    expect(parseStaffQuery('?id=7&tab=nonsense')).toMatchObject({ section: 'profile', customFields: false })
  })
})

describe('useStaffQuery · load', () => {
  it('?id=7 alone: Profile, no dialog, and the URL stays as it is', () => {
    const { result } = mount('?id=7&enabled=inactive&page=2&pageSize=25')
    expect(result.current.initialId).toBe(7)
    expect(result.current.section).toBe('profile')
    expect(result.current.customFieldsOpen).toBe(false)
    expect(result.current.request).toBeNull()
    expect(urlParams()).toEqual({ id: '7', enabled: 'inactive', page: '2', pageSize: '25' })
  })

  it('?id=7&tab=businesses opens the Stores section and leaves main\'s link as it is', () => {
    const { result } = mount('?id=7&tab=businesses')
    expect(result.current.section).toBe('businesses')
    expect(window.location.search).toBe('?id=7&tab=businesses')
  })

  it('?tab=metafields is Profile with the Custom fields open', () => {
    const { result } = mount('?id=7&tab=metafields')
    expect(result.current.section).toBe('profile')
    expect(result.current.customFieldsOpen).toBe(true)
    expect(window.location.search).toBe('?id=7&tab=metafields')
  })

  it('an unknown tab is Profile', () => {
    const { result } = mount('?id=7&tab=nonsense')
    expect(result.current.section).toBe('profile')
    expect(result.current.customFieldsOpen).toBe(false)
  })

  it('without ?id= there is no initial id', () => {
    const { result } = mount('?enabled=active')
    expect(result.current.initialId).toBeNull()
  })
})

describe('useStaffQuery · writing', () => {
  it('setSection writes ?tab= (Profile too, as main), keeping the rest, and replaces the history entry', () => {
    const { result } = mount('?id=7&page=2')
    const before = window.history.length
    act(() => result.current.setSection('orders'))
    expect(result.current.section).toBe('orders')
    expect(urlParams()).toEqual({ id: '7', page: '2', tab: 'orders' })
    act(() => result.current.setSection('profile'))
    expect(urlParams()).toEqual({ id: '7', page: '2', tab: 'profile' })
    expect(window.history.length).toBe(before)
  })

  it('the Custom fields dialog is state only: opening it adds nothing to the URL', () => {
    const { result } = mount('?id=7')
    act(() => result.current.setCustomFieldsOpen(true))
    expect(result.current.customFieldsOpen).toBe(true)
    expect(window.location.search).toBe('?id=7')
    act(() => result.current.setCustomFieldsOpen(false))
    expect(result.current.customFieldsOpen).toBe(false)
  })

  it('open(id) of another record writes ?id=, goes back to Profile and drops ?tab=', () => {
    const { result } = mount('?id=7&tab=orders&page=2')
    act(() => { result.current.adopt(7) })
    act(() => result.current.setCustomFieldsOpen(true))
    act(() => result.current.open(9))
    expect(result.current.section).toBe('profile')
    expect(result.current.customFieldsOpen).toBe(false)
    expect(urlParams()).toEqual({ id: '9', page: '2' })
  })

  it('open(id, { section }) of another record starts there and writes ?tab=', () => {
    const { result } = mount('?id=7&page=2')
    act(() => { result.current.adopt(7) })
    act(() => result.current.open(9, { section: 'businesses' }))
    expect(result.current.section).toBe('businesses')
    expect(urlParams()).toEqual({ id: '9', page: '2', tab: 'businesses' })
  })

  it('open(id) of the record that is open keeps its section', () => {
    const { result } = mount('?id=7&tab=orders')
    act(() => { result.current.adopt(7) })
    act(() => result.current.open(7))
    expect(result.current.section).toBe('orders')
    expect(urlParams()).toEqual({ id: '7', tab: 'orders' })
  })

  it('close() removes id and tab and leaves the rest', () => {
    const { result } = mount('?id=7&tab=orders&enabled=inactive&page=2&pageSize=25&q=ana&add=1')
    act(() => result.current.close())
    expect(urlParams()).toEqual({ enabled: 'inactive', page: '2', pageSize: '25', q: 'ana', add: '1' })
    expect(result.current.section).toBe('profile')
    expect(result.current.customFieldsOpen).toBe(false)
  })

  it('close() with nothing else in the URL leaves the bare path', () => {
    const { result } = mount('?id=7&tab=orders')
    act(() => result.current.close())
    expect(window.location.search).toBe('')
  })

  it('enabled=false: the state follows but the address is never written', () => {
    const { result } = mount('?id=7&tab=businesses', { enabled: false })
    expect(result.current.section).toBe('businesses')
    act(() => result.current.setSection('orders'))
    expect(result.current.section).toBe('orders')
    act(() => result.current.open(9, { section: 'profile' }))
    expect(result.current.section).toBe('profile')
    act(() => result.current.close())
    expect(window.location.search).toBe('?id=7&tab=businesses')
  })
})

describe('useStaffQuery · the router moves while the page is open (⌘K)', () => {
  it('a navigation to another ?id= is a request, with its tab read and the link left alone', () => {
    const { result, rerender } = mount('?id=7')
    expect(result.current.request).toBeNull()
    setUrl('?id=9&tab=businesses')
    rerender({ search: '?id=9&tab=businesses', key: 'k1' })
    expect(result.current.request).toEqual({ key: 'k1', id: 9 })
    expect(result.current.section).toBe('businesses')
    expect(window.location.search).toBe('?id=9&tab=businesses')
  })

  it('the same address with a new key is a new request', () => {
    const { result, rerender } = mount('?id=7')
    rerender({ search: '?id=7', key: 'k1' })
    expect(result.current.request).toEqual({ key: 'k1', id: 7 })
    rerender({ search: '?id=7', key: 'k2' })
    expect(result.current.request).toEqual({ key: 'k2', id: 7 })
  })

  it('a new search with a new ?id= (same key) is a request', () => {
    const { result, rerender } = mount('?id=7')
    rerender({ search: '?id=8', key: 'k0' })
    expect(result.current.request).toEqual({ key: 'k0', id: 8 })
  })

  it('a navigation without ?id= (the ?q= hand-off) is not a request', () => {
    const { result, rerender } = mount('?id=7')
    rerender({ search: '?q=ana', key: 'k1' })
    expect(result.current.request).toBeNull()
  })
})
