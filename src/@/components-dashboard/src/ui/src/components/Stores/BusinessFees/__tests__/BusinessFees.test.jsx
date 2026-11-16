/* eslint-disable import/first */
// redesign stores 5.13 (; E2): the business fees of a store on Product. Two tabs (Fees | Fee events), a DataTable per tab
// (cards under 768px), a switch that saves at once, a selection bar with a confirmed bulk delete, the fee's detail in a
// P/SectionSplit and the manual charge or credit as a two-step dialog.
// Covered: the table (columns, the type of a recurrent fee, the amount); the keyboard (Enter on a row, Enter and Space on the name
// button, Space on a row selects: the DataTable model); the search that waits; the switch (`updateFee(id, { enabled }, { inlineError })`,
// back on a failure); the bulk delete (count in the question, a partial failure keeps the failed ids selected and says why); the
// tabs and «Refresh»; the fee events (order fees: «Order #N», no checkbox, no alert); the manual dialog (Continue does not send, the
// confirmation names the amount, the sign of a credit, a failure keeps the dialog open with what was written); the leave question
// when another fee is opened with changes. The controller is a stand-in that keeps the lists like the real one and answers the five
// writes as the contract says (`{ error, result, deletedIds, failedIds }`).
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({
  fees: [],
  events: [],
  sites: [],
  paymethods: [],
  phone: false,
  page: 1,
  extra: 0, // rows of the other pages: they keep the total (and the page) valid
  spies: {},
  answers: {}
}))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{ parsePrice: (value) => `Q ${Number(value).toFixed(2)}` }],
    useConfig: () => [{ configs: { format_number_currency: { value: 'Q' } } }],
    useSession: () => [{ user: { level: 0 } }],
    BusinessFees: ({ UIComponent, ...props }) => {
      const [fees, setFees] = ReactModule.useState(probe.fees)
      const [events, setEvents] = ReactModule.useState(probe.events)
      const [searchValue, setSearchValue] = ReactModule.useState(null)
      const [eventsSearchValue, setEventsSearchValue] = ReactModule.useState(null)
      const [pagination, setPagination] = ReactModule.useState({ currentPage: probe.page, pageSize: 10, totalPages: 1, totalItems: probe.fees.length })
      const [eventsPagination, setEventsPagination] = ReactModule.useState({ currentPage: probe.page, pageSize: 10, totalPages: 1, totalItems: probe.events.length })
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
        setFees(prev => [...prev, created])
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
      const createFeeEvent = async (payload, options) => {
        probe.spies.createEvent?.(payload, options)
        if (probe.answers.createEvent) return probe.answers.createEvent
        const created = { id: 98, created_at: '2026-10-03 09:00:00', ...payload }
        setEvents(prev => [created, ...prev])
        return { error: false, result: created }
      }
      const deleteFeeEvents = async (ids, options) => {
        probe.spies.removeEvents?.(ids, options)
        if (probe.answers.removeEvents) {
          setEvents(prev => prev.filter(event => !probe.answers.removeEvents.deletedIds.includes(event.id)))
          return probe.answers.removeEvents
        }
        setEvents(prev => prev.filter(event => !ids.includes(event.id)))
        return { error: false, result: true, deletedIds: ids, failedIds: [] }
      }
      return ReactModule.createElement(UIComponent, {
        ...props,
        businessId: 397,
        feesList: { loading: false, fees },
        getFees: (...args) => probe.spies.getFees?.(...args),
        createFee,
        updateFee,
        deleteFees,
        searchValue,
        handleChangeSearch: (value) => { probe.spies.search?.(value); setSearchValue(value) },
        paginationProps: { ...pagination, totalItems: fees.length + probe.extra },
        setPaginationProps: setPagination,
        feeEventsList: { loading: false, events },
        getFeeEvents: (...args) => probe.spies.getFeeEvents?.(...args),
        createFeeEvent,
        deleteFeeEvents,
        eventsSearchValue,
        handleChangeEventsSearch: (value) => { probe.spies.eventsSearch?.(value); setEventsSearchValue(value) },
        eventsPaginationProps: { ...eventsPagination, totalItems: events.length + probe.extra },
        setEventsPaginationProps: setEventsPagination,
        sitesState: { sites: probe.sites },
        paymethodsState: { paymethods: probe.paymethods },
        actionState: { loading: false, error: null }
      })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { BusinessFees } from '../index'
import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product/LeaveGuard'

const SERVICE = { id: 11, name: 'Service fee', description: 'Platform fee', fixed: 30, percentage: 2, enabled: true, delivery_type: null, site_id: null, paymethod_id: null, recurring_period: null, recurring_day: null, taxable: true }
const WEEKLY = { id: 12, name: 'Monday rent', description: '', fixed: 15, percentage: 0, enabled: false, delivery_type: null, site_id: null, paymethod_id: null, recurring_period: 'weekly', recurring_day: 1, taxable: true }
const MONTHLY = { id: 13, name: 'Monthly plan', description: '', fixed: 40, percentage: 0, enabled: true, delivery_type: null, site_id: null, paymethod_id: null, recurring_period: 'monthly', recurring_day: 1, taxable: true }

const ORDER_EVENT = { id: 1, name: 'Order fee', event_type: 'order_fee', total_amount: 3.5, order_id: 55, created_at: '2026-10-01 10:00:00' }
const CHARGE = { id: 2, name: 'Setup fee', event_type: 'manual_charge', total_amount: 10, order_id: null, created_at: '2026-10-02 10:00:00' }
const CREDIT = { id: 3, name: 'Goodwill', event_type: 'manual_credit', total_amount: -4, order_id: null, created_at: '2026-10-02 11:00:00' }

const renderFees = (props = {}) => renderWithProviders(
  <BusinessFees businessId={397} {...props} />,
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
const feesBar = () => screen.getByRole('region', { name: 'Actions for selected fees' })
const eventsBar = () => screen.getByRole('region', { name: 'Actions for selected charges and credits' })
const goToEvents = async (user) => { await user.click(screen.getByRole('tab', { name: 'Fee events' })) }

beforeEach(() => {
  probe.fees = []
  probe.events = []
  probe.sites = []
  probe.paymethods = []
  probe.phone = false
  probe.page = 1
  probe.extra = 0
  probe.spies = {
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    createEvent: vi.fn(),
    removeEvents: vi.fn(),
    search: vi.fn(),
    eventsSearch: vi.fn(),
    getFees: vi.fn(),
    getFeeEvents: vi.fn()
  }
  probe.answers = {}
  window.history.replaceState(null, '', '/')
})

describe('BusinessFees table', () => {
  it('draws the fees in a Product table: the type of a recurrent fee and the amount of each', () => {
    probe.fees = [SERVICE, WEEKLY, MONTHLY]
    const { container } = renderFees()
    const table = screen.getByRole('table', { name: 'Fees' })
    expect(table.classList.contains('odc-table')).toBe(true)
    expect(container.querySelector('.odc-bf')).not.toBeNull()
    for (const name of ['ID', 'Name', 'Type', 'Amount', 'Status']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('Platform fee')).toBeInTheDocument()
    expect(screen.getByText('Per order')).toBeInTheDocument()
    expect(screen.getByText('Weekly · Monday')).toBeInTheDocument()
    expect(screen.getByText('Monthly · Day 1')).toBeInTheDocument()
    // per order: «fixed + percentage»; recurrent: the fixed amount alone
    expect(screen.getByText('Q 30.00 + 2%')).toBeInTheDocument()
    expect(screen.getByText('Q 15.00')).toBeInTheDocument()
    expect(screen.getByText('Q 40.00')).toBeInTheDocument()
    // no inline style on the cells, no legacy markup
    expect(container.querySelector('.odc-bf-amount [style], .odc-bf-sub[style], .odc-bf-namecell [style]')).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Service fee' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Service fee' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Enabled: Monday rent' }).getAttribute('aria-checked')).toBe('false')
  })

  it('draws the same data as cards under 768px, with the switch and the selection', () => {
    probe.phone = true
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Fees' })).toBeInTheDocument()
    expect(screen.getByText('Q 30.00 + 2%')).toBeInTheDocument()
    expect(screen.getByText('Weekly · Monday')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Service fee' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Monday rent' })).toBeInTheDocument()
  })

  it('has no h1 of its own and no legacy markup (a heading, the tabs and the table)', () => {
    probe.fees = [SERVICE]
    const { container } = renderFees()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Business fees' })).toBeInTheDocument()
    expect(container.querySelector('table:not(.odc-table)')).toBeNull()
  })

  it('says there are no fees, with the add button, when the store has none', async () => {
    const user = userEvent.setup()
    renderFees()
    expect(screen.getByText('No fees found')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('searchbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    expect(detailOf('New fee')).toBeInTheDocument()
  })
})

describe('BusinessFees keyboard (the intention of the old row test)', () => {
  it('opens the fee with Enter on its row', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    act(() => screen.getByRole('row', { name: /Monday rent/ }).focus())
    await user.keyboard('{Enter}')
    expect(detailOf('Monday rent')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Monday rent')
  })

  it.each([['Enter', '{Enter}'], ['Space', ' ']])('opens the fee with %s on its name button', async (_label, key) => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    act(() => nameButton('Service fee').focus())
    await user.keyboard(key)
    expect(detailOf('Service fee')).toBeInTheDocument()
  })

  it('selects with Space on the row (the table model) and opens nothing', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    act(() => screen.getByRole('row', { name: /Service fee/ }).focus())
    await user.keyboard(' ')
    expect(screen.getByRole('checkbox', { name: 'Select Service fee' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('ignores other keys on the row', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    act(() => screen.getByRole('row', { name: /Service fee/ }).focus())
    await user.keyboard('a')
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it.each([['Enter', '{Enter}'], ['Space', ' ']])('does not open the fee with %s on its checkbox', async (_label, key) => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    act(() => screen.getByRole('checkbox', { name: 'Select Service fee' }).focus())
    await user.keyboard(key)
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })
})

describe('BusinessFees search', () => {
  it('waits a moment before asking the list, with a labelled field', async () => {
    probe.fees = [SERVICE]
    renderFees()
    const field = screen.getByRole('searchbox', { name: 'Search fees' })
    fireEvent.change(field, { target: { value: 'ser' } })
    expect(probe.spies.search).not.toHaveBeenCalled()
    await waitFor(() => expect(probe.spies.search).toHaveBeenCalledWith('ser'))
    expect(probe.spies.search).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessFees tabs and refresh', () => {
  it('shows the fee events under their own tab and clears the search of the other tab when it changes', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    probe.events = [CHARGE]
    renderFees()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search fees' }), { target: { value: 'ser' } })
    await waitFor(() => expect(probe.spies.search).toHaveBeenCalledWith('ser'))
    await goToEvents(user)
    expect(screen.getByRole('table', { name: 'Fee events' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Fees' })).toBeNull()
    expect(probe.spies.search).toHaveBeenLastCalledWith('')
    expect(screen.getByRole('searchbox', { name: 'Search fee events' })).toHaveValue('')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search fee events' }), { target: { value: 'set' } })
    await waitFor(() => expect(probe.spies.eventsSearch).toHaveBeenCalledWith('set'))
    await user.click(screen.getByRole('tab', { name: 'Fees' }))
    expect(probe.spies.eventsSearch).toHaveBeenLastCalledWith('')
    expect(screen.getByRole('searchbox', { name: 'Search fees' })).toHaveValue('')
  })

  it('refreshes the tab that is open, on its page', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    probe.events = [CHARGE]
    renderFees()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(probe.spies.getFees).toHaveBeenCalledWith(1, 10)
    expect(probe.spies.getFeeEvents).not.toHaveBeenCalled()
    await goToEvents(user)
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(probe.spies.getFeeEvents).toHaveBeenCalledWith(1, 10)
  })
})

describe('BusinessFees switch', () => {
  it('saves at once with inlineError and does not open the row', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Service fee' }))
    expect(probe.spies.update).toHaveBeenCalledWith(11, { enabled: false }, { inlineError: true })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled: Service fee' }).getAttribute('aria-checked')).toBe('false'))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('goes back to the stored value and says why when the save fails', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    probe.answers.update = { error: true, result: ['Not allowed'] }
    renderFees()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Service fee' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.getByRole('switch', { name: 'Enabled: Service fee' }).getAttribute('aria-checked')).toBe('true')
  })

  it('says the fallback text when the API gave no message', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    probe.answers.update = { error: true, result: [] }
    renderFees()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Service fee' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change this fee.")
  })
})

describe('BusinessFees bulk delete', () => {
  it('asks with the count, deletes with inlineError and clears the selection', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select Service fee' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Monday rent' }))
    expect(within(feesBar()).getByText('2 selected')).toBeInTheDocument()
    await user.click(within(feesBar()).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete 2 fees?')).toBeInTheDocument()
    expect(within(dialog).getByText("The store stops paying them. This can't be undone.")).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete fees' }))
    await waitFor(() => expect(probe.spies.remove).toHaveBeenCalledWith([11, 12], { inlineError: true }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Actions for selected fees' })).toBeNull())
  })

  it('says «1 fee» for one', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select Service fee' }))
    await user.click(within(feesBar()).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete 1 fee?')).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete fee' })).toBeInTheDocument() // redesign tanda AB (S-5)
  })

  it('keeps the failed ids selected and says why when only some are deleted', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    probe.answers.remove = { error: true, result: ['#12: Forbidden'], deletedIds: [11], failedIds: [12] }
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select Service fee' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Monday rent' }))
    await user.click(within(feesBar()).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete fees' }))
    expect(await screen.findByText('1 fee could not be deleted: Forbidden')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Monday rent' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('checkbox', { name: 'Select Service fee' })).toBeNull()
    expect(within(feesBar()).getByText('1 selected')).toBeInTheDocument()
  })

  it('says «_count_ fees» when several stay', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY, MONTHLY]
    probe.answers.remove = { error: true, result: ['Forbidden'], deletedIds: [13], failedIds: [11, 12] }
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    await user.click(within(feesBar()).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete fees' }))
    expect(await screen.findByText('2 fees could not be deleted: Forbidden')).toBeInTheDocument()
  })
})

