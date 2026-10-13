import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  RewardsPrograms: ({ UIComponent, ...props }) => <UIComponent {...props} loyaltyPlanList={{ loading: false }} />
}))

vi.mock('../../../Loyalty/PointsWalletBusinessDetail', () => ({
  PointsWalletBusinessDetail: () => <div data-testid='loyalty-general' />
}))

vi.mock('../../../Loyalty/PointsWalletBusinessList', () => ({
  PointsWalletBusinessList: () => <div data-testid='loyalty-businesses' />
}))

vi.mock('../../../Loyalty/PointsWalletLevels', () => ({
  PointsWalletLevels: () => <div data-testid='loyalty-levels' />
}))

vi.mock('../../SettingsList', () => ({
  SettingsList: () => <div data-testid='loyalty-addon' />
}))

import { SettingsLoyaltyStores } from '../index'

describe('SettingsLoyaltyStores', () => {
  it('shows points wallet general, businesses, levels and addon', () => {
    renderWithProviders(
      <SettingsLoyaltyStores
        type='credit_point'
        category={{ key: 'addon_points_and_levels', configs: [{ key: 'addon_points_and_levels' }] }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Points wallet' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Defaults for all businesses' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('loyalty-general')).toBeInTheDocument()
    expect(screen.queryByTestId('loyalty-businesses')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Per-store wallet rules' }))
    expect(screen.getByTestId('loyalty-businesses')).toBeInTheDocument()
    expect(screen.queryByTestId('loyalty-general')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Levels' })).toBeInTheDocument()
    expect(screen.getByTestId('loyalty-levels')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Loyalty points & levels addon' })).toBeInTheDocument()
    expect(screen.getByTestId('loyalty-addon')).toBeInTheDocument()
  })

  it('hides levels on the cash wallet section', () => {
    renderWithProviders(
      <SettingsLoyaltyStores
        type='cashback'
        category={{ key: 'addon_cash_wallet_and_refunds', configs: [] }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Cash wallet' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Levels' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('loyalty-levels')).not.toBeInTheDocument()
  })
})
