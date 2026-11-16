/* eslint-disable import/first */
// redesign stores 5.12 (; E4): the customer fees of a store on Product. A DataTable (RecordCards under 768px) with a
// switch that saves at once, a selection bar with a confirmed bulk delete, and the fee's detail in a P/SectionSplit with a save bar.
// Covered: the table markup and its cells (amount, minimum, conditions with translated unknown ids); the legacy service-fee field
// (`keepLegacyField`); the empty state; the switch (`updateFee(id, { enabled }, { inlineError: true })`, back on a failure, never
// opens the row); the bulk delete (count in the question, partial failure keeps the failed ids selected and says why); the detail
// (validation under the fields, the payload of `main`, the API error in the save bar, labelled selects). The controller is a
// stand-in that keeps the list like the real one; the DatePicker is stood in (it has its own tests); the condition selects are the real P/SelectField.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({
  fees: [],
  sites: [],
  paymethods: [],
  phone: false,
  level: 0,
  spies: { update: null, create: null, remove: null },
  answers: {}
}))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{ parsePrice: (value) => `Q ${Number(value).toFixed(2)}` }],
    useConfig: () => [{ configs: {} }],
    useSession: () => [{ user: { level: probe.level } }],
    // The controller's part: it keeps the list, and the three writes answer like the real one (`{ error, result }`).
    CustomerFees: ({ UIComponent, ...props }) => {
      const [fees, setFees] = ReactModule.useState(probe.fees)
      const [searchValue, setSearchValue] = ReactModule.useState(null)
      const [pagination, setPagination] = ReactModule.useState({ currentPage: 1, pageSize: 10, totalPages: 1, totalItems: probe.fees.length })
      const updateFee = async (id, changes, options) => {
        probe.spies.update?.(id, changes, options)
        if (probe.answers.update) return probe.answers.update
        setFees(prev => prev.map(fee => (fee.id === id ? { ...fee, ...changes } : fee)))
        return { error: false, result: { id, ...changes } }
      }
      const createFee = async (payload, options) => {
        probe.spies.create?.(payload, options)
        if (probe.answers.create) return probe.answers.create
        const created = { id: 99, ...payload }
        setFees(prev => [created, ...prev])
        return { error: false, result: created }
      }
      const deleteFees = async (ids, options) => {
        probe.spies.remove?.(ids, options)
        if (probe.answers.remove) {
          setFees(prev => prev.filter(fee => !probe.answers.remove.deletedIds.includes(fee.id)))
          return probe.answers.remove
        }
        setFees(prev => prev.filter(fee => !ids.includes(fee.id)))
        return { error: false, result: true, deletedIds: ids, failedIds: [] }
      }
      return ReactModule.createElement(UIComponent, {
        ...props,
        businessId: 397,
        feesList: { loading: false, fees: probe.answers.search && searchValue ? probe.answers.search : fees },
        getFees: () => {},
        createFee,
        updateFee,
        deleteFees,
        searchValue,
        handleChangeSearch: (value) => { probe.spies.search?.(value); setSearchValue(value) },
        paginationProps: { ...pagination, totalItems: probe.answers.search && searchValue ? probe.answers.search.length : fees.length },
        setPaginationProps: setPagination,
        sitesState: { sites: probe.sites },
        paymethodsState: { paymethods: probe.paymethods },
        actionState: { loading: false }
      })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))
vi.mock('../../../Shared', () => ({ RecipientSelect: () => null }))
vi.mock('../../../Shared/Product/DatePicker', () => ({
  DatePicker: ({ label, value, onChange }) => (
    <input aria-label={label} value={value || ''} onChange={event => onChange(event.target.value || null)} />
  )
}))

import { CustomerFees } from '../index'