describe('BusinessFees bulk delete asks the page again (the foot has to match the rows)', () => {
  const selectAndDelete = async (user, bar, label = 'Delete fees') => {
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    await user.click(within(bar()).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: label }))
  }

  it('fees: asks the current page after a full success', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    await selectAndDelete(user, feesBar)
    await waitFor(() => expect(probe.spies.getFees).toHaveBeenCalledWith(1, 10))
  })

  it('fees: asks again after a partial failure', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    probe.answers.remove = { error: true, result: ['#12: Forbidden'], deletedIds: [11], failedIds: [12] }
    renderFees()
    await selectAndDelete(user, feesBar)
    await waitFor(() => expect(probe.spies.getFees).toHaveBeenCalledTimes(1))
    expect(probe.spies.getFees).toHaveBeenCalledWith(1, 10)
  })

  it('fees: does not ask when nothing was deleted', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    probe.answers.remove = { error: true, result: ['#11: Forbidden'], deletedIds: [], failedIds: [11, 12] }
    renderFees()
    await selectAndDelete(user, feesBar)
    expect(await screen.findByText('2 fees could not be deleted: Forbidden')).toBeInTheDocument()
    expect(probe.spies.getFees).not.toHaveBeenCalled()
  })

  it('fees: an emptied page that is not the first asks the previous one', async () => {
    const user = userEvent.setup()
    probe.page = 3
    probe.extra = 20
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    await selectAndDelete(user, feesBar)
    await waitFor(() => expect(probe.spies.getFees).toHaveBeenCalledWith(2, 10))
    // never a page past the end (the foot's own clamp may ask the same last page too)
    expect(probe.spies.getFees.mock.calls.every(call => call[0] === 2)).toBe(true)
  })

  it('fees: an emptied page keeps its number while the pages after it move up into it', async () => {
    const user = userEvent.setup()
    probe.page = 2
    probe.extra = 30
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    await selectAndDelete(user, feesBar)
    await waitFor(() => expect(probe.spies.getFees).toHaveBeenCalledWith(2, 10))
    expect(probe.spies.getFees).not.toHaveBeenCalledWith(1, 10)
  })

  it('fees: a page that keeps rows asks for itself', async () => {
    const user = userEvent.setup()
    probe.page = 2
    probe.extra = 10
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    await user.click(screen.getByRole('checkbox', { name: 'Select Service fee' }))
    await user.click(within(feesBar()).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete fee' }))
    await waitFor(() => expect(probe.spies.getFees).toHaveBeenCalledWith(2, 10))
  })

  it('events: asks the current page after a full success', async () => {
    const user = userEvent.setup()
    probe.events = [CHARGE, CREDIT]
    renderFees()
    await goToEvents(user)
    await selectAndDelete(user, eventsBar, 'Delete charges or credits')
    await waitFor(() => expect(probe.spies.getFeeEvents).toHaveBeenCalledWith(1, 10))
  })

  it('events: an emptied page that is not the first asks the previous one', async () => {
    const user = userEvent.setup()
    probe.page = 3
    probe.extra = 20
    probe.events = [CHARGE, CREDIT]
    renderFees()
    await goToEvents(user)
    await selectAndDelete(user, eventsBar, 'Delete charges or credits')
    await waitFor(() => expect(probe.spies.getFeeEvents).toHaveBeenCalledWith(2, 10))
    expect(probe.spies.getFeeEvents.mock.calls.every(call => call[0] === 2)).toBe(true)
  })
})

