import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import catalog from '../../../../../../../../../../i18n/translations.json'

// What t() finds in the dictionary of the project (empty: the fallback of the code)
const lang = vi.hoisted(() => ({ dictionary: {} }))

// The controller is replaced by a stateful stand-in that owns the saved wallet, like RewardsPrograms does.
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => lang.dictionary[key] ?? fallback],
  RewardsPrograms: ({ UIComponent, ...props }) => {
    const [pointWallet, setPointWallet] = useState({ id: 1, redemption_rate: 1, accumulation_rate: 2 })
    return (
      <UIComponent
        {...props}
        pointWallet={pointWallet}
        handleUpdatePointsWallet={changes => setPointWallet({ ...changes })}
        loyaltyPlanList={{ loading: false }}
      />
    )
  }
}))

// Like the real form: the input shows the typed value or else the saved one; «Save» hands the new wallet to the controller.
vi.mock('../../../Loyalty/PointsWalletBusinessDetail', () => ({
  PointsWalletBusinessDetail: ({ walletData, handleUpdatePointsWallet }) => {
    const [typed, setTyped] = useState({})
    return (
      <div data-testid='loyalty-general'>
        <input
          aria-label='Points redemption'
          name='redemption_rate'
          value={typed.redemption_rate ?? walletData?.redemption_rate ?? ''}
          onChange={event => setTyped({ ...typed, redemption_rate: event.target.value })}
        />
        <button type='button' onClick={() => handleUpdatePointsWallet({ ...walletData, ...typed })}>Save wallet</button>
      </div>
    )
  }
}))

vi.mock('../../../Loyalty/PointsWalletBusinessList', () => ({
  // The open store detail tells its parent through `onDirtyChange`; the stand-in sends it from a field.
  PointsWalletBusinessList: ({ onDirtyChange }) => (
    <div data-testid='loyalty-businesses'>
      <input aria-label='Store redemption' onChange={event => onDirtyChange && onDirtyChange(event.target.value === '150')} />
    </div>
  )
}))

vi.mock('../../../Loyalty/PointsWalletLevels', () => ({
  // Same for the open level.
  PointsWalletLevels: ({ onDirtyChange }) => (
    <div data-testid='loyalty-levels'>
      <input aria-label='Level name' onChange={event => onDirtyChange && onDirtyChange(event.target.value === 'Gold')} />
    </div>
  )
}))

vi.mock('../../SettingsList', () => ({
  SettingsList: ({ focus }) => <div data-testid='loyalty-addon' data-focus={focus || ''} />
}))

import { SettingsLoyaltyStores } from '../index'

describe('SettingsLoyaltyStores', () => {
  afterEach(() => { lang.dictionary = {} })

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

  // the tab list names the wallet it belongs to
  // (N-ST3): the catalog is what a project shows, so the copy is checked there: «Set up» is a verb, «Cash wallet» sentence case
  it('says «Set up» and «Cash wallet» with the texts of the catalog', () => {
    lang.dictionary = Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, value.en]))
    const { unmount } = renderWithProviders(
      <SettingsLoyaltyStores type='credit_point' category={{ key: 'addon_points_and_levels', configs: [] }} />
    )
    expect(screen.getByText('Set up different loyalty levels for your users.')).toBeInTheDocument()
    unmount()
    renderWithProviders(<SettingsLoyaltyStores type='cashback' category={{ key: 'addon_cash_wallet_and_refunds', configs: [] }} />)
    expect(screen.getByRole('heading', { name: 'Cash wallet' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Cash wallet' })).toBeInTheDocument()
  })

  it('names the tab list after its own wallet', () => {
    const { unmount } = renderWithProviders(
      <SettingsLoyaltyStores type='credit_point' category={{ key: 'addon_points_and_levels', configs: [] }} />
    )
    expect(screen.getByRole('tablist', { name: 'Points wallet' })).toBeInTheDocument()
    unmount()

    renderWithProviders(
      <SettingsLoyaltyStores type='cashback' category={{ key: 'addon_cash_wallet_and_refunds', configs: [] }} />
    )
    expect(screen.getByRole('tablist', { name: 'Cash wallet' })).toBeInTheDocument()
  })

  // the addon list inside the card is the one that lands `?focus=` on its row
  it('hands `focus` to the addon list', () => {
    renderWithProviders(
      <SettingsLoyaltyStores
        type='credit_point'
        focus='loyalty_points_enabled'
        category={{ key: 'addon_points_and_levels', configs: [{ key: 'loyalty_points_enabled' }] }}
      />
    )
    expect(screen.getByTestId('loyalty-addon')).toHaveAttribute('data-focus', 'loyalty_points_enabled')
  })
})