const SERVICE = { id: 11, name: 'Service', description: 'Platform fee', fixed: 30, percentage: 0, enabled: true, site_id: null, paymethod_id: null, delivery_type: null }
const CARD = { id: 12, name: 'Card fee', description: '', fixed: 2, percentage: 3, fixed_minimum: 5, enabled: false, site_id: 7, paymethod_id: 9, delivery_type: 'delivery' }

const renderFees = (props = {}) => renderWithProviders(
  <CustomerFees businessId={397} {...props} />,
  {
    theme: {
      colors: {
        primary: '#E63757',
        primaryContrast: '#ffffff',
        lightPrimary: '#FFF2F4',
        backgroundPage: '#ffffff',
        headingColor: '#344054',
        lightGray: '#f5f5f5',
        borderColor: '#e9ecef'
      }
    }
  }
)

const nameButton = (name) => screen.getByRole('button', { name: `${name}, View details` })
const detailOf = (title) => screen.getByRole('heading', { level: 3, name: title })

afterEach(() => document.getElementById('app-modals')?.remove())

beforeEach(() => {
  probe.fees = []
  probe.sites = []
  probe.paymethods = []
  probe.phone = false
  probe.level = 0
  probe.spies = { update: vi.fn(), create: vi.fn(), remove: vi.fn(), search: vi.fn() }
  probe.answers = {}
  window.history.replaceState(null, '', '/')
})

describe('CustomerFees table', () => {
  it('draws the fees in a Product table with their cells', () => {
    probe.fees = [SERVICE, CARD]
    probe.sites = [{ id: 7, name: 'Main site' }]
    probe.paymethods = [{ id: 9, name: 'Cash' }]
    const { container } = renderFees()
    const table = screen.getByRole('table', { name: 'Customer fees' })
    expect(table.classList.contains('odc-table')).toBe(true)
    expect(container.querySelector('.odc-cf')).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Conditions' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByText('Platform fee')).toBeInTheDocument()
    expect(screen.getByText('Q 30.00 + 0%')).toBeInTheDocument()
    expect(screen.getByText('Q 2.00 + 3%')).toBeInTheDocument()
    expect(screen.getByText('Min: Q 5.00')).toBeInTheDocument()
    expect(screen.getByText('Main site')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('Delivery')).toBeInTheDocument()
    // no inline style on the minimum, no legacy markup
    expect(container.querySelector('.odc-cf-amount [style], .odc-cf-sub[style]')).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Service' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Service' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Enabled: Card fee' }).getAttribute('aria-checked')).toBe('false')
  })

  it('names a site and a payment method it does not know by their id, translated', () => {
    probe.fees = [CARD]
    renderFees()
    expect(screen.getByText('Site 7')).toBeInTheDocument()
    expect(screen.getByText('Payment method 9')).toBeInTheDocument()
    expect(screen.queryByText('Site #7')).toBeNull()
    expect(screen.queryByText('PM #9')).toBeNull()
  })

  it('draws the same data as cards under 768px, with the switch and the selection', () => {
    probe.phone = true
    probe.fees = [SERVICE, CARD]
    renderFees()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Customer fees' })).toBeInTheDocument()
    expect(screen.getByText('Q 30.00 + 0%')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Service' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Card fee' })).toBeInTheDocument()
  })

  it('searches through handleChangeSearch, with a labelled field', async () => {
    probe.fees = [SERVICE]
    renderFees()
    const field = screen.getByRole('searchbox', { name: 'Search customer fees' })
    fireEvent.change(field, { target: { value: 'ser' } })
    await waitFor(() => expect(probe.spies.search).toHaveBeenCalledWith('ser'))
  })
})

