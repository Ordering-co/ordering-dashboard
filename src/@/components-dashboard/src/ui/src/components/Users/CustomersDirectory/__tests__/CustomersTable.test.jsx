/* eslint-disable import/first */
// redesign UC-B2 (decisions 7, 8; defects M-C4, M-C8, M-C10, M-C14, M-10): the customers list as a Product DataTable (and
// RecordCards under 768px). Values come out of the REAL UtilsProviders (parsePrice) and the real helpers of customerData.js;
// only the environment (language, config, the phone flag) is simulated. The Product wrappers are real.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils
  }
})
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'
import { CustomersTable } from '../CustomersTable'

const CASH_ON = { addon_cash_wallet_and_refunds: { value: '1' } }

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
  wallets: [{ id: 1, type: 'cash', balance: 34.2 }, { id: 2, type: 'credit_point', balance: 300 }]
}
const marco = { id: 8, name: 'Marco', lastname: 'Toss', email: null, orders_count: 0, enabled: false, wallets: [] }
const lena = {
  id: 9,
  name: '',
  lastname: '',
  email: 'lena@example.com',
  cellphone: '5550142',
  orders_count: undefined,
  enabled: true,
  wallets: [{ id: 3, type: 'cash', balance: -5 }]
}

const util = {}
const Probe = () => {
  Object.assign(util, useUtils()[0])
  return null
}

let current
const draw = (props = {}) => {
  current = {
    users: [ana, marco, lena],
    loading: false,
    error: null,
    pageSize: 10,
    configs: {},
    activeUserId: undefined,
    onOpenUser: vi.fn(),
    selection: { selectedIds: [], onToggle: vi.fn(), onToggleAll: vi.fn() },
    hasFilters: false,
    onClearFilters: vi.fn(),
    onRetry: vi.fn(),
    onToggleActive: vi.fn(),
    pendingIds: [],
    ...props
  }
  const ui = (next) => <UtilsProviders><Probe /><CustomersTable {...next} /></UtilsProviders>
  const view = render(ui(current))
  return { ...view, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(ui(current)) } }
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
// the data cells after the Customer row header (the selection cell is not one of them)
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

