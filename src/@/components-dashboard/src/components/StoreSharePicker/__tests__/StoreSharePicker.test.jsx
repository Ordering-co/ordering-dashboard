// redesign stores 2.H: «Share with» of menus and zones goes through one controller (StoreSharePicker).
// These tests drive it through the two public aliases and check G3-05: a failed save is reported and frees the
// picker, a store picked on another page keeps its name, and each alias sends the same request as before.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  save: vi.fn(),
  menus: vi.fn(),
  businesses: vi.fn(),
  list: vi.fn(),
  where: vi.fn(),
  showToast: vi.fn(),
  user: { id: 7, level: 2 }
}))

vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'http://api/v400/en/demo',
    businesses: (id) => {
      sdk.businesses(id)
      return { menus: (menuId) => { sdk.menus(menuId); return { save: sdk.save } } }
    },
    setAccessToken: () => ({
      businesses: () => {
        const endpoint = {
          select: () => endpoint,
          asDashboard: () => endpoint,
          where: (where) => { sdk.where(where); return endpoint },
          get: (options) => sdk.list(options)
        }
        return endpoint
      }
    })
  }]
}))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok', user: sdk.user }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback ?? key] }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: sdk.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))

import { BusinessMenuShare } from '../../BusinessMenuShare'
import { BusinessDeliveryZoneShare } from '../../BusinessDeliveryZoneShare'

const store = (id) => ({ id, name: `Store ${id}`, logo: null })
const page = (ids, current = 1, totalPages = 3) => ({
  content: { error: false, result: ids.map(store), pagination: { current_page: current, total_pages: totalPages, total: totalPages * ids.length } }
})
const owner = { id: 1, name: 'Owner', zones: [{ id: 50, name: 'Zone', businesses: [] }] }

// The UI under test is a probe: it hands the controller's props to the test.
const renderPicker = (Component, props) => {
  const seen = { current: null }
  const Probe = (uiProps) => { seen.current = uiProps; return null }
  render(<Component UIComponent={Probe} business={owner} {...props} />)
  return seen
}

