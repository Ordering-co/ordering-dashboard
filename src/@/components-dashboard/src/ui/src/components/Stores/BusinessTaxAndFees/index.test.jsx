import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessTaxAndFees } from './index'

vi.mock('../../../../../index', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))
vi.mock('../EditTaxManager', () => ({ EditTaxManager: () => null }))
vi.mock('../CustomerFees', () => ({ CustomerFees: () => <div>Fee editor</div> }))
vi.mock('../../Shared', () => ({
  Alert: () => null,
  Modal: () => null,
  Tabs: ({ children }) => <div>{children}</div>,
  Tab: ({ children, onClick }) => <button onClick={onClick}>{children}</button>
}))
vi.mock('../../../styles/MultiSelect', () => ({
  MultiSelect: ({ defaultValue }) => <div data-testid='tax-selector'>{JSON.stringify(defaultValue)}</div>
}))

afterEach(cleanup)
const propsFor = (taxCatalogState) => ({
  business: { id: 1, taxes: [7] },
  taxes: { 'id:7': { id: 7, name: 'VAT', rate: 10 } },
  formState: { loading: false, changes: {}, result: { error: false } },
  formTaxState: { loading: false },
  setFormState: vi.fn(),
  getTaxes: vi.fn(),
  taxCatalogState
})
const view = props => <ThemeProvider theme={theme}><BusinessTaxAndFees {...props} /></ThemeProvider>

describe('BusinessTaxAndFees catalog recovery', () => {
  it('hides unloaded selectors, retries and restores existing assignments', () => {
    const props = propsFor({ loading: false, loaded: false, error: 'Offline' })
    const result = render(view(props))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load taxes. Please try again.')
    expect(screen.queryByTestId('tax-selector')).not.toBeInTheDocument()
    props.setFormState.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.getTaxes).toHaveBeenCalledTimes(1)
    result.rerender(view({ ...props, taxCatalogState: { loading: true, loaded: false, error: null } }))
    expect(screen.queryByTestId('tax-selector')).not.toBeInTheDocument()
    result.rerender(view({ ...props, taxCatalogState: { loading: false, loaded: true, error: null } }))
    expect(screen.getByTestId('tax-selector')).toHaveTextContent('[7]')
    expect(screen.getByRole('button', { name: 'Add new tax' })).toBeEnabled()
    expect(props.setFormState).not.toHaveBeenCalled()
  })

  it.each(['loading', 'error'])('retains a loaded selector and assignments during refresh %s', state => {
    const props = propsFor({ loading: state === 'loading', loaded: true, error: state === 'error' ? 'Offline' : null })
    render(view(props))
    expect(screen.getByTestId('tax-selector')).toHaveTextContent('[7]')
    expect(screen.getByRole('button', { name: 'Add new tax' })).toBeEnabled()
  })

  it('keeps fees accessible when taxes fail', () => {
    render(view(propsFor({ loading: false, loaded: false, error: 'Offline' })))
    fireEvent.click(screen.getByRole('button', { name: 'Fees' }))
    expect(screen.getByText('Fee editor')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
