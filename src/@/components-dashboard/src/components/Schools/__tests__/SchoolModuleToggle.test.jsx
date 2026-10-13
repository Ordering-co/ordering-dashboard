/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

let configs = {}
let user = { level: 0 }
const save = vi.fn()
const refreshConfigs = vi.fn()
const showToast = vi.fn()

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    setAccessToken: () => ({ configs: () => ({ save }) })
  }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs }, { refreshConfigs }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Error: 'ERROR', Info: 'INFO', Success: 'SUCCESS' },
  useToast: () => [null, { showToast }]
}))

import { SchoolModuleToggle } from '../SchoolModuleToggle'

const UI = ({ isEnabled, canToggle, config, saving, handleEnable, handleDisable }) => (
  <div>
    <span data-testid='state'>{isEnabled ? 'on' : 'off'}</span>
    <span data-testid='can-toggle'>{canToggle ? 'yes' : 'no'}</span>
    <span data-testid='config-id'>{config?.id ?? 'none'}</span>
    <span data-testid='saving'>{saving ? 'saving' : 'idle'}</span>
    <button onClick={handleEnable}>enable</button>
    <button onClick={handleDisable}>disable</button>
  </div>
)

const renderToggle = () => render(<SchoolModuleToggle UIComponent={UI} />)

describe('SchoolModuleToggle controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    user = { level: 0 }
    configs = { school_module_enabled: { id: 77, key: 'school_module_enabled', value: '0' } }
    save.mockResolvedValue({ content: { error: false, result: { id: 77, value: '1' } } })
    refreshConfigs.mockResolvedValue()
  })

  it('reads the module state from the school_module_enabled config', () => {
    renderToggle()
    expect(screen.getByTestId('state').textContent).toBe('off')

    configs = { school_module_enabled: { id: 77, value: '1' } }
    renderToggle()
    expect(screen.getAllByTestId('state')[1].textContent).toBe('on')
  })

  it('exposes the config and lets only administrators with a config row toggle', () => {
    renderToggle()
    expect(screen.getByTestId('config-id').textContent).toBe('77')
    expect(screen.getByTestId('can-toggle').textContent).toBe('yes')

    user = { level: 2 }
    renderToggle()
    expect(screen.getAllByTestId('can-toggle')[1].textContent).toBe('no')

    user = { level: 0 }
    configs = {}
    renderToggle()
    expect(screen.getAllByTestId('can-toggle')[2].textContent).toBe('no')
  })

  it('enables by saving value 1 and refreshing configs', async () => {
    renderToggle()
    await act(async () => { fireEvent.click(screen.getByText('enable')) })

    expect(save).toHaveBeenCalledWith({ value: '1' })
    expect(refreshConfigs).toHaveBeenCalledTimes(1)
    expect(showToast).not.toHaveBeenCalled()
    expect(screen.getByTestId('saving').textContent).toBe('idle')
  })

  it('disables by saving value 0', async () => {
    configs = { school_module_enabled: { id: 77, value: '1' } }
    renderToggle()
    await act(async () => { fireEvent.click(screen.getByText('disable')) })

    expect(save).toHaveBeenCalledWith({ value: '0' })
    expect(refreshConfigs).toHaveBeenCalledTimes(1)
  })

  it('shows a toast and does not refresh when the API fails', async () => {
    save.mockResolvedValue({ content: { error: true, result: ['ERROR_CONFIG_UPDATE'] } })
    renderToggle()
    await act(async () => { fireEvent.click(screen.getByText('enable')) })

    expect(refreshConfigs).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('ERROR', 'ERROR_CONFIG_UPDATE')
    expect(screen.getByTestId('saving').textContent).toBe('idle')
  })

  it('does nothing for non administrators', async () => {
    user = { level: 2 }
    renderToggle()
    await act(async () => { fireEvent.click(screen.getByText('enable')) })

    expect(save).not.toHaveBeenCalled()
    expect(refreshConfigs).not.toHaveBeenCalled()
  })
})
