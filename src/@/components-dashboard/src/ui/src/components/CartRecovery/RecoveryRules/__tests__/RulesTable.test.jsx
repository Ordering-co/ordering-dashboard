/* eslint-disable import/first */
// redesign RA-B2 (decision 2; M-RA1, M-RA2, M-RA3, M-RA4, M-RA5): the cart recovery rules list as a Product DataTable (and RecordCards under
// 768px). The Product wrappers and `utils/recoveryRules.js` (pure) are real; the environment (language, the phone flag, the width of the
// table) is simulated. The table fetches nothing: it draws what the controller gives (`rules`, `channelsByRule`, `pagination`) and reports
// what the person does.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  phone: false,
  locale: 'en',
  catalog: {},
  parsePrice: (value) => '$' + Number(value).toFixed(2),
  width: null // the width the table's scroller reports (ResizeObserver); null = the observer never answers
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (key, fallback) => mocks.catalog[key] ?? fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: mocks.locale } }, (key, text) => mocks.catalog[key] ?? text],
  useUtils: () => [{ parsePrice: (value) => mocks.parsePrice(value) }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { formatWait, PAGE_SIZES } from '../../../../../../utils/recoveryRules'
import { channelLabel } from '../channelLabel'
import { RulesColumnManager, RulesTable, useRulesColumns } from '../RulesTable'

const abandoned = { id: 1, name: 'Did something interrupt your order?', description: 'Hey! Looks like you left something in your cart. No worries — it is still waiting for you.', enabled: false, times: [260] }
const tenOff = { id: 2, name: '10% Off · Just finish your order :)', description: 'We noticed you left your order behind', enabled: true, times: [430] }
const bare = { id: 3, name: '--', description: '', enabled: false, times: [5] }
const days = { id: 4, name: 'BENTORNATO10', description: 'ECCO A TE UN COUPON DEL 10%', enabled: true, times: [172800] }
const noWait = { id: 5, name: 'No wait', description: 'x', enabled: false, times: [] }
const RULES = [abandoned, tenOff, bare, days]

const channel = (id, kind, enabled = true) => ({ id, channel: kind, enabled, title: 't', body: 'b' })
const READY = (channels) => ({ loading: false, channels, error: null })
const CHANNELS = {
  1: READY([channel(11, 'email'), channel(12, 'sms'), channel(13, 'notification')]),
  2: READY([channel(21, 'sms', false), channel(22, 'email'), channel(23, 'notification')]),
  3: READY([]),
  4: READY([channel(41, 'notification'), channel(42, 'notification')])
}

let current
const draw = (props = {}) => {
  current = {
    rules: RULES,
    loading: false,
    error: null,
    onRetry: vi.fn(),
    channelsByRule: CHANNELS,
    onRetryChannels: vi.fn(),
    activeId: undefined,
    onOpen: vi.fn(),
    onToggle: vi.fn(() => Promise.resolve({ ok: true })),
    // redesign D-76 (owner, 2026-10-19): the host asks before a rule is turned on; here it says yes
    confirmTurnOn: vi.fn(() => Promise.resolve(true)),
    pagination: { currentPage: 1, totalPages: 1, totalItems: 4, pageSize: 10 },
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onNew: vi.fn(),
    searching: '',
    ...props
  }
  const ui = (next) => <RulesTable {...next} />
  const view = render(ui(current))
  return { ...view, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(ui(current)) } }
}

// CM-1: the column manager is not in the table: the host (the page) holds the choice and draws the manager in the header's filter
// bar. This host does the same: the manager and the table share one state.
const Host = (props) => {
  const state = useRulesColumns()
  return (
    <>
      <RulesColumnManager state={state} />
      <RulesTable {...props} columnsState={state} />
    </>
  )
}
const drawHosted = (props = {}) => {
  draw(props)
  cleanup()
  return render(<Host {...current} />)
}

const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
// the data cells after the Rule row header: [description, sends after, channels, sent, recovered, revenue, status]
const cellsOf = (row) => Array.from(row.querySelectorAll('td:not([data-selection])'))
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean)

class FakeResizeObserver {
  constructor (callback) { this.callback = callback }
  observe () { if (mocks.width != null) this.callback([{ contentRect: { width: mocks.width } }]) }
  unobserve () {}
  disconnect () {}
}

