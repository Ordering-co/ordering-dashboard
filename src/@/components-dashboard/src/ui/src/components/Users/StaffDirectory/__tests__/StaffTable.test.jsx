/* eslint-disable import/first */
// redesign BO-B3 (decisions 1, 7; auditor #3, #7d): the staff list (business owners) as a Product DataTable, and RecordCards
// under 768px. The Product wrappers and the real helpers (userContact, staffKinds) are real; only the environment (language,
// the phone flag, the layout) is simulated.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { StaffTable } from '../StaffTable'
import { STAFF_KINDS } from '../staffKinds'

const kind = STAFF_KINDS.business_owner

const stores = (count) => Array.from({ length: count }, (_, index) => ({ id: index + 1, name: ['Fast Bite', 'KCF', 'Pizza Hub'][index] ?? `Store ${index + 1}` }))

const ana = {
  id: 7,
  name: 'Ana',
  lastname: 'Ruiz',
  email: 'ana@example.com',
  country_phone_code: '1',
  cellphone: '5550100',
  email_verified: true,
  phone_verified: true,
  photo: 'https://example.com/ana.png',
  orders_count: 12,
  enabled: true,
  businesses: stores(31)
}
const marco = { id: 8, name: 'Marco', lastname: 'Toss', email: null, orders_count: 0, enabled: false, businesses: [] }
const lena = {
  id: 9,
  name: '',
  lastname: '',
  email: 'lena@example.com',
  cellphone: '5550142',
  orders_count: undefined,
  enabled: true
}
const duo = { id: 10, name: 'Duo', lastname: 'Two', orders_count: 3, enabled: true, businesses: stores(2) }
const solo = { id: 11, name: 'Solo', lastname: 'One', orders_count: 3, enabled: true, businesses: [{ id: 5, name: 'Only One' }] }

let current
const draw = (props = {}) => {
  current = {
    kind,
    users: [ana, marco, lena],
    loading: false,
    error: null,
    pageSize: 10,
    activeUserId: undefined,
    onOpenUser: vi.fn(),
    selection: { selectedIds: [], onToggle: vi.fn(), onToggleAll: vi.fn() },
    hasFilters: false,
    onClearFilters: vi.fn(),
    onRetry: vi.fn(),
    onAdd: vi.fn(),
    onToggleActive: vi.fn(),
    pendingIds: [],
    ...props
  }
  const view = render(<StaffTable {...current} />)
  return { ...view, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(<StaffTable {...current} />) } }
}

// jsdom has no layout: the width of the table's scroller is simulated (DataTable hides the columns whose `hideBelow` is above it)
let observers = []
class FakeResizeObserver {
  constructor (callback) { this.callback = callback }
  observe () { observers.push(this) }
  unobserve () {}
  disconnect () { observers = observers.filter(observer => observer !== this) }
}
const resizeTo = (width) => act(() => { observers.forEach(observer => observer.callback([{ contentRect: { width } }])) })

