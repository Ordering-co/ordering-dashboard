/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

const dispatchLogin = vi.fn()
const IDLE_FORM_STATE = { loading: false, result: { error: false } }
let controllerProps = {}
let translations = {}

vi.mock('~/analytics/posthog', async importOriginal => ({ ...await importOriginal(), captureDashboardOperation: vi.fn(), captureDashboardLoginValidation: vi.fn() }))

// The legacy modal must not be what shows a login error any more: a marker, so a test can tell it came back.
vi.mock('../../../Shared', () => ({
  Alert: ({ open }) => (open ? <div data-testid='legacy-alert-modal' /> : null)
}))
vi.mock('../../../Shared/InputPhoneNumber', () => ({
  InputPhoneNumber: ({ setValue }) => <button type='button' onClick={() => setValue('+15555550123', true, {})}>type a valid phone</button>
}))
vi.mock('../../../Shared/SpinnerLoader', () => ({ SpinnerLoader: () => null }))

vi.mock('../../../../../../index.js', () => ({
  LoginForm: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      formState={IDLE_FORM_STATE}
      loginTab='email'
      useLoginByEmail
      handleChangeInput={vi.fn()}
      handleChangeTab={vi.fn()}
      handleChangeCredentials={vi.fn()}
      setOtpState={vi.fn()}
      setOtpType={vi.fn()}
      handleButtonLoginClick={dispatchLogin}
      {...controllerProps}
    />
  ),
  ReCaptcha: () => null,
  useApi: () => [{ project: 'demo' }, { configurations: {} }],
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [null, (key, fallback) => translations[key] ?? fallback]
}))

import { LoginForm } from '..'

const renderLogin = () => renderWithProviders(
  <ConfigFileContext.Provider value={[{}, vi.fn()]}>
    <LoginForm />
  </ConfigFileContext.Provider>
)

const submitButton = () => screen.getByRole('button', { name: /^sign in$/i })
const submit = async () => {
  await act(async () => { fireEvent.submit(submitButton().closest('form')) })
}
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

// The element a field's aria-describedby points at.
const describedBy = control => {
  const ids = (control.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)
  return ids.map(id => document.getElementById(id)).filter(Boolean)
}

beforeEach(() => {
  vi.clearAllMocks()
  controllerProps = {}
  translations = {}
})

describe('· login validation errors sit next to their field', () => {
  it('shows each message under its own field, linked with aria-describedby and aria-invalid, with no modal', async () => {
    renderLogin()
    await submit()

    const project = screen.getByLabelText('Project')
    const email = screen.getByLabelText('Email')
    const password = screen.getByLabelText('Password')
    const expected = [[project, 'Project is required'], [email, 'Email is required'], [password, 'Password is required']]
    for (const [control, message] of expected) {
      expect(control).toHaveAttribute('aria-invalid', 'true')
      const messages = describedBy(control)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toHaveTextContent(message)
      expect(messages[0]).toHaveClass('odc-field-error')
      // the message is in the same field block as its control, not in a list somewhere else
      expect(messages[0].parentElement).toBe(control.closest('div').parentElement)
    }
    expect(screen.queryByTestId('legacy-alert-modal')).toBeNull()
    expect(dispatchLogin).not.toHaveBeenCalled()
  })

  it('keeps the pattern and minimum-length messages of the old modal', async () => {
    renderLogin()
    fill('Project', 'demo')
    fill('Email', 'not-an-email')
    fill('Password', '1234')
    await submit()

    expect(describedBy(screen.getByLabelText('Email'))[0]).toHaveTextContent('Invalid email address')
    expect(describedBy(screen.getByLabelText('Password'))[0]).toHaveTextContent(/^Password must be at least 5 characters$/) // the pattern of «Password is required»
    expect(describedBy(screen.getByLabelText('Project'))).toHaveLength(0)
    expect(screen.getByLabelText('Project')).not.toHaveAttribute('aria-invalid')
  })

  it('clears a field message when the user corrects the value', async () => {
    renderLogin()
    await submit()
    expect(describedBy(screen.getByLabelText('Email'))).toHaveLength(1)

    // react-hook-form revalidates a registered text input on `input`
    await act(async () => { fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'owner@store.test' } }) })
    await waitFor(() => expect(describedBy(screen.getByLabelText('Email'))).toHaveLength(0))
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
  })

  it('moves the focus to the first field with an error, in visual order', async () => {
    renderLogin()
    await submit()
    expect(screen.getByLabelText('Project')).toHaveFocus()

    fill('Project', 'demo')
    await submit()
    expect(screen.getByLabelText('Email')).toHaveFocus()

    fill('Email', 'owner@store.test')
    await submit()
    expect(screen.getByLabelText('Password')).toHaveFocus()
  })

  it('says every required field as «<Label> is required», each with its own key (.2)', async () => {
    translations = {
      VALIDATION_ERROR_PROJECT_REQUIRED: 'Falta el proyecto',
      AUTH_EMAIL_REQUIRED: 'Falta el correo',
      AUTH_PASSWORD_REQUIRED: 'Falta la contrasena'
    }
    renderLogin()
    await submit()
    expect(describedBy(screen.getByLabelText('Project'))[0]).toHaveTextContent('Falta el proyecto')
    expect(describedBy(screen.getByLabelText('Email'))[0]).toHaveTextContent('Falta el correo')
    expect(describedBy(screen.getByLabelText('Password'))[0]).toHaveTextContent('Falta la contrasena')
  })

  it('says «Phone number is required» with AUTH_PHONE_NUMBER_REQUIRED', async () => {
    controllerProps = { useLoginByEmail: false, useLoginByCellphone: true, loginTab: 'cellphone' }
    renderLogin()
    await submit()
    expect(describedBy(screen.getByLabelText('Phone number'))[0]).toHaveTextContent('Phone number is required')

    cleanup()
    translations = { AUTH_PHONE_NUMBER_REQUIRED: 'Falta el telefono' }
    renderLogin()
    await submit()
    expect(describedBy(screen.getByLabelText('Phone number'))[0]).toHaveTextContent('Falta el telefono')
  })

  it('submits without errors as before', async () => {
    renderLogin()
    fill('Project', 'demo')
    fill('Email', 'owner@store.test')
    fill('Password', '12345678')
    await submit()
    await waitFor(() => expect(dispatchLogin).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the selectors the live session logs in with', () => {
    renderLogin()
    expect(document.querySelector('input[type="text"]')).toHaveAttribute('id', 'login-project')
    expect(document.querySelector('input[name="email"]')).not.toBeNull()
    expect(document.querySelector('input[name="password"]')).not.toBeNull()
    expect(document.querySelector('button[type="submit"]')).toBe(submitButton())
  })
})