beforeEach(() => {
  vi.clearAllMocks()
  sdk.user = { id: 7, level: 2 }
  sdk.list.mockResolvedValue(page([2, 3]))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessMenuShare (StoreSharePicker)', () => {
  const menu = { id: 5, name: 'Main', businesses: [{ id: 9, name: 'Already shared' }] }

  it('saves with the same SDK call as before and updates the menu with every name, also from other pages', async () => {
    sdk.save.mockResolvedValue({ content: { error: false, result: {} } })
    const setMenuList = vi.fn()
    const setCurrentMenu = vi.fn()
    const menuList = { menus: [{ id: 5, name: 'Main' }] }
    const seen = renderPicker(BusinessMenuShare, { menu, menuList, setMenuList, setCurrentMenu })

    await waitFor(() => expect(seen.current.businessesState.businesses).toHaveLength(2))
    expect(seen.current.selectedBusinessIds).toEqual([9])
    act(() => seen.current.handleSelectBusiness(2, true))
    // Move to page 2: store 2 is no longer on screen, but it stays picked and named.
    sdk.list.mockResolvedValueOnce(page([4, 6], 2))
    await act(async () => { seen.current.handleChangeBusinessPage(2) })
    await waitFor(() => expect(seen.current.businessesState.businesses.map(b => b.id)).toEqual([4, 6]))
    act(() => seen.current.handleSelectBusiness(4, true))

    await act(async () => { await seen.current.handleShareBusinesses() })

    expect(sdk.businesses).toHaveBeenCalledWith(1)
    expect(sdk.menus).toHaveBeenCalledWith(5)
    expect(sdk.save).toHaveBeenCalledWith({ business_id: 1, shared: [9, 2, 4] })
    const saved = setCurrentMenu.mock.calls[0][0].menu
    expect(saved.businesses).toEqual([
      { id: 9, name: 'Already shared', pivot: { business_id: 9, menu_id: 5 } },
      { id: 2, name: 'Store 2', pivot: { business_id: 2, menu_id: 5 } },
      { id: 4, name: 'Store 4', pivot: { business_id: 4, menu_id: 5 } }
    ])
    expect(setMenuList).toHaveBeenCalledWith({ menus: [expect.objectContaining({ id: 5, businesses: saved.businesses })] })
    expect(sdk.showToast).toHaveBeenLastCalledWith('success', 'Business saved')
    expect(seen.current.actionState).toEqual({ loading: false, result: { error: false } })
  })

  it('reports a failed save (the API body says error) and frees the picker, without touching the menu', async () => {
    sdk.save.mockResolvedValue({ content: { error: true, result: ['Not allowed'] } })
    const setMenuList = vi.fn()
    const seen = renderPicker(BusinessMenuShare, { menu, menuList: { menus: [] }, setMenuList })
    await waitFor(() => expect(seen.current.businessesState.loading).toBe(false))

    await act(async () => { await seen.current.handleShareBusinesses() })

    expect(setMenuList).not.toHaveBeenCalled()
    expect(seen.current.actionState).toEqual({ loading: false, result: { error: true, result: ['Not allowed'] } })
    expect(sdk.showToast).toHaveBeenLastCalledWith('error', 'Not allowed')
    expect(sdk.showToast).not.toHaveBeenCalledWith('success', expect.anything())
  })

  it('reports a save that throws (5xx, network) with the generic text, not the technical one, and frees the picker', async () => {
    sdk.save.mockRejectedValue(new Error('Unexpected token \'<\', "<html><bod"... is not valid JSON'))
    const seen = renderPicker(BusinessMenuShare, { menu, menuList: { menus: [] }, setMenuList: vi.fn() })
    await waitFor(() => expect(seen.current.businessesState.loading).toBe(false))

    await act(async () => { await seen.current.handleShareBusinesses() })

    expect(seen.current.actionState.loading).toBe(false)
    expect(seen.current.actionState.result.error).toBe(true)
    expect(sdk.showToast).toHaveBeenLastCalledWith('error', 'We couldn\'t save the change.')
  })

  it('«Select all» adds the page on screen to what is picked; «Select none» clears everything', async () => {
    const seen = renderPicker(BusinessMenuShare, { menu, menuList: { menus: [] }, setMenuList: vi.fn() })
    await waitFor(() => expect(seen.current.businessesState.businesses).toHaveLength(2))

    act(() => seen.current.handleSelectAllBusiness(true))
    expect(seen.current.selectedBusinessIds).toEqual([9, 2, 3])
    act(() => seen.current.handleSelectAllBusiness(true))
    expect(seen.current.selectedBusinessIds).toEqual([9, 2, 3])
    act(() => seen.current.handleSelectAllBusiness(false))
    expect(seen.current.selectedBusinessIds).toEqual([])
  })

  it('says the list did not load and retries the same page, size and search', async () => {
    sdk.list.mockResolvedValueOnce({ content: { error: true, result: ['Boom'] } })
    const seen = renderPicker(BusinessMenuShare, { menu, menuList: { menus: [] }, setMenuList: vi.fn() })
    await waitFor(() => expect(seen.current.businessesState.error).toEqual(['Boom']))
    expect(seen.current.businessesState.businesses).toEqual([])

    await act(async () => { seen.current.reloadBusinesses() })
    await waitFor(() => expect(seen.current.businessesState.businesses).toHaveLength(2))
    expect(seen.current.businessesState.error).toBe(null)
    expect(sdk.list).toHaveBeenLastCalledWith({ query: { page: 1, page_size: 10 } })
  })

  it('Retry asks again for the page that failed, not page 1', async () => {
    const seen = renderPicker(BusinessMenuShare, { menu, menuList: { menus: [] }, setMenuList: vi.fn() })
    await waitFor(() => expect(seen.current.businessesState.businesses).toHaveLength(2))
    sdk.list.mockRejectedValueOnce(new Error('Failed to fetch'))
    await act(async () => { seen.current.handleChangeBusinessPage(4) })
    await waitFor(() => expect(seen.current.businessesState.error).toBeTruthy())

    await act(async () => { seen.current.reloadBusinesses() })
    expect(sdk.list).toHaveBeenLastCalledWith({ query: { page: 4, page_size: 10 } })
  })

  it('still says how the save ended when the panel closed while saving', async () => {
    let answer
    sdk.save.mockReturnValue(new Promise(resolve => { answer = resolve }))
    const seen = { current: null }
    const Probe = (uiProps) => { seen.current = uiProps; return null }
    const { unmount } = render(<BusinessMenuShare UIComponent={Probe} business={owner} menu={menu} menuList={{ menus: [] }} setMenuList={vi.fn()} />)
    await waitFor(() => expect(seen.current.businessesState.loading).toBe(false))

    let saving
    act(() => { saving = seen.current.handleShareBusinesses() })
    unmount()
    await act(async () => { answer({ content: { error: true, result: ['Not allowed'] } }); await saving })

    expect(sdk.showToast).toHaveBeenLastCalledWith('error', 'Not allowed')
  })

  it('leaves the owner out of the list', async () => {
    sdk.list.mockResolvedValue(page([1, 2]))
    const seen = renderPicker(BusinessMenuShare, { menu, menuList: { menus: [] }, setMenuList: vi.fn() })
    await waitFor(() => expect(seen.current.businessesState.businesses.map(b => b.id)).toEqual([2]))
  })
})

