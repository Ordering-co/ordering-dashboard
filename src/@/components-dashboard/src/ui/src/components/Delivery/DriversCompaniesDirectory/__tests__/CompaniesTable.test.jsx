/* eslint-disable import/first */
// redesign DC-B2 (decision 2 | M-DC3, M-DC12, M-DC14): the driver companies list as a Product DataTable (and RecordCards under
// 768px). The text comes out of the real helpers of companyData.js; only the environment (language, the phone flag, the width of
// the table) is simulated. The Product wrappers are real.
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
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

import { CompaniesTable } from '../CompaniesTable'

const uber = {
  id: 21,
  name: 'Uber Direct',
  logo: 'https://example.com/uber.png',
  owner_type: 'system',
  priority: 1,
  limit: 25,
  timezone: 'America/Bogota',
  enabled: true
}
const moto = {
  id: 22,
  name: 'Moto Express',
  logo: null,
  owner_type: 'user',
  priority: '0',
  limit: 8,
  timezone: 'America/Mexico_City',
  enabled: false
}
const bare = { id: 23, name: '  ', owner_type: 'user', priority: 9, limit: null, timezone: '', enabled: true }

let current
const draw = (props = {}) => {
  current = {
    companies: [uber, moto, bare],
    loading: false,
    error: null,
    searchValue: '',
    selectedIds: [],
    onToggleSelect: vi.fn(),
    onToggleAll: vi.fn(),
    activeId: undefined,
    onOpen: vi.fn(),
    onToggleEnabled: vi.fn(async () => ({ ok: true })),
    confirmDisable: vi.fn(async () => true), // redesign D-5: the host's «Disable _name_?» (answers true: confirmed)
    actionDisabled: false,
    onAdd: vi.fn(),
    onClearSearch: vi.fn(),
    onRetry: vi.fn(),
    pageSize: 10,
    ...props
  }
  return render(<CompaniesTable {...current} />)
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
// the data cells after the Company row header (the selection cell is not one of them): [Priority, Limit, Timezone, Enabled]
const cellsOf = (row) => Array.from(row.querySelectorAll('td:not([data-selection])'))
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean)
const ALL = ['Company', 'Priority', 'Limit', 'Timezone', 'Enabled']

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.phone = false
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CompaniesTable columns', () => {
  it('has Company, Priority, Limit, Timezone and Enabled, in a table named «Delivery companies»', () => {
    draw()
    expect(headers()).toEqual(ALL)
    expect(screen.getByRole('table', { name: 'Delivery companies' })).toBeInTheDocument()
  })

  it('the Company cell: the logo in a business avatar, the name in strong, then «#id» as a figure', () => {
    const { container } = draw()
    const header = within(rowOf(container, 21)).getByRole('rowheader')
    const avatar = header.querySelector('.odc-avatar')
    expect(avatar).toHaveAttribute('data-kind', 'business')
    expect(avatar.querySelector('img')).toHaveAttribute('src', 'https://example.com/uber.png')
    const name = within(header).getByText('Uber Direct')
    expect(name.tagName).toBe('STRONG')
    expect(name).toHaveAttribute('dir', 'auto')
    expect(name).toHaveAttribute('title', 'Uber Direct')
    const id = within(header).getByText('#21')
    expect(id).toHaveClass('odc-figure')
    expect(id.tagName).toBe('BDI')
    expect(id).toHaveAttribute('dir', 'ltr')
  })

  it('a company without a logo gets the initials of its name, not a broken image', () => {
    const { container } = draw()
    const avatar = within(rowOf(container, 22)).getByRole('rowheader').querySelector('.odc-avatar')
    expect(avatar.querySelector('img')).toBeNull()
    expect(avatar).toHaveTextContent('ME')
  })

  it('the «Integration» mark shows only with owner_type system (M-DC12)', () => {
    const { container } = draw()
    expect(within(within(rowOf(container, 21)).getByRole('rowheader')).getByText('Integration')).toBeInTheDocument()
    expect(within(rowOf(container, 22)).getByRole('rowheader')).not.toHaveTextContent('Integration')
    expect(within(rowOf(container, 23)).getByRole('rowheader')).not.toHaveTextContent('Integration')
    expect(screen.getAllByText('Integration')).toHaveLength(1)
  })

  it('a company with no name says «No name»', () => {
    const { container } = draw()
    expect(within(rowOf(container, 23)).getByRole('rowheader')).toHaveTextContent('No name')
  })

  it('Priority is a word: Low, Normal, High, Urgent, and Unknown for anything else (as main)', () => {
    const { container } = draw({ companies: [uber, moto, bare, { id: 24, name: 'Low one', priority: -1 }, { id: 25, name: 'Top', priority: 2 }] })
    expect(cellsOf(rowOf(container, 21))[0]).toHaveTextContent(/^High$/)
    expect(cellsOf(rowOf(container, 22))[0]).toHaveTextContent(/^Normal$/)
    expect(cellsOf(rowOf(container, 23))[0]).toHaveTextContent(/^Unknown$/)
    expect(cellsOf(rowOf(container, 24))[0]).toHaveTextContent(/^Low$/)
    expect(cellsOf(rowOf(container, 25))[0]).toHaveTextContent(/^Urgent$/)
  })

  it('Limit is a figure aligned to the end; empty when the company has none', () => {
    const { container } = draw()
    const header = screen.getByRole('columnheader', { name: 'Limit' })
    expect(header).toHaveAttribute('data-align', 'end')
    const cell = cellsOf(rowOf(container, 21))[1]
    expect(cell).toHaveAttribute('data-align', 'end')
    expect(cell.querySelector('.odc-figure')).toHaveTextContent(/^25$/)
    expect(cellsOf(rowOf(container, 23))[1].textContent).toBe('')
  })

  it('Timezone is text read left to right; empty when the company has none', () => {
    const { container } = draw()
    const zone = within(cellsOf(rowOf(container, 21))[2]).getByText('America/Bogota')
    expect(zone).toHaveAttribute('dir', 'ltr')
    expect(cellsOf(rowOf(container, 23))[2].textContent).toBe('')
  })

  it('the rows are plain data of the page: the table fetches nothing and the order is the given one', () => {
    const { container } = draw({ companies: [moto, uber] })
    expect(Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map(row => row.dataset.rowId)).toEqual(['22', '21'])
  })
})

