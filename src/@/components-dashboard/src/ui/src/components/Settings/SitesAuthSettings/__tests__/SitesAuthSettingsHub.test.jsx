/* eslint-disable import/first */
// n.1 (D-56 a, settings P-6): «Sites» inside the Settings hub (SettingsHubFormContext provider) keeps every change
// pending in the screen and stores it from the shared save bar (one PUT per changed field, in sequence). Without the provider it
// is the screen of today: one PUT per keystroke. The real controller drives the real UI; only `fetch` and the contexts are replaced.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), session: [{ loading: false, token: 'token' }] }))

const translate = (key, fallback) => fallback ?? key

vi.mock('../../../../../../index', async () => {
  const { SitesAuthSettings } = await import('../../../../../../components/SitesAuthSettings')
  return {
    useLanguage: () => [{ dictionary: {} }, translate],
    useSession: () => mocks.session,
    SitesAuthSettings
  }
})

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, translate] }))

vi.mock('../../../Shared', () => ({
  Alert: ({ content, open }) => open
    ? <div role='alertdialog' data-testid='legacy-alert'>{(Array.isArray(content) ? content : [content]).filter(Boolean).join(' ')}</div>
    : null,
  NotFoundSource: ({ content }) => <div>{content}</div>
}))

import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { SitesAuthSettings } from '../index'

const configsOf = (siteId) => [
  { id: siteId * 100 + 1, key: 'site_title', name: `Site title ${siteId}`, type: 1, value: 'Old title', rank: 1, config_category_id: 1, config_category: { name: 'General', rank: 1 } },
  { id: siteId * 100 + 2, key: 'login_mode', name: `Login mode ${siteId}`, type: 2, value: 'email', rank: 2, config_category_id: 1, config_category: { name: 'General', rank: 1 }, options: [{ text: 'email', value: 'email' }, { text: 'phone', value: 'phone' }] },
  { id: siteId * 100 + 3, key: 'api_secret', name: `API secret ${siteId}`, type: 7, value: 'secret-1', rank: 3, config_category_id: 2, config_category: { name: 'Keys', rank: 2 } }
]

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

