/* eslint-disable import/first */
// redesign IM-C (D3): the import dialog of DoorDash, Uber Eats and Ordering.co on P/Dialog. Same logic as
// MenuImportModal (validation, params, prefill, Clear), plus: a failure stays in the dialog (IM-03), a late prefill never
// overwrites what the user typed (IM-13), the first field has the focus, and nothing closes it while it imports.
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
  // the run state of useMenuImport: the tests set it before rendering, as the hook would report it
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
vi.mock('../logMenuImportSync', async (importActual) => ({
  ...(await importActual()),
  fetchMenuImportSync: (...args) => mocks.fetchSync(...args)
}))

import { IMPORTER_CARDS } from '../importerCards'
import { getRun, saveRun } from '../menuImportRuns'
import { MenuImportDialog } from '../MenuImportDialog'

const business = { id: 42, name: 'Fast Bite', slug: 'fast-bite' }
const cardOf = (id) => IMPORTER_CARDS.find((card) => card.id === id)
const DOORDASH_URL = 'https://www.doordash.com/store/fast-bite-123'
const ORDERING_URL = 'https://api.orderingplus.com/v400/en/acme/business/pizza'

const onClose = vi.fn()
const renderDialog = (cardId = 'doordash', props = {}) => render(
  <MenuImportDialog open card={cardOf(cardId)} business={business} onClose={onClose} {...props} />
)
const urlField = (cardId = 'doordash') => screen.getByLabelText(cardOf(cardId).modalConfig.urlLabelDefault)
const importButton = () => screen.getByRole('button', { name: 'Import' })

// a prefill that arrives when the test says so
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