describe('CustomersTable columns', () => {
  it('has Customer, Phone, Orders, Wallet and Status; no «Type» (decision 7)', () => {
    draw()
    expect(headers()).toEqual(['Customer', 'Phone', 'Orders', 'Wallet', 'Status'])
    expect(screen.getByRole('table', { name: 'Customers' })).toBeInTheDocument()
  })

  // main (): the Wallet column does not depend on the cash wallet add-on
  it('keeps Wallet (before Status) with or without the cash wallet add-on', () => {
    const { unmount } = draw({ configs: CASH_ON })
    expect(headers()).toEqual(['Customer', 'Phone', 'Orders', 'Wallet', 'Status'])
    unmount()
    draw({ configs: { addon_points_and_levels: { value: '1' } } })
    expect(headers()).toContain('Wallet')
  })

  it('the Customer cell: avatar, name, then «email · #id» with the id as a figure', () => {
    const { container } = draw()
    const header = within(rowOf(container, 7)).getByRole('rowheader')
    expect(header.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://example.com/ana.png')
    expect(within(header).getByText('Ana Ruiz')).toBeInTheDocument()
    expect(within(header).getByText('#7')).toHaveClass('odc-figure')
    expect(header).toHaveTextContent('ana@example.com')
    expect(header.textContent).toMatch(/ana@example\.com.*·.*#7/)
  })

  it('without email only the #id shows; without a name it says «No name»; the avatar has no orders badge', () => {
    const { container } = draw()
    const marcoHeader = within(rowOf(container, 8)).getByRole('rowheader')
    expect(marcoHeader.textContent).toContain('#8')
    expect(marcoHeader.textContent).not.toContain('·')
    expect(marcoHeader.querySelector('.odc-avatar')).not.toHaveTextContent(/\d/)
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
    const cells = cellsOf(row)
    expect(within(cells[0]).getByText('+1 5550100')).toBeInTheDocument()
    expect(within(cells[0]).getByRole('img', { name: 'Verified' })).toBeInTheDocument()
    // a customer with nothing verified has no mark
    expect(within(rowOf(container, 9)).queryByRole('img', { name: 'Verified' })).toBeNull()
  })

  it('Phone is «—» (with its reason for a screen reader) when there is none', () => {
    const { container } = draw()
    const cells = cellsOf(rowOf(container, 8))
    expect(cells[0]).toHaveTextContent('—')
    expect(within(cells[0]).getByText('No data')).toHaveClass('odc-sr-only')
  })

  it('Orders is a figure; 0 or missing is «New» (no orders), not a figure', () => {
    const { container } = draw()
    const ordersOf = id => cellsOf(rowOf(container, id))[1]
    expect(within(ordersOf(7)).getByText('12')).toHaveClass('odc-figure')
    expect(ordersOf(8)).toHaveTextContent('New')
    expect(ordersOf(8).querySelector('.odc-figure')).toBeNull()
    expect(ordersOf(9)).toHaveTextContent('New')
    expect(screen.getAllByRole('columnheader').find(header => header.textContent === 'Orders')).toHaveAttribute('data-align', 'end')
  })

  it('Wallet shows the cash balance as a figure, «—» without a wallet, and the minus sign of a negative balance', () => {
    const { container } = draw({ configs: CASH_ON })
    const walletOf = id => cellsOf(rowOf(container, id))[2]
    expect(within(walletOf(7)).getByText(util.parsePrice(34.2))).toHaveClass('odc-figure')
    expect(walletOf(8)).toHaveTextContent('—')
    expect(walletOf(9)).toHaveTextContent(`-${util.parsePrice(5)}`)
    expect(walletOf(9).querySelector('.odc-figure')).toBeInTheDocument()
  })

  it('a zero (or rounds-to-zero) balance never carries a minus sign (M-C4); the points wallet is not a column', () => {
    const zero = { ...ana, id: 20, wallets: [{ type: 'cash', balance: 0 }] }
    const tiny = { ...ana, id: 21, wallets: [{ type: 'cash', balance: -0.001 }] }
    const { container } = draw({ users: [zero, tiny], configs: { ...CASH_ON, addon_points_and_levels: { value: '1' } } })
    const cell = id => cellsOf(rowOf(container, id))[2]
    expect(cell(20)).toHaveTextContent(util.parsePrice(0))
    expect(cell(20).textContent).not.toMatch(/-/)
    expect(cell(21).textContent).not.toMatch(/-/)
    expect(headers()).not.toContain('Points')
  })
})

describe('CustomersTable status switch', () => {
  it('shows «Active» / «Inactive» as visible text, checked by user.enabled', () => {
    const { container } = draw()
    const anaSwitch = within(rowOf(container, 7)).getByRole('switch')
    expect(anaSwitch).toHaveTextContent('Active')
    expect(anaSwitch).toHaveAttribute('aria-checked', 'true')
    const marcoSwitch = within(rowOf(container, 8)).getByRole('switch')
    expect(marcoSwitch).toHaveTextContent('Inactive')
    expect(marcoSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('pressing it asks the hook (user, next) and never opens the row', async () => {
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

  it('the switch follows user.enabled: after a failed change the host passes the old value and it shows it', () => {
    const { container, rerenderWith } = draw()
    expect(within(rowOf(container, 7)).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    rerenderWith({ users: [{ ...ana }, marco, lena] })
    expect(within(rowOf(container, 7)).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})

describe('CustomersTable rows', () => {
  it('a click and Enter open the customer; the open one is aria-current', async () => {
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

  it('when the list narrows Wallet steps aside first, then Phone; Customer stays and carries the phone', () => {
    const { container } = draw({ configs: CASH_ON })
    resizeTo(2000)
    expect(headers()).toEqual(['Customer', 'Phone', 'Orders', 'Wallet', 'Status'])
    resizeTo(700)
    expect(headers()).toEqual(['Customer', 'Phone', 'Orders', 'Status'])
    resizeTo(300)
    expect(headers()).toEqual(['Customer', 'Orders', 'Status'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).toHaveTextContent('+1 5550100')
    resizeTo(2000)
    expect(headers()).toEqual(['Customer', 'Phone', 'Orders', 'Wallet', 'Status'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).not.toHaveTextContent('+1 5550100')
  })
})

describe('CustomersTable states', () => {
  it('loading: a skeleton row per page-size item, announced once, no empty state', () => {
    const { container } = draw({ loading: true, users: [], pageSize: 6 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(6)
    expect(screen.getByText('Loading customers')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No customers yet')).toBeNull()
  })

  it('error: «We couldn\'t load the customers.» with Retry (M-C14)', async () => {
    draw({ error: ['Server down'], users: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the customers.")
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('an empty error list is no error', () => {
    draw({ error: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('empty with filters: «No customers match these filters» and Clear filters', async () => {
    draw({ users: [], hasFilters: true })
    expect(screen.getByText('No customers match these filters')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(current.onClearFilters).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Add customer' })).toBeNull()
  })

  // owner decision 36 (batch AE): the header primary «Add customer» is on screen here, so the empty state draws no second one
  it('empty without filters: «No customers yet», its icon and title, and no Add customer action', () => {
    const { container } = draw({ users: [] })
    expect(screen.getByText('No customers yet')).toBeInTheDocument()
    expect(container.querySelector('.odc-state-icon')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add customer' })).toBeNull()
    expect(container.querySelector('.odc-state-action')).toBeNull()
  })
})

describe('CustomersTable on a phone (cards)', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, no table: name, contact, orders, cash balance, the checkbox and the switch', () => {
    const { container } = draw({ configs: CASH_ON })
    expect(screen.queryByRole('table')).toBeNull()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    const card = container.querySelector('li[data-row-id="7"]')
    expect(within(card).getByRole('link', { name: 'Ana Ruiz' })).toBeInTheDocument()
    expect(card).toHaveTextContent('ana@example.com')
    expect(card).toHaveTextContent('+1 5550100')
    expect(within(card).getByText('12')).toHaveClass('odc-figure')
    expect(within(card).getByText(util.parsePrice(34.2))).toHaveClass('odc-figure')
    expect(within(card).getByRole('checkbox', { name: 'Select Ana Ruiz' })).toBeInTheDocument()
    expect(within(card).getByRole('switch')).toHaveTextContent('Active')
  })

  it('never shows a datum twice, and keeps the cash balance without the add-on', () => {
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="7"]')
    expect(card.textContent.match(/Ana Ruiz/g)).toHaveLength(1)
    expect(card.textContent.match(/ana@example\.com/g)).toHaveLength(1)
    expect(card.textContent.match(/5550100/g)).toHaveLength(1)
    expect(card.textContent.match(/#7/g)).toHaveLength(1)
    expect(card.textContent.split(util.parsePrice(34.2))).toHaveLength(2)
  })

  it('«New» for no orders; the card opens the customer; the checkbox and the switch do not', async () => {
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="8"]')
    expect(card).toHaveTextContent('New')
    await userEvent.click(within(card).getByRole('checkbox'))
    expect(current.selection.onToggle).toHaveBeenCalledWith(8)
    await userEvent.click(within(card).getByRole('switch'))
    expect(current.onToggleActive).toHaveBeenCalledWith(marco, true)
    expect(current.onOpenUser).not.toHaveBeenCalled()
    await userEvent.click(within(card).getByRole('link', { name: 'Marco Toss' }))
    expect(current.onOpenUser).toHaveBeenCalledWith(marco)
  })

  // redesign DL-R3 (D-01, ): main's «Select all» sat in the table header and was reachable at 390; the cards bring it back
  it('«Select all» (D-01): mixed when some of the page is selected, true when all, and it toggles the page ids', async () => {
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

  it('«Select all» (D-01): with no selection prop there is no such checkbox', () => {
    draw({ selection: undefined })
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
  })

  it('the open customer is current, a busy id shows the switch busy', () => {
    const { container } = draw({ activeUserId: 7, pendingIds: [8] })
    expect(container.querySelector('li[data-row-id="7"]')).toHaveAttribute('aria-current', 'true')
    expect(within(container.querySelector('li[data-row-id="8"]')).getByRole('switch')).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps the states: skeleton cards, error with Retry, no match, empty', async () => {
    const loading = draw({ loading: true, users: [], pageSize: 4 })
    expect(loading.container.querySelectorAll('li[data-skeleton]')).toHaveLength(4)
    loading.unmount()
    const failed = draw({ error: ['x'], users: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    failed.unmount()
    const noMatch = draw({ users: [], hasFilters: true })
    expect(screen.getByText('No customers match these filters')).toBeInTheDocument()
    noMatch.unmount()
    draw({ users: [] })
    expect(screen.getByText('No customers yet')).toBeInTheDocument()
  })
})
