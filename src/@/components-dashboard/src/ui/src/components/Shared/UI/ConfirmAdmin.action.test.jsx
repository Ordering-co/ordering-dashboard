/* eslint-disable import/first */
// the ConfirmAdminUI wiring for a caller that names `action` (the CheckPassword controller's own
// request to /users/confirm_action is exercised separately, in components/CheckPassword/__tests__). Before
// this change, a password success called `onConfirm()` with nothing and a 6-digit code called `onConfirm(code)`
// the instant it was typed, never checked; both now route through `confirmAction`/`confirmActionStatus`, and
// `onConfirm` only fires once the server confirms, with the one-time `confirmation_token`.
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../index', async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [null, (_key, fallback) => fallback],
    useSession: () => [{ user: { email: 'admin@example.test' } }],
    CheckPassword: ({ UIComponent, ...props }) => (globalThis.__OD_CONFIRM_ADMIN_PROPS__ = props) && ReactModule.createElement(UIComponent, {
      ...props,
      checkPasswordStatus: { result: null, loading: false, error: null },
      checkCodeState: { loading: false, result: { error: false } },
      confirmActionStatus: { result: null, loading: false, error: null },
      confirmAction: vi.fn(),
      confirmTab: 'password',
      otpType: 'email',
      otpState: '',
      getCheckPassword: vi.fn(),
      setOtpType: vi.fn(),
      handleChangeTab: vi.fn(),
      setOtpState: vi.fn(),
      generateOtpCode: vi.fn(),
      handleChangeInput: vi.fn(),
      handleChangeCredentials: vi.fn(),
      ...globalThis.__OD_CONFIRM_ADMIN_ACTION_CONTROLLER__
    })
  }
})
// The Dialog makes the rest of the page inert while open; the Alert needs the same dialog-layer registration
// the real one has (see ConfirmAdmin.test.jsx) so it stays reachable by role instead of hidden behind it.
vi.mock('../Confirm', async () => {
  const ReactModule = await import('react')
  const { useDialogLayer, LEGACY_DIALOG_LAYER } = await import('./dialog-layer')
  return {
    Alert: ({ content, open, title }) => {
      const popupRef = ReactModule.useRef(null)
      const lastFocusedRef = ReactModule.useRef(null)
      useDialogLayer({ open: !!open, kind: LEGACY_DIALOG_LAYER, popupRef, lastFocusedRef })
      return open
        ? <div ref={popupRef} role='alertdialog' aria-label={title}>{Array.isArray(content) ? content.join(' ') : content}</div>
        : null
    }
  }
})
vi.mock('../InputPhoneNumber', () => ({ InputPhoneNumber: () => null }))
vi.mock('react-otp-input', () => ({ default: () => null }))
vi.mock('../../../hooks/useCountdownTimer', () => ({ useCountdownTimer: () => [600, vi.fn(), vi.fn()] }))

import { ConfirmAdmin } from './ConfirmAdmin'

afterEach(() => {
  delete globalThis.__OD_CONFIRM_ADMIN_ACTION_CONTROLLER__
  delete globalThis.__OD_CONFIRM_ADMIN_PROPS__
})

describe('ConfirmAdminUI · routes password and OTP through confirmAction when the caller names an action', () => {
  it('a wrong password (confirmActionStatus.error) shows the error and never calls onConfirm', async () => {
    const onConfirm = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_ACTION_CONTROLLER__ = {
      confirmActionStatus: { result: null, loading: false, error: ['Incorrect password'] }
    }
    render(<ConfirmAdmin open action='orders_delete' onClose={vi.fn()} onConfirm={onConfirm} />)

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Incorrect password')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('the right password (confirmActionStatus.result) calls onConfirm with the confirmation_token', async () => {
    const onConfirm = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_ACTION_CONTROLLER__ = {
      confirmActionStatus: { result: { confirmation_token: 'tok-abc', expires_in: 120 }, loading: false, error: null }
    }
    render(<ConfirmAdmin open action='orders_delete' onClose={vi.fn()} onConfirm={onConfirm} />)

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('tok-abc'))
  })

  it('an action given with a code typed calls confirmAction(code), not onConfirm(code) directly', async () => {
    const onConfirm = vi.fn()
    const confirmAction = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_ACTION_CONTROLLER__ = {
      confirmTab: 'otp',
      otpState: '123456',
      confirmAction
    }
    render(<ConfirmAdmin open action='orders_delete' onClose={vi.fn()} onConfirm={onConfirm} />)

    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith('123456'))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('without an action, a code typed still calls onConfirm(code) directly, as before (legacy callers untouched)', async () => {
    const onConfirm = vi.fn()
    const confirmAction = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_ACTION_CONTROLLER__ = {
      confirmTab: 'otp',
      otpState: '123456',
      confirmAction
    }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={onConfirm} />)

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('123456'))
    expect(confirmAction).not.toHaveBeenCalled()
  })

  it('the controller gets the action (it checks the password at confirm_action)', () => {
    render(<ConfirmAdmin open action='user_enabled' targetId={7} onClose={vi.fn()} onConfirm={vi.fn()} />)

    expect(globalThis.__OD_CONFIRM_ADMIN_PROPS__).toMatchObject({ action: 'user_enabled', targetId: 7 })
  })

  it('without an action, confirmActionStatus is ignored even if it somehow carried a result', async () => {
    const onConfirm = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_ACTION_CONTROLLER__ = {
      confirmActionStatus: { result: { confirmation_token: 'tok-should-not-apply' }, loading: false, error: null }
    }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={onConfirm} />)

    await new Promise(resolve => setTimeout(resolve, 10))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
