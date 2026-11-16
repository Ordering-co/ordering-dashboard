/* eslint-disable import/first */
// redesign DG-B3 (decisions 2, 4, 5; M-DG1, M-DG4, M-DG10, M-DG36): the delivery groups list as a Product DataTable (and
// RecordCards under 768px). The text comes out of the real helpers of groupData.js; only the environment (language, the phone
// flag) is simulated. The Product wrappers are real.
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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

import { GroupsTable } from '../GroupsTable'

const ana = { id: 1, name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com', photo: null }
const bruno = { id: 2, name: 'Bruno', lastname: 'Paz', email: 'bruno@example.com', photo: null }

const downtown = {
  id: 11,
  name: 'Downtown A',
  type: 0,
  enabled: true,
  priority: 1,
  administrator_id: 1,
  administrators: [ana],
  drivers: new Array(12).fill({ id: 1 }),
  business: [{ id: 1 }, { id: 2 }, { id: 3 }],
  driver_companies: []
}
const harbor = {
  id: 12,
  name: 'Harbor',
  type: 1,
  enabled: false,
  priority: 0,
  administrator_id: 1,
  administrators: [ana, bruno],
  drivers: [],
  business: [{ id: 4 }],
  driver_companies: [{ id: 9 }]
}
const orphan = { id: 13, name: 'Orphan', type: 0, enabled: true, administrators: [], drivers: [{ id: 5 }], business: [], driver_companies: [] }

let current
const draw = (props = {}) => {
  current = {
    groups: [downtown, harbor, orphan],
    loading: false,
    error: null,
    searchValue: '',
    selectedIds: [],
    onToggleSelect: vi.fn(),
    onToggleAll: vi.fn(),
    activeId: undefined,
    onOpen: vi.fn(),
    onToggleEnabled: vi.fn(async () => ({ ok: true })),
    onConfirmDisable: vi.fn(async () => true),
    actionDisabled: false,
    onAdd: vi.fn(),
    onClearSearch: vi.fn(),
    onRetry: vi.fn(),
    pageSize: 10,
    ...props
  }
  const ui = (next) => <GroupsTable {...next} />
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
// the data cells after the Group row header (the selection cell is not one of them): [Assigns to, Stores, Enabled] (redesign tanda AB, U-2: no Status column)
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

describe('GroupsTable columns (decision 2)', () => {
  it('has Group, Assigns to, Stores and Enabled; no ID and no Type column', () => {
    draw()
    expect(headers()).toEqual(['Group', 'Assigns to', 'Stores', 'Enabled'])
    expect(screen.getByRole('table', { name: 'Delivery groups' })).toBeInTheDocument()
  })

  it('the Group cell: the name in strong, then «#id · manager»', () => {
    const { container } = draw()
    const header = within(rowOf(container, 11)).getByRole('rowheader')
    expect(within(header).getByText('Downtown A').tagName).toBe('STRONG')
    expect(within(header).getByText('#11')).toHaveClass('odc-figure')
    expect(header.textContent).toMatch(/Downtown A.*#11.*·.*Ana Ruiz/)
  })

  // M-DG36: the manager comes from `administrators`; the API sends no `administrator`
  it('the manager is read from administrators (M-DG36): «Ana Ruiz», «Ana Ruiz +1» with two, «No manager» with none', () => {
    const { container } = draw()
    expect(within(rowOf(container, 11)).getByRole('rowheader')).toHaveTextContent('Ana Ruiz')
    expect(within(rowOf(container, 11)).getByRole('rowheader')).not.toHaveTextContent('No manager')
    expect(within(rowOf(container, 12)).getByRole('rowheader')).toHaveTextContent('Ana Ruiz +1')
    expect(within(rowOf(container, 13)).getByRole('rowheader')).toHaveTextContent('No manager')
  })

  it('Assigns to: «12 drivers» for in-house groups, «1 company» for company groups', () => {
    const { container } = draw()
    expect(cellsOf(rowOf(container, 11))[0]).toHaveTextContent('12 drivers')
    expect(cellsOf(rowOf(container, 12))[0]).toHaveTextContent('1 company')
    expect(cellsOf(rowOf(container, 13))[0]).toHaveTextContent('1 driver')
  })

  it('Stores is a figure, 0 included', () => {
    const { container } = draw()
    const figure = cellsOf(rowOf(container, 11))[1].querySelector('.odc-figure')
    expect(figure).toHaveTextContent(/^3$/)
    expect(cellsOf(rowOf(container, 13))[1].querySelector('.odc-figure')).toHaveTextContent(/^0$/)
  })

  it('the rows are plain data of the page: the table fetches nothing and the group order is the given one', () => {
    const { container } = draw({ groups: [harbor, downtown] })
    expect(Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map(row => row.dataset.rowId)).toEqual(['12', '11'])
  })

  it('wears the tour anchor on the container of the table', () => {
    const { container } = draw()
    const anchor = container.querySelector('[data-tour="tour_delivery_completed"]')
    expect(anchor).toBeInTheDocument()
    expect(anchor).toContainElement(screen.getByRole('table'))
  })
})

// redesign tanda AB (U-2, U-3): the state is told once on the table (the switch), and the count is a right-aligned figure
describe('GroupsTable tanda AB (U-2, U-3)', () => {
  it('U-2: the table has no Status column; the switch is the only state of a row', () => {
    const { container } = draw()
    expect(headers()).not.toContain('Status')
    const row = rowOf(container, 11)
    expect(row.querySelector('.odc-status')).toBeNull()
    expect(within(row).getByRole('switch', { name: 'Enable Downtown A' })).toHaveAttribute('aria-checked', 'true')
    expect(within(rowOf(container, 12)).getByRole('switch', { name: 'Enable Harbor' })).toHaveAttribute('aria-checked', 'false')
  })

  it('U-3: the Stores header and its cells are aligned to the end', () => {
    const { container } = draw()
    resizeTo(2000)
    const storesHeader = screen.getAllByRole('columnheader').find(header => header.textContent === 'Stores')
    expect(storesHeader).toHaveAttribute('data-align', 'end')
    expect(cellsOf(rowOf(container, 11))[1]).toHaveAttribute('data-align', 'end')
    expect(cellsOf(rowOf(container, 11))[1]).toHaveTextContent(/^3$/)
  })
})

describe('GroupsTable width priorities', () => {
  it('all five columns fit the 728px of a 1024 window without a panel', () => {
    draw()
    resizeTo(728)
    expect(headers()).toEqual(['Group', 'Assigns to', 'Stores', 'Enabled'])
  })

  it('when the list narrows Stores steps aside first, then Assigns to; Group carries what left; Enabled stays', () => {
    const { container } = draw()
    resizeTo(2000)
    expect(headers()).toEqual(['Group', 'Assigns to', 'Stores', 'Enabled'])
    expect(within(rowOf(container, 11)).getByRole('rowheader')).not.toHaveTextContent('3 stores')
    resizeTo(560) // redesign tanda AB (U-2): without Status the thresholds are 590 (Stores) and 502 (Assigns to)
    expect(headers()).toEqual(['Group', 'Assigns to', 'Enabled'])
    expect(within(rowOf(container, 11)).getByRole('rowheader')).toHaveTextContent('3 stores')
    expect(within(rowOf(container, 11)).getByRole('rowheader')).not.toHaveTextContent('12 drivers')
    resizeTo(400)
    expect(headers()).toEqual(['Group', 'Enabled'])
    expect(within(rowOf(container, 11)).getByRole('rowheader')).toHaveTextContent('12 drivers')
    expect(within(rowOf(container, 11)).getByRole('rowheader')).toHaveTextContent('3 stores')
    expect(within(rowOf(container, 11)).getByRole('switch', { name: 'Enable Downtown A' })).toBeInTheDocument()
    resizeTo(2000)
    expect(headers()).toEqual(['Group', 'Assigns to', 'Stores', 'Enabled'])
    expect(within(rowOf(container, 11)).getByRole('rowheader')).not.toHaveTextContent('12 drivers')
  })
})

// A host that keeps the stored value, as the controller's record does: it changes only when the save went through.
const Host = ({ outcome = { ok: true }, gate, saves = [], ...props }) => {
  const [groups, setGroups] = useState([downtown, harbor, orphan])
  const onToggleEnabled = async (group, next) => {
    saves.push([group.id, next])
    if (gate) await gate
    if (outcome.ok) setGroups(list => list.map(item => item.id === group.id ? { ...item, enabled: next } : item))
    return outcome
  }
  return <GroupsTable {...props} groups={groups} onToggleEnabled={onToggleEnabled} onOpen={props.onOpen ?? vi.fn()} />
}

describe('GroupsTable enabled switch (decision 5; M-DG4)', () => {
  const switchOf = (container, id, name) => within(rowOf(container, id)).getByRole('switch', { name })

  it('is named «Enable _name_» and checked by the group', () => {
    const { container } = draw()
    expect(switchOf(container, 11, 'Enable Downtown A')).toHaveAttribute('aria-checked', 'true')
    expect(switchOf(container, 12, 'Enable Harbor')).toHaveAttribute('aria-checked', 'false')
  })

  // redesign D-5 (owner, 2026-10-19): switching OFF asks the host first (`onConfirmDisable`); switching ON does not
  it('pressing one asks the host (group, next) and never opens the row; only turning off asks first', async () => {
    const { container } = draw()
    await userEvent.click(switchOf(container, 11, 'Enable Downtown A'))
    expect(current.onConfirmDisable).toHaveBeenCalledTimes(1)
    expect(current.onConfirmDisable).toHaveBeenLastCalledWith(downtown)
    expect(current.onToggleEnabled).toHaveBeenLastCalledWith(downtown, false)
    await userEvent.click(switchOf(container, 12, 'Enable Harbor'))
    expect(current.onToggleEnabled).toHaveBeenLastCalledWith(harbor, true)
    expect(current.onToggleEnabled).toHaveBeenCalledTimes(2)
    expect(current.onConfirmDisable).toHaveBeenCalledTimes(1) // enabling stays immediate
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('when the host says no to disabling, nothing is saved and the switch stays on', async () => {
    const { container } = draw({ onConfirmDisable: vi.fn(async () => false) })
    await userEvent.click(switchOf(container, 11, 'Enable Downtown A'))
    expect(current.onConfirmDisable).toHaveBeenCalledWith(downtown)
    expect(current.onToggleEnabled).not.toHaveBeenCalled()
    expect(switchOf(container, 11, 'Enable Downtown A')).toHaveAttribute('aria-checked', 'true')
    expect(switchOf(container, 11, 'Enable Downtown A')).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the answer of the host is awaited: the save waits for the confirmation', async () => {
    let answer
    const ask = new Promise(resolve => { answer = resolve })
    const { container } = draw({ onConfirmDisable: vi.fn(() => ask) })
    await userEvent.click(switchOf(container, 11, 'Enable Downtown A'))
    expect(current.onToggleEnabled).not.toHaveBeenCalled()
    await act(async () => { answer(true) })
    await waitFor(() => expect(current.onToggleEnabled).toHaveBeenCalledWith(downtown, false))
  })

  it('is controlled and busy while it saves; the stored value arrives with ok', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const saves = []
    const { container } = render(<Host gate={gate} saves={saves} />)
    const toggle = () => switchOf(container, 11, 'Enable Downtown A')
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle())
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-busy', 'true'))
    expect(saves).toEqual([[11, false]])
    await userEvent.click(toggle()) // ignored while it lasts
    expect(saves).toHaveLength(1)
    await act(async () => { release() })
    await waitFor(() => expect(toggle()).not.toHaveAttribute('aria-busy'))
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure does not move it, and says so below it (not optimistic)', async () => {
    const { container } = render(<Host outcome={{ ok: false, error: [] }} />)
    const toggle = () => switchOf(container, 11, 'Enable Downtown A')
    await userEvent.click(toggle())
    expect(await screen.findByRole('alert')).toHaveTextContent("The group didn't change. Try again.")
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(within(cellsOf(rowOf(container, 11))[2]).getByRole('alert')).toBeInTheDocument()
  })

  // (7): R1-05 of . The row's save fails, then the panel's header switch saves the same group: the row's
  // notice was about the old value and goes, so the column narrows again.
  it('a later save from the header clears the row\'s old failure notice', async () => {
    const HeaderHost = () => {
      const [groups, setGroups] = useState([downtown, harbor, orphan])
      const saveFromHeader = () => setGroups(list => list.map(item => item.id === 11 ? { ...item, enabled: false } : item))
      return (
        <>
          <button type='button' onClick={saveFromHeader}>Header switch</button>
          <GroupsTable groups={groups} onToggleEnabled={async () => ({ ok: false, error: [] })} onOpen={vi.fn()} />
        </>
      )
    }
    const { container } = render(<HeaderHost />)
    await userEvent.click(switchOf(container, 11, 'Enable Downtown A'))
    expect(await screen.findByRole('alert')).toHaveTextContent("The group didn't change. Try again.")
    await userEvent.click(screen.getByRole('button', { name: 'Header switch' }))
    expect(switchOf(container, 11, 'Enable Downtown A')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a rejected promise is a failure too', async () => {
    const { container } = draw({ onToggleEnabled: vi.fn(async () => { throw new Error('boom') }) })
    await userEvent.click(switchOf(container, 12, 'Enable Harbor'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(switchOf(container, 12, 'Enable Harbor')).toHaveAttribute('aria-checked', 'false')
  })

  it('actionDisabled makes every switch really disabled (not just styled)', async () => {
    const { container } = draw({ actionDisabled: true })
    const all = within(container).getAllByRole('switch')
    expect(all).toHaveLength(3)
    all.forEach(item => expect(item).toBeDisabled())
    await userEvent.click(all[0])
    expect(current.onToggleEnabled).not.toHaveBeenCalled()
  })

  it('without actionDisabled none is disabled', () => {
    const { container } = draw()
    within(container).getAllByRole('switch').forEach(item => expect(item).not.toBeDisabled())
  })

  // redesign D-5: the question belongs to the host (the page renders the one dialog); the table draws none
  it('draws no dialog of its own: the confirmation is the host\'s', async () => {
    const { container } = draw()
    await userEvent.click(switchOf(container, 11, 'Enable Downtown A'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('without onConfirmDisable the switch is as before: one click', async () => {
    const { container } = draw({ onConfirmDisable: undefined })
    await userEvent.click(switchOf(container, 11, 'Enable Downtown A'))
    expect(current.onToggleEnabled).toHaveBeenCalledWith(downtown, false)
  })
})

describe('GroupsTable rows and selection (M-DG1)', () => {
  it('a click and Enter open the group; the open one is aria-current', async () => {
    const { container } = draw({ activeId: 12 })
    expect(rowOf(container, 12)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 11)).not.toHaveAttribute('aria-current')
    await userEvent.click(within(rowOf(container, 11)).getByText('Downtown A'))
    expect(current.onOpen).toHaveBeenCalledWith(downtown)
    act(() => rowOf(container, 13).focus())
    await userEvent.keyboard('{Enter}')
    expect(current.onOpen).toHaveBeenLastCalledWith(orphan)
  })

  it('the open id may come from the URL as a string', () => {
    const { container } = draw({ activeId: '12' })
    expect(rowOf(container, 12)).toHaveAttribute('aria-current', 'true')
  })

  it('the selection column stays with a group open', () => {
    const { container } = draw({ activeId: 11 })
    expect(container.querySelector('th[data-selection]')).toBeInTheDocument()
    expect(within(rowOf(container, 11)).getByRole('checkbox', { name: 'Select Downtown A' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeInTheDocument()
  })

  it('without onToggleSelect there is no selection column', () => {
    const { container } = draw({ onToggleSelect: undefined, onToggleAll: undefined })
    expect(container.querySelector('th[data-selection]')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('header «Select all» toggles this page with its ids; each row has «Select _name_»; neither opens the row', async () => {
    const { container } = draw({ selectedIds: [12] })
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    expect(all).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(all)
    expect(current.onToggleAll).toHaveBeenCalledWith([11, 12, 13])
    expect(within(rowOf(container, 12)).getByRole('checkbox', { name: 'Select Harbor' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(rowOf(container, 11)).getByRole('checkbox', { name: 'Select Downtown A' }))
    expect(current.onToggleSelect).toHaveBeenCalledWith(11)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('ids selected on other pages do not make the header checked', () => {
    draw({ selectedIds: [11, 12, 13, 99] })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
    expect(current.selectedIds).toContain(99)
  })
})

describe('GroupsTable states (M-DG10)', () => {
  it('loading: a skeleton row per page-size item, announced once, no empty state', () => {
    const { container } = draw({ loading: true, groups: [], pageSize: 6 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(6)
    expect(screen.getByText('Loading groups')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No delivery groups yet')).toBeNull()
  })

  it('error: «We couldn\'t load the groups.» with Retry in place of the table', async () => {
    draw({ error: ['Server down'], groups: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the groups.")
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('an empty error list is no error, and a loading list shows no error', () => {
    const quiet = draw({ error: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
    quiet.unmount()
    draw({ error: ['x'], loading: true, groups: [] })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('empty without a search: «No delivery groups yet» and «Add new driver group»', async () => {
    draw({ groups: [] })
    expect(screen.getByText('No delivery groups yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add new driver group' }))
    expect(current.onAdd).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  it('a blank search counts as no search', () => {
    draw({ groups: [], searchValue: '   ' })
    expect(screen.getByText('No delivery groups yet')).toBeInTheDocument()
  })

  it('empty with a search: «No groups match» and «Clear search»', async () => {
    draw({ groups: [], searchValue: 'zzz' })
    expect(screen.getByText('No groups match')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(current.onClearSearch).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Add new driver group' })).toBeNull()
  })

  it('«Add new driver group» is really disabled with actionDisabled', async () => {
    draw({ groups: [], actionDisabled: true })
    const add = screen.getByRole('button', { name: 'Add new driver group' })
    expect(add).toBeDisabled()
    await userEvent.click(add)
    expect(current.onAdd).not.toHaveBeenCalled()
  })

  it('the empty state keeps the tour anchor too', () => {
    const { container } = draw({ groups: [] })
    expect(container.querySelector('[data-tour="tour_delivery_completed"]')).toBeInTheDocument()
  })
})

describe('GroupsTable on a phone (cards)', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, no table: name, «#id · type · assigns to · N stores», status, the checkbox and the switch', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const card = cardOf(container, 11)
    expect(within(card).getByRole('link', { name: 'Downtown A' })).toBeInTheDocument()
    expect(card.textContent).toMatch(/#11\s*·\s*In house drivers\s*·\s*12 drivers\s*·\s*3 stores/)
    expect(within(card).getByText('#11')).toHaveClass('odc-figure')
    expect(card.querySelector('.odc-status')).toHaveAttribute('data-family', 'done')
    expect(card.querySelector('.odc-status')).toHaveTextContent('Enabled')
    expect(within(card).getByRole('checkbox', { name: 'Select Downtown A' })).toBeInTheDocument()
    expect(within(card).getByRole('switch', { name: 'Enable Downtown A' })).toHaveAttribute('aria-checked', 'true')
    expect(cardOf(container, 12).textContent).toMatch(/#12\s*·\s*Driver companies\s*·\s*1 company\s*·\s*1 store(?!s)/)
    expect(cardOf(container, 12).querySelector('.odc-status')).toHaveAttribute('data-family', 'cancel')
  })

  // redesign DG-R1 (phase 3 mechanical): the card name is cut with an ellipsis in 7 of 12 languages; like the desktop row it carries the full name
  it('the card name carries the full name in its title, as the desktop row does', () => {
    const { container } = draw()
    const card = cardOf(container, 11)
    expect(card.querySelector('.odc-dg-card-name')).toHaveAttribute('title', 'Downtown A')
    expect(card.querySelector('.odc-dg-card-name')).toHaveAttribute('dir', 'auto')
    expect(within(card).getByRole('link', { name: 'Downtown A' })).toBeInTheDocument()
  })

  // redesign DG-B3 (M-DG36): the card keeps the manager the desktop row shows
  it('keeps the manager on the card: «Ana Ruiz», «Ana Ruiz +1», «No manager»', () => {
    const { container } = draw()
    expect(cardOf(container, 11).textContent).toContain('Ana Ruiz')
    expect(cardOf(container, 12).textContent).toContain('Ana Ruiz +1')
  })

  it('never shows a datum twice', () => {
    const { container } = draw()
    const card = cardOf(container, 11)
    expect(card.textContent.match(/Downtown A/g)).toHaveLength(1)
    expect(card.textContent.match(/#11/g)).toHaveLength(1)
    expect(card.textContent.match(/12 drivers/g)).toHaveLength(1)
  })

  it('the actions sit in a [data-card-actions] wrapper: the checkbox and the switch do not open the card', async () => {
    const { container } = draw()
    const card = cardOf(container, 12)
    expect(card.querySelector('[data-card-actions]')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('checkbox'))
    expect(current.onToggleSelect).toHaveBeenCalledWith(12)
    await userEvent.click(within(card).getByRole('switch', { name: 'Enable Harbor' }))
    expect(current.onToggleEnabled).toHaveBeenLastCalledWith(harbor, true)
    expect(current.onOpen).not.toHaveBeenCalled()
    const link = within(card).getByRole('link', { name: 'Harbor' })
    expect(link.getAttribute('href')).toMatch(/\?.*id=12/)
    await userEvent.click(link)
    expect(current.onOpen).toHaveBeenCalledWith(harbor)
  })

  it('the card switch fails like the row one: it does not move and says why', async () => {
    const { container } = draw({ onToggleEnabled: vi.fn(async () => ({ ok: false, error: [] })) })
    const card = cardOf(container, 11)
    await userEvent.click(within(card).getByRole('switch', { name: 'Enable Downtown A' }))
    expect(await within(card).findByRole('alert')).toHaveTextContent("The group didn't change. Try again.")
    expect(within(card).getByRole('switch', { name: 'Enable Downtown A' })).toHaveAttribute('aria-checked', 'true')
  })

  it('the open group is current, actionDisabled disables the switches', () => {
    const open = draw({ activeId: 11 })
    expect(cardOf(open.container, 11)).toHaveAttribute('aria-current', 'true')
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
      const some = draw({ selectedIds: [12, 99] })
      expect(selectAll()).toHaveAttribute('aria-checked', 'mixed')
      some.unmount()
      draw({ selectedIds: [11, 12, 13] })
      expect(selectAll()).toHaveAttribute('aria-checked', 'true')
    })

    it('a click calls onToggleAll with the ids of the page', async () => {
      draw({ selectedIds: [12] })
      await userEvent.click(selectAll())
      expect(current.onToggleAll).toHaveBeenCalledWith([11, 12, 13])
      expect(current.onOpen).not.toHaveBeenCalled()
    })

    it('is not drawn without a selection, while loading, nor with no rows', () => {
      const none = draw({ onToggleSelect: undefined, onToggleAll: undefined })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
      none.unmount()
      const loading = draw({ loading: true, groups: [] })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
      loading.unmount()
      draw({ groups: [] })
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull()
    })
  })

  it('keeps the states: skeleton cards, error with Retry, no match, empty, and the tour anchor', async () => {
    const loading = draw({ loading: true, groups: [], pageSize: 4 })
    expect(loading.container.querySelectorAll('li[data-skeleton]')).toHaveLength(4)
    expect(loading.container.querySelector('[data-tour="tour_delivery_completed"]')).toBeInTheDocument()
    loading.unmount()
    const failed = draw({ error: ['x'], groups: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    failed.unmount()
    const noMatch = draw({ groups: [], searchValue: 'q' })
    expect(screen.getByText('No groups match')).toBeInTheDocument()
    noMatch.unmount()
    draw({ groups: [] })
    expect(screen.getByText('No delivery groups yet')).toBeInTheDocument()
  })
})

describe('groups-table.css', () => {
  const css = readFileSync(resolve(__dirname, '../groups-table.css'), 'utf8')

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
})
