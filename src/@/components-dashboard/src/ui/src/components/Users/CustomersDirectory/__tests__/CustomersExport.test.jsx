/* eslint-disable import/first */
// redesign UC-B6 · the export button of /users/customers asks first, says what the file really holds and what
// the API answered.
//
// redesign UF-B2 (auditor #9): the second half of this file (the M-13 «the error of the API never paints an empty alert»
// cases of the three user forms and the `onDirtyChange` cases of the profile) moved out with the forms it tested. The profile ones are
// rewritten for the save bar in `Users/UserFormDetails/__tests__/UserFormDetails.test.jsx`; the `UserAddForm` and `UserMetaFields`
// ones travel with batches UF-B4 and UF-B5 into their own files.
//
// The controller is the mock: it hands the real UI the props the real one hands it, so what is under test is
// the UI of this tree (the Product wrappers are real).
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  getCSV: null,
  next: { loading: false, error: null, result: null },
  hold: false,
  release: null
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const dictionary = {}
  return {
    useLanguage: () => [{ dictionary }, (key, fallback) => fallback ?? key],
    useConfig: () => [{ configs: {} }],
    UsersExportCSV: ({ UIComponent, ...props }) => {
      const [status, setStatus] = React.useState({ loading: false, error: null, result: null })
      const getCSV = (...args) => {
        runtime.getCSV(...args)
        setStatus({ loading: true, error: null, result: null })
        const finish = () => setStatus(runtime.next)
        if (runtime.hold) runtime.release = finish
        else setTimeout(finish, 0)
      }
      return <UIComponent {...props} actionStatus={status} getCSV={getCSV} />
    }
  }
})

import { CustomersExport } from '../CustomersExport'

const sent = 'The report will be generated and sent to your email when ready'
const emptyFilters = {
  id: null,
  externalId: null,
  name: null,
  lastname: null,
  email: null,
  cityIds: [],
  cellphone: null,
  countryPhoneCode: null,
  phoneVerified: null,
  emailVerified: null,
  userType: null,
  loyaltyLevel: null,
  enabled: null,
  ordersCount: { value: '', condition: 'eq' },
  dateType: null,
  deliveryFromDatetime: null,
  deliveryEndDatetime: null
}
const baseProps = { userTypesSelected: [3], defaultUserTypesSelected: [3], multiFilterValues: emptyFilters }
const mount = (extra) => renderWithProviders(<CustomersExport {...baseProps} {...extra} />)
const exportButton = () => screen.getByRole('button', { name: 'Export CSV' })
const confirmDialog = () => screen.findByRole('alertdialog', { name: 'Export customers to CSV?' })

