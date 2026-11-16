/* eslint-disable import/first */
// redesign settings-logs: the project's settings logs on Product.
// Covered: the title and the count of changes; the menu button of a collapsed sidebar; the table (Date, User, Event, Setting, Changes, User agent),
// the setting named as the hub names it (its name, else its key in words), the value changes read «No → Yes» (never «Value:», never cut),
// any other attribute keeps «Name: old → new»; the detail dialog (stored values under «Technical details», «Find in Settings» only for a
// setting the project has); the complete cards under 768px; an error is said with «Try again», never drawn as a list.
// The controller is not rendered: the UI gets the lists and the spies as props.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({ phone: false, rtl: false, configs: {}, hub: null, enabled: [] }))

const mockModule = vi.hoisted(() => () => ({
  useLanguage: () => [{ language: { rtl: probe.rtl } }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: (value) => `date(${value})` }],
  useConfig: () => [{ configs: probe.configs }],
  SettingsLogs: () => null
}))
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)

// the hub the palette builds: the detail's «Find in Settings» asks the same catalog, only while a detail is open
vi.mock('../../../../../../components/CommandPalette/useSettingsCatalog', () => ({
  useSettingsCatalog: (options) => {
    probe.enabled.push(options?.enabled)
    return { status: probe.hub ? 'success' : 'loading', hub: probe.hub }
  }
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { SettingsLogsUI } from '../index'

const AGENT = 'Mozilla/5.0 (Macintosh)'
const AUTHOR = { name: 'QA', lastname: 'User', email: 'qa@example.invalid' }
const YES_NO = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]
const FACEBOOK = {
  id: 11,
  event: 'data_changed',
  data: [{ attribute: 'value', old: '0', new: '1' }],
  user_agent: AGENT,
  created_at: '2026-10-10 02:03:45',
  config: { name: 'Enable Facebook Login', key: 'facebook_login_enabled', type: 2, options: YES_NO },
  author: AUTHOR
}
const OLD_JSON = JSON.stringify({ message: 'old' })
const LONG_JSON = JSON.stringify({ message: 'z'.repeat(190) })
const RESERVATION = {
  id: 12,
  event: 'data_changed',
  data: [{ attribute: 'value', old: OLD_JSON, new: LONG_JSON }],
  user_agent: 'curl/8.0',
  created_at: '2026-10-09 09:00:00',
  config: { name: 'Reservation setting', key: 'reservation_setting', type: 1 },
  author: { name: 'Bo', lastname: 'Diaz', email: 'bo@example.invalid' }
}
const DATE_FACEBOOK = 'date(2026-10-10 02:03:45)'

let spies

const renderLogs = ({ logs = [FACEBOOK], loading = false, error = null, paginationProps, ...props } = {}) => renderWithProviders(
  <SettingsLogsUI
    logsList={{ logs, loading, error }}
    paginationProps={paginationProps ?? { currentPage: 1, pageSize: 10, totalItems: logs.length }}
    getSettingsLogs={spies.get}
    reload={spies.reload}
    {...props}
  />
)

beforeEach(() => {
  probe.phone = false
  probe.rtl = false
  probe.configs = {}
  probe.hub = null
  probe.enabled = []
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse = vi.fn()
  spies = { get: vi.fn(), reload: vi.fn() }
})

describe('SettingsLogsUI · the page header', () => {
  it('has the page title as its h1', () => {
    renderLogs()
    expect(screen.getByRole('heading', { level: 1, name: 'Settings logs' })).toBeInTheDocument()
  })

  it('shows the number of changes with its label', () => {
    const logs = Array.from({ length: 10 }, (_, index) => ({ ...FACEBOOK, id: 100 + index }))
    const { container } = renderLogs({ logs, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 532 } })
    expect(screen.getByText('532 changes')).toBeInTheDocument()
    expect(container.querySelector('.odc-pagehead-count')).toHaveTextContent('532')
  })

  it('says «1 change» for a single change', () => {
    renderLogs()
    expect(screen.getByText('1 change')).toBeInTheDocument()
    expect(screen.queryByText('1 changes')).toBeNull()
  })

  it('shows no count while the first page loads (the totals are not known yet)', () => {
    const { container } = renderLogs({ logs: [], loading: true, paginationProps: { currentPage: 1, pageSize: 10, totalItems: null } })
    expect(container.querySelector('.odc-pagehead-count')).toBeNull()
    expect(screen.queryByText(/changes?$/)).toBeNull()
  })

  it('shows no count on an error, even when the controller kept the totals of the last good page', () => {
    const { container } = renderLogs({ logs: [], error: 'Boom', paginationProps: { currentPage: 1, pageSize: 10, totalItems: 532 } })
    expect(container.querySelector('.odc-pagehead-count')).toBeNull()
    expect(screen.queryByText('532 changes')).toBeNull()
  })

  it('has no «Open menu» button while the sidebar is open', () => {
    renderLogs()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it('has an «Open menu» button when the sidebar is collapsed, and it opens it', async () => {
    const user = userEvent.setup()
    infoShare.isCollapse = true
    renderLogs()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledTimes(1)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  // the opener is PageHeader's `leading`, the first child of the lead block (before the title)
  it('puts the «Open menu» button in the page header lead block, as its first child', () => {
    infoShare.isCollapse = true
    const { container } = renderLogs()
    const button = screen.getByRole('button', { name: 'Open menu' })
    expect(button.closest('.odc-pagehead-lead')?.firstElementChild).toBe(button)
    expect(container.querySelector('.odc-cl-head')).toBeNull()
  })
})

describe('SettingsLogsUI · the table', () => {
  it('has Date, User, Event, Setting, Changes and User agent, in that order', () => {
    renderLogs()
    expect(screen.getByRole('table', { name: 'Settings logs' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual([
      'Date', 'User', 'Event', 'Setting', 'Changes', 'User agent'
    ])
  })

  it('draws the date, the person, the event, the setting, the change and the agent of a log', () => {
    renderLogs()
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByRole('rowheader', { name: DATE_FACEBOOK })).toBeInTheDocument()
    expect(within(row).getByText('QA User')).toBeInTheDocument()
    expect(within(row).getByText('qa@example.invalid')).toBeInTheDocument()
    expect(within(row).getByText('Data changed')).toBeInTheDocument()
    expect(within(row).getByText('Enable Facebook Login')).toBeInTheDocument()
    expect(within(row).getByText('No → Yes')).toBeInTheDocument()
    expect(within(row).getByText(AGENT)).toBeInTheDocument()
  })

  it('reads the setting by its key in words when its name is empty', () => {
    renderLogs({ logs: [{ ...FACEBOOK, config: { ...FACEBOOK.config, name: '' } }] })
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('Facebook login enabled')).toBeInTheDocument()
    expect(within(row).queryByText('facebook_login_enabled')).toBeNull()
  })

  // a setting the hub names with the decision 32 map reads the same in the logs, not with the API name
  it('names a mapped setting as the hub does, not with the API name', () => {
    const EXPIRY = { ...FACEBOOK, id: 14, config: { name: 'Set Expiry for Shared Order Details', key: 'guest_uuid_max_days', type: 1 } }
    const { container } = renderLogs({ logs: [EXPIRY] })
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getAllByText('Set expiry for shared order details').length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/Set Expiry for Shared Order Details/)
  })

  it('names the sides of a change of the value as the hub does: no «Value:» prefix and no «Vlue»', () => {
    const { container } = renderLogs({ logs: [FACEBOOK, { ...FACEBOOK, id: 13, data: [{ attribute: 'value', old: '1', new: '0' }] }] })
    expect(screen.getByText('No → Yes')).toBeInTheDocument()
    expect(screen.getByText('Yes → No')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Value:|Vlue/)
  })

  it('does not cut a long value: the list of changes has no clamp', () => {
    renderLogs({ logs: [FACEBOOK, RESERVATION] })
    const line = screen.getByText(`${OLD_JSON} → ${LONG_JSON}`)
    expect(line.closest('ul.odc-cl-changes')).not.toBeNull()
    expect(line.closest('ul.odc-cl-changes')).not.toHaveAttribute('data-clamp')
    for (const list of document.querySelectorAll('ul.odc-cl-changes')) expect(list).not.toHaveAttribute('data-clamp')
  })

  it('says «None» for an empty side and keeps a setting without options as stored', () => {
    renderLogs({ logs: [{ ...RESERVATION, data: [{ attribute: 'value', old: null, new: 'on' }] }] })
    expect(screen.getByText('None → on')).toBeInTheDocument()
  })

  it('keeps «Name: old → new» for an attribute that is not the value', () => {
    renderLogs({ logs: [{ ...FACEBOOK, data: [{ attribute: 'enabled', old: false, new: true }] }] })
    expect(screen.getByText('Enabled: false → true')).toBeInTheDocument()
  })

  it('draws one line per change when a log changes the value and another attribute', () => {
    renderLogs({ logs: [{ ...FACEBOOK, data: [{ attribute: 'value', old: '0', new: '1' }, { attribute: 'enabled', old: false, new: true }] }] })
    expect(screen.getByText('No → Yes')).toBeInTheDocument()
    expect(screen.getByText('Enabled: false → true')).toBeInTheDocument()
  })

  it('says the empty state when there are no changes (no error)', () => {
    renderLogs({ logs: [] })
    expect(screen.getByText('No settings changes yet')).toBeInTheDocument()
    expect(screen.getByText('Changes made to the project settings will appear here.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('asks the controller for the next page with the page size', async () => {
    const user = userEvent.setup()
    const logs = Array.from({ length: 10 }, (_, index) => ({ ...FACEBOOK, id: 100 + index }))
    renderLogs({ logs, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 25 } })
    await user.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('button', { name: 'Next page' }))
    expect(spies.get).toHaveBeenCalledTimes(1)
    expect(spies.get).toHaveBeenCalledWith(2, 10)
  })
})

describe('SettingsLogsUI · the detail', () => {
  const openFirst = async (user) => {
    await user.click(screen.getByText('qa@example.invalid'))
    // redesign bugs F row 37: the dialog is titled with the event; the date shows once, in the timeline
    return screen.findByRole('dialog', { name: 'Data changed' })
  }

  it('opens a dialog with the event, the setting, the change in words and who did it', async () => {
    const user = userEvent.setup()
    renderLogs()
    expect(screen.queryByRole('dialog')).toBeNull()
    const dialog = await openFirst(user)
    const timeline = within(dialog).getByRole('list', { name: 'Change details' })
    expect(within(timeline).queryByText('Data changed')).toBeNull() // the event is the dialog title; the timeline does not repeat it (row 13)
    expect(within(timeline).getByText('Enable Facebook Login')).toBeInTheDocument()
    expect(within(timeline).getByText('No → Yes')).toBeInTheDocument()
    expect(within(timeline).getByText('QA User · qa@example.invalid')).toBeInTheDocument()
  })

  it('folds the user agent and the stored values in «Technical details»', async () => {
    const user = userEvent.setup()
    renderLogs()
    const dialog = await openFirst(user)
    const fold = within(dialog).getByText(AGENT).closest('details')
    expect(fold).not.toBeNull()
    expect(fold).not.toHaveAttribute('open')
    expect(within(fold).getByText('Technical details')).toBeInTheDocument()
    expect(fold.querySelector('.odc-cl-raw')).toHaveTextContent('Stored value: 0 → 1')
  })

  it('has no stored value for a log that does not change the value', async () => {
    const user = userEvent.setup()
    renderLogs({ logs: [{ ...FACEBOOK, data: [{ attribute: 'enabled', old: false, new: true }] }] })
    const dialog = await openFirst(user)
    expect(within(dialog).queryByText(/Stored value/)).toBeNull()
  })

  it('links to the hub search for the setting while the hub location is not known yet', async () => {
    const user = userEvent.setup()
    probe.configs = { facebook_login_enabled: { key: 'facebook_login_enabled', value: '1' } }
    renderLogs()
    const dialog = await openFirst(user)
    // a real link (role link: middle click, open in a new tab) with P/Button's look
    const link = within(dialog).getByRole('link', { name: 'Find in Settings' })
    expect(link).toHaveAttribute('href', '/settings?q=facebook_login_enabled')
    expect(link).not.toHaveAttribute('role')
    expect(link).toHaveClass('odc-btn')
  })

  // row 85 (Q-03): the field's own location, as the ⌘K palette builds it (group + category + focus)
  it('links straight to the field when the hub knows its group and category', async () => {
    const user = userEvent.setup()
    probe.configs = { facebook_login_enabled: { key: 'facebook_login_enabled', value: '1' } }
    probe.hub = [{ key: 'platform', sections: [{ key: 'social', category: { configs: [{ key: 'facebook_login_enabled' }] } }] }]
    renderLogs()
    const dialog = await openFirst(user)
    const link = within(dialog).getByRole('link', { name: 'Find in Settings' })
    expect(link).toHaveAttribute('href', '/settings?group=platform&category=social&focus=facebook_login_enabled')
    expect(link).toHaveClass('odc-btn')
  })

  it('keeps the hub search when the hub has no location for the key', async () => {
    const user = userEvent.setup()
    probe.configs = { facebook_login_enabled: { key: 'facebook_login_enabled', value: '1' } }
    probe.hub = [{ key: 'platform', sections: [{ key: 'social', category: { configs: [{ key: 'other_key' }] } }] }]
    renderLogs()
    const dialog = await openFirst(user)
    expect(within(dialog).getByRole('link', { name: 'Find in Settings' })).toHaveAttribute('href', '/settings?q=facebook_login_enabled')
  })

  it('asks the hub catalog only when a detail with «Find in Settings» is open', async () => {
    const user = userEvent.setup()
    probe.configs = { facebook_login_enabled: { key: 'facebook_login_enabled', value: '1' } }
    renderLogs()
    expect(probe.enabled).toEqual([])
    await openFirst(user)
    expect(probe.enabled.length).toBeGreaterThan(0)
    expect(probe.enabled.every(Boolean)).toBe(true)
  })

  it('has no «Find in Settings» when the project does not have the setting', async () => {
    const user = userEvent.setup()
    probe.configs = { another_setting: { key: 'another_setting', value: '1' } }
    renderLogs()
    const dialog = await openFirst(user)
    expect(within(dialog).queryByText('Find in Settings')).toBeNull()
    expect(screen.queryByText('Find in Settings')).toBeNull()
    expect(probe.enabled).toEqual([])
  })

  it('closes with the close button', async () => {
    const user = userEvent.setup()
    renderLogs()
    const dialog = await openFirst(user)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('SettingsLogsUI · cards under 768px', () => {
  const FIVE = {
    ...FACEBOOK,
    id: 14,
    data: [
      { attribute: 'value', old: '0', new: '1' },
      { attribute: 'enabled', old: false, new: true },
      { attribute: 'notes', old: 'a', new: 'b' },
      { attribute: 'gallery', old: 1, new: 2 },
      { attribute: 'zip', old: 3, new: 4 }
    ]
  }

  it('draws a card, not a table, with the setting as its title and everything the table said', () => {
    probe.phone = true
    renderLogs()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Settings logs' })
    expect(list.querySelectorAll(':scope > li')).toHaveLength(1)
    expect(within(list).getByText('Enable Facebook Login')).toBeInTheDocument()
    expect(within(list).getByText('Data changed')).toBeInTheDocument()
    expect(within(list).getByText('QA User')).toBeInTheDocument()
    expect(within(list).getByText('qa@example.invalid')).toBeInTheDocument()
    expect(within(list).getAllByText(DATE_FACEBOOK).length).toBeGreaterThan(0)
    expect(within(list).getByText('No → Yes')).toBeInTheDocument()
    expect(within(list).getByText(AGENT)).toBeInTheDocument()
  })

  it('carries every change whole: no «+N» even with five changes in one log', () => {
    probe.phone = true
    renderLogs({ logs: [FIVE] })
    const list = screen.getByRole('list', { name: 'Settings logs' })
    for (const line of ['No → Yes', 'Enabled: false → true', 'Notes: a → b', 'Gallery: 1 → 2', 'Zip: 3 → 4']) {
      expect(within(list).getByText(line)).toBeInTheDocument()
    }
    expect(within(list).queryByText(/^\+\d+$/)).toBeNull()
    for (const changes of list.querySelectorAll('ul.odc-cl-changes')) expect(changes).not.toHaveAttribute('data-clamp')
  })

  it('opens the same detail dialog from a card', async () => {
    const user = userEvent.setup()
    probe.phone = true
    renderLogs()
    await user.click(screen.getByRole('link', { name: /Enable Facebook Login/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(dialog.querySelector('.odc-cl-raw')).toHaveTextContent('Stored value: 0 → 1')
  })
})

describe('SettingsLogsUI · an error is not an empty list', () => {
  it('says its own text first, with the API detail under it and «Retry», and draws no table and no count', () => {
    const { container } = renderLogs({ logs: [], error: 'Forced', paginationProps: { currentPage: 1, pageSize: 10, totalItems: 532 } })
    const alert = screen.getByRole('alert')
    const title = within(alert).getByText('The settings changes could not be loaded.')
    const detail = within(alert).getByText('Forced')
    // the headline comes first; the API text is the secondary line under it
    expect(title.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(detail).toHaveClass('odc-sl-error-detail')
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Settings logs' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('No settings changes yet')).toBeNull()
    expect(container.querySelector('.odc-pagehead-count')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('«Retry» calls reload', async () => {
    const user = userEvent.setup()
    renderLogs({ logs: [], error: 'Boom' })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(spies.reload).toHaveBeenCalledTimes(1)
    expect(spies.get).not.toHaveBeenCalled()
  })

  it('says the headline alone when the error has no text of its own', () => {
    renderLogs({ logs: [], error: true })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('The settings changes could not be loaded.')).toBeInTheDocument()
    expect(alert.querySelector('.odc-sl-error-detail')).toBeNull()
  })

  it('does not repeat the headline as the detail when the API says the same', () => {
    renderLogs({ logs: [], error: 'The settings changes could not be loaded.' })
    expect(within(screen.getByRole('alert')).getAllByText('The settings changes could not be loaded.')).toHaveLength(1)
  })

  it('puts the focus back on «Retry» when a retry fails again', async () => {
    const user = userEvent.setup()
    const logsList = (state) => ({ logs: [], loading: false, error: null, ...state })
    const view = (state) => (
      <SettingsLogsUI logsList={logsList(state)} paginationProps={{ currentPage: 1, pageSize: 10, totalItems: null }} getSettingsLogs={spies.get} reload={spies.reload} />
    )
    const { rerender } = renderWithProviders(view({ error: 'Boom' }))
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    rerender(view({ loading: true }))
    rerender(view({ error: 'Boom' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus())
  })
})

describe('SettingsLogsUI · the arrow of a change reads from the old value to the new one', () => {
  const FSI = '\u2068'
  const PDI = '\u2069'
  const RLM = '\u200F'

  const TWO_CHANGES = {
    ...FACEBOOK,
    data: [
      { attribute: 'value', old: '0', new: '1' },
      { attribute: 'enabled', old: 'false', new: 'true' }
    ]
  }

  it('keeps «old → new» in a left-to-right language', () => {
    renderLogs({ logs: [TWO_CHANGES] })
    expect(screen.getByText('No → Yes')).toBeInTheDocument()
    expect(screen.getByText('Enabled: false → true')).toBeInTheDocument()
  })

  it('points left in a right-to-left language, with each value isolated and the line read right to left', () => {
    probe.rtl = true
    renderLogs({ logs: [TWO_CHANGES] })
    const texts = [...document.querySelectorAll('.odc-cl-change-text')].map(node => node.textContent)
    expect(texts).toContain(`${RLM}${FSI}No${PDI} ← ${FSI}Yes${PDI}`)
    expect(texts).toContain(`${RLM}Enabled: ${FSI}false${PDI} ← ${FSI}true${PDI}`)
    expect(texts.some(text => text.includes('→'))).toBe(false)
  })

  it('keeps the stored values as technical text, each one isolated, on a left-to-right line', async () => {
    probe.rtl = true
    const user = userEvent.setup()
    renderLogs()
    await user.click(screen.getByText('qa@example.invalid'))
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    const raw = dialog.querySelector('.odc-cl-raw')
    expect(raw).toHaveAttribute('dir', 'ltr')
    expect(raw).toHaveTextContent('Stored value: 0 → 1')
    expect(raw.querySelectorAll('bdi')).toHaveLength(2)
  })
})

// the filter bar, the filtered empty state and the address (?page= ?id= and the filters).
describe('SettingsLogsUI · filters and the address', () => {
  const NO_FILTERS = { configIds: [], authorIds: [], from: null, to: null }
  const CONFIGS = {
    facebook_login_enabled: { id: 851, key: 'facebook_login_enabled', name: 'Enable Facebook Login' },
    reservation_setting: { id: 852, key: 'reservation_setting', name: 'Reservation setting' }
  }
  const search = () => Object.fromEntries(new URLSearchParams(window.location.search))
  const renderFiltered = (props = {}) => renderLogs({
    filters: NO_FILTERS,
    changeFilters: spies.change,
    authorsList: { users: [{ id: 7, name: 'Ana', lastname: 'Diaz', email: 'ana@example.invalid' }], loading: false },
    ...props
  })

  beforeEach(() => {
    probe.configs = CONFIGS
    spies.change = vi.fn()
    spies.find = vi.fn()
    window.history.replaceState(null, '', '/settings/logs')
  })

  it('on load, the address keeps only the filters the list applies', () => {
    window.history.replaceState(null, '', '/settings/logs?page=3&author=7&from=2026-10-01&to=2026-10-02&config=851,852&id=11')
    // the filters the controller kept: one setting, no user, no days
    renderFiltered({ syncUrl: true, filters: { ...NO_FILTERS, configIds: [851] } })
    expect(search()).toEqual({ page: '3', id: '11', config: '851' })
  })

  it('offers the setting, the user and the date', () => {
    renderFiltered()
    expect(screen.getByRole('button', { name: /^Setting/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^User/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Date/ })).toBeInTheDocument()
  })

  it('a filter is a chip with the setting\'s name that removes it alone', async () => {
    const user = userEvent.setup()
    renderFiltered({ filters: { ...NO_FILTERS, configIds: [851], authorIds: [7] } })
    await user.click(screen.getByRole('button', { name: 'Remove Setting Enable Facebook Login filter' }))
    expect(spies.change).toHaveBeenLastCalledWith({ ...NO_FILTERS, authorIds: [7] })
  })

  it('filtered and empty says so, and «Clear filters» clears them all and the address', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/settings/logs?config=851&author=7&page=2')
    renderFiltered({ syncUrl: true, logs: [], paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0 }, filters: { ...NO_FILTERS, configIds: [851] } })
    const empty = screen.getByText('No changes match these filters').closest('.odc-state')
    await user.click(within(empty).getByRole('button', { name: 'Clear filters' }))
    expect(spies.change).toHaveBeenLastCalledWith(NO_FILTERS)
    expect(window.location.search).toBe('')
  })

  it('unfiltered and empty keeps its own sentence, with no action', () => {
    renderFiltered({ logs: [], paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0 } })
    expect(screen.getByText('No settings changes yet')).toBeInTheDocument()
  })

  it('a failure keeps the filters on screen, so they can be cleared', () => {
    renderFiltered({ logs: [], error: 'Boom', filters: { ...NO_FILTERS, configIds: [851] } })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Setting Enable Facebook Login filter' })).toBeInTheDocument()
  })

  it('a page change writes ?page= and ?pageSize=', async () => {
    const user = userEvent.setup()
    const logs = Array.from({ length: 10 }, (_, index) => ({ ...FACEBOOK, id: 100 + index }))
    renderFiltered({ syncUrl: true, logs, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 25 } })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(spies.get).toHaveBeenLastCalledWith(2, 10)
    expect(search()).toMatchObject({ page: '2', pageSize: '10' })
  })

  it('opening and closing a log writes and removes ?id=', async () => {
    const user = userEvent.setup()
    renderFiltered({ syncUrl: true })
    await user.click(screen.getAllByText('qa@example.invalid')[0])
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(search()).toEqual({ id: '11' })
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(window.location.search).toBe('')
  })

  it('?id= of a log on the page opens it without asking the API', async () => {
    renderFiltered({ syncUrl: true, initialLogId: 11, getSettingsLog: spies.find })
    expect(await screen.findByRole('dialog', { name: 'Data changed' })).toBeInTheDocument()
    expect(spies.find).not.toHaveBeenCalled()
  })

  it('?id= of a log on another page asks the API for it and opens it', async () => {
    spies.find.mockResolvedValue({ ...RESERVATION, id: 541 })
    renderFiltered({ syncUrl: true, initialLogId: 541, getSettingsLog: spies.find })
    const dialog = await screen.findByRole('dialog', { name: 'Data changed' })
    expect(spies.find).toHaveBeenCalledWith(541)
    expect(within(dialog).getByText('bo@example.invalid', { exact: false })).toBeInTheDocument()
  })

  it('?id= of a log that cannot be found leaves the address', async () => {
    window.history.replaceState(null, '', '/settings/logs?page=2&id=541')
    spies.find.mockResolvedValue(null)
    renderFiltered({ syncUrl: true, initialLogId: 541, getSettingsLog: spies.find })
    await waitFor(() => expect(search()).toEqual({ page: '2' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('waits for the list before looking for ?id=', () => {
    renderFiltered({ syncUrl: true, initialLogId: 541, getSettingsLog: spies.find, logs: [], loading: true })
    expect(spies.find).not.toHaveBeenCalled()
  })
})
