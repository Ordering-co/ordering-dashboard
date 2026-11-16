import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../index', async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [null, (_key, fallback) => fallback],
    useSession: () => [{ user: { email: 'admin@example.test' } }],
    CheckPassword: ({ UIComponent, ...props }) => ReactModule.createElement(UIComponent, {
      ...props,
      checkPasswordStatus: { result: null, loading: false, error: null },
      checkCodeState: { loading: false, result: { error: false } },
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
      ...globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__
    })
  }
})

// redesign fix-qa E5: the owner is a Product Dialog now, so the legacy Modal stub is gone and the
// real Product wrappers render here (same as the other redesigned dialogs).

// redesign fix-qa E5: the real Alert is a legacy dialog layer, and the Product Dialog under it stops
// being modal while it is open. The stub joins the same layer registry so that stays true here, and
// the alert is reachable by role instead of hidden behind the dialog's inert page.
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

vi.mock('../InputPhoneNumber', () => ({
  InputPhoneNumber: ({ setValue }) => (
    <button type='button' onClick={() => setValue('+12025550147', true, { number: '2025550147', countryCallingCode: '+1' })}>
      Supply phone
    </button>
  )
}))

vi.mock('react-otp-input', () => ({
  default: ({ containerStyle, inputStyle, isDisabled, numInputs, placeholder, shouldAutoFocus }) => (
    <div className={containerStyle}>
      {Array.from({ length: numInputs }, (_, index) => (
        <input
          key={index}
          aria-label={`OTP ${index + 1}`}
          autoFocus={shouldAutoFocus && index === 0}
          className={inputStyle}
          disabled={isDisabled}
          placeholder={placeholder[index]}
        />
      ))}
    </div>
  )
}))

vi.mock('../../../hooks/useCountdownTimer', () => ({
  useCountdownTimer: () => [600, vi.fn(), vi.fn()]
}))

import { ConfirmAdmin } from './ConfirmAdmin'

afterEach(() => {
  delete globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__
  document.getElementById('app-modals')?.remove()
})

describe('ConfirmAdmin owner', () => {
  it('links its visible heading and retains native password and tab contracts', async () => {
    const user = userEvent.setup()
    const handleChangeTab = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { handleChangeTab }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)

    // redesign fix-qa E5: the Product Dialog is named by its h2 title and has the brand width, not the
    // legacy 600px `data-width`; the tabs are a SegmentedControl whose options are native buttons.
    await screen.findByRole('dialog', { name: 'Confirm password' })
    // the field does not speak of deleting: the dialog also confirms activating or deactivating an admin
    expect(screen.getByPlaceholderText('Type your password to confirm.')).toHaveAttribute('type', 'password')
    const passwordTab = screen.getByRole('button', { name: 'Password' })
    expect(passwordTab.tagName).toBe('BUTTON')
    expect(passwordTab).toHaveAttribute('aria-pressed', 'true')
    const emailTab = screen.getByRole('button', { name: 'Email code' })
    await emailTab.focus()
    await user.keyboard('{Enter}')
    expect(handleChangeTab).toHaveBeenCalledWith('otp')
  })

  // redesign tramo A r3 (W0-QA1-10): with a code chosen, the sentence under the title says to enter the code, not the password
  it('describes the confirmation by the method: password text on the password tab, the code on the code tabs', async () => {
    const description = 'Type your password to confirm. This can’t be undone.'
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = {}
    const { unmount } = render(<ConfirmAdmin open description={description} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(await screen.findByText(description)).toBeInTheDocument()
    unmount()

    for (const otpType of ['email', 'cellphone']) {
      globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { confirmTab: 'otp', otpType }
      const view = render(<ConfirmAdmin open description={description} onClose={vi.fn()} onConfirm={vi.fn()} />)
      expect(await screen.findByText('Enter the verification code to confirm. This can’t be undone.')).toBeInTheDocument()
      expect(screen.queryByText(/password to confirm/i)).toBeNull()
      view.unmount()
    }

    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { confirmTab: 'otp', otpType: 'email' }
    render(<ConfirmAdmin open description={description} otpDescription='Code, please.' onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(await screen.findByText('Code, please.')).toBeInTheDocument()
  })

  it('adds no description to a confirmation that had none, with a code chosen too', async () => {
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { confirmTab: 'otp', otpType: 'email' }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)
    await screen.findByRole('dialog')
    expect(screen.queryByText(/verification code to confirm/)).toBeNull()
  })

  it('keeps zero-argument password confirmation distinct from one-string OTP confirmation', async () => {
    const onPasswordConfirm = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = {
      checkPasswordStatus: { result: 'OK', loading: false, error: null }
    }
    const { unmount } = render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={onPasswordConfirm} />)
    await waitFor(() => expect(onPasswordConfirm).toHaveBeenCalledWith())
    unmount()

    const onOtpConfirm = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = {
      confirmTab: 'otp',
      otpState: '123456'
    }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={onOtpConfirm} />)
    await waitFor(() => expect(onOtpConfirm).toHaveBeenCalledWith('123456'))
  })

  it('keeps early resend functional as a focusable span without claiming disabled semantics', async () => {
    const user = userEvent.setup()
    const generateOtpCode = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = {
      confirmTab: 'otp',
      otpType: 'email',
      generateOtpCode
    }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Get verify code' }))
    expect(generateOtpCode).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('textbox', { name: /OTP/ })).toHaveLength(6)
    const resend = screen.getByRole('button', { name: 'Resend again?' })
    expect(resend.tagName).toBe('SPAN')
    expect(resend).toHaveAttribute('disabled')
    expect(resend).not.toHaveAttribute('aria-disabled')
    resend.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(generateOtpCode).toHaveBeenCalledTimes(3)
  })

  it('keeps the phone credential payload and raw leading-zero channel separate', async () => {
    const user = userEvent.setup()
    const handleChangeCredentials = vi.fn()
    const setCellphoneStartZero = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = {
      confirmTab: 'otp',
      otpType: 'cellphone',
      handleChangeCredentials,
      setCellphoneStartZero
    }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Supply phone' }))
    expect(handleChangeCredentials).toHaveBeenCalledWith({ country_phone_code: '1', cellphone: '2025550147' })
    expect(setCellphoneStartZero).toHaveBeenCalledWith('2025550147')
  })

  it('uses the Ordering.co fallback for its nested alert', async () => {
    const user = userEvent.setup()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = {
      confirmTab: 'otp',
      otpType: 'cellphone'
    }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Get verify code' }))
    expect(screen.getByRole('alertdialog', { name: 'Ordering.co' })).toHaveTextContent('The field Phone Number is required.')
  })
})