const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
// the data cells after the owner row header (the selection cell is not one of them): phone, stores, orders placed, status
const cellsOf = (row) => Array.from(row.querySelectorAll('td:not([data-selection])'))
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean)

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.phone = false
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('StaffTable columns', () => {
  it('has Business owner, Phone, Stores, Orders placed and Status, in that order', () => {
    draw()
    expect(headers()).toEqual(['Business owner', 'Phone', 'Stores', 'Orders placed', 'Status'])
    expect(screen.getByRole('table', { name: 'Business owners' })).toBeInTheDocument()
  })

  it('the first column is the kind\'s word (it is not hard-coded)', () => {
    draw({ kind: { ...kind, text: { ...kind.text, one: { key: 'CALL_CENTER_AGENT', text: 'Call center agent' } } } })
    expect(headers()[0]).toBe('Call center agent')
  })

  it('the owner cell: avatar, name, then «email · #id» with the id as a figure', () => {
    const { container } = draw()
    const header = within(rowOf(container, 7)).getByRole('rowheader')
    expect(header.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://example.com/ana.png')
    expect(within(header).getByText('Ana Ruiz')).toBeInTheDocument()
    expect(within(header).getByText('#7')).toHaveClass('odc-figure')
    expect(header.textContent).toMatch(/ana@example\.com.*·.*#7/)
  })

  it('without email only the #id shows; without a name it says «No name»', () => {
    const { container } = draw()
    const marcoHeader = within(rowOf(container, 8)).getByRole('rowheader')
    expect(marcoHeader.textContent).toContain('#8')
    expect(marcoHeader.textContent).not.toContain('·')
    const lenaHeader = within(rowOf(container, 9)).getByRole('rowheader')
    expect(within(lenaHeader).getByText('No name')).toBeInTheDocument()
    expect(lenaHeader).toHaveTextContent('lena@example.com')
  })

  it('the verified marks are named «Verified»: the email one after the email, the phone one in the Phone cell', () => {
    const { container } = draw()
    const row = rowOf(container, 7)
    const header = within(row).getByRole('rowheader')
    const emailMark = within(header).getByRole('img', { name: 'Verified' })
    const email = within(header).getByText('ana@example.com')
    expect(email.compareDocumentPosition(emailMark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const phone = cellsOf(row)[0]
    expect(within(phone).getByText('+1 5550100')).toBeInTheDocument()
    expect(within(phone).getByRole('img', { name: 'Verified' })).toBeInTheDocument()
    // an owner with nothing verified has no mark
    expect(within(rowOf(container, 9)).queryByRole('img', { name: 'Verified' })).toBeNull()
  })

  it('Phone is «—» (with its reason for a screen reader) when there is none', () => {
    const { container } = draw()
    const phone = cellsOf(rowOf(container, 8))[0]
    expect(phone).toHaveTextContent('—')
    expect(within(phone).getByText('No data')).toHaveClass('odc-sr-only')
  })

  it('Orders placed is a figure; 0 or missing is «New», not a figure', () => {
    const { container } = draw()
    const ordersOf = id => cellsOf(rowOf(container, id))[2]
    expect(within(ordersOf(7)).getByText('12')).toHaveClass('odc-figure')
    expect(ordersOf(8)).toHaveTextContent('New')
    expect(ordersOf(8).querySelector('.odc-figure')).toBeNull()
    expect(ordersOf(9)).toHaveTextContent('New')
    expect(screen.getAllByRole('columnheader').find(header => header.textContent === 'Orders placed')).toHaveAttribute('data-align', 'end')
  })
})

describe('StaffTable stores column', () => {
  const storesOf = (container, id) => cellsOf(rowOf(container, id))[1]

  it('31 stores: two names, a comma, «+29», and the title holds all the names', () => {
    const { container } = draw()
    const cell = storesOf(container, 7)
    expect(within(cell).getByText('Fast Bite, KCF')).toBeInTheDocument()
    expect(within(cell).getByText('+29')).toBeInTheDocument()
    expect(within(cell).getByText('and 29 more')).toHaveClass('odc-sr-only')
    const title = cell.querySelector('[title]').getAttribute('title')
    expect(title.split(', ')).toHaveLength(31)
    expect(title).toContain('Fast Bite')
    expect(title).toContain('Store 31')
  })

  it('two stores: both names, no «+N»; one store: its name alone', () => {
    const { container } = draw({ users: [duo, solo] })
    expect(storesOf(container, 10)).toHaveTextContent('Fast Bite, KCF')
    expect(storesOf(container, 10).textContent).not.toMatch(/\+/)
    expect(storesOf(container, 11)).toHaveTextContent('Only One')
    expect(storesOf(container, 11).textContent).not.toMatch(/\+|,/)
  })

  it('three stores: «+1»', () => {
    const { container } = draw({ users: [{ ...duo, businesses: stores(3) }] })
    expect(within(storesOf(container, 10)).getByText('+1')).toBeInTheDocument()
    expect(within(storesOf(container, 10)).getByText('and 1 more')).toBeInTheDocument()
  })

  it('an empty list says «No stores», muted; a store without a name is «#id»', () => {
    const { container } = draw({ users: [marco, { ...duo, businesses: [{ id: 42 }, { id: 43, name: '' }] }] })
    expect(within(storesOf(container, 8)).getByText('No stores')).toHaveClass('odc-sd-muted')
    expect(storesOf(container, 10)).toHaveTextContent('#42, #43')
  })

  it('without the property (the list did not ask for it) it is «—», not «No stores»', () => {
    const { container } = draw()
    const cell = storesOf(container, 9)
    expect(cell).toHaveTextContent('—')
    expect(within(cell).getByText('No data')).toHaveClass('odc-sr-only')
    expect(cell).not.toHaveTextContent('No stores')
  })

  it('reads the property the kind names (storesKey)', () => {
    const { container } = draw({
      kind: { ...kind, storesKey: 'businesses_agent' },
      users: [{ ...duo, businesses: [], businesses_agent: [{ id: 1, name: 'Agent Cafe' }] }]
    })
    expect(storesOf(container, 10)).toHaveTextContent('Agent Cafe')
  })

  it('with less width Orders placed steps aside first, then Phone, then Stores; the owner cell carries the phone only when Phone is gone', () => {
    const { container } = draw()
    resizeTo(2000)
    expect(headers()).toEqual(['Business owner', 'Phone', 'Stores', 'Orders placed', 'Status'])
    resizeTo(800)
    expect(headers()).toEqual(['Business owner', 'Phone', 'Stores', 'Status'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).not.toHaveTextContent('+1 5550100')
    // the list beside the record at 1440 (~620px): the stores stay, the phone moves under the name
    resizeTo(620)
    expect(headers()).toEqual(['Business owner', 'Stores', 'Status'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).toHaveTextContent('+1 5550100')
    resizeTo(300)
    expect(headers()).toEqual(['Business owner', 'Status'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).toHaveTextContent('+1 5550100')
    resizeTo(2000)
    expect(headers()).toEqual(['Business owner', 'Phone', 'Stores', 'Orders placed', 'Status'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).not.toHaveTextContent('+1 5550100')
  })
})

describe('StaffTable status switch', () => {
  it('shows «Active» / «Inactive» as visible text, checked by user.enabled', () => {
    const { container } = draw()
    const anaSwitch = within(rowOf(container, 7)).getByRole('switch')
    expect(anaSwitch).toHaveTextContent('Active')
    expect(anaSwitch).toHaveAttribute('aria-checked', 'true')
    const marcoSwitch = within(rowOf(container, 8)).getByRole('switch')
    expect(marcoSwitch).toHaveTextContent('Inactive')
    expect(marcoSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('pressing it calls onToggleActive(user, next) and never opens the row', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 8)).getByRole('switch'))
    expect(current.onToggleActive).toHaveBeenCalledWith(marco, true)
    await userEvent.click(within(rowOf(container, 7)).getByRole('switch'))
    expect(current.onToggleActive).toHaveBeenLastCalledWith(ana, false)
    expect(current.onOpenUser).not.toHaveBeenCalled()
  })

  it('the switch of an id in pendingIds is busy and ignores the press', async () => {
    const { container } = draw({ pendingIds: [8] })
    const busy = within(rowOf(container, 8)).getByRole('switch')
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(busy)
    expect(current.onToggleActive).not.toHaveBeenCalled()
    expect(within(rowOf(container, 7)).getByRole('switch')).not.toHaveAttribute('aria-busy')
  })
})

describe('StaffTable rows', () => {
  it('a click and Enter open the owner; the open one is aria-current', async () => {
    const { container } = draw({ activeUserId: 8 })
    expect(rowOf(container, 8)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 7)).not.toHaveAttribute('aria-current')
    await userEvent.click(within(rowOf(container, 7)).getByText('Ana Ruiz'))
    expect(current.onOpenUser).toHaveBeenCalledWith(ana)
    rowOf(container, 9).focus()
    await userEvent.keyboard('{Enter}')
    expect(current.onOpenUser).toHaveBeenLastCalledWith(lena)
  })

  it('selection: header «Select all» toggles this page, each row has «Select _name_», and neither opens the row', async () => {
    const selection = { selectedIds: [8], onToggle: vi.fn(), onToggleAll: vi.fn() }
    const { container } = draw({ selection })
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    expect(all).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(all)
    expect(selection.onToggleAll).toHaveBeenCalledWith([7, 8, 9])
    expect(within(rowOf(container, 8)).getByRole('checkbox', { name: 'Select Marco Toss' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(rowOf(container, 7)).getByRole('checkbox', { name: 'Select Ana Ruiz' }))
    expect(selection.onToggle).toHaveBeenCalledWith(7)
    expect(within(rowOf(container, 9)).getByRole('checkbox', { name: 'Select No name' })).toBeInTheDocument()
    expect(current.onOpenUser).not.toHaveBeenCalled()
  })

  it('without a selection prop there are no checkboxes', () => {
    draw({ selection: undefined })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})

describe('StaffTable states', () => {
  it('loading: a skeleton row per page-size item, announced once, no empty state', () => {
    const { container } = draw({ loading: true, users: [], pageSize: 6 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(6)
    expect(screen.getByText('Loading business owners')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No business owners yet')).toBeNull()
  })

  it('error: the kind\'s load error with Retry', async () => {
    draw({ error: ['Server down'], users: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the business owners.")
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('an empty error list is no error', () => {
    draw({ error: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('empty with filters: the kind\'s no-match text and Clear filters', async () => {
    draw({ users: [], hasFilters: true })
    expect(screen.getByText('No business owners match these filters')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(current.onClearFilters).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Add business owner' })).toBeNull()
  })

  it('empty without filters: the kind\'s empty text and its add button', async () => {
    draw({ users: [] })
    expect(screen.getByText('No business owners yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add business owner' }))
    expect(current.onAdd).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  // redesign the Inactive tab with nothing in it is not an empty directory
  it('empty Inactive tab without filters: «No inactive …» per kind and no add button', () => {
    draw({ users: [], inactive: true })
    expect(screen.getByText('No inactive business owners')).toBeInTheDocument()
    expect(screen.queryByText('No business owners yet')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add business owner' })).toBeNull()
  })

  it('every kind has its own «No inactive …» text', () => {
    expect(STAFF_KINDS.admin.text.emptyInactive.text).toBe('No inactive admins')
    expect(STAFF_KINDS.callcenter_agent.text.emptyInactive.text).toBe('No inactive call center agents')
    expect(STAFF_KINDS.professional.text.emptyInactive.text).toBe('No inactive professionals')
  })

  it('empty Inactive tab with filters keeps the no-match text and Clear filters', () => {
    draw({ users: [], inactive: true, hasFilters: true })
    expect(screen.getByText('No business owners match these filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })
})

describe('StaffTable on a phone (cards)', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, no table: name, contact, orders, stores, the checkbox and the switch', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const card = container.querySelector('li[data-row-id="7"]')
    expect(within(card).getByRole('link', { name: 'Ana Ruiz' })).toBeInTheDocument()
    expect(card).toHaveTextContent('ana@example.com')
    expect(card).toHaveTextContent('+1 5550100')
    expect(within(card).getByText('12')).toHaveClass('odc-figure')
    expect(card).toHaveTextContent('Stores')
    expect(within(card).getByText('Fast Bite, KCF')).toBeInTheDocument()
    expect(within(card).getByText('+29')).toBeInTheDocument()
    expect(within(card).getByRole('checkbox', { name: 'Select Ana Ruiz' })).toBeInTheDocument()
    expect(within(card).getByRole('switch')).toHaveTextContent('Active')
  })

  it('never shows a datum twice', () => {
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="7"]')
    expect(card.textContent.match(/Ana Ruiz/g)).toHaveLength(1)
    expect(card.textContent.match(/ana@example\.com/g)).toHaveLength(1)
    expect(card.textContent.match(/5550100/g)).toHaveLength(1)
    expect(card.textContent.match(/#7/g)).toHaveLength(1)
  })

  it('«No stores» for an empty list; nothing for a list that did not ask; «New» for no orders', () => {
    const { container } = draw()
    expect(container.querySelector('li[data-row-id="8"]')).toHaveTextContent('No stores')
    expect(container.querySelector('li[data-row-id="8"]')).toHaveTextContent('New')
    expect(container.querySelector('li[data-row-id="9"]')).not.toHaveTextContent('No stores')
  })

  it('the card opens the owner; the checkbox and the switch do not', async () => {
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="8"]')
    await userEvent.click(within(card).getByRole('checkbox'))
    expect(current.selection.onToggle).toHaveBeenCalledWith(8)
    await userEvent.click(within(card).getByRole('switch'))
    expect(current.onToggleActive).toHaveBeenCalledWith(marco, true)
    expect(current.onOpenUser).not.toHaveBeenCalled()
    await userEvent.click(within(card).getByRole('link', { name: 'Marco Toss' }))
    expect(current.onOpenUser).toHaveBeenCalledWith(marco)
  })

  it('the card is a link to ?id= that keeps the other params', () => {
    window.history.replaceState(null, '', '/users/business-owners?enabled=inactive&page=2')
    const { container } = draw()
    const link = within(container.querySelector('li[data-row-id="7"]')).getByRole('link', { name: 'Ana Ruiz' })
    const params = new URLSearchParams(link.getAttribute('href').split('?')[1])
    expect(link.getAttribute('href').startsWith('/users/business-owners?')).toBe(true)
    expect(Object.fromEntries(params)).toEqual({ enabled: 'inactive', page: '2', id: '7' })
    window.history.replaceState(null, '', '/')
  })

  it('«Select all»: mixed when some of the page is selected, true when all, and it toggles the page ids', async () => {
    const selection = { selectedIds: [8], onToggle: vi.fn(), onToggleAll: vi.fn() }
    const { rerenderWith } = draw({ selection })
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    expect(all).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(all)
    expect(selection.onToggleAll).toHaveBeenCalledWith([7, 8, 9])
    expect(current.onOpenUser).not.toHaveBeenCalled()
    rerenderWith({ selection: { ...selection, selectedIds: [7, 8, 9] } })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
    rerenderWith({ selection: { ...selection, selectedIds: [] } })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'false')
  })

  it('with no selection prop there is no «Select all»', () => {
    draw({ selection: undefined })
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
  })

  it('the open owner is current, a busy id shows the switch busy', () => {
    const { container } = draw({ activeUserId: 7, pendingIds: [8] })
    expect(container.querySelector('li[data-row-id="7"]')).toHaveAttribute('aria-current', 'true')
    expect(within(container.querySelector('li[data-row-id="8"]')).getByRole('switch')).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps the four states: skeleton cards, error with Retry, no match, empty', async () => {
    const loading = draw({ loading: true, users: [], pageSize: 4 })
    expect(loading.container.querySelectorAll('li[data-skeleton]')).toHaveLength(4)
    loading.unmount()
    const failed = draw({ error: ['x'], users: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    failed.unmount()
    const noMatch = draw({ users: [], hasFilters: true })
    expect(screen.getByText('No business owners match these filters')).toBeInTheDocument()
    noMatch.unmount()
    draw({ users: [] })
    expect(screen.getByText('No business owners yet')).toBeInTheDocument()
  })
})

// redesign (decision 9, CA-4): a kind may name its orders column (`text.ordersColumn`) and count a first-timer as the figure 0
// (`ordersZeroAsNumber`), and an empty list has no «Select all» to offer. The kind below is a test copy of the owner's with those fields:
// it does not import `callcenter_agents`.
describe('StaffTable with a kind that names its orders column and counts zero', () => {
  const agentKind = {
    ...kind,
    level: 9,
    storesKey: 'businesses_agent',
    ordersZeroAsNumber: true,
    text: { ...kind.text, ordersColumn: { key: 'X_OWN', text: 'Own orders' } }
  }
  const agentRows = [
    { id: 21, name: 'Ada', lastname: 'Lopez', email: 'ada@example.com', orders_count: 4, enabled: true, businesses_agent: [{ id: 1, name: 'Fast Bite' }] },
    { id: 22, name: 'Ben', lastname: 'Cruz', email: 'ben@example.com', orders_count: 0, enabled: true, businesses_agent: [] },
    { id: 23, name: 'Cy', lastname: 'Diaz', email: 'cy@example.com', orders_count: undefined, enabled: true, businesses_agent: [{ id: 7 }] }
  ]
  const ordersOf = (container, id) => cellsOf(rowOf(container, id))[2]

  describe('on a table (1440)', () => {
    it('the orders column takes the kind\'s header, not «Orders placed»', () => {
      draw({ kind: agentKind, users: agentRows })
      expect(headers()).toEqual(['Business owner', 'Phone', 'Stores', 'Own orders', 'Status'])
    })

    it('with the mark, 0 and a missing count are the figure 0, not «New»', () => {
      const { container } = draw({ kind: agentKind, users: agentRows })
      expect(within(ordersOf(container, 21)).getByText('4')).toHaveClass('odc-figure')
      expect(within(ordersOf(container, 22)).getByText('0')).toHaveClass('odc-figure')
      expect(within(ordersOf(container, 23)).getByText('0')).toHaveClass('odc-figure')
      expect(screen.queryByText('New')).toBeNull()
    })

    it('without the mark 0 is still «New», even with the kind\'s header', () => {
      const { container } = draw({ kind: { ...agentKind, ordersZeroAsNumber: undefined }, users: agentRows })
      expect(headers()).toContain('Own orders')
      expect(ordersOf(container, 22)).toHaveTextContent('New')
      expect(ordersOf(container, 22).querySelector('.odc-figure')).toBeNull()
    })

    it('a kind with no `ordersColumn` keeps «Orders placed»', () => {
      draw({ kind: { ...agentKind, text: kind.text }, users: agentRows })
      expect(headers()).toContain('Orders placed')
      expect(headers()).not.toContain('Own orders')
    })

    it('a store with no name in the kind\'s key is «#id»', () => {
      const { container } = draw({ kind: agentKind, users: agentRows })
      expect(cellsOf(rowOf(container, 23))[1]).toHaveTextContent('#7')
    })
  })

  describe('on a phone (390)', () => {
    beforeEach(() => { mocks.phone = true })
    const card = (container, id) => container.querySelector(`li[data-row-id="${id}"]`)

    it('the metric is labeled with the kind\'s word, and with 0 it is the labeled figure 0', () => {
      const { container } = draw({ kind: agentKind, users: agentRows })
      const withOrders = card(container, 21)
      expect(within(withOrders).getByText('Own orders')).toHaveClass('odc-sd-metric-label')
      expect(withOrders.textContent).not.toContain('Orders placed')
      const zero = card(container, 22)
      expect(within(zero).getByText('Own orders')).toHaveClass('odc-sd-metric-label')
      expect(within(zero).getByText('0')).toHaveClass('odc-figure')
      expect(zero.textContent).not.toContain('New')
      expect(within(card(container, 23)).getByText('0')).toHaveClass('odc-figure')
    })

    it('without the mark 0 is «New» with no label, as for the owners', () => {
      const { container } = draw({ kind: { ...agentKind, ordersZeroAsNumber: undefined }, users: agentRows })
      expect(card(container, 22)).toHaveTextContent('New')
      expect(card(container, 22).textContent).not.toContain('Own orders')
    })

    it('a kind with no `ordersColumn` labels the metric «Orders placed»', () => {
      const { container } = draw({ kind: { ...agentKind, text: kind.text }, users: agentRows })
      expect(within(card(container, 21)).getByText('Orders placed')).toHaveClass('odc-sd-metric-label')
    })

    it('a store with no name in the kind\'s key is «#id»', () => {
      const { container } = draw({ kind: agentKind, users: agentRows })
      expect(card(container, 23)).toHaveTextContent('#7')
    })
  })
})

// redesign AD-B1: the admin kind has no stores (`storesKey: null`): no column, no line on the card, no «No stores»
describe('StaffTable with the admin kind (no stores)', () => {
  const adminKind = STAFF_KINDS.admin
  const adminRows = [
    { id: 31, name: 'Ada', lastname: 'Root', email: 'ada@example.com', cellphone: '5550101', country_phone_code: '1', orders_count: 5, enabled: true, level: 0 },
    { id: 32, name: 'Ben', lastname: 'Sudo', email: 'ben@example.com', orders_count: 0, enabled: true, level: 0 }
  ]

  it('has Admin, Phone, Orders placed and Status; no Stores', () => {
    draw({ kind: adminKind, users: adminRows })
    expect(headers()).toEqual(['Admin', 'Phone', 'Orders placed', 'Status'])
    expect(screen.getByRole('table', { name: 'Admins' })).toBeInTheDocument()
  })

  it('the cells are phone, orders and status, with no stores cell, and 0 orders is «New»', () => {
    const { container } = draw({ kind: adminKind, users: adminRows })
    const cells = cellsOf(rowOf(container, 31))
    expect(cells).toHaveLength(3)
    expect(cells[0]).toHaveTextContent('+1 5550101')
    expect(within(cells[1]).getByText('5')).toHaveClass('odc-figure')
    expect(within(cells[2]).getByRole('switch')).toBeInTheDocument()
    expect(cellsOf(rowOf(container, 32))[1]).toHaveTextContent('New')
    expect(container.textContent).not.toContain('No stores')
  })

  it('with less width Orders placed steps aside first, then Phone (nothing else outranks the owner column)', () => {
    const { container } = draw({ kind: adminKind, users: adminRows })
    resizeTo(2000)
    expect(headers()).toEqual(['Admin', 'Phone', 'Orders placed', 'Status'])
    resizeTo(600) // the table asks 668 with everything, 558 without Orders placed
    expect(headers()).toEqual(['Admin', 'Phone', 'Status'])
    resizeTo(300)
    expect(headers()).toEqual(['Admin', 'Status'])
    expect(within(rowOf(container, 31)).getByRole('rowheader')).toHaveTextContent('+1 5550101')
  })

  it('does not read a stores property: a row that carries one still shows no stores', () => {
    const { container } = draw({ kind: adminKind, users: [{ ...adminRows[0], businesses: stores(2) }] })
    expect(headers()).not.toContain('Stores')
    expect(container.textContent).not.toContain('Fast Bite')
  })

  it('the owners\' table still has its Stores column', () => {
    draw()
    expect(headers()).toContain('Stores')
  })

  it('the states speak of admins', async () => {
    draw({ kind: adminKind, users: [] })
    expect(screen.getByText('No admins yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add admin' }))
    expect(current.onAdd).toHaveBeenCalledTimes(1)
  })

  describe('on a phone (390)', () => {
    beforeEach(() => { mocks.phone = true })
    const card = (container, id) => container.querySelector(`li[data-row-id="${id}"]`)

    it('the card has no stores line and no «No stores», even for a row that carries an empty list', () => {
      const { container } = draw({ kind: adminKind, users: [...adminRows, { ...adminRows[1], id: 33, businesses: [] }] })
      adminRows.concat({ id: 33 }).forEach(({ id }) => {
        expect(card(container, id).textContent).not.toContain('Stores')
        expect(card(container, id).textContent).not.toContain('No stores')
      })
      expect(card(container, 31)).toHaveTextContent('ada@example.com')
      expect(within(card(container, 31)).getByText('5')).toHaveClass('odc-figure')
      expect(within(card(container, 31)).getByRole('switch')).toHaveTextContent('Active')
      expect(card(container, 32)).toHaveTextContent('New')
    })

    it('the owners\' card still has its stores line', () => {
      const { container } = draw()
      expect(card(container, 7)).toHaveTextContent('Stores')
    })
  })
})

describe('StaffTable with no rows has no «Select all» (CA-4)', () => {
  it('a list that loaded empty, with no filters and no error: no «Select all» over an empty table', () => {
    draw({ users: [] })
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    expect(screen.getByText('No business owners yet')).toBeInTheDocument()
  })

  it('a list that loaded empty with filters: neither', () => {
    draw({ users: [], hasFilters: true })
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    expect(screen.getByText('No business owners match these filters')).toBeInTheDocument()
  })

  it('with rows the header still has «Select all» and it toggles the page', async () => {
    draw()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(current.selection.onToggleAll).toHaveBeenCalledWith([7, 8, 9])
  })

  it('on a phone there is none for an empty list either', () => {
    mocks.phone = true
    draw({ users: [] })
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
  })
})

// redesign (B1b, decisions 3 and 11; auditor 11): the professional kind brings its own columns (Occupation, City, Email), the
// column manager with its storage, the email out of the Professional cell, and its own card lines. The other kinds keep what they had.
describe('StaffTable with the professional kind', () => {
  const proKind = STAFF_KINDS.professional
  const STORAGE_KEY = 'od.professionals.columns'
  const pros = [
    { id: 41, name: 'Bea', lastname: 'Cut', email: 'bea@example.com', email_verified: true, country_phone_code: '34', cellphone: '600111222', phone_verified: true, occupation: { id: 2, name: 'Barber' }, city: { id: 1, name: 'Madrid' }, enabled: true },
    { id: 42, name: 'Tom', lastname: 'Rest', email: 'tom@example.com', occupation: null, city: null, enabled: false }
  ]
  const proDraw = (props = {}) => draw({ kind: proKind, users: pros, ...props })
  const cell = (container, id, index) => cellsOf(rowOf(container, id))[index]
  const openManager = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
    return screen.findByRole('dialog')
  }

  beforeEach(() => { window.localStorage.removeItem(STORAGE_KEY) })
  afterEach(() => { window.localStorage.removeItem(STORAGE_KEY) })

  describe('on a table (1440)', () => {
    it('has Professional, Occupation, City, Phone, Email and Status, in that order', () => {
      proDraw()
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
      expect(screen.getByRole('table', { name: 'Professionals' })).toBeInTheDocument()
    })

    it('Occupation is the name, or «—» named «No occupation» when there is none', () => {
      const { container } = proDraw()
      expect(cell(container, 41, 0)).toHaveTextContent('Barber')
      const none = cell(container, 42, 0)
      expect(none.querySelector('[aria-hidden="true"]')).toHaveTextContent('—')
      expect(within(none).getByText('No occupation')).toHaveClass('odc-sr-only')
    })

    it('City is the name, or «—» with its reason; a city that comes as a plain name works too', () => {
      const { container } = proDraw({ users: [...pros, { id: 43, name: 'Zed', city: 'Lugo', enabled: true }] })
      expect(cell(container, 41, 1)).toHaveTextContent('Madrid')
      expect(cell(container, 42, 1)).toHaveTextContent('—')
      expect(within(cell(container, 42, 1)).getByText('No data')).toHaveClass('odc-sr-only')
      expect(cell(container, 43, 1)).toHaveTextContent('Lugo')
    })

    it('Email is the address in a <bdi>, with its verified mark', () => {
      const { container } = proDraw()
      const email = cell(container, 41, 3)
      expect(email.querySelector('bdi')).toHaveTextContent('bea@example.com')
      expect(within(email).getByRole('img', { name: 'Verified' })).toBeInTheDocument()
      expect(within(cell(container, 42, 3)).queryByRole('img', { name: 'Verified' })).toBeNull()
    })

    it('the Professional cell has the name and the #id, and NOT the email while the Email column is there (auditor 11)', () => {
      const { container } = proDraw()
      const header = within(rowOf(container, 41)).getByRole('rowheader')
      expect(within(header).getByText('Bea Cut')).toBeInTheDocument()
      expect(within(header).getByText('#41')).toHaveClass('odc-figure')
      expect(header).not.toHaveTextContent('bea@example.com')
      expect(rowOf(container, 41).textContent.match(/bea@example\.com/g)).toHaveLength(1)
    })

    it('with less width the Email steps aside first, then City, Phone and Occupation; the address moves under the name, the phone too', () => {
      const { container } = proDraw()
      resizeTo(2000)
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
      resizeTo(900)
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Status'])
      expect(within(rowOf(container, 41)).getByRole('rowheader')).toHaveTextContent('bea@example.com')
      resizeTo(780)
      expect(headers()).toEqual(['Professional', 'Occupation', 'Phone', 'Status'])
      resizeTo(650)
      expect(headers()).toEqual(['Professional', 'Occupation', 'Status'])
      expect(within(rowOf(container, 41)).getByRole('rowheader')).toHaveTextContent('+34 600111222')
      resizeTo(400)
      expect(headers()).toEqual(['Professional', 'Status'])
      resizeTo(2000)
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
      expect(within(rowOf(container, 41)).getByRole('rowheader')).not.toHaveTextContent('bea@example.com')
    })

    it('has no Stores or Orders column, and no «New»', () => {
      proDraw()
      expect(headers()).not.toContain('Stores')
      expect(headers().join()).not.toMatch(/Orders/)
      expect(screen.queryByText('New')).toBeNull()
    })
  })

  describe('the column manager', () => {
    it('is there, offers the six columns, and Professional and Status cannot be hidden', async () => {
      proDraw()
      const dialog = await openManager()
      expect(within(dialog).getAllByRole('checkbox').map(box => box.getAttribute('aria-label') ?? box.textContent)).toEqual(
        expect.arrayContaining(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
      )
      expect(within(dialog).getAllByRole('checkbox')).toHaveLength(6)
      expect(within(dialog).getByRole('checkbox', { name: 'Professional' })).toBeDisabled()
      expect(within(dialog).getByRole('checkbox', { name: 'Status' })).toBeDisabled()
      ;['Occupation', 'City', 'Phone', 'Email'].forEach(name => expect(within(dialog).getByRole('checkbox', { name })).toBeEnabled())
    })

    it('hiding City takes it off the table and saves the choice', async () => {
      proDraw()
      const dialog = await openManager()
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'City' }))
      expect(headers()).toEqual(['Professional', 'Occupation', 'Phone', 'Email', 'Status'])
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
      expect(stored.find(column => column.id === 'city')).toEqual({ id: 'city', visible: false })
      expect(stored.map(column => column.id)).toEqual(['owner', 'occupation', 'city', 'phone', 'email', 'status'])
    })

    it('a saved choice is read back when the table is drawn again', async () => {
      const first = proDraw()
      const dialog = await openManager()
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'City' }))
      first.unmount()
      proDraw()
      expect(headers()).toEqual(['Professional', 'Occupation', 'Phone', 'Email', 'Status'])
    })

    it('moving a column changes the order of the table', async () => {
      proDraw()
      const dialog = await openManager()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Move Phone up' }))
      expect(headers()).toEqual(['Professional', 'Occupation', 'Phone', 'City', 'Email', 'Status'])
    })

    it('hiding Email puts nothing under the name: the person chose it', async () => {
      const { container } = proDraw()
      const dialog = await openManager()
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Email' }))
      expect(headers()).not.toContain('Email')
      expect(within(rowOf(container, 41)).getByRole('rowheader')).not.toHaveTextContent('bea@example.com')
    })

    it('Reset brings back the kind\'s columns, in its order, and forgets the choice', async () => {
      proDraw()
      const dialog = await openManager()
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'City' }))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Move Phone up' }))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
      const stored = window.localStorage.getItem(STORAGE_KEY)
      expect(stored === null || JSON.parse(stored).every(column => column.visible)).toBe(true)
    })

    it('a stored value that is not a list, or names unknown columns, is ignored or cleaned; a new column of the kind shows', () => {
      window.localStorage.setItem(STORAGE_KEY, '{"nope":true}')
      const first = proDraw()
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
      first.unmount()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'ghost', visible: false }, { id: 'owner', visible: false }, { id: 'status', visible: true }, { id: 'phone', visible: false }]))
      proDraw()
      // owner is locked (always shown); phone is hidden; the columns the stored list did not know come after, shown
      expect(headers()).toEqual(['Professional', 'Status', 'Occupation', 'City', 'Email'])
    })

    it('when the storage throws (private mode), it works in memory only: reading and writing', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
      proDraw()
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
      const dialog = await openManager()
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'City' }))
      expect(headers()).toEqual(['Professional', 'Occupation', 'Phone', 'Email', 'Status'])
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
      expect(headers()).toEqual(['Professional', 'Occupation', 'City', 'Phone', 'Email', 'Status'])
    })

    it('the kinds that exist today have no column manager and keep their columns', () => {
      ;['business_owner', 'callcenter_agent', 'admin'].forEach((name) => {
        const view = draw({ kind: STAFF_KINDS[name] })
        expect(screen.queryByRole('button', { name: 'Manage columns' }), name).toBeNull()
        expect(headers().join()).not.toMatch(/Occupation|City|Email/)
        view.unmount()
      })
    })

    it('the owners\' Business owner cell keeps its email under the name', () => {
      const { container } = draw()
      expect(within(rowOf(container, 7)).getByRole('rowheader')).toHaveTextContent('ana@example.com')
    })
  })

  describe('on a phone (390)', () => {
    beforeEach(() => { mocks.phone = true })
    const card = (container, id) => container.querySelector(`li[data-row-id="${id}"]`)

    it('the card: name, «Barber · Madrid», the phone, and the switch; no column manager, no «New», no orders or stores', () => {
      const { container } = proDraw()
      const first = card(container, 41)
      expect(within(first).getByRole('link', { name: 'Bea Cut' })).toBeInTheDocument()
      expect(first).toHaveTextContent('Barber · Madrid')
      expect(first).toHaveTextContent('+34 600111222')
      expect(within(first).getByRole('switch')).toHaveTextContent('Active')
      expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
      expect(first.textContent).not.toMatch(/New|Stores|Orders/)
      expect(card(container, 42).textContent).not.toMatch(/New|Stores|Orders/)
    })

    it('the occupation and the city line shows each only if it exists, and not at all if neither does', () => {
      const { container } = proDraw({
        users: [
          { id: 51, name: 'A', lastname: 'One', occupation: { id: 1, name: 'Stylist' }, enabled: true },
          { id: 52, name: 'B', lastname: 'Two', city: { id: 1, name: 'Lugo' }, enabled: true },
          { id: 53, name: 'C', lastname: 'Three', enabled: true }
        ]
      })
      const lineOf = id => card(container, id).querySelector('.odc-sd-card-where')
      expect(lineOf(51)).toHaveTextContent(/^Stylist$/)
      expect(lineOf(52)).toHaveTextContent(/^Lugo$/)
      expect(lineOf(53)).toBeNull()
    })

    it('never shows a datum twice', () => {
      const { container } = proDraw()
      const first = card(container, 41)
      ;[/Bea Cut/g, /bea@example\.com/g, /600111222/g, /Barber/g, /Madrid/g, /#41/g].forEach(pattern => expect(first.textContent.match(pattern), String(pattern)).toHaveLength(1))
    })

    it('the owners\' card has no occupation line', () => {
      const { container } = draw()
      expect(container.querySelector('.odc-sd-card-where')).toBeNull()
    })
  })
})

// redesign D-3 (owner, 2026-10-19): the signed-in person is on their own list (admins in practice, any kind in principle): their
// switch and their checkbox stay, DISABLED, each with its reason (accessible description and a visible title)
describe('StaffTable: the signed-in person\'s own row (D-3)', () => {
  const DEACTIVATE = "You can't deactivate your own account."
  const DELETE = "You can't delete your own account."
  const SELF = "You can't deactivate or delete your own account."
  const adminKind = STAFF_KINDS.admin
  const adminRows = [
    { id: 31, name: 'Ada', lastname: 'Root', email: 'ada@example.com', orders_count: 5, enabled: true, level: 0 },
    { id: 32, name: 'Ben', lastname: 'Sudo', email: 'ben@example.com', orders_count: 0, enabled: true, level: 0 }
  ]

  it('the switch is disabled and says why; the others are not', async () => {
    const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 31 })
    const own = within(rowOf(container, 31)).getByRole('switch')
    expect(own).toBeDisabled()
    expect(own).toHaveAccessibleDescription(DEACTIVATE)
    expect(within(rowOf(container, 31)).getByTitle(DEACTIVATE)).toContainElement(own)
    await userEvent.click(own)
    expect(current.onToggleActive).not.toHaveBeenCalled()
    const other = within(rowOf(container, 32)).getByRole('switch')
    expect(other).not.toBeDisabled()
    expect(other).not.toHaveAttribute('aria-describedby')
  })

  it('the checkbox is disabled and says why; select-all asks for the others only', async () => {
    const selection = { selectedIds: [], onToggle: vi.fn(), onToggleAll: vi.fn() }
    const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 31, selection })
    const own = within(rowOf(container, 31)).getByRole('checkbox', { name: 'Select Ada Root' })
    expect(own).toBeDisabled()
    expect(own).toHaveAccessibleDescription(DELETE)
    expect(within(rowOf(container, 31)).getByTitle(DELETE)).toBeInTheDocument()
    await userEvent.click(own)
    expect(selection.onToggle).not.toHaveBeenCalled()
    expect(within(rowOf(container, 32)).getByRole('checkbox', { name: 'Select Ben Sudo' })).not.toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(selection.onToggleAll).toHaveBeenCalledWith([32])
  })

  it('it is the same for every kind (the id decides, not the kind)', () => {
    const { container } = draw({ currentUserId: 8 })
    expect(within(rowOf(container, 8)).getByRole('switch')).toBeDisabled()
    expect(within(rowOf(container, 8)).getByRole('checkbox', { name: 'Select Marco Toss' })).toBeDisabled()
    expect(within(rowOf(container, 7)).getByRole('switch')).not.toBeDisabled()
  })

  it('without a signed-in id nothing is disabled', () => {
    draw({ kind: adminKind, users: adminRows })
    screen.getAllByRole('switch').forEach(control => expect(control).not.toBeDisabled())
    screen.getAllByRole('checkbox').forEach(control => expect(control).not.toBeDisabled())
  })

  describe('on a phone (390)', () => {
    beforeEach(() => { mocks.phone = true })

    it('the card\'s switch and checkbox are disabled with their reasons; select-all leaves the person out', async () => {
      const selection = { selectedIds: [32], onToggle: vi.fn(), onToggleAll: vi.fn() }
      const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 31, selection })
      const own = container.querySelector('li[data-row-id="31"]')
      expect(within(own).getByRole('switch')).toBeDisabled()
      expect(within(own).getByRole('switch')).toHaveAccessibleDescription(DEACTIVATE)
      expect(within(own).getByRole('checkbox', { name: 'Select Ada Root' })).toBeDisabled()
      expect(within(own).getByRole('checkbox', { name: 'Select Ada Root' })).toHaveAccessibleDescription(DELETE)
      const other = container.querySelector('li[data-row-id="32"]')
      expect(within(other).getByRole('switch')).not.toBeDisabled()
      expect(within(other).getByRole('checkbox', { name: 'Select Ben Sudo' })).not.toBeDisabled()
      // 32 is the only one that can be selected and it is: the header reads «all»
      const all = screen.getByRole('checkbox', { name: 'Select all' })
      expect(all).toHaveAttribute('aria-checked', 'true')
      await userEvent.click(all)
      expect(selection.onToggleAll).toHaveBeenCalledWith([32])
    })

    // redesign R-4: a touch user has no tooltip, so the own card says the reason in a visible line, once, under both controls
    it('the own card shows the reason as a visible line and its checkbox wears the disabled state; the others have neither', () => {
      const selection = { selectedIds: [], onToggle: vi.fn(), onToggleAll: vi.fn() }
      const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 31, selection })
      const own = container.querySelector('li[data-row-id="31"]')
      const note = within(own).getByText(SELF)
      expect(note).toHaveClass('odc-sd-self-note')
      expect(note).not.toHaveClass('odc-sr-only')
      expect(note.closest('[data-card-actions]')).not.toBeNull()
      // the per-control texts stay
      expect(within(own).getByTitle(DEACTIVATE)).toBeInTheDocument()
      expect(within(own).getByTitle(DELETE)).toBeInTheDocument()
      expect(within(own).getByRole('checkbox', { name: 'Select Ada Root' })).toHaveAttribute('data-disabled')
      const other = container.querySelector('li[data-row-id="32"]')
      expect(within(other).queryByText(SELF)).toBeNull()
      expect(other.querySelector('.odc-sd-self-note')).toBeNull()
      expect(within(other).getByRole('checkbox', { name: 'Select Ben Sudo' })).not.toHaveAttribute('data-disabled')
    })

    it('without selection the own card still says the reason (the switch is disabled)', () => {
      const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 31 })
      expect(within(container.querySelector('li[data-row-id="31"]')).getByText(SELF)).toBeInTheDocument()
    })
  })

  it('the 1440 table keeps its layout: the reason is only the tooltip and the sr text', () => {
    const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 31 })
    expect(screen.queryByText(SELF)).toBeNull()
    expect(container.querySelector('.odc-sd-self-note')).toBeNull()
  })
})

