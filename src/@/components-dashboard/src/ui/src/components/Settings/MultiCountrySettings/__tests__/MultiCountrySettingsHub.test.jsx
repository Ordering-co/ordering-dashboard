/* eslint-disable import/first */
// n.1 (D-56 a, settings P-6): «MultiCountry» inside the Settings hub (SettingsHubFormContext provider) keeps every change
// of the open country pending in the screen and stores it from the shared save bar (one PUT per changed field, in sequence).
// Without the provider it is the screen of today: one PUT per keystroke. The real controller drives the real UI; only `fetch`,
// the contexts and the SideBar shell (its close button) are replaced.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// the session is one stable value: the legacy Select re-renders on every new one
const mocks = vi.hoisted(() => ({ showToast: vi.fn(), session: [{ loading: false, token: 'token' }] }))

const translate = (key, fallback) => fallback ?? key

vi.mock('../../../../../../index', async () => {
  const { MultiCountrySettings } = await import('../../../../../../components/MultiCountrySettings')
  return {
    useLanguage: () => [{ dictionary: {} }, translate],
    useSession: () => mocks.session, // read by the legacy Select
    MultiCountrySettings
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
  NotFoundSource: ({ content }) => <div>{content}</div>,
  SideBar: ({ children, onClose }) => (
    <aside data-testid='side-bar'>
      <button type='button' onClick={onClose}>Close side bar</button>
      {children}
    </aside>
  )
}))

import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { MultiCountrySettings } from '../index'

