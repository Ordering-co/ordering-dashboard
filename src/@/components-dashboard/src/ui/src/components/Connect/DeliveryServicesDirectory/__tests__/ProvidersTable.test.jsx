/* eslint-disable import/first */
// redesign DS-B2 (decision 6 | M-DS1, M-DS5, M-DS26): the delivery services list as a Product DataTable (and RecordCards under
// 768px). The text comes out of the real helpers of providerData.js; only the environment (language, the phone flag) is
// simulated. The Product wrappers are real. The table fetches nothing: everything arrives by props.
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false, asked: {} }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, text) => { mocks.asked[key] = text; return text }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { ProvidersTable } from '../ProvidersTable'

const doordash = { id: 1, name: 'Doordash Drive', logo: null, enabled: true, plugin_id: null, plugin_root: 'https://plugins.example.com/doordash', plugin: null, driver_groups: [] }
const uber = {
  id: 34,
  name: 'Uber Direct',
  logo: 'https://img.example.com/uber.png',
  enabled: true,
  plugin_id: 364,
  plugin: { id: 364, key: 'uber_direct_integration' },
  driver_groups: [{ id: 100 }]
}
const shipday = { id: 67, name: 'Shipday Delivery Integration', logo: null, enabled: true, plugin_id: 232, plugin: { id: 232, key: 'shipday' }, driver_groups: [{ id: 34 }] }
const yango = { id: 100, name: 'Yango Delivery', logo: null, enabled: false, plugin_id: 12, plugin: { id: 12, key: 'yango' }, driver_groups: [] }
const lala = { id: 8, name: 'Lalamove', logo: null, enabled: false, plugin_id: 13, plugin: { id: 13, key: 'lalamove' }, driver_groups: [{ id: 7 }] }

// The dictionary of useConfig(): Uber's second credential is empty; Shipday, Lalamove and Yango are complete or have none.
const configs = {
  uber_direct_integration_client_id: { id: 11, key: 'uber_direct_integration_client_id', value: 'abc' },
  uber_direct_integration_client_secret: { id: 12, key: 'uber_direct_integration_client_secret', value: '' },
  shipday_api_key: { id: 31, key: 'shipday_api_key', value: 'k' },
  lalamove_api_key: { id: 41, key: 'lalamove_api_key', value: 'k' },
  max_days_preorder: { key: 'max_days_preorder', value: 6 }
}
const groupsInfo = {
  loading: false,
  error: null,
  groups: {
    100: { id: 100, enabled: true, business: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }] },
    34: { id: 34, enabled: true, business: [{ id: 1 }] },
    7: { id: 7, enabled: false, business: [] }
  }
}