describe('BusinessFees detail', () => {
  it('opens the fee beside the list, filled with its values, and closes the save bar until a change', async () => {
    const user = userEvent.setup()
    probe.fees = [WEEKLY]
    renderFees()
    await user.click(nameButton('Monday rent'))
    expect(detailOf('Monday rent')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Monday rent')
    expect(screen.getByRole('switch', { name: 'Enabled' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('creates a fee and opens the created one', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    await user.click(screen.getByRole('button', { name: 'Add fee' }))
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Late fee')
    await user.type(screen.getByRole('textbox', { name: 'Fixed amount' }), '5')
    await user.click(within(screen.getByRole('group', { name: 'Save changes' })).getByRole('button', { name: 'Add fee' }))
    await waitFor(() => expect(probe.spies.create).toHaveBeenCalledTimes(1))
    expect(probe.spies.create.mock.calls[0][0]).toMatchObject({ name: 'Late fee', fixed: 5, percentage: 0, recurring_period: null, recurring_day: null })
    expect(probe.spies.create.mock.calls[0][1]).toEqual({ inlineError: true })
    expect(await screen.findByRole('heading', { level: 3, name: 'Late fee' })).toBeInTheDocument()
  })

  it('follows the table: the switch of the row moves «Enabled» in the open form', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE]
    renderFees()
    await user.click(nameButton('Service fee'))
    expect(screen.getByRole('switch', { name: 'Enabled' }).getAttribute('aria-checked')).toBe('true')
    await user.click(screen.getByRole('switch', { name: 'Enabled: Service fee' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled' }).getAttribute('aria-checked')).toBe('false'))
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('closes the detail of a fee that was deleted', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    renderFees()
    await user.click(nameButton('Service fee'))
    await user.click(screen.getByRole('checkbox', { name: 'Select Service fee' }))
    await user.click(within(feesBar()).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete fee' }))
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3 })).toBeNull())
  })

  it('asks before leaving a fee with changes for another one', async () => {
    const user = userEvent.setup()
    probe.fees = [SERVICE, WEEKLY]
    const hostProbe = { current: null }
    const Host = ({ children }) => {
      const host = useLeaveGuardHost()
      hostProbe.current = host
      return <LeaveGuardContext.Provider value={host.context}>{children}</LeaveGuardContext.Provider>
    }
    renderWithProviders(<Host><BusinessFees businessId={397} /></Host>)
    await user.click(nameButton('Service fee'))
    await user.type(screen.getByRole('textbox', { name: /Name/ }), ' extra')
    await user.click(nameButton('Monday rent'))
    expect(hostProbe.current.dialog.open).toBe(true)
    expect(detailOf('Service fee')).toBeInTheDocument()
  })
})

describe('BusinessFees fee events', () => {
  it('draws the events: «Order #N» under an order fee, no checkbox for it, the type and the amount with its sign', async () => {
    const user = userEvent.setup()
    probe.events = [ORDER_EVENT, CHARGE, CREDIT]
    renderFees()
    await goToEvents(user)
    for (const name of ['Name', 'Type', 'Amount', 'Date']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('Order #55')).toBeInTheDocument()
    expect(screen.getByText('Order fee', { selector: '.odc-bf-type' })).toBeInTheDocument()
    expect(screen.getByText('Manual charge')).toBeInTheDocument()
    expect(screen.getByText('Manual credit')).toBeInTheDocument()
    expect(screen.getByText('Q 3.50')).toBeInTheDocument()
    expect(screen.getByText('Q 10.00')).toBeInTheDocument()
    expect(screen.getByText('Q -4.00')).toBeInTheDocument()
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(3)
    // order fees have no checkbox (the old one only opened an alert); the manual ones do
    expect(screen.queryByRole('checkbox', { name: 'Select Order fee' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select Setup fee' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Goodwill' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3) // select all + two manual rows
  })

  it('names a recurring event «Recurring fee» and humanizes an unknown type; both stay selectable as in main', async () => {
    const user = userEvent.setup()
    probe.events = [
      { id: 7, name: 'Monthly plan', event_type: 'recurring', total_amount: 40, order_id: null, created_at: '2026-10-01 10:00:00' },
      { id: 8, name: 'Late fee', event_type: 'late_payment', total_amount: 5, order_id: null, created_at: '2026-10-01 11:00:00' }
    ]
    renderFees()
    await goToEvents(user)
    expect(screen.getByText('Recurring fee', { selector: '.odc-bf-type' })).toBeInTheDocument()
    expect(screen.getByText('Late payment', { selector: '.odc-bf-type' })).toBeInTheDocument()
    expect(screen.queryByText('recurring')).toBeNull()
    expect(screen.queryByText('late_payment')).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select Monthly plan' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Late fee' })).toBeInTheDocument()
  })

  it('selects all means the manual events only, and the rows open nothing', async () => {
    const user = userEvent.setup()
    probe.events = [ORDER_EVENT, CHARGE, CREDIT]
    renderFees()
    await goToEvents(user)
    await user.click(screen.getByRole('row', { name: /Setup fee/ }))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(within(eventsBar()).getByText('2 selected')).toBeInTheDocument()
  })

  it('asks with the count, deletes with inlineError and says which could not be deleted', async () => {
    const user = userEvent.setup()
    probe.events = [ORDER_EVENT, CHARGE, CREDIT]
    probe.answers.removeEvents = { error: true, result: ['#3: Closed period'], deletedIds: [2], failedIds: [3] }
    renderFees()
    await goToEvents(user)
    await user.click(screen.getByRole('checkbox', { name: 'Select Setup fee' }))
    await user.click(within(eventsBar()).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete 1 charge or credit?')).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete charge or credit' })).toBeInTheDocument() // redesign tanda AB (S-5)
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Goodwill' }))
    await user.click(within(eventsBar()).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete 2 charges or credits?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete charges or credits' }))
    await waitFor(() => expect(probe.spies.removeEvents).toHaveBeenCalledWith([2, 3], { inlineError: true }))
    expect(await screen.findByText('1 charge or credit could not be deleted: Closed period')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Goodwill' }).getAttribute('aria-checked')).toBe('true')
  })

  it('draws cards under 768px: «Order #N» and no checkbox for an order fee, and nothing that looks like a link', async () => {
    const user = userEvent.setup()
    probe.phone = true
    probe.events = [ORDER_EVENT, CHARGE]
    renderFees()
    await goToEvents(user)
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Fee events' })
    expect(within(list).getByText('Order #55')).toBeInTheDocument()
    expect(within(list).queryByRole('link')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Select Order fee' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select Setup fee' })).toBeInTheDocument()
  })
})

describe('BusinessFees manual charge or credit', () => {
  const openDialog = async (user, props) => {
    probe.events = [CHARGE]
    renderFees(props)
    await goToEvents(user)
    await user.click(screen.getByRole('button', { name: 'Add charge or credit' }))
    return screen.findByRole('dialog')
  }
  const fill = async (user, dialog, { name = 'Setup fee', amount = '10' } = {}) => {
    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), name)
    await user.type(within(dialog).getByRole('textbox', { name: /Amount/ }), amount)
  }

  it('starts on a charge, names the currency of the project and shows the hint of the type', async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole('radiogroup', { name: 'Type' })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Charge' }).getAttribute('aria-checked')).toBe('true')
    expect(within(dialog).getByText('Add a charge to business')).toBeInTheDocument()
    expect(within(dialog).getByText('This amount will be charged to the business')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /^Amount \(Q\)/ })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Credit' }))
    expect(within(dialog).getByText('This amount will be credited to the business balance')).toBeInTheDocument()
  })

  it('Continue sends nothing: it says what is missing, and goes on once the name and the amount are there', async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    expect(probe.spies.createEvent).not.toHaveBeenCalled()
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument()
    expect(within(dialog).getByText('Invalid amount')).toBeInTheDocument()
    await fill(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    expect(probe.spies.createEvent).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Charge Q 10.00 to this store?' })).toBeInTheDocument()
  })

  it('the confirmation names the amount and the store, and says it cannot be edited', async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user, { businessName: 'Fast Bite' })
    await fill(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    const confirm = screen.getByRole('dialog', { name: 'Charge Q 10.00 to Fast Bite?' })
    expect(within(confirm).getByText("It's added to the store's balance now. It can't be edited; to undo it, add a credit for the same amount.")).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Add charge' })).toBeInTheDocument()
  })

  it('moves the focus to «Back» on the confirmation: Enter twice on «Continue» does not add the charge', async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user)
    await fill(user, dialog)
    within(dialog).getByRole('button', { name: 'Continue' }).focus()
    await user.keyboard('{Enter}')
    const confirm = screen.getByRole('dialog', { name: 'Charge Q 10.00 to this store?' })
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Back' })).toHaveFocus())
    await user.keyboard('{Enter}')
    // the second Enter pressed «Back», not «Add charge»
    expect(probe.spies.createEvent).not.toHaveBeenCalled()
    const first = await screen.findByRole('dialog', { name: 'Add charge or credit' })
    expect(within(first).getByRole('textbox', { name: /Name/ })).toHaveValue('Setup fee')
    // and coming back to step 1 the focus lands on «Continue», so Enter goes on and never sends
    await waitFor(() => expect(within(first).getByRole('button', { name: 'Continue' })).toHaveFocus())
  })

  it('Add charge sends the amount as it is, with inlineError, and closes', async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user)
    await fill(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Add charge' }))
    await waitFor(() => expect(probe.spies.createEvent).toHaveBeenCalledTimes(1))
    expect(probe.spies.createEvent).toHaveBeenCalledWith({ event_type: 'manual_charge', name: 'Setup fee', total_amount: 10 }, { inlineError: true })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // the controller put the new charge at the top of the list: the one that was there and this one
    expect(screen.getAllByText('Q 10.00')).toHaveLength(2)
  })

  it('Add credit sends a negative amount', async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Credit' }))
    await fill(user, dialog, { name: 'Goodwill again', amount: '7' })
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    const confirm = screen.getByRole('dialog', { name: 'Credit Q 7.00 to this store?' })
    expect(within(confirm).getByText("It's added to the store's balance now. It can't be edited; to undo it, add a charge for the same amount.")).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Add credit' }))
    await waitFor(() => expect(probe.spies.createEvent).toHaveBeenCalledTimes(1))
    expect(probe.spies.createEvent).toHaveBeenCalledWith({ event_type: 'manual_credit', name: 'Goodwill again', total_amount: -7 }, { inlineError: true })
  })

  it('a failure is said in the dialog, which stays open with what was written', async () => {
    const user = userEvent.setup()
    probe.answers.createEvent = { error: true, result: ['Closed period'] }
    const dialog = await openDialog(user)
    await fill(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Add charge' }))
    expect(await screen.findByText('Closed period')).toBeInTheDocument()
    const stillOpen = screen.getByRole('dialog')
    expect(within(stillOpen).getByRole('button', { name: 'Add charge' })).toBeInTheDocument()
    await user.click(within(stillOpen).getByRole('button', { name: 'Back' }))
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: /Name/ })).toHaveValue('Setup fee')
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: /Amount/ })).toHaveValue('10')
  })

  it('opens empty again after it was closed', async () => {
    const user = userEvent.setup()
    const dialog = await openDialog(user)
    await fill(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Add charge or credit' }))
    expect(within(await screen.findByRole('dialog')).getByRole('textbox', { name: /Name/ })).toHaveValue('')
  })
})
