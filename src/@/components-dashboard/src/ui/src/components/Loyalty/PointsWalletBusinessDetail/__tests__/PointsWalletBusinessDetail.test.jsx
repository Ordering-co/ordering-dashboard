/* eslint-disable import/first */
// ST7: the accumulation card of the wallet form. The cash wallet (type «cashback») credits money, so its help does not
// speak of points; the points wallet keeps its own help.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

// the controller is replaced by a stand-in that hands the UI its props, like the real one does
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `$${value}` }],
  PointsWalletBusinessDetail: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
const ctl = vi.hoisted(() => ({ alert: null }))
vi.mock('../../../Shared', () => ({
  Alert: ({ open, content }) => {
    ctl.alert = open ? content : null
    return null
  }
}))

import { PointsWalletBusinessDetail } from '../index'

const dashboardTheme = createDashboardTheme(theme)

const renderWallet = (type) => renderWithProviders(
  <PointsWalletBusinessDetail
    walletData={{ id: 1, type, redemption_rate: 1, accumulation_rate: 2 }}
    formState={{ changes: {} }}
    formStateConfigs={{ changes: [] }}
    handleChangeInput={vi.fn()}
    handleChangeItem={vi.fn()}
    hideName
  />,
  { theme: dashboardTheme }
)

const POINTS_HELP = 'Amount of points to assign in relation to the order subtotal'
// api-core credits round(subtotal after discounts × accumulation_rate, 2), so the rate is a multiplier
const CASH_HELP = 'The order subtotal (after discounts) is multiplied by this number. Example: 0.05 credits $5 on a $100 order (5%).'

describe('PointsWalletBusinessDetail · the help of the accumulation card (ST7, )', () => {
  it('the cash wallet explains the multiplier with an example and its placeholder does not speak of points', () => {
    renderWallet('cashback')
    expect(screen.getByRole('heading', { name: 'Cash accumulation' })).toBeInTheDocument()
    expect(screen.getByText(CASH_HELP)).toBeInTheDocument()
    expect(screen.queryByText(POINTS_HELP)).toBeNull()
    const [, accumulation] = screen.getAllByRole('textbox', { name: 'Value' })
    expect(accumulation).toHaveAttribute('placeholder', 'e.g. 0.05')
  })

  it('the points wallet keeps its own help and a placeholder in points', () => {
    renderWallet('credit_point')
    expect(screen.getByRole('heading', { name: 'Points accumulation' })).toBeInTheDocument()
    expect(screen.getByText(POINTS_HELP)).toBeInTheDocument()
    expect(screen.queryByText(CASH_HELP)).toBeNull()
    const [, accumulation] = screen.getAllByRole('textbox', { name: 'Value' })
    expect(accumulation).toHaveAttribute('placeholder', '00 points')
  })
})

// the rules of one store (and the general ones) in Product pieces, with the handlers and validations of main.
describe('PointsWalletBusinessDetail · Product pieces', () => {
  const STORE = { id: 7, name: 'Store A', type: 'credit_point', redemption_rate: 100, accumulation_rate: 2, maximum_accumulation: 50, expire_after_minutes: 1440 }
  const renderStore = ({ walletData = STORE, formState = { loading: false, changes: {} }, ...extra } = {}) => {
    const spies = { handleChangeInput: vi.fn(), handleChangeItem: vi.fn(), handleClickSubmit: vi.fn() }
    renderWithProviders(
      <PointsWalletBusinessDetail
        walletData={walletData}
        formState={formState}
        formStateConfigs={{ changes: [] }}
        isBusiness
        {...spies}
        {...extra}
      />,
      { theme: dashboardTheme }
    )
    return spies
  }

  it('Save is a primary Product button, disabled without changes and busy while saving', () => {
    renderStore({ formState: { loading: true, changes: { redemption_rate: '5' } } })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveClass('odc-btn')
    expect(save).toHaveAttribute('data-variant', 'primary')
    expect(save).toHaveAttribute('aria-busy', 'true')
  })

  it('the rates, the maximum and the days are Product text fields that keep their input names', () => {
    renderStore()
    const [redemption, accumulation] = screen.getAllByRole('textbox', { name: 'Value' })
    expect(redemption).toHaveValue('100')
    expect(redemption).toHaveAttribute('name', 'redemption_rate')
    expect(redemption).toHaveClass('odc-field-input')
    expect(accumulation).toHaveValue('2')
    expect(accumulation).toHaveAttribute('name', 'accumulation_rate')
    expect(screen.getByRole('textbox', { name: 'Maximum of points' })).toHaveValue('50')
    expect(screen.getByRole('textbox', { name: 'Days' })).toHaveValue('1')
    expect(screen.getByRole('heading', { name: 'Store A' })).toBeInTheDocument()
  })

  it('a typed rate reaches handleChangeInput as an event with the field name; only digits and a dot are accepted', () => {
    const spies = renderStore()
    const [redemption] = screen.getAllByRole('textbox', { name: 'Value' })
    fireEvent.change(redemption, { target: { value: '1.5' } })
    expect(spies.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'redemption_rate', value: '1.5' } })
    expect(fireEvent.keyPress(redemption, { key: 'x', charCode: 120 })).toBe(false)
    expect(fireEvent.keyPress(redemption, { key: '.', charCode: 46 })).toBe(true)
  })

  it('«Maximum of points» is a Product switch; turning it off clears the maximum', async () => {
    const user = userEvent.setup()
    const spies = renderStore()
    const toggle = screen.getByRole('switch', { name: 'Maximum of points' })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(spies.handleChangeItem).toHaveBeenLastCalledWith({ maximum_accumulation: null })
    expect(screen.queryByRole('textbox', { name: 'Maximum of points' })).toBeNull()
  })

  it('the expiration is a Product radio group; the days are sent in minutes and «No» clears them', async () => {
    const user = userEvent.setup()
    const spies = renderStore()
    expect(screen.getByRole('radiogroup', { name: 'Expiration' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Days' }), { target: { value: '3' } })
    expect(spies.handleChangeItem).toHaveBeenLastCalledWith({ expire_after_minutes: 3 * 24 * 60 })
    await user.click(screen.getByRole('radio', { name: 'No' }))
    expect(spies.handleChangeItem).toHaveBeenLastCalledWith({ expire_after_minutes: null })
  })

  it('Save submits through handleClickSubmit; an emptied rate stops it with main\'s alert', async () => {
    let spies = renderStore({ formState: { loading: false, changes: { redemption_rate: '5' } } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(spies.handleClickSubmit).toHaveBeenCalledTimes(1))

    document.body.innerHTML = ''
    spies = renderStore({ formState: { loading: false, changes: { accumulation_rate: '' } } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(ctl.alert).toBe('Value is required'))
    expect(spies.handleClickSubmit).not.toHaveBeenCalled()
  })

  it('the general rules (no store) keep no switch nor expiration, as main', () => {
    renderStore({ isBusiness: false })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })
})