describe('MenuImportDialog — shell', () => {
  it('renders nothing when closed, without a card or without a config', () => {
    const { container, rerender } = render(<MenuImportDialog open={false} card={cardOf('doordash')} business={business} onClose={onClose} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<MenuImportDialog open card={null} business={business} onClose={onClose} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<MenuImportDialog open card={cardOf('gloriafood')} business={business} onClose={onClose} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('puts the initial focus on the URL field, not on Cancel or on the close button', async () => {
    renderDialog()
    await screen.findByRole('dialog')
    await waitFor(() => expect(urlField()).toHaveFocus())
  })

  it('is a md dialog named by the source, described by its subtitle, with the store as read-only data', async () => {
    renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Import from DoorDash' })
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(dialog).toHaveAccessibleDescription('Paste the DoorDash store URL for this business')
    expect(within(dialog).getByText('Store')).toBeInTheDocument()
    expect(within(dialog).getByText('Fast Bite')).toBeInTheDocument()
  })

  it('says what the import does, in a neutral line with the store name', async () => {
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('The menu is imported into Fast Bite. This can take a few minutes.')).toBeInTheDocument()
  })

  it('Cancel and the close button call onClose when it is not importing', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('Escape closes it when it is not importing', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('MenuImportDialog — the fields of each source', () => {
  it.each([
    ['doordash', 'Import from DoorDash', 'DoorDash store URL', 'https://www.doordash.com/store/...', true, false],
    ['ubereats', 'Import from Uber Eats', 'Uber Eats store URL', 'https://www.ubereats.com/store/...', true, false],
    ['ordering', 'Import from Ordering.co', 'Ordering.co business URL', 'https://apiv4.ordering.co/v400/en/yourproject/business/yourstore_…', false, true]
  ])('%s: title, URL field, helper, variants checkbox and structured fields come from its config', async (id, title, urlLabel, placeholder, hasVariants, isStructured) => {
    renderDialog(id)
    const dialog = await screen.findByRole('dialog', { name: title })
    const url = within(dialog).getByLabelText(urlLabel)
    expect(url).toHaveAttribute('placeholder', placeholder)
    expect(url).toHaveAttribute('inputmode', 'url')
    expect(url).toHaveAttribute('autocomplete', 'url')
    expect(within(dialog).getByText(cardOf(id).modalConfig.urlHelperDefault)).toBeInTheDocument()
    expect(url).toHaveAccessibleDescription(cardOf(id).modalConfig.urlHelperDefault)

    const variants = within(dialog).queryByRole('checkbox', { name: 'Include all menu variants' })
    expect(Boolean(variants)).toBe(hasVariants)
    if (variants) expect(variants).toHaveAttribute('aria-checked', 'true')

    expect(Boolean(within(dialog).queryByLabelText('Ordering.co project ID'))).toBe(isStructured)
    expect(Boolean(within(dialog).queryByLabelText('Business slug or ID'))).toBe(isStructured)
    expect(Boolean(within(dialog).queryByText('Or enter project and store without a full URL:'))).toBe(isStructured)
    if (isStructured) {
      expect(within(dialog).getByText(cardOf(id).modalConfig.orderingStructuredHintDefault)).toBeInTheDocument()
    }
  })
})

describe('MenuImportDialog — prefill and Clear', () => {
  it('asks Supabase for the last source of this store with the same arguments as the modal', async () => {
    renderDialog('ubereats')
    await screen.findByRole('dialog')
    expect(mocks.fetchSync).toHaveBeenCalledTimes(1)
    expect(mocks.fetchSync).toHaveBeenCalledWith({
      token: 'tok-1',
      businessId: 42,
      project: 'demo',
      source: 'ubereats',
      orderingApiBaseUrl: 'https://api.example.com'
    })
    expect(mocks.useMenuImportSource).toHaveBeenCalledWith('ubereats')
  })

  it('fills the stored URL, shows Clear, and Clear empties the URL fields', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    renderDialog()
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    await arrive({ source_url: DOORDASH_URL })
    expect(urlField()).toHaveValue(DOORDASH_URL)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(urlField()).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('fills project and store from an ordering-plus reference, and Clear empties both', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    renderDialog('ordering')
    await screen.findByRole('dialog')
    await arrive({ source_url: 'ordering-plus://acme/pizza' })
    expect(screen.getByLabelText('Ordering.co project ID')).toHaveValue('acme')
    expect(screen.getByLabelText('Business slug or ID')).toHaveValue('pizza')
    expect(urlField('ordering')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByLabelText('Ordering.co project ID')).toHaveValue('')
    expect(screen.getByLabelText('Business slug or ID')).toHaveValue('')
  })

  // redesign IM-13: main overwrote what the user had typed when the answer arrived late
  it('does not apply a late prefill over a field the user already typed', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), 'https://www.doordash.com/store/mine')
    await arrive({ source_url: DOORDASH_URL })
    expect(urlField()).toHaveValue('https://www.doordash.com/store/mine')
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('does not apply it either when the user touched another field first', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    renderDialog('ordering')
    await screen.findByRole('dialog')
    await user.type(screen.getByLabelText('Ordering.co project ID'), 'mine')
    await arrive({ source_url: 'ordering-plus://acme/pizza' })
    expect(screen.getByLabelText('Ordering.co project ID')).toHaveValue('mine')
    expect(screen.getByLabelText('Business slug or ID')).toHaveValue('')
  })

  it('forgets what was typed when it reopens, and the prefill applies again', async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), 'typed')
    rerender(<MenuImportDialog open={false} card={cardOf('doordash')} business={business} onClose={onClose} />)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    mocks.fetchSync.mockResolvedValue({ source_url: DOORDASH_URL })
    rerender(<MenuImportDialog open card={cardOf('doordash')} business={business} onClose={onClose} />)
    await waitFor(() => expect(urlField()).toHaveValue(DOORDASH_URL))
  })
})

describe('MenuImportDialog — validation', () => {
  it('keeps Import disabled and says nothing while the form is empty', async () => {
    renderDialog()
    await screen.findByRole('dialog')
    expect(importButton()).toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('DoorDash: a URL that is not DoorDash is an error and Import stays disabled; a valid one enables it', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), 'https://example.com/store/1')
    expect(screen.getByRole('alert')).toHaveTextContent('IMPORTER_VALIDATION_INVALID_URL_DOORDASH')
    expect(urlField()).toHaveAttribute('aria-invalid', 'true')
    expect(importButton()).toBeDisabled()
    await user.clear(urlField())
    await user.type(urlField(), DOORDASH_URL)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(urlField()).not.toHaveAttribute('aria-invalid', 'true')
    expect(importButton()).toBeEnabled()
  })

  it('Uber Eats: a URL that is not Uber Eats is an error', async () => {
    const user = userEvent.setup()
    renderDialog('ubereats')
    await screen.findByRole('dialog')
    await user.type(urlField('ubereats'), DOORDASH_URL)
    expect(screen.getByRole('alert')).toHaveTextContent('IMPORTER_VALIDATION_INVALID_URL_UBEREATS')
    expect(importButton()).toBeDisabled()
  })

  it('Ordering.co: only the project is an incomplete source; project and store enable Import', async () => {
    const user = userEvent.setup()
    renderDialog('ordering')
    await screen.findByRole('dialog')
    await user.type(screen.getByLabelText('Ordering.co project ID'), 'acme')
    expect(screen.getByRole('alert')).toHaveTextContent('IMPORTER_VALIDATION_ORDERING_INCOMPLETE_STRUCTURED')
    expect(importButton()).toBeDisabled()
    await user.type(screen.getByLabelText('Business slug or ID'), 'pizza')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(importButton()).toBeEnabled()
  })
})

