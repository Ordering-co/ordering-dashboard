import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import { getPushErrorMessage, parseServiceAccount } from '../utils'

const state = vi.hoisted(() => ({ props: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductPush: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }]
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
    // redesign B2: the source is a Product StatusBadge and the buttons are Product buttons
    expect(screen.getByText('Project account').closest('.odc-badge').dataset.family).toBe('progress')
    expect(screen.getByRole('heading', { name: 'Firebase Project account' })).toBeTruthy()
    expect(screen.getByText('Push notifications to this app’s devices use your project’s Firebase account.')).toBeTruthy()
    expect(screen.getByText('ordering-push')).toBeTruthy()
    expect(screen.getByText('sdk@ordering-push.iam.gserviceaccount.com')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Use its own account' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save account' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Save account' })).toHaveClass('odc-btn') // redesign B2
    expect(screen.getByRole('button', { name: 'Choose .json file' })).toHaveClass('odc-btn') // redesign B2
    expect(screen.getByText('The .json file Firebase downloads for a service account.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull()
  })

  it('explains where to get the file in four steps', () => {
    renderPush()
    const help = screen.getByText('Where do I get this file?').closest('details')
    expect(help.open).toBe(false)
    expect(within(help).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Open the Firebase console and choose the app’s project.',
      'Go to Project settings → Service accounts.',
      'Click Generate new private key and confirm. Firebase downloads a .json file.',
      'Upload that file here. Keep it private: it lets anyone send pushes to your app.'
    ])
  })

  it('opens the file picker from its button, with the file input hidden', () => {
    renderPush()
    const input = screen.getByLabelText('Service account file (.json)')
    expect(input.getAttribute('accept')).toBe('.json,application/json')
    expect(input.hidden).toBe(true) // redesign B2: hidden natively instead of by the Builder styled-component
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Choose .json file' }))
    expect(click).toHaveBeenCalled()
  })

  it('says it is saving and blocks both buttons meanwhile', () => {
    renderPush({ saving: true, pushState: { loading: false, error: false, firebase: firebase('site', 'burger-app', 'sdk@burger-app.iam.gserviceaccount.com') } })
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true)
  })

  it('reads the uploaded file, shows the account it holds and saves its content', async () => {
    const saveFirebase = vi.fn(async () => ({ ok: true, errorCodes: [], source: 'site' }))
    renderPush({ saveFirebase })
    const file = new File([ACCOUNT], 'burger-adminsdk.json', { type: 'application/json' })
    await act(async () => { fireEvent.change(screen.getByLabelText('Service account file (.json)'), { target: { files: [file] } }) })
    expect(await screen.findByText('burger-adminsdk.json')).toBeTruthy()
    expect(screen.getByText('Firebase project burger-app · sdk@burger-app.iam.gserviceaccount.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeTruthy()
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

  it('checks the pasted content when it loses focus and switches back to the file', async () => {
    renderPush()
    fireEvent.click(screen.getByRole('button', { name: 'Paste the content instead' }))
    expect(screen.queryByLabelText('Service account file (.json)')).toBeNull()
    const area = screen.getByLabelText('Content of the .json file')
    expect(area.tagName).toBe('TEXTAREA')
    expect(area.getAttribute('spellcheck')).toBe('false')
    fireEvent.change(area, { target: { value: 'not json' } })
    fireEvent.blur(area)
    expect((await screen.findByRole('alert')).textContent).toMatch(/This isn’t a Firebase service account/)
    expect(area.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(area, { target: { value: ACCOUNT } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Firebase project burger-app · sdk@burger-app.iam.gserviceaccount.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save account' }).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Upload the file instead' }))
    expect(screen.queryByLabelText('Content of the .json file')).toBeNull()
    expect(screen.getByLabelText('Service account file (.json)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save account' }).disabled).toBe(true)
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

    // redesign B2: the confirmation is Product's ConfirmDialog (an alertdialog) instead of Shared Confirm
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    let dialog = await screen.findByRole('alertdialog', { name: 'Remove its own Firebase account?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(removeFirebase).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    dialog = await screen.findByRole('alertdialog', { name: 'Remove its own Firebase account?' })
    expect(within(dialog).getByText('Push notifications to Burger Town go back to your project’s account right away, if it has one. If the app uses another Firebase project, they stop arriving.')).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Remove account' })) })
    expect(removeFirebase).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Removed. Push notifications to Burger Town use your project’s account.')
  })

  it('says when the removal leaves no account, or failed', async () => {
    const removeFirebase = vi.fn(async () => ({ ok: true, errorCodes: [], source: null }))
    renderPush({ removeFirebase, pushState: { loading: false, error: false, firebase: firebase('site', 'burger-app', 'sdk@burger-app.iam.gserviceaccount.com') } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await act(async () => { fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove account' })) })
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Removed. Push notifications to Burger Town aren’t sent until you add an account.')

    removeFirebase.mockResolvedValueOnce({ ok: false, errorCodes: [], source: 'site' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await act(async () => { fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove account' })) })
    expect(state.showToast).toHaveBeenLastCalledWith('ERROR', 'We couldn’t remove the account. Try again.')
  })

  it('says it is removing and blocks the button meanwhile', () => {
    renderPush({ removing: true, pushState: { loading: false, error: false, firebase: firebase('site', 'burger-app', 'sdk@burger-app.iam.gserviceaccount.com') } })
    expect(screen.getByText('Own account').closest('.odc-badge').dataset.family).toBe('done') // redesign B2
    expect(screen.getByRole('button', { name: 'Removing…' }).disabled).toBe(true)
  })

  it('says when there is no account at all', async () => {
    renderPush({ pushState: { loading: false, error: false, firebase: firebase(null) } })
    expect(screen.getByText('No account')).toBeTruthy()
    expect(screen.getByText('No account').closest('.odc-badge').dataset.family).toBe('pending') // redesign B2
    expect(screen.queryByText('Firebase project')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Use its own account' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))
    expect(screen.getByRole('heading', { name: 'Use its own account' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Add account' })).toBeTruthy()
  })

  it('shows a skeleton while it loads', () => {
    const { container } = renderPush({ pushState: { loading: true, error: false, firebase: null } })
    // redesign B2: Product Skeleton instead of react-loading-skeleton
    expect(container.querySelector('[aria-busy="true"] .odc-skeleton')).toBeTruthy()
    expect(screen.queryByText('Firebase')).toBeNull()
  })

  it('offers to try again when it can’t load', () => {
    const reloadPush = vi.fn()
    renderPush({ reloadPush, pushState: { loading: false, error: true, firebase: null } })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'We couldn’t load the push settings' })).toBeTruthy()
    expect(within(alert).getByText('Check your connection and try again.')).toBeTruthy()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toHaveClass('odc-btn') // redesign B2
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reloadPush).toHaveBeenCalled()
  })
})
