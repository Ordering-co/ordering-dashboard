/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const saveBusinessConfig = vi.fn()
const settingsListRenders = vi.hoisted(() => [])

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessConfigs: ({ UIComponent, ...props }) => <UIComponent {...props} saveBusinessConfig={saveBusinessConfig} />
}))

vi.mock('../../../Settings', () => ({
  SettingsList: ({ staticConfigs, isRemoveGeneralTitle, saveConfigRequest }) => {
    settingsListRenders.push(staticConfigs)
    return (
      <div data-testid='settings-list' data-no-title={String(!!isRemoveGeneralTitle)}>
        {staticConfigs.map(config => <span key={config.id}>{config.key}</span>)}
        <button onClick={() => saveConfigRequest(staticConfigs[0].id, { key: staticConfigs[0].key, value: 'next' })}>
          save first
        </button>
      </div>
    )
  }
}))

import { BusinessConfigs } from '../index'

const pedidosyaBusiness = {
  id: 1505,
  configs: [
    { id: 653, key: 'wallet_cash_enabled', type: 2, value: '1', rank: 124 },
    { id: 3502, key: 'pedidosya_integration_sandbox_mode', type: 2, value: '1', rank: null },
    { id: 3500, key: 'pedidosya_integration_api_token', type: 1, value: 'token', rank: null }
  ]
}

describe('BusinessConfigs UI', () => {
  beforeEach(() => {
    saveBusinessConfig.mockReset()
    settingsListRenders.length = 0
  })

  // redesign stores 5.16 (; G2-35): SettingsList resets its configs from `staticConfigs` in an effect, so a new array
  // on every render of the parent can drop unsaved edits. The sections are rebuilt only when `business.configs` changes.
  it('hands SettingsList the same staticConfigs array when the parent re-renders with the same business.configs', () => {
    const { rerender } = renderWithProviders(<BusinessConfigs business={pedidosyaBusiness} handleSuccessUpdate={vi.fn()} />)
    rerender(<BusinessConfigs business={pedidosyaBusiness} handleSuccessUpdate={vi.fn()} unrelated />)
    rerender(<BusinessConfigs business={{ ...pedidosyaBusiness }} handleSuccessUpdate={vi.fn()} />)

    expect(settingsListRenders.length).toBeGreaterThanOrEqual(3)
    expect(new Set(settingsListRenders).size).toBe(1)
  })

  it('rebuilds staticConfigs when business.configs is a new array', () => {
    const { rerender } = renderWithProviders(<BusinessConfigs business={pedidosyaBusiness} handleSuccessUpdate={vi.fn()} />)
    rerender(<BusinessConfigs business={{ ...pedidosyaBusiness, configs: [...pedidosyaBusiness.configs] }} handleSuccessUpdate={vi.fn()} />)

    expect(new Set(settingsListRenders).size).toBe(2)
  })

  it('renders one SettingsList per registered section with only that section configs', () => {
    renderWithProviders(<BusinessConfigs business={pedidosyaBusiness} handleSuccessUpdate={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Integrations settings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'PedidosYa' })).toBeInTheDocument()

    const lists = screen.getAllByTestId('settings-list')
    expect(lists).toHaveLength(1)
    expect(lists[0].dataset.noTitle).toBe('true')
    expect(lists[0].textContent).toContain('pedidosya_integration_api_token')
    expect(lists[0].textContent).toContain('pedidosya_integration_sandbox_mode')
    expect(lists[0].textContent).not.toContain('wallet_cash_enabled')
  })

  it('renders each integration as its own labelled section', () => {
    renderWithProviders(<BusinessConfigs business={pedidosyaBusiness} handleSuccessUpdate={vi.fn()} />)

    const region = screen.getByRole('region', { name: 'PedidosYa' })
    expect(region).toContainElement(screen.getByTestId('settings-list'))
    expect(screen.queryByText(/keeps its own value/i)).toBeNull()
  })

  it('saves through the business config request', () => {
    renderWithProviders(<BusinessConfigs business={pedidosyaBusiness} handleSuccessUpdate={vi.fn()} />)

    fireEvent.click(screen.getByText('save first'))

    expect(saveBusinessConfig).toHaveBeenCalledWith(3500, { key: 'pedidosya_integration_api_token', value: 'next' })
  })

  it('shows an empty state when no registered section matches the business configs', () => {
    renderWithProviders(<BusinessConfigs business={{ id: 1, configs: [pedidosyaBusiness.configs[0]] }} handleSuccessUpdate={vi.fn()} />)

    expect(screen.queryByTestId('settings-list')).toBeNull()
    expect(screen.getByText(/no integrations settings available for this business/i)).toBeInTheDocument()
  })

  // redesign bugs F row 37: the empty state read #909ba9 on white (2.81:1); the muted brand text token is the AA one
  it('draws the empty state in the muted text token, not the light gray of the theme', () => {
    renderWithProviders(<BusinessConfigs business={{ id: 1, configs: [pedidosyaBusiness.configs[0]] }} handleSuccessUpdate={vi.fn()} />)

    const empty = screen.getByText(/no integrations settings available for this business/i)
    expect(getComputedStyle(empty).color).toBe('var(--od-text-muted)')
  })
})
