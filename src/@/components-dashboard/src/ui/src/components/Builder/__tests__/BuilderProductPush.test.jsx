import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import { getPushErrorMessage, parseServiceAccount } from '../utils'

const state = vi.hoisted(() => ({ props: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductPush: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }]
}))
vi.mock('../../../styles', () => ({
  Button: ({ color, borderRadius, outline, ...props }) => <button {...props} />
}))
vi.mock('../../Shared', () => ({
  Confirm: ({ open, title, acceptText, onAccept, onCancel, children }) => open
    ? (
      <div role='dialog' aria-label={title}>
        {children}
        <button onClick={onCancel}>Keep</button>
        <button onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null
}))

import { BuilderProductPushSettings } from '../BuilderProductPush'

const ACCOUNT = JSON.stringify({
  type: 'service_account',
  project_id: 'burger-app',
  client_email: 'sdk@burger-app.iam.gserviceaccount.com',
  private_key: 'TEST-KEY'
})
const firebase = (source, projectId = null, clientEmail = null) => ({ source, project_id: projectId, client_email: clientEmail })

const renderPush = (extra = {}) => {
  state.props = {
    pushState: { loading: false, error: false, firebase: firebase('project', 'ordering-push', 'sdk@ordering-push.iam.gserviceaccount.com') },
    reloadPush: vi.fn(),
    saving: false,
    removing: false,
    saveFirebase: vi.fn(async () => ({ ok: true, errorCodes: [], source: 'site' })),
    removeFirebase: vi.fn(async () => ({ ok: true, errorCodes: [], source: 'project' })),
    ...extra
  }
  return renderWithProviders(<BuilderProductPushSettings productId={41} productName='Burger Town' />)
}

describe('push helpers', () => {
  it('checks a service account like the API', () => {
    expect(parseServiceAccount(ACCOUNT)).toEqual({ account: { projectId: 'burger-app', clientEmail: 'sdk@burger-app.iam.gserviceaccount.com' } })
    expect(parseServiceAccount('  ')).toEqual({ errorCode: 'service_account.required' })
    expect(parseServiceAccount('not json')).toEqual({ errorCode: 'service_account.invalid' })
    expect(parseServiceAccount('{"type":"authorized_user","project_id":"a","client_email":"b","private_key":"c"}')).toEqual({ errorCode: 'service_account.invalid' })
    expect(parseServiceAccount('{"type":"service_account","project_id":"a","client_email":"b","private_key":" "}')).toEqual({ errorCode: 'service_account.invalid' })
    expect(parseServiceAccount('x'.repeat(20001))).toEqual({ errorCode: 'service_account.max' })
  })

  it.each([
    [['service_account.invalid'], 'This isn’t a Firebase service account. Download it again from Project settings → Service accounts → Generate new private key.'],
    [['service_account.string', 'service_account.max'], 'This isn’t a Firebase service account. Download it again from Project settings → Service accounts → Generate new private key.'],
    [['service_account.max'], 'This file is too long for a service account. Check that it’s the right one.'],
    [['service_account.required'], 'Choose the .json file or paste its content.'],
    [['push.unavailable'], 'Push notifications aren’t set up for this project. Contact Ordering support.'],
    [['file.unreadable'], 'We couldn’t read this file. Choose the .json file Firebase downloaded.'],
    [[], 'We couldn’t save the account. Try again.']
  ])('explains %s', (codes, text) => {
    expect(getPushErrorMessage(codes)).toBe(text)
  })

  it('explains a failed removal', () => {
    expect(getPushErrorMessage([], 'remove')).toBe('We couldn’t remove the account. Try again.')
  })
})

describe('Push notifications tab', () => {
  beforeEach(() => state.showToast.mockReset())

  it('shows the project’s account and the form to use its own', () => {
    renderPush()
    expect(screen.getByText('Project account')).toBeTruthy()
    expect(screen.getByText('ordering-push')).toBeTruthy()
    expect(screen.getByText('sdk@ordering-push.iam.gserviceaccount.com')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Use its own account' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save account' }).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('reads the uploaded file, shows the account it holds and saves its content', async () => {
    const saveFirebase = vi.fn(async () => ({ ok: true, errorCodes: [], source: 'site' }))
    renderPush({ saveFirebase })
    const file = new File([ACCOUNT], 'burger-adminsdk.json', { type: 'application/json' })
    await act(async () => { fireEvent.change(screen.getByLabelText('Service account file (.json)'), { target: { files: [file] } }) })
    expect(await screen.findByText('burger-adminsdk.json')).toBeTruthy()
    expect(screen.getByText('Firebase project burger-app · sdk@burger-app.iam.gserviceaccount.com')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save account' })) })
    expect(saveFirebase).toHaveBeenCalledWith(ACCOUNT)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Saved. Push notifications to Burger Town use its own Firebase account.')
  })

  it('stops a file that isn’t a service account before sending it', async () => {
    const saveFirebase = vi.fn()
    renderPush({ saveFirebase })
    const file = new File(['{"type":"authorized_user"}'], 'wrong.json', { type: 'application/json' })
    await act(async () => { fireEvent.change(screen.getByLabelText('Service account file (.json)'), { target: { files: [file] } }) })
    expect((await screen.findByRole('alert')).textContent).toMatch(/This isn’t a Firebase service account/)
    expect(screen.getByRole('button', { name: 'Save account' }).disabled).toBe(true)
    expect(saveFirebase).not.toHaveBeenCalled()
  })

  it('accepts the content pasted and shows what the API refused', async () => {
    const saveFirebase = vi.fn(async () => ({ ok: false, errorCodes: ['push.unavailable'], source: null }))
    renderPush({ saveFirebase })
    fireEvent.click(screen.getByRole('button', { name: 'Paste the content instead' }))
    fireEvent.change(screen.getByLabelText('Content of the .json file'), { target: { value: ACCOUNT } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save account' })) })
    expect(screen.getByRole('alert').textContent).toBe('Push notifications aren’t set up for this project. Contact Ordering support.')
  })

  it('replaces or removes its own account, asking first', async () => {
    const removeFirebase = vi.fn(async () => ({ ok: true, errorCodes: [], source: 'project' }))
    renderPush({ removeFirebase, pushState: { loading: false, error: false, firebase: firebase('site', 'burger-app', 'sdk@burger-app.iam.gserviceaccount.com') } })
    expect(screen.getByText('Own account')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Use its own account' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
    expect(screen.getByRole('heading', { name: 'Use its own account' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Use its own account' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove its own Firebase account?' })
    expect(within(dialog).getByText(/go back to your project’s account right away/)).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Remove account' })) })
    expect(removeFirebase).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Removed. Push notifications to Burger Town use your project’s account.')
  })

  it('says when there is no account at all', async () => {
    renderPush({ pushState: { loading: false, error: false, firebase: firebase(null) } })
    expect(screen.getByText('No account')).toBeTruthy()
    expect(screen.queryByText('Firebase project')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))
    expect(screen.getByRole('heading', { name: 'Use its own account' })).toBeTruthy()
  })

  it('offers to try again when it can’t load', () => {
    const reloadPush = vi.fn()
    renderPush({ reloadPush, pushState: { loading: false, error: true, firebase: null } })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reloadPush).toHaveBeenCalled()
  })
})