// (owner decision 17): the wallet form is a legacy editor; it must tell the hub when it holds unsaved values.
describe('SettingsLoyaltyStores and the hub guard', () => {
  const renderInHub = ({ type = 'cashback', key = 'addon_cash_wallet_and_refunds' } = {}) => {
    const report = vi.fn()
    const view = renderWithProviders(
      <SettingsHubFormContext.Provider value={{ product: true, report }}>
        <SettingsLoyaltyStores type={type} category={{ key, configs: [{ key: 'x' }] }} />
      </SettingsHubFormContext.Provider>
    )
    return { ...view, report }
  }
  const lastReport = (report) => report.mock.calls.filter(([key]) => key.endsWith(':wallet')).at(-1)

  it('reports dirty when «Points redemption» differs from the saved value, clean when it goes back', () => {
    const { report } = renderInHub()
    expect(lastReport(report)).toEqual(['addon_cash_wallet_and_refunds:wallet', { dirty: false, saving: false }])

    fireEvent.change(screen.getByLabelText('Points redemption'), { target: { value: '250' } })
    expect(lastReport(report)).toEqual(['addon_cash_wallet_and_refunds:wallet', { dirty: true, saving: false }])

    fireEvent.change(screen.getByLabelText('Points redemption'), { target: { value: '1' } })
    expect(lastReport(report)).toEqual(['addon_cash_wallet_and_refunds:wallet', { dirty: false, saving: false }])
  })

  it('goes back to clean once the wallet is saved', () => {
    const { report } = renderInHub({ type: 'credit_point', key: 'addon_points_and_levels' })
    fireEvent.change(screen.getByLabelText('Points redemption'), { target: { value: '250' } })
    expect(lastReport(report)[1].dirty).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Save wallet' }))
    expect(lastReport(report)).toEqual(['addon_points_and_levels:wallet', { dirty: false, saving: false }])
  })

  it('is clean when the form leaves with the tab, and drops its report on unmount', () => {
    const { report, unmount } = renderInHub()
    fireEvent.change(screen.getByLabelText('Points redemption'), { target: { value: '250' } })
    expect(lastReport(report)[1].dirty).toBe(true)

    fireEvent.click(screen.getByRole('tab', { name: 'Per-store wallet rules' }))
    expect(lastReport(report)[1].dirty).toBe(false)

    fireEvent.click(screen.getByRole('tab', { name: 'Defaults for all businesses' }))
    fireEvent.change(screen.getByLabelText('Points redemption'), { target: { value: '9' } })
    expect(lastReport(report)[1].dirty).toBe(true)
    unmount()
    expect(lastReport(report)).toEqual(['addon_cash_wallet_and_refunds:wallet', null])
  })

  it('does not collide with the addon list, which reports under the category key', () => {
    const { report } = renderInHub()
    fireEvent.change(screen.getByLabelText('Points redemption'), { target: { value: '250' } })
    const keys = new Set(report.mock.calls.map(([key]) => key))
    expect(keys.has('addon_cash_wallet_and_refunds')).toBe(false)
  })

  it('works without the hub', () => {
    renderWithProviders(<SettingsLoyaltyStores type='cashback' category={{ key: 'k', configs: [] }} />)
    expect(() => fireEvent.change(screen.getByLabelText('Points redemption'), { target: { value: '5' } })).not.toThrow()
  })

  // (R9 leftovers of ): the level detail and the per-store rules guard the section too.
  it('reports the open level under its own key, without touching the wallet one', () => {
    const { report } = renderInHub({ type: 'credit_point', key: 'addon_points_and_levels' })
    const lastLevels = () => report.mock.calls.filter(([key]) => key.endsWith(':levels')).at(-1)
    expect(lastLevels()).toEqual(['addon_points_and_levels:levels', { dirty: false, saving: false }])

    fireEvent.change(screen.getByLabelText('Level name'), { target: { value: 'Gold' } })
    expect(lastLevels()).toEqual(['addon_points_and_levels:levels', { dirty: true, saving: false }])
    expect(lastReport(report)[1].dirty).toBe(false)

    fireEvent.change(screen.getByLabelText('Level name'), { target: { value: 'Level 1' } })
    expect(lastLevels()).toEqual(['addon_points_and_levels:levels', { dirty: false, saving: false }])
  })

  it('reports the open store rules under their own key, and drops them with the tab', () => {
    const { report } = renderInHub({ type: 'credit_point', key: 'addon_points_and_levels' })
    const lastStore = () => report.mock.calls.filter(([key]) => key.endsWith(':store-rules')).at(-1)
    fireEvent.click(screen.getByRole('tab', { name: 'Per-store wallet rules' }))
    expect(lastStore()).toEqual(['addon_points_and_levels:store-rules', { dirty: false, saving: false }])

    fireEvent.change(screen.getByLabelText('Store redemption'), { target: { value: '150' } })
    expect(lastStore()).toEqual(['addon_points_and_levels:store-rules', { dirty: true, saving: false }])

    fireEvent.click(screen.getByRole('tab', { name: 'Defaults for all businesses' }))
    expect(lastStore()).toEqual(['addon_points_and_levels:store-rules', { dirty: false, saving: false }])
  })

  it('drops the level and store-rules reports on unmount', () => {
    const { report, unmount } = renderInHub({ type: 'credit_point', key: 'addon_points_and_levels' })
    fireEvent.change(screen.getByLabelText('Level name'), { target: { value: 'Gold' } })
    unmount()
    const last = suffix => report.mock.calls.filter(([key]) => key.endsWith(suffix)).at(-1)
    expect(last(':levels')).toEqual(['addon_points_and_levels:levels', null])
    expect(last(':store-rules')).toEqual(['addon_points_and_levels:store-rules', null])
  })
})
