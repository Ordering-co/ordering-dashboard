/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

const handleResetPassword = vi.fn()
const redirectResetPassword = vi.fn()
const onPasswordReset = vi.fn()
const IDLE_FORM_STATE = { loading: false, result: { error: false } }
let controllerProps = {}
let translations = {}

// The legacy modal must not be what shows an error or the success any more: a marker, so a test can tell it came back.
vi.mock('../../../Shared', () => ({
  Alert: ({ open }) => (open ? <div role='dialog' data-testid='legacy-alert-modal' /> : null)
}))

vi.mock('../../../../../../index.js', () => ({
  ResetPassword: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      formState={IDLE_FORM_STATE}
      handleResetPassword={handleResetPassword}
      handleChangeInput={vi.fn()}
      resetPasswordData={{}}
      redirectResetPassword={redirectResetPassword}
      onPasswordReset={onPasswordReset}
      {...controllerProps}
    />
  ),
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [null, (key, fallback) => translations[key] ?? fallback]
}))

import { ResetPassword } from '..'

let elementProps
const tree = () => (
  <ConfigFileContext.Provider value={[{}, vi.fn()]}>
    <ResetPassword {...elementProps} />
  </ConfigFileContext.Provider>
)
const renderReset = (props = { code: 'abc', random: 'xyz' }) => {
  elementProps = props
  return renderWithProviders(tree())
}
const rerenderWith = async (view, props) => {
  controllerProps = props
  await act(async () => { view.rerender(tree()) })
}

const changeButton = () => screen.getByRole('button', { name: /^(change password|saving…)$/i })
const codesButton = () => screen.getByRole('button', { name: /^submit codes$/i })
const submitIn = async button => {
  await act(async () => { fireEvent.submit(button.closest('form')) })
}
// `input`, not `change`: the library watches the new password (to compare the confirmation) on input events
const fill = (label, value) => fireEvent.input(screen.getByLabelText(label), { target: { value } })
const fillValid = () => {
  fill('Project', 'demo')
  fill('New password', '12345678')
  fill('Confirm password', '12345678')
}

const describedBy = control => {
  const ids = (control.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)
  return ids.map(id => document.getElementById(id)).filter(Boolean)
}

beforeEach(() => {
  vi.clearAllMocks()
  controllerProps = {}
  translations = {}
})

describe('· reset password validation errors sit next to their field', () => {
  it('shows each message under its own field, with aria-invalid and aria-describedby, and no dialog', async () => {
    renderReset()
    await submitIn(changeButton())

    const expected = [
      [screen.getByLabelText('Project'), 'Project is required', 'reset-project-error'],
      [screen.getByLabelText('New password'), 'New password is required', 'reset-password-error'],
      [screen.getByLabelText('Confirm password'), 'Confirm password is required', 'reset-confirm-password-error']
    ]
    for (const [control, message, id] of expected) {
      expect(control).toHaveAttribute('aria-invalid', 'true')
      const messages = describedBy(control)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toHaveAttribute('id', id)
      expect(messages[0]).toHaveTextContent(message)
      expect(messages[0]).toHaveClass('odc-field-error')
      expect(messages[0].parentElement).toBe(control.closest('div').parentElement)
    }
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(screen.queryByTestId('legacy-alert-modal')).toBeNull()
    expect(handleResetPassword).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Project')).toHaveFocus()
  })

  it('moves the focus to the first field with an error, in visual order', async () => {
    renderReset()
    fill('Project', 'demo')
    await submitIn(changeButton())
    expect(screen.getByLabelText('New password')).toHaveFocus()

    fill('New password', '12345678')
    await submitIn(changeButton())
    expect(screen.getByLabelText('Confirm password')).toHaveFocus()
  })

  it('keeps the minimum length and the passwords-do-not-match messages, each under its field', async () => {
    // the live catalog keeps «The Password must be…» on the old key (user forms still read it), so reset reads its own
    translations = { VALIDATION_ERROR_PASSWORD_MIN_STRING: 'The Password must be at least 8 characters.' }
    renderReset()
    fill('Project', 'demo')
    fill('New password', '123')
    fill('Confirm password', '456')
    await submitIn(changeButton())
    expect(describedBy(screen.getByLabelText('New password'))[0]).toHaveTextContent(/^New password must be at least 8 characters$/) // the pattern of «New password is required»
    expect(describedBy(screen.getByLabelText('Confirm password'))[0]).toHaveTextContent('The passwords do not match')

    fill('New password', '12345678')
    fill('Confirm password', '12345679')
    await submitIn(changeButton())
    await waitFor(() => expect(describedBy(screen.getByLabelText('New password'))).toHaveLength(0))
    expect(describedBy(screen.getByLabelText('Confirm password'))[0]).toHaveTextContent('The passwords do not match')
    expect(screen.getByLabelText('Confirm password')).toHaveFocus()
    expect(handleResetPassword).not.toHaveBeenCalled()
  })

  it('asks for both codes, each under its field, when the link brought none', async () => {
    renderReset({})
    await submitIn(codesButton())

    const code = screen.getByLabelText('Code')
    const random = screen.getByLabelText('Verification code')
    expect(describedBy(code)[0]).toHaveTextContent('Code is required')
    expect(describedBy(code)[0]).toHaveAttribute('id', 'reset-code-error')
    expect(describedBy(random)[0]).toHaveTextContent('Verification code is required')
    expect(describedBy(random)[0]).toHaveAttribute('id', 'reset-random-error')
    expect(code).toHaveAttribute('aria-invalid', 'true')
    expect(random).toHaveAttribute('aria-invalid', 'true')
    expect(code).toHaveFocus()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(redirectResetPassword).not.toHaveBeenCalled()
  })

  it('asks only for the verification code when the link brought the code', async () => {
    renderReset({ code: 'abc' })
    expect(screen.queryByLabelText('Code')).toBeNull()
    await submitIn(codesButton())
    expect(describedBy(screen.getByLabelText('Verification code'))[0]).toHaveTextContent('Verification code is required')
    expect(screen.getByLabelText('Verification code')).toHaveFocus()
  })

  it('clears a field message when the user corrects the value', async () => {
    renderReset({})
    await submitIn(codesButton())
    expect(describedBy(screen.getByLabelText('Code'))).toHaveLength(1)
    await act(async () => { fireEvent.input(screen.getByLabelText('Code'), { target: { value: '123' } }) })
    await waitFor(() => expect(describedBy(screen.getByLabelText('Code'))).toHaveLength(0))
  })
})

