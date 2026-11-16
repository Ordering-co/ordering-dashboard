/* eslint-disable import/first */
// main on the redesign's PaymentOption (ProviderPanel): rewritten for
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { PaymentOption } from '../index'

const CASH = { id: 1, gateway: 'cash', name: 'Cash' }

const baseProps = () => ({
  paymethod: CASH,
  businessPaymethod: { id: 77, paymethod_id: 1, enabled: true, allowed_order_types: [1], sites: [], devices: [] },
  gatewayName: 'Cash',
  storeName: 'Burger Hub',
  sites: [{ id: 5, name: 'Website' }],
  devices: [],
  orderTypes: [{ value: 1, text: 'Delivery' }, { value: 2, text: 'Pickup' }]
})

const setup = (props = {}) => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  const utils = renderWithProviders(<PaymentOption {...baseProps()} onSave={onSave} onTabChange={onTabChange} {...props} />, { theme })
  return { user, onSave, onTabChange, ...utils }
}

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent)

/**
 * The panel of the payment methods with no panel of their own (cash, card on
 * delivery…). Stripe Connect v2 adds tabs to it through `extraTabs`; this
 * fixes what it does for everybody else, who pass none.
 */
describe('PaymentOption without tabs of the gateway', () => {
  it('names the payment method and opens on Channels, the first tab', () => {
    const { onTabChange } = setup()

    expect(screen.getByRole('tablist', { name: 'Cash' })).toBeInTheDocument()
    expect(tabNames()).toEqual(['Channels', 'Order type', 'Devices'])
    expect(screen.getByRole('tab', { name: 'Channels' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('checkbox', { name: 'All' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Delivery' })).not.toBeInTheDocument()
    expect(onTabChange).not.toHaveBeenCalled()
  })

  // main also fell back to a generic «Paymethod» name when the payment method was unknown. The wrapper has no such fallback: the list
  // always passes `gatewayName`, and the panel falls back to `paymethod.name` and then to nothing, which is what is checked here.
  it('falls back to the name of the payment method when no gatewayName comes', () => {
    setup({ gatewayName: undefined })

    expect(screen.getByRole('tablist', { name: 'Cash' })).toBeInTheDocument()
  })

  it('opens on the tab initialTab names, as a number, without reporting it', () => {
    const { onTabChange } = setup({ initialTab: 1 })

    expect(screen.getByRole('tab', { name: 'Order type' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'All' })).not.toBeInTheDocument()
    expect(onTabChange).not.toHaveBeenCalled()
  })

  it('reports the tab that is chosen as its number, never null', async () => {
    const { user, onTabChange } = setup()

    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(screen.getByRole('checkbox', { name: 'Pickup' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Devices' }))
    await user.click(screen.getByRole('tab', { name: 'Channels' }))

    expect(onTabChange.mock.calls).toEqual([[1], [2], [0]])
  })

  it('reports the order types that are checked, when it is saved', async () => {
    const { user, onSave } = setup({ initialTab: 1 })

    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ allowed_order_types: [1, 2] })
  })

  it('offers Devices only to the payment methods that take them', () => {
    const { unmount } = setup()
    expect(screen.getByRole('tab', { name: 'Devices' })).toBeInTheDocument()
    unmount()

    const { unmount: unmountCard } = setup({ paymethod: { ...CASH, gateway: 'card_delivery' } })
    expect(screen.getByRole('tab', { name: 'Devices' })).toBeInTheDocument()
    unmountCard()

    setup({ paymethod: { ...CASH, gateway: 'izipay' } })
    expect(tabNames()).toEqual(['Channels', 'Order type'])
  })

  it('shows Save only once something changed', async () => {
    const { user, onSave } = setup({ initialTab: 1 })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
