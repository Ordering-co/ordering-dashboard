import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const showToast = vi.fn()
const handleSaveRule = vi.fn()
const handleInheritRule = vi.fn()
let ruleState

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { format_number_currency: { value: '$' } } }],
  useUtils: () => [{ parsePrice: value => `$${Number(value).toFixed(2)}` }],
  useToast: () => [{}, { showToast }],
  ToastType: { Success: 'success' },
  PayoutRules: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      ruleState={ruleState}
      actionState={{ loading: false, error: null }}
      handleSaveRule={handleSaveRule}
      handleInheritRule={props.ownerId ? handleInheritRule : undefined}
    />
  )
}))

vi.mock('../../Confirm', () => ({
  Alert: ({ open, content }) => open ? <div role='alertdialog'>{content.join(' ')}</div> : null,
  Confirm: ({ open, content, onAccept }) => open
    ? <div role='dialog'>{content}<button type='button' onClick={onAccept}>Accept</button></div>
    : null
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, color, ...props }) => <button type='button' {...props}>{children}</button>
}))

vi.mock('../../../../styles/Select', () => ({
  Select: ({ defaultValue, options, onChange }) => (
    <select aria-label='unit' value={defaultValue} onChange={e => onChange(e.target.value)}>
      {options.map(option => <option key={option.value} value={option.value}>{option.value}</option>)}
    </select>
  )
}))

import { PayoutRuleForm } from '../index'

const platformRule = { fixed: 1, percentage: 10, percentage_base: 'subtotal' }
const driverTotal = () => screen.getByTestId('payout-rule-driver-example-total')

