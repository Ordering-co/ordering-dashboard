/* eslint-disable import/first */
// dashboard-beta.ordering.co is a shared host like dashboard.ordering.co, so any customer signs in
// there by typing their project. The Worker injects use_project_domain=true on every host.
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

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
      formState={{ loading: false, result: { error: false } }}
      loginTab='email'
      useLoginByEmail
      handleChangeInput={vi.fn()}
      handleChangeTab={vi.fn()}
      handleButtonLoginClick={vi.fn()}
    />
  ),
  ReCaptcha: () => null,
  useApi: () => [{ project: null }, { configurations: {} }],
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { LoginForm } from '..'

const renderOn = (hostname) => {
  const { pathname, search, hash } = window.location
  vi.stubGlobal('location', { ...window.location, hostname, pathname, search, hash })
  return renderWithProviders(
    <ConfigFileContext.Provider value={[{}, vi.fn()]}>
      <LoginForm useProjectDomain />
    </ConfigFileContext.Provider>
  )
}

describe('LoginForm on the beta host', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for the project on dashboard-beta.ordering.co', () => {
    renderOn('dashboard-beta.ordering.co')
    expect(screen.getByLabelText('Project')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })

  it('does not ask for it on a customer domain, where the domain names the project', () => {
    renderOn('dashboard.customer.example')
    expect(screen.queryByLabelText('Project')).toBeNull()
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })
})
