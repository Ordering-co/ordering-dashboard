import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../Shared', () => ({
  LearnDropDown: () => null,
  SideBar: ({ children }) => <div>{children}</div>
}))

vi.mock('../../Wallet', () => ({
  Wallet: () => <div>wallet-editor</div>
}))

vi.mock('../../PointsWalletLevels', () => ({
  PointsWalletLevels: () => <div>levels-editor</div>
}))

vi.mock('../../../Settings/FilterSettings', () => ({
  FilterSettings: () => <div>legacy-filter-settings</div>
}))

import { RewardsPrograms } from '../index'

describe('RewardsPrograms', () => {
  it('does not edit project configs on the old loyalty page', () => {
    renderWithProviders(
      <RewardsPrograms isPointsWallets />,
      { initialEntries: ['/loyalty/rewards-programs'], routePath: '/loyalty/rewards-programs' }
    )

    expect(screen.getByText('Points wallet')).toBeInTheDocument()
    expect(screen.queryByText('legacy-filter-settings')).not.toBeInTheDocument()
  })
})
