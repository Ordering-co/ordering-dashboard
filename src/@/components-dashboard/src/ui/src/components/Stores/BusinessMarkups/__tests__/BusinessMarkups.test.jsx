/* eslint-disable import/first */
// redesign stores 5.13 (; E3b): the markups of a store on Product. A DataTable (RecordCards under 768px) with the Applies to
// and Rule columns (S-7), a switch that saves at once, a selection bar with a confirmed bulk delete, global markups that are neither
// opened nor selected and say where to edit them (S-6), and the markup's detail in a P/SectionSplit with a save bar.
// Covered: the columns and cells; the global row (no button, no checkbox, a note with a link, Enter does nothing, switch disabled);
// Enter and Space on an own row (the intent of the old keyboard test); the switch (inlineError, back on a failure, in cards too);
// the bulk delete (count, partial failure keeps the failed ids selected and says why, the open record closes); the detail (fields
// count in the save bar, a % that is not whole and a negative fixed amount block the save, a failed save keeps the detail with the
// reason, the «Enabled» switch of the detail saves at once and never dirties the bar, it follows the table, the payload of a PUT is
// the one of `main`, a new markup passes to the created record). The controller is a stand-in that keeps the list like the real one;
// Site and Delivery type are the real P/SelectField.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({
  markups: [],
  sites: [],
  phone: false,
  controllerProps: null,
  page: 1,
  extra: 0, // rows of the other pages: they keep the total (and the page) valid
  asked: new Set(), // the keys the component asked `t` for
  spies: { getMarkups: null, update: null, create: null, remove: null, search: null, emit: null, extend: null },
  answers: {}
}))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (key, fallback) => { probe.asked.add(key); return fallback }],
    useUtils: () => [{ parsePrice: (value) => `Q ${Number(value).toFixed(2)}` }],
    useEvent: () => [{ emit: (...args) => probe.spies.emit?.(...args) }],
    // The controller's part: it keeps the list, and the three writes answer like the real one (`{ error, result }`).
    Markups: ({ UIComponent, ...props }) => {
      probe.controllerProps = props
      const [markups, setMarkups] = ReactModule.useState(probe.markups)
      const [searchValue, setSearchValue] = ReactModule.useState(null)
      const [pagination, setPagination] = ReactModule.useState({ currentPage: probe.page, pageSize: 10, totalPages: 1, totalItems: probe.markups.length })
      const updateMarkup = async (id, changes, options) => {
        probe.spies.update?.(id, changes, options)
        if (probe.answers.update) return probe.answers.update
        const merged = { ...markups.find(markup => markup.id === id), ...changes }
        setMarkups(prev => prev.map(markup => (markup.id === id ? merged : markup)))
        return { error: false, result: merged }
      }
      const createMarkup = async (payload, options) => {
        probe.spies.create?.(payload, options)
        if (probe.answers.create) return probe.answers.create
        const created = { id: 99, ...payload }
        setMarkups(prev => [created, ...prev])
        return { error: false, result: created }
      }
      const deleteMarkups = async (ids, options) => {
        probe.spies.remove?.(ids, options)
        if (probe.answers.remove) {
          setMarkups(prev => prev.filter(markup => !probe.answers.remove.deletedIds.includes(markup.id)))
          return probe.answers.remove
        }
        setMarkups(prev => prev.filter(markup => !ids.includes(markup.id)))
        return { error: false, result: true, deletedIds: ids, failedIds: [] }
      }
      return ReactModule.createElement(UIComponent, {
        ...props,
        markupsList: { loading: false, error: null, markups: probe.answers.search && searchValue ? probe.answers.search : markups },
        getMarkups: (...args) => probe.spies.getMarkups?.(...args),
        createMarkup,
        updateMarkup,
        deleteMarkups,
        actionState: { loading: false, error: null },
        searchValue,
        handleChangeSearch: (value) => { probe.spies.search?.(value); setSearchValue(value) },
        paginationProps: { ...pagination, totalItems: markups.length + probe.extra },
        setPaginationProps: setPagination,
        sitesState: { loading: false, error: null, sites: probe.sites }
      })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { BusinessMarkups } from '../index'

const SUB_NONE = { markup_type: 'fixed', markup_value: 0 }
const OWN = { id: 21, name: 'Own markup', business_id: 7, site_id: 4, delivery_type: 'delivery', enabled: true, rounding_values: [], rules: { products: { markup_type: 'percentage', markup_value: 10 }, suboptions: { markup_type: 'percentage', markup_value: 10 } } }
const GLOBAL = { id: 22, name: 'Global markup', business_id: null, site_id: null, delivery_type: null, enabled: true, rounding_values: [], rules: { products: { markup_type: 'percentage', markup_value: 2 }, suboptions: { markup_type: 'percentage', markup_value: 2 } } }
const FIXED = { id: 23, name: 'Fixed markup', business_id: 7, site_id: null, delivery_type: null, enabled: false, rounding_values: [0.99], rules: { products: { markup_type: 'fixed', markup_value: 1 }, suboptions: { markup_type: 'percentage', markup_value: 5 } } }
const PLAIN = { id: 24, name: 'Plain markup', business_id: 7, site_id: 999, delivery_type: 'pickup', enabled: true, rounding_values: [], rules: { products: { markup_type: 'percentage', markup_value: 3 }, suboptions: SUB_NONE } }

const renderMarkups = (props = {}) => renderWithProviders(
  <BusinessMarkups businessId={7} setIsExtendExtraOpen={probe.spies.extend} {...props} />,
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
const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) })
// a P/SelectField: a combobox named by its label that opens a listbox of options in the overlay host
const choose = async (user, label, option) => {
  await user.click(screen.getByRole('combobox', { name: (name) => name.startsWith(label) }))
  const list = await screen.findByRole('listbox', { name: label, hidden: true })
  await user.click(within(list).getByRole('option', { name: option, hidden: true }))
}
const lineWith = (text) => screen.getByText((_content, node) => node.classList?.contains('odc-bm-sub') && node.textContent === text)

