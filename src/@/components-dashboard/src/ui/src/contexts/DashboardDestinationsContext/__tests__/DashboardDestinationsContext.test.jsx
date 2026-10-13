import React, { useEffect } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const {
  navigateMock,
  setAssistantOpenMock,
  registerDashboardSearchMock,
  settingsEnsureMock,
  settingsRefreshMock,
  integrationsEnsureMock,
  integrationsRefreshMock,
  integrationsCatalogResult
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  setAssistantOpenMock: vi.fn(),
  registerDashboardSearchMock: vi.fn(),
  settingsEnsureMock: vi.fn(async () => ({ status: 'error', categoryLists: null })),
  settingsRefreshMock: vi.fn(),
  integrationsEnsureMock: vi.fn(async () => ({ ...integrationsCatalogResult })),
  integrationsRefreshMock: vi.fn(),
  integrationsCatalogResult: {
    loaded: true,
    errors: { integrations: false, deliveryCompanies: false, builderApps: false },
    integrations: [],
    deliveryCompanies: [],
    builderApps: []
  }
}))

vi.mock('../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ project: 'demo', root: 'https://api.test' }]
}))
vi.mock('../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'jwt', user: { id: 7, level: 0, user_system_id: 1 } }]
}))
vi.mock('../../../../../contexts/AssistantContext', () => ({
  useAssistant: () => ({
    registerDashboardSearch: registerDashboardSearchMock,
    setOpen: setAssistantOpenMock
  })
}))
vi.mock('../../../../../components/CommandPalette/useSettingsCatalog', () => ({
  useSettingsCatalog: () => ({
    status: 'error',
    hub: null,
    ensure: settingsEnsureMock,
    refresh: settingsRefreshMock
  })
}))
vi.mock('../../../../../components/CommandPalette/useIntegrationsCatalog', () => ({
  useIntegrationsCatalog: () => ({
    ...integrationsCatalogResult,
    ensure: integrationsEnsureMock,
    refresh: integrationsRefreshMock
  })
}))
vi.mock('../../../hooks/useDashboardNavigation', () => ({
  useDashboardNavigation: () => navigateMock
}))

import { DashboardDestinationsProvider, useDashboardDestinations } from '../index'

let value

const Reader = () => {
  value = useDashboardDestinations()
  useEffect(() => {}, [value])
  return null
}

const renderProvider = () => render(
  <MemoryRouter initialEntries={['/assistant']}>
    <DashboardDestinationsProvider>
      <Reader />
    </DashboardDestinationsProvider>
  </MemoryRouter>
)

describe('DashboardDestinationsProvider', () => {
  beforeEach(() => {
    value = null
    navigateMock.mockReset()
    setAssistantOpenMock.mockReset()
    registerDashboardSearchMock.mockReset()
    settingsEnsureMock.mockReset()
    settingsEnsureMock.mockResolvedValue({ status: 'error', categoryLists: null })
    settingsRefreshMock.mockReset()
    integrationsEnsureMock.mockReset()
    integrationsEnsureMock.mockImplementation(async () => ({ ...integrationsCatalogResult }))
    integrationsRefreshMock.mockReset()
    integrationsCatalogResult.loaded = true
    integrationsCatalogResult.errors = { integrations: false, deliveryCompanies: false, builderApps: false }
    integrationsCatalogResult.integrations = []
    integrationsCatalogResult.deliveryCompanies = []
    integrationsCatalogResult.builderApps = []
    window.sessionStorage.clear()
    window.innerWidth = 1024
  })

  it('registers a read-only search callback and returns partial results if Settings loading failed', async () => {
    renderProvider()
    await waitFor(() => expect(value).not.toBeNull())

    const result = await value.search({ query: '', destination_id: 'nav:orders' })
    expect(registerDashboardSearchMock).toHaveBeenCalled()
    expect(registerDashboardSearchMock.mock.calls.at(-1)[0].getScope()).toBe(value.scope)
    expect(settingsEnsureMock).toHaveBeenCalledOnce()
    expect(integrationsEnsureMock).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      version: 1,
      status: 'partial',
      errors: ['SETTINGS_CATALOG_ERROR']
    })
    expect(result.items[0].id).toBe('nav:orders')
    expect(result.items[0]).not.toHaveProperty('path')
  })

  it('rejects a foreign scope and revalidates stale static history before shared navigation', async () => {
    renderProvider()
    await waitFor(() => expect(value).not.toBeNull())
    const search = await value.search({ query: '', destination_id: 'nav:orders' })

    await act(async () => {
      await expect(value.open(search.items[0], { scope: 'another-user', revision: search.revision }))
        .resolves.toEqual({ status: 'unavailable' })
      await expect(value.open(search.items[0], { scope: search.scope, revision: 'old-revision' }))
        .resolves.toMatchObject({ status: 'opened' })
    })

    expect(navigateMock).toHaveBeenCalledWith('/orders', { remount: false })
    expect(setAssistantOpenMock).toHaveBeenCalledWith(true)
    expect(settingsRefreshMock).not.toHaveBeenCalled()
    expect(integrationsRefreshMock).not.toHaveBeenCalled()
  })

  it('exposes partial integration catalog failures without hiding local destinations', async () => {
    integrationsCatalogResult.errors = { integrations: true, deliveryCompanies: false, builderApps: false }
    renderProvider()
    await waitFor(() => expect(value).not.toBeNull())

    const result = await value.search({ query: '', destination_id: 'nav:orders' })

    expect(value.catalogStatus.integrations).toBe('partial')
    expect(result.status).toBe('partial')
    expect(result.errors).toContain('INTEGRATIONS_INTEGRATIONS_ERROR')
    expect(result.items[0].id).toBe('nav:orders')
  })

  it('keeps the project-and-user scope stable across provider remounts', async () => {
    const first = renderProvider()
    await waitFor(() => expect(value).not.toBeNull())
    const firstScope = value.scope
    first.unmount()
    value = null
    renderProvider()
    await waitFor(() => expect(value).not.toBeNull())

    expect(value.scope).toBe(firstScope)
  })
})
