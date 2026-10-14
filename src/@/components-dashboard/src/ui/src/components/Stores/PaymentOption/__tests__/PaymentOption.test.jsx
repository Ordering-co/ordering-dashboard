import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { defaultTheme, renderWithProviders } from '~/__tests__/helpers/testUtils'

const addQueryToUrl = vi.fn()
const removeQueryToUrl = vi.fn()

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1400 })
}))

vi.mock('../../../Shared', () => ({
  Confirm: () => null
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, color, borderRadius, ...props }) => <button type='button' {...props}>{children}</button>,
  IconButton: ({ children, color, ...props }) => <button type='button' {...props}>{children}</button>
}))

vi.mock('../../../../utils', () => ({
  addQueryToUrl: (...args) => addQueryToUrl(...args),
  removeQueryToUrl: (...args) => removeQueryToUrl(...args)
}))

import { PaymentOption } from '../index'

// The panel darkens this color for its menu
const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, secundary: '#f8f9fa' } }

const handleSaveClick = vi.fn()
const handleChangeBusinessPaymentState = vi.fn()

const props = {
  open: true,
  onClose: vi.fn(),
  businessPaymethod: {
    id: 77,
    allowed_order_types: [1],
    sites: [],
    paymethod: { id: 1, gateway: 'cash', name: 'Cash' }
  },
  orderTypes: [{ value: 1, text: 'Delivery' }, { value: 2, text: 'Pickup' }],
  sitesState: { sites: [{ id: 5, name: 'Website' }] },
  deviceState: { devices: [] },
  changesState: {},
  actionState: { loading: false },
  cleanChangesState: vi.fn(),
  handleChangeBusinessPaymentState,
  handleSaveClick,
  handleDeletePaymethod: vi.fn(),
  selectedPaymethodGateway: 'cash'
}

const renderPanel = (overrides = {}, options = {}) =>
  renderWithProviders(<PaymentOption {...props} {...overrides} />, { theme, ...options })

/**
 * The panel of the payment methods with no panel of their own (cash, card on
 * delivery…). Stripe Connect v2 adds tabs to it through `extraTabs`; this
 * fixes what it does for everybody else, who pass none.
 */
describe('PaymentOption without tabs of the gateway', () => {
  beforeEach(() => {
    addQueryToUrl.mockReset()
    removeQueryToUrl.mockReset()
    handleSaveClick.mockReset()
    handleChangeBusinessPaymentState.mockReset()
  })

  it('names the payment method and opens on Channels, the first tab', () => {
    renderPanel()

    expect(screen.getByRole('heading', { name: 'Cash' })).toBeInTheDocument()
    expect(screen.getByText('Channels')).toBeInTheDocument()
    expect(screen.getByText('Order type')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument()
    expect(addQueryToUrl).toHaveBeenCalledWith({ paymethod_tab: 0 })
  })

  it('falls back to a generic name when the payment method is not known', () => {
    renderPanel({ businessPaymethod: { id: 77, allowed_order_types: [1], sites: [] } })

    expect(screen.getByRole('heading', { name: 'Paymethod' })).toBeInTheDocument()
  })

  it('opens on the tab the URL names, as a number, without rewriting it', () => {
    renderPanel({}, { initialEntries: ['/stores/list?paymethod_tab=1'] })

    expect(screen.getByText('Delivery')).toBeInTheDocument()
    expect(screen.queryByText('All')).not.toBeInTheDocument()
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  it('keeps the tab that is chosen in the URL and never takes the param away', () => {
    renderPanel()
    addQueryToUrl.mockReset()

    fireEvent.click(screen.getByText('Order type'))

    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(addQueryToUrl).toHaveBeenCalledWith({ paymethod_tab: 1 })
    expect(removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('reports the order types that are checked', () => {
    renderPanel({}, { initialEntries: ['/stores/list?paymethod_tab=1'] })

    fireEvent.click(screen.getByText('Pickup'))

    expect(handleChangeBusinessPaymentState).toHaveBeenCalledWith({ allowed_order_types: [1, 2] })
  })

  it('offers Devices only to the payment methods that take them', () => {
    const { unmount } = renderPanel()
    expect(screen.getByText('Devices')).toBeInTheDocument()
    unmount()

    renderPanel({ selectedPaymethodGateway: 'izipay' })
    expect(screen.queryByText('Devices')).not.toBeInTheDocument()
  })

  it('always shows Save, disabled until something changes', () => {
    const { unmount } = renderPanel()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    unmount()

    renderPanel({ changesState: { allowed_order_types: [1, 2] } })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).not.toBeDisabled()

    fireEvent.click(save)
    expect(handleSaveClick).toHaveBeenCalledWith(77)
  })
})
