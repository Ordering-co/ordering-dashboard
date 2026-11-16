/* eslint-disable import/first */
// redesign the /stores/markups route on Product (S/Markups) with the REAL controller (C/components/Markups), the 5.13 table
// and detail (S/BusinessMarkups/MarkupsTable, MarkupDetail in project mode) and the real MarkupForm, over a simulated `fetch`.
// Covered: the list (Business column: name, «Global», «Store <id>»; Applies to; Rule); the row switch (inlineError, back and the reason on
// a failure: G5-39, G5-40); the detail (opening a row, the locked Business of a store the API no longer gives, a save sends the payload
// of `main` and closes, a new markup with a store or global, the leave guard between rows); the bulk delete (count in the question, a
// partial failure keeps only the failed ids selected and says why: G5-41); the address (?id=, ?add=1, a number typed in the search).
// Stood in: the toast, the language, the session and the window width.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import { Route } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const API = 'https://api.test'

const mockModule = vi.hoisted(() => async () => {
  const { Markups } = await import('../../../../../../components/Markups')
  return {
    Markups,
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{ parsePrice: (value) => `$${Number(value).toFixed(2)}` }]
  }
})
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'demo' }]
}))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
const shell = vi.hoisted(() => ({ isCollapse: false, collapse: undefined }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: shell.isCollapse }, { handleMenuCollapse: shell.collapse }]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))

import { Markups } from '../index'

const OWN = {
  id: 21,
  name: 'Own markup',
  business_id: 12,
  business: { id: 12, name: 'Burger Place' },
  site_id: 4,
  delivery_type: 'pickup',
  enabled: true,
  rounding_values: [0.25, 0.99],
  rules: { products: { markup_type: 'percentage', markup_value: 15 }, suboptions: { markup_type: 'fixed', markup_value: 0 } }
}
const GLOBAL = {
  id: 22,
  name: 'Global markup',
  business_id: null,
  business: null,
  site_id: null,
  delivery_type: null,
  enabled: false,
  rounding_values: [],
  rules: { products: { markup_type: 'fixed', markup_value: 2.5 }, suboptions: { markup_type: 'fixed', markup_value: 1 } }
}
const ORPHAN = {
  id: 23,
  name: 'Orphan markup',
  business_id: 3,
  business: null,
  site_id: null,
  delivery_type: 'eatin',
  enabled: true,
  rounding_values: [],
  rules: { products: { markup_type: 'percentage', markup_value: 10 }, suboptions: { markup_type: 'percentage', markup_value: 10 } }
}

let calls
let answers
let list
const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

beforeEach(() => {
  shell.isCollapse = false
  shell.collapse = vi.fn()
  calls = []
  answers = {}
  list = [OWN, GLOBAL, ORPHAN]
  window.history.replaceState(null, '', '/stores/markups')
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    const [base, search = ''] = url.split('?')
    const path = base.replace(API, '')
    calls.push({ method, path, search: decodeURIComponent(search), body: options.body ? JSON.parse(options.body) : undefined })
    const handler = answers[`${method} ${path}`]
    if (handler) return answer(handler(options))
    if (method === 'GET' && path === '/markups') {
      const where = decodeURIComponent(search).match(/"value":"%25(\d+)%25"/)
      const rows = where ? list.filter(markup => String(markup.id).includes(where[1])) : list
      return answer({ error: false, result: rows, pagination: { current_page: 1, page_size: 10, total: rows.length, total_pages: 1, from: 1, to: rows.length } })
    }
    if (method === 'GET' && path === '/sites') return answer({ error: false, result: [{ id: 4, name: 'Main site' }] })
    if (method === 'GET' && path === '/backoffice/businesses') {
      return answer({ error: false, result: [{ id: 12, name: 'Burger Place' }], pagination: { total: 1, total_pages: 1 } })
    }
    if (method === 'POST' && path === '/markups') return answer({ error: false, result: { id: 30, name: 'Summer', business_id: null, enabled: true, rules: {} } })
    if (method === 'PUT') {
      const id = Number(path.split('/')[2])
      return answer({ error: false, result: { ...list.find(markup => markup.id === id), ...JSON.parse(options.body) } })
    }
    if (method === 'DELETE') return answer({ error: false, result: true })
    return answer({ error: false, result: [] })
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.getElementById('app-modals')?.remove()
})