// the PUTs of the test: `puts` is every {url, body}; `failUrl` makes that PUT answer with an API error
const setupFetch = ({ failUrl = null } = {}) => {
  const puts = []
  const fetchMock = vi.fn((url, options = {}) => {
    if (options.method === 'PUT') {
      puts.push({ url, body: JSON.parse(options.body) })
      if (failUrl && url.endsWith(failUrl)) return json({ error: true, result: ['Value not allowed'] })
      return json({ error: false, result: { ok: true } })
    }
    if (url.includes('/sites/1/configs')) return json({ error: false, result: configsOf(1) })
    if (url.includes('/sites/2/configs')) return json({ error: false, result: configsOf(2) })
    return json({ error: false, result: [{ id: 1, name: 'Main site' }, { id: 2, name: 'Second site' }] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { puts, fetchMock }
}

const renderSites = async ({ report = vi.fn(), hub } = {}) => {
  const hubValue = hub === undefined ? { product: true, report } : hub
  const view = renderWithProviders(
    <SettingsHubFormContext.Provider value={hubValue}>
      <SitesAuthSettings avoidExpand />
    </SettingsHubFormContext.Provider>,
    { initialEntries: ['/settings?category=sites&site=1'] }
  )
  await screen.findByDisplayValue('Old title')
  return { ...view, report }
}

const barOf = () => screen.queryByRole('group', { name: 'Save changes' })
// the site picker is the Product select (a combobox named by its «Site» label and the open site)
const sitePicker = () => screen.getByRole('combobox', { name: /^Site/ })
// a type 2 config of the site is the Product select too
const loginMode = () => screen.getByRole('combobox', { name: /Login mode 1/ })
const titleInput = () => screen.getByPlaceholderText('Site title 1')
const secretInput = () => screen.getByPlaceholderText('API secret 1')

beforeEach(() => {
  mocks.showToast.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Sites inside the hub', () => {
  it('typing sends nothing and draws the bar with the count and the name of the field', async () => {
    const { puts } = setupFetch()
    await renderSites()
    expect(barOf()).toBeNull()

    await userEvent.type(titleInput(), 'abc')

    expect(puts).toHaveLength(0)
    expect(barOf()).toBeInTheDocument()
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Site title 1/)).toBeInTheDocument()

    await userEvent.type(secretInput(), 'x')
    expect(puts).toHaveLength(0)
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Site title 1, API secret 1/)).toBeInTheDocument()
  })

  it('a value put back to the stored one stops counting', async () => {
    setupFetch()
    await renderSites()
    await userEvent.type(titleInput(), 'x')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    await userEvent.type(titleInput(), '{backspace}')
    expect(barOf()).toBeNull()
  })

  it('a select change is pending too, and Save changes sends one PUT per changed field with {value}, then the bar goes', async () => {
    const { puts } = setupFetch()
    await renderSites()
    await userEvent.type(titleInput(), ' new')
    await userEvent.click(loginMode())
    await userEvent.click(await screen.findByRole('option', { name: 'Phone' }))
    expect(puts).toHaveLength(0)
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
    // the picked option stays on screen while it is pending (it does not snap back to the stored one)
    expect(loginMode()).toHaveTextContent('Phone')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts).toEqual([
      { url: 'https://api.test/sites/1/configs/101', body: { value: 'Old title new' } },
      { url: 'https://api.test/sites/1/configs/102', body: { value: 'phone' } }
    ])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
    expect(screen.queryByText(/unsaved change/)).toBeNull()
    // one «Loading» and one «Settings updated» for the whole batch, not one pair per PUT
    expect(mocks.showToast.mock.calls.filter(([type]) => type === 'success')).toHaveLength(1)
    expect(mocks.showToast.mock.calls.filter(([type]) => type === 'info')).toHaveLength(1)
  })

  it('what was stored is the new base: a later edit back to the old value counts again', async () => {
    const { puts } = setupFetch()
    await renderSites()
    await userEvent.type(titleInput(), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))

    await userEvent.type(titleInput(), '{backspace}')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('a failed PUT stops the batch, the bar says why and what was not stored stays pending', async () => {
    const { puts } = setupFetch({ failUrl: '/configs/103' })
    await renderSites()
    await userEvent.type(titleInput(), '!')
    await userEvent.type(secretInput(), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('Saved 1 of 2. API secret 1 failed: Value not allowed')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(puts.map(put => put.url)).toEqual([
      'https://api.test/sites/1/configs/101',
      'https://api.test/sites/1/configs/103'
    ])
    expect(screen.queryByTestId('legacy-alert')).toBeNull()
  })

  // review r1 (R-1): applying what was stored re-draws the detail; a select that was not stored kept showing the stored value
  it('after a partial failure, a select that was not stored still shows the pending value', async () => {
    const { puts } = setupFetch({ failUrl: '/configs/102' })
    await renderSites()
    await userEvent.type(titleInput(), '!')
    await userEvent.click(loginMode())
    await userEvent.click(await screen.findByRole('option', { name: 'Phone' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await within(barOf()).findByRole('alert')
    expect(puts).toHaveLength(2)
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(loginMode()).toHaveTextContent('Phone')
    expect(loginMode()).not.toHaveTextContent('Email')
  })

  it('a failure of the first PUT is an API error with nothing stored', async () => {
    setupFetch({ failUrl: '/configs/101' })
    await renderSites()
    await userEvent.type(titleInput(), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('We couldn\'t save your changes. Value not allowed')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('Discard gives the inputs their stored values back and removes the bar', async () => {
    const { puts } = setupFetch()
    await renderSites()
    await userEvent.type(titleInput(), ' typed')
    await userEvent.click(loginMode())
    await userEvent.click(await screen.findByRole('option', { name: 'Phone' }))

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(barOf()).toBeNull()
    expect(titleInput()).toHaveValue('Old title')
    expect(loginMode()).toHaveTextContent('Email')
    expect(puts).toHaveLength(0)
  })

  it('tells the hub the dirty and saving state of «sites» and drops the report on unmount', async () => {
    setupFetch()
    const report = vi.fn()
    const view = await renderSites({ report })
    expect(report).toHaveBeenLastCalledWith('sites', { dirty: false, saving: false })

    await userEvent.type(titleInput(), 'x')
    expect(report).toHaveBeenLastCalledWith('sites', { dirty: true, saving: false })

    view.unmount()
    expect(report).toHaveBeenLastCalledWith('sites', null)
  })

  it('changing the site with pending changes asks first: Keep editing stays, Discard drops them and goes', async () => {
    setupFetch()
    await renderSites()
    await userEvent.type(titleInput(), 'x')

    await userEvent.click(sitePicker())
    await userEvent.click(await screen.findByRole('option', { name: 'Second site' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    expect(within(dialog).getByText('You have unsaved changes in Main site. If you leave, they are lost.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    // review r1 (R-2): the focus goes back to the site selector, not to <body>
    await waitFor(() => expect(sitePicker()).toHaveFocus())
    expect(sitePicker()).toHaveTextContent('Main site')
    expect(titleInput()).toHaveValue('Old titlex')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

    await userEvent.click(sitePicker())
    await userEvent.click(await screen.findByRole('option', { name: 'Second site' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))

    expect(await screen.findByPlaceholderText('Site title 2')).toHaveValue('Old title')
    expect(barOf()).toBeNull()
  })

  it('changing the site with nothing pending does not ask', async () => {
    setupFetch()
    await renderSites()
    await userEvent.click(sitePicker())
    await userEvent.click(await screen.findByRole('option', { name: 'Second site' }))
    expect(await screen.findByPlaceholderText('Site title 2')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('stays mounted, inert and busy while saving', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const { fetchMock } = setupFetch()
    const base = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options = {}) => options.method === 'PUT' ? gate.then(() => json({ error: false, result: {} })) : base(url, options))
    const view = await renderSites()
    await userEvent.type(titleInput(), 'x')
    const input = titleInput()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const form = view.container.querySelector('.odc-hub-form')
    await waitFor(() => expect(form).toHaveAttribute('inert'))
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(titleInput()).toBe(input)

    await act(async () => { release() })
    await waitFor(() => expect(form).not.toHaveAttribute('inert'))
  })
})

describe('Sites without the hub', () => {
  it('sends one PUT per keystroke and draws no bar, as today', async () => {
    const { puts } = setupFetch()
    await renderSites({ hub: null })

    await userEvent.type(titleInput(), 'ab')

    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[0]).toEqual({ url: 'https://api.test/sites/1/configs/101', body: { value: 'Old titlea' } })
    expect(puts[1]).toEqual({ url: 'https://api.test/sites/1/configs/101', body: { value: 'Old titleab' } })
    expect(barOf()).toBeNull()
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })
})
