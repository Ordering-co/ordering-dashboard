/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const saveBusinessConfig = vi.fn()

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessConfigs: ({ UIComponent, ...props }) => <UIComponent {...props} saveBusinessConfig={saveBusinessConfig} />
}))

vi.mock('../../../Settings', () => ({
  SettingsList: ({ staticConfigs, isRemoveGeneralTitle, saveConfigRequest }) => (
    <div data-testid='settings-list' data-no-title={String(!!isRemoveGeneralTitle)}>
      {staticConfigs.map(config => <span key={config.id}>{config.key}</span>)}
      <button onClick={() => saveConfigRequest(staticConfigs[0].id, { key: staticConfigs[0].key, value: 'next' })}>
        save first
      </button>
    </div>
  )
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
})
