/* eslint-disable import/first */
// redesign CA-B4 (decision 2; defects M-CA4, M-CA5, M-CA6, M-CA8): the campaigns list as a Product DataTable (and RecordCards under
// 768px). The Product wrappers are real; the environment (language, the phone flag, the date parser) is simulated, and
// `campaignData.js` (CA-B3) is mocked so these tests do not depend on its timing: the table must call it, never print raw values.
import React from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  phone: false,
  locale: 'en', // redesign CA-R1 (live check): the language code the counts are written in
  parseDate: vi.fn(() => 'Aug 1, 2026, 10:00 AM'),
  parsePrice: vi.fn((value) => `$${Number(value).toFixed(2)}`),
  formatWhen: vi.fn()
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: mocks.locale } }, (_key, text) => text],
  useUtils: () => [{ parseDate: mocks.parseDate, parsePrice: mocks.parsePrice }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))
vi.mock('../campaignData', async (importOriginal) => ({
  // redesign CA-R1 (live check): the real number formatter (pure), so the table is proven to call it with the language code
  formatCount: (await importOriginal()).formatCount,
  hasOrderStats: (await importOriginal()).hasOrderStats, // the shared rule, not a copy of it
  channelLabel: (_t, type) => ({ email: 'Email', sms: 'SMS', notification: 'Push notification' }[type] ?? 'Other'),
  audienceLabel: (_t, type) => ({ fixed: 'Fixed', dynamic: 'Dynamic' }[type] ?? '—'),
  campaignStatus: (campaign) => {
    if (campaign.status === 'ended') return { family: 'done', label: 'Ended', toggle: false }
    if (campaign.audience_type === 'dynamic') {
      return campaign.enabled
        ? { family: 'progress', label: 'Active', toggle: true }
        : { family: 'pending', label: 'Paused', toggle: true }
    }
    if (campaign.status === 'scheduled') return { family: 'pending', label: 'Scheduled', toggle: false }
    return { family: 'pending', label: 'Pending', toggle: false }
  },
  formatWhen: (value, parseDate) => mocks.formatWhen(value, parseDate)
}))

import { CampaignColumnManager, CampaignsTable, useCampaignColumns } from '../CampaignsTable'

const weekend = {
  id: 1,
  name: 'Weekend offer',
  contact_type: 'email',
  audience_type: 'dynamic',
  enabled: true,
  status: 'active',
  audience_count: 10,
  sent_count: 4,
  open_count: 3
}
const winback = {
  id: 2,
  name: 'Win-back',
  contact_type: 'sms',
  audience_type: 'dynamic',
  enabled: false,
  status: 'active',
  audience_count: 5,
  sent_count: 0,
  open_count: 0
}
const spring = {
  id: 3,
  name: 'Spring sale',
  contact_type: 'notification',
  audience_type: 'fixed',
  status: 'scheduled',
  scheduled_at: '2026-08-01 10:00:00',
  audience_count: 20,
  sent_count: 20,
  open_count: 7
}
const oldPromo = {
  id: 4,
  name: 'Old promo',
  contact_type: 'email',
  audience_type: 'fixed',
  status: 'ended',
  audience_count: 100,
  sent_count: 100,
  open_count: 40
}
const oldDynamic = {
  id: 5,
  name: 'Old loop',
  contact_type: 'email',
  audience_type: 'dynamic',
  enabled: true,
  status: 'ended',
  audience_count: 8,
  sent_count: 8,
  open_count: 0
}
const rawPush = { id: 6, name: 'Raw push', contact_type: 'push', audience_type: 'fixed', status: 'pending', audience_count: 3, sent_count: 1, open_count: 2 }
const noFigures = { id: 7, name: 'Blank', contact_type: 'email', audience_type: 'fixed', status: 'draft' }

let current
const draw = (props = {}) => {
  current = {
    campaigns: [weekend, winback, spring, oldPromo, oldDynamic],
    loading: false,
    error: null,
    onRetry: vi.fn(),
    activeId: undefined,
    onOpen: vi.fn(),
    onOpenOpens: vi.fn(),
    toggle: { pendingIds: [], setEnabled: vi.fn() },
    pagination: { currentPage: 1, totalPages: 1, totalItems: 5, pageSize: 10 },
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    hasFilters: false,
    onClearFilters: vi.fn(),
    onNew: vi.fn(),
    ...props
  }
  const ui = (next) => <CampaignsTable {...next} />
  const view = render(ui(current))
  return { ...view, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(ui(current)) } }
}