describe('CustomerFees amount currency', () => {
  it('formats a fixed fee with the project currency from parsePrice', () => {
    probe.fees = [{ id: 1, name: 'Service', fixed: 30, percentage: 0, enabled: true }]
    renderFees()
    expect(screen.getByText('Q 30.00 + 0%')).toBeInTheDocument()
  })

  it('formats a missing fixed amount as zero in the project currency', () => {
    probe.fees = [{ id: 2, name: 'Percent only', fixed: null, percentage: 5, enabled: true }]
    renderFees()
    expect(screen.getByText('Q 0.00 + 5%')).toBeInTheDocument()
  })

  it('formats the minimum with the project currency', () => {
    probe.fees = [{ id: 3, name: 'With minimum', fixed: 30, percentage: 0, fixed_minimum: 5, enabled: true }]
    renderFees()
    expect(screen.getByText('Min: Q 5.00')).toBeInTheDocument()
  })
})

describe('CustomerFees legacy field and empty state', () => {
  it('shows the legacy service-fee field on top when keepLegacyField is set, even with fees', () => {
    probe.fees = [SERVICE]
    renderFees({ legacyField: <div data-testid='legacy'>Service fee settings</div>, keepLegacyField: true })
    expect(screen.getByTestId('legacy')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Customer fees' })).toBeInTheDocument()
  })

  it('hides the legacy field when there are fees and it is not kept', () => {
    probe.fees = [SERVICE]
    renderFees({ legacyField: <div data-testid='legacy'>Service fee settings</div> })
    expect(screen.queryByTestId('legacy')).toBeNull()
  })

  it('shows the legacy field, an empty text and «Add customer fee» when there are no fees', async () => {
    const user = userEvent.setup()
    renderFees({ legacyField: <div data-testid='legacy'>Service fee settings</div> })
    expect(screen.getByTestId('legacy')).toBeInTheDocument()
    expect(screen.getByText('No customer fees yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('searchbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add customer fee' }))
    expect(detailOf('New customer fee')).toBeInTheDocument()
  })
})

describe('CustomerFees search without results', () => {
  it('says nothing was found and keeps the legacy field out of it', async () => {
    probe.fees = [SERVICE]
    probe.answers.search = []
    renderFees({ legacyField: <div data-testid='legacy'>Service fee settings</div> })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search customer fees' }), { target: { value: 'zzz' } })
    expect(await screen.findByText('No results found')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search customer fees' })).toHaveValue('zzz')
    expect(screen.queryByTestId('legacy')).toBeNull()
  })
})

describe('CustomerFees switch', () => {
  it('saves at once with inlineError and does not open the row', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Service' }))
    expect(probe.spies.update).toHaveBeenCalledWith(11, { enabled: false }, { inlineError: true })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled: Service' }).getAttribute('aria-checked')).toBe('false'))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('goes back to the stored value and says why when the save fails', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    probe.answers.update = { error: true, result: ['Not allowed'] }
    renderFees()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Service' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.getByRole('switch', { name: 'Enabled: Service' }).getAttribute('aria-checked')).toBe('true')
  })

  it('says the fallback text when the API gave no message', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    probe.answers.update = { error: true, result: [] }
    renderFees()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Service' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change this fee.")
  })
})

describe('CustomerFees bulk delete', () => {
  it('asks with the count, deletes with inlineError and clears the selection', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, CARD]
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select Service' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Card fee' }))
    const bar = screen.getByRole('region', { name: 'Actions for selected customer fees' })
    expect(within(bar).getByText('2 selected')).toBeInTheDocument()
    await user.click(within(bar).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete 2 customer fees?')).toBeInTheDocument()
    expect(within(dialog).getByText("Customers of this store stop paying them. This can't be undone.")).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete customer fees' }))
    await waitFor(() => expect(probe.spies.remove).toHaveBeenCalledWith([11, 12], { inlineError: true }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Actions for selected customer fees' })).toBeNull())
  })

  it('says «1 customer fee» for one', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, CARD]
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select Service' }))
    await user.click(within(screen.getByRole('region', { name: 'Actions for selected customer fees' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete 1 customer fee?')).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete customer fee' })).toBeInTheDocument() // redesign tanda AB (S-5)
  })

  it('keeps the failed ids selected and says why when only some are deleted', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, CARD]
    probe.answers.remove = { error: true, result: ['#12: Forbidden'], deletedIds: [11], failedIds: [12] }
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select Service' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Card fee' }))
    await user.click(within(screen.getByRole('region', { name: 'Actions for selected customer fees' })).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete customer fees' }))
    expect(await screen.findByText('1 fee could not be deleted: #12: Forbidden')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Card fee' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('checkbox', { name: 'Select Service' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Actions for selected customer fees' })).getByText('1 selected')).toBeInTheDocument()
  })
})

