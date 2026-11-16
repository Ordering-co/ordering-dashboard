/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ user: { level: 0 } }]
}))

vi.mock('../../../../styles/Select', () => ({ Select: () => null }))
vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ placement }) => <div data-testid='first-select' data-placement={placement} />
}))
vi.mock('../../../../styles/MultiSelect', () => ({ MultiSelect: () => null }))
vi.mock('../../../Shared', () => ({ Alert: () => null }))
vi.mock('../../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))

import { OrderStatusTypeSelector } from '..'

const render = (props = {}) => renderWithProviders(
  <OrderStatusTypeSelector isFirstSelect orderId={1} deliveryType={1} defaultValue={0} handleUpdateOrderStatus={vi.fn()} {...props} />
)

describe('OrderStatusTypeSelector placement', () => {
  it('forwards the opt-in placement to the select (used by the order panel footer)', () => {
    render({ placement: 'auto' })
    expect(screen.getByTestId('first-select')).toHaveAttribute('data-placement', 'auto')
  })

  it('does not set a placement for any other consumer', () => {
    render()
    expect(screen.getByTestId('first-select')).not.toHaveAttribute('data-placement')
  })
})
