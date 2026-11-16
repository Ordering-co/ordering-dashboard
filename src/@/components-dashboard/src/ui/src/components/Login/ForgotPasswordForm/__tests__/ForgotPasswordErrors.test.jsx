/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

const sendForgot = vi.fn()
const IDLE_FORM_STATE = { loading: false, result: { error: false } }
let controllerProps = {}
let translations = {}
let apiProject = 'old'
// one object per project, as the real context gives: a new one on every render would re-run the effects that read it
const orderingByProject = {}
const orderingOf = project => (orderingByProject[project] ||= { project })

// The legacy modal must not be what shows an error or the success any more: a marker, so a test can tell it came back.
vi.mock('../../../Shared', () => ({
  Alert: ({ open }) => (open ? <div role='dialog' data-testid='legacy-alert-modal' /> : null)
}))

vi.mock('../../../../../../index.js', () => ({
  ForgotPasswordForm: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      formState={IDLE_FORM_STATE}
      hanldeChangeInput={vi.fn()}
      handleButtonForgotPasswordClick={sendForgot}
      {...controllerProps}
    />
  ),
  ReCaptcha: () => null,
  useApi: () => [orderingOf(apiProject), { configurations: {} }],
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [null, (key, fallback) => translations[key] ?? fallback]
}))

import { ForgotPasswordForm } from '..'

let setConfigFile
let configFile
const tree = () => (
  <ConfigFileContext.Provider value={[configFile, setConfigFile]}>
    <ForgotPasswordForm />
  </ConfigFileContext.Provider>
)
const renderForgot = () => renderWithProviders(tree())
const rerenderWith = async (view, props) => {
  controllerProps = props
  await act(async () => { view.rerender(tree()) })
}

const submitButton = () => screen.getByRole('button', { name: /^(send reset link|link sent|sending…)$/i })
const submit = async () => {
  await act(async () => { fireEvent.submit(submitButton().closest('form')) })
}
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const fillValid = () => {
  fill('Project', 'demo')
  fill('Email', 'owner@store.test')
}

const describedBy = control => {
  const ids = (control.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)
  return ids.map(id => document.getElementById(id)).filter(Boolean)
}

beforeEach(() => {
  vi.clearAllMocks()
  controllerProps = {}
  translations = {}
  apiProject = 'old'
  configFile = {}
  setConfigFile = vi.fn()
})

describe('· forgot password validation errors sit next to their field', () => {
  it('shows each message under its own field, with aria-invalid and aria-describedby, and no dialog', async () => {
    renderForgot()
    await submit()

    const expected = [[screen.getByLabelText('Project'), 'Project is required', 'forgot-project-error'], [screen.getByLabelText('Email'), 'Email is required', 'forgot-email-error']]
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
    expect(sendForgot).not.toHaveBeenCalled()
  })

  it('moves the focus to the first field with an error, in visual order', async () => {
    renderForgot()
    await submit()
    expect(screen.getByLabelText('Project')).toHaveFocus()

    fill('Project', 'demo')
    await submit()
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('keeps the invalid email message, under the email', async () => {
    renderForgot()
    fill('Project', 'demo')
    fill('Email', 'not-an-email')
    await submit()

    expect(describedBy(screen.getByLabelText('Email'))[0]).toHaveTextContent('Invalid email address')
    expect(screen.getByLabelText('Email')).toHaveFocus()
    expect(describedBy(screen.getByLabelText('Project'))).toHaveLength(0)
    expect(screen.getByLabelText('Project')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
  })

  it('clears a field message when the user corrects the value', async () => {
    renderForgot()
    await submit()
    expect(describedBy(screen.getByLabelText('Email'))).toHaveLength(1)

    await act(async () => { fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'owner@store.test' } }) })
    await waitFor(() => expect(describedBy(screen.getByLabelText('Email'))).toHaveLength(0))
  })
})