describe('StaffTable: a protected account', () => {
  const DEACTIVATE = "You can't deactivate a protected account."
  const DELETE = "You can't delete a protected account."
  const NOTE = "This account is protected. You can't deactivate or delete it."
  const adminKind = STAFF_KINDS.admin
  const adminRows = [
    { id: 31, name: 'Ada', lastname: 'Root', email: 'ada@example.com', orders_count: 5, enabled: true, level: 0, protected: true },
    { id: 32, name: 'Ben', lastname: 'Sudo', email: 'ben@example.com', orders_count: 0, enabled: true, level: 0, protected: false }
  ]

  it('the switch is disabled and says why; the others are not', async () => {
    const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 1 })
    const locked = within(rowOf(container, 31)).getByRole('switch')
    expect(locked).toBeDisabled()
    expect(locked).toHaveAccessibleDescription(DEACTIVATE)
    expect(within(rowOf(container, 31)).getByTitle(DEACTIVATE)).toContainElement(locked)
    await userEvent.click(locked)
    expect(current.onToggleActive).not.toHaveBeenCalled()
    const other = within(rowOf(container, 32)).getByRole('switch')
    expect(other).not.toBeDisabled()
    expect(other).not.toHaveAttribute('aria-describedby')
  })

  it('an inactive protected account can still be activated', async () => {
    const rows = [{ ...adminRows[0], enabled: false }, adminRows[1]]
    const { container } = draw({ kind: adminKind, users: rows, currentUserId: 1 })
    const locked = within(rowOf(container, 31)).getByRole('switch')
    expect(locked).not.toBeDisabled()
    await userEvent.click(locked)
    expect(current.onToggleActive).toHaveBeenCalledWith(rows[0], true)
  })

  it('the checkbox is disabled and says why; select-all asks for the others only', async () => {
    const selection = { selectedIds: [], onToggle: vi.fn(), onToggleAll: vi.fn() }
    const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 1, selection })
    const locked = within(rowOf(container, 31)).getByRole('checkbox', { name: 'Select Ada Root' })
    expect(locked).toBeDisabled()
    expect(locked).toHaveAccessibleDescription(DELETE)
    await userEvent.click(locked)
    expect(selection.onToggle).not.toHaveBeenCalled()
    expect(within(rowOf(container, 32)).getByRole('checkbox', { name: 'Select Ben Sudo' })).not.toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(selection.onToggleAll).toHaveBeenCalledWith([32])
  })

  describe('on a phone (390)', () => {
    beforeEach(() => { mocks.phone = true })

    it('the card says the reason in a visible line and leaves the account out of select-all', async () => {
      const selection = { selectedIds: [], onToggle: vi.fn(), onToggleAll: vi.fn() }
      const { container } = draw({ kind: adminKind, users: adminRows, currentUserId: 1, selection })
      const locked = container.querySelector('li[data-row-id="31"]')
      expect(within(locked).getByRole('switch')).toBeDisabled()
      expect(within(locked).getByRole('checkbox', { name: 'Select Ada Root' })).toBeDisabled()
      expect(within(locked).getByText(NOTE)).toHaveClass('odc-sd-self-note')
      const other = container.querySelector('li[data-row-id="32"]')
      expect(within(other).queryByText(NOTE)).toBeNull()
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
      expect(selection.onToggleAll).toHaveBeenCalledWith([32])
    })
  })
})

describe('staff-table.css (R-4)', () => {
  const css = readFileSync(resolve(__dirname, '../staff-table.css'), 'utf8')

  it('the own card\'s disabled checkbox and its note use tokens only', () => {
    expect(css).toMatch(/\.odc-sd-self-note/)
    expect(css).toMatch(/\.odc-sd-card-actions \.odc-checkbox\[data-disabled\]/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
    expect(css).not.toMatch(/font-size:\s*[\d.]+(px|rem|em)/)
  })
})
