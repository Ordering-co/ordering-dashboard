/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockConfigs = { current: {} }

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useEvent: () => [{ emit: vi.fn() }],
  useConfig: () => [{ configs: mockConfigs.current }],
  GoogleMapsMap: () => null,
  BusinessAdd: ({ UIComponent, ...props }) => (
    <UIComponent {...props} formState={{ changes: {} }} paymethodIds={[]} />
  )
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../BusinessDetails', () => ({ BusinessDetails: () => null }))
vi.mock('../Images', () => ({ Images: () => null }))
vi.mock('../Schedule', () => ({ Schedule: () => null }))
vi.mock('../Photos', () => ({ Photos: () => null }))
vi.mock('../OrderTypePriceLevel', () => ({ OrderTypePriceLevel: () => null }))
vi.mock('../PaymentMethods', () => ({ PaymentMethods: () => null }))
vi.mock('../ReceiveOrders', () => ({ ReceiveOrders: () => null }))
vi.mock('../DeliveryZone', () => ({
  DeliveryZone: ({ disabled }) => <div data-testid='delivery-zone' data-disabled={String(!!disabled)} />
}))
vi.mock('../../../Shared', () => ({ Alert: () => null, Modal: () => null }))

import { BusinessAdd } from '..'

describe('BusinessAdd', () => {
  beforeEach(() => {
    mockConfigs.current = {}
  })

  it('enables the delivery zone when delivery is an allowed order type', () => {
    mockConfigs.current = { order_types_allowed: { value: '1|2|3' } }

    renderWithProviders(<BusinessAdd />)

    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-disabled', 'false')
  })

  it('disables the delivery zone when delivery is not an allowed order type', () => {
    mockConfigs.current = { order_types_allowed: { value: '2|3' } }

    renderWithProviders(<BusinessAdd />)

    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-disabled', 'true')
  })

  it('disables the delivery zone when the order types config is missing', () => {
    renderWithProviders(<BusinessAdd />)

    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-disabled', 'true')
  })
})
