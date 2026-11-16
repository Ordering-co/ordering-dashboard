/* eslint-disable import/first */
// «Sales channels» (Sites) draws Product pieces. The hub prints the title (no h1 of its own), the site picker is the
// Product SelectField (labelled «Site», numeric site ids round-trip) and the side panel's expand button is a Product IconButton.
// The real controller drives the real UI; only `fetch` and the contexts are replaced.
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ session: [{ loading: false, token: 'token' }] }))
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
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, translate] }))
vi.mock('../../../Shared', () => ({ Alert: () => null, NotFoundSource: ({ content }) => <div>{content}</div> }))

import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { SitesAuthSettings } from '../index'

const configsOf = (siteId) => [
  { id: siteId * 100 + 1, key: 'site_title', name: `Site title ${siteId}`, type: 1, value: 'Old title', rank: 1, config_category_id: 1, config_category: { name: 'General', rank: 1 } }
]
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const setupFetch = () => {
  const fetchMock = vi.fn((url) => {
    if (url.includes('/sites/1/configs')) return json({ error: false, result: configsOf(1) })
    if (url.includes('/sites/2/configs')) return json({ error: false, result: configsOf(2) })
    return json({ error: false, result: [{ id: 1, name: 'Main site' }, { id: 2, name: 'Second site' }] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const renderSites = ({ hub = { product: true, report: vi.fn() }, entry = '/settings?category=sites&site=1', ...props } = {}) => renderWithProviders(
  <SettingsHubFormContext.Provider value={hub}>
    <SitesAuthSettings {...props} />
    <Route render={({ location }) => <output data-testid='search'>{location.search}</output>} />
  </SettingsHubFormContext.Provider>,
  { initialEntries: [entry] }
)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.getElementById('sideSlider')?.remove()
})

describe('Sales channels with Product pieces', () => {
  it('prints no title of its own and the site picker is a labelled Product select with the open site', async () => {
    setupFetch()
    const view = renderSites({ avoidExpand: true })
    await screen.findByDisplayValue('Old title')

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByText('Sites Login/Signup Settings')).toBeNull()
    const picker = screen.getByRole('combobox', { name: /^Site/ })
    expect(picker).toHaveClass('odc-select-trigger')
    expect(picker).toHaveTextContent('Main site')
    expect(view.container.querySelector('.odc-field-label')).toHaveTextContent('Site')
    expect(view.container.querySelector('.select')).toBeNull()
  })

  it('shows the placeholder until a site is open, and picking one loads it and puts ?site=<id> in the URL', async () => {
    const fetchMock = setupFetch()
    renderSites({ entry: '/settings?category=sites', avoidExpand: true })
    const picker = await screen.findByRole('combobox', { name: /^Site/ })
    expect(picker).toHaveTextContent('Select a site')

    await userEvent.click(picker)
    await userEvent.click(await screen.findByRole('option', { name: 'Second site' }))

    expect(await screen.findByPlaceholderText('Site title 2')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/sites/2/configs'))).toBe(true)
    expect(screen.getByTestId('search')).toHaveTextContent('?category=sites&site=2')
    expect(screen.getByRole('combobox', { name: /^Site/ })).toHaveTextContent('Second site')
  })

  it('outside the hub, the side panel keeps its expand button as a Product IconButton that toggles the panel width', async () => {
    setupFetch()
    const slider = document.createElement('div')
    slider.id = 'sideSlider'
    document.body.appendChild(slider)
    renderSites({ hub: null, entry: '/settings?category=sites' })
    await screen.findByRole('combobox', { name: /^Site/ })

    const expand = screen.getByRole('button', { name: 'Expand' })
    expect(expand).toHaveClass('odc-btn')
    await userEvent.click(expand)
    expect(slider.style.width).toBe('var(--app-width, 100vw)')
    await userEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(slider.style.width).toBe('500px')
  })

  it('draws no expand button once a site is open', async () => {
    setupFetch()
    renderSites({ hub: null })
    await screen.findByDisplayValue('Old title')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull())
  })
})
