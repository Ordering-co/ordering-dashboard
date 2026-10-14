/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

let controllerProps = {}
let configs = {}

vi.mock('~/analytics/posthog', async importOriginal => ({ ...await importOriginal(), captureDashboardLoginValidation: vi.fn() }))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  InputPhoneNumber: () => null,
  SpinnerLoader: () => null
}))

vi.mock('../../../../../../index.js', () => ({
  LoginForm: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      formState={{ loading: false, result: { error: false } }}
      loginTab='email'
      useLoginByEmail
      handleChangeInput={vi.fn()}
      handleChangeTab={vi.fn()}
      setOtpType={vi.fn()}
      {...controllerProps}
    />
  ),
  ReCaptcha: () => null,
  useApi: () => [{ project: 'demo' }, { configurations: {} }],
  useConfig: () => [{ configs, loading: false }],
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { LoginForm } from '..'

const renderLogin = (props = {}, configFile = { project: 'demo' }) => renderWithProviders(
  <ConfigFileContext.Provider value={[configFile, vi.fn()]}>
    <LoginForm {...props} />
  </ConfigFileContext.Provider>
)

describe('LoginForm on the Ordering.co brand', () => {
  it('shows the configured local project instead of asking for a hidden project field', () => {
    controllerProps = {}
    configs = {}
    renderLogin({}, { project: 'demo', local_project_pin: 'demo' })

    expect(screen.getByText('demo').closest('p')).toHaveTextContent('Project: demo')
    expect(screen.queryByLabelText('Project')).toBeNull()
    expect(screen.queryByText('Enter your project and account to continue.')).toBeNull()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('labels every field and lets the password be shown', () => {
    controllerProps = {}
    configs = {}
    renderLogin()

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to your dashboard' })).toBeInTheDocument()
    expect(screen.getByLabelText('Project')).toHaveAttribute('id', 'login-project')
    expect(screen.getByText('Enter your project and account to continue.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username')
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the Ordering.co lockup by default and the project logo when set', () => {
    controllerProps = {}
    configs = {}
    const view = renderLogin()
    expect(screen.getAllByAltText('Ordering.co').length).toBeGreaterThan(0)
    view.unmount()

    configs = { dashboard_logo: { value: 'https://cdn.test/brand.png' } }
    renderLogin()
    expect(screen.queryByAltText('Ordering.co')).toBeNull()
    expect(screen.getAllByAltText('Logo').every(img => img.getAttribute('src') === 'https://cdn.test/brand.png')).toBe(true)
  })

  it('offers a method switch only when more than one sign-in method is on', () => {
    controllerProps = {}
    configs = {}
    const view = renderLogin()
    expect(screen.queryByRole('group', { name: 'Sign-in method' })).toBeNull()
    view.unmount()

    controllerProps = { useLoginOtpEmail: true, handleChangeTab: vi.fn() }
    renderLogin()
    const methods = screen.getByRole('group', { name: 'Sign-in method' })
    expect(methods).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Password' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Email code' }))
    expect(controllerProps.handleChangeTab).toHaveBeenCalledWith('otp')
  })

  it('shows an optional context line above the title', () => {
    controllerProps = {}
    configs = {}
    const view = renderLogin()
    expect(screen.queryByRole('note')).toBeNull()
    view.unmount()

    renderLogin({ notice: 'Sign in to connect to docs.ordering.co' })
    expect(screen.getByRole('note')).toHaveTextContent('Sign in to connect to docs.ordering.co')
  })
})
