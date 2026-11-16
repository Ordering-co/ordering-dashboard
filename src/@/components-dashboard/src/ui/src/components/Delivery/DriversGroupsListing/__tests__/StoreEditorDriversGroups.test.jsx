/* eslint-disable import/first */
// redesign DG-B5 (kept) + stores 5.7 (G3-27): the store editor's «Driver Delivery Group» tab (`Stores/BusinessDeliveryGroupsDetails`).
// DG-B5's intent stands: the tab drags in none of the page UI of Delivery > Driver groups (no create, no enable switch, no selection,
// no open detail; nothing from D/DriversGroupsDirectory but its pure helpers, and not D/DriversGroupsListing). What 5.7 pins is
// what it shows: only the groups the store is in (every page of GET /drivergroups is asked for), a load error that is not the empty
// state.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({ storage: null, user: { level: 0 }, emit: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{ root: 'https://api.test/v4/project' }],
  useSession: () => [{ token: 'token-123', user: env.user }],
  useEvent: () => [{ emit: (...args) => env.emit(...args) }]
}))
vi.mock('../../../../utils', () => ({
  getStorageItem: async (key) => (env.storage === key ? true : null),
  removeStorageItem: async (key) => { if (env.storage === key) env.storage = null }
}))

import { DriversGroupsListingDetails } from '../../../Stores/BusinessDeliveryGroupsDetails'

const STORE = { id: 2 }
const group = (id, extra = {}) => ({
  id,
  name: `Group ${id}`,
  type: 0,
  enabled: true,
  administrators: [{ name: 'Ana', lastname: 'Ruiz' }],
  drivers: [],
  business: [],
  ...extra
})
// Two pages of GET /drivergroups. The store (2) is in groups 1 (a number), 3 (an object) and 5; 12 and 22 only look like it.
const PAGES = {
  1: {
    result: [group(1, { business: [2, 5] }), group(2, { business: [9] }), group(6, { business: [12, 22] })],
    pagination: { current_page: 1, total_pages: 2, page_size: 100, total: 5 }
  },
  2: {
    result: [group(3, { type: 1, enabled: false, business: [{ id: 2 }, { id: 8 }] }), group(4, { business: [] }), group(5, { business: ['2'] })],
    pagination: { current_page: 2, total_pages: 2, page_size: 100, total: 5 }
  }
}

const answer = (body, status = 200) => Promise.resolve({ status, json: async () => body })
const mockFetch = (handler) => {
  const fetchMock = vi.fn((url, options) => handler(new URL(url), options))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const serve = (pages) => mockFetch(url => answer(pages[Number(url.searchParams.get('page'))]))

const setPhone = (matches) => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn()
  }))
}

const draw = (entry = '/') => render(
  <MemoryRouter initialEntries={[entry]}>
    <DriversGroupsListingDetails business={STORE} />
  </MemoryRouter>
)

