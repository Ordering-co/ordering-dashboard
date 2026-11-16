/* eslint-disable import/first */
// redesign DL-B2 (decisions 2, 3, 4, 5; defects M-DL1, M-DL9, M-DL13): the drivers list as a Product DataTable (and RecordCards
// under 768px). The state comes out of the real helpers of driverData.js; only the environment (language, the phone flag) is
// simulated. The Product wrappers are real.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { DriversTable } from '../DriversTable'

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
  enabled: true,
  available: true,
  busy: false
}
const bruno = { id: 8, name: 'Bruno', lastname: 'Paz', email: 'bruno@example.com', cellphone: '5550101', enabled: true, available: true, busy: true }
const carla = { id: 9, name: 'Carla', lastname: 'Vega', email: 'carla@example.com', enabled: true, available: false, busy: true }
const dani = { id: 10, name: 'Dani', lastname: 'Roca', email: null, enabled: false, available: true, busy: false }
const eli = { id: 11, name: '', lastname: '', email: 'eli@example.com', cellphone: '5550142', enabled: true, available: false, busy: false }

let current
const draw = (props = {}) => {
  current = {
    users: [ana, bruno, carla, dani, eli],
    loading: false,
    error: null,
    pageSize: 10,
    activeUserId: undefined,
    onOpenUser: vi.fn(),
    selection: { selectedIds: [], onToggle: vi.fn(), onToggleAll: vi.fn() },
    hasFilters: false,
    onClearFilters: vi.fn(),
    onRetry: vi.fn(),
    onAddDriver: vi.fn(),
    onToggle: vi.fn(),
    pendingKeys: [],
    actionDisabled: false,
    ...props
  }
  const ui = (next) => <DriversTable {...next} />
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
const cardOf = (container, id) => container.querySelector(`li[data-row-id="${id}"]`)
// the data cells after the Driver row header (the selection cell is not one of them): [Status, Phone, Availability]
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

describe('DriversTable columns', () => {
  it('has Driver, Status, Phone and Availability; no ID column (decision 2)', () => {
    draw()
    expect(headers()).toEqual(['Driver', 'Status', 'Phone', 'Availability'])
    expect(screen.getByRole('table', { name: 'Drivers' })).toBeInTheDocument()
  })

  it('the Driver cell: avatar, name, then «email ✓ · #id» with the id as a figure', () => {
    const { container } = draw()
    const header = within(rowOf(container, 7)).getByRole('rowheader')
    expect(header.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://example.com/ana.png')
    expect(within(header).getByText('Ana Ruiz')).toBeInTheDocument()
    expect(within(header).getByText('#7')).toHaveClass('odc-figure')
    expect(header.textContent).toMatch(/ana@example\.com.*·.*#7/)
    // the phone has its own column here: not repeated in the cell
    expect(header).not.toHaveTextContent('5550100')
  })

  it('without email only the #id shows; without a name it says «No name»', () => {
    const { container } = draw()
    const daniHeader = within(rowOf(container, 10)).getByRole('rowheader')
    expect(daniHeader.textContent).toContain('#10')
    expect(daniHeader.textContent).not.toContain('·')
    expect(within(rowOf(container, 11)).getByRole('rowheader')).toHaveTextContent('No name')
  })

  it('the verified marks are named «Verified»: the email one after the email, the phone one in the Phone cell', () => {
    const { container } = draw()
    const row = rowOf(container, 7)
    const header = within(row).getByRole('rowheader')
    const emailMark = within(header).getByRole('img', { name: 'Verified' })
    expect(within(header).getByText('ana@example.com').compareDocumentPosition(emailMark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const phone = cellsOf(row)[1]
    expect(within(phone).getByText('+1 5550100')).toBeInTheDocument()
    expect(within(phone).getByRole('img', { name: 'Verified' })).toBeInTheDocument()
    // a driver with nothing verified has no mark
    expect(within(rowOf(container, 8)).queryByRole('img', { name: 'Verified' })).toBeNull()
  })

  it('Phone is «—» (with its reason for a screen reader) when there is none', () => {
    const { container } = draw()
    const phone = cellsOf(rowOf(container, 9))[1]
    expect(phone).toHaveTextContent('—')
    expect(within(phone).getByText('No data')).toHaveClass('odc-sr-only')
  })

  // redesign DL-R1 (Q-3): at 1024 without a panel the table is about 728px; with the selection column all four columns must fit,
  // or the switches leave the row (the only place for them once a panel is open at 1280 and 1440)
  it('all four columns fit the 728px of a 1024 window without a panel, with the selection column (Q-3)', () => {
    draw()
    resizeTo(728)
    expect(headers()).toEqual(['Driver', 'Status', 'Phone', 'Availability'])
    resizeTo(717)
    expect(headers()).toEqual(['Driver', 'Status', 'Availability'])
  })

  it('the switches of the Availability cell sit in the wrapping container, so a third (Busy) goes to a second line (Q-3)', () => {
    const { container } = draw()
    const cell = cellsOf(rowOf(container, 8))[2]
    const holder = cell.querySelector('.odc-drv-switches')
    expect(holder).not.toBeNull()
    expect(within(holder).getAllByRole('switch').map(node => node.textContent)).toEqual(['Online', 'Busy', 'Active'])
    const css = readFileSync(resolve(__dirname, '../drivers-table.css'), 'utf8')
    expect(css).toMatch(/\.odc-drv-switches\s*\{[^}]*flex-wrap:\s*wrap/)
  })

  it('when the list narrows Phone steps aside first, then Availability; Driver stays and carries the phone', () => {
    const { container } = draw()
    resizeTo(2000)
    expect(headers()).toEqual(['Driver', 'Status', 'Phone', 'Availability'])
    resizeTo(700)
    expect(headers()).toEqual(['Driver', 'Status', 'Availability'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).toHaveTextContent('+1 5550100')
    resizeTo(300)
    expect(headers()).toEqual(['Driver', 'Status'])
    expect(within(rowOf(container, 7)).queryByRole('switch')).toBeNull()
    expect(within(rowOf(container, 7)).getByText('Available')).toBeInTheDocument()
    resizeTo(2000)
    expect(headers()).toEqual(['Driver', 'Status', 'Phone', 'Availability'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).not.toHaveTextContent('+1 5550100')
  })
})

describe('DriversTable state cell (decision 3)', () => {
  const stateOf = (container, id) => cellsOf(rowOf(container, id))[0].querySelector('[data-state]')

  it('five cases: Available, Busy, Offline · Busy, Inactive and Offline, each a dot AND a word', () => {
    const { container } = draw()
    const expected = { 7: ['available', 'Available'], 8: ['busy', 'Busy'], 9: ['offline', 'Offline · Busy'], 10: ['inactive', 'Inactive'], 11: ['offline', 'Offline'] }
    Object.entries(expected).forEach(([id, [state, text]]) => {
      const cell = stateOf(container, id)
      expect(cell).toHaveAttribute('data-state', state)
      expect(cell).toHaveTextContent(new RegExp(`^${text}$`))
      expect(cell.querySelector('.odc-drv-dot')).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('a disabled account is Inactive whatever else it says; Offline · Busy needs a connected-off driver with orders', () => {
    const { container } = draw({ users: [{ ...carla, id: 20, enabled: false }, { ...eli, id: 21, busy: false }] })
    expect(stateOf(container, 20)).toHaveTextContent(/^Inactive$/)
    expect(stateOf(container, 21)).toHaveTextContent(/^Offline$/)
  })
})

describe('DriversTable availability switches (decision 2; M-DL1)', () => {
  const switchesOf = (container, id) => within(cellsOf(rowOf(container, id))[2]).getAllByRole('switch')

  it('Online and Active are named by their visible text and checked by the row', () => {
    const { container } = draw()
    const online = within(rowOf(container, 7)).getByRole('switch', { name: 'Online' })
    expect(online).toHaveTextContent('Online')
    expect(online).toHaveAttribute('aria-checked', 'true')
    const active = within(rowOf(container, 7)).getByRole('switch', { name: 'Active' })
    expect(active).toHaveAttribute('aria-checked', 'true')
    expect(within(rowOf(container, 10)).getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    expect(within(rowOf(container, 10)).getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false')
    expect(within(rowOf(container, 11)).getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'false')
  })

  // (main #479): Busy is drawn for every driver (it can be turned on), on for the busy ones
  it('Busy is drawn for every driver, on only when the driver is busy', () => {
    const { container } = draw()
    expect(within(rowOf(container, 7)).getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'false')
    expect(within(rowOf(container, 10)).getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'false')
    expect(within(rowOf(container, 11)).getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'false')
    expect(within(rowOf(container, 8)).getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'true')
    expect(within(rowOf(container, 9)).getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'true')
    expect(switchesOf(container, 7).map(item => item.textContent)).toEqual(['Online', 'Busy', 'Active'])
    expect(switchesOf(container, 8).map(item => item.textContent)).toEqual(['Online', 'Busy', 'Active'])
  })

  it('pressing one asks the hook (user, attribute, next) and never opens the row', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 7)).getByRole('switch', { name: 'Online' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(ana, 'available', false)
    await userEvent.click(within(rowOf(container, 8)).getByRole('switch', { name: 'Busy' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(bruno, 'busy', false)
    await userEvent.click(within(rowOf(container, 10)).getByRole('switch', { name: 'Active' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(dani, 'enabled', true)
    expect(current.onToggle).toHaveBeenCalledTimes(3)
    expect(current.onOpenUser).not.toHaveBeenCalled()
  })

  it('only the switch whose key is pending is busy, and it ignores the press', async () => {
    const { container } = draw({ pendingKeys: ['8:busy'] })
    const busy = within(rowOf(container, 8)).getByRole('switch', { name: 'Busy' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(busy)
    expect(current.onToggle).not.toHaveBeenCalled()
    expect(within(rowOf(container, 8)).getByRole('switch', { name: 'Online' })).not.toHaveAttribute('aria-busy')
    expect(within(rowOf(container, 7)).getByRole('switch', { name: 'Online' })).not.toHaveAttribute('aria-busy')
  })

  it('actionDisabled makes every switch really disabled (not just styled)', async () => {
    const { container } = draw({ actionDisabled: true })
    const all = within(container).getAllByRole('switch')
    expect(all).toHaveLength(5 * 3)
    all.forEach(item => expect(item).toBeDisabled())
    await userEvent.click(all[0])
    expect(current.onToggle).not.toHaveBeenCalled()
  })

  it('without actionDisabled none is disabled', () => {
    const { container } = draw()
    within(container).getAllByRole('switch').forEach(item => expect(item).not.toBeDisabled())
  })

  it('the switch follows the row: after a failed change the host passes the old value and it shows it', () => {
    const { container, rerenderWith } = draw()
    const online = () => within(rowOf(container, 7)).getByRole('switch', { name: 'Online' })
    expect(online()).toHaveAttribute('aria-checked', 'true')
    rerenderWith({ users: [{ ...ana }, bruno, carla, dani, eli] })
    expect(online()).toHaveAttribute('aria-checked', 'true')
    rerenderWith({ users: [{ ...ana, available: false }, bruno, carla, dani, eli] })
    expect(online()).toHaveAttribute('aria-checked', 'false')
  })
})

describe('DriversTable rows and selection', () => {
  it('a click and Enter open the driver; the open one is aria-current', async () => {
    const { container } = draw({ activeUserId: 8 })
    expect(rowOf(container, 8)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 7)).not.toHaveAttribute('aria-current')
    await userEvent.click(within(rowOf(container, 7)).getByText('Ana Ruiz'))
    expect(current.onOpenUser).toHaveBeenCalledWith(ana)
    rowOf(container, 9).focus()
    await userEvent.keyboard('{Enter}')
    expect(current.onOpenUser).toHaveBeenLastCalledWith(carla)
  })

  it('the selection column stays with a driver open (activeUserId set)', () => {
    const { container } = draw({ activeUserId: 7 })
    expect(container.querySelector('th[data-selection]')).toBeInTheDocument()
    expect(rowOf(container, 7)).toHaveAttribute('aria-current', 'true')
    expect(within(rowOf(container, 7)).getByRole('checkbox', { name: 'Select Ana Ruiz' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeInTheDocument()
  })

  it('without a selection prop there is no selection column', () => {
    const { container } = draw({ selection: undefined })
    expect(container.querySelector('th[data-selection]')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('header «Select all» toggles this page, each row has «Select _name_», and neither opens the row', async () => {
    const selection = { selectedIds: [8], onToggle: vi.fn(), onToggleAll: vi.fn() }
    const { container } = draw({ selection })
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    expect(all).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(all)
    expect(selection.onToggleAll).toHaveBeenCalledWith([7, 8, 9, 10, 11])
    expect(within(rowOf(container, 8)).getByRole('checkbox', { name: 'Select Bruno Paz' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(rowOf(container, 7)).getByRole('checkbox', { name: 'Select Ana Ruiz' }))
    expect(selection.onToggle).toHaveBeenCalledWith(7)
    expect(within(rowOf(container, 11)).getByRole('checkbox', { name: 'Select No name' })).toBeInTheDocument()
    expect(current.onOpenUser).not.toHaveBeenCalled()
  })
})

describe('DriversTable states', () => {
  it('loading: a skeleton row per page-size item, announced once, no empty state', () => {
    const { container } = draw({ loading: true, users: [], pageSize: 6 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(6)
    expect(screen.getByText('Loading drivers')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No drivers yet')).toBeNull()
  })

  it('error: «We couldn\'t load the drivers.» with Retry', async () => {
    draw({ error: ['Server down'], users: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the drivers.")
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('an empty error list is no error, and a loading list shows no error', () => {
    const quiet = draw({ error: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
    quiet.unmount()
    draw({ error: ['x'], loading: true, users: [] })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('empty with filters: «No drivers match these filters» and Clear filters', async () => {
    draw({ users: [], hasFilters: true })
    expect(screen.getByText('No drivers match these filters')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(current.onClearFilters).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Add driver' })).toBeNull()
  })

  it('empty without filters: «No drivers yet» and Add driver', async () => {
    draw({ users: [] })
    expect(screen.getByText('No drivers yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add driver' }))
    expect(current.onAddDriver).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('Add driver is really disabled with actionDisabled', async () => {
    draw({ users: [], actionDisabled: true })
    const add = screen.getByRole('button', { name: 'Add driver' })
    expect(add).toBeDisabled()
    await userEvent.click(add)
    expect(current.onAddDriver).not.toHaveBeenCalled()
  })
})

describe('DriversTable on a phone (cards)', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, no table: name, email, phone, #id, state, the checkbox and the switches', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    const card = cardOf(container, 7)
    expect(within(card).getByRole('link', { name: 'Ana Ruiz' })).toBeInTheDocument()
    expect(card).toHaveTextContent('ana@example.com')
    expect(card).toHaveTextContent('+1 5550100')
    expect(within(card).getAllByRole('img', { name: 'Verified' })).toHaveLength(2)
    expect(within(card).getByText('#7')).toHaveClass('odc-figure')
    expect(card.querySelector('[data-state="available"]')).toHaveTextContent('Available')
    expect(within(card).getByRole('checkbox', { name: 'Select Ana Ruiz' })).toBeInTheDocument()
    expect(within(card).getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    expect(within(card).getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'true')
    expect(within(card).getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'false')
    expect(within(cardOf(container, 8)).getByRole('switch', { name: 'Busy' })).toHaveAttribute('aria-checked', 'true')
    expect(cardOf(container, 9).querySelector('[data-state="offline"]')).toHaveTextContent('Offline · Busy')
    expect(cardOf(container, 10).querySelector('[data-state="inactive"]')).toHaveTextContent('Inactive')
  })

  // redesign DL-R2 (parity with main: the table header's «Select all» was reachable at 390 by side-scroll; the cards have no header)
  describe('«Select all» for the page', () => {
    const IDS = [7, 8, 9, 10, 11]
    const selectAll = () => screen.getByRole('checkbox', { name: 'Select all' })

    it('is a checkbox above the cards: unchecked with nothing selected', () => {
      const { container } = draw()
      expect(selectAll()).toHaveAttribute('aria-checked', 'false')
      expect(selectAll().compareDocumentPosition(container.querySelector('ul[role="list"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(within(cardOf(container, 7)).queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    })

    it('is mixed when some of the page is selected, checked when all of it is (ids on other pages do not count)', () => {
      const some = draw({ selection: { selectedIds: [8, 999], onToggle: vi.fn(), onToggleAll: vi.fn() } })
      expect(selectAll()).toHaveAttribute('aria-checked', 'mixed')
      some.unmount()
      draw({ selection: { selectedIds: [...IDS, 999], onToggle: vi.fn(), onToggleAll: vi.fn() } })
      expect(selectAll()).toHaveAttribute('aria-checked', 'true')
    })

    it('a click calls onToggleAll with the ids of the page, and opens nothing', async () => {
      draw({ selection: { selectedIds: [8], onToggle: vi.fn(), onToggleAll: vi.fn() } })
      await userEvent.click(selectAll())
      expect(current.selection.onToggleAll).toHaveBeenCalledTimes(1)
      expect(current.selection.onToggleAll).toHaveBeenCalledWith(IDS)
      expect(current.onOpenUser).not.toHaveBeenCalled()
    })

    it('is not drawn without a selection, while loading, nor with no rows', () => {
      const none = draw({ selection: undefined })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
      none.unmount()
      const loading = draw({ loading: true, users: [] })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
      loading.unmount()
      draw({ users: [] })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    })
  })

  it('never shows a datum twice', () => {
    const { container } = draw()
    const card = cardOf(container, 7)
    expect(card.textContent.match(/Ana Ruiz/g)).toHaveLength(1)
    expect(card.textContent.match(/ana@example\.com/g)).toHaveLength(1)
    expect(card.textContent.match(/5550100/g)).toHaveLength(1)
    expect(card.textContent.match(/#7/g)).toHaveLength(1)
  })

  it('the actions sit in a [data-card-actions] wrapper: the checkbox and the switches do not open the card', async () => {
    const { container } = draw()
    const card = cardOf(container, 8)
    expect(card.querySelector('[data-card-actions]')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('checkbox'))
    expect(current.selection.onToggle).toHaveBeenCalledWith(8)
    await userEvent.click(within(card).getByRole('switch', { name: 'Online' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(bruno, 'available', false)
    await userEvent.click(within(card).getByRole('switch', { name: 'Busy' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(bruno, 'busy', false)
    await userEvent.click(within(card).getByRole('switch', { name: 'Active' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(bruno, 'enabled', false)
    expect(current.onOpenUser).not.toHaveBeenCalled()
    const link = within(card).getByRole('link', { name: 'Bruno Paz' })
    expect(link.getAttribute('href')).toMatch(/\?.*id=8/)
    await userEvent.click(link)
    expect(current.onOpenUser).toHaveBeenCalledWith(bruno)
  })

  it('the open driver is current, a pending key shows its switch busy, actionDisabled disables them', () => {
    const open = draw({ activeUserId: 7, pendingKeys: ['8:available'] })
    expect(cardOf(open.container, 7)).toHaveAttribute('aria-current', 'true')
    expect(within(cardOf(open.container, 8)).getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-busy', 'true')
    open.unmount()
    const locked = draw({ actionDisabled: true })
    within(locked.container).getAllByRole('switch').forEach(item => expect(item).toBeDisabled())
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
    expect(screen.getByText('No drivers match these filters')).toBeInTheDocument()
    noMatch.unmount()
    draw({ users: [] })
    expect(screen.getByText('No drivers yet')).toBeInTheDocument()
  })
})

// redesign DM-B2 (decision 2 | M-DL1, M-DL21, M-DL22): the same table for /delivery/drivers-managers. `role='managers'` is opt-in; every
// test above runs without it and pins the drivers list unchanged. A manager has Phone and one Account switch («Active»); no state.
describe('DriversTable role="managers" (DM-B2)', () => {
  const managers = (props = {}) => draw({ role: 'managers', ...props })
  const accountSwitches = (container, id) => within(cellsOf(rowOf(container, id))[1]).getAllByRole('switch')

  it('has Manager, Phone and Account; no Status, no Availability, no Driver header', () => {
    managers()
    expect(headers()).toEqual(['Manager', 'Phone', 'Account'])
    expect(screen.getByRole('table', { name: 'Drivers managers' })).toBeInTheDocument()
  })

  it('the Manager cell and the Phone cell are the ones of a driver', () => {
    const { container } = managers()
    const row = rowOf(container, 7)
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Ana Ruiz')
    expect(within(row).getByRole('rowheader')).toHaveTextContent('#7')
    const phone = cellsOf(row)[0]
    expect(within(phone).getByText('+1 5550100')).toBeInTheDocument()
    expect(within(phone).getByRole('img', { name: 'Verified' })).toBeInTheDocument()
    expect(cellsOf(row)).toHaveLength(2)
    expect(row.querySelector('[data-state]')).toBeNull()
  })

  it('exactly one switch per row, named Active: no Online or Busy, even for a user with busy and available', () => {
    const { container } = managers()
    expect(within(container).getAllByRole('switch')).toHaveLength(5)
    expect(within(container).queryByRole('switch', { name: 'Online' })).toBeNull()
    expect(within(container).queryByRole('switch', { name: 'Busy' })).toBeNull()
    ;[7, 8, 9, 10, 11].forEach(id => {
      expect(accountSwitches(container, id).map(item => item.textContent)).toEqual(['Active'])
    })
    expect(within(rowOf(container, 8)).getAllByRole('switch')).toHaveLength(1)
    expect(within(rowOf(container, 7)).getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'true')
    expect(within(rowOf(container, 10)).getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false')
  })

  it('pressing Active asks the hook (user, "enabled", next) and never opens the row', async () => {
    const { container } = managers()
    await userEvent.click(within(rowOf(container, 7)).getByRole('switch', { name: 'Active' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(ana, 'enabled', false)
    await userEvent.click(within(rowOf(container, 10)).getByRole('switch', { name: 'Active' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(dani, 'enabled', true)
    expect(current.onToggle).toHaveBeenCalledTimes(2)
    expect(current.onOpenUser).not.toHaveBeenCalled()
  })

  it('only the Active whose «id:enabled» key is pending is busy, and it ignores the press', async () => {
    const { container } = managers({ pendingKeys: ['8:enabled'] })
    const busy = within(rowOf(container, 8)).getByRole('switch', { name: 'Active' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(busy)
    expect(current.onToggle).not.toHaveBeenCalled()
    expect(within(rowOf(container, 7)).getByRole('switch', { name: 'Active' })).not.toHaveAttribute('aria-busy')
  })

  it('a key of a driver switch does not make the manager one busy', () => {
    const { container } = managers({ pendingKeys: ['8:available'] })
    expect(within(rowOf(container, 8)).getByRole('switch', { name: 'Active' })).not.toHaveAttribute('aria-busy')
  })

  it('actionDisabled disables every Active; the switch follows the row', async () => {
    const locked = managers({ actionDisabled: true })
    const all = within(locked.container).getAllByRole('switch')
    expect(all).toHaveLength(5)
    all.forEach(item => expect(item).toBeDisabled())
    await userEvent.click(all[0])
    expect(current.onToggle).not.toHaveBeenCalled()
    locked.rerenderWith({ actionDisabled: false, users: [{ ...ana, enabled: false }, bruno, carla, dani, eli] })
    expect(within(rowOf(locked.container, 7)).getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false')
  })

  it('Phone steps aside first, then Account; Manager stays and carries the phone', () => {
    const { container } = managers()
    resizeTo(2000)
    expect(headers()).toEqual(['Manager', 'Phone', 'Account'])
    // 48 selection + 200 manager + 150 phone + 120 account = 518
    resizeTo(518)
    expect(headers()).toEqual(['Manager', 'Phone', 'Account'])
    resizeTo(517)
    expect(headers()).toEqual(['Manager', 'Account'])
    expect(within(rowOf(container, 7)).getByRole('rowheader')).toHaveTextContent('+1 5550100')
    resizeTo(300)
    expect(headers()).toEqual(['Manager'])
    expect(within(rowOf(container, 7)).queryByRole('switch')).toBeNull()
  })

  it('loading: «Loading driver managers», one skeleton per page-size item', () => {
    const { container } = managers({ loading: true, users: [], pageSize: 6 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(6)
    expect(screen.getByText('Loading driver managers')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('Loading drivers')).toBeNull()
  })

  it('error: «We couldn\'t load the driver managers.» with Retry', async () => {
    managers({ error: ['Server down'], users: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the driver managers.")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('no match: «No driver managers match this search» and Clear filters', async () => {
    managers({ users: [], hasFilters: true })
    expect(screen.getByText('No driver managers match this search')).toBeInTheDocument()
    expect(screen.queryByText('No drivers match these filters')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(current.onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('empty: «No driver managers yet» and «Add driver manager»; the icon is Users, not the Truck of the drivers', async () => {
    const view = managers({ users: [] })
    expect(screen.getByText('No driver managers yet')).toBeInTheDocument()
    expect(view.container.querySelector('.lucide-users')).not.toBeNull()
    expect(view.container.querySelector('.lucide-truck')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Add driver manager' }))
    expect(current.onAddDriver).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Add driver' })).toBeNull()
    view.unmount()
    // the drivers list keeps its Truck
    const drivers = draw({ users: [] })
    expect(drivers.container.querySelector('.lucide-truck')).not.toBeNull()
    expect(drivers.container.querySelector('.lucide-users')).toBeNull()
  })

  it('Add driver manager is really disabled with actionDisabled', async () => {
    managers({ users: [], actionDisabled: true })
    const add = screen.getByRole('button', { name: 'Add driver manager' })
    expect(add).toBeDisabled()
    await userEvent.click(add)
    expect(current.onAddDriver).not.toHaveBeenCalled()
  })

  it('«Select all» and «Select _name_» are the same', async () => {
    const selection = { selectedIds: [8], onToggle: vi.fn(), onToggleAll: vi.fn() }
    const { container } = managers({ selection })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(selection.onToggleAll).toHaveBeenCalledWith([7, 8, 9, 10, 11])
    expect(within(rowOf(container, 7)).getByRole('checkbox', { name: 'Select Ana Ruiz' })).toBeInTheDocument()
  })

  it('an unknown role is the drivers list', () => {
    managers({ role: 'other' })
    expect(headers()).toEqual(['Driver', 'Status', 'Phone', 'Availability'])
  })

  describe('on a phone (cards)', () => {
    beforeEach(() => { mocks.phone = true })

    it('no state; the checkbox and one Active switch in the actions; no Online or Busy', () => {
      const { container } = managers()
      expect(screen.queryByRole('table')).toBeNull()
      expect(screen.getAllByRole('listitem')).toHaveLength(5)
      expect(screen.getByRole('list', { name: 'Drivers managers' })).toBeInTheDocument()
      const card = cardOf(container, 8)
      expect(card.querySelector('[data-state]')).toBeNull()
      expect(within(card).getByRole('link', { name: 'Bruno Paz' })).toBeInTheDocument()
      expect(within(card).getByRole('checkbox', { name: 'Select Bruno Paz' })).toBeInTheDocument()
      const actions = card.querySelector('[data-card-actions]')
      expect(within(actions).getAllByRole('switch').map(item => item.textContent)).toEqual(['Active'])
      expect(within(card).queryByRole('switch', { name: 'Online' })).toBeNull()
      expect(within(card).queryByRole('switch', { name: 'Busy' })).toBeNull()
      expect(within(container).getAllByRole('switch')).toHaveLength(5)
    })

    it('Active asks the hook and does not open the card; pending and disabled apply', async () => {
      const { container } = managers({ pendingKeys: ['9:enabled'] })
      await userEvent.click(within(cardOf(container, 8)).getByRole('switch', { name: 'Active' }))
      expect(current.onToggle).toHaveBeenLastCalledWith(bruno, 'enabled', false)
      expect(current.onOpenUser).not.toHaveBeenCalled()
      expect(within(cardOf(container, 9)).getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-busy', 'true')
      expect(within(cardOf(container, 8)).getByRole('switch', { name: 'Active' })).not.toHaveAttribute('aria-busy')
    })

    it('actionDisabled disables them; «Select all» is unchanged', async () => {
      const { container } = managers({ actionDisabled: true })
      within(container).getAllByRole('switch').forEach(item => expect(item).toBeDisabled())
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
      expect(current.selection.onToggleAll).toHaveBeenCalledWith([7, 8, 9, 10, 11])
    })

    it('keeps the states with the managers texts', async () => {
      const loading = managers({ loading: true, users: [], pageSize: 4 })
      expect(loading.container.querySelectorAll('li[data-skeleton]')).toHaveLength(4)
      expect(screen.getByText('Loading driver managers')).toBeInTheDocument()
      loading.unmount()
      const failed = managers({ error: ['x'], users: [] })
      expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the driver managers.")
      failed.unmount()
      const noMatch = managers({ users: [], hasFilters: true })
      expect(screen.getByText('No driver managers match this search')).toBeInTheDocument()
      noMatch.unmount()
      const empty = managers({ users: [] })
      expect(screen.getByText('No driver managers yet')).toBeInTheDocument()
      expect(empty.container.querySelector('.lucide-users')).not.toBeNull()
      expect(screen.getByRole('button', { name: 'Add driver manager' })).toBeInTheDocument()
    })
  })
})