const configsOf = (countryId) => [
  { id: countryId * 100 + 1, key: 'tax_name', name: `Tax name ${countryId}`, type: 1, value: 'VAT' },
  { id: countryId * 100 + 2, key: 'currency_mode', name: `Currency mode ${countryId}`, type: 2, value: 'local', options: [{ text: 'local', value: 'local' }, { text: 'global', value: 'global' }] },
  { id: countryId * 100 + 3, key: 'tax_key', name: `Tax key ${countryId}`, type: 7, value: 'k-1' }
]

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const setupFetch = ({ failUrl = null } = {}) => {
  const puts = []
  const fetchMock = vi.fn((url, options = {}) => {
    if (options.method === 'PUT') {
      puts.push({ url, body: JSON.parse(options.body) })
      if (failUrl && url.endsWith(failUrl)) return json({ error: true, result: ['Value not allowed'] })
      return json({ error: false, result: { ok: true } })
    }
    if (url.includes('/countries/1/configs')) return json({ error: false, result: configsOf(1) })
    if (url.includes('/countries/2/configs')) return json({ error: false, result: configsOf(2) })
    return json({ error: false, result: [{ id: 1, name: 'Mexico', enabled: true }, { id: 2, name: 'Chile', enabled: true }] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { puts, fetchMock }
}

const renderCountries = async ({ report = vi.fn(), hub } = {}) => {
  const hubValue = hub === undefined ? { product: true, report } : hub
  const view = renderWithProviders(
    <SettingsHubFormContext.Provider value={hubValue}>
      <MultiCountrySettings />
    </SettingsHubFormContext.Provider>
  )
  await userEvent.click(await screen.findByText('Mexico'))
  await screen.findByDisplayValue('VAT')
  return { ...view, report }
}

const barOf = () => screen.queryByRole('group', { name: 'Save changes' })
const taxInput = () => screen.getByPlaceholderText('Tax name 1')
const keyInput = () => screen.getByPlaceholderText('Tax key 1')

beforeEach(() => {
  mocks.showToast.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MultiCountry inside the hub', () => {
  it('typing sends nothing and draws the bar with the count and the name of the field', async () => {
    const { puts } = setupFetch()
    await renderCountries()
    expect(barOf()).toBeNull()

    await userEvent.type(taxInput(), 'abc')

    expect(puts).toHaveLength(0)
    expect(barOf()).toBeInTheDocument()
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Tax name 1/)).toBeInTheDocument()

    await userEvent.type(keyInput(), 'x')
    expect(puts).toHaveLength(0)
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Tax name 1, Tax key 1/)).toBeInTheDocument()
  })

  it('a value put back to the stored one stops counting', async () => {
    setupFetch()
    await renderCountries()
    await userEvent.type(taxInput(), 'x')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    await userEvent.type(taxInput(), '{backspace}')
    expect(barOf()).toBeNull()
  })

  it('a select change is pending too, and Save changes sends one PUT per changed field with {value}, then the bar goes', async () => {
    const { puts } = setupFetch()
    await renderCountries()
    await userEvent.type(taxInput(), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Local' }))
    await userEvent.click(await screen.findByText('Global'))
    expect(puts).toHaveLength(0)
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
    // the picked option stays on screen while it is pending (it does not snap back to the stored one)
    expect(screen.getByRole('button', { name: 'Global' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts).toEqual([
      { url: 'https://api.test/countries/1/configs/101', body: { value: 'VAT2' } },
      { url: 'https://api.test/countries/1/configs/102', body: { value: 'global' } }
    ])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
    expect(screen.queryByText(/unsaved change/)).toBeNull()
    expect(mocks.showToast.mock.calls.filter(([type]) => type === 'success')).toHaveLength(1)
    expect(mocks.showToast.mock.calls.filter(([type]) => type === 'info')).toHaveLength(1)
  })

  it('what was stored is the new base: a later edit back to the old value counts again', async () => {
    const { puts } = setupFetch()
    await renderCountries()
    await userEvent.type(taxInput(), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))

    await userEvent.type(taxInput(), '{backspace}')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('a failed PUT stops the batch, the bar says why and what was not stored stays pending', async () => {
    const { puts } = setupFetch({ failUrl: '/configs/103' })
    await renderCountries()
    await userEvent.type(taxInput(), '!')
    await userEvent.type(keyInput(), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('Saved 1 of 2. Tax key 1 failed: Value not allowed')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(puts.map(put => put.url)).toEqual([
      'https://api.test/countries/1/configs/101',
      'https://api.test/countries/1/configs/103'
    ])
    expect(screen.queryByTestId('legacy-alert')).toBeNull()
  })

  // review r1 (R-1): applying what was stored re-draws the detail; a select that was not stored kept showing the stored value
  it('after a partial failure, a select that was not stored still shows the pending value', async () => {
    const { puts } = setupFetch({ failUrl: '/configs/102' })
    await renderCountries()
    await userEvent.type(taxInput(), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Local' }))
    await userEvent.click(await screen.findByText('Global'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await within(barOf()).findByRole('alert')
    expect(puts).toHaveLength(2)
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Global' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Local' })).toBeNull()
  })

  it('a failure of the first PUT is an API error with nothing stored', async () => {
    setupFetch({ failUrl: '/configs/101' })
    await renderCountries()
    await userEvent.type(taxInput(), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('We couldn\'t save your changes. Value not allowed')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('Discard gives the inputs their stored values back and removes the bar', async () => {
    const { puts } = setupFetch()
    await renderCountries()
    await userEvent.type(taxInput(), ' typed')
    await userEvent.click(screen.getByRole('button', { name: 'Local' }))
    await userEvent.click(await screen.findByText('Global'))

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(barOf()).toBeNull()
    expect(taxInput()).toHaveValue('VAT')
    expect(screen.getByRole('button', { name: 'Local' })).toBeInTheDocument()
    expect(puts).toHaveLength(0)
  })

  it('tells the hub the dirty and saving state of «multi_country» and drops the report on unmount', async () => {
    setupFetch()
    const report = vi.fn()
    const view = await renderCountries({ report })
    expect(report).toHaveBeenLastCalledWith('multi_country', { dirty: false, saving: false })

    await userEvent.type(taxInput(), 'x')
    expect(report).toHaveBeenLastCalledWith('multi_country', { dirty: true, saving: false })

    view.unmount()
    expect(report).toHaveBeenLastCalledWith('multi_country', null)
  })

  it('opening another country with pending changes asks first: Keep editing stays, Discard drops them and goes', async () => {
    setupFetch()
    await renderCountries()
    await userEvent.type(taxInput(), 'x')

    await userEvent.click(screen.getByText('Chile'))

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(within(dialog).getByText('You have unsaved changes in Mexico. If you leave, they are lost.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(taxInput()).toHaveValue('VATx')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Chile'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))

    expect(await screen.findByPlaceholderText('Tax name 2')).toHaveValue('VAT')
    expect(barOf()).toBeNull()
  })

  it('closing the side bar with pending changes asks first: Keep editing keeps it open, Discard closes it', async () => {
    setupFetch()
    await renderCountries()
    await userEvent.type(taxInput(), 'x')

    await userEvent.click(screen.getByRole('button', { name: 'Close side bar' }))
    let dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('side-bar')).toBeInTheDocument()
    expect(taxInput()).toHaveValue('VATx')

    await userEvent.click(screen.getByRole('button', { name: 'Close side bar' }))
    dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByTestId('side-bar')).toBeNull())
    expect(barOf()).toBeNull()
  })

  it('closing the side bar or changing country with nothing pending does not ask', async () => {
    setupFetch()
    await renderCountries()
    await userEvent.click(screen.getByText('Chile'))
    expect(await screen.findByPlaceholderText('Tax name 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close side bar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByTestId('side-bar')).toBeNull()
  })

  it('stays mounted, inert and busy while saving', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const { fetchMock } = setupFetch()
    const base = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options = {}) => options.method === 'PUT' ? gate.then(() => json({ error: false, result: {} })) : base(url, options))
    const view = await renderCountries()
    await userEvent.type(taxInput(), 'x')
    const input = taxInput()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const form = view.container.ownerDocument.querySelector('.odc-hub-form')
    await waitFor(() => expect(form).toHaveAttribute('inert'))
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(taxInput()).toBe(input)

    await act(async () => { release() })
    await waitFor(() => expect(form).not.toHaveAttribute('inert'))
  })
})

describe('MultiCountry without the hub', () => {
  it('sends one PUT per keystroke, draws no bar and closes the side bar at once, as today', async () => {
    const { puts } = setupFetch()
    await renderCountries({ hub: null })

    await userEvent.type(taxInput(), 'ab')

    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[0]).toEqual({ url: 'https://api.test/countries/1/configs/101', body: { value: 'VATa' } })
    expect(puts[1]).toEqual({ url: 'https://api.test/countries/1/configs/101', body: { value: 'VATab' } })
    expect(barOf()).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Close side bar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByTestId('side-bar')).toBeNull()
  })
})