describe('MenuImportDialog — import', () => {
  it.each([
    ['doordash', DOORDASH_URL],
    ['ubereats', 'https://www.ubereats.com/store/fast-bite/abc'],
    ['ordering', ORDERING_URL]
  ])('%s: triggerImport receives exactly what buildImportParams builds', async (id, url) => {
    const user = userEvent.setup()
    renderDialog(id)
    await screen.findByRole('dialog')
    await user.type(urlField(id), url)
    await user.click(importButton())
    const expected = cardOf(id).modalConfig.buildImportParams(
      { url, tracker: '', orderingPlusProjectId: '', orderingBusinessSegment: '' },
      [42], 'demo', 'https://api.example.com', true, 'owner@test.com'
    )
    expect(mocks.triggerImport).toHaveBeenCalledTimes(1)
    expect(mocks.triggerImport).toHaveBeenCalledWith(expected, { onSuccess: expect.any(Function), onError: expect.any(Function) })
  })

  it('Ordering.co by project and store sends the structured params', async () => {
    const user = userEvent.setup()
    renderDialog('ordering')
    await screen.findByRole('dialog')
    await user.type(screen.getByLabelText('Ordering.co project ID'), ' acme ')
    await user.type(screen.getByLabelText('Business slug or ID'), 'pizza')
    await user.click(importButton())
    expect(mocks.triggerImport.mock.calls[0][0]).toMatchObject({
      orderingPlusProjectId: 'acme',
      orderingBusinessSegment: 'pizza',
      businessIds: [42],
      project: 'demo',
      orderingApiBaseUrl: 'https://api.example.com',
      userEmail: 'owner@test.com'
    })
    expect(mocks.triggerImport.mock.calls[0][0]).not.toHaveProperty('url')
  })

  it('sends includeAllMenuVariants=false after unchecking it', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('checkbox', { name: 'Include all menu variants' }))
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    expect(mocks.triggerImport.mock.calls[0][0]).toMatchObject({ doordashUrl: DOORDASH_URL, includeAllMenuVariants: false })
  })

  // redesign IM-03: a failure used to be only a toast
  it('a failure stays inside the dialog, keeps the URL, and goes away when the user edits a field', async () => {
    const user = userEvent.setup()
    mocks.triggerImport.mockImplementation(async (_params, { onError }) => onError(new Error('DoorDash refused this store')))
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('DoorDash refused this store')
    expect(urlField()).toHaveValue(DOORDASH_URL)
    expect(importButton()).toBeEnabled()
    await user.type(urlField(), '2')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says in words that the importer could not be reached', async () => {
    const user = userEvent.setup()
    mocks.triggerImport.mockImplementation(async (_params, { onError }) => onError(new TypeError('Failed to fetch')))
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach the menu importer. Check your connection and try again.")
  })

  it('the failure is cleared when the user tries again', async () => {
    const user = userEvent.setup()
    mocks.triggerImport.mockImplementationOnce(async (_params, { onError }) => onError(new Error('Boom')))
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
    mocks.triggerImport.mockImplementationOnce(() => new Promise(() => {}))
    await user.click(importButton())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mocks.triggerImport).toHaveBeenCalledTimes(2)
  })

  it('the failure is cleared when the user clears the URL fields', async () => {
    const user = userEvent.setup()
    const arrive = deferredSync()
    mocks.triggerImport.mockImplementation(async (_params, { onError }) => onError(new Error('Boom')))
    renderDialog()
    await screen.findByRole('dialog')
    await arrive({ source_url: DOORDASH_URL })
    await user.click(importButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('MenuImportDialog — importing', () => {
  beforeEach(() => { mocks.state.isImporting = true })

  it('shows the status of the source with a live region and a loading indicator, and the primary action busy', async () => {
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    const status = within(dialog).getByText('Importing menu from DoorDash... This may take a few minutes.')
    expect(status.closest('[aria-live="polite"]')).not.toBeNull()
    expect(dialog.querySelector('.odc-imp-spinner')).not.toBeNull()
    // busy, not disabled: it keeps the focus, and a busy button ignores clicks
    expect(importButton()).toHaveAttribute('aria-busy', 'true')
  })

  it('cannot be left: Cancel and the close button are disabled, Escape and the scrim do nothing', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Clear is disabled while importing', async () => {
    const arrive = deferredSync()
    renderDialog()
    await screen.findByRole('dialog')
    await arrive({ source_url: DOORDASH_URL })
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })
})

describe('MenuImportDialog — success', () => {
  const succeed = async (user, id = 'doordash', url = DOORDASH_URL) => {
    mocks.triggerImport.mockImplementation(async (_params, { onSuccess }) => onSuccess())
    renderDialog(id)
    await screen.findByRole('dialog')
    await user.type(urlField(id), url)
    await user.click(importButton())
  }

  it('says it worked, and the footer has only «Go to products»', async () => {
    const user = userEvent.setup()
    await succeed(user)
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Menu imported successfully')).toBeInTheDocument()
    const foot = dialog.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Go to products'])
    expect(within(dialog).queryByLabelText('DoorDash store URL')).toBeNull()
  })

  it('«Go to products» goes to the store products and closes the dialog', async () => {
    const user = userEvent.setup()
    await succeed(user)
    await user.click(await screen.findByRole('button', { name: 'Go to products' }))
    expect(mocks.push).toHaveBeenCalledWith('/stores/products/fast-bite')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('without a slug it goes to /stores/products', async () => {
    const user = userEvent.setup()
    mocks.triggerImport.mockImplementation(async (_params, { onSuccess }) => onSuccess())
    renderDialog('doordash', { business: { id: 42, name: 'Fast Bite' } })
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    await user.click(await screen.findByRole('button', { name: 'Go to products' }))
    expect(mocks.push).toHaveBeenCalledWith('/stores/products')
  })
})

// (main sync, 6f58d106): the run state of useMenuImport and the stored run of main, in the redesigned dialog.
// The tests set `mocks.state` as the hook would report it; the stored runs are the real ones (menuImportRuns, localStorage).
const STORED_AT = '2026-10-13T18:28:00.000Z'
const runRef = { project: 'demo', businessId: 42, source: 'doordash' }
const storedRun = (status) => ({
  status,
  startedAt: STORED_AT,
  finishedAt: null,
  sourceUrl: DOORDASH_URL,
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

describe('MenuImportDialog — a run stored by a previous session (main)', () => {
  // runs expire after their last activity: the clock stays near the fixtures
  beforeEach(() => { vi.useFakeTimers({ now: Date.parse(STORED_AT) + 60_000, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('reopens on the importing status, with the stored start time, instead of the empty form', async () => {
    saveRun(runRef, storedRun('importing'))
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    const status = within(dialog).getByText('Importing menu from DoorDash... This may take a few minutes.')
    expect(status.closest('[aria-live="polite"]')).not.toBeNull()
    expect(within(dialog).getByText(`PD(${STORED_AT})`)).toBeInTheDocument()
    expect(dialog.querySelector('.odc-imp-spinner')).not.toBeNull()
    // nothing is running in this session: the form cannot start a second import, but the dialog can be left
    expect(urlField()).toBeDisabled()
    expect(importButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
  })

  it('reopens on the lost-connection block with Retry and Check products, not on the form', async () => {
    saveRun(runRef, storedRun('unknown'))
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('We lost the connection to the importer')).toBeInTheDocument()
    expect(within(dialog).getByText('The import may still be running on the server. Check the products in a few minutes before importing again.')).toBeInTheDocument()
    expect(footerLabels()).toEqual(['Retry', 'Check products'])
    expect(within(dialog).queryByLabelText('DoorDash store URL')).toBeNull()
    expect(within(dialog).queryByText('Menu imported successfully')).toBeNull()
  })

  it('does not reopen on a finished run', async () => {
    saveRun(runRef, { ...storedRun('success'), appliedCount: 1 })
    renderDialog()
    await screen.findByRole('dialog')
    expect(urlField()).toBeEnabled()
    expect(screen.queryByText('Menu imported successfully')).toBeNull()
  })

  it('does not reopen on a lost-connection run already resolved by a menu check', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-13T18:40:00.000Z'), toFake: ['Date'] })
    saveRun(runRef, {
      ...storedRun('unknown'),
      checkedAt: '2026-10-13T18:35:00.000Z',
      menuBefore: { categories: 1, products: 10 },
      menuAfter: { categories: 2, products: 36 }
    })
    renderDialog()
    await screen.findByRole('dialog')
    expect(urlField()).toBeEnabled()
    expect(screen.queryByText('We lost the connection to the importer')).toBeNull()
  })

  it('Retry on a resumed lost-connection run clears it and returns to the form without importing', async () => {
    const user = userEvent.setup()
    saveRun(runRef, storedRun('unknown'))
    renderDialog()
    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(getRun(runRef)).toBeNull()
    expect(urlField()).toBeEnabled()
    expect(mocks.triggerImport).not.toHaveBeenCalled()
  })
})

describe('MenuImportDialog — the run of this session (main)', () => {
  it('shows the start time while it imports', async () => {
    hookReports({ isImporting: true, status: 'importing', startedAt: STORED_AT })
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Importing menu from DoorDash... This may take a few minutes.')).toBeInTheDocument()
    expect(within(dialog).getByText(`PD(${STORED_AT})`)).toBeInTheDocument()
  })

  it('a retryable failure names what was not imported, says why, and Retry sends the same parameters again', async () => {
    const user = userEvent.setup()
    const message = 'The menu source is not available right now. Try again later.'
    importAnswers({ status: 'failed', error: { message, retryable: true } }, { fail: true })
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The DoorDash menu was not imported')
    expect(alert).toHaveTextContent(message)
    // the URL stays, and the primary action is now Retry
    expect(urlField()).toHaveValue(DOORDASH_URL)
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
    mocks.triggerImport.mockImplementationOnce(() => new Promise(() => {}))
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.triggerImport).toHaveBeenCalledTimes(2)
    expect(mocks.triggerImport.mock.calls[1][0]).toEqual(mocks.triggerImport.mock.calls[0][0])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure that is not retryable offers no Retry, only Import after editing', async () => {
    const user = userEvent.setup()
    const message = 'Check the import details and try again.'
    importAnswers({ status: 'failed', error: { message, retryable: false } }, { fail: true })
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('The DoorDash menu was not imported')
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(importButton()).toBeEnabled()
  })

  it('editing a field after a retryable failure takes the message and Retry away', async () => {
    const user = userEvent.setup()
    importAnswers({ status: 'failed', error: { message: 'Try again later.', retryable: true } }, { fail: true })
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
    await screen.findByRole('button', { name: 'Retry' })
    await user.type(urlField(), '2')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(importButton()).toBeEnabled()
  })

  it('an unknown result says the import may still be running, without the success copy', async () => {
    hookReports({ status: 'unknown', error: { message: 'lost', retryable: true } })
    renderDialog()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('We lost the connection to the importer')).toBeInTheDocument()
    expect(within(dialog).getByText('The import may still be running on the server. Check the products in a few minutes before importing again.')).toBeInTheDocument()
    expect(footerLabels()).toEqual(['Retry', 'Check products'])
    expect(within(dialog).queryByText('Menu imported successfully')).toBeNull()
    expect(within(dialog).queryByLabelText('DoorDash store URL')).toBeNull()
    // the primary action takes the focus: the button that had it is gone
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check products' })).toHaveFocus())
  })

  it('Retry after an unknown result sends the same parameters again', async () => {
    const user = userEvent.setup()
    importAnswers({ status: 'unknown', error: { message: 'lost', retryable: true } }, { fail: true })
    renderDialog()
    await screen.findByRole('dialog')
    await user.type(urlField(), DOORDASH_URL)
    await user.click(importButton())
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

describe('MenuImportDialog — Go to products (main)', () => {
  it('hands it to the caller, and closes, when the caller is already on the store products', async () => {
    const user = userEvent.setup()
    const onGoToProducts = vi.fn()
    hookReports({ status: 'success', result: { appliedCount: 1, jobId: 'job-1' } })
    renderDialog('doordash', { onGoToProducts })
    await user.click(await screen.findByRole('button', { name: 'Go to products' }))
    expect(onGoToProducts).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('Check products after a lost connection takes the same way', async () => {
    const user = userEvent.setup()
    const onGoToProducts = vi.fn()
    hookReports({ status: 'unknown', error: { message: 'lost', retryable: true } })
    renderDialog('doordash', { onGoToProducts })
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

describe('MenuImportDialog — Ordering.co host (main)', () => {
  it('a URL on a host that is not an Ordering API says only Ordering.co API URLs are accepted', async () => {
    const user = userEvent.setup()
    renderDialog('ordering')
    await screen.findByRole('dialog')
    await user.type(urlField('ordering'), 'https://www.example.com/v400/en/acme/business/pizza')
    expect(screen.getByRole('alert')).toHaveTextContent('Only Ordering.co API URLs are accepted here.')
    expect(urlField('ordering')).toHaveAttribute('aria-invalid', 'true')
    expect(importButton()).toBeDisabled()
  })

  it('the host of the project API root is accepted: the dialog hands the root to the validation', async () => {
    const user = userEvent.setup()
    renderDialog('ordering')
    await screen.findByRole('dialog')
    await user.type(urlField('ordering'), 'https://api.example.com/v400/en/demo/business/pizza')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(importButton()).toBeEnabled()
  })
})