// CM-1: the column manager is not in the table: the host (the page) holds the choice and draws the manager in the filter bar's
// `tools` slot. This host does the same: the manager and the table share one state.
const Host = (props) => {
  const state = useCampaignColumns()
  return (
    <>
      <CampaignColumnManager state={state} />
      <CampaignsTable {...props} columnsState={state} />
    </>
  )
}
const drawHosted = (props = {}) => {
  draw(props)
  cleanup()
  return render(<Host {...current} />)
}

const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
// the data cells after the Campaign row header: [contact type, audience, status, in queue, sent, opens, orders, revenue]
const cellsOf = (row) => Array.from(row.querySelectorAll('td:not([data-selection])'))
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean)

beforeEach(() => {
  mocks.phone = false
  mocks.locale = 'en'
  mocks.parseDate.mockClear()
  mocks.formatWhen.mockReset()
  mocks.formatWhen.mockImplementation((value) => (value ? 'Aug 1, 2026, 10:00 AM' : null))
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('CampaignsTable columns', () => {
  it('has Campaign, Channel, Audience, Status, In queue, Sent, Opens, Orders and Revenue, in a table named «Campaigns»', () => {
    draw()
    expect(headers()).toEqual(['Campaign', 'Channel', 'Audience', 'Status', 'In queue', 'Sent', 'Opens', 'Orders', 'Revenue'])
    expect(screen.getByRole('table', { name: 'Campaigns' })).toBeInTheDocument()
  })

  it('the Campaign cell is the row header with the name; Unsubscribed and Bounces are not columns (as today)', () => {
    const { container } = draw()
    expect(within(rowOf(container, 1)).getByRole('rowheader')).toHaveTextContent('Weekend offer')
    expect(headers()).not.toContain('Unsubscribed')
    expect(headers()).not.toContain('Bounces')
  })

  it('channel and audience come from the labels, never the raw value (M-CA6)', () => {
    const { container } = draw({ campaigns: [weekend, winback, spring, rawPush] })
    expect(cellsOf(rowOf(container, 1)).slice(0, 2).map(cell => cell.textContent)).toEqual(['Email', 'Dynamic'])
    expect(cellsOf(rowOf(container, 3)).slice(0, 2).map(cell => cell.textContent)).toEqual(['Push notification', 'Fixed'])
    expect(cellsOf(rowOf(container, 6)).slice(0, 2).map(cell => cell.textContent)).toEqual(['Other', 'Fixed'])
    expect(screen.queryByText('notification')).toBeNull()
    expect(screen.queryByText('dynamic')).toBeNull()
  })

  it('In queue is audience minus sent (0 when either is missing), as a right-aligned figure', () => {
    const { container } = draw({ campaigns: [weekend, noFigures, spring] })
    const queue = id => cellsOf(rowOf(container, id))[3]
    expect(within(queue(1)).getByText('6')).toHaveClass('odc-figure')
    expect(within(queue(7)).getByText('0')).toHaveClass('odc-figure')
    expect(within(queue(3)).getByText('0')).toHaveClass('odc-figure')
    for (const name of ['In queue', 'Sent', 'Opens', 'Orders', 'Revenue']) {
      expect(screen.getAllByRole('columnheader').find(header => header.textContent === name)).toHaveAttribute('data-align', 'end')
    }
  })

  it('Sent and Opens are N/A for sms and for the literal «push»; a notification campaign keeps its figures (M-CA5)', () => {
    const { container } = draw({ campaigns: [weekend, winback, spring, rawPush] })
    const sent = id => cellsOf(rowOf(container, id))[4]
    const opens = id => cellsOf(rowOf(container, id))[5]
    expect(sent(1)).toHaveTextContent('4')
    expect(opens(1)).toHaveTextContent('3')
    expect(sent(2)).toHaveTextContent('N/A')
    expect(opens(2)).toHaveTextContent('N/A')
    expect(sent(6)).toHaveTextContent('N/A')
    expect(opens(6)).toHaveTextContent('N/A')
    // push campaigns are stored as «notification»: they show their figures and the opens list
    expect(within(sent(3)).getByText('20')).toHaveClass('odc-figure')
    expect(within(opens(3)).getByRole('button')).toHaveTextContent('7')
  })

  // redesign CA-R1 (live check): 1240 is drawn «1,240» in English and, by the Spanish rule (no grouping of four digits), «1240» in Spanish; the opens link name carries the same text
  it('In queue, Sent and Opens write a count above 999 in the language of the person', () => {
    const big = { ...weekend, id: 9, audience_count: 1500, sent_count: 1240, open_count: 1240 }
    const bigQueue = { ...weekend, id: 10, audience_count: 2480, sent_count: 1240, open_count: 0 }
    const view = draw({ campaigns: [big, bigQueue] })
    const cells = id => cellsOf(rowOf(view.container, id))
    expect(within(cells(9)[3]).getByText('260')).toHaveClass('odc-figure')
    expect(within(cells(9)[4]).getByText('1,240')).toHaveClass('odc-figure')
    expect(within(cells(9)[5]).getByRole('button', { name: '1,240 opens of Weekend offer' })).toHaveTextContent('1,240')
    expect(within(cells(10)[3]).getByText('1,240')).toHaveClass('odc-figure')
    view.unmount()

    mocks.locale = 'es'
    const es = draw({ campaigns: [big, bigQueue] })
    const esCells = id => cellsOf(rowOf(es.container, id))
    expect(within(esCells(9)[4]).getByText('1240')).toHaveClass('odc-figure')
    expect(within(esCells(9)[5]).getByRole('button', { name: '1240 opens of Weekend offer' })).toHaveTextContent('1240')
    expect(within(esCells(10)[3]).getByText('1240')).toHaveClass('odc-figure')
  })

  it('a missing sent or opens count reads 0, not blank', () => {
    const { container } = draw({ campaigns: [noFigures] })
    const cells = cellsOf(rowOf(container, 7))
    expect(cells[4]).toHaveTextContent('0')
    expect(cells[5]).toHaveTextContent('0')
    expect(within(cells[5]).queryByRole('button')).toBeNull()
  })
})

describe('CampaignsTable orders and revenue', () => {
  const earner = { ...weekend, id: 20, orders_count: 1240, orders_total: 5230.5 }
  const orders = (container, id) => cellsOf(rowOf(container, id))[6]
  const revenue = (container, id) => cellsOf(rowOf(container, id))[7]

  it('an email campaign shows its orders as a formatted figure and its revenue through parsePrice', () => {
    const { container } = draw({ campaigns: [earner] })
    expect(within(orders(container, 20)).getByText('1,240')).toHaveClass('odc-figure')
    expect(mocks.parsePrice).toHaveBeenCalledWith(5230.5)
    expect(within(revenue(container, 20)).getByText('$5230.50')).toHaveClass('odc-figure')
  })

  it('the orders count follows the language of the person', () => {
    mocks.locale = 'es'
    const { container } = draw({ campaigns: [earner] })
    expect(within(orders(container, 20)).getByText('1240')).toHaveClass('odc-figure')
  })

  it('zero orders and zero revenue read 0, not N/A', () => {
    const { container } = draw({ campaigns: [{ ...weekend, id: 21, orders_count: 0, orders_total: 0 }] })
    expect(orders(container, 21)).toHaveTextContent('0')
    expect(revenue(container, 21)).toHaveTextContent('$0.00')
    expect(orders(container, 21)).not.toHaveTextContent('N/A')
  })

  it('a missing orders count or total reads 0 for an email campaign', () => {
    const { container } = draw({ campaigns: [noFigures] })
    expect(orders(container, 7)).toHaveTextContent('0')
    expect(revenue(container, 7)).toHaveTextContent('$0.00')
  })

  it('a total that arrives as a numeric string is read as a number', () => {
    const { container } = draw({ campaigns: [{ ...weekend, id: 22, orders_count: 2, orders_total: '99.9' }] })
    expect(mocks.parsePrice).toHaveBeenCalledWith(99.9)
    expect(revenue(container, 22)).toHaveTextContent('$99.90')
  })

  it('sms and the literal push read N/A in both cells, whatever the API answers', () => {
    const sms = { ...winback, orders_count: 0, orders_total: 0 }
    const push = { ...rawPush, orders_count: 3, orders_total: 40 }
    const { container } = draw({ campaigns: [sms, push] })
    for (const id of [2, 6]) {
      expect(orders(container, id)).toHaveTextContent('N/A')
      expect(revenue(container, id)).toHaveTextContent('N/A')
    }
    expect(mocks.parsePrice).not.toHaveBeenCalled()
  })

  it('a push notification campaign shows its orders and revenue', () => {
    const push = { ...spring, orders_count: 3, orders_total: 40 }
    const { container } = draw({ campaigns: [push] })
    expect(orders(container, 3)).toHaveTextContent('3')
    expect(orders(container, 3)).not.toHaveTextContent('N/A')
    expect(revenue(container, 3)).not.toHaveTextContent('N/A')
    expect(mocks.parsePrice).toHaveBeenCalledWith(40)
  })
})

describe('CampaignsTable status', () => {
  it('a running dynamic campaign has a switch named «Active, <campaign>» with the status as its visible text', () => {
    const { container } = draw()
    const status = cellsOf(rowOf(container, 1))[2]
    const control = within(status).getByRole('switch', { name: 'Active, Weekend offer' })
    expect(control).toBeChecked()
    expect(control).toHaveTextContent('Active')
  })

  it('a paused dynamic campaign reads «Paused» and is off', () => {
    const { container } = draw()
    const control = within(cellsOf(rowOf(container, 2))[2]).getByRole('switch', { name: 'Paused, Win-back' })
    expect(control).not.toBeChecked()
    expect(control).toHaveTextContent('Paused')
  })

  it('only non-ended dynamics get a switch: fixed and ended campaigns show a status with its label', () => {
    const { container } = draw()
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(cellsOf(rowOf(container, 3))[2]).toHaveTextContent('Scheduled')
    expect(cellsOf(rowOf(container, 4))[2]).toHaveTextContent('Ended')
    expect(within(cellsOf(rowOf(container, 5))[2]).queryByRole('switch')).toBeNull()
    expect(cellsOf(rowOf(container, 5))[2]).toHaveTextContent('Ended')
    expect(rowOf(container, 4).querySelector('.odc-status')).toHaveAttribute('data-family', 'done')
  })

  // redesign CA-R2 (P4): beside the open panel the Status column was cut mid-word («Schedulec», «Activ»). It names a floor (a token the
  // brand candidates already define) and its labels never break inside a word.
  it('P4: the Status column names its floor token, in the header and in every row', () => {
    const { container } = draw()
    const header = screen.getByRole('columnheader', { name: 'Status' })
    expect(header).toHaveAttribute('data-floor')
    expect(header.style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-col-floor-campaign-status)')
    const cell = cellsOf(rowOf(container, 1))[2]
    expect(cell).toHaveAttribute('data-floor')
    expect(cell.style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-col-floor-campaign-status)')
  })

  it('P4: the status label (the text of a Status and of a switch) carries the class that keeps it whole', () => {
    const { container } = draw()
    expect(rowOf(container, 3).querySelector('.odc-status')).toHaveClass('odc-campaign-status-label')
    expect(within(cellsOf(rowOf(container, 1))[2]).getByRole('switch')).toHaveClass('odc-campaign-status-label')
  })

  it('pressing the switch asks the hook to set the new value and does not open the row', async () => {
    const { container } = draw()
    await userEvent.click(within(cellsOf(rowOf(container, 1))[2]).getByRole('switch'))
    expect(current.toggle.setEnabled).toHaveBeenCalledWith(weekend, false)
    expect(current.onOpen).not.toHaveBeenCalled()
    await userEvent.click(within(cellsOf(rowOf(container, 2))[2]).getByRole('switch'))
    expect(current.toggle.setEnabled).toHaveBeenLastCalledWith(winback, true)
  })

  it('a pending id paints its switch busy (and it ignores further presses)', async () => {
    const { container } = draw({ toggle: { pendingIds: [1], setEnabled: vi.fn() } })
    const control = within(cellsOf(rowOf(container, 1))[2]).getByRole('switch')
    expect(control).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(control)
    expect(current.toggle.setEnabled).not.toHaveBeenCalled()
  })

  it('a scheduled campaign shows its date and time after the status, in a figure, parsed in local wall time', () => {
    const { container } = draw()
    expect(mocks.formatWhen).toHaveBeenCalledWith('2026-08-01 10:00:00', mocks.parseDate)
    const status = cellsOf(rowOf(container, 3))[2]
    expect(status.textContent).toMatch(/Scheduled.*Aug 1, 2026, 10:00 AM/)
    expect(within(status).getByText('Aug 1, 2026, 10:00 AM')).toHaveClass('odc-figure')
    // a campaign that is not scheduled shows no date
    expect(cellsOf(rowOf(container, 4))[2].textContent).not.toMatch(/Aug/)
  })

  it('a scheduled campaign without a date shows only the status', () => {
    mocks.formatWhen.mockReturnValue(null)
    const { container } = draw({ campaigns: [{ ...spring, scheduled_at: null }] })
    expect(cellsOf(rowOf(container, 3))[2].textContent).toBe('Scheduled')
  })
})

describe('CampaignsTable opening rows and the opens link', () => {
  it('clicking a row opens it, an ended one included (M-CA4)', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 4)).getByText('Old promo'))
    expect(current.onOpen).toHaveBeenCalledWith(oldPromo)
    await userEvent.click(within(rowOf(container, 1)).getByText('Weekend offer'))
    expect(current.onOpen).toHaveBeenLastCalledWith(weekend)
  })

  it('Enter on a focused row opens it', async () => {
    const { container } = draw()
    act(() => rowOf(container, 4).focus())
    await userEvent.keyboard('{Enter}')
    expect(current.onOpen).toHaveBeenCalledWith(oldPromo)
  })

  it('the row of the open campaign is the active one', () => {
    const { container } = draw({ activeId: 3 })
    expect(rowOf(container, 3)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 1)).not.toHaveAttribute('aria-current')
  })

  it('an opens count above 0 is a button that opens the opens list and does not open the row', async () => {
    const { container } = draw()
    const link = within(cellsOf(rowOf(container, 1))[5]).getByRole('button', { name: '3 opens of Weekend offer' })
    expect(within(link).getByText('3')).toHaveClass('odc-figure')
    await userEvent.click(link)
    expect(current.onOpenOpens).toHaveBeenCalledWith(weekend)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('an opens count of 0 is plain text, not a button', () => {
    const { container } = draw()
    const cell = cellsOf(rowOf(container, 5))[5]
    expect(cell).toHaveTextContent('0')
    expect(within(cell).queryByRole('button')).toBeNull()
  })
})