beforeEach(() => {
  mocks.phone = false
  mocks.locale = 'en'
  mocks.catalog = {}
  mocks.width = null
  mocks.parsePrice = (value) => '$' + Number(value).toFixed(2)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('channelLabel (the names of the channels, M-RA8)', () => {
  const t = (key, text) => mocks.catalog[key] ?? text

  it('names email, sms and notification; any other value goes as it came', () => {
    expect(channelLabel(t, 'email')).toBe('Email')
    expect(channelLabel(t, 'sms')).toBe('SMS')
    expect(channelLabel(t, 'notification')).toBe('Push notification')
    expect(channelLabel(t, 'whatsapp')).toBe('whatsapp')
    expect(channelLabel(t, 'constructor')).toBe('constructor')
  })

  it('the short form only changes the push notification: «Push»', () => {
    expect(channelLabel(t, 'notification', { short: true })).toBe('Push')
    expect(channelLabel(t, 'email', { short: true })).toBe('Email')
    expect(channelLabel(t, 'sms', { short: true })).toBe('SMS')
  })

  it('reads every name through t() so the catalog can translate it', () => {
    mocks.catalog = { EMAIL: 'Correo', RECOVERY_RULES_CHANNEL_PUSH_SHORT: 'Aviso' }
    expect(channelLabel(t, 'email')).toBe('Correo')
    expect(channelLabel(t, 'notification', { short: true })).toBe('Aviso')
  })
})

describe('RulesTable columns', () => {
  it('has Rule, Description, Sends after, Channels, the three results and Status, in a table named «Cart recovery rules»', () => {
    draw()
    expect(headers()).toEqual(['Rule', 'Description', 'Sends after', 'Channels', 'Sent', 'Recovered', 'Revenue recovered', 'Status'])
    expect(screen.getByRole('table', { name: 'Cart recovery rules' })).toBeInTheDocument()
  })

  it('has no drag handle and no «Add new recovery action» at the foot (M-RA1)', () => {
    const { container } = draw()
    expect(container.querySelector('[draggable], [data-drag-handle]')).toBeNull()
    expect(screen.queryByText(/Add new recovery action/i)).toBeNull()
    expect(screen.queryByText(/drag/i)).toBeNull()
  })

  it('the Rule cell is the row header with the name, in bold', () => {
    const { container } = draw()
    const header = within(rowOf(container, 1)).getByRole('rowheader')
    expect(header).toHaveTextContent('Did something interrupt your order?')
    expect(header.querySelector('.odc-ra-name')).not.toBeNull()
  })

  it('the description clamps to two lines and carries the whole text as title', () => {
    const { container } = draw()
    const description = cellsOf(rowOf(container, 1))[0].querySelector('.odc-ra-description')
    expect(description).toHaveTextContent(abandoned.description)
    expect(description).toHaveAttribute('title', abandoned.description)
  })

  it('Sends after is the wait in words, in the language of the panel, as a figure (M-RA11)', () => {
    const { container } = draw()
    const wait = id => cellsOf(rowOf(container, id))[1]
    expect(within(wait(1)).getByText(formatWait(260, 'en'))).toHaveClass('odc-figure')
    expect(within(wait(3)).getByText(formatWait(5, 'en'))).toHaveClass('odc-figure')
    expect(within(wait(4)).getByText(formatWait(172800, 'en'))).toHaveClass('odc-figure')
    expect(wait(1).textContent).not.toMatch(/260/)
  })

  it('writes the wait with the locale of the panel', () => {
    mocks.locale = 'es'
    const { container } = draw()
    expect(cellsOf(rowOf(container, 1))[1]).toHaveTextContent(formatWait(260, 'es'))
  })

  it('a rule with no wait draws «—», not «0» or an empty cell', () => {
    const { container } = draw({ rules: [noWait], channelsByRule: { 5: READY([]) } })
    expect(cellsOf(rowOf(container, 5))[1]).toHaveTextContent('—')
  })

  it('every rule gets its row marked for listFocus: data-row-id', () => {
    const { container } = draw()
    expect(Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map(row => row.getAttribute('data-row-id'))).toEqual(['1', '2', '3', '4'])
  })
})

describe('RulesTable channels column (decision 2)', () => {
  const chips = (container, id) => Array.from(cellsOf(rowOf(container, id))[2].querySelectorAll('li'))

  it('one chip per channel in the order of the API, repeats included, with the short name of Push', () => {
    const { container } = draw()
    expect(chips(container, 1).map(chip => chip.textContent)).toEqual(['Email', 'SMS', 'Push'])
    expect(chips(container, 2).map(chip => chip.textContent)).toEqual(['SMS', 'Email', 'Push'])
    expect(chips(container, 4).map(chip => chip.textContent)).toEqual(['Push', 'Push'])
  })

  it('a channel that is off is struck out, dimmed and named «SMS, off»; the ones that are on keep their own text', () => {
    const { container } = draw()
    const [sms, email, push] = chips(container, 2)
    expect(sms).toHaveAttribute('data-off', '')
    expect(sms).toHaveAttribute('aria-label', 'SMS, off')
    expect(screen.getByLabelText('SMS, off')).toBe(sms)
    expect(email).not.toHaveAttribute('data-off')
    expect(email).not.toHaveAttribute('aria-label')
    expect(push).not.toHaveAttribute('data-off')
  })

  it('takes the «off» wording from the catalog', () => {
    mocks.catalog = { RECOVERY_RULES_CHANNEL_OFF: '_channel_: apagado' }
    const { container } = draw()
    expect(chips(container, 2)[0]).toHaveAttribute('aria-label', 'SMS: apagado')
  })

  it('a rule with no channels says «No messages»', () => {
    const { container } = draw()
    expect(cellsOf(rowOf(container, 3))[2]).toHaveTextContent('No messages')
    expect(chips(container, 3)).toHaveLength(0)
  })

  it('while the channels load (or are not asked yet) the cell is a skeleton, not «No messages»', () => {
    const { container } = draw({ channelsByRule: { 1: { loading: true, channels: [], error: null } } })
    for (const id of [1, 2]) {
      const cell = cellsOf(rowOf(container, id))[2]
      expect(cell.querySelector('.odc-skeleton')).not.toBeNull()
      expect(cell).not.toHaveTextContent('No messages')
      expect(cell.querySelectorAll('li')).toHaveLength(0)
    }
    expect(cellsOf(rowOf(container, 1))[2].querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(within(cellsOf(rowOf(container, 1))[2]).getByText('Loading channels')).toBeInTheDocument()
  })

  it('a failed request is its own «Retry» in that row, named for the rule; it asks again for that rule only and does not open the row', async () => {
    const user = userEvent.setup()
    const { container } = draw({ channelsByRule: { ...CHANNELS, 2: { loading: false, channels: [], error: ['boom'] } } })
    const retry = within(cellsOf(rowOf(container, 2))[2]).getByRole('button', { name: /Retry/ })
    expect(retry).toHaveTextContent('Retry')
    expect(retry.getAttribute('aria-label')).toContain(tenOff.name)
    await user.click(retry)
    expect(current.onRetryChannels).toHaveBeenCalledTimes(1)
    expect(current.onRetryChannels).toHaveBeenCalledWith(2)
    expect(current.onOpen).not.toHaveBeenCalled()
    // the other rows keep their chips
    expect(cellsOf(rowOf(container, 1))[2].querySelectorAll('li')).toHaveLength(3)
  })
})

describe('RulesTable status column: the switch of the rule (M-RA3, M-RA17)', () => {
  const switchOf = (container, id) => within(rowOf(container, id)).getByRole('switch')

  it('is a switch named for the rule, with the stored state, and «On» / «Off» beside it', () => {
    const { container } = draw()
    expect(within(rowOf(container, 1)).getByRole('switch', { name: abandoned.name })).toHaveAttribute('aria-checked', 'false')
    expect(within(rowOf(container, 2)).getByRole('switch', { name: tenOff.name })).toHaveAttribute('aria-checked', 'true')
    expect(cellsOf(rowOf(container, 1))[6]).toHaveTextContent('Off')
    expect(cellsOf(rowOf(container, 2))[6]).toHaveTextContent('On')
  })

  it('pressing it calls onToggle(rule, next) once and never opens the row', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    await user.click(switchOf(container, 1))
    expect(current.onToggle).toHaveBeenCalledTimes(1)
    expect(current.onToggle).toHaveBeenCalledWith(abandoned, true)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  // redesign D-76 (owner, 2026-10-19): turning a rule ON asks the host first (confirmTurnOn); turning it OFF stays immediate
  it('turning a rule on asks the host first with that rule, and saves only after a yes', async () => {
    const user = userEvent.setup()
    let answer
    const confirmTurnOn = vi.fn(() => new Promise(resolve => { answer = resolve }))
    const { container } = draw({ confirmTurnOn })
    await user.click(switchOf(container, 1))
    expect(confirmTurnOn).toHaveBeenCalledTimes(1)
    expect(confirmTurnOn).toHaveBeenCalledWith(abandoned)
    // while the question is open the switch is not shown flipped, not busy, and nothing is saved
    expect(current.onToggle).not.toHaveBeenCalled()
    expect(switchOf(container, 1)).toHaveAttribute('aria-checked', 'false')
    expect(switchOf(container, 1)).not.toHaveAttribute('aria-busy')
    expect(cellsOf(rowOf(container, 1))[6]).toHaveTextContent('Off')
    await act(async () => { answer(true) })
    expect(current.onToggle).toHaveBeenCalledTimes(1)
    expect(current.onToggle).toHaveBeenCalledWith(abandoned, true)
  })

  it('a no leaves the rule off: nothing is saved, the switch is where it was and shows no failure', async () => {
    const user = userEvent.setup()
    const confirmTurnOn = vi.fn(() => Promise.resolve(false))
    const { container } = draw({ confirmTurnOn })
    await user.click(switchOf(container, 1))
    expect(confirmTurnOn).toHaveBeenCalledTimes(1)
    expect(current.onToggle).not.toHaveBeenCalled()
    expect(switchOf(container, 1)).toHaveAttribute('aria-checked', 'false')
    expect(switchOf(container, 1)).not.toHaveAttribute('aria-busy')
    expect(cellsOf(rowOf(container, 1))[6]).toHaveTextContent('Off')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('turning a rule off never asks', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    await user.click(switchOf(container, 2))
    expect(current.confirmTurnOn).not.toHaveBeenCalled()
    expect(current.onToggle).toHaveBeenCalledWith(tenOff, false)
  })

  it('without a host that asks, the switch saves at once (the table itself decides nothing)', async () => {
    const user = userEvent.setup()
    const { container } = draw({ confirmTurnOn: undefined })
    await user.click(switchOf(container, 1))
    expect(current.onToggle).toHaveBeenCalledWith(abandoned, true)
  })

  it('while it saves it shows the new state and ignores a second press; the word follows the switch', async () => {
    const user = userEvent.setup()
    let finish
    const onToggle = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const { container } = draw({ onToggle })
    await user.click(switchOf(container, 1))
    expect(switchOf(container, 1)).toHaveAttribute('aria-checked', 'true')
    expect(switchOf(container, 1)).toHaveAttribute('aria-busy', 'true')
    expect(cellsOf(rowOf(container, 1))[6]).toHaveTextContent('On')
    await user.click(switchOf(container, 1))
    expect(onToggle).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true }) })
    expect(switchOf(container, 1)).not.toHaveAttribute('aria-busy')
  })

  it('a save that fails goes back to the stored value and says so with the text of the API', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn(() => Promise.resolve({ ok: false, error: ['Not allowed'] }))
    const { container } = draw({ onToggle })
    await user.click(switchOf(container, 1))
    expect(switchOf(container, 1)).toHaveAttribute('aria-checked', 'false')
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(cellsOf(rowOf(container, 1))[6]).toHaveTextContent('Off')
  })

  it('a failure with no text says «We couldn\'t change this rule. Try again.»', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn(() => Promise.resolve({ ok: false }))
    const { container } = draw({ onToggle })
    await user.click(switchOf(container, 2))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change this rule. Try again.")
  })

  it('the text of a failed change can be read in the notice, and clicking it does not open the row', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn(() => Promise.resolve({ ok: false }))
    const { container } = draw({ onToggle })
    await user.click(switchOf(container, 2))
    await user.click(await screen.findByRole('alert'))
    expect(current.onOpen).not.toHaveBeenCalled()
  })
})