afterEach(() => document.getElementById('app-modals')?.remove())

beforeEach(() => {
  probe.markups = []
  probe.sites = []
  probe.phone = false
  probe.controllerProps = null
  probe.page = 1
  probe.extra = 0
  probe.asked = new Set()
  probe.spies = { getMarkups: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), search: vi.fn(), emit: vi.fn(), extend: vi.fn() }
  probe.answers = {}
  window.history.replaceState(null, '', '/')
})

describe('BusinessMarkups table', () => {
  it('keeps the controller props of before and is a Product root', () => {
    probe.markups = [OWN]
    const { container } = renderMarkups()
    expect(container.querySelector('.odc-root.odc-bm')).not.toBeNull()
    expect(probe.controllerProps).toMatchObject({ businessId: 7, includeGlobalMarkups: true, isFetchBusinesses: false, isFetchSites: true, asDashboard: true })
  })

  it('draws the markups in a Product table with Applies to and Rule', () => {
    probe.markups = [OWN, FIXED, PLAIN]
    probe.sites = [{ id: 4, name: 'Main site' }]
    renderMarkups()
    const table = screen.getByRole('table', { name: 'Markups' })
    expect(table.classList.contains('odc-table')).toBe(true)
    for (const name of ['ID', 'Name', 'Applies to', 'Rule', 'Status']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    // the old row label that covered the cells is gone (G4-32)
    expect(screen.queryByLabelText('Markup row')).toBeNull()
    expect(screen.getByText('Main site · Delivery')).toBeInTheDocument()
    expect(screen.getByText('All sites · All delivery types')).toBeInTheDocument()
    // a site the list does not know is said by its id, translated
    expect(screen.getByText('Site 999 · Pickup')).toBeInTheDocument()
    // the rule: products first, and the suboptions always on a second line (the same rule when they match the products', or none)
    expect(rowOf('Own markup').querySelector('.odc-bm-rule > .odc-figure')).toHaveTextContent('+10%')
    expect(rowOf('Own markup').querySelector('.odc-bm-sub')).toHaveTextContent('Suboptions: +10%')
    expect(screen.getByText('+Q 1.00')).toBeInTheDocument()
    expect(lineWith('Suboptions: +5%')).toBeInTheDocument()
    expect(lineWith('Suboptions: none')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Enabled: Fixed markup' })).toHaveAttribute('aria-checked', 'false')
  })

  it('draws the same data as cards under 768px, with the switch and the selection', () => {
    probe.phone = true
    probe.markups = [OWN, GLOBAL]
    renderMarkups()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Markups' })).toBeInTheDocument()
    expect(screen.getAllByText('+10%')).toHaveLength(2) // products and suboptions
    expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Own markup' })).toBeInTheDocument()
    // a global card has neither a checkbox nor a link
    expect(screen.queryByRole('checkbox', { name: 'Select Global markup' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Global markup/ })).toBeNull()
    expect(screen.getByRole('switch', { name: 'Enabled: Global markup' })).toBeDisabled()
  })

  it('searches after a pause, through handleChangeSearch, with a labelled field', async () => {
    probe.markups = [OWN]
    renderMarkups()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search markups' }), { target: { value: 'own' } })
    expect(probe.spies.search).not.toHaveBeenCalled()
    await waitFor(() => expect(probe.spies.search).toHaveBeenCalledWith('own'), { timeout: 2000 })
  })

  it('says nothing was found for a search with no results, and keeps the field', async () => {
    probe.markups = [OWN]
    probe.answers.search = []
    renderMarkups()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search markups' }), { target: { value: 'zzz' } })
    expect(await screen.findByText('No results found', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search markups' })).toHaveValue('zzz')
  })

  it('shows an empty text and «Add markup» when the store has none, and opens a new markup', async () => {
    const user = userEvent.setup()
    renderMarkups()
    expect(screen.getByText('No markups found')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('searchbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add markup' }))
    expect(detailOf('New markup')).toBeInTheDocument()
    expect(probe.spies.extend).toHaveBeenCalledWith(true)
  })
})

describe('BusinessMarkups texts', () => {
  it('names the switch of a row with its own key, not the one of the customer fees', () => {
    probe.markups = [OWN]
    renderMarkups()
    expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).toBeInTheDocument()
    expect(probe.asked.has('MARKUP_ENABLED_NAMED')).toBe(true)
    expect(probe.asked.has('CUSTOMER_FEE_ENABLED_NAMED')).toBe(false)
  })
})

describe('BusinessMarkups global markups (S-6)', () => {
  it('has no name button, no checkbox, a «Global» tag and a disabled switch with its reason', () => {
    probe.markups = [OWN, GLOBAL]
    renderMarkups()
    expect(screen.queryByRole('button', { name: /Global markup, View details/ })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Select Global markup' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select Own markup' })).toBeInTheDocument()
    expect(within(rowOf('Global markup')).getByText('Global')).toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: 'Enabled: Global markup' })
    expect(toggle).toBeDisabled()
    const reason = document.getElementById(toggle.getAttribute('aria-describedby'))
    expect(reason).toHaveTextContent('This is a global markup and cannot be edited from the business settings.')
  })

  it('does not open with Enter, a click or Space, and does not select', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, GLOBAL]
    renderMarkups()
    const row = rowOf('Global markup')
    act(() => row.focus())
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(within(row).getByText('Global markup'))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Actions for selected markups' })).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('says where to edit them, above the table, with a link to Stores › Markups', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, GLOBAL]
    renderMarkups()
    const note = screen.getByText(/Global markups apply to every store/).closest('.odc-notice')
    expect(note).toHaveAttribute('role', 'status')
    expect(note).toHaveTextContent('Global markups apply to every store. Edit them in Stores › Markups.')
    const link = within(note).getByRole('link', { name: 'Stores › Markups' })
    expect(link).toHaveAttribute('href', '/stores/markups')
    await user.click(link)
    expect(probe.spies.emit).toHaveBeenCalledWith('go_to_page', { page: 'markups' })
  })

  it('leaves a modified click on the link to the browser', () => {
    probe.markups = [OWN, GLOBAL]
    renderMarkups()
    // what the page left undone is the browser's (jsdom cannot navigate: the listener takes the default away after looking at it)
    let prevented = null
    document.addEventListener('click', (event) => { prevented = event.defaultPrevented; event.preventDefault() }, { once: true })
    fireEvent.click(screen.getByRole('link', { name: 'Stores › Markups' }), { ctrlKey: true })
    expect(prevented).toBe(false)
    expect(probe.spies.emit).not.toHaveBeenCalled()
  })

  it('has no note when the page has no global markup', () => {
    probe.markups = [OWN]
    renderMarkups()
    expect(screen.queryByText(/Global markups apply to every store/)).toBeNull()
  })

  it('«Select all» takes only the markups of the store', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, GLOBAL, FIXED]
    renderMarkups()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    const bar = screen.getByRole('region', { name: 'Actions for selected markups' })
    expect(within(bar).getByText('2 selected')).toBeInTheDocument()
    await user.click(within(bar).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete markups' }))
    await waitFor(() => expect(probe.spies.remove).toHaveBeenCalledWith([21, 23], { inlineError: true }))
  })
})