describe('· forgot password API errors go in an inline notice above the button', () => {
  const API_ERROR_STATE = { loading: false, result: { error: true, result: ['Invalid credentials', 'try again'] } }

  it('announces every message of the API, translated, in a danger notice inside the form and above the button', () => {
    controllerProps = { formState: API_ERROR_STATE }
    translations = { TRY_AGAIN: 'Please try again' }
    renderForgot()

    const notice = screen.getByRole('alert')
    expect(notice).toHaveClass('odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(notice).toHaveTextContent('Invalid credentials')
    expect(notice).toHaveTextContent('Please try again')
    expect(within(notice).queryByText('try again', { exact: true })).toBeNull()
    const form = submitButton().closest('form')
    expect(form).toContainElement(notice)
    expect(notice.compareDocumentPosition(submitButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
  })

  it('says the network could not be reached when the API sends no message', () => {
    controllerProps = { formState: { loading: false, result: { error: true } } }
    renderForgot()
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't connect. Check your connection and try again.")
  })

  it('uses the translation of AUTH_NETWORK_ERROR', () => {
    controllerProps = { formState: { loading: false, result: { error: true, result: '' } } }
    translations = { AUTH_NETWORK_ERROR: 'No hay conexion' }
    renderForgot()
    expect(screen.getByRole('alert')).toHaveTextContent('No hay conexion')
  })

  // review AF-R1: on a 200 the SDK turns `result` into a model object; it is not a message and must not reach React
  it('says the generic error, and does not crash, when the API refuses with something that is not a message', () => {
    controllerProps = { formState: { loading: false, result: { error: true, result: { id: 1, hidden: [], original: {} } } } }
    renderForgot()
    expect(screen.getByRole('alert')).toHaveTextContent('An error has occurred')
  })

  it('accepts a single message as text', () => {
    controllerProps = { formState: { loading: false, result: { error: true, result: 'The captcha validation is required' } } }
    renderForgot()
    expect(screen.getByRole('alert')).toHaveTextContent('The captcha validation is required')
  })

  it('clears the notice when the user types the email or the project again', async () => {
    controllerProps = { formState: API_ERROR_STATE }
    renderForgot()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fill('Email', 'o')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('drops the old API notice when the form is sent again and fails validation: the field takes over', async () => {
    controllerProps = { formState: API_ERROR_STATE }
    renderForgot()
    await submit()
    expect(describedBy(screen.getByLabelText('Project'))[0]).toHaveTextContent('Project is required')
    expect(submitButton().closest('form').querySelector('.odc-notice')).toBeNull()
  })

  it('brings the focus back to the submit button when the API refuses a send the user made', async () => {
    const view = renderForgot()
    fillValid()
    apiProject = 'demo'
    await submit()
    await waitFor(() => expect(sendForgot).toHaveBeenCalledTimes(1))
    submitButton().focus()
    submitButton().blur()

    await rerenderWith(view, { formState: { ...API_ERROR_STATE } })
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    expect(submitButton()).toHaveFocus()
    expect(submitButton()).not.toBeDisabled()
  })
})

describe('· forgot password success is a notice in the form, not a dialog', () => {
  it('shows a success notice with the title and text of main, takes the focus, and leaves the button as «Link sent»', async () => {
    apiProject = 'demo'
    const view = renderForgot()
    fillValid()
    await submit()
    await waitFor(() => expect(sendForgot).toHaveBeenCalledTimes(1))

    await rerenderWith(view, { formState: { loading: true, result: { error: false } } })
    expect(screen.queryByRole('status')).toBeNull()
    await rerenderWith(view, { formState: { loading: false, result: { error: false, result: 'OK' } } })

    const notice = screen.getByRole('status')
    expect(notice).toHaveClass('odc-notice')
    expect(notice.querySelector('.odc-icon')).not.toBeNull() // the check icon: the success is not told by colour alone
    expect(notice).toHaveTextContent(/^Link sent successfully/) // sentence case
    expect(notice).toHaveTextContent("If an account exists with this email, we'll send you a link to reset your password.")
    expect(submitButton().closest('form')).toContainElement(notice)
    expect(notice).toHaveFocus()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    expect(screen.queryByRole('alert')).toBeNull()

    expect(submitButton()).toHaveTextContent('Link sent')
    expect(submitButton()).toBeDisabled()
  })

  // review AF-R3: main told the success of any answer that was not an error, whatever `result` held
  it('shows the success when the API answers without an error and without a result', async () => {
    apiProject = 'demo'
    // the live catalog keeps the Title Case text on the old key, so the success reads a key of its own
    translations = { LINK_SEND_SUCCESSFULLY: 'Link Sent Successfully' }
    const view = renderForgot()
    fillValid()
    await submit()
    await waitFor(() => expect(sendForgot).toHaveBeenCalledTimes(1))
    await rerenderWith(view, { formState: { loading: true, result: { error: false } } })
    await rerenderWith(view, { formState: { loading: false, result: { error: false, result: null } } })
    expect(screen.getByRole('status')).toHaveTextContent(/^Link sent successfully/)
    expect(submitButton()).toBeDisabled()
  })

  it('shows no success before the API answers', async () => {
    apiProject = 'demo'
    renderForgot()
    fillValid()
    await submit()
    await waitFor(() => expect(sendForgot).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('goes back to an enabled button when the API then fails', async () => {
    apiProject = 'demo'
    const view = renderForgot()
    fillValid()
    await submit()
    await rerenderWith(view, { formState: { loading: false, result: { error: true, result: ['No such account'] } } })
    expect(submitButton()).not.toBeDisabled()
    expect(submitButton()).toHaveTextContent('Send reset link')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('.1 · forgot password keeps the project', () => {
  it('keeps the project the user already had when it mounts', () => {
    configFile = { project: 'acme' }
    renderForgot()
    expect(setConfigFile).toHaveBeenCalledWith({ project: 'acme' })
    expect(setConfigFile).not.toHaveBeenCalledWith(expect.objectContaining({ project: null }))
  })

  it('prefers the pinned project, then the stored one, as main did', () => {
    configFile = { project: 'acme', local_project_pin: 'pinned' }
    renderForgot()
    expect(setConfigFile).toHaveBeenCalledWith({ project: 'pinned', local_project_pin: 'pinned' })
  })

  it('sends to the project the user typed, not to the previous one, when sent before the delay of the project change', async () => {
    const view = renderForgot()
    setConfigFile.mockClear()
    fill('Project', 'acme')
    fill('Email', 'owner@store.test')
    await submit()

    // the project of the API is still the old one: the send waits
    expect(sendForgot).not.toHaveBeenCalled()
    expect(setConfigFile).toHaveBeenCalledWith(expect.objectContaining({ project: 'acme' }))

    apiProject = 'acme'
    await rerenderWith(view, {})
    await waitFor(() => expect(sendForgot).toHaveBeenCalledTimes(1))

    // the delayed change of project was cancelled by the submit: the project is set once
    await new Promise(resolve => setTimeout(resolve, 850))
    expect(setConfigFile.mock.calls.filter(([value]) => value.project === 'acme')).toHaveLength(1)
    expect(sendForgot).toHaveBeenCalledTimes(1)
  })

  it('sends at once when the project of the API already is the one typed', async () => {
    apiProject = 'demo'
    renderForgot()
    fillValid()
    await submit()
    await waitFor(() => expect(sendForgot).toHaveBeenCalledTimes(1))
    expect(setConfigFile.mock.calls.filter(([value]) => value.project === 'demo')).toHaveLength(0)
  })

  it('does not show the project field when the project is pinned, and sends to the project of the API', async () => {
    configFile = { local_project_pin: 'pinned' }
    apiProject = 'pinned'
    renderForgot()
    expect(screen.queryByLabelText('Project')).toBeNull()
    fill('Email', 'owner@store.test')
    await submit()
    await waitFor(() => expect(sendForgot).toHaveBeenCalledTimes(1))
  })
})