describe('RulesTable opening a rule', () => {
  it('clicking a row, or pressing Enter on it, opens that rule', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    await user.click(within(rowOf(container, 2)).getByText(tenOff.name))
    expect(current.onOpen).toHaveBeenLastCalledWith(tenOff)
    act(() => { rowOf(container, 3).focus() })
    await user.keyboard('{Enter}')
    expect(current.onOpen).toHaveBeenLastCalledWith(bare)
    expect(current.onOpen).toHaveBeenCalledTimes(2)
  })

  it('the open rule is marked current', () => {
    const { container } = draw({ activeId: '2' })
    expect(rowOf(container, 2)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 1)).not.toHaveAttribute('aria-current')
  })
})

describe('RulesTable column manager', () => {
  const openManager = async () => userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))

  // CM-1: it used to sit in its own row above the table (`.odc-ra-tools`, ~90px of gap under the filter bar)
  it('the table draws no column manager and no row for one: it is the header\'s filter bar that holds it', () => {
    const { container } = draw()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
    expect(container.querySelector('.odc-ra-tools')).toBeNull()
    expect(headers()).toEqual(['Rule', 'Description', 'Sends after', 'Channels', 'Sent', 'Recovered', 'Revenue recovered', 'Status']) // every column, as with no host state
  })

  it('offers the five columns and locks none: every one can be hidden', async () => {
    drawHosted()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    for (const name of ['Rule', 'Description', 'Sends after', 'Channels', 'Sent', 'Recovered', 'Revenue recovered', 'Status']) {
      expect(within(dialog).getByRole('checkbox', { name })).toBeEnabled()
    }
  })

  it('hiding a column takes it out of the table and Reset brings it back (local state)', async () => {
    drawHosted()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Channels' }))
    expect(headers()).not.toContain('Channels')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toContain('Channels')
  })
})

