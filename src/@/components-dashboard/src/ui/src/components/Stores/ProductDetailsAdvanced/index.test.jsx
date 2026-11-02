import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ parsePrice: value => `${value}` }],
  ProductDetailsAdvanced: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../EditTaxManager', () => ({ EditTaxManager: () => null }))
vi.mock('../../Shared', () => ({ Alert: () => null, Modal: () => null }))
vi.mock('../../../styles/MultiSelect', () => ({
  MultiSelect: ({ defaultValue }) => <div data-testid='tax-selector'>{JSON.stringify(defaultValue)}</div>
}))
vi.mock('../../../styles/Select/FirstSelect', () => ({
  Select: ({ defaultValue }) => <div data-testid='select'>{defaultValue}</div>
}))

import { ProductDetailsAdvanced } from './index'

describe('ProductDetailsAdvanced catalog availability', () => {
  const getProps = (catalogState) => {
    const retryCatalogs = vi.fn()
    const handleClickProperties = vi.fn()
    const handleClickProperty = vi.fn()
    return {
      productState: { id: 1, taxes: [{ id: 7 }], fee_id: 8 },
      business: { id: 10 },
      taxes: { 'id:7': { id: 7, name: 'VAT', rate: 10 } },
      fees: { 'id:8': { id: 8, name: 'Service', fixed: 0, percentage: 5 } },
      formState: { loading: false, changes: {}, result: { error: false } },
      alertState: { open: false, content: [] },
      taxToEdit: { action: null, payload: null },
      setAlertState: vi.fn(),
      handleClickProperties,
      handleClickProperty,
      retryCatalogs,
      catalogState
    }
  }

  it('shows a skeleton while both catalogs are initially loading', () => {
    const props = getProps({
      taxes: { loading: true, error: null, loaded: false },
      fees: { loading: true, error: null, loaded: false }
    })
    const view = renderWithProviders(<ProductDetailsAdvanced {...props} />, { theme })
    expect(screen.queryByTestId('tax-selector')).not.toBeInTheDocument()
    expect(screen.queryByText('Add new tax')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('select')).toHaveLength(1)
    expect(props.handleClickProperties).not.toHaveBeenCalled()
    expect(props.handleClickProperty).not.toHaveBeenCalled()
    view.unmount()
  })

  it('keeps the successful fee selector visible while taxes retry', () => {
    const props = getProps({
      taxes: { loading: false, error: 'Unavailable', loaded: false },
      fees: { loading: false, error: null, loaded: true }
    })
    renderWithProviders(<ProductDetailsAdvanced {...props} />, { theme })
    expect(screen.queryByTestId('tax-selector')).not.toBeInTheDocument()
    expect(screen.getByText('Could not load taxes. Please try again.')).toBeInTheDocument()
    expect(screen.getAllByTestId('select').at(-1)).toHaveTextContent('8')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.retryCatalogs).toHaveBeenCalledTimes(1)
    expect(props.handleClickProperties).not.toHaveBeenCalled()
    expect(props.handleClickProperty).not.toHaveBeenCalled()
  })

  it.each(['loading', 'error'])('keeps loaded selectors and assignments during background %s', (state) => {
    const props = getProps({
      taxes: { loading: state === 'loading', error: state === 'error' ? 'Unavailable' : null, loaded: true },
      fees: { loading: state === 'loading', error: state === 'error' ? 'Unavailable' : null, loaded: true }
    })
    renderWithProviders(<ProductDetailsAdvanced {...props} />, { theme })
    expect(screen.getByTestId('tax-selector')).toHaveTextContent('[7]')
    expect(screen.getAllByTestId('select').at(-1)).toHaveTextContent('8')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(props.handleClickProperties).not.toHaveBeenCalled()
    expect(props.handleClickProperty).not.toHaveBeenCalled()
  })

  it('keeps the selectors visible for consumers without catalog state', () => {
    const props = getProps(undefined)
    renderWithProviders(<ProductDetailsAdvanced {...props} />, { theme })
    expect(screen.getByTestId('tax-selector')).toHaveTextContent('[7]')
    expect(screen.getAllByTestId('select').at(-1)).toHaveTextContent('8')
  })
})