describe('CompaniesTable width priorities', () => {
  it('all five columns fit the 728px of a 1024 window without a panel (the widths add up to 704 with the selection column)', () => {
    draw()
    resizeTo(728)
    expect(headers()).toEqual(ALL)
  })

  it('when the list narrows Timezone steps aside first, then Limit; Company carries what left; Priority and Enabled stay', () => {
    const { container } = draw()
    resizeTo(2000)
    expect(headers()).toEqual(ALL)
    expect(within(rowOf(container, 21)).getByRole('rowheader')).not.toHaveTextContent('America/Bogota')
    expect(within(rowOf(container, 21)).getByRole('rowheader')).not.toHaveTextContent('Limit 25')

    resizeTo(650)
    expect(headers()).toEqual(['Company', 'Priority', 'Limit', 'Enabled'])
    expect(within(rowOf(container, 21)).getByRole('rowheader')).toHaveTextContent('America/Bogota')
    expect(within(rowOf(container, 21)).getByRole('rowheader')).not.toHaveTextContent('Limit 25')

    resizeTo(400)
    expect(headers()).toEqual(['Company', 'Priority', 'Enabled'])
    const carried = within(rowOf(container, 21)).getByRole('rowheader')
    expect(carried.textContent).toMatch(/#21\s*·\s*Integration\s*·\s*Limit 25\s*·\s*America\/Bogota/)
    expect(within(rowOf(container, 21)).getByRole('switch', { name: 'Enable Uber Direct' })).toBeInTheDocument()
    // a company with nothing to carry draws no stray separator
    expect(within(rowOf(container, 23)).getByRole('rowheader').textContent).not.toMatch(/·\s*$/)

    resizeTo(2000)
    expect(headers()).toEqual(ALL)
    expect(within(rowOf(container, 21)).getByRole('rowheader')).not.toHaveTextContent('America/Bogota')
  })
})

// A host that keeps the stored value, as the controller's record does: it changes only when the save went through.
const Host = ({ outcome = { ok: true }, gate, saves = [], ...props }) => {
  const [companies, setCompanies] = useState([uber, moto, bare])
  const onToggleEnabled = async (company, next) => {
    saves.push([company.id, next])
    if (gate) await gate
    if (outcome.ok) setCompanies(list => list.map(item => item.id === company.id ? { ...item, enabled: next } : item))
    return outcome
  }
  return <CompaniesTable {...props} companies={companies} onToggleEnabled={onToggleEnabled} onOpen={props.onOpen ?? vi.fn()} />
}

describe('CompaniesTable enabled switch', () => {
  const switchOf = (container, id, name) => within(rowOf(container, id)).getByRole('switch', { name })

  it('is named «Enable _name_» and checked by the company', () => {
    const { container } = draw()
    expect(switchOf(container, 21, 'Enable Uber Direct')).toHaveAttribute('aria-checked', 'true')
    expect(switchOf(container, 22, 'Enable Moto Express')).toHaveAttribute('aria-checked', 'false')
    expect(switchOf(container, 23, 'Enable No name')).toBeInTheDocument()
  })

  it('pressing one asks the host (company, next) and never opens the row', async () => {
    const { container } = draw()
    await userEvent.click(switchOf(container, 23, 'Enable No name'))
    expect(current.onToggleEnabled).toHaveBeenLastCalledWith(bare, false)
    await userEvent.click(switchOf(container, 22, 'Enable Moto Express'))
    expect(current.onToggleEnabled).toHaveBeenLastCalledWith(moto, true)
    expect(current.onToggleEnabled).toHaveBeenCalledTimes(2)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('is controlled and busy while it saves; the stored value arrives with ok', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const saves = []
    const { container } = render(<Host gate={gate} saves={saves} />)
    const toggle = () => switchOf(container, 23, 'Enable No name')
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle())
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-busy', 'true'))
    expect(saves).toEqual([[23, false]])
    await userEvent.click(toggle()) // ignored while it lasts
    expect(saves).toHaveLength(1)
    await act(async () => { release() })
    await waitFor(() => expect(toggle()).not.toHaveAttribute('aria-busy'))
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure ({ ok: false }) does not move it, and says so below it (M-DC2: not optimistic)', async () => {
    const { container } = render(<Host outcome={{ ok: false, error: [] }} />)
    const toggle = () => switchOf(container, 23, 'Enable No name')
    await userEvent.click(toggle())
    expect(await screen.findByRole('alert')).toHaveTextContent("The company didn't change. Try again.")
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(within(cellsOf(rowOf(container, 23))[3]).getByRole('alert')).toBeInTheDocument()
  })

  it('a rejected promise is a failure too', async () => {
    const { container } = draw({ onToggleEnabled: vi.fn(async () => { throw new Error('boom') }) })
    await userEvent.click(switchOf(container, 22, 'Enable Moto Express'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(switchOf(container, 22, 'Enable Moto Express')).toHaveAttribute('aria-checked', 'false')
  })

  it('actionDisabled makes every switch really disabled (not just styled)', async () => {
    const { container } = draw({ actionDisabled: true })
    const all = within(container).getAllByRole('switch')
    expect(all).toHaveLength(3)
    all.forEach(item => expect(item).toBeDisabled())
    await userEvent.click(all[0])
    expect(current.onToggleEnabled).not.toHaveBeenCalled()
  })

  it('without actionDisabled none is disabled; turning one ON is one click, with no question', async () => {
    const { container } = draw()
    // redesign (n.º 10, P-1): the integration (21) is read only: its switch is the one that is disabled
    within(container).getAllByRole('switch').filter(item => item !== switchOf(container, 21, 'Enable Uber Direct')).forEach(item => expect(item).not.toBeDisabled())
    await userEvent.click(switchOf(container, 22, 'Enable Moto Express'))
    expect(current.onToggleEnabled).toHaveBeenLastCalledWith(moto, true)
    expect(current.confirmDisable).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // redesign D-5 (owner, 2026-10-19): turning a company OFF asks first (the host's dialog); ON stays immediate
  it('turning one OFF asks the host first (company) and saves only once it is confirmed', async () => {
    let answer
    const confirmDisable = vi.fn(() => new Promise(resolve => { answer = resolve }))
    const { container } = draw({ confirmDisable })
    const toggle = () => switchOf(container, 23, 'Enable No name')
    await userEvent.click(toggle())
    expect(confirmDisable).toHaveBeenCalledWith(bare)
    // while the question is open nothing was saved and the switch still shows the stored value, not busy
    expect(current.onToggleEnabled).not.toHaveBeenCalled()
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(toggle()).not.toHaveAttribute('aria-busy')
    await act(async () => { answer(true) })
    await waitFor(() => expect(current.onToggleEnabled).toHaveBeenCalledWith(bare, false))
  })

  it('«no» to the question writes nothing and leaves the switch where it was', async () => {
    const confirmDisable = vi.fn(async () => false)
    const { container } = draw({ confirmDisable })
    await userEvent.click(switchOf(container, 23, 'Enable No name'))
    await waitFor(() => expect(confirmDisable).toHaveBeenCalledTimes(1))
    expect(current.onToggleEnabled).not.toHaveBeenCalled()
    expect(switchOf(container, 23, 'Enable No name')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('without onToggleEnabled the switch still draws and a press is harmless', async () => {
    const { container } = draw({ onToggleEnabled: undefined })
    await userEvent.click(switchOf(container, 23, 'Enable No name'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('CompaniesTable rows and selection (M-DC14)', () => {
  it('a click and Enter open the company; the open one is aria-current', async () => {
    const { container } = draw({ activeId: 22 })
    expect(rowOf(container, 22)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 21)).not.toHaveAttribute('aria-current')
    await userEvent.click(within(rowOf(container, 21)).getByText('Uber Direct'))
    expect(current.onOpen).toHaveBeenCalledWith(uber)
    act(() => rowOf(container, 23).focus())
    await userEvent.keyboard('{Enter}')
    expect(current.onOpen).toHaveBeenLastCalledWith(bare)
  })

  it('the open id may come from the URL as a string', () => {
    const { container } = draw({ activeId: '22' })
    expect(rowOf(container, 22)).toHaveAttribute('aria-current', 'true')
  })

  it('the selection column stays with a company open', () => {
    const { container } = draw({ activeId: 22 })
    expect(container.querySelector('th[data-selection]')).toBeInTheDocument()
    expect(within(rowOf(container, 22)).getByRole('checkbox', { name: 'Select Moto Express' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeInTheDocument()
  })

  it('without onToggleSelect there is no selection column', () => {
    const { container } = draw({ onToggleSelect: undefined, onToggleAll: undefined })
    expect(container.querySelector('th[data-selection]')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('header «Select all» toggles this page with its ids; each row has «Select _name_»; neither opens the row', async () => {
    const { container } = draw({ selectedIds: [22] })
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    expect(all).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(all)
    expect(current.onToggleAll).toHaveBeenCalledWith([22, 23]) // not 21: an integration cannot be selected (n.º 10, P-1)
    expect(within(rowOf(container, 22)).getByRole('checkbox', { name: 'Select Moto Express' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(rowOf(container, 23)).getByRole('checkbox', { name: 'Select No name' }))
    expect(current.onToggleSelect).toHaveBeenCalledWith(23)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('ids selected on other pages do not make the header checked', () => {
    draw({ selectedIds: [21, 22, 23, 99] })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
    expect(current.selectedIds).toContain(99)
  })
})

// redesign (n.º 10, drivers-companies P-1): an integration (owner_type system) stays in the list but is read only here
describe('CompaniesTable integrations are read only (n.º 10, P-1)', () => {
  it('the integration row has no checkbox and a disabled switch that saves nothing; own companies keep both', async () => {
    const { container } = draw()
    expect(within(rowOf(container, 21)).queryByRole('checkbox')).toBeNull()
    const locked = within(rowOf(container, 21)).getByRole('switch', { name: 'Enable Uber Direct' })
    expect(locked).toBeDisabled()
    await userEvent.click(locked)
    expect(current.onToggleEnabled).not.toHaveBeenCalled()
    expect(current.confirmDisable).not.toHaveBeenCalled()
    expect(within(rowOf(container, 22)).getByRole('checkbox', { name: 'Select Moto Express' })).toBeInTheDocument()
    expect(within(rowOf(container, 22)).getByRole('switch', { name: 'Enable Moto Express' })).not.toBeDisabled()
  })

  it('it is still listed and opens like any other', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 21)).getByText('Uber Direct'))
    expect(current.onOpen).toHaveBeenCalledWith(uber)
  })

  it('the header «Select all» counts only the selectable rows: with 22 and 23 selected it is checked', () => {
    draw({ selectedIds: [22, 23] })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
  })

  it('a list of integrations only has nothing to select, so no «Select all» either (as the cards)', () => {
    const { container } = draw({ companies: [uber] })
    expect(within(rowOf(container, 21)).queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
  })

  it('on a phone: no checkbox on its card, a disabled switch, and «Select all» skips it', async () => {
    mocks.phone = true
    const { container } = draw({ selectedIds: [22, 23] })
    const card = cardOf(container, 21)
    expect(within(card).queryByRole('checkbox')).toBeNull()
    expect(within(card).getByRole('switch', { name: 'Enable Uber Direct' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(current.onToggleAll).toHaveBeenCalledWith([22, 23])
  })
})

describe('CompaniesTable states (M-DC3, M-DC4)', () => {
  it('loading: a skeleton row per page-size item, announced once, no empty state', () => {
    const { container } = draw({ loading: true, companies: [], pageSize: 6 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(6)
    expect(screen.getByText('Loading companies')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No driver companies yet')).toBeNull()
  })

  it('loading with no page size draws ten', () => {
    const { container } = draw({ loading: true, companies: [], pageSize: undefined })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(10)
  })

  it('error: «We couldn\'t load the companies.» with Retry in place of the table', async () => {
    draw({ error: ['Server down'], companies: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the companies.")
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('an error as a string or as { message } counts too', () => {
    const text = draw({ error: 'Server down', companies: [] })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    text.unmount()
    draw({ error: { message: 'Server down' }, companies: [] })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('an empty error list is no error, and a loading list shows no error', () => {
    const quiet = draw({ error: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
    quiet.unmount()
    draw({ error: ['x'], loading: true, companies: [] })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('empty without a search: «No driver companies yet» and «Add driver company»', async () => {
    draw({ companies: [] })
    expect(screen.getByText('No driver companies yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add driver company' }))
    expect(current.onAdd).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  it('a blank search counts as no search', () => {
    draw({ companies: [], searchValue: '   ' })
    expect(screen.getByText('No driver companies yet')).toBeInTheDocument()
  })

  it('empty with a search: «No companies match» and «Clear search»', async () => {
    draw({ companies: [], searchValue: 'zzz' })
    expect(screen.getByText('No companies match')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(current.onClearSearch).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Add driver company' })).toBeNull()
  })

  it('«Add driver company» is really disabled with actionDisabled', async () => {
    draw({ companies: [], actionDisabled: true })
    const add = screen.getByRole('button', { name: 'Add driver company' })
    expect(add).toBeDisabled()
    await userEvent.click(add)
    expect(current.onAdd).not.toHaveBeenCalled()
  })
})

describe('CompaniesTable on a phone (cards)', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, no table: name, «#id · priority · limit · timezone», the checkbox and the switch', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Delivery companies' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const card = cardOf(container, 21)
    expect(within(card).getByRole('link', { name: 'Uber Direct' })).toBeInTheDocument()
    expect(card.textContent).toMatch(/#21\s*·\s*High\s*·\s*Limit 25\s*·\s*America\/Bogota/)
    expect(within(card).getByText('#21')).toHaveClass('odc-figure')
    expect(within(card).queryByRole('checkbox')).toBeNull() // redesign (n.º 10, P-1): an integration cannot be selected
    expect(within(cardOf(container, 22)).getByRole('checkbox', { name: 'Select Moto Express' })).toBeInTheDocument()
    expect(within(card).getByRole('switch', { name: 'Enable Uber Direct' })).toHaveAttribute('aria-checked', 'true')
    expect(within(cardOf(container, 22)).getByRole('switch', { name: 'Enable Moto Express' })).toHaveAttribute('aria-checked', 'false')
  })

  it('what a company does not have is left out, with no stray separator', () => {
    const { container } = draw()
    const text = cardOf(container, 23).textContent
    expect(text).toMatch(/#23\s*·\s*Unknown/)
    expect(text).not.toContain('Limit')
    expect(text).not.toMatch(/·\s*$/)
  })

  it('the «Integration» mark is on the title of a system company only', () => {
    const { container } = draw()
    expect(within(cardOf(container, 21)).getByText('Integration')).toBeInTheDocument()
    expect(cardOf(container, 22)).not.toHaveTextContent('Integration')
  })

  it('the card name carries the full name in its title and reads from its own side', () => {
    const { container } = draw()
    const name = cardOf(container, 21).querySelector('.odc-dc-card-name')
    expect(name).toHaveAttribute('title', 'Uber Direct')
    expect(name).toHaveAttribute('dir', 'auto')
  })

  it('never shows a datum twice', () => {
    const { container } = draw()
    const card = cardOf(container, 21)
    expect(card.textContent.match(/Uber Direct/g)).toHaveLength(1)
    expect(card.textContent.match(/#21/g)).toHaveLength(1)
    expect(card.textContent.match(/America\/Bogota/g)).toHaveLength(1)
  })

  it('the actions sit in a [data-card-actions] wrapper: the checkbox and the switch do not open the card', async () => {
    const { container } = draw()
    const card = cardOf(container, 22)
    expect(card.querySelector('[data-card-actions]')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('checkbox'))
    expect(current.onToggleSelect).toHaveBeenCalledWith(22)
    await userEvent.click(within(card).getByRole('switch', { name: 'Enable Moto Express' }))
    expect(current.onToggleEnabled).toHaveBeenLastCalledWith(moto, true)
    expect(current.onOpen).not.toHaveBeenCalled()
    const link = within(card).getByRole('link', { name: 'Moto Express' })
    expect(link.getAttribute('href')).toMatch(/\?.*id=22/)
    await userEvent.click(link)
    expect(current.onOpen).toHaveBeenCalledWith(moto)
  })

  it('without onToggleSelect the cards have no checkbox, only the switch', () => {
    const { container } = draw({ onToggleSelect: undefined, onToggleAll: undefined })
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(within(cardOf(container, 21)).getByRole('switch')).toBeInTheDocument()
  })

  it('the card switch fails like the row one: it does not move and says why', async () => {
    const { container } = draw({ onToggleEnabled: vi.fn(async () => ({ ok: false, error: [] })) })
    const card = cardOf(container, 23)
    await userEvent.click(within(card).getByRole('switch', { name: 'Enable No name' }))
    expect(await within(card).findByRole('alert')).toHaveTextContent("The company didn't change. Try again.")
    expect(within(card).getByRole('switch', { name: 'Enable No name' })).toHaveAttribute('aria-checked', 'true')
  })

  it('the open company is current, actionDisabled disables the switches', () => {
    const open = draw({ activeId: 21 })
    expect(cardOf(open.container, 21)).toHaveAttribute('aria-current', 'true')
    open.unmount()
    const locked = draw({ actionDisabled: true })
    within(locked.container).getAllByRole('switch').forEach(item => expect(item).toBeDisabled())
  })

  describe('«Select all» for the page', () => {
    const selectAll = () => screen.getByRole('checkbox', { name: 'Select all' })

    it('is a checkbox above the cards: unchecked, mixed or checked', () => {
      const none = draw()
      expect(selectAll()).toHaveAttribute('aria-checked', 'false')
      none.unmount()
      const some = draw({ selectedIds: [22, 99] })
      expect(selectAll()).toHaveAttribute('aria-checked', 'mixed')
      some.unmount()
      draw({ selectedIds: [21, 22, 23] })
      expect(selectAll()).toHaveAttribute('aria-checked', 'true')
    })

    it('a click calls onToggleAll with the ids of the page', async () => {
      draw({ selectedIds: [22] })
      await userEvent.click(selectAll())
      expect(current.onToggleAll).toHaveBeenCalledWith([22, 23]) // n.º 10, P-1: not the integration
      expect(current.onOpen).not.toHaveBeenCalled()
    })

    it('is not drawn without a selection, while loading, nor with no rows', () => {
      const none = draw({ onToggleSelect: undefined, onToggleAll: undefined })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
      none.unmount()
      const loading = draw({ loading: true, companies: [] })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
      loading.unmount()
      draw({ companies: [] })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    })
  })

  it('keeps the four states: skeleton cards, error with Retry, no match, empty (each with its action)', async () => {
    const loading = draw({ loading: true, companies: [], pageSize: 4 })
    expect(loading.container.querySelectorAll('li[data-skeleton]')).toHaveLength(4)
    expect(screen.getByText('Loading companies')).toBeInTheDocument()
    loading.unmount()
    const failed = draw({ error: ['x'], companies: [] })
    expect(screen.getByText("We couldn't load the companies.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    failed.unmount()
    const noMatch = draw({ companies: [], searchValue: 'q' })
    expect(screen.getByText('No companies match')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(current.onClearSearch).toHaveBeenCalledTimes(1)
    noMatch.unmount()
    draw({ companies: [] })
    expect(screen.getByText('No driver companies yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add driver company' }))
    expect(current.onAdd).toHaveBeenCalledTimes(1)
  })
})

describe('companies-table.css', () => {
  const css = readFileSync(resolvePath(__dirname, '../companies-table.css'), 'utf8')

  it('uses tokens only: no color, px or numeric z-index outside a media or container query', () => {
    const outside = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|container)[^{]*\{/g, '@query{')
    expect(outside).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(outside).not.toMatch(/\brgba?\(/)
    expect(outside).not.toMatch(/\d(px|rem|em)\b/)
    expect(outside).not.toMatch(/z-index:\s*-?\d/)
  })

  it('uses logical properties only', () => {
    expect(css).not.toMatch(/\b(margin|padding)-(left|right|top|bottom)\b/)
    expect(css).not.toMatch(/(^|[\s;{])(left|right|width|height)\s*:/m)
    expect(css).not.toMatch(/text-align:\s*(left|right)/)
  })

  it('every own class starts with odc-dc- and the Integration mark sits on the subtle surface with a token radius', () => {
    const own = Array.from(css.matchAll(/\.(odc-[a-z0-9-]+)/g)).map(match => match[1])
    const foreign = [...new Set(own)].filter(name => !name.startsWith('odc-dc-') && !['odc-order-card-arrow', 'odc-order-card-link'].includes(name))
    expect(foreign).toEqual([])
    const tag = css.match(/\.odc-dc-tag\s*\{[^}]*\}/)?.[0] ?? ''
    expect(tag).toMatch(/background:\s*var\(--od-surface-subtle\)/)
    expect(tag).toMatch(/border-radius:\s*var\(--od-radius-/)
    expect(tag).toMatch(/color:\s*var\(--od-text-muted\)/)
  })
})
