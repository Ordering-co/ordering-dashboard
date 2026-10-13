/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

const dispatchLogin = vi.fn()
const IDLE_FORM_STATE = { loading: false, result: { error: false } }
let orderingProject

vi.mock('~/analytics/posthog', async importOriginal => ({ ...await importOriginal(), captureDashboardOperation: vi.fn(), captureDashboardLoginValidation: vi.fn() }))

vi.mock('../../../Shared', () => ({
  Alert: ({ open, content }) => (open ? <div role='alert'>{content.join(' ')}</div> : null),
  InputPhoneNumber: () => null,
  SpinnerLoader: () => null
}))

vi.mock('../../../../../../index.js', () => ({
  LoginForm: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      formState={IDLE_FORM_STATE}
      loginTab='email'
      useLoginByEmail
      handleChangeInput={vi.fn()}
      handleChangeTab={vi.fn()}
      handleButtonLoginClick={dispatchLogin}
    />
  ),
  ReCaptcha: () => null,
  useApi: () => [{ project: orderingProject }, { configurations: {} }],
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { LoginForm } from '..'
import { captureDashboardOperation, captureDashboardLoginValidation } from '~/analytics/posthog'

const fillCredentialsAndSubmit = () => {
  fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'demo' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@store.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: '12345678' } })
  fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form'))
}

describe('LoginFormUI submit dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    orderingProject = 'demo'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports blocked form validation without an operation or request', async () => {
    renderWithProviders(
      <ConfigFileContext.Provider value={[{}, vi.fn()]}>
        <LoginForm />
      </ConfigFileContext.Provider>
    )
    fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form'))
    await waitFor(() => expect(captureDashboardLoginValidation).toHaveBeenCalledTimes(1))
    expect(captureDashboardLoginValidation).toHaveBeenCalledWith({ action: 'login_email', projectCode: 'demo', validationCode: 'form_invalid' })
    expect(captureDashboardOperation).not.toHaveBeenCalled()
    expect(dispatchLogin).not.toHaveBeenCalled()
  })

  it('dispatches again on a second submit when the first one did not change formState', async () => {
    renderWithProviders(
      <ConfigFileContext.Provider value={[{}, vi.fn()]}>
        <LoginForm />
      </ConfigFileContext.Provider>
    )

    fillCredentialsAndSubmit()
    await waitFor(() => expect(dispatchLogin).toHaveBeenCalledTimes(1))

    fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form'))
    await waitFor(() => expect(dispatchLogin).toHaveBeenCalledTimes(2))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('applies the submitted project before dispatching within the debounce window', async () => {
    const setConfigFile = vi.fn()
    const view = renderWithProviders(
      <ConfigFileContext.Provider value={[{ project: 'demo' }, setConfigFile]}>
        <LoginForm />
      </ConfigFileContext.Provider>
    )

    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'next-project' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@store.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '12345678' } })
    fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form'))

    await act(async () => {})
    expect(setConfigFile).toHaveBeenCalledWith({ project: 'next-project' })
    expect(dispatchLogin).not.toHaveBeenCalled()

    orderingProject = 'next-project'
    view.rerender(
      <ConfigFileContext.Provider value={[{ project: 'next-project' }, setConfigFile]}>
        <LoginForm />
      </ConfigFileContext.Provider>
    )
    await waitFor(() => expect(dispatchLogin).toHaveBeenCalledTimes(1))

    vi.advanceTimersByTime(750)
    expect(setConfigFile).toHaveBeenCalledTimes(1)
  })
})
