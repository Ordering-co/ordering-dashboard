/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  PosMenuBusinessList: () => null
}))

vi.mock('../../../utils', () => ({
  getStorageItem: vi.fn().mockResolvedValue({}),
  setStorageItem: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../BusinessesListingHeader', () => ({
  BusinessesListingHeader: () => <div data-testid='businesses-header' />
}))

vi.mock('../../BusinessesList', () => ({
  BusinessesList: () => <div data-testid='businesses-list' />
}))

vi.mock('../../Stores/BusinessActiveStateFilter', () => ({
  BusinessActiveStateFilter: () => <div data-testid='active-filter' />
}))

vi.mock('../../ImportersPanel', () => ({
  ImportersPanel: ({ business }) => (
    business
      ? <div data-testid='importers-panel'>{business.name}</div>
      : null
  )
}))

vi.mock('../MenuImportModal', () => ({
  MenuImportModal: () => null
}))

import { ImportersUI } from '../index'

const business = { id: 2147, name: 'Pan Pizza' }

const renderImporters = (props = {}, route = '/connect/importers') => {
  const onBusinessRedirect = vi.fn()

  renderWithProviders(
    <MemoryRouter initialEntries={[route]}>
      <ImportersUI
        businessList={{ loading: false, businesses: [business] }}
        integrationsList={{}}
        pagination={{ currentPage: 1, pageSize: 10, total: 1 }}
        searchValue={null}
        selectedBusinessActiveState={false}
        handleChangeBusinessActiveState={vi.fn()}
        loadMoreBusinesses={vi.fn()}
        handleSucessRemoveBusiness={vi.fn()}
        handleSucessAddBusiness={vi.fn()}
        handleSucessUpdateBusiness={vi.fn()}
        loadBusinesses={vi.fn()}
        onSearch={vi.fn()}
        onBusinessRedirect={onBusinessRedirect}
        getPageBusinesses={vi.fn()}
        filterValues={{}}
        businessTypeSelected={null}
        inActiveBusinesses={{ businesses: [] }}
        citiesList={[]}
        isUseQuery
        {...props}
      />
    </MemoryRouter>
  )

  return { onBusinessRedirect }
}

describe('Connect ImportersUI — URL business restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the panel when the URL id matches a loaded business', async () => {
    renderImporters(
      {},
      '/connect/importers?active=false&page=1&pageSize=10&id=2147'
    )

    expect(await screen.findByTestId('importers-panel')).toHaveTextContent('Pan Pizza')
  })

  it('closes the panel and clears the URL id when the business is not in the loaded list', async () => {
    const { onBusinessRedirect } = renderImporters(
      { businessList: { loading: false, businesses: [] } },
      '/connect/importers?active=false&page=1&pageSize=10&id=2147'
    )

    expect(screen.queryByTestId('importers-panel')).not.toBeInTheDocument()
    expect(onBusinessRedirect).toHaveBeenCalledWith()
  })

  it('does not open the panel while the business list is still loading', () => {
    renderImporters(
      { businessList: { loading: true, businesses: [] } },
      '/connect/importers?active=false&page=1&pageSize=10&id=2147'
    )

    expect(screen.queryByTestId('importers-panel')).not.toBeInTheDocument()
  })
})