let current
const draw = (props = {}) => {
  current = {
    companies: [doordash, uber, shipday, yango, lala],
    groupsInfo,
    configs,
    actionDisabled: false,
    activeId: undefined,
    onOpen: vi.fn(),
    onToggle: vi.fn(async () => ({ ok: true })),
    onInstall: vi.fn(async () => ({ ok: true })),
    installingId: null,
    loading: false,
    error: null,
    onRetry: vi.fn(),
    searchValue: '',
    onClearSearch: vi.fn(),
    ...props
  }
  const ui = (next) => <ProvidersTable {...next} />
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
// the data cells after the Provider row header: [Status, Stores, Enabled, Actions]
const cellsOf = (row) => Array.from(row.querySelectorAll('td'))
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

describe('ProvidersTable columns (decision 6)', () => {
  it('has Provider, Status, Stores and Enabled, and a last column with no visible header; no ID and no «Connect to»', () => {
    const { container } = draw()
    expect(headers()).toEqual(['Provider', 'Status', 'Stores', 'Enabled', 'Actions'])
    expect(screen.getByRole('table', { name: 'Delivery services' })).toBeInTheDocument()
    const actions = screen.getAllByRole('columnheader').at(-1)
    expect(actions.querySelector('.odc-sr-only')).toHaveTextContent('Actions')
    expect(actions.textContent).toBe('Actions') // the whole header is the hidden text
    expect(container.textContent).not.toMatch(/Connect to|Delivery Company/)
  })

  it('the Provider cell: the name in strong, then «#id · group #n»', () => {
    const { container } = draw()
    const header = within(rowOf(container, 34)).getByRole('rowheader')
    expect(within(header).getByText('Uber Direct').tagName).toBe('STRONG')
    expect(header.textContent).toMatch(/Uber Direct.*#34.*·.*group #100/)
    expect(within(header).getByText('#34')).toHaveClass('odc-figure')
    expect(within(header).getByText('group #100')).toHaveClass('odc-figure')
  })

  it('without a group the second line is just «#id»', () => {
    const { container } = draw()
    const header = within(rowOf(container, 1)).getByRole('rowheader')
    expect(header.textContent).toMatch(/Doordash Drive.*#1$/)
    expect(header.textContent).not.toContain('group')
    expect(within(rowOf(container, 100)).getByRole('rowheader').textContent).not.toContain('group')
  })

  it('the avatar is a business tile: the logo when there is one, the initials when not', () => {
    const { container } = draw()
    const withLogo = rowOf(container, 34).querySelector('.odc-avatar')
    expect(withLogo).toHaveAttribute('data-kind', 'business')
    expect(withLogo.querySelector('img')).toHaveAttribute('src', 'https://img.example.com/uber.png')
    const without = rowOf(container, 1).querySelector('.odc-avatar')
    expect(without).toHaveAttribute('data-kind', 'business')
    expect(without.querySelector('img')).toBeNull()
    expect(without).toHaveTextContent('DD')
  })

  it('the rows are plain data of the page: the table fetches nothing and keeps the given order', () => {
    const { container } = draw({ companies: [lala, doordash] })
    expect(Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map(row => row.dataset.rowId)).toEqual(['8', '1'])
  })

  it('wears the tour anchor on the container of the table', () => {
    const { container } = draw()
    const anchor = container.querySelector('[data-tour="tour_delivery_completed"]')
    expect(anchor).toBeInTheDocument()
    expect(anchor).toContainElement(screen.getByRole('table'))
  })
})

describe('ProvidersTable Status: the five states in words (decision 6)', () => {
  const statusOf = (container, id) => cellsOf(rowOf(container, id))[0].querySelector('.odc-status')

  it('not installed (pending), group missing (review), credentials incomplete (review), active (done), paused (cancel)', () => {
    const { container } = draw()
    expect(statusOf(container, 1)).toHaveTextContent('Not installed')
    expect(statusOf(container, 1)).toHaveAttribute('data-family', 'pending')
    expect(statusOf(container, 100)).toHaveTextContent('Group missing')
    expect(statusOf(container, 100)).toHaveAttribute('data-family', 'review')
    expect(statusOf(container, 34)).toHaveTextContent('Credentials incomplete')
    expect(statusOf(container, 34)).toHaveAttribute('data-family', 'review')
    expect(statusOf(container, 67)).toHaveTextContent('Active')
    expect(statusOf(container, 67)).toHaveAttribute('data-family', 'done')
    expect(statusOf(container, 8)).toHaveTextContent('Paused')
    expect(statusOf(container, 8)).toHaveAttribute('data-family', 'cancel')
  })

  it('with a complete dictionary Uber is active', () => {
    const complete = { ...configs, uber_direct_integration_client_secret: { id: 12, key: 'uber_direct_integration_client_secret', value: 'shh' } }
    const { container } = draw({ configs: complete })
    expect(statusOf(container, 34)).toHaveTextContent('Active')
  })

  it('an empty credential of another plugin does not make this one incomplete', () => {
    const other = { ...configs, shipday_api_key: { id: 31, key: 'shipday_api_key', value: '' } }
    const { container } = draw({ configs: other })
    expect(statusOf(container, 34)).toHaveTextContent('Credentials incomplete') // its own empty one
    expect(statusOf(container, 8)).toHaveTextContent('Paused') // Lalamove: untouched by Shipday
    expect(statusOf(container, 67)).toHaveTextContent('Credentials incomplete')
  })

  // The same rule that hides the sections today: the Settings hub hides a field behind its master. Stand-in plugin: the
  // dependency table knows the facebook pair, none of the delivery plugins.
  it('an empty credential hidden by its master does not hold the provider back; a visible empty one does', () => {
    const fb = { id: 50, name: 'Fb', enabled: true, plugin_id: 5, plugin: { id: 5, key: 'facebook' }, driver_groups: [{ id: 9 }] }
    const off = {
      facebook_login_enabled: { id: 1, key: 'facebook_login_enabled', value: '0' },
      facebook_id: { id: 2, key: 'facebook_id', value: '' },
      facebook_secret: { id: 3, key: 'facebook_secret', value: '' }
    }
    const first = draw({ companies: [fb], configs: off })
    expect(statusOf(first.container, 50)).toHaveTextContent('Active')
    first.unmount()
    const on = { ...off, facebook_login_enabled: { id: 1, key: 'facebook_login_enabled', value: '1' } }
    const second = draw({ companies: [fb], configs: on })
    expect(statusOf(second.container, 50)).toHaveTextContent('Credentials incomplete')
  })

  // follow-up 1: the real status of an installed provider with a group needs the dictionary; the other two do not
  it('while the configs load, an installed provider with a group shows a skeleton, not a word; not installed and group missing keep theirs', () => {
    const { container } = draw({ configsLoading: true })
    ;[34, 67, 8].forEach(id => {
      const cell = cellsOf(rowOf(container, id))[0]
      expect(cell.querySelector('.odc-skeleton')).toBeInTheDocument()
      expect(cell.querySelector('.odc-status')).toBeNull()
      expect(cell.textContent).toBe('')
    })
    expect(statusOf(container, 1)).toHaveTextContent('Not installed')
    expect(cellsOf(rowOf(container, 1))[0].querySelector('.odc-skeleton')).toBeNull()
    expect(statusOf(container, 100)).toHaveTextContent('Group missing')
    expect(cellsOf(rowOf(container, 100))[0].querySelector('.odc-skeleton')).toBeNull()
  })

  it('without configsLoading (or false) the words are there; when it ends the skeleton gives way to the status', () => {
    const view = draw({ configsLoading: true })
    expect(cellsOf(rowOf(view.container, 67))[0].querySelector('.odc-status')).toBeNull()
    view.rerenderWith({ configsLoading: false })
    expect(statusOf(view.container, 67)).toHaveTextContent('Active')
    expect(cellsOf(rowOf(view.container, 67))[0].querySelector('.odc-skeleton')).toBeNull()
    view.unmount()
    const plain = draw()
    expect(statusOf(plain.container, 34)).toHaveTextContent('Credentials incomplete')
  })

  it('recalculates when the dictionary changes (the page refreshes it after the credentials are saved)', () => {
    const view = draw()
    expect(cellsOf(rowOf(view.container, 34))[0]).toHaveTextContent('Credentials incomplete')
    view.rerenderWith({ configs: { ...configs, uber_direct_integration_client_secret: { id: 12, key: 'uber_direct_integration_client_secret', value: 'now' } } })
    expect(cellsOf(rowOf(view.container, 34))[0]).toHaveTextContent('Active')
  })
})

describe('ProvidersTable Stores', () => {
  const storesCell = (container, id) => cellsOf(rowOf(container, id))[1]

  it('is a figure: the count of the group, 0 included', () => {
    const { container } = draw()
    expect(storesCell(container, 34).querySelector('.odc-figure')).toHaveTextContent(/^10$/)
    expect(storesCell(container, 67).querySelector('.odc-figure')).toHaveTextContent(/^1$/)
    expect(storesCell(container, 8).querySelector('.odc-figure')).toHaveTextContent(/^0$/)
  })

  it('is a «—» without a group (not installed, group missing)', () => {
    const { container } = draw()
    expect(storesCell(container, 1)).toHaveTextContent(/^—$/)
    expect(storesCell(container, 100)).toHaveTextContent(/^—$/)
    expect(storesCell(container, 1).querySelector('.odc-figure')).toBeNull()
  })

  it('while the stores load, a skeleton where there is a group (and no number); the «—» stays for the ones with none', () => {
    const { container } = draw({ groupsInfo: { loading: true, error: null, groups: {} } })
    expect(storesCell(container, 34).querySelector('.odc-skeleton')).toBeInTheDocument()
    expect(storesCell(container, 34).querySelector('.odc-figure')).toBeNull()
    expect(storesCell(container, 1).querySelector('.odc-skeleton')).toBeNull()
    expect(storesCell(container, 1)).toHaveTextContent(/^—$/)
  })

  it('with an error loading them: «—» with the reason in its title and for screen readers, no number', () => {
    const { container } = draw({ groupsInfo: { loading: false, error: ['Server down'], groups: {} } })
    const cell = storesCell(container, 34)
    expect(cell.querySelector('.odc-figure')).toBeNull()
    expect(cell.querySelector('[title="We couldn\'t load the stores."]')).toBeInTheDocument()
    expect(cell).toHaveTextContent('—')
    expect(within(cell).getByText("We couldn't load the stores.")).toHaveClass('odc-sr-only')
    expect(storesCell(container, 1)).toHaveTextContent(/^—$/)
    expect(screen.queryByRole('alert')).toBeNull() // one cell's trouble does not shout over the list
  })

  it('a group the answer does not carry is a «—», not a 0', () => {
    const { container } = draw({ groupsInfo: { loading: false, error: null, groups: {} } })
    expect(storesCell(container, 34)).toHaveTextContent(/^—$/)
  })

  it('without groupsInfo at all it does not throw', () => {
    const { container } = draw({ groupsInfo: undefined })
    expect(storesCell(container, 34)).toHaveTextContent(/^—$/)
  })
})

describe('ProvidersTable width priorities (the panel open)', () => {
  it('all five columns fit a 1024 window with no panel', () => {
    draw()
    resizeTo(728)
    expect(headers()).toEqual(['Provider', 'Status', 'Stores', 'Enabled', 'Actions'])
  })

  it('when the list narrows Stores steps aside; Provider carries it as «N stores»; Status, Enabled and Install stay', () => {
    const { container } = draw()
    resizeTo(2000)
    expect(within(rowOf(container, 34)).getByRole('rowheader')).not.toHaveTextContent('stores')
    resizeTo(400)
    expect(headers()).toEqual(['Provider', 'Status', 'Enabled', 'Actions'])
    expect(within(rowOf(container, 34)).getByRole('rowheader')).toHaveTextContent('10 stores')
    expect(within(rowOf(container, 67)).getByRole('rowheader')).toHaveTextContent('1 store')
    expect(within(rowOf(container, 67)).getByRole('rowheader')).not.toHaveTextContent('1 stores')
    expect(within(rowOf(container, 1)).getByRole('rowheader')).not.toHaveTextContent('store') // none to carry
    expect(within(rowOf(container, 34)).getByRole('switch', { name: 'Enable Uber Direct' })).toBeInTheDocument()
    expect(within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' })).toBeInTheDocument()
    resizeTo(2000)
    expect(headers()).toEqual(['Provider', 'Status', 'Stores', 'Enabled', 'Actions'])
    expect(within(rowOf(container, 34)).getByRole('rowheader')).not.toHaveTextContent('10 stores')
  })
})

// A host that keeps the stored value, as the controller's state does: it changes only when the save went through.
const Host = ({ outcome = { ok: true }, gate, saves = [], ...props }) => {
  const [companies, setCompanies] = useState([doordash, uber, shipday, yango, lala])
  const onToggle = async (company, next) => {
    saves.push([company.id, next])
    if (gate) await gate
    if (outcome.ok) setCompanies(list => list.map(item => item.id === company.id ? { ...item, enabled: next } : item))
    return outcome
  }
  return <ProvidersTable groupsInfo={groupsInfo} configs={configs} {...props} companies={companies} onToggle={onToggle} onOpen={props.onOpen ?? vi.fn()} />
}

describe('ProvidersTable enabled switch (M-DS1, M-DS5)', () => {
  const switchOf = (container, id, name) => within(rowOf(container, id)).getByRole('switch', { name })

  it('is named «Enable _name_» and checked by the company', () => {
    const { container } = draw()
    expect(switchOf(container, 34, 'Enable Uber Direct')).toHaveAttribute('aria-checked', 'true')
    expect(switchOf(container, 8, 'Enable Lalamove')).toHaveAttribute('aria-checked', 'false')
  })

  // M-DS1, measured broken in main: the row's switch wrote the id of the OPEN panel. Here the host is handed the row's company.
  it('pressing one asks the host with THE ROW\'S company and the next value, never the open one, and never opens the row', async () => {
    const { container } = draw({ activeId: 34 })
    await userEvent.click(switchOf(container, 67, 'Enable Shipday Delivery Integration'))
    expect(current.onToggle).toHaveBeenLastCalledWith(shipday, false)
    await userEvent.click(switchOf(container, 8, 'Enable Lalamove'))
    expect(current.onToggle).toHaveBeenLastCalledWith(lala, true)
    expect(current.onToggle).toHaveBeenCalledTimes(2)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('is controlled and busy while it saves; the stored value arrives with ok', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const saves = []
    const { container } = render(<Host gate={gate} saves={saves} />)
    const toggle = () => switchOf(container, 34, 'Enable Uber Direct')
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle())
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-busy', 'true'))
    expect(saves).toEqual([[34, false]])
    await userEvent.click(toggle()) // ignored while it lasts
    expect(saves).toHaveLength(1)
    await act(async () => { release() })
    await waitFor(() => expect(toggle()).not.toHaveAttribute('aria-busy'))
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure does not move it, and says so below it (not optimistic)', async () => {
    const { container } = render(<Host outcome={{ ok: false, error: [] }} />)
    const toggle = () => switchOf(container, 34, 'Enable Uber Direct')
    await userEvent.click(toggle())
    expect(await screen.findByRole('alert')).toHaveTextContent("The provider didn't change. Try again.")
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(within(cellsOf(rowOf(container, 34))[2]).getByRole('alert')).toBeInTheDocument()
  })

  it('a rejected promise is a failure too', async () => {
    const { container } = draw({ onToggle: vi.fn(async () => { throw new Error('boom') }) })
    await userEvent.click(switchOf(container, 8, 'Enable Lalamove'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(switchOf(container, 8, 'Enable Lalamove')).toHaveAttribute('aria-checked', 'false')
  })

  // (T10): a provider that is not installed has nothing to enable; the table draws no switch (no `checked disabled` one),
  // a «—» with its text for screen readers, and «Install» stays in the Actions column (the phone card already does this)
  it('without a plugin there is no switch in the table: the Enabled cell is «—» with its text, and Install stays; the installed ones keep theirs', () => {
    const { container } = draw()
    const row = rowOf(container, 1)
    expect(within(row).queryByRole('switch')).toBeNull()
    expect(within(row).queryByRole('switch', { name: 'Enable Doordash Drive' })).toBeNull()
    const enabledCell = cellsOf(row)[2]
    expect(enabledCell).toHaveTextContent('—')
    expect(within(enabledCell).getByText('No data')).toHaveClass('odc-sr-only')
    expect(within(row).getByRole('button', { name: 'Install Doordash Drive' })).toBeInTheDocument()
    // the ones with a plugin are not
    expect(switchOf(container, 34, 'Enable Uber Direct')).not.toBeDisabled()
    expect(switchOf(container, 100, 'Enable Yango Delivery')).not.toBeDisabled()
    expect(within(container).getAllByRole('switch')).toHaveLength(4)
  })

  it('actionDisabled makes every switch really disabled', async () => {
    const { container } = draw({ actionDisabled: true })
    const all = within(container).getAllByRole('switch')
    expect(all).toHaveLength(4) // (T10): the not-installed provider has no switch in the table
    all.forEach(item => expect(item).toBeDisabled())
    await userEvent.click(all[1])
    expect(current.onToggle).not.toHaveBeenCalled()
  })

  // redesign D-5 (owner, 2026-10-19): pausing asks first (the host's question); resuming stays one click
  it('pausing asks the host first: nothing is saved, and the switch does not look flipped, while the question is open', async () => {
    let answer
    const confirmPause = vi.fn(() => new Promise(resolve => { answer = resolve }))
    const saves = []
    const { container } = render(<Host confirmPause={confirmPause} saves={saves} />)
    const toggle = () => switchOf(container, 34, 'Enable Uber Direct')
    await userEvent.click(toggle())
    expect(confirmPause).toHaveBeenCalledTimes(1)
    expect(confirmPause).toHaveBeenCalledWith(expect.objectContaining({ id: 34 }))
    expect(saves).toEqual([])
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(toggle()).not.toHaveAttribute('aria-busy')
    await act(async () => { answer(true) })
    await waitFor(() => expect(saves).toEqual([[34, false]]))
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'false'))
  })

  it('a «no» to the question writes nothing and leaves the switch where it was', async () => {
    const confirmPause = vi.fn(() => Promise.resolve(false))
    const saves = []
    const { container } = render(<Host confirmPause={confirmPause} saves={saves} />)
    await userEvent.click(switchOf(container, 34, 'Enable Uber Direct'))
    await waitFor(() => expect(confirmPause).toHaveBeenCalledTimes(1))
    expect(saves).toEqual([])
    expect(switchOf(container, 34, 'Enable Uber Direct')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('resuming never asks: it is saved at once', async () => {
    const confirmPause = vi.fn(() => Promise.resolve(false))
    const saves = []
    const { container } = render(<Host confirmPause={confirmPause} saves={saves} />)
    await userEvent.click(switchOf(container, 8, 'Enable Lalamove'))
    await waitFor(() => expect(saves).toEqual([[8, true]]))
    expect(confirmPause).not.toHaveBeenCalled()
  })

  it('draws no dialog of its own: the question is the host\'s', async () => {
    const { container } = draw()
    await userEvent.click(switchOf(container, 34, 'Enable Uber Direct'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('ProvidersTable Install (decision 4)', () => {
  it('is drawn only for a provider with no plugin; the installed ones have none', () => {
    const { container } = draw()
    expect(screen.getAllByRole('button', { name: /^Install / })).toHaveLength(1)
    expect(within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' })).toBeInTheDocument()
    expect(within(rowOf(container, 34)).queryByRole('button', { name: /^Install / })).toBeNull()
  })

  it('a click asks the host with the company and does not open the row', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' }))
    expect(current.onInstall).toHaveBeenCalledWith(doordash)
    expect(current.onInstall).toHaveBeenCalledTimes(1)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  // the row already ignores a click that starts on a button; the button also keeps the click to itself (stopPropagation)
  it('the click does not bubble out of the button', async () => {
    const outside = vi.fn()
    const { container } = render(
      <div onClick={outside}>
        <ProvidersTable companies={[doordash]} configs={configs} groupsInfo={groupsInfo} onOpen={vi.fn()} onInstall={vi.fn()} />
      </div>
    )
    await userEvent.click(within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' }))
    expect(outside).not.toHaveBeenCalled()
  })

  it('Enter on the button installs once and does not open the row either', async () => {
    const { container } = draw()
    const install = within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' })
    act(() => install.focus())
    await userEvent.keyboard('{Enter}')
    expect(current.onInstall).toHaveBeenCalledTimes(1)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('is busy while this company installs (the others are not) and a press does nothing while it lasts', async () => {
    const { container } = draw({ companies: [doordash, { ...doordash, id: 2, name: 'Other' }], installingId: 1 })
    const busy = within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    const idle = within(rowOf(container, 2)).getByRole('button', { name: 'Install Other' })
    expect(idle).not.toHaveAttribute('aria-busy')
    await userEvent.click(busy)
    expect(current.onInstall).not.toHaveBeenCalled()
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  // main: one install at a time, the other Install buttons are disabled meanwhile
  it('disables the other Install buttons while one company installs', async () => {
    const { container } = draw({ companies: [doordash, { ...doordash, id: 2, name: 'Other' }], installingId: 1 })
    const idle = within(rowOf(container, 2)).getByRole('button', { name: 'Install Other' })
    expect(idle).toBeDisabled()
    await userEvent.click(idle)
    expect(current.onInstall).not.toHaveBeenCalled()
  })

  it('is really disabled with actionDisabled', async () => {
    const { container } = draw({ actionDisabled: true })
    const install = within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' })
    expect(install).toBeDisabled()
    await userEvent.click(install)
    expect(current.onInstall).not.toHaveBeenCalled()
  })

  // follow-up 2: many rows, one word: the name carries the provider; the visible text stays «Install»
  it('is named «Install _name_» (DELIVERY_SERVICES_INSTALL_NAME) and still reads «Install»', () => {
    const second = { ...doordash, id: 2, name: 'Other' }
    const { container } = draw({ companies: [doordash, second] })
    const install = within(rowOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' })
    expect(install).toHaveAttribute('aria-label', 'Install Doordash Drive')
    expect(install.textContent).toBe('Install')
    expect(within(rowOf(container, 2)).getByRole('button', { name: 'Install Other' })).toBeInTheDocument()
    expect(mocks.asked.DELIVERY_SERVICES_INSTALL_NAME).toBe('Install _name_')
  })

  it('the column has no visible header: it is named «Actions» for screen readers only', () => {
    draw()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
  })
})

describe('ProvidersTable rows (keyboard and the open one)', () => {
  it('a click and Enter open the provider, whatever its state (the page decides); the open one is aria-current', async () => {
    const { container } = draw({ activeId: 34 })
    expect(rowOf(container, 34)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 67)).not.toHaveAttribute('aria-current')
    await userEvent.click(within(rowOf(container, 67)).getByText('Shipday Delivery Integration'))
    expect(current.onOpen).toHaveBeenLastCalledWith(shipday)
    await userEvent.click(within(rowOf(container, 1)).getByText('Doordash Drive')) // not installed: it still goes up
    expect(current.onOpen).toHaveBeenLastCalledWith(doordash)
    await userEvent.click(within(rowOf(container, 100)).getByText('Yango Delivery')) // no group: the same
    expect(current.onOpen).toHaveBeenLastCalledWith(yango)
    act(() => rowOf(container, 8).focus())
    await userEvent.keyboard('{Enter}')
    expect(current.onOpen).toHaveBeenLastCalledWith(lala)
    expect(current.onOpen).toHaveBeenCalledTimes(4)
  })

  it('the open id may come from the URL as a string', () => {
    const { container } = draw({ activeId: '67' })
    expect(rowOf(container, 67)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 34)).not.toHaveAttribute('aria-current')
  })

  it('one tab stop for the table, and arrows move between rows', async () => {
    const { container } = draw()
    expect(container.querySelectorAll('tr[tabindex="0"]')).toHaveLength(1)
    act(() => rowOf(container, 1).focus())
    await userEvent.keyboard('{ArrowDown}')
    expect(rowOf(container, 34)).toHaveFocus()
  })
})

describe('ProvidersTable states', () => {
  it('loading: skeleton rows, announced once, and neither the empty state nor the error', () => {
    const { container } = draw({ loading: true, companies: [] })
    expect(container.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0)
    expect(screen.getByText('Loading delivery services')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No delivery services yet')).toBeNull()
    expect(container.querySelector('[data-tour="tour_delivery_completed"]')).toBeInTheDocument()
  })

  it('error: «We couldn\'t load the delivery services.» with Retry in place of the table; loading shows no error', async () => {
    const failed = draw({ error: ['Server down'], companies: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the delivery services.")
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    expect(failed.container.querySelector('[data-tour="tour_delivery_completed"]')).toBeInTheDocument()
    failed.unmount()
    draw({ error: ['x'], loading: true, companies: [] })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an empty error list is no error', () => {
    draw({ error: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('empty without a search: «No delivery services yet», with no action to take', () => {
    draw({ companies: [] })
    expect(screen.getByText('No delivery services yet')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('a blank search counts as no search', () => {
    draw({ companies: [], searchValue: '   ' })
    expect(screen.getByText('No delivery services yet')).toBeInTheDocument()
  })

  it('empty with a search: «No providers match» and «Clear search»', async () => {
    draw({ companies: [], searchValue: 'zzz' })
    expect(screen.getByText('No providers match')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(current.onClearSearch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('No delivery services yet')).toBeNull()
  })

  it('the empty state keeps the tour anchor too', () => {
    const { container } = draw({ companies: [] })
    expect(container.querySelector('[data-tour="tour_delivery_completed"]')).toBeInTheDocument()
  })
})

describe('ProvidersTable on a phone (cards, under 768px)', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, no table: the name, «#id · status · N stores», and the switch or Install', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    const card = cardOf(container, 34)
    expect(within(card).getByRole('link', { name: 'Uber Direct' })).toBeInTheDocument()
    expect(card.textContent).toMatch(/#34\s*·\s*Credentials incomplete\s*·\s*10 stores/)
    expect(within(card).getByText('#34')).toHaveClass('odc-figure')
    expect(within(card).getByRole('switch', { name: 'Enable Uber Direct' })).toHaveAttribute('aria-checked', 'true')
    expect(within(card).queryByRole('button', { name: /^Install / })).toBeNull()
    expect(cardOf(container, 67).textContent).toMatch(/#67\s*·\s*Active\s*·\s*1 store(?!s)/)
    expect(cardOf(container, 8).textContent).toMatch(/#8\s*·\s*Paused\s*·\s*0 stores/)
  })

  it('a provider that is not installed has Install and no switch; without a count the line has no «stores»', () => {
    const { container } = draw()
    const card = cardOf(container, 1)
    expect(within(card).getByRole('button', { name: 'Install Doordash Drive' })).toBeInTheDocument()
    expect(within(card).queryByRole('switch')).toBeNull()
    expect(card.textContent).toMatch(/#1\s*·\s*Not installed/)
    expect(card.textContent).not.toContain('store')
    expect(cardOf(container, 100).textContent).toMatch(/#100\s*·\s*Group missing/)
  })

  it('never shows a datum twice', () => {
    const { container } = draw()
    const card = cardOf(container, 34)
    expect(card.textContent.match(/Uber Direct/g)).toHaveLength(1) // the switch's name is an aria-label, not text
    expect(card.textContent.match(/#34/g)).toHaveLength(1)
    expect(card.textContent.match(/Credentials incomplete/g)).toHaveLength(1)
    expect(card.textContent.match(/10 stores/g)).toHaveLength(1)
  })

  it('the actions sit in a [data-card-actions] wrapper: the switch and Install do not open the card', async () => {
    const { container } = draw()
    const card = cardOf(container, 67)
    expect(card.querySelector('[data-card-actions]')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('switch', { name: 'Enable Shipday Delivery Integration' }))
    expect(current.onToggle).toHaveBeenLastCalledWith(shipday, false)
    await userEvent.click(within(cardOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' }))
    expect(current.onInstall).toHaveBeenCalledWith(doordash)
    expect(current.onOpen).not.toHaveBeenCalled()
    const link = within(card).getByRole('link', { name: 'Shipday Delivery Integration' })
    expect(link.getAttribute('href')).toMatch(/\?.*id=67/)
    await userEvent.click(link)
    expect(current.onOpen).toHaveBeenCalledWith(shipday)
  })

  it('tapping the card opens it, installed or not', async () => {
    const { container } = draw()
    await userEvent.click(within(cardOf(container, 1)).getByRole('link', { name: 'Doordash Drive' }))
    expect(current.onOpen).toHaveBeenLastCalledWith(doordash)
  })

  it('the card switch fails like the row one: it does not move and says why', async () => {
    const { container } = draw({ onToggle: vi.fn(async () => ({ ok: false, error: [] })) })
    const card = cardOf(container, 34)
    await userEvent.click(within(card).getByRole('switch', { name: 'Enable Uber Direct' }))
    expect(await within(card).findByRole('alert')).toHaveTextContent("The provider didn't change. Try again.")
    expect(within(card).getByRole('switch', { name: 'Enable Uber Direct' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Install on a card is busy for its company; the open one is current; actionDisabled disables switch and Install', () => {
    const busy = draw({ installingId: 1, activeId: 34 })
    expect(within(cardOf(busy.container, 1)).getByRole('button', { name: 'Install Doordash Drive' })).toHaveAttribute('aria-busy', 'true')
    expect(cardOf(busy.container, 34)).toHaveAttribute('aria-current', 'true')
    busy.unmount()
    const locked = draw({ actionDisabled: true })
    within(locked.container).getAllByRole('switch').forEach(item => expect(item).toBeDisabled())
    expect(within(cardOf(locked.container, 1)).getByRole('button', { name: 'Install Doordash Drive' })).toBeDisabled()
  })

  // follow-up 2: the name says which provider; the text on the button stays «Install»
  it('Install on a card is named «Install _name_» and still reads «Install»', () => {
    const { container } = draw()
    const install = within(cardOf(container, 1)).getByRole('button', { name: 'Install Doordash Drive' })
    expect(install).toHaveAttribute('aria-label', 'Install Doordash Drive')
    expect(install.textContent).toBe('Install')
  })

  // follow-up 1: the card's status part waits for the dictionary only where it needs it
  it('while the configs load, the card of an installed provider with a group has a skeleton in place of the status word; the others keep theirs', () => {
    const { container } = draw({ configsLoading: true })
    ;[34, 67, 8].forEach(id => {
      const card = cardOf(container, id)
      expect(card.querySelector('.odc-ds-card-meta .odc-skeleton')).toBeInTheDocument()
      expect(card.querySelector('.odc-status')).toBeNull()
    })
    expect(cardOf(container, 34).textContent).not.toMatch(/Credentials incomplete|Active|Paused/)
    // the skeleton holds the status's place between the two separators
    expect(cardOf(container, 34).textContent).toMatch(/#34\s*·\s*·\s*10 stores/)
    expect(cardOf(container, 1).querySelector('.odc-skeleton')).toBeNull()
    expect(cardOf(container, 1).textContent).toMatch(/#1\s*·\s*Not installed/)
    expect(cardOf(container, 100).querySelector('.odc-skeleton')).toBeNull()
    expect(cardOf(container, 100).textContent).toMatch(/#100\s*·\s*Group missing/)
  })

  it('keeps the states: skeleton cards, error with Retry, no match, empty, and the tour anchor', async () => {
    const loading = draw({ loading: true, companies: [] })
    expect(loading.container.querySelectorAll('li[data-skeleton]').length).toBeGreaterThan(0)
    expect(loading.container.querySelector('[data-tour="tour_delivery_completed"]')).toBeInTheDocument()
    loading.unmount()
    const failed = draw({ error: ['x'], companies: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    failed.unmount()
    const noMatch = draw({ companies: [], searchValue: 'q' })
    expect(screen.getByText('No providers match')).toBeInTheDocument()
    noMatch.unmount()
    draw({ companies: [] })
    expect(screen.getByText('No delivery services yet')).toBeInTheDocument()
  })
})

describe('providers-table.css', () => {
  const css = readFileSync(resolve(__dirname, '../providers-table.css'), 'utf8')

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
