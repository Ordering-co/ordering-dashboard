/* eslint-disable import/first */
// redesign DL-B4 (decision 3 | M-DL12): the export button of /delivery/drivers-list asks first (decision 25: scope and
// destination), says only what the request really holds and shows what the API answered.
//
// The controller is the REAL K/UsersExportCSV (only its API and session contexts are stubs, and `fetch` is a spy): the sentence in
// the confirmation is checked against the URL the controller really sends, so it cannot drift from the request. The Product wrappers
// (Button, ConfirmDialog, AlertDialog) are the real ones.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const controller = vi.hoisted(() => ({ props: null }))
vi.mock('../../../../../../index', async () => {
  const { UsersExportCSV: Real } = await vi.importActual('../../../../../../components/UsersExportCSV')
  // the real controller, seen through a spy that records the props the button hands it (DM-B4: `role` must not be one of them)
  const UsersExportCSV = (props) => {
    controller.props = props
    return React.createElement(Real, props)
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (key, fallback) => fallback ?? key],
    UsersExportCSV
  }
})
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v1/en/project' }] }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok', loading: false }] }))

import { DriversExport } from '../DriversExport'

const SENT = 'The report will be generated and sent to your email when ready'
// what DeliveryDriversList + the controller hand main's header: level 4, no enabled condition, active state not asked for
const baseProps = {
  defaultUserTypesSelected: [4],
  disabledActiveStateCondition: true,
  userTypesSelected: [4],
  selectedUserActiveState: true
}
const SCOPE = 'The file includes active and inactive drivers. The search and the status filter don\'t apply.'

const runtime = { answer: null, hold: false, release: null }
const fetchSpy = vi.fn()

const mount = (extra) => renderWithProviders(<DriversExport {...baseProps} {...extra} />)
const exportButton = () => screen.getByRole('button', { name: 'Export CSV' })
const confirmDialog = () => screen.findByRole('alertdialog', { name: 'Export drivers to CSV?' })
const sentUrl = () => new URL(fetchSpy.mock.calls[0][0])

beforeEach(() => {
  runtime.answer = { error: false, result: [SENT] }
  runtime.hold = false
  runtime.release = null
  fetchSpy.mockReset()
  fetchSpy.mockImplementation(() => new Promise((resolve) => {
    const respond = () => resolve({ json: async () => (typeof runtime.answer === 'function' ? runtime.answer() : runtime.answer) })
    if (runtime.hold) runtime.release = respond
    else respond()
  }))
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.getElementById('app-modals')?.remove()
})

describe('DriversExport · asks first (decision 25)', () => {
  it('is a secondary button with the download icon and the words «Export CSV»', () => {
    mount()
    expect(exportButton()).toHaveAttribute('data-variant', 'secondary')
    expect(exportButton().querySelector('svg')).not.toBeNull()
  })

  it('a click opens the confirmation and sends nothing; Cancel sends nothing either', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(fetchSpy).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('the confirmation has a close button and Escape closes it without sending', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('only confirming exports, once', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  })

  it('a disabled button (actionDisabled on the page) opens nothing', async () => {
    const user = userEvent.setup()
    mount({ disabled: true })
    expect(exportButton()).toBeDisabled()
    await user.click(exportButton())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('stays busy while the request runs and cannot be repeated', async () => {
    runtime.hold = true
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(exportButton()).toHaveAttribute('aria-busy', 'true'))
    await user.click(exportButton())
    expect(screen.queryByRole('alertdialog', { name: 'Export drivers to CSV?' })).not.toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    runtime.release()
    const result = await screen.findByRole('alertdialog', { name: 'Export' })
    await user.click(within(result).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(exportButton()).not.toHaveAttribute('aria-busy')
  })
})

describe('DriversExport · the sentence is what the controller really sends (M-DL12)', () => {
  // K/UsersExportCSV with `getCSV(true)`: `where` holds ONE condition, the level of the page's user types; the active state
  // condition is commented out in the controller; the search (`searchValue`, `isSearchBy*`) and `multiFilterValues` are not props
  // this button receives, so neither they nor the page's status filter reach the request.
  it('says active and inactive drivers and that the search and the status filter do not apply', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(within(dialog).getByText(SCOPE)).toBeInTheDocument()
  })

  it('promises nothing the code does not prove: no «all», no destination (e-mail, download)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(dialog.textContent).not.toMatch(/\ball\b/i)
    expect(dialog.textContent).not.toMatch(/e-?mail|inbox|download|sent to/i)
  })

  it('the request is level 4 only: no enabled, no search, no status, no filters', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const url = sentUrl()
    expect(url.pathname).toBe('/v1/en/project/users_new.csv')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mode: 'dashboard',
      orderBy: 'id',
      version: 'v2',
      where: JSON.stringify({ conditions: [{ attribute: 'level', value: [4] }], conector: 'AND' })
    })
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer tok' } })
  })

  it('even if the page hands it the search, the status or filters, the button forwards none of them (the sentence stays true)', async () => {
    const user = userEvent.setup()
    // the controller would add a condition for each of these if it received them
    mount({
      searchValue: 'ana',
      isSearchByUserName: true,
      isSearchByUserEmail: true,
      isSearchByUserPhone: true,
      isSearchByUserId: true,
      statusFilter: 'busy',
      multiFilterValues: { name: 'Ana', enabled: true }
    })
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const where = JSON.parse(sentUrl().searchParams.get('where'))
    expect(where.conditions).toEqual([{ attribute: 'level', value: [4] }])
  })
})

