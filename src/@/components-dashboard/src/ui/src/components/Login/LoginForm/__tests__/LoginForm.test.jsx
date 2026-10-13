/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  InputPhoneNumber: () => null,
  SpinnerLoader: () => null
}))

vi.mock('../../../../../../index.js', () => ({
  LoginForm: ({ allowedLevels, UIComponent }) => (
    <div
      data-testid='login-controller'
      data-levels={allowedLevels.join(',')}
      data-ui-component={typeof UIComponent}
    />
  ),
  ReCaptcha: () => null,
  useApi: () => [{}, {}],
  useConfig: () => [{}, {}],
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import * as LoginFormModule from '..'

const { LoginForm } = LoginFormModule

describe('LoginForm wiring', () => {
  it('passes the dashboard role levels and UI component to its controller', () => {
    renderWithProviders(
      <ConfigFileContext.Provider value={[{}, vi.fn()]}>
        <LoginForm />
      </ConfigFileContext.Provider>
    )

    expect(screen.getByTestId('login-controller')).toHaveAttribute('data-levels', '0,2,5,8')
    expect(screen.getByTestId('login-controller')).toHaveAttribute('data-ui-component', 'function')
  })
})
