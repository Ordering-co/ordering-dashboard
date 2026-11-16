/* eslint-disable import/first */
// redesign IM-C (D3): the GloriaFood import dialog on P/Dialog. Same two steps and same logic as
// GloriaFoodImportModal; a late prefill never overwrites typed keys nor moves the user (IM-13), and a failure is readable (IM-03).
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  triggerImport: vi.fn(),
  fetchSync: vi.fn(),
  push: vi.fn(),
  useMenuImportSource: vi.fn(),
  reset: vi.fn(),
  // the run state of useMenuImport: the tests set it as the hook would report it
  state: { isImporting: false, status: 'idle', error: null, result: null, startedAt: null }
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { email: 'owner@test.com' }, token: 'tok-1' }],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }],
  // the project's date format (decision 13): the test paints the instant it is given, so the assertion names that instant
  useUtils: () => [{ parseDate: (date) => `PD(${date.toISOString()})` }]
}))
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: mocks.push })
}))
vi.mock('../useMenuImport', () => ({
  useMenuImport: (source) => {
    mocks.useMenuImportSource(source)
    return { triggerImport: mocks.triggerImport, reset: mocks.reset, ...mocks.state }
  }
}))
vi.mock('../logMenuImportSync', () => ({
  fetchMenuImportSync: (...args) => mocks.fetchSync(...args)
}))

import { getRun, saveRun } from '../menuImportRuns'
import { GLORIAFOOD_HELP_VIDEO_URL } from '../gloriaFoodImportConfig'
import { GloriaFoodImportDialog } from '../GloriaFoodImportDialog'

const business = { id: 42, name: 'Fast Bite', slug: 'fast-bite' }
const onClose = vi.fn()
const renderDialog = (props = {}) => render(
  <GloriaFoodImportDialog open business={business} onClose={onClose} {...props} />
)

const resKey = () => screen.getByLabelText('Restaurant Key')
const masKey = () => screen.getByLabelText('Master Key')
const syncButton = () => screen.getByRole('button', { name: 'Synchronize Menu' })
const toCredentials = async (user) => {
  await user.click(await screen.findByRole('button', { name: 'Continue' }))
  await screen.findByLabelText('Restaurant Key')
}