// redesign fix-qa E5: the owner on the brand. Same controller calls as before (`getCheckPassword`,
// `generateOtpCode`, `onConfirm()` / `onConfirm(otp)`), new presentation: Product Dialog, optional
// title and description from the consumer, Cancel first and a danger Confirm last, SegmentedControl tabs.
const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button')

describe('ConfirmAdmin owner · Product dialog', () => {
  it('keeps today title and no description by default; title and description props replace them', async () => {
    const { unmount } = render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm password' })
    expect(dialog).not.toHaveAccessibleDescription()
    unmount()

    render(
      <ConfirmAdmin
        open
        title='Delete 3 orders?'
        description='Type your password to confirm. This can’t be undone.'
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    const custom = await screen.findByRole('dialog', { name: 'Delete 3 orders?' })
    expect(custom).toHaveAccessibleDescription('Type your password to confirm. This can’t be undone.')
  })

  it('has Cancel first and a danger Confirm last; Cancel only closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const getCheckPassword = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { getCheckPassword }
    render(<ConfirmAdmin open onClose={onClose} onConfirm={onConfirm} />)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm password' })
    const buttons = footerButtons(dialog)
    expect(buttons.map(button => button.textContent)).toEqual(['Cancel', 'Confirm'])
    expect(buttons[1]).toHaveAttribute('data-variant', 'danger')
    await user.click(buttons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(getCheckPassword).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('the footer Confirm and Enter in the field check the password once each, and an empty field asks for it', async () => {
    const user = userEvent.setup()
    const getCheckPassword = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { getCheckPassword }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm password' })
    await user.click(within(dialog.querySelector('.odc-overlay-foot')).getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alertdialog', { name: 'Ordering.co' })).toHaveTextContent('Password is required')
    expect(getCheckPassword).not.toHaveBeenCalled()

    const field = within(dialog).getByPlaceholderText('Type your password to confirm.')
    await user.type(field, 'secret')
    await user.click(within(dialog.querySelector('.odc-overlay-foot')).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(getCheckPassword).toHaveBeenCalledTimes(1))
    await user.type(field, '{Enter}')
    await waitFor(() => expect(getCheckPassword).toHaveBeenCalledTimes(2))
  })

  it('Escape and the close button ask to close and never confirm', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmAdmin open onClose={onClose} onConfirm={onConfirm} />)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm password' })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('starts the focus on the password field', async () => {
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm password' })
    await waitFor(() => expect(within(dialog).getByPlaceholderText('Type your password to confirm.')).toHaveFocus())
  })

  it('the three ways to confirm are one labelled group of toggle buttons with the same controller calls', async () => {
    const user = userEvent.setup()
    const handleChangeTab = vi.fn()
    const setOtpType = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { confirmTab: 'otp', otpType: 'email', handleChangeTab, setOtpType }
    render(<ConfirmAdmin open onClose={vi.fn()} onConfirm={vi.fn()} />)
    const group = await screen.findByRole('group', { name: 'Confirmation method' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['Password', 'Email code', 'SMS code'])
    await user.click(within(group).getByRole('button', { name: 'SMS code' }))
    expect(setOtpType).toHaveBeenCalledWith('cellphone')
    expect(handleChangeTab).toHaveBeenCalledWith('otp')
    await user.click(within(group).getByRole('button', { name: 'Password' }))
    expect(handleChangeTab).toHaveBeenLastCalledWith('password')
  })

  it('in the code step Back returns to asking for the code, and Cancel still closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const generateOtpCode = vi.fn()
    globalThis.__OD_CONFIRM_ADMIN_UNIT_CONTROLLER__ = { confirmTab: 'otp', otpType: 'email', generateOtpCode }
    render(<ConfirmAdmin open onClose={onClose} onConfirm={vi.fn()} />)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm password' })
    await user.click(within(dialog).getByRole('button', { name: 'Get verify code' }))
    expect(generateOtpCode).toHaveBeenCalledTimes(1)
    expect(within(dialog).queryByRole('button', { name: 'Get verify code' })).toBeNull()
    expect(footerButtons(dialog).map(button => button.textContent)).toEqual(['Cancel'])
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(within(dialog).getByRole('button', { name: 'Get verify code' })).toBeInTheDocument()
    await user.click(within(dialog.querySelector('.odc-overlay-foot')).getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