beforeEach(() => {
  env.storage = null
  env.user = { level: 0 }
  env.emit = vi.fn()
  setPhone(false)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('store editor: the driver groups tab', () => {
  it('lists only the groups the store is in, asking for every page', async () => {
    const fetchMock = serve(PAGES)
    draw()
    expect(await screen.findByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 3')).toBeInTheDocument()
    expect(screen.getByText('Group 5')).toBeInTheDocument()
    ;['Group 2', 'Group 4', 'Group 6'].forEach(name => expect(screen.queryByText(name)).toBeNull())

    const urls = fetchMock.mock.calls.map(([url]) => new URL(url))
    expect(urls.map(url => url.searchParams.get('page'))).toEqual(['1', '2'])
    urls.forEach(url => {
      expect(url.origin + url.pathname).toBe('https://api.test/v4/project/drivergroups')
      expect(url.searchParams.get('page_size')).toBe('100')
      expect(url.searchParams.get('params')).toContain('business')
    })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123')
    expect(screen.getByText('This business is in the following driver groups')).toBeInTheDocument()
  })

  it('draws Group (name, #id · manager), Type and Status, read-only', async () => {
    serve(PAGES)
    draw()
    await screen.findByText('Group 1')
    const table = screen.getByRole('table', { name: 'Delivery groups' })
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Group', 'Type', 'Status'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Group 1')
    expect(rows[0]).toHaveTextContent('#1 · Ana Ruiz')
    expect(rows[0]).toHaveTextContent('In house drivers')
    expect(rows[0]).toHaveTextContent('Enabled')
    expect(rows[1]).toHaveTextContent('Group 3')
    expect(rows[1]).toHaveTextContent('Driver companies')
    expect(rows[1]).toHaveTextContent('Disabled')
    // DG-B5: no create, no switch, no selection, no way into a group
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    // J2 row 19: the one button is «Manage driver groups» (level 0 here); the rows and the list stay read-only
    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Manage driver groups'])
    expect(screen.queryByRole('link')).toBeNull()
    rows.forEach(row => expect(row).not.toHaveAttribute('tabindex'))
  })

  it('pages the list ten at a time when the store is in more than ten groups', async () => {
    const many = Array.from({ length: 12 }, (_, index) => group(100 + index, { business: [2] }))
    serve({ 1: { result: many, pagination: { current_page: 1, total_pages: 1, page_size: 100, total: 12 } } })
    draw()
    await screen.findByText('Group 100')
    expect(within(screen.getByRole('table')).getAllByRole('row').slice(1)).toHaveLength(10)
    expect(screen.queryByText('Group 110')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Group 110')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('row').slice(1)).toHaveLength(2)
  })

  it('shows skeleton rows while it loads', async () => {
    let release
    mockFetch(() => new Promise(resolve => { release = () => resolve({ status: 200, json: async () => ({ result: [group(1, { business: [2] })], pagination: { current_page: 1, total_pages: 1 } }) }) }))
    const { container } = draw()
    await waitFor(() => expect(container.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0))
    expect(screen.getByText('Loading groups')).toBeInTheDocument()
    expect(screen.queryByText("This store isn't in any driver group.")).toBeNull()
    release()
    await screen.findByText('Group 1')
  })

  it('an empty answer says the store is in no group, and is not an error', async () => {
    serve({ 1: { result: [group(2, { business: [9] })], pagination: { current_page: 1, total_pages: 1 } } })
    draw()
    expect(await screen.findByText("This store isn't in any driver group.")).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('a load error is not the empty state, and «Retry» asks again', async () => {
    let calls = 0
    mockFetch(url => {
      calls += 1
      if (calls === 1) return answer({ error: true, result: 'Server unavailable' }, 500)
      return answer(PAGES[Number(url.searchParams.get('page'))])
    })
    draw()
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText("We couldn't load the driver groups.")).toBeInTheDocument()
    expect(within(alert).getByText('Server unavailable')).toBeInTheDocument()
    expect(screen.queryByText("This store isn't in any driver group.")).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Group 1')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(calls).toBe(3) // the failed first page, then pages 1 and 2
  })

  it('a thrown error (the network) is an error too', async () => {
    mockFetch(() => Promise.reject(new Error('Failed to fetch')))
    draw()
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Failed to fetch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('under 768px the same groups are non-interactive cards', async () => {
    setPhone(true)
    serve(PAGES)
    draw()
    const list = await screen.findByRole('list', { name: 'Delivery groups' })
    expect(screen.queryByRole('table')).toBeNull()
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(cards[0]).toHaveTextContent('Group 1')
    expect(cards[0]).toHaveTextContent('#1 · In house drivers')
    expect(cards[0]).toHaveTextContent('Ana Ruiz')
    expect(cards[1]).toHaveTextContent('Group 3')
    expect(cards[1]).toHaveTextContent('Disabled')
    // `?id=` is the store here: a card must not be a link, nor carry a switch or a checkbox
    expect(screen.queryByRole('link')).toBeNull()
    list.querySelectorAll('a').forEach(anchor => expect(anchor).not.toHaveAttribute('href'))
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

// J2 row 19 (stores-5-7-delivery-forms P-1): the tab leads to where the groups are managed, for the levels that may open that page
// (/delivery/drivers-groups is [0, 5] in App.js); the tab itself stays read-only.
describe('store editor: the driver groups tab · Manage driver groups', () => {
  it('an admin (0) and a drivers manager (5) get «Manage driver groups», which goes to Delivery > Driver groups', async () => {
    for (const level of [0, 5]) {
      env.user = { level }
      serve(PAGES)
      draw()
      await userEvent.click(await screen.findByRole('button', { name: 'Manage driver groups' }))
      expect(env.emit).toHaveBeenLastCalledWith('go_to_page', { page: 'drivers_groups' })
      cleanup()
    }
  })

  it('a store owner (2) and the other levels do not get it', async () => {
    for (const level of [2, 4, 8]) {
      env.user = { level }
      serve(PAGES)
      draw()
      await screen.findByText('This business is in the following driver groups')
      expect(screen.queryByRole('button', { name: 'Manage driver groups' })).toBeNull()
      cleanup()
    }
  })

  it('is there in the empty state too', async () => {
    serve({ 1: { result: [], pagination: { current_page: 1, total_pages: 1, page_size: 100, total: 0 } } })
    draw()
    await screen.findByText("This store isn't in any driver group.")
    expect(screen.getByRole('button', { name: 'Manage driver groups' })).toBeInTheDocument()
  })
})

describe('store editor: the driver groups tab · the tour', () => {
  it('has no tour open on its own, and anchors the list for it', async () => {
    serve(PAGES)
    const { container } = draw()
    await screen.findByText('Group 1')
    const anchor = container.querySelector('[data-tour="tour_delivery_completed"]')
    expect(anchor).not.toBeNull()
    expect(anchor).toContainElement(screen.getByRole('table'))
  })

  it('keeps the anchor in every state: loading, empty and error', async () => {
    let release
    mockFetch(() => new Promise(resolve => { release = () => resolve({ status: 200, json: async () => ({ result: [], pagination: { current_page: 1, total_pages: 1 } }) }) }))
    const loading = draw()
    expect(loading.container.querySelector('[data-tour="tour_delivery_completed"]')).not.toBeNull()
    release()
    await screen.findByText("This store isn't in any driver group.")
    expect(loading.container.querySelector('[data-tour="tour_delivery_completed"]')).not.toBeNull()
    cleanup()

    mockFetch(() => Promise.reject(new Error('boom')))
    const failed = draw()
    await screen.findByRole('alert')
    expect(failed.container.querySelector('[data-tour="tour_delivery_completed"]')).not.toBeNull()
  })
})

describe('store editor: the driver groups tab · no page UI (DG-B5)', () => {
  const read = (file) => readFileSync(resolvePath(__dirname, file), 'utf8')

  it('imports nothing from the delivery groups page but its pure helpers', () => {
    const source = read('../../../Stores/BusinessDeliveryGroupsDetails/index.js')
    const imports = [...source.matchAll(/from '([^']+)'/g)].map(match => match[1])
    expect(imports).toContain('../../Delivery/DriversGroupsDirectory/groupData')
    expect(imports.filter(path => /DriversGroupsDirectory/.test(path))).toEqual(['../../Delivery/DriversGroupsDirectory/groupData'])
    expect(imports.filter(path => /DriversGroupsListing|DriversGroupsList$|DriversGroupDetails|DriversGroupAddForm/.test(path))).toEqual([])
    expect(source).not.toMatch(/AsyncSwitch|Checkbox|DriversGroupsList\b/)
  })

  it('reads its groups through the hook, not the DriversGroupsList controller', () => {
    const source = read('../../../Stores/BusinessDeliveryGroupsDetails/index.js')
    expect(source).toContain("from './useStoreDriverGroups'")
    expect(source).not.toMatch(/DriversGroupsList as|DriversGroupsListController/)
  })
})