const bodyOf = (method, path) => calls.find(call => call.method === method && call.path === path)?.body
const renderRoute = async ({ wait = 'Own markup' } = {}) => {
  const user = userEvent.setup()
  // the router and the window say the same address (the route reads both, as `main`)
  renderWithProviders(<Markups isUseQuery />, { initialEntries: [`${window.location.pathname}${window.location.search}`] })
  if (wait) await screen.findByText(wait)
  return user
}
const nameButton = (name) => screen.getByRole('button', { name: `${name}, View details` })
const panel = () => screen.getByRole('complementary')
const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) })

describe('Markups route · list', () => {
  it('says the business of each markup: its name, «Global» or the id of a store the API no longer gives', async () => {
    await renderRoute()
    expect(screen.getByRole('columnheader', { name: 'Business' })).toBeInTheDocument()
    expect(within(rowOf('Own markup')).getByText('Burger Place')).toBeInTheDocument()
    expect(within(rowOf('Global markup')).getByText('Global')).toBeInTheDocument()
    expect(within(rowOf('Orphan markup')).getByText('Store 3')).toBeInTheDocument()
  })

  it('says where each markup applies and what it adds, with «Eat in» for eatin', async () => {
    await renderRoute()
    expect(within(rowOf('Own markup')).getByText('Main site · Pickup')).toBeInTheDocument()
    expect(within(rowOf('Own markup')).getByText('+15%')).toBeInTheDocument()
    expect(within(rowOf('Orphan markup')).getByText('All sites · Eat in')).toBeInTheDocument()
    expect(within(rowOf('Global markup')).getByText('+$2.50')).toBeInTheDocument()
  })

  it('heads the page with the count and «Add markup»', async () => {
    await renderRoute()
    expect(screen.getByRole('heading', { level: 1, name: 'Markups' })).toBeInTheDocument()
    expect(screen.getByText('3 markups')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add markup' })).toBeInTheDocument()
  })

  it('has no «Open menu» button with the sidebar open', async () => {
    await renderRoute()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('opens the collapsed sidebar from «Open menu», the first child of the header lead block', async () => {
    shell.isCollapse = true
    const user = await renderRoute()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await user.click(opener)
    expect(shell.collapse).toHaveBeenCalledExactlyOnceWith(false)
  })
})

// tanda P: a failed load said «No markups found» under the error, as if the project had none (as /stores/devices does,
// the error and its retry stand alone)
describe('Markups route · a failed load', () => {
  it('shows the error and Try again, and no table nor «No markups found»', async () => {
    answers['GET /markups'] = () => ({ error: true, result: ['Internal error'] })
    await renderRoute({ wait: null })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('No markups found')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /select all/i })).toBeNull()
  })
})

