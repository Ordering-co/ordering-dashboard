/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const authSpy = vi.fn()
const setApiLanguage = vi.fn()
const setSdkLanguage = vi.fn()
const setConfigFile = vi.fn()

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{}, { login: vi.fn(), logout: vi.fn() }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [
    { language: 'en', project: 'demo', setLanguage: setSdkLanguage, users: () => ({ auth: authSpy }) },
    { setLanguage: setApiLanguage }
  ]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ emit: vi.fn() }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: { email_password_login_enabled: { value: '1' } } }]
}))

import { LoginForm } from '..'

const CREDENTIALS = { email: 'owner@store.test', password: '12345678' }

const LoginProbe = ({ formState, handleButtonLoginClick }) => (
  <>
    <button onClick={() => handleButtonLoginClick(CREDENTIALS)}>submit</button>
    <span data-testid='loading'>{String(formState.loading)}</span>
    <span data-testid='error'>{String(formState.result?.error)}</span>
  </>
)

const renderController = () => render(
  <LoginForm
    UIComponent={LoginProbe}
    configFile={{ api: { language: 'en' } }}
    setConfigFile={setConfigFile}
  />
)

const submit = async () => {
  await act(async () => { fireEvent.click(screen.getByText('submit')) })
}

describe('LoginForm controller: stored language differs from the API client', () => {
  beforeEach(() => {
    localStorage.clear()
    authSpy.mockReset().mockResolvedValue({ content: { error: true, result: ['INVALID_CREDENTIALS'] } })
    setApiLanguage.mockReset()
    setSdkLanguage.mockReset()
    setConfigFile.mockReset()
  })

  it('sends exactly one auth request and syncs the API language', async () => {
    localStorage.setItem('language', JSON.stringify({ id: 2, code: 'es' }))
    renderController()

    await submit()

    expect(authSpy).toHaveBeenCalledTimes(1)
    expect(setSdkLanguage).toHaveBeenCalledWith('es')
    expect(setSdkLanguage.mock.invocationCallOrder[0]).toBeLessThan(authSpy.mock.invocationCallOrder[0])
    expect(setApiLanguage).toHaveBeenCalledWith('es')
    expect(setConfigFile).not.toHaveBeenCalled()
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('error').textContent).toBe('true')
  })

  it('leaves the API language alone when it already matches', async () => {
    localStorage.setItem('language', JSON.stringify({ id: 1, code: 'en' }))
    renderController()

    await submit()

    expect(authSpy).toHaveBeenCalledTimes(1)
    expect(setSdkLanguage).not.toHaveBeenCalled()
    expect(setApiLanguage).not.toHaveBeenCalled()
  })
})
