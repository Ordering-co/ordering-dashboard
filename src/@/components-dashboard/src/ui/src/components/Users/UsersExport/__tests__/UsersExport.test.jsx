/* eslint-disable import/first */
// redesign BO-B2 (promotion): the export button takes its words from the `copy` prop. The customers copy and the behaviour
// (asks first, scope text, result) are covered by CustomersDirectory/__tests__/CustomersExport.test.jsx through the wrapper.
// The controller is the mock: it hands the real UI the props the real one hands it (same stand-in as that test).
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  getCSV: null,
  next: { loading: false, error: null, result: null }
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
        setTimeout(() => setStatus(runtime.next), 0)
      }
      return <UIComponent {...props} actionStatus={status} getCSV={getCSV} />
    }
  }
})

import { UsersExport } from '../UsersExport'

const OWNERS_COPY = {
  button: { key: 'OWNERS_EXPORT_CSV', text: 'Export owners' },
  title: { key: 'OWNERS_EXPORT_TITLE', text: 'Export business owners to CSV?' },
  confirm: { key: 'OWNERS_EXPORT_CONFIRM', text: 'Export owners now' },
  scopeAll: { key: 'OWNERS_EXPORT_SCOPE_ALL', text: 'The file includes all business owners.' },
  scopeFiltered: { key: 'OWNERS_EXPORT_SCOPE_FILTERS', text: 'The file includes the business owners that match the filters.' },
  resultTitle: { key: 'OWNERS_EXPORT_RESULT_TITLE', text: 'Owners export' },
  requested: { key: 'OWNERS_EXPORT_REQUESTED', text: 'The owners export was requested.' },
  error: { key: 'OWNERS_EXPORT_ERROR', text: 'The owners export failed.' }
}
const emptyFilters = { name: null, lastname: null, email: null, cellphone: null, countryPhoneCode: null, ordersCount: { value: '', condition: 'eq' }, cityIds: [] }
const mount = (extra) => renderWithProviders(
  <UsersExport copy={OWNERS_COPY} userTypesSelected={[2]} defaultUserTypesSelected={[2]} multiFilterValues={emptyFilters} {...extra} />
)
const exportButton = () => screen.getByRole('button', { name: 'Export owners' })
const confirmDialog = () => screen.findByRole('alertdialog', { name: 'Export business owners to CSV?' })

beforeEach(() => {
  runtime.getCSV = vi.fn()
  runtime.next = { loading: false, error: null, result: {} }
})
afterEach(() => document.getElementById('app-modals')?.remove())

// redesign (row 92): the words of the button are their own node, marked for the page header, which clips it in a narrow header
// (the pages used to hide a bare text node with `font-size: 0`)
describe('UsersExport · the words are a collapsible node (row 92)', () => {
  it('wraps the label in a span marked data-collapse-label; the name of the button stays the words', () => {
    mount()
    const label = exportButton().querySelector('span[data-collapse-label]')
    expect(label).not.toBeNull()
    expect(label).toHaveTextContent('Export owners')
    expect(exportButton()).toHaveAccessibleName('Export owners')
  })
})

describe('UsersExport · copy', () => {
  it('the button, the title, the scope and the confirm label are the ones it was given', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(within(dialog).getByText('The file includes all business owners.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Export owners now' })).toBeInTheDocument()
    expect(within(dialog).queryByText(/customers/i)).not.toBeInTheDocument()
    expect(runtime.getCSV).not.toHaveBeenCalled()
  })

  it('says the filtered scope of the copy when a sheet field holds a value', async () => {
    const user = userEvent.setup()
    mount({ multiFilterValues: { ...emptyFilters, cellphone: '555' } })
    await user.click(exportButton())
    const dialog = await confirmDialog()
    expect(within(dialog).getByText('The file includes the business owners that match the filters.')).toBeInTheDocument()
  })

  it('exports once on confirm, and an answer with no text uses the title and the fallback of the copy', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export owners now' }))
    expect(runtime.getCSV).toHaveBeenCalledTimes(1)
    expect(runtime.getCSV).toHaveBeenCalledWith(true)
    const dialog = await screen.findByRole('alertdialog', { name: 'Owners export' })
    expect(within(dialog).getByText('The owners export was requested.')).toBeInTheDocument()
  })

  it('a thrown request says the failure of the copy, not the raw error', async () => {
    runtime.next = { loading: false, error: new TypeError('Failed to fetch'), result: null }
    const user = userEvent.setup()
    mount()
    await user.click(exportButton())
    await user.click(within(await confirmDialog()).getByRole('button', { name: 'Export owners now' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Owners export' })
    expect(within(dialog).getByText('The owners export failed.')).toBeInTheDocument()
    expect(within(dialog).queryByText('Failed to fetch')).not.toBeInTheDocument()
  })
})