const READY_STATS = (sent, recovered, total) => ({ loading: false, error: null, sent_count: sent, recovered_count: recovered, recovered_total: total })

describe('RulesTable results (sent, recovered, revenue recovered)', () => {
  // cells after Rule: [description, sends after, channels, sent, recovered, revenue, status]
  const results = (container, id) => cellsOf(rowOf(container, id)).slice(3, 6)

  it('draws the three figures of a rule, money through parsePrice and numbers in the locale', () => {
    mocks.locale = 'de'
    mocks.parsePrice = vi.fn(value => `$${Number(value).toFixed(2)}`)
    const { container } = draw({ statsByRule: { 1: READY_STATS(1234, 56, 7890.5) } })
    const [sent, recovered, revenue] = results(container, 1)
    expect(sent).toHaveTextContent('1.234')
    expect(recovered).toHaveTextContent('56')
    expect(revenue).toHaveTextContent('$7890.50')
    expect(mocks.parsePrice).toHaveBeenCalledWith(7890.5)
    expect(sent.querySelector('bdi.odc-figure')).toHaveAttribute('dir', 'ltr')
  })

  it('shows zero as a real value', () => {
    const { container } = draw({ statsByRule: { 1: READY_STATS(0, 0, 0) } })
    const [sent, recovered, revenue] = results(container, 1)
    expect(sent.textContent).toBe('0')
    expect(recovered.textContent).toBe('0')
    expect(revenue).toHaveTextContent('$0.00')
  })

  it('shows a skeleton with a screen-reader text while the results load', () => {
    const { container } = draw({ statsByRule: { 1: { loading: true, error: null, sent_count: null, recovered_count: null, recovered_total: null } } })
    for (const cell of results(container, 1)) {
      expect(cell.querySelector('[aria-busy="true"]')).not.toBeNull()
      expect(within(cell).getByText('Loading results')).toBeInTheDocument()
    }
  })

  it('shows a dash that says the results could not be loaded when the request failed', () => {
    const { container } = draw({ statsByRule: { 1: { loading: false, error: ['x'], sent_count: null, recovered_count: null, recovered_total: null } } })
    for (const cell of results(container, 1)) {
      expect(cell).toHaveTextContent('—')
      expect(within(cell).getByText("Results couldn't be loaded")).toBeInTheDocument()
      expect(cell.querySelector('[title]')).toHaveAttribute('title', "Results couldn't be loaded")
    }
    // the rules themselves are untouched
    expect(screen.getByText(abandoned.name)).toBeInTheDocument()
  })

  it('shows a plain dash for a rule nobody asked about, for no map at all and for a null figure', () => {
    const { container } = draw({ statsByRule: { 2: READY_STATS(null, 3, null) } })
    expect(results(container, 1).map(cell => cell.textContent)).toEqual(['—', '—', '—'])
    expect(results(container, 2).map(cell => cell.textContent)).toEqual(['—', '3', '—'])
    cleanup()
    const bare = draw({ statsByRule: undefined })
    expect(results(bare.container, 1).map(cell => cell.textContent)).toEqual(['—', '—', '—'])
  })

  it('the manager lists the three columns and can hide them', async () => {
    drawHosted({ statsByRule: { 1: READY_STATS(1, 2, 3) } })
    await userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog')
    for (const name of ['Sent', 'Recovered', 'Revenue recovered']) {
      expect(within(dialog).getByRole('checkbox', { name })).toBeChecked()
    }
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Recovered' }))
    expect(headers()).not.toContain('Recovered')
    expect(headers()).toContain('Sent')
  })

  it('on a phone the card carries the results in one line, one skeleton while loading, and nothing when unknown', () => {
    mocks.phone = true
    const { container } = draw({
      rules: [abandoned, tenOff, bare],
      statsByRule: {
        1: READY_STATS(12, 3, 45),
        2: { loading: true, error: null },
        3: { loading: false, error: ['x'] }
      }
    })
    expect(container).toHaveTextContent('Sent 12 · Recovered 3 · Revenue recovered $45.00')
    expect(within(container).getAllByText('Loading results')).toHaveLength(1)
    expect(container).not.toHaveTextContent("Results couldn't be loaded")
  })
})

