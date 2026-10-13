/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  DriversList: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../styles/Select', () => ({
  Select: ({ placeholder }) => (
    <div data-testid='company-select'>{placeholder || 'Select company'}</div>
  )
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: () => <div data-testid='company-select'>Select company</div>
}))

vi.mock('../../../../styles/MultiSelect', () => ({
  MultiSelect: ({ onChange }) => (
    <button type='button' data-testid='company-filter' onClick={() => onChange?.(1)} />
  )
}))

import { CompanySelector } from '..'

const renderOrderSelector = ({ companysList, order, defaultValue } = {}) => {
  renderWithProviders(
    <CompanySelector
      order={order}
      defaultValue={defaultValue ?? order?.driver_company_id ?? 'default'}
      companysList={companysList}
      handleAssignDriverCompany={() => {}}
    />
  )
}

describe('CompanySelector Order Details visibility', () => {
  it('does not render the empty picker while controls are loading', () => {
    renderOrderSelector({
      companysList: { loading: true, companys: [], error: null }
    })

    expect(screen.queryByText('Driver company')).not.toBeInTheDocument()
    expect(screen.queryByTestId('company-select')).not.toBeInTheDocument()
    expect(screen.queryByText('Select company')).not.toBeInTheDocument()
    expect(screen.queryByText('Remove assigned company')).not.toBeInTheDocument()
  })

  it('does not render the empty picker when controls returns no companies', () => {
    renderOrderSelector({
      companysList: { loading: false, companys: [], error: null }
    })

    expect(screen.queryByText('Driver company')).not.toBeInTheDocument()
    expect(screen.queryByTestId('company-select')).not.toBeInTheDocument()
    expect(screen.queryByText('Select company')).not.toBeInTheDocument()
  })

  it('shows the assigned company name when the list is empty', () => {
    renderOrderSelector({
      order: { id: 10, driver_company_id: 9, driver_company: { name: 'Fleet Co' } },
      companysList: { loading: false, companys: [], error: null }
    })

    expect(screen.getByText('Driver company')).toBeInTheDocument()
    expect(screen.getByText('Fleet Co')).toBeInTheDocument()
    expect(screen.queryByTestId('company-select')).not.toBeInTheDocument()
  })

  it('shows the assigned company name when the fetch errors', () => {
    renderOrderSelector({
      order: { id: 10, driver_company_id: 9, driver_company: { name: 'Fleet Co' } },
      companysList: { loading: false, companys: [], error: ['network'] }
    })

    expect(screen.getByText('Fleet Co')).toBeInTheDocument()
    expect(screen.queryByTestId('company-select')).not.toBeInTheDocument()
  })

  it('does not render the empty picker when the fetch errors and no company is assigned', () => {
    renderOrderSelector({
      companysList: { loading: false, companys: [], error: ['network'] }
    })

    expect(screen.queryByText('Driver company')).not.toBeInTheDocument()
    expect(screen.queryByTestId('company-select')).not.toBeInTheDocument()
  })

  it('shows the picker when controls returns companies', () => {
    renderOrderSelector({
      companysList: {
        loading: false,
        error: null,
        companys: [{ id: 1, name: 'Fleet Co' }]
      }
    })

    expect(screen.getByText('Driver company')).toBeInTheDocument()
    expect(screen.getByTestId('company-select')).toBeInTheDocument()
  })
})

describe('CompanySelector filter view', () => {
  it('still renders when the company list is empty', () => {
    renderWithProviders(
      <CompanySelector
        isFilterView
        filterValues={{ companyIds: [] }}
        companysList={{ loading: false, companys: [], error: null }}
        handleChangeCompany={() => {}}
      />
    )

    expect(screen.getByTestId('company-filter')).toBeInTheDocument()
  })

  it('does not assign a company to an order from the filter', () => {
    const handleAssignDriverCompany = vi.fn()
    const handleChangeCompany = vi.fn()

    renderWithProviders(
      <CompanySelector
        isFilterView
        order={{ id: 10 }}
        filterValues={{ companyIds: [] }}
        companysList={{ loading: false, companys: [{ id: 1, name: 'Fleet Co' }], error: null }}
        handleChangeCompany={handleChangeCompany}
        handleAssignDriverCompany={handleAssignDriverCompany}
      />
    )

    fireEvent.click(screen.getByTestId('company-filter'))

    expect(handleChangeCompany).toHaveBeenCalledWith(1)
    expect(handleAssignDriverCompany).not.toHaveBeenCalled()
  })
})
