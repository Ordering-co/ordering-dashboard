/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const save = vi.fn()
const refreshConfigs = vi.fn()
const showToast = vi.fn()

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
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
  useConfig: () => [{ configs: {} }, { refreshConfigs }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Error: 'ERROR', Info: 'INFO', Success: 'SUCCESS' },
  useToast: () => [null, { showToast }]
}))

import { SettingsList } from '../index'

const MASTER_ID = 1
const APP_ID = 2

const facebookCategory = () => ({
  id: 11,
  key: 'facebook',
  configs: [
    { id: MASTER_ID, key: 'facebook_login_enabled', type: 2, value: '1', rank: 1 },
    { id: APP_ID, key: 'facebook_id', type: 1, value: 'ghost-app-id', rank: 2 },
    { id: 3, key: 'facebook_secret', type: 7, value: 'ghost-secret', rank: 3 }
  ]
})

const UI = ({ configs, settingsState, handleInputChange, handleClickUpdate }) => (
  <div>
    <span data-testid='changes'>{(settingsState.changes || []).map(item => item.key).join(',')}</span>
    <span data-testid='api'>{settingsState.API ? 'sending' : 'idle'}</span>
    {(configs || []).map(config => (
      <span key={config.key} data-testid={`value-${config.key}`}>{config.value}</span>
    ))}
    <button onClick={() => handleInputChange('', APP_ID)}>clear id</button>
    <button onClick={() => handleInputChange('ghost-app-id', APP_ID)}>restore id</button>
    <button onClick={() => handleInputChange('1', MASTER_ID)}>same master</button>
    <button onClick={() => handleInputChange('0', MASTER_ID)}>master off</button>
    <button onClick={() => handleInputChange('1', MASTER_ID)}>master on</button>
    <button onClick={handleClickUpdate}>save</button>
  </div>
)

describe('SettingsList controller payload sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    save.mockImplementation(async (params) => ({
      content: { error: false, result: { id: params.key === 'facebook_login_enabled' ? MASTER_ID : APP_ID, ...params } }
    }))
    refreshConfigs.mockResolvedValue()
  })

  it('does not send hidden dependents that were edited before the master was turned off', async () => {
    render(<SettingsList UIComponent={UI} category={facebookCategory()} />)

    fireEvent.click(screen.getByText('clear id'))
    fireEvent.click(screen.getByText('master off'))
    expect(screen.getByTestId('changes').textContent).toBe('facebook_id,facebook_login_enabled')

    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    await waitFor(() => expect(refreshConfigs).toHaveBeenCalled())
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ key: 'facebook_login_enabled', value: '0' })
  })

  it('sends edited dependents while their master is on', async () => {
    render(<SettingsList UIComponent={UI} category={facebookCategory()} />)

    fireEvent.click(screen.getByText('clear id'))

    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    await waitFor(() => expect(refreshConfigs).toHaveBeenCalled())
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ key: 'facebook_id', value: '' })
  })

  it('clears pending changes without calling the API when only hidden fields changed', async () => {
    render(<SettingsList UIComponent={UI} category={facebookCategory()} />)

    // Master is on: clear the id, then flip the master off and back on.
    fireEvent.click(screen.getByText('master off'))
    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })
    await waitFor(() => expect(refreshConfigs).toHaveBeenCalledTimes(1))
    save.mockClear()

    // Now off in local state. A stray edit on a hidden field must not reach the API.
    fireEvent.click(screen.getByText('clear id'))
    expect(screen.getByTestId('changes').textContent).toBe('facebook_id')

    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    expect(save).not.toHaveBeenCalled()
    expect(screen.getByTestId('changes').textContent).toBe('')
    expect(screen.getByTestId('api').textContent).toBe('idle')
  })
})

describe('SettingsList controller dirty save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    save.mockImplementation(async (params) => ({
      content: { error: false, result: { id: params.key === 'facebook_login_enabled' ? MASTER_ID : APP_ID, ...params } }
    }))
    refreshConfigs.mockResolvedValue()
  })

  it('does not queue a change when the typed value matches the saved snapshot', async () => {
    render(<SettingsList UIComponent={UI} category={facebookCategory()} />)

    fireEvent.click(screen.getByText('same master'))
    expect(screen.getByTestId('changes').textContent).toBe('')

    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('drops a change when the user reverts to the saved snapshot', async () => {
    render(<SettingsList UIComponent={UI} category={facebookCategory()} />)

    fireEvent.click(screen.getByText('clear id'))
    expect(screen.getByTestId('changes').textContent).toBe('facebook_id')

    fireEvent.click(screen.getByText('restore id'))
    expect(screen.getByTestId('changes').textContent).toBe('')

    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('keeps only the dirty field when a second edit matches its snapshot', async () => {
    render(<SettingsList UIComponent={UI} category={facebookCategory()} />)

    fireEvent.click(screen.getByText('clear id'))
    fireEvent.click(screen.getByText('master off'))
    fireEvent.click(screen.getByText('same master'))

    expect(screen.getByTestId('changes').textContent).toBe('facebook_id')
  })
})

describe('SettingsList controller saveConfigRequest override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshConfigs.mockResolvedValue()
  })

  it('saves through the injected request instead of the project configs API', async () => {
    const saveConfigRequest = vi.fn(async (id, params) => ({
      error: false,
      result: { id, key: params.key, value: params.value }
    }))

    render(
      <SettingsList
        UIComponent={UI}
        staticConfigs={facebookCategory().configs}
        saveConfigRequest={saveConfigRequest}
      />
    )

    fireEvent.click(screen.getByText('clear id'))
    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    await waitFor(() => expect(screen.getByTestId('api').textContent).toBe('idle'))
    expect(saveConfigRequest).toHaveBeenCalledTimes(1)
    expect(saveConfigRequest).toHaveBeenCalledWith(APP_ID, { key: 'facebook_id', value: '' })
    expect(save).not.toHaveBeenCalled()
    expect(refreshConfigs).not.toHaveBeenCalled()
    expect(screen.getByTestId('value-facebook_id').textContent).toBe('')
    expect(showToast).toHaveBeenCalledWith('SUCCESS', 'Settings updated')
  })

  it('surfaces the injected request error without clearing the pending change', async () => {
    const saveConfigRequest = vi.fn(async () => ({ error: true, result: ['API_ERROR_BUSINESS_CONFIG_CONFIG'] }))

    render(
      <SettingsList
        UIComponent={UI}
        staticConfigs={facebookCategory().configs}
        saveConfigRequest={saveConfigRequest}
      />
    )

    fireEvent.click(screen.getByText('clear id'))
    await act(async () => {
      fireEvent.click(screen.getByText('save'))
    })

    await waitFor(() => expect(screen.getByTestId('api').textContent).toBe('idle'))
    expect(saveConfigRequest).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('changes').textContent).toBe('facebook_id')
  })
})
