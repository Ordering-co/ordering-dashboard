/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

let configs = {}

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{}, { login: vi.fn(), logout: vi.fn() }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [
    { language: 'en', project: 'demo', setLanguage: vi.fn(), users: () => ({ auth: vi.fn() }) },
    { setLanguage: vi.fn() }
  ]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ emit: vi.fn() }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs }]
}))

import { LoginForm, getLoginSelection } from '..'

const flag = (value) => ({ value })

const WITH_OTP_EMAIL = {
  email_password_login_enabled: flag('1'),
  opt_email_enabled: flag('1'),
  otp_cellphone_enabled: flag('0'),
  phone_password_login_enabled: flag('0')
}

const WITHOUT_OTP = {
  email_password_login_enabled: flag('1'),
  opt_email_enabled: flag('0'),
  otp_cellphone_enabled: flag('0'),
  phone_password_login_enabled: flag('1')
}

const ONLY_OTP_CELLPHONE = {
  email_password_login_enabled: flag('0'),
  opt_email_enabled: flag('0'),
  otp_cellphone_enabled: flag('1'),
  phone_password_login_enabled: flag('0')
}

const ALL_METHODS = {
  email_password_login_enabled: flag('1'),
  opt_email_enabled: flag('1'),
  otp_cellphone_enabled: flag('1'),
  phone_password_login_enabled: flag('1')
}

const NO_METHODS = {
  email_password_login_enabled: flag('0'),
  opt_email_enabled: flag('0'),
  otp_cellphone_enabled: flag('0'),
  phone_password_login_enabled: flag('0')
}

const LoginProbe = ({ loginTab, otpType, handleChangeTab, setOtpType }) => (
  <>
    <button onClick={() => { handleChangeTab('otp'); setOtpType('email') }}>otp-email</button>
    <span data-testid='tab'>{loginTab}</span>
    <span data-testid='otp-type'>{otpType}</span>
  </>
)

const renderController = () => render(<LoginForm UIComponent={LoginProbe} />)

const switchProjectConfigs = (nextConfigs, rerender) => {
  configs = nextConfigs
  act(() => { rerender(<LoginForm UIComponent={LoginProbe} />) })
}

describe('LoginForm controller: login methods change after the project changes', () => {
  beforeEach(() => {
    configs = WITH_OTP_EMAIL
  })

  it('falls back to the default tab when the selected OTP method is no longer available', () => {
    const { rerender } = renderController()
    fireEvent.click(screen.getByText('otp-email'))
    expect(screen.getByTestId('tab').textContent).toBe('otp')
    expect(screen.getByTestId('otp-type').textContent).toBe('email')

    switchProjectConfigs(WITHOUT_OTP, rerender)

    expect(screen.getByTestId('tab').textContent).toBe('email')
  })

  it('falls back to the email tab when the new project exposes no login method flags', () => {
    configs = ALL_METHODS
    const { rerender } = renderController()
    fireEvent.click(screen.getByText('otp-email'))
    expect(screen.getByTestId('tab').textContent).toBe('otp')

    switchProjectConfigs(NO_METHODS, rerender)

    expect(screen.getByTestId('tab').textContent).toBe('email')
  })

  it('switches to the other OTP channel when it is the only OTP method left', () => {
    const { rerender } = renderController()
    fireEvent.click(screen.getByText('otp-email'))

    switchProjectConfigs(ONLY_OTP_CELLPHONE, rerender)

    expect(screen.getByTestId('tab').textContent).toBe('otp')
    expect(screen.getByTestId('otp-type').textContent).toBe('cellphone')
  })

  it('keeps the OTP email selection when the new project still supports it', () => {
    const { rerender } = renderController()
    fireEvent.click(screen.getByText('otp-email'))

    switchProjectConfigs({ ...WITH_OTP_EMAIL, phone_password_login_enabled: flag('1') }, rerender)

    expect(screen.getByTestId('tab').textContent).toBe('otp')
    expect(screen.getByTestId('otp-type').textContent).toBe('email')
  })
})

describe('getLoginSelection', () => {
  const flags = (overrides) => ({
    useLoginByEmail: false,
    useLoginByCellphone: false,
    useLoginOtpEmail: false,
    useLoginOptCellphone: false,
    ...overrides
  })

  it('keeps a valid selection untouched', () => {
    expect(getLoginSelection({ loginTab: 'otp', otpType: 'cellphone' }, flags({ useLoginOtpEmail: true, useLoginOptCellphone: true })))
      .toEqual({ loginTab: 'otp', otpType: 'cellphone' })
    expect(getLoginSelection({ loginTab: 'cellphone', otpType: 'email' }, flags({ useLoginByCellphone: true })))
      .toEqual({ loginTab: 'cellphone', otpType: 'email' })
  })

  it('moves an OTP selection to the available channel or to the default tab', () => {
    expect(getLoginSelection({ loginTab: 'otp', otpType: 'email' }, flags({ useLoginOptCellphone: true })))
      .toEqual({ loginTab: 'otp', otpType: 'cellphone' })
    expect(getLoginSelection({ loginTab: 'otp', otpType: 'cellphone' }, flags({ useLoginOtpEmail: true })))
      .toEqual({ loginTab: 'otp', otpType: 'email' })
    expect(getLoginSelection({ loginTab: 'otp', otpType: 'email' }, flags({ useLoginByEmail: true, useLoginByCellphone: true })))
      .toEqual({ loginTab: 'email', otpType: 'email' })
  })

  it('moves a password selection to the default tab and normalizes the OTP channel', () => {
    expect(getLoginSelection({ loginTab: 'email', otpType: 'email' }, flags({ useLoginOptCellphone: true })))
      .toEqual({ loginTab: 'otp', otpType: 'cellphone' })
    expect(getLoginSelection({ loginTab: 'cellphone', otpType: 'cellphone' }, flags({ useLoginByEmail: true })))
      .toEqual({ loginTab: 'email', otpType: 'cellphone' })
    expect(getLoginSelection({ loginTab: 'email', otpType: 'email' }, flags()))
      .toEqual({ loginTab: 'email', otpType: 'email' })
  })
})