describe('RulesTable by width (the table\'s own width, not the window)', () => {
  const ALL = ['Rule', 'Description', 'Sends after', 'Channels', 'Sent', 'Recovered', 'Revenue recovered', 'Status']
  const without = (...hidden) => ALL.filter(name => !hidden.includes(name))
  const headersAt = (width) => {
    cleanup()
    mocks.width = width
    draw()
    return headers()
  }

  it('with room it shows all eight', () => {
    expect(headersAt(1200)).toEqual(ALL)
  })

  // The thresholds were measured in the browser: a 1440px screen leaves the table 1144px, and it keeps every column
  it('drops Description first, under 1140px', () => {
    expect(headersAt(1144)).toEqual(ALL)
    expect(headersAt(1140)).toEqual(ALL)
    expect(headersAt(1139)).toEqual(without('Description'))
  })

  it('then the results one by one: Sent under 830px, Recovered under 780px, Revenue recovered under 690px', () => {
    expect(headersAt(830)).toEqual(without('Description'))
    expect(headersAt(829)).toEqual(without('Description', 'Sent'))
    expect(headersAt(780)).toEqual(without('Description', 'Sent'))
    expect(headersAt(779)).toEqual(without('Description', 'Sent', 'Recovered'))
    expect(headersAt(690)).toEqual(without('Description', 'Sent', 'Recovered'))
    expect(headersAt(689)).toEqual(['Rule', 'Sends after', 'Channels', 'Status'])
  })

  // Beside the open panel at 1280 the table measures 544px: the same four columns it showed before the results existed
  it('keeps Channels at 544px (1280 with the panel open)', () => {
    expect(headersAt(544)).toEqual(['Rule', 'Sends after', 'Channels', 'Status'])
  })

  it('drops Channels last, under 520px; Rule, Sends after and Status never go', () => {
    expect(headersAt(520)).toEqual(['Rule', 'Sends after', 'Channels', 'Status'])
    expect(headersAt(519)).toEqual(['Rule', 'Sends after', 'Status'])
    expect(headersAt(120)).toEqual(['Rule', 'Sends after', 'Status'])
  })

  it('the manager says which column is hidden at this width', async () => {
    mocks.width = 700
    drawHosted()
    await userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog')
    // at 700 Description, Sent and Recovered step aside
    expect(within(dialog).getAllByText('Hidden at this width')).toHaveLength(3)
  })
})