describe('· reset password API errors go in an inline notice above the button', () => {
  const API_ERROR_STATE = { loading: false, result: { error: true, result: ['Invalid code', 'try again'] } }

  it('announces every message of the API, translated, in a danger notice inside the form and above the button', () => {
    controllerProps = { formState: API_ERROR_STATE }
    translations = { TRY_AGAIN: 'Please try again' }
    renderReset()

    const notice = screen.getByRole('alert')
    expect(notice).toHaveClass('odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(notice).toHaveTextContent('Invalid code')
    expect(notice).toHaveTextContent('Please try again')
    expect(within(notice).queryByText('try again', { exact: true })).toBeNull()
    expect(changeButton().closest('form')).toContainElement(notice)
    expect(notice.compareDocumentPosition(changeButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(changeButton()).not.toBeDisabled()
  })

  it('says the network could not be reached when the API sends no message', () => {
    controllerProps = { formState: { loading: false, result: { error: true } } }
    renderReset()
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't connect. Check your connection and try again.")
  })

  // review AF-R1: a refusal whose result is not a message (a model object) says the generic error instead of crashing
  it('says the generic error when the API refuses with something that is not a message', () => {
    controllerProps = { ...controllerProps, formState: { loading: false, result: { error: true, result: { id: 1, original: {} } } } }
    renderReset()
    expect(screen.getByRole('alert')).toHaveTextContent('An error has occurred')
  })

  it('clears the notice when the user types again', async () => {
    controllerProps = { formState: API_ERROR_STATE }
    renderReset()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fill('New password', 'n')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('brings the focus back to the submit button when the API refuses a change the user sent', async () => {
    const view = renderReset()
    fillValid()
    await submitIn(changeButton())
    await waitFor(() => expect(handleResetPassword).toHaveBeenCalledTimes(1))
    changeButton().focus()
    changeButton().blur()

    await rerenderWith(view, { formState: { ...API_ERROR_STATE } })
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code')
    expect(changeButton()).toHaveFocus()
  })
})

describe('· reset password success is a notice with «Sign in», not a dialog', () => {
  const SUCCESS = { formState: { loading: false, result: { error: false, result: 'OK' } }, isSuccessfulReset: true }

  it('shows the text of main in a success notice with a «Sign in» button that takes the focus', () => {
    controllerProps = SUCCESS
    renderReset()

    const notice = screen.getByRole('status')
    expect(notice).toHaveClass('odc-notice')
    expect(notice.querySelector('.odc-icon')).not.toBeNull() // the check icon: the success is not told by colour alone
    expect(notice).toHaveTextContent('Password changed successfully')
    expect(changeButton().closest('form')).toContainElement(notice)
    const signIn = within(notice).getByRole('button', { name: 'Sign in' })
    expect(signIn).toHaveFocus()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('«Sign in» does what Accept did: onPasswordReset', () => {
    controllerProps = SUCCESS
    renderReset()
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Sign in' }))
    expect(onPasswordReset).toHaveBeenCalledTimes(1)
  })

  it('does not let the change be sent again while the success is on screen', async () => {
    controllerProps = SUCCESS
    renderReset()
    expect(changeButton()).toBeDisabled()
    await submitIn(changeButton())
    expect(handleResetPassword).not.toHaveBeenCalled()
  })

  it('says the translation of the result when the API sends a key', () => {
    controllerProps = { ...SUCCESS, formState: { loading: false, result: { error: false, result: 'RESET_DONE' } } }
    translations = { RESET_DONE: 'All set' }
    renderReset()
    expect(screen.getByRole('status')).toHaveTextContent('All set')
  })

  it('shows no success while the API has not answered', () => {
    renderReset()
    expect(screen.queryByRole('status')).toBeNull()
    expect(changeButton()).not.toBeDisabled()
  })
})
