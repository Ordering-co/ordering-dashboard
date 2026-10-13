/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useUtils: () => [{ optimizeImage: (url) => url }],
  PosMenuBusinessDetails: ({ UIComponent, business, ...props }) => (
    <UIComponent
      {...props}
      businessState={{ loading: false, business }}
    />
  )
}))

vi.mock('../../../styles', () => ({
  Button: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))

import { SingleBusiness } from '../index'

const business = {
  id: 42,
  name: 'Pizza Pro',
  logo: '/logo.png',
  third_party_integrations: []
}

const listProps = {
  viewMethod: 'list',
  allowColumns: {
    business: true,
    status: true,
    pos: false,
    sales_channels: false
  },
  business,
  handleOpenBusinessDetails: vi.fn(),
  detailsBusinessId: null,
  citiesList: []
}

const getRowCellCount = () => within(screen.getByRole('row')).getAllByRole('cell').length

const renderRow = (ui) => renderWithProviders(<table>{ui}</table>)

describe('Connect SingleBusiness — fromImporters', () => {
  it('hides STATUS and Connect POS action when fromImporters is true', () => {
    renderRow(
      <SingleBusiness
        {...listProps}
        fromImporters
        allowColumns={{ ...listProps.allowColumns, status: false }}
      />
    )

    expect(screen.getByText('Pizza Pro')).toBeInTheDocument()
    expect(screen.queryByText('Not connected')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect POS' })).not.toBeInTheDocument()
  })

  it('shows STATUS and Connect POS for default Connect list rows', () => {
    renderRow(<SingleBusiness {...listProps} />)

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect POS' })).toBeInTheDocument()
  })

  it('renders skeleton rows without STATUS or action placeholders when fromImporters', () => {
    renderRow(
      <SingleBusiness
        isSkeleton
        viewMethod='list'
        fromImporters
        allowColumns={{ business: true, status: false, pos: false, sales_channels: false }}
      />
    )

    expect(getRowCellCount()).toBe(2)
  })

  it('renders skeleton rows with STATUS and action placeholders for default list', () => {
    renderRow(
      <SingleBusiness
        isSkeleton
        viewMethod='list'
        allowColumns={{ business: true, status: true, pos: false, sales_channels: false }}
      />
    )

    expect(getRowCellCount()).toBe(5)
  })
})