describe('DriversExport · the result says what the API answered', () => {
  const confirmExport = async (user) => {
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
  }

  it('shows the API words under a neutral title and never claims it is done', async () => {
    const user = userEvent.setup()
    mount()
    await confirmExport(user)
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText(SENT)).toBeInTheDocument()
    expect(within(dialog).queryByText(/\b(done|finished|complete[d]?|exported)\b/i)).not.toBeInTheDocument()
  })

  it('reads an answer that comes as an object with a message', async () => {
    runtime.answer = { error: false, result: { message: SENT } }
    const user = userEvent.setup()
    mount()
    await confirmExport(user)
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText(SENT)).toBeInTheDocument()
  })

  it('shows the words of an error answer of the API, as they are', async () => {
    runtime.answer = { error: true, result: ['You do not have access'] }
    const user = userEvent.setup()
    mount()
    await confirmExport(user)
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText('You do not have access')).toBeInTheDocument()
  })

  it('an answer with no text still says something true, not an empty dialog', async () => {
    runtime.answer = { error: false, result: {} }
    const user = userEvent.setup()
    mount()
    await confirmExport(user)
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText('The export was requested.')).toBeInTheDocument()
  })

  it('a thrown request says the export failed and does not leak the raw error', async () => {
    runtime.answer = () => { throw new TypeError('Failed to fetch') }
    const user = userEvent.setup()
    mount()
    await confirmExport(user)
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText('The export failed. Try again.')).toBeInTheDocument()
    expect(within(dialog).queryByText('Failed to fetch')).not.toBeInTheDocument()
    expect(within(dialog).queryByText(SENT)).not.toBeInTheDocument()
  })

  it('closing the result gives the page back and a second export asks again', async () => {
    const user = userEvent.setup()
    mount()
    await confirmExport(user)
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(exportButton())
    await confirmDialog()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

// redesign DM-B4 (decision 1 | M-DL12): the same button for /delivery/drivers-managers. `role` reaches the UI only.
describe('DriversExport · role «managers» (DM-B4)', () => {
  const MANAGERS_SCOPE = 'The file includes active and inactive driver managers. The search doesn\'t apply.'

  it('asks «Export driver managers to CSV?» and says what the file holds', async () => {
    const user = userEvent.setup()
    mount({ role: 'managers' })
    await user.click(exportButton())
    const dialog = await screen.findByRole('alertdialog', { name: 'Export driver managers to CSV?' })
    expect(within(dialog).getByText(MANAGERS_SCOPE)).toBeInTheDocument()
    expect(within(dialog).queryByText(SCOPE)).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog', { name: 'Export drivers to CSV?' })).not.toBeInTheDocument()
  })

  it('with role «drivers» or none the confirmation is the drivers\' one', async () => {
    const user = userEvent.setup()
    mount({ role: 'drivers' })
    await user.click(exportButton())
    expect(within(await confirmDialog()).getByText(SCOPE)).toBeInTheDocument()
  })

  it('the controller gets only its four props, `disabled` and the UI: the role is not forwarded to it', () => {
    mount({ role: 'managers', disabled: true })
    expect(Object.keys(controller.props).sort()).toEqual([
      'UIComponent',
      'defaultUserTypesSelected',
      'disabled',
      'disabledActiveStateCondition',
      'selectedUserActiveState',
      'userTypesSelected'
    ])
    expect(controller.props).not.toHaveProperty('role')
  })

  it('keeps the dialog open across re-renders (the UI is not a new component each time)', async () => {
    const user = userEvent.setup()
    const { rerender } = mount({ role: 'managers' })
    await user.click(exportButton())
    await screen.findByRole('alertdialog', { name: 'Export driver managers to CSV?' })
    rerender(<DriversExport {...baseProps} role='managers' />)
    expect(screen.getByRole('alertdialog', { name: 'Export driver managers to CSV?' })).toBeInTheDocument()
  })
})