const deferredSync = () => {
  let deliver
  mocks.fetchSync.mockReturnValue(new Promise((resolve) => { deliver = resolve }))
  return (event) => act(async () => { deliver(event) })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mocks.state = { isImporting: false, status: 'idle', error: null, result: null, startedAt: null }
  mocks.fetchSync.mockResolvedValue(null)
  mocks.triggerImport.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('GloriaFoodImportDialog — step 1: the guide', () => {
  it('renders nothing when closed or without a store', () => {
    const { container, rerender } = render(<GloriaFoodImportDialog open={false} business={business} onClose={onClose} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<GloriaFoodImportDialog open business={null} onClose={onClose} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('starts on the setup video, in a md dialog titled «Import from GloriaFood», with Cancel and Continue', async () => {
    renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Import from GloriaFood' })
    expect(dialog).toHaveAttribute('data-size', 'md')
    const video = within(dialog).getByTitle('GloriaFood setup guide')
    expect(video.tagName).toBe('IFRAME')
    expect(video).toHaveAttribute('src', GLORIAFOOD_HELP_VIDEO_URL)
    expect(video).toHaveAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share')
    expect(video).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    expect(video).toHaveAttribute('allowfullscreen')
    expect(video.className).toContain('odc-imp-video')
    expect(within(dialog).queryByLabelText('Restaurant Key')).toBeNull()
    const foot = dialog.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Cancel', 'Continue'])
  })

  it('asks for the last keys of this store as source gloriafood, and imports as gloriafood', async () => {
    renderDialog()
    await screen.findByRole('dialog')
    expect(mocks.fetchSync).toHaveBeenCalledWith({
      token: 'tok-1',
      businessId: 42,
      project: 'demo',
      source: 'gloriafood',
      orderingApiBaseUrl: 'https://api.example.com'
    })
    expect(mocks.useMenuImportSource).toHaveBeenCalledWith('gloriafood')
  })

  it('Cancel and the close button call onClose', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('GloriaFoodImportDialog — step 2: the keys', () => {
  it('Continue shows the keys; Back (an icon button named «Back») returns to the video', async () => {
    const user = userEvent.setup()
    renderDialog()
    await toCredentials(user)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Synchronize' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Enter the Restaurant Key from GloriaFood (3rd party integrations → Fetch Menu) to synchronize this store menu.')
    expect(within(dialog).getByText('Fast Bite')).toBeInTheDocument()
    expect(within(dialog).queryByTitle('GloriaFood setup guide')).toBeNull()
    expect(resKey()).toHaveAttribute('autocomplete', 'off')
    expect(masKey()).toHaveAttribute('autocomplete', 'off')
    expect(masKey()).toHaveAttribute('type', 'text')
    expect(masKey()).toHaveAccessibleDescription('The Restaurant Key is used to fetch the menu. The Master Key is only required for setup parity with the help video.')
    expect(within(dialog).getByRole('checkbox', { name: 'Allow customers to choose more than one option in each group' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByText('Some GloriaFood menus only allow one choice per group. Leave this on so customers can pick several, like on GloriaFood.')).toBeInTheDocument()
    expect(within(dialog).getByText('The menu is imported into Fast Bite. This can take a few minutes.')).toBeInTheDocument()
    const foot = dialog.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Cancel', 'Synchronize Menu'])

    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(await screen.findByTitle('GloriaFood setup guide')).toBeInTheDocument()
    expect(screen.queryByLabelText('Restaurant Key')).toBeNull()
  })

  it('keeps what was typed when going Back and Continue again', async () => {
    const user = userEvent.setup()
    renderDialog()
    await toCredentials(user)
    await user.type(resKey(), 'rk-1')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await toCredentials(user)
    expect(resKey()).toHaveValue('rk-1')
  })

  it('validates the keys: both are required, and Synchronize stays disabled until they are there', async () => {
    const user = userEvent.setup()
    renderDialog()
    await toCredentials(user)
    expect(syncButton()).toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
    await user.type(masKey(), 'mk-1')
    expect(screen.getByRole('alert')).toHaveTextContent('Restaurant Key is required')
    expect(syncButton()).toBeDisabled()
    await user.type(resKey(), 'rk-1')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(syncButton()).toBeEnabled()
    await user.clear(masKey())
    expect(screen.getByRole('alert')).toHaveTextContent('Master Key is required')
  })

  it('triggerImport receives exactly the parameters of the modal (keys trimmed, force limits ignored by default)', async () => {
    const user = userEvent.setup()
    renderDialog()
    await toCredentials(user)
    await user.type(resKey(), '  rk-1 ')
    await user.type(masKey(), 'mk-1  ')
    await user.click(syncButton())
    expect(mocks.triggerImport).toHaveBeenCalledTimes(1)
    expect(mocks.triggerImport).toHaveBeenCalledWith(
      {
        gloriafoodRestaurantKey: 'rk-1',
        gloriafoodMasterKey: 'mk-1',
        ignoreGloriaFoodForceLimits: true,
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com',
        userEmail: 'owner@test.com',
        useFixture: false
      },
      { onSuccess: expect.any(Function), onError: expect.any(Function) }
    )
  })

  it('sends ignoreGloriaFoodForceLimits=false after unchecking the option', async () => {
    const user = userEvent.setup()
    renderDialog()
    await toCredentials(user)
    await user.type(resKey(), 'rk-1')
    await user.type(masKey(), 'mk-1')
    await user.click(screen.getByRole('checkbox', { name: 'Allow customers to choose more than one option in each group' }))
    await user.click(syncButton())
    expect(mocks.triggerImport.mock.calls[0][0]).toMatchObject({ ignoreGloriaFoodForceLimits: false })
  })
})

describe('GloriaFoodImportDialog — prefill (IM-13)', () => {
  it('both keys arrive while the user has touched nothing: it fills them and jumps to the keys', async () => {
    const arrive = deferredSync()
    renderDialog()
    await screen.findByTitle('GloriaFood setup guide')
    await arrive({ gloriafood_restaurant_key: ' rk-9 ', gloriafood_master_key: 'mk-9' })
    expect(await screen.findByLabelText('Restaurant Key')).toHaveValue('rk-9')
    expect(masKey()).toHaveValue('mk-9')
    expect(screen.queryByTitle('GloriaFood setup guide')).toBeNull()
  })

  it('only one key arrives: it fills it and stays on the video', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    renderDialog()
    await screen.findByTitle('GloriaFood setup guide')
    await arrive({ gloriafood_restaurant_key: 'rk-9' })
    expect(screen.getByTitle('GloriaFood setup guide')).toBeInTheDocument()
    await toCredentials(user)
    expect(resKey()).toHaveValue('rk-9')
    expect(masKey()).toHaveValue('')
  })

  it('does not overwrite keys the user already typed, and does not move them', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    renderDialog()
    await toCredentials(user)
    await user.type(resKey(), 'mine')
    await arrive({ gloriafood_restaurant_key: 'rk-9', gloriafood_master_key: 'mk-9' })
    expect(resKey()).toHaveValue('mine')
    expect(masKey()).toHaveValue('')
  })

  it('does not jump to the keys if the user already went there and back', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    renderDialog()
    await toCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await arrive({ gloriafood_restaurant_key: 'rk-9', gloriafood_master_key: 'mk-9' })
    expect(screen.getByTitle('GloriaFood setup guide')).toBeInTheDocument()
    expect(screen.queryByLabelText('Restaurant Key')).toBeNull()
  })

  it('applies the prefill again when it reopens', async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog()
    await toCredentials(user)
    await user.type(resKey(), 'mine')
    rerender(<GloriaFoodImportDialog open={false} business={business} onClose={onClose} />)
    mocks.fetchSync.mockResolvedValue({ gloriafood_restaurant_key: 'rk-9', gloriafood_master_key: 'mk-9' })
    rerender(<GloriaFoodImportDialog open business={business} onClose={onClose} />)
    await waitFor(() => expect(screen.getByLabelText('Restaurant Key')).toHaveValue('rk-9'))
    expect(masKey()).toHaveValue('mk-9')
  })
})

describe('GloriaFoodImportDialog — failure (IM-03)', () => {
  const failWith = async (user, error) => {
    mocks.triggerImport.mockImplementation(async (_params, { onError }) => onError(error))
    renderDialog()
    await toCredentials(user)
    await user.type(resKey(), 'rk-1')
    await user.type(masKey(), 'mk-1')
    await user.click(syncButton())
  }

  it('shows the readable message in the dialog and keeps the keys', async () => {
    const user = userEvent.setup()
    await failWith(user, new Error('GloriaFood took too long to respond. Try again in a few minutes.'))
    expect(await screen.findByRole('alert')).toHaveTextContent('GloriaFood took too long to respond. Try again in a few minutes.')
    expect(resKey()).toHaveValue('rk-1')
    expect(masKey()).toHaveValue('mk-1')
    expect(syncButton()).toBeEnabled()
  })

  it('says in words that the importer could not be reached', async () => {
    const user = userEvent.setup()
    await failWith(user, new TypeError('Failed to fetch'))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach the menu importer. Check your connection and try again.")
  })

  it('falls back to «Import failed» when the error has no message', async () => {
    const user = userEvent.setup()
    await failWith(user, new Error(''))
    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed')
  })

  it('the message goes away when the user edits a key', async () => {
    const user = userEvent.setup()
    await failWith(user, new Error('Nope'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope')
    await user.type(resKey(), 'x')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('GloriaFoodImportDialog — importing', () => {
  it('shows the synchronizing status with a live region, the primary action busy, and cannot be left', async () => {
    const user = userEvent.setup()
    mocks.state.isImporting = false
    const { rerender } = renderDialog()
    await toCredentials(user)
    await user.type(resKey(), 'rk-1')
    await user.type(masKey(), 'mk-1')
    mocks.state.isImporting = true
    rerender(<GloriaFoodImportDialog open business={business} onClose={onClose} />)

    const dialog = screen.getByRole('dialog')
    const status = within(dialog).getByText('Synchronize Menu .......')
    expect(status.closest('[aria-live="polite"]')).not.toBeNull()
    expect(dialog.querySelector('.odc-imp-spinner')).not.toBeNull()
    expect(syncButton()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('GloriaFoodImportDialog — success', () => {
  const succeed = async (user, props) => {
    mocks.triggerImport.mockImplementation(async (_params, { onSuccess }) => onSuccess())
    renderDialog(props)
    await toCredentials(user)
    await user.type(resKey(), 'rk-1')
    await user.type(masKey(), 'mk-1')
    await user.click(syncButton())
  }

  it('says it worked and offers only «Go to products», which goes to the store and closes', async () => {
    const user = userEvent.setup()
    await succeed(user)
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('Menu imported successfully')).toBeInTheDocument()
    const foot = dialog.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Go to products'])
    await user.click(screen.getByRole('button', { name: 'Go to products' }))
    expect(mocks.push).toHaveBeenCalledWith('/stores/products/fast-bite')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('without a slug it goes to /stores/products', async () => {
    const user = userEvent.setup()
    await succeed(user, { business: { id: 42, name: 'Fast Bite' } })
    await user.click(await screen.findByRole('button', { name: 'Go to products' }))
    expect(mocks.push).toHaveBeenCalledWith('/stores/products')
  })
})

// (main sync, 6f58d106): the run state of useMenuImport and the stored run of main, in the redesigned dialog.
// The tests set `mocks.state` as the hook would report it; the stored runs are the real ones (menuImportRuns, localStorage).
const STORED_AT = '2026-10-13T18:28:00.000Z'
const runRef = { project: 'demo', businessId: 42, source: 'gloriafood' }
const storedRun = (status) => ({
  status,
  startedAt: STORED_AT,
  finishedAt: null,
  sourceUrl: null,
  appliedCount: null,
  errorMessage: null,
  menuBefore: null,
  menuAfter: null
})
const footerLabels = () => [...screen.getByRole('dialog').querySelector('.odc-overlay-foot').querySelectorAll('button')]
  .map((button) => button.textContent)
const hookReports = (state) => { mocks.state = { ...mocks.state, ...state } }
// the import is sent and the hook answers with `state`; `fail` also calls onError, as the hook does
const importAnswers = (state, { fail = false } = {}) => mocks.triggerImport.mockImplementationOnce(async (_params, { onError }) => {
  hookReports(state)
  if (fail) onError(new Error(state.error.message))
})
const typeKeysAndSync = async (user) => {
  await toCredentials(user)
  await user.type(resKey(), 'rk-1')
  await user.type(masKey(), 'mk-1')
  await user.click(syncButton())
}

describe('GloriaFoodImportDialog — a run stored by a previous session (main)', () => {
  // runs expire after their last activity: the clock stays near the fixtures
  beforeEach(() => { vi.useFakeTimers({ now: Date.parse(STORED_AT) + 60_000, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('reopens on the synchronizing status, with the stored start time, and can be left', async () => {
    saveRun(runRef, storedRun('importing'))
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    const status = within(dialog).getByText('Synchronize Menu .......')
    expect(status.closest('[aria-live="polite"]')).not.toBeNull()
    expect(within(dialog).getByText(`PD(${STORED_AT})`)).toBeInTheDocument()
    expect(dialog.querySelector('.odc-imp-spinner')).not.toBeNull()
    // nothing is running in this session: it cannot start a second import, but the dialog can be left
    expect(within(dialog).queryByRole('button', { name: 'Continue' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
  })

  it('reopens on the lost-connection block with Retry and Check products, not on the guide', async () => {
    saveRun(runRef, storedRun('unknown'))
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('We lost the connection to the importer')).toBeInTheDocument()
    expect(footerLabels()).toEqual(['Retry', 'Check products'])
    expect(within(dialog).queryByTitle('GloriaFood setup guide')).toBeNull()
  })

  it('does not reopen on a finished run', async () => {
    saveRun(runRef, { ...storedRun('success'), appliedCount: 1 })
    renderDialog()
    expect(await screen.findByTitle('GloriaFood setup guide')).toBeInTheDocument()
    expect(screen.queryByText('Menu imported successfully')).toBeNull()
  })

  it('Retry on a resumed lost-connection run clears it and goes to the keys without importing', async () => {
    const user = userEvent.setup()
    saveRun(runRef, storedRun('unknown'))
    renderDialog()
    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(getRun(runRef)).toBeNull()
    expect(await screen.findByLabelText('Restaurant Key')).toBeInTheDocument()
    expect(mocks.triggerImport).not.toHaveBeenCalled()
  })
})

describe('GloriaFoodImportDialog — the run of this session (main)', () => {
  it('shows the start time while it synchronizes', async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog()
    await toCredentials(user)
    hookReports({ isImporting: true, status: 'importing', startedAt: STORED_AT })
    rerender(<GloriaFoodImportDialog open business={business} onClose={onClose} />)
    expect(within(screen.getByRole('dialog')).getByText(`PD(${STORED_AT})`)).toBeInTheDocument()
  })

  it('a retryable failure names what was not imported, says why, and Retry sends the same parameters again', async () => {
    const user = userEvent.setup()
    const message = 'GloriaFood took too long to respond. Try again in a few minutes.'
    importAnswers({ status: 'failed', error: { message, retryable: true } }, { fail: true })
    renderDialog()
    await typeKeysAndSync(user)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The GloriaFood menu was not imported')
    expect(alert).toHaveTextContent(message)
    // the keys stay, and the primary action is now Retry
    expect(resKey()).toHaveValue('rk-1')
    expect(screen.queryByRole('button', { name: 'Synchronize Menu' })).toBeNull()
    mocks.triggerImport.mockImplementationOnce(() => new Promise(() => {}))
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.triggerImport).toHaveBeenCalledTimes(2)
    expect(mocks.triggerImport.mock.calls[1][0]).toEqual(mocks.triggerImport.mock.calls[0][0])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure that is not retryable offers no Retry, only Synchronize Menu', async () => {
    const user = userEvent.setup()
    importAnswers({ status: 'failed', error: { message: 'Check the import details and try again.', retryable: false } }, { fail: true })
    renderDialog()
    await typeKeysAndSync(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('The GloriaFood menu was not imported')
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(syncButton()).toBeEnabled()
  })

  it('editing a key after a retryable failure takes the message and Retry away', async () => {
    const user = userEvent.setup()
    importAnswers({ status: 'failed', error: { message: 'Try again later.', retryable: true } }, { fail: true })
    renderDialog()
    await typeKeysAndSync(user)
    await screen.findByRole('button', { name: 'Retry' })
    await user.type(resKey(), 'x')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(syncButton()).toBeEnabled()
  })

  it('an unknown result says the import may still be running, without the success copy', async () => {
    hookReports({ status: 'unknown', error: { message: 'lost', retryable: true } })
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('We lost the connection to the importer')).toBeInTheDocument()
    expect(within(dialog).getByText('The import may still be running on the server. Check the products in a few minutes before importing again.')).toBeInTheDocument()
    expect(footerLabels()).toEqual(['Retry', 'Check products'])
    expect(within(dialog).queryByText('Menu imported successfully')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check products' })).toHaveFocus())
  })

  it('Retry after an unknown result sends the same parameters again', async () => {
    const user = userEvent.setup()
    importAnswers({ status: 'unknown', error: { message: 'lost', retryable: true } }, { fail: true })
    renderDialog()
    await typeKeysAndSync(user)
    mocks.triggerImport.mockImplementationOnce(() => new Promise(() => {}))
    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(mocks.triggerImport).toHaveBeenCalledTimes(2)
    expect(mocks.triggerImport.mock.calls[1][0]).toEqual(mocks.triggerImport.mock.calls[0][0])
  })

  it('a success shows the applied count, with Import another next to Go to products', async () => {
    hookReports({ status: 'success', result: { appliedCount: 2, jobId: 'job-1' } })
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Menu imported successfully')).toBeInTheDocument()
    expect(within(dialog).getByText('Menu imported to 2 store(s)')).toBeInTheDocument()
    expect(footerLabels()).toEqual(['Import another menu', 'Go to products'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Go to products' })).toHaveFocus())
  })

  it('Import another resets the hook and forgets the stored run', async () => {
    const user = userEvent.setup()
    hookReports({ status: 'success', result: { appliedCount: 1, jobId: 'job-1' } })
    saveRun(runRef, { ...storedRun('success'), appliedCount: 1 })
    renderDialog()
    await user.click(await screen.findByRole('button', { name: 'Import another menu' }))
    expect(mocks.reset).toHaveBeenCalledTimes(1)
    expect(getRun(runRef)).toBeNull()
  })
})

describe('GloriaFoodImportDialog — Go to products (main)', () => {
  it('hands it to the caller, and closes, when the caller is already on the store products', async () => {
    const user = userEvent.setup()
    const onGoToProducts = vi.fn()
    hookReports({ status: 'success', result: { appliedCount: 1, jobId: 'job-1' } })
    renderDialog({ onGoToProducts })
    await user.click(await screen.findByRole('button', { name: 'Go to products' }))
    expect(onGoToProducts).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('Check products after a lost connection takes the same way', async () => {
    const user = userEvent.setup()
    const onGoToProducts = vi.fn()
    hookReports({ status: 'unknown', error: { message: 'lost', retryable: true } })
    renderDialog({ onGoToProducts })
    await user.click(await screen.findByRole('button', { name: 'Check products' }))
    expect(onGoToProducts).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('without the prop it still navigates to the store products, and Check products too', async () => {
    const user = userEvent.setup()
    hookReports({ status: 'unknown', error: { message: 'lost', retryable: true } })
    renderDialog()
    await user.click(await screen.findByRole('button', { name: 'Check products' }))
    expect(mocks.push).toHaveBeenCalledWith('/stores/products/fast-bite')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