beforeEach(() => {
  runtime.getCSV = vi.fn()
  runtime.next = { loading: false, error: null, result: [sent] }
  runtime.hold = false
  runtime.release = null
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('CustomersExport · asks first (decision 5, auditor #12)', () => {
  it('a click opens the confirmation and sends nothing; Cancel sends nothing either', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(runtime.getCSV).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })

  it('only confirming exports, once, with the filters applied', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    const dialog = await confirmDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Export CSV' }))
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(true)
  })

  it('is a secondary button with the download icon', () => {
    mount()
    expect(exportButton()).toHaveAttribute('data-variant', 'secondary')
    expect(exportButton().querySelector('svg')).not.toBeNull()
  })

  it('stays busy while the request runs and cannot be repeated', async () => {
    runtime.hold = true
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(exportButton()).toHaveAttribute('aria-busy', 'true'))
    await user.click(exportButton())
    expect(screen.queryByRole('alertdialog', { name: 'Export customers to CSV?' })).not.toBeInTheDocument()
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    await act(async () => { runtime.release() })
    const result = await screen.findByRole('alertdialog', { name: 'Export' })
    await user.click(within(result).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(exportButton()).not.toHaveAttribute('aria-busy')
  })

  it('a disabled button does not open anything', async () => {
    const user = userEvent.setup()
    mount({ disabled: true })
    await user.click(exportButton())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('CustomersExport · the scope text is what the call really sends (M-C13)', () => {
  // redesign UC-R2b (Q-03): the sentence names what the request applies, pills included
  const scope = 'The file includes active and inactive customers that match the active filters (Verified, Sign up date, Loyalty level and the Filters panel, except ID and External ID). The search, the Orders filter and the Active/Inactive tab don\'t apply.'
  const oldScope = 'match the Filters panel, except ID and External ID'
  const all = 'The file includes all customers, active and inactive.'

  it.each([
    ['a name', { name: 'Ana' }],
    ['an email', { email: 'ana@example.com' }],
    ['a verified pill', { phoneVerified: true }],
    ['a loyalty level', { loyaltyLevel: 4 }],
    ['a sign-up date range', { deliveryFromDatetime: '2026-01-01 00:00:00', deliveryEndDatetime: '2026-02-01 23:59:59' }],
    ['an amount of orders', { ordersCount: { value: '3', condition: 'gt' } }],
    ['a city', { cityIds: [7] }],
    ['a seeded country code', { countryPhoneCode: '34' }]
  ])('with %s in the Filters panel it says the file follows the panel', async (_label, change) => {
    const user = userEvent.setup()
    mount({ multiFilterValues: { ...emptyFilters, ...change } })
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(within(dialog).getByText(scope)).toBeInTheDocument()
    expect(within(dialog).queryByText(all)).not.toBeInTheDocument()
    expect(dialog.textContent).not.toContain(oldScope)
  })

  it.each([
    ['an untouched panel', emptyFilters],
    ['no object at all', undefined],
    ['an empty object', {}],
    ['only ID and External ID (the export ignores them)', { ...emptyFilters, id: '12', externalId: '34' }],
    ['blank texts and an empty amount', { ...emptyFilters, name: '', email: '', ordersCount: { value: '', condition: 'gt' } }]
  ])('with %s it says the file holds all customers', async (_label, multiFilterValues) => {
    const user = userEvent.setup()
    mount({ multiFilterValues })
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(within(dialog).getByText(all)).toBeInTheDocument()
    expect(within(dialog).queryByText(scope)).not.toBeInTheDocument()
  })

  it('the search, the Orders pill and the tab never reach the request (they are not props of the button)', async () => {
    const user = userEvent.setup()
    mount({ multiFilterValues: { ...emptyFilters, name: 'Ana' } })
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    expect(runtime.getCSV).toHaveBeenCalledWith(true)
  })
})

describe('CustomersExport · the result says what the API answered', () => {
  it('shows the API words under a neutral title and never claims it is done', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText(sent)).toBeInTheDocument()
    expect(within(dialog).queryByText(/\b(done|finished|complete[d]?|exported)\b/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/export (finished|done|complete)/i)).not.toBeInTheDocument()
  })

  it('reads an answer that comes as an object with a message', async () => {
    runtime.next = { loading: false, error: null, result: { message: sent } }
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText(sent)).toBeInTheDocument()
  })

  it('an answer with no text still says something true, not an empty dialog', async () => {
    runtime.next = { loading: false, error: null, result: {} }
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText('The export was requested.')).toBeInTheDocument()
  })

  it('a thrown request says the export failed (it was silent) and does not leak the raw error', async () => {
    runtime.next = { loading: false, error: new TypeError('Failed to fetch'), result: null }
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    expect(within(dialog).getByText('The export failed. Try again.')).toBeInTheDocument()
    expect(within(dialog).queryByText('Failed to fetch')).not.toBeInTheDocument()
    expect(within(dialog).queryByText(sent)).not.toBeInTheDocument()
  })

  it('closing the result gives the page back and a second export asks again', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export CSV' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Export' })
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(exportButton())
    await confirmDialog()
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
  })
})