describe('BusinessMarkups keyboard', () => {
  it('opens an own markup with Enter on its row', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, GLOBAL]
    renderMarkups()
    act(() => rowOf('Own markup').focus())
    await user.keyboard('{Enter}')
    expect(detailOf('Own markup')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Own markup')
  })

  it('selects an own markup with Space on its row and does not open it', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, GLOBAL]
    renderMarkups()
    act(() => rowOf('Own markup').focus())
    await user.keyboard(' ')
    expect(screen.getByRole('checkbox', { name: 'Select Own markup' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    await user.keyboard(' ')
    expect(screen.getByRole('checkbox', { name: 'Select Own markup' })).toHaveAttribute('aria-checked', 'false')
  })

  it('opens an own markup from its name button', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN]
    renderMarkups()
    await user.click(nameButton('Own markup'))
    expect(detailOf('Own markup')).toBeInTheDocument()
  })
})

describe('BusinessMarkups switch', () => {
  it('saves at once with inlineError and does not open the row', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN]
    renderMarkups()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Own markup' }))
    expect(probe.spies.update).toHaveBeenCalledWith(21, { enabled: false }, { inlineError: true })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).toHaveAttribute('aria-checked', 'false'))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('goes back to the stored value and says why when the save fails', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN]
    probe.answers.update = { error: true, result: ['Not allowed'] }
    renderMarkups()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Own markup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).toHaveAttribute('aria-checked', 'true')
  })

  it('says the fallback text when the API gave no message', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN]
    probe.answers.update = { error: true, result: [] }
    renderMarkups()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Own markup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change this markup.")
  })
})

