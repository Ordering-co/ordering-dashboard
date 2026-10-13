/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../utils', () => ({
  addQueryToUrl: vi.fn()
}))

vi.mock('../../../Shared', () => ({
  ColumnAllowSettingPopover: () => <div data-testid='column-settings'>Column settings</div>,
  Pagination: () => <div data-testid='pagination'>Pagination</div>,
  NotFoundSource: ({ content, btnTitle, onClickButton }) => (
    <div data-testid='not-found-source'>
      <p>{content}</p>
      {onClickButton && (
        <button type='button' onClick={onClickButton}>{btnTitle}</button>
      )}
    </div>
  )
}))

vi.mock('../../SingleBusiness', () => ({
  SingleBusiness: ({ fromImporters, allowColumns }) => (
    <tbody data-testid='single-business-row'>
      <tr>
        <td>1</td>
        {allowColumns?.business && <td className='business'>Business row</td>}
        {allowColumns?.status && <td>Status row</td>}
        {allowColumns?.pos && <td>POS row</td>}
        {allowColumns?.sales_channels && <td>Sales channels row</td>}
        {!fromImporters && <td>Action row</td>}
      </tr>
    </tbody>
  )
}))

import { BusinessesList } from '../index'

const createProps = (overrides = {}) => ({
  viewMethod: 'list',
  businessList: {
    loading: false,
    businesses: [{ id: 1, name: 'Test Store' }]
  },
  integrationsList: {},
  pagination: {
    currentPage: 1,
    pageSize: 10,
    total: 1,
    from: 1,
    to: 1
  },
  loadMoreBusinesses: vi.fn(),
  handleSucessRemoveBusiness: vi.fn(),
  handleSucessAddBusiness: vi.fn(),
  handleSucessUpdateBusiness: vi.fn(),
  handleOpenBusinessDetails: vi.fn(),
  getPageBusinesses: vi.fn(),
  selectedBusinessActiveState: true,
  citiesList: [],
  isUseQuery: false,
  ...overrides
})

const getHeaderTexts = () => {
  const headerRow = screen.getByRole('table').querySelector('thead tr')
  return within(headerRow).getAllByRole('columnheader').map((cell) => cell.textContent.trim())
}

describe('Connect BusinessesList — fromImporters', () => {
  it('shows only ID and Business headers when fromImporters is true', () => {
    renderWithProviders(<BusinessesList {...createProps({ fromImporters: true })} />)

    expect(getHeaderTexts()).toEqual(['ID', 'Business'])
    expect(screen.queryByText('STATUS')).not.toBeInTheDocument()
    expect(screen.queryByText('POS')).not.toBeInTheDocument()
    expect(screen.queryByTestId('column-settings')).not.toBeInTheDocument()
  })

  it('shows STATUS and column settings for default Connect list (PosMenu-style)', () => {
    renderWithProviders(<BusinessesList {...createProps()} />)

    expect(getHeaderTexts()).toEqual(['ID', 'Business', 'STATUS', 'Column settings'])
    expect(screen.getByTestId('column-settings')).toBeInTheDocument()
  })

  it('shows POS and Sales Channels headers for sales channels list', () => {
    renderWithProviders(
      <BusinessesList {...createProps({ fromSalesChannels: true })} />
    )

    expect(getHeaderTexts()).toEqual(['ID', 'Business', 'POS', 'SALES CHANNELS', 'Column settings'])
    expect(screen.queryByText('STATUS')).not.toBeInTheDocument()
  })

  it('passes importers column config to SingleBusiness rows', () => {
    renderWithProviders(<BusinessesList {...createProps({ fromImporters: true })} />)

    const row = screen.getByTestId('single-business-row')
    expect(within(row).getByText('Business row')).toBeInTheDocument()
    expect(within(row).queryByText('Status row')).not.toBeInTheDocument()
    expect(within(row).queryByText('Action row')).not.toBeInTheDocument()
  })

  it('applies importers table layout styles on the list table', () => {
    renderWithProviders(<BusinessesList {...createProps({ fromImporters: true })} />)

    expect(screen.getByRole('table')).toHaveStyle({ tableLayout: 'fixed' })
  })

  it('shows empty state with clear search when search returns no businesses', () => {
    const onSearch = vi.fn()

    renderWithProviders(
      <BusinessesList
        {...createProps({
          fromImporters: true,
          searchValue: 'pan',
          onSearch,
          businessList: { loading: false, businesses: [] },
          pagination: { currentPage: 1, pageSize: 10, total: 0, from: 0, to: 0 }
        })}
      />
    )

    expect(screen.getByTestId('not-found-source')).toBeInTheDocument()
    expect(screen.getByText(/No businesses found for "pan"/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledWith('')
  })
})