describe('· API errors go in an inline notice above the submit button', () => {
  const API_ERROR_STATE = { loading: false, result: { error: true, result: ['Invalid credentials', 'Account is locked'] } }

  it('announces every message of the API in an error notice inside the form, above the button', () => {
    controllerProps = { formState: API_ERROR_STATE }
    renderLogin()

    const notice = screen.getByRole('alert')
    expect(notice).toHaveClass('odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(notice).toHaveTextContent('Invalid credentials')
    expect(notice).toHaveTextContent('Account is locked')
    const form = submitButton().closest('form')
    expect(form).toContainElement(notice)
    expect(notice.compareDocumentPosition(submitButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByTestId('legacy-alert-modal')).toBeNull()
  })

  it('says the network could not be reached when the API sends no message (the SDK throws an event without message)', () => {
    controllerProps = { formState: { loading: false, result: { error: true } } }
    renderLogin()
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't connect. Check your connection and try again.")
    expect(screen.getByRole('alert')).not.toHaveTextContent(/^Error$/)
  })

  it('says the same on the OTP step, translated with AUTH_NETWORK_ERROR', () => {
    controllerProps = { checkPhoneCodeState: { loading: false, result: { error: true } } }
    translations = { AUTH_NETWORK_ERROR: 'Sin conexion' }
    renderLogin()
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexion')
  })

  it('clears the notice when the user sends the form again', async () => {
    controllerProps = { formState: API_ERROR_STATE }
    renderLogin()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fill('Project', 'demo')
    fill('Email', 'owner@store.test')
    fill('Password', '12345678')
    await submit()

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('drops the old API notice when the form is sent again and fails validation: the field takes over', async () => {
    controllerProps = { formState: API_ERROR_STATE }
    renderLogin()
    expect(within(submitButton().closest('form')).getByRole('alert')).toHaveTextContent('Invalid credentials')
    await submit()

    expect(describedBy(screen.getByLabelText('Project'))[0]).toHaveTextContent('Project is required')
    const form = submitButton().closest('form')
    expect(within(form).queryByText('Invalid credentials')).toBeNull()
    expect(form.querySelector('.odc-notice')).toBeNull()
  })

  it('translates each API message as the old modal did (by its slug, the message itself when the dictionary has no entry)', () => {
    controllerProps = { formState: { loading: false, result: { error: true, result: ['try again', 'Something unknown'] } } }
    translations = { TRY_AGAIN: 'Please try again' }
    renderLogin()

    const notice = screen.getByRole('alert')
    expect(notice).toHaveTextContent('Please try again')
    expect(notice).not.toHaveTextContent('try again Something')
    expect(within(notice).queryByText('try again', { exact: true })).toBeNull()
    expect(notice).toHaveTextContent('Something unknown')
  })

  it('translates the messages of the OTP step too', () => {
    controllerProps = { checkPhoneCodeState: { loading: false, result: { error: true, result: ['try again'] } } }
    translations = { TRY_AGAIN: 'Please try again' }
    renderLogin()
    expect(screen.getByRole('alert')).toHaveTextContent('Please try again')
    expect(within(screen.getByRole('alert')).queryByText('try again', { exact: true })).toBeNull()
  })

  it('clears «Phone number is not valid» as soon as the user types a phone', async () => {
    controllerProps = { useLoginOptCellphone: true, loginTab: 'otp', otpType: 'cellphone', credentials: {} }
    renderLogin()
    fill('Project', 'demo')
    await act(async () => { fireEvent.submit(screen.getByRole('button', { name: /^send code$/i }).closest('form')) })
    expect(screen.getByRole('alert')).toHaveTextContent('Phone number is not valid')

    fireEvent.click(screen.getByRole('button', { name: 'type a valid phone' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('clears the notice when the user types a credential again', async () => {
    controllerProps = { formState: API_ERROR_STATE, handleChangeInput: vi.fn() }
    renderLogin()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fill('Email', 'o')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(controllerProps.handleChangeInput).toHaveBeenCalled()
  })

  it('keeps the focus on the submit button when the API refuses a login the user sent', async () => {
    const view = renderLogin()
    fill('Project', 'demo')
    fill('Email', 'owner@store.test')
    fill('Password', '12345678')
    await submit()
    await waitFor(() => expect(dispatchLogin).toHaveBeenCalledTimes(1))
    submitButton().focus()
    // the controller drops the focus when it disables the button while it loads; the answer arrives later
    submitButton().blur()

    controllerProps = { formState: { ...API_ERROR_STATE } }
    await act(async () => {
      view.rerender(
        <ConfigFileContext.Provider value={[{}, vi.fn()]}>
          <LoginForm />
        </ConfigFileContext.Provider>
      )
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    expect(submitButton()).toHaveFocus()
  })
})

describe('A2 · the sign-in method selector is one Tab stop with arrow keys', () => {
  const ALL_METHODS = { useLoginByEmail: true, useLoginOtpEmail: true, useLoginOptCellphone: true, useLoginByCellphone: true }
  const tabs = () => within(screen.getByRole('group', { name: 'Sign-in method' })).getAllByRole('button')

  it('has a single tab stop, on the chosen method', () => {
    controllerProps = { ...ALL_METHODS, loginTab: 'otp', otpType: 'cellphone' }
    renderLogin()

    expect(tabs().map(tab => tab.textContent)).toEqual(['Password', 'Email code', 'Phone code', 'Phone number'])
    expect(tabs().filter(tab => tab.tabIndex === 0).map(tab => tab.textContent)).toEqual(['Phone code'])
    expect(tabs().filter(tab => tab.getAttribute('aria-pressed') === 'true').map(tab => tab.textContent)).toEqual(['Phone code'])
  })

  it('parks the stop on the first method when none is chosen', () => {
    controllerProps = { ...ALL_METHODS, loginTab: 'otp', otpType: 'none' }
    renderLogin()
    expect(tabs().filter(tab => tab.tabIndex === 0).map(tab => tab.textContent)).toEqual(['Password'])
  })

  it('Tab goes through the group in one stop', async () => {
    controllerProps = { ...ALL_METHODS, loginTab: 'email' }
    const user = userEvent.setup()
    renderLogin()

    await user.tab()
    expect(tabs()[0]).toHaveFocus()
    await user.tab()
    expect(tabs().includes(document.activeElement)).toBe(false)
    expect(screen.getByLabelText('Project')).toHaveFocus()
    await user.tab({ shift: true })
    expect(tabs()[0]).toHaveFocus()
  })

  it('moves the focus with the arrows, Home and End, and wraps around', async () => {
    controllerProps = { ...ALL_METHODS, loginTab: 'email' }
    const user = userEvent.setup()
    renderLogin()

    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(tabs()[1]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(tabs()[2]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(tabs()[1]).toHaveFocus()
    await user.keyboard('{End}')
    expect(tabs()[3]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(tabs()[0]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(tabs()[3]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tabs()[0]).toHaveFocus()
    // the stop follows the focus, so Shift+Tab leaves the group
    await user.keyboard('{ArrowRight}')
    await user.tab({ shift: true })
    expect(tabs().includes(document.activeElement)).toBe(false)
  })

  it('an arrow only moves the focus; Space or Enter chooses the method', async () => {
    const handleChangeTab = vi.fn()
    const setOtpType = vi.fn()
    controllerProps = { ...ALL_METHODS, loginTab: 'email', handleChangeTab, setOtpType }
    const user = userEvent.setup()
    renderLogin()

    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(handleChangeTab).not.toHaveBeenCalled()
    await user.keyboard(' ')
    expect(handleChangeTab).toHaveBeenCalledWith('otp')
    expect(setOtpType).toHaveBeenCalledWith('email')
  })

  it('offers Phone code only when the project has it', () => {
    controllerProps = { useLoginByEmail: true, useLoginOtpEmail: true, loginTab: 'email' }
    renderLogin()
    expect(tabs().map(tab => tab.textContent)).toEqual(['Password', 'Email code'])
  })
})

describe('A3 · partners portal copy', () => {
  it('says «Log in» as a verb', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: 'Sign up for free / Log in via partners portal' })).toBeInTheDocument()
    expect(screen.queryByText(/Login via partners portal/)).toBeNull()
  })
})