describe('BusinessMarkups bulk delete', () => {
  it('asks with the count, deletes with inlineError and clears the selection', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, FIXED]
    renderMarkups()
    await user.click(screen.getByRole('checkbox', { name: 'Select Own markup' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Fixed markup' }))
    const bar = screen.getByRole('region', { name: 'Actions for selected markups' })
    expect(within(bar).getByText('2 selected')).toBeInTheDocument()
    await user.click(within(bar).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete 2 markups?')).toBeInTheDocument()
    expect(within(dialog).getByText("Prices of this store stop including them. This can't be undone.")).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete markups' }))
    await waitFor(() => expect(probe.spies.remove).toHaveBeenCalledWith([21, 23], { inlineError: true }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Actions for selected markups' })).toBeNull())
  })

  it('says «1 markup» for one', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, FIXED]
    renderMarkups()
    await user.click(screen.getByRole('checkbox', { name: 'Select Own markup' }))
    await user.click(within(screen.getByRole('region', { name: 'Actions for selected markups' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete 1 markup?')).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete markup' })).toBeInTheDocument() // redesign tanda AB (S-5)
  })

  it('keeps the failed ids selected and says why when only some are deleted', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, FIXED]
    probe.answers.remove = { error: true, result: ['#23: Forbidden'], deletedIds: [21], failedIds: [23] }
    renderMarkups()
    await user.click(screen.getByRole('checkbox', { name: 'Select Own markup' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Fixed markup' }))
    await user.click(within(screen.getByRole('region', { name: 'Actions for selected markups' })).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete markups' }))
    expect(await screen.findByText('1 markup could not be deleted: Forbidden')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Fixed markup' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('checkbox', { name: 'Select Own markup' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Actions for selected markups' })).getByText('1 selected')).toBeInTheDocument()
  })

  it('closes the detail of a markup that was deleted', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, FIXED]
    renderMarkups()
    await user.click(nameButton('Own markup'))
    expect(detailOf('Own markup')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Select Own markup' }))
    await user.click(within(screen.getByRole('region', { name: 'Actions for selected markups' })).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete markup' }))
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Own markup' })).toBeNull())
    expect(probe.spies.extend).toHaveBeenLastCalledWith(false)
  })
})

describe('BusinessMarkups bulk delete asks the page again (the foot has to match the rows)', () => {
  const deleteAll = async (user) => {
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    await user.click(within(screen.getByRole('region', { name: 'Actions for selected markups' })).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete markups' }))
  }

  it('asks the current page after a full success', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, FIXED]
    renderMarkups()
    await deleteAll(user)
    await waitFor(() => expect(probe.spies.getMarkups).toHaveBeenCalledWith(1, 10))
  })

  it('asks again after a partial failure, and says the reason without the «#id: » of the controller', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, FIXED]
    probe.answers.remove = { error: true, result: ['#23: Forbidden'], deletedIds: [21], failedIds: [23] }
    renderMarkups()
    await deleteAll(user)
    expect(await screen.findByText('1 markup could not be deleted: Forbidden')).toBeInTheDocument()
    expect(screen.queryByText(/#23/)).toBeNull()
    expect(probe.spies.getMarkups).toHaveBeenCalledWith(1, 10)
  })

  it('does not ask when nothing was deleted', async () => {
    const user = userEvent.setup()
    probe.markups = [OWN, FIXED]
    probe.answers.remove = { error: true, result: ['#21: Forbidden'], deletedIds: [], failedIds: [21, 23] }
    renderMarkups()
    await deleteAll(user)
    expect(await screen.findByText('2 markups could not be deleted: Forbidden')).toBeInTheDocument()
    expect(probe.spies.getMarkups).not.toHaveBeenCalled()
  })

  it('an emptied last page asks the previous one, never a page past the end', async () => {
    const user = userEvent.setup()
    probe.page = 3
    probe.extra = 20
    probe.markups = [OWN, FIXED]
    renderMarkups()
    await deleteAll(user)
    await waitFor(() => expect(probe.spies.getMarkups).toHaveBeenCalledWith(2, 10))
    expect(probe.spies.getMarkups.mock.calls.every(call => call[0] === 2)).toBe(true)
  })

  it('an emptied page keeps its number while the pages after it move up into it', async () => {
    const user = userEvent.setup()
    probe.page = 2
    probe.extra = 30
    probe.markups = [OWN, FIXED]
    renderMarkups()
    await deleteAll(user)
    await waitFor(() => expect(probe.spies.getMarkups).toHaveBeenCalledWith(2, 10))
    expect(probe.spies.getMarkups).not.toHaveBeenCalledWith(1, 10)
  })
})

describe('BusinessMarkups detail', () => {
  const openOwn = async (user, markup = OWN) => {
    probe.markups = [markup, GLOBAL]
    probe.sites = [{ id: 4, name: 'Main site' }]
    renderMarkups()
    await user.click(nameButton(markup.name))
    return screen.getByRole('textbox', { name: /Name/ })
  }
  const productsValue = () => screen.getByRole('textbox', { name: 'Products markup value' })
  const saveBar = () => screen.getByRole('group', { name: 'Save changes' })

  it('opens the markup filled with its values, the site and delivery type locked, with no save bar yet', async () => {
    const user = userEvent.setup()
    await openOwn(user)
    expect(detailOf('Own markup')).toBeInTheDocument()
    expect(productsValue()).toHaveValue('10')
    expect(screen.getByRole('checkbox', { name: 'Apply to suboptions' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Apply same value' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: (name) => name.startsWith('Site') })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: (name) => name.startsWith('Delivery type') })).toBeDisabled()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull() // the host paints the title
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('counts and names what changed in the save bar, and Discard puts it back', async () => {
    const user = userEvent.setup()
    const name = await openOwn(user)
    await user.type(name, ' extra')
    await user.clear(productsValue())
    await user.type(productsValue(), '15')
    await user.click(screen.getByRole('checkbox', { name: 'Apply same value' }))
    await user.click(screen.getByRole('checkbox', { name: '0.50' }))
    const bar = saveBar()
    expect(bar).toHaveTextContent('4 unsaved changes')
    // the first three names, then «+n» for the rest
    for (const label of ['Name', 'Rounding values', 'Products markup value']) expect(bar).toHaveTextContent(label)
    expect(bar).toHaveTextContent('+1')
    await user.click(within(bar).getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Own markup')
    expect(productsValue()).toHaveValue('10')
    expect(screen.getByRole('checkbox', { name: '0.50' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    expect(probe.spies.update).not.toHaveBeenCalled()
  })

  it('does not count a change that returns to the stored value', async () => {
    const user = userEvent.setup()
    await openOwn(user)
    await user.click(screen.getByRole('checkbox', { name: '0.25' }))
    expect(saveBar()).toHaveTextContent('1 unsaved change')
    await user.click(screen.getByRole('checkbox', { name: '0.25' }))
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('blocks a percentage above 999 and says so under the field and in the bar', async () => {
    const user = userEvent.setup()
    await openOwn(user)
    await user.clear(productsValue())
    await user.type(productsValue(), '1200')
    expect(screen.getByText('Enter a number from 0 to 999.')).toBeInTheDocument()
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    expect(probe.spies.update).not.toHaveBeenCalled()
    expect(within(saveBar()).getByText('Fix 1 field to save.')).toBeInTheDocument()
    // fixing it lets it go through
    await user.clear(productsValue())
    await user.type(productsValue(), '12')
    expect(screen.queryByText('Fix 1 field to save.')).toBeNull()
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(probe.spies.update).toHaveBeenCalledTimes(1))
  })

  it('blocks a negative fixed amount (S-10)', async () => {
    const user = userEvent.setup()
    await openOwn(user, FIXED)
    await user.clear(productsValue())
    await user.type(productsValue(), '-2')
    expect(screen.getByText('Enter an amount of 0 or more.')).toBeInTheDocument()
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    expect(probe.spies.update).not.toHaveBeenCalled()
    expect(within(saveBar()).getByText('Fix 1 field to save.')).toBeInTheDocument()
  })

  it('blocks an empty name once a save was tried', async () => {
    const user = userEvent.setup()
    const name = await openOwn(user)
    await user.clear(name)
    expect(screen.queryByText('Name is required')).toBeNull()
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(probe.spies.update).not.toHaveBeenCalled()
  })

  it('saves an edit with the payload of main, inlineError and «Saved»', async () => {
    const user = userEvent.setup()
    const name = await openOwn(user, { ...OWN, site_id: null, delivery_type: null })
    await user.clear(name)
    await user.type(name, '  Own surcharge ')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(probe.spies.update).toHaveBeenCalledTimes(1))
    expect(probe.spies.update).toHaveBeenCalledWith(21, {
      name: 'Own surcharge',
      business_id: 7,
      site_id: null,
      delivery_type: null,
      rules: {
        products: { markup_type: 'percentage', markup_value: 10 },
        suboptions: { markup_type: 'percentage', markup_value: 10 }
      },
      enabled: true,
      rounding_values: []
    }, { inlineError: true })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(detailOf('Own surcharge')).toBeInTheDocument()
    expect(screen.queryByText('1 unsaved change')).toBeNull()
  })

  it('sends the suboptions as «fixed 0» when they are not applied, and the chosen rounding values', async () => {
    const user = userEvent.setup()
    await openOwn(user, { ...OWN, site_id: null, delivery_type: null })
    await user.click(screen.getByRole('checkbox', { name: 'Apply to suboptions' }))
    await user.click(screen.getByRole('checkbox', { name: '0.99' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(probe.spies.update).toHaveBeenCalledTimes(1))
    expect(probe.spies.update.mock.calls[0][1]).toMatchObject({
      rules: { products: { markup_type: 'percentage', markup_value: 10 }, suboptions: { markup_type: 'fixed', markup_value: 0 } },
      rounding_values: [0.99]
    })
  })

  it('keeps the detail with what was typed and says why when the save fails', async () => {
    const user = userEvent.setup()
    probe.answers.update = { error: true, result: ['Name already taken'] }
    const name = await openOwn(user)
    await user.type(name, ' extra')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('Name already taken')
    expect(within(saveBar()).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Own markup extra')
    expect(detailOf('Own markup')).toBeInTheDocument()
    expect(saveBar()).toHaveTextContent('1 unsaved change')
  })

  // main the API answers a duplicate scope (business, site and delivery type) with a key; it is said in words
  it('says in words that a markup for that scope already exists', async () => {
    const user = userEvent.setup()
    probe.answers.update = { error: true, result: ['API_ERROR_MARKUP_ALREADY_EXISTS'] }
    const name = await openOwn(user)
    await user.type(name, '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('A markup for this business, site and delivery type already exists. Edit that markup or pick a different combination.')
  })

  it('says a generic reason when the API gave none', async () => {
    const user = userEvent.setup()
    probe.answers.update = { error: true, result: [] }
    const name = await openOwn(user)
    await user.type(name, '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('The markup could not be saved.')
  })

  describe('«Enabled» of the detail (S-8)', () => {
    it('saves at once, does not touch the save bar and is not sent twice', async () => {
      const user = userEvent.setup()
      const name = await openOwn(user)
      await user.click(screen.getByRole('switch', { name: 'Enabled' }))
      expect(probe.spies.update).toHaveBeenCalledWith(21, { enabled: false }, { inlineError: true })
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'false'))
      expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
      // a later save carries the stored value, it does not undo the switch
      await user.type(name, '!')
      await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(probe.spies.update).toHaveBeenCalledTimes(2))
      expect(probe.spies.update.mock.calls[1][1]).toMatchObject({ name: 'Own markup!', enabled: false })
    })

    it('goes back and says why when it fails, still without dirtying the bar', async () => {
      const user = userEvent.setup()
      probe.answers.update = { error: true, result: ['Not allowed'] }
      await openOwn(user)
      await user.click(screen.getByRole('switch', { name: 'Enabled' }))
      const detail = screen.getByRole('region', { name: 'Own markup' })
      expect(await within(detail).findByRole('alert')).toHaveTextContent('Not allowed')
      expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    })

    it('follows the switch of the table', async () => {
      const user = userEvent.setup()
      await openOwn(user)
      expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
      await user.click(screen.getByRole('switch', { name: 'Enabled: Own markup' }))
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'false'))
      expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    })

    it('has no switch for a new markup', async () => {
      const user = userEvent.setup()
      probe.markups = [OWN]
      renderMarkups()
      await user.click(screen.getByRole('button', { name: 'Add markup' }))
      const detail = screen.getByRole('region', { name: 'New markup' })
      expect(within(detail).queryByRole('switch')).toBeNull()
    })
  })

  describe('a new markup', () => {
    const openNew = async (user) => {
      probe.markups = [OWN]
      probe.sites = [{ id: 4, name: 'Main site' }]
      renderMarkups()
      await user.click(screen.getByRole('button', { name: 'Add markup' }))
      return screen.getByRole('textbox', { name: /Name/ })
    }

    it('requires a name', async () => {
      const user = userEvent.setup()
      await openNew(user)
      await user.type(productsValue(), '5')
      await user.click(within(saveBar()).getByRole('button', { name: 'Create markup' }))
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(probe.spies.create).not.toHaveBeenCalled()
    })

    it('creates with the payload of main, inlineError, and opens the created markup', async () => {
      const user = userEvent.setup()
      const name = await openNew(user)
      await user.type(name, '  Happy hour ')
      await user.type(productsValue(), '5')
      await choose(user, 'Site', 'Main site')
      await choose(user, 'Delivery type', 'Pickup')
      await user.click(within(saveBar()).getByRole('button', { name: 'Create markup' }))
      await waitFor(() => expect(probe.spies.create).toHaveBeenCalledTimes(1))
      expect(probe.spies.create).toHaveBeenCalledWith({
        name: 'Happy hour',
        business_id: 7,
        site_id: 4,
        delivery_type: 'pickup',
        rules: {
          products: { markup_type: 'percentage', markup_value: 5 },
          suboptions: { markup_type: 'percentage', markup_value: 5 }
        },
        enabled: true,
        rounding_values: []
      }, { inlineError: true })
      expect(await screen.findByRole('heading', { level: 3, name: 'Happy hour' })).toBeInTheDocument()
      // now it is an edit: the switch is there and the bar is gone
      expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByText(/unsaved change/)).toBeNull()
    })

    it('keeps the form and says why when the creation fails', async () => {
      const user = userEvent.setup()
      probe.answers.create = { error: true, result: ['Name already taken'] }
      const name = await openNew(user)
      await user.type(name, 'Happy hour')
      await user.click(within(saveBar()).getByRole('button', { name: 'Create markup' }))
      expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('Name already taken')
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Happy hour')
      expect(detailOf('New markup')).toBeInTheDocument()
    })
  })
})
