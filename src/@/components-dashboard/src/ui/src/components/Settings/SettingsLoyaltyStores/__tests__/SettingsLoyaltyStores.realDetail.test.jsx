/* eslint-disable import/first */
// (review of #427): SettingsLoyaltyStores.test.jsx replaces PointsWalletBusinessDetail by a stand-in. Here the real
// form (now on Product fields) is mounted inside EmbeddedWalletForm, and a typed rate must still bubble up to the hub's
// unsaved-changes report, and go clean again when it returns to the saved value.
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `$${value}` }],
  RewardsPrograms: ({ UIComponent, ...props }) => (
    <UIComponent {...props} pointWallet={{ id: 1, redemption_rate: 1, accumulation_rate: 2 }} handleUpdatePointsWallet={vi.fn()} loyaltyPlanList={{ loading: false }} />
  ),
  // the detail's controller, as the real one: the typed value lands in formState.changes
  PointsWalletBusinessDetail: ({ UIComponent, ...props }) => {
    const [changes, setChanges] = useState({})
    return (
      <UIComponent
        {...props}
        formState={{ loading: false, changes }}
        formStateConfigs={{ changes: [] }}
        handleChangeInput={(event) => setChanges(prev => ({ ...prev, [event.target.name]: event.target.value }))}
        handleChangeItem={(item) => setChanges(prev => ({ ...prev, ...item }))}
      />
    )
  }
}))
vi.mock('../../../Shared', () => ({ Alert: () => null }))
vi.mock('../../../Loyalty/PointsWalletBusinessList', () => ({ PointsWalletBusinessList: () => null }))
vi.mock('../../../Loyalty/PointsWalletLevels', () => ({ PointsWalletLevels: () => null }))
vi.mock('../../SettingsList', () => ({ SettingsList: () => null }))

import { SettingsLoyaltyStores } from '../index'

const lastWalletReport = (report) => report.mock.calls.filter(([key]) => key.endsWith(':wallet')).at(-1)

describe('SettingsLoyaltyStores with the real PointsWalletBusinessDetail', () => {
  it('a typed redemption rate reaches the hub as unsaved, and going back to the saved value is clean', () => {
    const report = vi.fn()
    renderWithProviders(
      <SettingsHubFormContext.Provider value={{ product: true, report }}>
        <SettingsLoyaltyStores type='credit_point' category={{ key: 'addon_points_and_levels', configs: [] }} />
      </SettingsHubFormContext.Provider>
    )
    expect(lastWalletReport(report)).toEqual(['addon_points_and_levels:wallet', { dirty: false, saving: false }])

    const [redemption] = screen.getAllByRole('textbox', { name: 'Value' })
    fireEvent.change(redemption, { target: { value: '5' } })
    expect(lastWalletReport(report)).toEqual(['addon_points_and_levels:wallet', { dirty: true, saving: false }])

    fireEvent.change(redemption, { target: { value: '1' } })
    expect(lastWalletReport(report)).toEqual(['addon_points_and_levels:wallet', { dirty: false, saving: false }])
  })
})
