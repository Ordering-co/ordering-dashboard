import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { feesState, parsePrice } = vi.hoisted(() => ({
  feesState: { fees: [] },
  parsePrice: (value) => `Q ${Number(value).toFixed(2)}`
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  Modal: () => null,
  Pagination: () => null,
  RecipientSelect: () => null,
  SearchBar: () => null
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice }],
  CustomerFees: (props) => {
    const UI = props.UIComponent
    return (
      <UI
        {...props}
        businessId={397}
        feesList={{ loading: false, fees: feesState.fees }}
        getFees={() => {}}
        createFee={() => {}}
        updateFee={() => {}}
        deleteFees={() => {}}
        searchValue=''
        handleChangeSearch={() => {}}
        paginationProps={{
          currentPage: 1,
          totalPages: 1,
          pageSize: 10,
          totalItems: feesState.fees.length
        }}
        setPaginationProps={() => {}}
        sitesState={{ sites: [] }}
        paymethodsState={{ paymethods: [] }}
        actionState={{ loading: false }}
      />
    )
  }
}))

import { CustomerFees } from '../index'

const renderFees = () => renderWithProviders(
  <CustomerFees businessId={397} />,
  {
    theme: {
      colors: {
        primary: '#E63757',
        primaryContrast: '#ffffff',
        lightPrimary: '#FFF2F4',
        backgroundPage: '#ffffff',
        headingColor: '#344054',
        lightGray: '#f5f5f5',
        borderColor: '#e9ecef'
      }
    }
  }
)

describe('CustomerFees amount currency', () => {
  beforeEach(() => {
    feesState.fees = []
  })

  it('formats a fixed fee with the project currency from parsePrice', () => {
    feesState.fees = [{ id: 1, name: 'Service', fixed: 30, percentage: 0, enabled: true }]
    renderFees()
    expect(screen.getByText('Q 30.00 + 0%')).toBeInTheDocument()
  })

  it('formats a missing fixed amount as zero in the project currency', () => {
    feesState.fees = [{ id: 2, name: 'Percent only', fixed: null, percentage: 5, enabled: true }]
    renderFees()
    expect(screen.getByText('Q 0.00 + 5%')).toBeInTheDocument()
  })

  it('formats the minimum with the project currency', () => {
    feesState.fees = [{
      id: 3,
      name: 'With minimum',
      fixed: 30,
      percentage: 0,
      fixed_minimum: 5,
      enabled: true
    }]
    renderFees()
    expect(screen.getByText('Min: Q 5.00')).toBeInTheDocument()
  })
})