describe('CampaignsTable states', () => {
  it('loading paints skeleton rows (the page size), busy, with a hidden label, and no empty state', () => {
    const { container } = draw({ loading: true, campaigns: [] })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(10)
    expect(screen.getByRole('table', { name: 'Campaigns' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading campaigns')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No campaigns yet')).toBeNull()
  })

  it('an error takes the place of the list: a message, the reason through the translator, and Retry', async () => {
    draw({ error: ['Network failure'], campaigns: [] })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText("We couldn't load campaigns.")).toBeInTheDocument()
    expect(within(alert).getByText('Network failure')).toBeInTheDocument()
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('an error given as a string works too', () => {
    draw({ error: 'Unauthorized', campaigns: [] })
    expect(within(screen.getByRole('alert')).getByText('Unauthorized')).toBeInTheDocument()
  })

  it('no campaigns and no filters: «No campaigns yet» with «New campaign»', async () => {
    draw({ campaigns: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 } })
    expect(screen.getByText('No campaigns yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'New campaign' }))
    expect(current.onNew).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('no campaigns with filters or search: «No campaigns match these filters» with «Clear filters»', async () => {
    draw({ campaigns: [], hasFilters: true, pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 } })
    expect(screen.getByText('No campaigns match these filters')).toBeInTheDocument()
    expect(screen.queryByText('No campaigns yet')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(current.onClearFilters).toHaveBeenCalledTimes(1)
  })
})

describe('CampaignsTable by width (the table\'s own width, not the window)', () => {
  const ALL = ['Campaign', 'Channel', 'Audience', 'Status', 'In queue', 'Sent', 'Opens', 'Orders', 'Revenue']
  let width = null
  class FakeResizeObserver {
    constructor (callback) { this.callback = callback }
    observe () { if (width != null) this.callback([{ contentRect: { width } }]) }
    unobserve () {}
    disconnect () {}
  }
  const headersAt = (next) => {
    cleanup()
    width = next
    draw()
    return headers()
  }

  beforeEach(() => {
    width = null
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The thresholds were measured in the browser: the seven columns the list had before need about 750px
  it('Orders steps aside under 910px and Revenue under 840px; the seven columns of before never do', () => {
    expect(headersAt(1200)).toEqual(ALL)
    expect(headersAt(910)).toEqual(ALL)
    expect(headersAt(909)).toEqual(ALL.filter(name => name !== 'Orders'))
    expect(headersAt(840)).toEqual(ALL.filter(name => name !== 'Orders'))
    expect(headersAt(839)).toEqual(ALL.slice(0, 7))
    expect(headersAt(300)).toEqual(ALL.slice(0, 7))
  })

  it('the manager says which columns are hidden at this width', async () => {
    width = 700
    drawHosted()
    await userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByText('Hidden at this width')).toHaveLength(2)
  })
})

describe('CampaignsTable column manager', () => {
  const openManager = async () => userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))

  // CM-1: it used to sit in its own row above the table (`.odc-campaign-tools`, ~90px of gap under the filter bar)
  it('the table draws no column manager and no row for one: it is the filter bar that holds it', () => {
    const { container } = draw()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
    expect(container.querySelector('.odc-campaign-tools')).toBeNull()
    expect(headers()).toEqual(['Campaign', 'Channel', 'Audience', 'Status', 'In queue', 'Sent', 'Opens', 'Orders', 'Revenue']) // every column, as with no host state
  })

  it('offers the columns of today; Campaign and Status are locked', async () => {
    drawHosted()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    const names = ['Campaign', 'Channel', 'Audience', 'Status', 'In queue', 'Sent', 'Opens', 'Orders', 'Revenue']
    for (const name of names) expect(within(dialog).getByRole('checkbox', { name })).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Campaign' })).toBeDisabled()
    expect(within(dialog).getByRole('checkbox', { name: 'Status' })).toBeDisabled()
    expect(within(dialog).getByRole('checkbox', { name: 'Audience' })).toBeEnabled()
  })

  it('hiding a column takes it out of the table and Reset brings it back (local state, no persistence)', async () => {
    drawHosted()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Audience' }))
    expect(headers()).not.toContain('Audience')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toContain('Audience')
  })

  it('the host\'s state decides what the table draws: every column the manager hides leaves, Reset brings them all back', async () => {
    drawHosted()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Sent' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Opens' }))
    expect(headers()).not.toContain('Sent')
    expect(headers()).not.toContain('Opens')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toContain('Sent')
    expect(headers()).toContain('Opens')
  })

  it('Orders and Revenue are listed, can be hidden and come back with Reset', async () => {
    drawHosted()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('checkbox', { name: 'Orders' })).toBeEnabled()
    expect(within(dialog).getByRole('checkbox', { name: 'Revenue' })).toBeEnabled()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Orders' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Revenue' }))
    expect(headers()).not.toContain('Orders')
    expect(headers()).not.toContain('Revenue')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers().slice(-2)).toEqual(['Orders', 'Revenue'])
  })
})