describe('RulesTable states that are not rows', () => {
  it('loading: skeleton rows (the page size), the table busy, nothing to open', () => {
    const { container } = draw({ rules: [], loading: true, pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 25 } })
    expect(screen.getByRole('table', { name: 'Cart recovery rules' })).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('tbody tr[data-skeleton]')).toHaveLength(25)
    expect(screen.getByText('Loading rules')).toBeInTheDocument()
  })

  it('no rules and no search: «No recovery rules yet» with «New rule»', async () => {
    const user = userEvent.setup()
    draw({ rules: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 } })
    expect(screen.getByText('No recovery rules yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New rule' }))
    expect(current.onNew).toHaveBeenCalledTimes(1)
  })

  it('no rules with a search: «No rules match "x"» and no «New rule» button', () => {
    draw({ rules: [], searching: 'coupon', pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 } })
    expect(screen.getByText('No rules match "coupon"')).toBeInTheDocument()
    expect(screen.queryByText('No recovery rules yet')).toBeNull()
    expect(screen.queryByRole('button', { name: 'New rule' })).toBeNull()
  })

  it('a failure takes the place of the list: an alert with the API message and «Retry» (M-RA4)', async () => {
    const user = userEvent.setup()
    draw({ rules: [], error: ['Something went wrong on the server'] })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the rules.")
    expect(alert).toHaveTextContent('Something went wrong on the server')
    expect(screen.queryByRole('table')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('a failure while a retry is loading keeps showing the rows state, not the error', () => {
    draw({ rules: [], error: ['boom'], loading: true })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

describe('RulesTable pagination', () => {
  const foot = () => screen.getByRole('navigation', { name: 'Pagination' })

  it('shows the range with figures and offers the page sizes of the contract (10, 25, 50)', async () => {
    draw({ pagination: { currentPage: 1, totalPages: 3, totalItems: 23, pageSize: 10 } })
    expect(foot()).toHaveTextContent('Showing 1–10 of 23')
    expect(within(foot()).getByText('23')).toHaveClass('odc-figure')
    await userEvent.click(within(foot()).getByRole('button', { name: /Items per page/ }))
    const sizes = (await screen.findAllByRole('menuitemradio')).map(item => item.textContent)
    expect(sizes).toEqual(PAGE_SIZES.map(String))
  })

  it('choosing another page size tells the host the size', async () => {
    draw({ pagination: { currentPage: 1, totalPages: 3, totalItems: 23, pageSize: 10 } })
    await userEvent.click(within(foot()).getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(current.onPageSizeChange).toHaveBeenCalledTimes(1)
    expect(current.onPageSizeChange.mock.calls[0][0]).toBe(25)
  })

  it('goes to the next page', async () => {
    const user = userEvent.setup()
    draw({ pagination: { currentPage: 1, totalPages: 3, totalItems: 23, pageSize: 10 } })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(current.onPageChange).toHaveBeenCalledWith(2)
  })

  it('draws no foot when there are no rules', () => {
    draw({ rules: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })
})

describe('RulesTable on a phone', () => {
  beforeEach(() => { mocks.phone = true })
  const cardOf = (container, id) => container.querySelector(`li[data-row-id="${id}"]`)

  it('draws one card per rule, no table, in a list named «Cart recovery rules»', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Cart recovery rules' })).toBeInTheDocument()
    expect(container.querySelectorAll('li[data-row-id]')).toHaveLength(4)
  })

  it('the card carries the name, the description, the wait and the channels in one line (off ones struck)', () => {
    const { container } = draw()
    const card = cardOf(container, 2)
    expect(card).toHaveTextContent(tenOff.name)
    expect(card).toHaveTextContent(tenOff.description)
    const line = card.querySelector('.odc-ra-card-line')
    expect(line).toHaveTextContent(`${formatWait(430, 'en')} · SMS · Email · Push`)
    expect(line.querySelector('.odc-figure')).toHaveTextContent(formatWait(430, 'en'))
    expect(within(card).getByLabelText('SMS, off')).toHaveAttribute('data-off', '')
  })

  it('a card has the same data as the row: no wait is «—», no channels «No messages», a failure «Retry»', async () => {
    const user = userEvent.setup()
    const { container } = draw({
      rules: [noWait, bare, abandoned],
      channelsByRule: { 5: READY([channel(51, 'email')]), 3: READY([]), 1: { loading: false, channels: [], error: ['x'] } }
    })
    expect(cardOf(container, 5).querySelector('.odc-ra-card-line')).toHaveTextContent('— · Email')
    expect(cardOf(container, 3).querySelector('.odc-ra-card-line')).toHaveTextContent(`${formatWait(5, 'en')} · No messages`)
    await user.click(within(cardOf(container, 1)).getByRole('button', { name: /Retry/ }))
    expect(current.onRetryChannels).toHaveBeenCalledWith(1)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('while the channels load the line holds a skeleton in their place', () => {
    const { container } = draw({ channelsByRule: {} })
    expect(cardOf(container, 1).querySelector('.odc-ra-card-line .odc-skeleton')).not.toBeNull()
    // redesign (row 83 R1-10): the card's line is text, so its skeleton keeps the inline holder (the table cell's is a block)
    expect(cardOf(container, 1).querySelector('.odc-ra-card-line .odc-ra-channels')).toHaveAttribute('data-inline')
  })

  it('the switch is the action of the card: it saves, and it does not open the card', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    const toggle = within(cardOf(container, 1)).getByRole('switch', { name: abandoned.name })
    await user.click(toggle)
    expect(current.onToggle).toHaveBeenCalledWith(abandoned, true)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('the card opens the rule: a plain click goes through onOpen, and it is a link to ?id=', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    const link = within(cardOf(container, 4)).getByRole('link', { name: `Open ${days.name}` })
    expect(link.getAttribute('href')).toContain('id=4')
    await user.click(link)
    expect(current.onOpen).toHaveBeenCalledWith(days)
  })

  it('marks the open one, and has the same empty, error and loading states', () => {
    const { container } = draw({ activeId: 2 })
    expect(cardOf(container, 2)).toHaveAttribute('aria-current', 'true')
    cleanup()
    draw({ rules: [], searching: 'zzz' })
    expect(screen.getByText('No rules match "zzz"')).toBeInTheDocument()
    cleanup()
    draw({ rules: [], error: ['bad'] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the rules.")
    cleanup()
    const { container: loading } = draw({ rules: [], loading: true })
    expect(loading.querySelectorAll('li[data-skeleton]')).toHaveLength(10)
  })

  it('has no column manager on a phone', () => {
    draw()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
  })
})

// redesign R2-G1: two findings of the mechanical measure live only in CSS (jsdom does not lay out), so the sheets are read as text.
describe('stylesheets of the measure findings (R2-G1)', () => {
  const sheet = (name) => readFileSync(resolve(__dirname, '..', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const blocksOf = (css, selector) => Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter(([, selectors]) => selectors.split(',').some(item => item.trim() === selector))
    .map(([, , body]) => body)

  // 2.93:1 on the off chip (SMS, 12px): the dimming came from opacity over the muted text. Colour, strike and dashed border say «off».
  it('the off chip is not dimmed by opacity: muted text, struck out, dashed border', () => {
    const css = sheet('recovery-rules-list.css')
    const chip = blocksOf(css, '.odc-ra-chip[data-off]').join('\n')
    expect(chip).toMatch(/color:\s*var\(--od-text-muted\)\s*;/)
    expect(chip).toMatch(/text-decoration:\s*line-through\s*;/)
    expect(chip).toMatch(/border-style:\s*dashed\s*;/)
    expect(chip).not.toMatch(/opacity/)
  })

  it('no off chip is dimmed by opacity anywhere in the list sheet (the inline one of the cards included)', () => {
    const css = sheet('recovery-rules-list.css')
    const offBlocks = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).filter(([, selectors]) => /data-off/.test(selectors))
    expect(offBlocks.length).toBeGreaterThan(0)
    for (const [, , body] of offBlocks) expect(body).not.toMatch(/opacity/)
  })

  // redesign (row 83 R1-10): rows grew ~3px when the chips replaced the skeleton. jsdom does not lay out, so what can be shown
  // here is the contract: one chip-row height built from the chip's own metrics, held by the skeleton's cell and by the skeleton line.
  // The pixels are verified live.
  it('the channels skeleton holds the height of the chip row (same metrics as the chip), with tokens only', () => {
    const css = sheet('recovery-rules-list.css')
    const rowHeight = blocksOf(css, '.odc-ra-channels').concat(blocksOf(css, '.odc-ra-chips')).join('\n')
    const definition = rowHeight.match(/--odc-ra-chip-row:\s*([^;]+);/)
    expect(definition).not.toBeNull()
    for (const token of ['--od-x-space-half', '--od-x-hairline', '--od-x-leading-ui', '--od-x-type-caption-size']) expect(definition[1]).toContain(token)
    expect(definition[1]).not.toMatch(/\d(px|rem|em)\b/)

    const cell = blocksOf(css, '.odc-ra-channels:not([data-inline])').join('\n')
    expect(cell).toMatch(/display:\s*flex\s*;/)
    expect(cell).toMatch(/min-block-size:\s*var\(--odc-ra-chip-row\)\s*;/)
    const line = blocksOf(css, '.odc-ra-channels:not([data-inline]) .odc-skeleton').join('\n')
    expect(line).toMatch(/block-size:\s*var\(--odc-ra-chip-row\)\s*;/)
  })

  it('the skeleton of a table cell is not the inline one of a card', () => {
    const { container } = draw({ channelsByRule: { 1: { loading: true, channels: [], error: null } } })
    const holder = cellsOf(rowOf(container, 1))[2].querySelector('.odc-ra-channels')
    expect(holder).not.toBeNull()
    expect(holder).not.toHaveAttribute('data-inline')
  })

  // F2: at 390 the header switch (32 x 24) reaches 44 and its reach went 3px into «More actions», its neighbour, 2px away.
  it('on a phone the header switch is set apart from its neighbour with a spacing token', () => {
    const css = sheet('recovery-rule-panel.css')
    const phone = css.match(/@media \(max-width: 767px\)\s*\{\s*\.odc-ra-header-switch\s*\{([^{}]*)\}/)
    expect(phone).not.toBeNull()
    expect(phone[1]).toMatch(/margin-inline-end:\s*var\(--od-space-[0-9]+\)\s*;/)
    // and the base rule (desktop) is untouched by it
    const outsidePhone = css.replace(/@media \(max-width: 767px\)\s*\{\s*\.odc-ra-header-switch\s*\{[^{}]*\}\s*\}/, '')
    expect(blocksOf(outsidePhone, '.odc-ra-header-switch').join('\n')).not.toMatch(/margin/)
  })
})