describe('PayoutRuleForm', () => {
  beforeEach(() => {
    showToast.mockReset()
    handleSaveRule.mockReset()
    handleInheritRule.mockReset()
    ruleState = { loading: false, error: null, rule: platformRule, override: null }
  })

  it('shows the saved platform rule as two parts and no Save until something changes', () => {
    renderWithProviders(<PayoutRuleForm scope='platform' />)

    expect(screen.getByRole('heading', { name: 'Platform fee' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fixed amount')).toHaveValue('1')
    expect(screen.getByLabelText('Percentage')).toHaveValue('10')
    expect(screen.getByText('$ fixed per order')).toBeInTheDocument()
    expect(screen.getByLabelText('unit')).toHaveValue('subtotal')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Fixed amount'), { target: { value: '1.5' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Fixed amount'), { target: { value: '1.00' } })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('works the platform rule out on the example order as it is typed', () => {
    renderWithProviders(<PayoutRuleForm scope='platform' />)

    expect(screen.getByText('Order with $20.00 in products, $3.00 delivery fee and $2.00 tip. The customer pays $25.00.')).toBeInTheDocument()
    // 1.00 + 10% of 20.00
    expect(screen.getByTestId('payout-rule-platform-example-total')).toHaveTextContent('$3.00')

    fireEvent.change(screen.getByLabelText('unit'), { target: { value: 'total' } })
    // 1.00 + 10% of 25.00
    expect(screen.getByTestId('payout-rule-platform-example-total')).toHaveTextContent('$3.50')

    fireEvent.change(screen.getByLabelText('Percentage'), { target: { value: 'abc' } })
    expect(screen.getByTestId('payout-rule-platform-example-total')).toHaveTextContent('—')
  })

  it('does not save a value the API would refuse', () => {
    renderWithProviders(<PayoutRuleForm scope='platform' />)

    fireEvent.change(screen.getByLabelText('Percentage'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(handleSaveRule).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a percentage from 0 to 100, with up to 2 decimals.')

    fireEvent.change(screen.getByLabelText('Percentage'), { target: { value: '15' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saves every field and confirms it', async () => {
    handleSaveRule.mockResolvedValue({ error: false, result: {} })
    renderWithProviders(<PayoutRuleForm scope='platform' />)

    fireEvent.change(screen.getByLabelText('Fixed amount'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('success', 'Payout rule saved'))
    expect(handleSaveRule).toHaveBeenCalledWith({ fixed: '2.5', percentage: '10', percentage_base: 'subtotal' })
  })

  it('shows why the API refused a save', async () => {
    handleSaveRule.mockResolvedValue({ error: true, result: ['Somebody else saved this rule'] })
    renderWithProviders(<PayoutRuleForm scope='platform' />)

    fireEvent.change(screen.getByLabelText('Fixed amount'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Somebody else saved this rule')
    expect(showToast).not.toHaveBeenCalled()
  })

  it('starts a driver rule that was never saved from the defaults, ready to save', () => {
    ruleState = { loading: false, error: null, rule: null, override: null }
    renderWithProviders(<PayoutRuleForm scope='driver' />)

    expect(screen.getByRole('heading', { name: 'Driver payment' })).toBeInTheDocument()
    expect(screen.getByText('No rule is saved yet. Orders stay in review until you save one.')).toBeInTheDocument()
    expect(screen.getByLabelText('Per order')).toHaveValue('0')
    expect(screen.getByLabelText('Delivery fee')).toHaveValue('100')
    expect(screen.getByLabelText('Tip')).toHaveValue('100')
    expect(screen.getByLabelText('Extra fixed amount')).toHaveValue('0')
    expect(screen.getByLabelText('Extra percentage')).toHaveValue('0')
    // The whole delivery fee and the whole tip of the example order
    expect(driverTotal()).toHaveTextContent('$5.00')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('keeps the per-order number when its unit changes and saves it as the API keeps it', async () => {
    ruleState = { loading: false, error: null, rule: null, override: null }
    handleSaveRule.mockResolvedValue({ error: false, result: {} })
    renderWithProviders(<PayoutRuleForm scope='driver' />)

    const perOrderUnit = () => screen.getAllByLabelText('unit')[0]
    expect(perOrderUnit()).toHaveValue('fixed')

    fireEvent.change(screen.getByLabelText('Per order'), { target: { value: '10' } })
    // 10.00 fixed + 3.00 + 2.00
    expect(driverTotal()).toHaveTextContent('$15.00')

    fireEvent.change(perOrderUnit(), { target: { value: 'total' } })
    expect(screen.getByLabelText('Per order')).toHaveValue('10')
    expect(perOrderUnit()).toHaveValue('total')
    // 10% of 25.00 + 3.00 + 2.00
    expect(driverTotal()).toHaveTextContent('$7.50')

    fireEvent.change(perOrderUnit(), { target: { value: 'subtotal' } })
    // 10% of 20.00 + 3.00 + 2.00
    expect(driverTotal()).toHaveTextContent('$7.00')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(handleSaveRule).toHaveBeenCalledTimes(1))
    expect(handleSaveRule).toHaveBeenCalledWith({
      order_type: 'percentage',
      order_fixed: '0',
      order_percentage: '10',
      order_base: 'subtotal',
      delivery_fee_percentage: '100',
      tip_percentage: '100',
      additional_fixed: '0',
      additional_percentage: '0',
      additional_base: 'subtotal'
    })
  })

  it('does not carry a number that only fits the other unit into a save', () => {
    ruleState = { loading: false, error: null, rule: null, override: null }
    renderWithProviders(<PayoutRuleForm scope='driver' />)

    fireEvent.change(screen.getByLabelText('Per order'), { target: { value: '150' } })
    fireEvent.change(screen.getAllByLabelText('unit')[0], { target: { value: 'subtotal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(handleSaveRule).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a percentage from 0 to 100, with up to 2 decimals.')
    expect(driverTotal()).toHaveTextContent('—')
  })

  it('shows a store that follows the global rule, read only, until it is given its own', async () => {
    handleSaveRule.mockResolvedValue({ error: false, result: {} })
    renderWithProviders(<PayoutRuleForm scope='platform' ownerId={41} />)

    expect(screen.getByRole('radio', { name: 'Inherit global' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Fixed amount')).toBeDisabled()
    expect(screen.getByLabelText('Fixed amount')).toHaveValue('1')
    expect(screen.getByTestId('payout-rule-platform-example-total')).toHaveTextContent('$3.00')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Override' }))
    expect(screen.getByRole('radio', { name: 'Override' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Fixed amount')).not.toBeDisabled()

    fireEvent.change(screen.getByLabelText('Fixed amount'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(handleSaveRule).toHaveBeenCalledWith({ fixed: '2', percentage: '10', percentage_base: 'subtotal' }))
  })

  it('goes back to the global rule without asking the API when nothing was saved for the store', () => {
    renderWithProviders(<PayoutRuleForm scope='platform' ownerId={41} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Override' }))
    fireEvent.change(screen.getByLabelText('Fixed amount'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Inherit global' }))

    expect(handleInheritRule).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Fixed amount')).toHaveValue('1')
    expect(screen.getByLabelText('Fixed amount')).toBeDisabled()
  })

  it('removes the rule of a store only after it is confirmed', async () => {
    const own = { fixed: 2, percentage: 5, percentage_base: 'total' }
    ruleState = { loading: false, error: null, rule: own, override: own }
    handleInheritRule.mockResolvedValue({ error: false, result: {} })
    renderWithProviders(<PayoutRuleForm scope='platform' ownerId={41} />)

    expect(screen.getByRole('radio', { name: 'Override' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Fixed amount')).toHaveValue('2')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Inherit global' }))
    expect(handleInheritRule).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Remove this rule?')

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('success', 'Now follows the global rule'))
    expect(handleInheritRule).toHaveBeenCalledTimes(1)
  })

  it('offers no rule to follow on the global form', () => {
    renderWithProviders(<PayoutRuleForm scope='platform' />)

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Fixed amount')).not.toBeDisabled()
  })

  it('shows the error of a rule that could not be read', () => {
    ruleState = { loading: false, error: ['Not allowed'], rule: null, override: null }
    renderWithProviders(<PayoutRuleForm scope='platform' />)

    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.queryByLabelText('Fixed amount')).not.toBeInTheDocument()
  })
})