describe('CampaignsTable on a phone', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws one card per campaign, no table, named «Campaigns»', () => {
    draw()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Campaigns' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
  })

  it('every card carries name, status, «Channel · Audience» and the queue and sent line (auditor #18)', () => {
    const { container } = draw()
    const card = id => container.querySelector(`li[data-row-id="${id}"]`)
    expect(within(card(1)).getByRole('link', { name: 'Open Weekend offer' })).toHaveTextContent('Weekend offer')
    expect(within(card(1)).getByRole('switch', { name: 'Active, Weekend offer' })).toBeInTheDocument()
    expect(card(1)).toHaveTextContent('Email · Dynamic')
    expect(card(1)).toHaveTextContent('6 in queue · 4 sent')
    expect(card(3)).toHaveTextContent('Push notification · Fixed')
    expect(card(3)).toHaveTextContent('Scheduled')
    expect(card(3)).toHaveTextContent('Aug 1, 2026, 10:00 AM')
    expect(card(3)).toHaveTextContent('0 in queue · 20 sent')
    expect(card(4)).toHaveTextContent('Ended')
    expect(card(3).querySelectorAll('.odc-figure').length).toBeGreaterThan(0)
  })

  // redesign CA-R1 (live check): the figure line of a card writes the counts in the language of the person
  it('the queue and sent line writes a count above 999 as 1,240 (and 1240 in Spanish, by its rule)', () => {
    const big = { ...weekend, id: 9, audience_count: 2480, sent_count: 1240 }
    const view = draw({ campaigns: [big] })
    expect(view.container.querySelector('li[data-row-id="9"]')).toHaveTextContent('1,240 in queue · 1,240 sent')
    view.unmount()
    mocks.locale = 'es'
    const es = draw({ campaigns: [big] })
    expect(es.container.querySelector('li[data-row-id="9"]')).toHaveTextContent('1240 in queue · 1240 sent')
  })

  it('sent reads N/A under the same rule as the table', () => {
    const { container } = draw({ campaigns: [winback, rawPush] })
    expect(container.querySelector('li[data-row-id="2"]')).toHaveTextContent('5 in queue · Sent: N/A')
    expect(container.querySelector('li[data-row-id="6"]')).toHaveTextContent('2 in queue · Sent: N/A')
  })

  it('the singular and the plural of the queue line come from their own keys', () => {
    const one = { ...weekend, id: 8, audience_count: 5, sent_count: 4 }
    const { container } = draw({ campaigns: [one] })
    expect(container.querySelector('li[data-row-id="8"]')).toHaveTextContent('1 in queue · 4 sent')
  })

  // redesign CA-R2 (P5, parity): main's phone table carried the opens count and the link to the list of opens; the card keeps both
  it('P5: the figure line adds the opens count, with the singular and the plural of their own keys', () => {
    const one = { ...weekend, id: 8, audience_count: 5, sent_count: 4, open_count: 1 }
    const { container } = draw({ campaigns: [weekend, one, oldDynamic] })
    const card = id => container.querySelector(`li[data-row-id="${id}"]`)
    expect(card(1)).toHaveTextContent('6 in queue · 4 sent · 3 opens')
    expect(card(8)).toHaveTextContent('1 in queue · 4 sent · 1 open')
    expect(card(8)).not.toHaveTextContent('1 opens')
    expect(card(5)).toHaveTextContent('0 in queue · 8 sent · 0 opens')
    expect(within(card(1)).getByText('3', { selector: '.odc-figure' })).toBeInTheDocument()
  })

  it('P5: opens read N/A under the same rule as the table (sms and the literal «push»)', () => {
    const { container } = draw({ campaigns: [winback, rawPush] })
    expect(container.querySelector('li[data-row-id="2"]')).toHaveTextContent('5 in queue · Sent: N/A · Opens: N/A')
    expect(container.querySelector('li[data-row-id="6"]')).toHaveTextContent('2 in queue · Sent: N/A · Opens: N/A')
  })

  it('the figure line adds the orders and the revenue of an email card, singular and plural', () => {
    const many = { ...weekend, id: 30, orders_count: 12, orders_total: 340 }
    const one = { ...weekend, id: 31, orders_count: 1, orders_total: 25.5 }
    const { container } = draw({ campaigns: [many, one] })
    const card = id => container.querySelector(`li[data-row-id="${id}"]`)
    expect(card(30)).toHaveTextContent('6 in queue · 4 sent · 3 opens · 12 orders · $340.00')
    expect(card(31)).toHaveTextContent('3 opens · 1 order · $25.50')
    expect(card(31)).not.toHaveTextContent('1 orders')
    expect(within(card(30)).getByText('12', { selector: '.odc-figure' })).toBeInTheDocument()
    expect(within(card(30)).getByText('$340.00', { selector: '.odc-figure' })).toBeInTheDocument()
  })

  it('an email card without orders reads 0 orders and a zero revenue', () => {
    const { container } = draw({ campaigns: [noFigures] })
    expect(container.querySelector('li[data-row-id="7"]')).toHaveTextContent('0 orders · $0.00')
  })

  it('a push notification card shows its orders and revenue', () => {
    const { container } = draw({ campaigns: [{ ...spring, orders_count: 3, orders_total: 40 }] })
    const card = container.querySelector('li[data-row-id="3"]')
    expect(card).toHaveTextContent('3 orders')
    expect(card).not.toHaveTextContent('Orders: N/A')
  })

  it('orders read «Orders: N/A» without a revenue under the same rule as the table', () => {
    const { container } = draw({ campaigns: [{ ...winback, orders_total: 10 }, { ...rawPush, orders_total: 10 }] })
    for (const id of [2, 6]) {
      const card = container.querySelector(`li[data-row-id="${id}"]`)
      expect(card).toHaveTextContent('Orders: N/A')
      expect(card).not.toHaveTextContent('$')
    }
    expect(container.querySelector('li[data-row-id="2"]')).toHaveTextContent('Opens: N/A · Orders: N/A')
  })

  it('P5: a count above 999 is written in the language of the person', () => {
    const big = { ...weekend, id: 9, audience_count: 2480, sent_count: 1240, open_count: 1240 }
    const view = draw({ campaigns: [big] })
    expect(view.container.querySelector('li[data-row-id="9"]')).toHaveTextContent('1,240 in queue · 1,240 sent · 1,240 opens')
  })

  it('P5: a card with opens above zero has «View opens», which opens the list and not the card', async () => {
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="1"]')
    const button = within(card).getByRole('button', { name: 'View opens' })
    await userEvent.click(button)
    expect(current.onOpenOpens).toHaveBeenCalledTimes(1)
    expect(current.onOpenOpens).toHaveBeenCalledWith(weekend)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('P5: «View opens» is not there for zero opens, nor for the channels with no such count', () => {
    const { container } = draw({ campaigns: [winback, oldDynamic, rawPush, noFigures] })
    expect(within(container).queryByRole('button', { name: 'View opens' })).toBeNull()
  })

  it('P5: «View opens» says which campaign it is about (a list of identical buttons is not a list of anything)', () => {
    const { container } = draw()
    const button = within(container.querySelector('li[data-row-id="1"]')).getByRole('button', { name: 'View opens' })
    expect(button).toHaveAccessibleDescription('Weekend offer')
  })

  it('tapping a card opens it, an ended one included; the switch does not', async () => {
    const { container } = draw()
    await userEvent.click(within(container.querySelector('li[data-row-id="4"]')).getByRole('link', { name: 'Open Old promo' }))
    expect(current.onOpen).toHaveBeenCalledWith(oldPromo)
    await userEvent.click(within(container.querySelector('li[data-row-id="1"]')).getByRole('switch'))
    expect(current.toggle.setEnabled).toHaveBeenCalledWith(weekend, false)
    expect(current.onOpen).toHaveBeenCalledTimes(1)
  })

  it('has the same loading, error and empty states', async () => {
    const view = draw({ loading: true, campaigns: [] })
    expect(screen.getByText('Loading campaigns')).toBeInTheDocument()
    expect(view.container.querySelectorAll('li[data-skeleton]')).toHaveLength(10)
    view.rerenderWith({ loading: false, error: ['Boom'] })
    expect(within(screen.getByRole('alert')).getByText("We couldn't load campaigns.")).toBeInTheDocument()
    view.rerenderWith({ error: null })
    expect(screen.getByText('No campaigns yet')).toBeInTheDocument()
    view.rerenderWith({ hasFilters: true })
    expect(screen.getByText('No campaigns match these filters')).toBeInTheDocument()
  })
})

