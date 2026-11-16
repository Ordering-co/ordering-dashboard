/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

const dispatchLogin = vi.fn()
const IDLE_FORM_STATE = { loading: false, result: { error: false } }

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
  useApi: () => [{ project: 'demo' }, { configurations: {} }],
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { LoginForm } from '..'

const submitWithPassword = async password => {
  fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'demo' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@store.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form'))
  })
}

// the rule is `minLength: 5`; the message used to substitute `_min_` with 8.
describe('LoginFormUI password minimum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tells the real minimum (5), not 8, when the password is too short', async () => {
    renderWithProviders(
      <ConfigFileContext.Provider value={[{}, vi.fn()]}>
        <LoginForm />
      </ConfigFileContext.Provider>
    )
    await submitWithPassword('1234')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/^Password must be at least 5 characters$/) // the pattern of «Password is required»
    expect(alert).not.toHaveTextContent('8')
    // the message sits under the password field and the field points at it
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', alert.id)
    expect(dispatchLogin).not.toHaveBeenCalled()
  })

  it('still accepts a password of exactly 5 characters', async () => {
    renderWithProviders(
      <ConfigFileContext.Provider value={[{}, vi.fn()]}>
        <LoginForm />
      </ConfigFileContext.Provider>
    )
    await submitWithPassword('12345')

    await waitFor(() => expect(dispatchLogin).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