describe('BusinessDeliveryZoneShare (StoreSharePicker)', () => {
  const zone = { id: 50, name: 'Zone', businesses: [{ id: 9, name: 'Already shared' }] }

  it('sends the same PUT as before and tells the store editor', async () => {
    const fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: false, result: {} }) })
    vi.stubGlobal('fetch', fetch)
    const handleSuccessUpdate = vi.fn()
    const seen = renderPicker(BusinessDeliveryZoneShare, { zone, handleSuccessUpdate })
    await waitFor(() => expect(seen.current.businessesState.businesses).toHaveLength(2))
    act(() => seen.current.handleSelectBusiness(3, true))

    await act(async () => { await seen.current.handleShareBusinesses() })

    expect(fetch).toHaveBeenCalledWith('http://api/v400/en/demo/business/1/deliveryzones/50', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ businesses: [9, 3] })
    })
    const updated = handleSuccessUpdate.mock.calls[0][0]
    expect(updated.zones[0].businesses).toEqual([
      { id: 9, name: 'Already shared', pivot: { business_id: 9, zone_id: 50 } },
      { id: 3, name: 'Store 3', pivot: { business_id: 3, zone_id: 50 } }
    ])
    expect(sdk.showToast).toHaveBeenLastCalledWith('success', 'Business saved')
  })

  it('G3-05: a failed PUT frees the picker and says why (before, it stayed disabled for good)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: true, result: 'Zone locked' }) }))
    const handleSuccessUpdate = vi.fn()
    const seen = renderPicker(BusinessDeliveryZoneShare, { zone, handleSuccessUpdate })
    await waitFor(() => expect(seen.current.businessesState.loading).toBe(false))

    await act(async () => { await seen.current.handleShareBusinesses() })

    expect(handleSuccessUpdate).not.toHaveBeenCalled()
    expect(seen.current.actionState).toEqual({ loading: false, result: { error: true, result: 'Zone locked' } })
    expect(sdk.showToast).toHaveBeenLastCalledWith('error', 'Zone locked')
  })

  it('an owner without its zones loaded is passed on unchanged instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: false, result: {} }) }))
    const handleSuccessUpdate = vi.fn()
    const seen = { current: null }
    const Probe = (uiProps) => { seen.current = uiProps; return null }
    const bare = { id: 1, name: 'Owner' }
    render(<BusinessDeliveryZoneShare UIComponent={Probe} business={bare} zone={zone} handleSuccessUpdate={handleSuccessUpdate} />)
    await waitFor(() => expect(seen.current.businessesState.loading).toBe(false))

    await act(async () => { await seen.current.handleShareBusinesses() })

    expect(handleSuccessUpdate).toHaveBeenCalledWith(bare)
    expect(seen.current.actionState.result.error).toBe(false)
  })
})

describe('StoreSharePicker list for a project admin', () => {
  it('lists with the same backoffice GET as before', async () => {
    sdk.user = { id: 1, level: 0 }
    const fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: false, result: [store(2)], pagination: { current_page: 1, total_pages: 1, total: 1 } }) })
    vi.stubGlobal('fetch', fetch)
    const seen = renderPicker(BusinessMenuShare, { menu: { id: 5, businesses: [] }, menuList: { menus: [] }, setMenuList: vi.fn() })
    await waitFor(() => expect(seen.current.businessesState.businesses).toHaveLength(1))
    expect(fetch).toHaveBeenCalledWith(
      'http://api/v400/en/demo/backoffice/businesses?params=id,name,logo&page=1&page_size=10',
      { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' } }
    )

    await act(async () => { seen.current.searchBusinesses('piz') })
    const where = JSON.stringify({ conditions: [{ attribute: 'name', value: { condition: 'ilike', value: encodeURI('%piz%') } }], conector: 'AND' })
    expect(fetch).toHaveBeenLastCalledWith(
      `http://api/v400/en/demo/backoffice/businesses?params=id,name,logo&page=1&page_size=10&where=${where}`,
      expect.anything()
    )
  })
})