describe('CampaignsTable pagination', () => {
  it('shows the range with figures and the page sizes of today (10, 25, 50)', async () => {
    draw({ pagination: { currentPage: 2, totalPages: 3, totalItems: 25, pageSize: 10 }, campaigns: [weekend] })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 11–20 of 25')
    expect(within(nav).getByText('11')).toHaveClass('odc-figure')
    await userEvent.click(within(nav).getByRole('button', { name: /Items per page/ }))
    const sizes = (await screen.findAllByRole('menuitemradio')).map(item => item.textContent)
    expect(sizes).toEqual(['10', '25', '50'])
  })

  it('next and previous page ask the host for that page', async () => {
    draw({ pagination: { currentPage: 2, totalPages: 3, totalItems: 25, pageSize: 10 }, campaigns: [weekend] })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(current.onPageChange).toHaveBeenCalledWith(3)
    await userEvent.click(within(nav).getByRole('button', { name: 'Previous page' }))
    expect(current.onPageChange).toHaveBeenLastCalledWith(1)
  })

  it('choosing another page size tells the host the size', async () => {
    draw({ pagination: { currentPage: 1, totalPages: 3, totalItems: 25, pageSize: 10 }, campaigns: [weekend] })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    await userEvent.click(within(nav).getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(current.onPageSizeChange).toHaveBeenCalledTimes(1)
    expect(current.onPageSizeChange.mock.calls[0][0]).toBe(25)
  })

  it('paints nothing without rows', () => {
    draw({ campaigns: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('while loading the pagination stays but does nothing (busy)', async () => {
    draw({ loading: true, campaigns: [], pagination: { currentPage: 2, totalPages: 3, totalItems: 25, pageSize: 10 } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(current.onPageChange).not.toHaveBeenCalled()
  })
})