describe('CustomerFees detail', () => {
  // the one place that knows how a condition select is handled: a P/SelectField opens a listbox of options in the overlay host
  const comboOf = (label) => screen.getByRole('combobox', { name: (name) => name.startsWith(label) })
  const choose = async (user, label, option) => {
    await user.click(comboOf(label))
    const list = await screen.findByRole('listbox', { name: label, hidden: true })
    await user.click(within(list).getByRole('option', { name: option, hidden: true }))
  }

  const openNew = async (user) => {
    probe.fees = [SERVICE]
    renderFees()
    await user.click(screen.getByRole('button', { name: 'Add customer fee' }))
    return screen.getByRole('textbox', { name: /Name/ })
  }

  it('opens the fee from its name button, filled with its values', async () => {
    const user = userEvent.setup()
    probe.fees = [CARD]
    probe.sites = [{ id: 7, name: 'Main site' }]
    renderFees()
    await user.click(nameButton('Card fee'))
    expect(detailOf('Card fee')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Card fee')
    expect(screen.getByRole('textbox', { name: 'Percentage (%)' })).toHaveValue('3')
    expect(screen.getByRole('switch', { name: 'Enabled' }).getAttribute('aria-checked')).toBe('false')
    // nothing changed yet: the save bar waits for the first change
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('puts the values back with Discard and takes the save bar away', async () => {
    const user = userEvent.setup()
    probe.fees = [CARD]
    renderFees()
    await user.click(nameButton('Card fee'))
    const name = screen.getByRole('textbox', { name: /Name/ })
    await user.type(name, ' extra')
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar).toHaveTextContent('1 unsaved change')
    expect(bar).toHaveTextContent('Name')
    await user.click(within(bar).getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Card fee')
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    expect(probe.spies.update).not.toHaveBeenCalled()
  })

  it('opens the fee with Enter on its row', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    const row = screen.getByRole('row', { name: /Service/ })
    act(() => row.focus())
    await user.keyboard('{Enter}')
    expect(detailOf('Service')).toBeInTheDocument()
  })

  it('labels the three selects with a visible label that names them', async () => {
    const user = userEvent.setup()
    await openNew(user)
    for (const label of ['Delivery type', 'Payment method', 'Site (Platform)']) {
      const combo = comboOf(label)
      const labelNode = document.querySelector(`.odc-field-label[for="${combo.id}"]`)
      expect(labelNode).not.toBeNull()
      expect(labelNode.textContent).toContain(label)
    }
    expect(comboOf('Delivery type')).toHaveAccessibleName('Delivery type All delivery types')
    await user.click(comboOf('Delivery type'))
    const list = await screen.findByRole('listbox', { name: 'Delivery type', hidden: true })
    expect(within(list).getByRole('option', { name: 'All delivery types', hidden: true })).toHaveAttribute('aria-selected', 'true')
  })

  it('blocks a percentage outside 0 to 100 and says so under the field', async () => {
    const user = userEvent.setup()
    const name = await openNew(user)
    await user.type(name, 'Late fee')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '120')
    expect(screen.getByText('Enter a percentage from 0 to 100.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    expect(probe.spies.create).not.toHaveBeenCalled()
    expect(screen.getByText('Fix 1 field to save.')).toBeInTheDocument()
  })

  it('blocks an end date before the start date and says so under the end date', async () => {
    const user = userEvent.setup()
    const name = await openNew(user)
    await user.type(name, 'Late fee')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.click(screen.getByRole('switch', { name: 'Limit by date range' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-10' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-01' } })
    expect(screen.getByText('The end date must be on or after the start date.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    expect(probe.spies.create).not.toHaveBeenCalled()
  })

  it('requires a name', async () => {
    const user = userEvent.setup()
    await openNew(user)
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(probe.spies.create).not.toHaveBeenCalled()
  })

  it('creates with the payload of main, inlineError, and opens the created fee', async () => {
    const user = userEvent.setup()
    const name = await openNew(user)
    await user.type(name, '  Late fee ')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    await waitFor(() => expect(probe.spies.create).toHaveBeenCalledTimes(1))
    expect(probe.spies.create).toHaveBeenCalledWith({
      name: 'Late fee',
      description: '',
      enabled: true,
      fixed: 5,
      percentage: 0,
      fixed_minimum: null,
      delivery_type: null,
      site_id: null,
      paymethod_id: null,
      recipient: 'business',
      start_date: null,
      end_date: null
    }, { inlineError: true })
    expect(await screen.findByRole('heading', { level: 3, name: 'Late fee' })).toBeInTheDocument()
  })

  it('sends the chosen conditions and maps «all» to null', async () => {
    const user = userEvent.setup()
    probe.sites = [{ id: 7, name: 'Main site' }]
    probe.paymethods = [{ id: 9, name: 'Cash' }]
    const name = await openNew(user)
    await user.type(name, 'Cash on site')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '4')
    await user.type(screen.getByRole('textbox', { name: 'Fixed minimum' }), '2')
    await choose(user, 'Site (Platform)', 'Main site')
    await choose(user, 'Payment method', 'Cash')
    await choose(user, 'Delivery type', 'Pickup')
    await choose(user, 'Payment method', 'All payment methods')
    await user.click(screen.getByRole('switch', { name: 'Limit by date range' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-31' } })
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    await waitFor(() => expect(probe.spies.create).toHaveBeenCalledTimes(1))
    expect(probe.spies.create.mock.calls[0][0]).toMatchObject({
      name: 'Cash on site',
      fixed: 0,
      percentage: 4,
      fixed_minimum: 2,
      delivery_type: 'pickup',
      site_id: 7,
      paymethod_id: null,
      start_date: '2026-10-01',
      end_date: '2026-10-31'
    })
  })

  // lote B: the exact body the three condition selects put in the payload, pinned whatever the select is
  it('sends the whole payload with the conditions chosen: text for the delivery type, numbers for the site and the payment method', async () => {
    const user = userEvent.setup()
    probe.sites = [{ id: 7, name: 'Main site' }]
    probe.paymethods = [{ id: 9, name: 'Cash' }]
    const name = await openNew(user)
    await user.type(name, 'Payload fee')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.type(screen.getByRole('textbox', { name: 'Percentage (%)' }), '4')
    await choose(user, 'Delivery type', 'Pickup')
    await choose(user, 'Payment method', 'Cash')
    await choose(user, 'Site (Platform)', 'Main site')
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    await waitFor(() => expect(probe.spies.create).toHaveBeenCalledTimes(1))
    expect(probe.spies.create).toHaveBeenCalledWith({
      name: 'Payload fee',
      description: '',
      enabled: true,
      fixed: 5,
      percentage: 4,
      fixed_minimum: null,
      delivery_type: 'pickup',
      site_id: 7,
      paymethod_id: 9,
      recipient: 'business',
      start_date: null,
      end_date: null
    }, { inlineError: true })
  })

  it('sends null for every condition put back to «All …»', async () => {
    const user = userEvent.setup()
    probe.sites = [{ id: 7, name: 'Main site' }]
    probe.paymethods = [{ id: 9, name: 'Cash' }]
    const name = await openNew(user)
    await user.type(name, 'Back to all')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await choose(user, 'Delivery type', 'Delivery')
    await choose(user, 'Delivery type', 'All delivery types')
    await choose(user, 'Payment method', 'Cash')
    await choose(user, 'Payment method', 'All payment methods')
    await choose(user, 'Site (Platform)', 'Main site')
    await choose(user, 'Site (Platform)', 'All sites')
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    await waitFor(() => expect(probe.spies.create).toHaveBeenCalledTimes(1))
    expect(probe.spies.create).toHaveBeenCalledWith({
      name: 'Back to all',
      description: '',
      enabled: true,
      fixed: 5,
      percentage: 0,
      fixed_minimum: null,
      delivery_type: null,
      site_id: null,
      paymethod_id: null,
      recipient: 'business',
      start_date: null,
      end_date: null
    }, { inlineError: true })
  })

  it('shows the API error in the save bar and keeps the form', async () => {
    const user = userEvent.setup()
    probe.answers.create = { error: true, result: ['Fee requires a fixed amount or percentage'] }
    const name = await openNew(user)
    await user.type(name, 'Empty fee')
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(await within(bar).findByRole('alert')).toHaveTextContent('Fee requires a fixed amount or percentage')
    expect(within(bar).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Empty fee')
  })

  it('saves an edit with the full payload, inlineError and «Saved»', async () => {
    const user = userEvent.setup()
    probe.fees = [CARD]
    renderFees()
    await user.click(nameButton('Card fee'))
    const name = screen.getByRole('textbox', { name: /Name/ })
    await user.clear(name)
    await user.type(name, 'Card surcharge')
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByText('1 unsaved change')).toBeInTheDocument()
    await user.click(within(bar).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(probe.spies.update).toHaveBeenCalledTimes(1))
    expect(probe.spies.update.mock.calls[0][0]).toBe(12)
    expect(probe.spies.update.mock.calls[0][1]).toMatchObject({ name: 'Card surcharge', fixed: 2, percentage: 3, fixed_minimum: 5, delivery_type: 'delivery', site_id: 7, paymethod_id: 9, enabled: false })
    expect(probe.spies.update.mock.calls[0][2]).toEqual({ inlineError: true })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(detailOf('Card surcharge')).toBeInTheDocument()
  })
})

// `PUT` and `DELETE /fees/{id}` are level 0 only, and a store owner (level 2) can only create (`POST /fees`). So the screen
// offers them what the API lets them do, and says who can do the rest.
describe('CustomerFees for a store owner (level 2)', () => {
  const NOTE = 'Only an administrator can turn off, change or delete a customer fee. Ask one if you need it.'

  beforeEach(() => { probe.level = 2 })

  it('has no switch and no selection in the table: it says the status and who can change it', () => {
    probe.fees = [SERVICE, CARD]
    renderFees()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it('has no switch and no selection in the cards under 768px either', () => {
    probe.phone = true
    probe.fees = [SERVICE, CARD]
    renderFees()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it('can still add a fee, and is told first who can undo it', async () => {
    const user = userEvent.setup()
    renderFees()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add customer fee' }))
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Bag')
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    await waitFor(() => expect(probe.spies.create).toHaveBeenCalledTimes(1))
  })

  it('opens a stored fee to read: disabled fields, no switch to enable it, nothing to save', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    await user.click(nameButton('Service'))
    expect(detailOf('Service')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeDisabled()
    expect(screen.queryByRole('switch', { name: 'Enabled' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    expect(probe.spies.update).not.toHaveBeenCalled()
  })
})

describe('CustomerFees for an admin (level 0)', () => {
  it('keeps the switch, the selection and the editable detail, with no note', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    expect(screen.getByRole('switch', { name: 'Enabled: Service' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Service' })).toBeInTheDocument()
    expect(screen.queryByText(/Only an administrator/)).toBeNull()
    await user.click(nameButton('Service'))
    expect(screen.getByRole('textbox', { name: /^Name/ })).not.toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Enabled' })).toBeInTheDocument()
  })
})