describe('Markups route · the switch of a row (G5-39, G5-40)', () => {
  it('saves at once with PUT { enabled } and no toast of its own', async () => {
    const user = await renderRoute()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Own markup' }))
    await waitFor(() => expect(bodyOf('PUT', '/markups/21')).toEqual({ enabled: false }))
    expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).not.toBeChecked()
  })

  it('goes back and says why when the save fails', async () => {
    answers['PUT /markups/21'] = () => ({ error: true, result: ['Not allowed'] })
    const user = await renderRoute()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Own markup' }))
    // the API's own reason, in place of a toast «Error» and an Alert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not allowed'))
    expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).toBeChecked()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('Markups route · the detail', () => {
  it('opens a row beside the list with its values and the business locked', async () => {
    const user = await renderRoute()
    await user.click(nameButton('Own markup'))
    const detail = await screen.findByRole('heading', { name: 'Own markup' })
    expect(detail).toBeInTheDocument()
    expect(within(panel()).getByRole('textbox', { name: /Name/ })).toHaveValue('Own markup')
    expect(within(panel()).getByRole('combobox', { name: (name) => name.startsWith('Business') })).toBeDisabled()
    expect(window.location.search).toContain('id=21')
  })

  it('names the locked business of a store the API no longer gives by its id, not «All businesses»', async () => {
    const user = await renderRoute()
    await user.click(nameButton('Orphan markup'))
    // the option of the stored store (value 3) is in the list, so the trigger says its name and not the bare value
    const business = await within(panel()).findByRole('combobox', { name: (name) => name.startsWith('Business') })
    expect(business).toHaveAccessibleName('Business Store 3')
    expect(business).toBeDisabled()
  })

  it('saves an edit with PUT and the payload of main, then closes as main', async () => {
    const user = await renderRoute()
    await user.click(nameButton('Own markup'))
    const name = await within(panel()).findByRole('textbox', { name: /Name/ })
    await user.clear(name)
    await user.type(name, 'Renamed')
    await user.click(within(panel()).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(bodyOf('PUT', '/markups/21')).toEqual({
      name: 'Renamed',
      business_id: 12,
      site_id: 4,
      delivery_type: 'pickup',
      rules: { products: { markup_type: 'percentage', markup_value: 15 }, suboptions: { markup_type: 'fixed', markup_value: 0 } },
      enabled: true,
      rounding_values: [0.25, 0.99]
    }))
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
  })

  it('creates a markup for a store with POST', async () => {
    const user = await renderRoute()
    await user.click(screen.getByRole('button', { name: 'Add markup' }))
    await screen.findByRole('heading', { name: 'New markup' })
    await user.type(within(panel()).getByRole('textbox', { name: /Name/ }), 'Summer')
    await user.click(within(panel()).getByRole('combobox', { name: (name) => name.startsWith('Business') }))
    const businesses = await screen.findByRole('listbox', { name: 'Business', hidden: true })
    await user.click(within(businesses).getByRole('option', { name: 'Burger Place', hidden: true }))
    await user.type(within(panel()).getByRole('textbox', { name: 'Products markup value' }), '5')
    await user.click(within(panel()).getByRole('button', { name: 'Create markup' }))
    await waitFor(() => expect(bodyOf('POST', '/markups')).toMatchObject({ name: 'Summer', business_id: 12, site_id: null, delivery_type: null }))
  })

  it('creates a global markup (all businesses) with business_id null and no «Business is required»', async () => {
    const user = await renderRoute()
    await user.click(screen.getByRole('button', { name: 'Add markup' }))
    await screen.findByRole('heading', { name: 'New markup' })
    await user.type(within(panel()).getByRole('textbox', { name: /Name/ }), 'Everywhere')
    await user.type(within(panel()).getByRole('textbox', { name: 'Products markup value' }), '5')
    await user.click(within(panel()).getByRole('button', { name: 'Create markup' }))
    await waitFor(() => expect(bodyOf('POST', '/markups')).toMatchObject({ name: 'Everywhere', business_id: null }))
    expect(screen.queryByText('Business is required')).toBeNull()
  })

  it('asks before closing unsaved work', async () => {
    const user = await renderRoute()
    await user.click(nameButton('Own markup'))
    const name = await within(panel()).findByRole('textbox', { name: /Name/ })
    await user.type(name, ' 2')
    await user.click(within(panel()).getByRole('button', { name: /^(Close|Back)$/ }))
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
  })
})

describe('Markups route · bulk delete (G5-41)', () => {
  it('asks with the count, and after a partial failure keeps only the failed markup selected and says why', async () => {
    answers['DELETE /markups/22'] = () => ({ error: true, result: ['Markup in use'] })
    const user = await renderRoute()
    await user.click(screen.getByRole('checkbox', { name: 'Select Own markup' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Global markup' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 2 markups?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete markups' }))
    await waitFor(() => expect(screen.getByText('1 markup could not be deleted: Markup in use')).toBeInTheDocument())
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(calls.filter(call => call.method === 'DELETE').map(call => call.path)).toEqual(['/markups/21', '/markups/22'])
  })
})

describe('Markups route · the address', () => {
  it('?id= opens that markup', async () => {
    window.history.replaceState(null, '', '/stores/markups?id=22')
    await renderRoute()
    expect(await screen.findByRole('heading', { name: 'Global markup' })).toBeInTheDocument()
  })

  it('?id= of a markup that is not on the page searches it by id', async () => {
    list = [OWN, GLOBAL, ORPHAN, { ...OWN, id: 77, name: 'Far markup' }]
    const first = list.slice(0, 3)
    let asked = 0
    answers['GET /markups'] = () => {
      asked += 1
      const rows = asked === 1 ? first : [list[3]]
      return { error: false, result: rows, pagination: { current_page: 1, page_size: 10, total: rows.length, total_pages: 1 } }
    }
    window.history.replaceState(null, '', '/stores/markups?id=77')
    await renderRoute({ wait: null })
    expect(await screen.findByRole('heading', { name: 'Far markup' })).toBeInTheDocument()
    expect(calls.filter(call => call.path === '/markups' && call.search.includes('"attribute":"id"')).length).toBeGreaterThan(0)
  })

  it('a number typed in the search with unsaved work open asks first, and staying keeps the open markup (review r1 #1)', async () => {
    // a wide window: the list stays beside the detail (split), so its search can be used
    vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('min-width'), addEventListener () {}, removeEventListener () {} }))
    const user = await renderRoute()
    await user.click(nameButton('Own markup'))
    const name = await within(panel()).findByRole('textbox', { name: /Name/ })
    await user.type(name, ' 2')
    await user.type(screen.getByRole('searchbox', { name: 'Search markups' }), '23{Enter}')
    const dialog = await screen.findByRole('alertdialog', { name: 'Save your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Own markup' })).toBeInTheDocument()
    expect(within(panel()).getByRole('textbox', { name: /Name/ })).toHaveValue('Own markup 2')
    expect(window.location.search).toContain('id=21')
  })

  it('?add=1 opens a new markup', async () => {
    window.history.replaceState(null, '', '/stores/markups?add=1')
    await renderRoute()
    expect(await screen.findByRole('heading', { name: 'New markup' })).toBeInTheDocument()
  })

  it('a number typed in the search goes to the address and opens that markup, as main', async () => {
    const user = await renderRoute()
    await user.type(screen.getByRole('searchbox', { name: 'Search markups' }), '23{Enter}')
    await waitFor(() => expect(window.location.search).toContain('id=23'))
    expect(await screen.findByRole('heading', { name: 'Orphan markup' })).toBeInTheDocument()
  })
})

// redesign bugs E: the sidebar, links, back/forward, ⌘K and Mia ask too while a markup holds unsaved work
describe('Markups route · ways out of the page', () => {
  it('a route change to another page asks first and Keep editing stays; with nothing unsaved it goes at once', async () => {
    const user = userEvent.setup()
    const route = {}
    renderWithProviders(
      <>
        <Markups isUseQuery />
        <Route path='*' render={({ history, location }) => { route.history = history; route.path = location.pathname; return null }} />
      </>,
      { initialEntries: [`${window.location.pathname}${window.location.search}`] }
    )
    await screen.findByText('Own markup')
    const start = route.path
    await user.click(nameButton('Own markup'))
    await user.type(await within(panel()).findByRole('textbox', { name: /Name/ }), ' 2')
    act(() => { route.history.push('/orders') })
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(route.path).toBe(start)

    const { requestRouteLeave } = await import('../../../../utils/routeLeaveGuard')
    const go = vi.fn()
    act(() => { requestRouteLeave(go) })
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(go).toHaveBeenCalledTimes(1))
    act(() => { route.history.push('/orders') })
    expect(route.path).toBe('/orders')
  })
})
