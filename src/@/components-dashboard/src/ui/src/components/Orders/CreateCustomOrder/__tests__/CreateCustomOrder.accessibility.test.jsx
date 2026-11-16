/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { driver_tip_type: { value: '2' }, format_number_currency: { value: '$' } } }],
  useUtils: () => [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}`, parseNumber: value => value }],
  useOrder: () => [{ loading: false }, { changeAddress: vi.fn() }],
  useSession: () => [{ user: { level: 0 } }],
  useValidationFields: () => [{ fields: { checkout: {} } }],
  DriverTips: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  CouponControl: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null
}))

vi.mock('../SelectCustomer', () => ({ SelectCustomer: () => <div data-testid='select-customer' /> }))
vi.mock('../OrderTypeSelector', () => ({ OrderTypeSelector: () => <div data-testid='order-type' /> }))
vi.mock('../SelectBusinesses', () => ({ SelectBusinesses: () => <div data-testid='select-businesses' /> }))
vi.mock('../Map', () => ({ Map: () => <div data-testid='map' /> }))
vi.mock('../SelectProducts', () => ({ SelectProducts: () => <div data-testid='select-products' /> }))
vi.mock('../Checkout', () => ({ Checkout: () => <div data-testid='checkout' /> }))

import { CouponControl } from '../CouponControl'
import { CustomOrderDetails } from '../CustomOrderDetails'
import { DriverTips } from '../DriverTips'
import { PaymentOptionCash } from '../PaymentOptionCash'

describe('Create custom order batch 1 accessibility and preserved payloads', () => {
  it('exposes driver tips as native pressed actions and keeps the option payload', () => {
    const handlerChangeOption = vi.fn()
    renderWithProviders(
      <DriverTips
        driverTip={10}
        driverTipsOptions={[5, 10, 15]}
        isDriverTipUseCustom
        handlerChangeOption={handlerChangeOption}
        cart={{ driver_tip: 10 }}
      />
    )

    const selected = screen.getByRole('button', { name: '10%', pressed: true })
    expect(selected).toBeInTheDocument()
    const other = screen.getByRole('button', { name: '15%' })
    expect(other).toHaveAttribute('aria-pressed', 'false')
    expect(other).toHaveAttribute('type', 'button')

    fireEvent.click(other)
    expect(handlerChangeOption).toHaveBeenCalledWith(15)

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByRole('textbox', { name: 'Custom' })).toBeInTheDocument()
  })

  // redesign 5.5: the mode is a segmented control inside the Items step of the wizard (Order by products /
  // Order by total became By products / By total), and the step is reached with Continue once the customer and
  // the business are picked. The pressed state, the field labels and the setExtraFields payloads are the same.
  it('exposes the order mode as native pressed actions and names every custom order field', async () => {
    const setExtraFields = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <CustomOrderDetails
        selectedUser={{ id: 1, name: 'Ana', lastname: 'Perez', cellphone: '5550001111' }}
        selectedBusiness={{ id: 5, slug: 'store', name: 'Corner Store' }}
        customerAddress={{ id: 7, location: { lat: 1, lng: 2 } }}
        extraFields={{ external_id: 'EXT-1' }}
        setExtraFields={setExtraFields}
        customersPhones={{}}
        setCustomersPhones={vi.fn()}
        actionState={{ loading: false }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: 'Items' })).toBeInTheDocument()

    const mode = screen.getByRole('group', { name: 'Order mode' })
    const byProducts = within(mode).getByRole('button', { name: 'By products' })
    const byTotal = within(mode).getByRole('button', { name: 'By total' })
    expect(byProducts).toHaveAttribute('aria-pressed', 'true')
    expect(byTotal).toHaveAttribute('aria-pressed', 'false')
    expect(byTotal).toHaveAttribute('type', 'button')

    // redesign 5.1 copy: «External ID» (sentence case with the acronym), approved 2026-10-06.
    expect(screen.getByLabelText(/External id/i)).toHaveValue('EXT-1')

    await user.click(byTotal)
    expect(byTotal).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Total')).toBeInTheDocument()
    expect(screen.getByLabelText('Comment')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Total'), { target: { value: '25' } })
    expect(setExtraFields).toHaveBeenCalledWith({ external_id: 'EXT-1', total: '25' })
  })

  it('names the cash amount field through its own label', () => {
    renderWithProviders(<PaymentOptionCash orderTotal={20} onChangeData={vi.fn()} setErrorCash={vi.fn()} />)
    const label = screen.getByText(/Don't have exact amount/)
    expect(label.tagName).toBe('LABEL')
    expect(screen.getByLabelText(/Don't have exact amount/)).toBeInTheDocument()
  })

  it('names the coupon field and preserves the apply handler', () => {
    const handleButtonApplyClick = vi.fn()
    renderWithProviders(
      <CouponControl
        couponInput='WELCOME'
        onChangeInputCoupon={vi.fn()}
        handleButtonApplyClick={handleButtonApplyClick}
        confirm={{ open: false }}
        setConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole('textbox', { name: 'Discount coupon' })).toHaveValue('WELCOME')
    fireEvent.click(within(screen.getByRole('textbox', { name: 'Discount coupon' }).closest('div')).getByRole('button', { name: 'Apply' }))
    expect(handleButtonApplyClick).toHaveBeenCalled()
  })
})
