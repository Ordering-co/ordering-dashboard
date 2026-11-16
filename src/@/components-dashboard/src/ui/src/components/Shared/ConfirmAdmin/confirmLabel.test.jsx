/* eslint-disable import/first */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// redesign F6d (Q3-13, C8): a delete confirmation can say the verb with the object on its button instead of the
// generic «Confirm». Opt-in: every other caller keeps «Confirm».
vi.mock('../../../../../index', async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [null, (_key, fallback) => fallback],
    useSession: () => [{ user: { email: 'admin@example.test' } }],
    CheckPassword: ({ UIComponent, ...props }) => ReactModule.createElement(UIComponent, {
      ...props,
      checkPasswordStatus: { result: null, loading: false, error: null },
      checkCodeState: { loading: false, result: { error: false } },
      confirmTab: globalThis.__OD_CONFIRM_LABEL_TAB__ ?? 'password',
      otpType: 'email',
      otpState: '',
      getCheckPassword: vi.fn(),
      setOtpType: vi.fn(),
      handleChangeTab: vi.fn(),
      setOtpState: vi.fn(),
      generateOtpCode: vi.fn(),
      handleChangeInput: vi.fn(),
      handleChangeCredentials: vi.fn()
    })
  }
})
vi.mock('../Confirm', () => ({ Alert: () => null }))
vi.mock('../InputPhoneNumber', () => ({ InputPhoneNumber: () => null }))
vi.mock('react-otp-input', () => ({ default: () => null }))
vi.mock('../../../hooks/useCountdownTimer', () => ({ useCountdownTimer: () => [600, vi.fn(), vi.fn()] }))

import { ConfirmAdmin } from '.'

afterEach(() => { delete globalThis.__OD_CONFIRM_LABEL_TAB__ })

const renderConfirm = (props) => render(
  <ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} {...props} />
)

describe('ConfirmAdmin · confirmLabel (Q3-13)', () => {
  it('keeps «Confirm» on the button when no label is given, as every other caller has it', async () => {
    renderConfirm({ title: 'Remove user?' })
    expect(await screen.findByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('says the verb with the object when the caller gives confirmLabel', async () => {
    renderConfirm({ title: 'Delete order #13601?', confirmLabel: 'Delete order' })
    expect(await screen.findByRole('button', { name: 'Delete order' })).toHaveAttribute('type', 'submit')
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
  })

  it('leaves the OTP step to its own verb: the label belongs to the final destructive action', async () => {
    globalThis.__OD_CONFIRM_LABEL_TAB__ = 'otp'
    renderConfirm({ title: 'Delete 3 orders?', confirmLabel: 'Delete 3 orders' })
    expect(await screen.findByRole('button', { name: 'Get verify code' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete 3 orders' })).not.toBeInTheDocument()
  })
})
