/* eslint-disable import/first */
// the Payment methods section of the delivery provider panel, on the Product pick list. Each method says its
// gateway (main printed «Google Pay» three times without saying which), the search is labelled, the rows are Product
// checkboxes and the actions call the same controller handlers as main.
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback]
}))

import { DeliveryServicePaymethods } from '..'

const PAYMETHODS = [
  { id: 1, name: 'Google Pay', gateway: 'google_pay' },
  { id: 2, name: 'Google Pay', gateway: 'google_pay_braintree' },
  { id: 3, name: 'Cash', gateway: 'cash' }
]

const baseProps = (props = {}) => ({
  deliveryServiceState: { deliveryService: { id: 3 } },
  paymethods: PAYMETHODS,
  actionState: { loading: false },
  changesState: {},
  selectedPaymethodIds: [],
  handleAddDeliveryService: vi.fn(),
  handleUpdateDeliveryGroup: vi.fn(),
  handleSelectPaymethod: vi.fn(),
  handleSelectAllPaymethod: vi.fn(),
  ...props
})

const draw = (props = {}) => {
  const all = baseProps(props)
  render(<DeliveryServicePaymethods {...all} />)
  return all
}

afterEach(cleanup)

describe('DeliveryServicePaymethods', () => {
  it('each method shows its gateway, so two methods with the same name are told apart', () => {
    draw()
    expect(screen.getByText('google_pay')).toBeInTheDocument()
    expect(screen.getByText('google_pay_braintree')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: 'Google Pay' })).toHaveLength(2)
  })

  it('shows the rows when the methods arrive after the section mounted', () => {
    const all = baseProps({ paymethods: [] })
    const { rerender } = render(<DeliveryServicePaymethods {...all} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    rerender(<DeliveryServicePaymethods {...all} paymethods={PAYMETHODS} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('filters by name with a labelled Product search', async () => {
    draw()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search payment methods' }), 'cash')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search payment methods' }), 'zzz')
    expect(screen.getByText('Nothing matches your search')).toBeInTheDocument()
  })

  it('Select all / Select none are Product buttons that call the controller', async () => {
    const props = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(props.handleSelectAllPaymethod).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.handleSelectAllPaymethod).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('button', { name: 'Select all' })).toHaveClass('odc-btn')
  })

  it('a row is a Product checkbox that toggles through the controller', async () => {
    const props = draw({ selectedPaymethodIds: [3] })
    expect(screen.getByRole('checkbox', { name: 'Cash' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Google Pay' })[1])
    expect(props.handleSelectPaymethod).toHaveBeenCalledWith(2, true)
  })

  it('Save is disabled without changes and saves the changes on the group, as main', async () => {
    const changesState = { allowed_paymethods: '[1]' }
    const props = draw({ changesState })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(save)
    expect(props.handleUpdateDeliveryGroup).toHaveBeenCalledWith(changesState)
    cleanup()
    draw()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('without a group it is «Add» and creates it, as main', async () => {
    const props = draw({ deliveryServiceState: { deliveryService: null }, changesState: { allowed_paymethods: '[1]' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(props.handleAddDeliveryService).toHaveBeenCalled()
  })

  it('is busy while it saves', () => {
    draw({ actionState: { loading: true }, changesState: { allowed_paymethods: '[1]' } })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
  })
})
