/* eslint-disable import/first */
// redesign PM-B: the store table of /connect/pos-menu. A Product DataTable over what the controller gives (the list of
// businesses, the POS catalog, the cities), RecordCards under 768px. It fetches nothing: every handler is the page's. Parity with
// BusinessesList / SingleBusiness (inventory C6, C7, C9) plus the defects it fixes: PM-01 (a connected POS reads "Connected"), PM-07
// (the POS column has a header and a name), PM-08 (a phone gets cards), PM-15 (an error says so), PM-16 (the Disabled reason has data).
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ phone: false }))

const session = vi.hoisted(() => ({ user: { id: 1, level: 0 } }))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
  useUtils: () => [{ optimizeImage: (src) => src, parseDate: (value) => `on ${value}` }],
  // main #394: the fix action of a row opens the plugin's setup page (usePluginPage) for an administrator
  useSession: () => [{ user: session.user, token: 'tok-1' }],
  useApi: () => [{ project: 'proj-1' }],
  useToast: () => [{}, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))

import { PosMenuTable } from '../PosMenuTable'

const INTEGRATIONS = [
  { id: 5, name: 'Simphony', type: 'pos', logo: 'simphony.png', plugin_id: 1 },
  { id: 6, name: 'Square', type: 'pos', logo: 'square.png', plugin_id: 2 }
]
const CITIES = [{ id: 10, name: 'Miami' }, { id: 11, name: 'Austin' }]
const link = (overrides = {}) => ({ business_id: 2, third_party_integration_id: 5, enabled: true, setup_status: null, ...overrides })

const BUSINESSES = [
  { id: 2, name: 'Fast Bite', city_id: 10, logo: 'fast.png', enabled: true, third_party_integrations: [link()] },
  { id: 4, name: 'KCF', city_id: 10, enabled: true, third_party_integrations: [] },
  {
    id: 6,
    name: "Dono's Pizza",
    city_id: 11,
    enabled: false,
    disabled_reason: 'No orders in 30 days',
    third_party_integrations: [link({ business_id: 6, third_party_integration_id: 6, setup_status: 'pending' })]
  }
]

const draw = (props = {}) => {
  const handlers = { onOpenBusiness: vi.fn(), onClearSearch: vi.fn(), onRetry: vi.fn() }
  const utils = render(
    <PosMenuTable
      businesses={BUSINESSES}
      loading={false}
      error={null}
      integrations={INTEGRATIONS}
      citiesList={CITIES}
      activeState
      searchValue=''
      activeBusinessId={null}
      {...handlers}
      {...props}
    />
  )
  return { ...utils, ...handlers }
}

const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) })
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent.trim())

beforeEach(() => {
  mockState.phone = false
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('PosMenuTable — columns and cells', () => {
  it('draws ID, Business, POS and Status, with names and a label for the table', () => {
    draw()
    const table = screen.getByRole('table', { name: 'Stores and their POS' })
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Status'])
    expect(within(table).getAllByRole('row')).toHaveLength(1 + BUSINESSES.length)
  })

  it('shows the name and the city under it, the ID as a figure, and the logo through optimizeImage', () => {
    draw()
    const fast = rowOf('Fast Bite')
    expect(within(fast).getByText('Miami')).toBeInTheDocument()
    expect(within(fast).getByText('2')).toHaveClass('odc-figure')
    expect(fast.querySelector('img[src="fast.png"]')).not.toBeNull()
    expect(within(rowOf('Dono')).getByText('Austin')).toBeInTheDocument()
  })

  it('falls back to the city the business carries when the cities list has none', () => {
    draw({ businesses: [{ id: 9, name: 'Lone', city_id: 99, city: { name: 'Lima' }, third_party_integrations: [] }] })
    expect(within(rowOf('Lone')).getByText('Lima')).toBeInTheDocument()
  })

  // redesign PM-01: main drew "Not connected" for a store connected without a setup status. (main #394, pending
  // the owner): that link is a setup the plugin has not reported on, «Setup pending»
  // D1 (option C): a link no plugin reported on (made before api-core#3587) reads Connected again
  it('PM-01: a store connected to Simphony with no setup status reads Simphony and Connected, not Not connected', () => {
    draw()
    const fast = rowOf('Fast Bite')
    expect(within(fast).getByText('Simphony')).toBeInTheDocument()
    expect(within(fast).getByText('Connected')).toBeInTheDocument()
    expect(fast.querySelector('.odc-status')).toHaveAttribute('data-family', 'done')
    expect(within(fast).queryByText('Not connected')).toBeNull()
  })

  // redesign PM-07: the POS column has a name beside the logo; the logo itself is decoration
  it('PM-07: the POS logo is decorative and is hidden when it fails to load', () => {
    draw()
    const logo = rowOf('Fast Bite').querySelector('img[src="simphony.png"]')
    expect(logo).toHaveAttribute('alt', '')
    fireEvent.error(logo)
    expect(rowOf('Fast Bite').querySelector('img[src="simphony.png"]')).toBeNull()
    expect(within(rowOf('Fast Bite')).getByText('Simphony')).toBeInTheDocument() // the name stays
  })

  // redesign PM-R3: said once, by the status (the review heard it twice)
  it('a store with no POS draws a hidden dash and the status says "Not connected" once', () => {
    draw()
    const kcf = rowOf('KCF')
    expect(within(kcf).getByText('—')).toHaveAttribute('aria-hidden', 'true')
    const spoken = within(kcf).getAllByText('Not connected')
    expect(spoken).toHaveLength(1)
    expect(spoken[0].classList.contains('odc-sr-only')).toBe(false)
    expect(kcf.querySelector('.odc-status')).toBeNull() // no POS, no dot: plain secondary text
  })

  // (main #390, owner decision D1 = C): the setup status is main's translated state, not the raw text of the API
  it('a setup status is drawn with main\'s words for its state', () => {
    draw()
    const dono = rowOf('Dono')
    expect(within(dono).getByText('Square')).toBeInTheDocument()
    expect(within(dono).getByText('Setup pending')).toBeInTheDocument()
    expect(within(dono).queryByText('Pending')).toBeNull()
    expect(dono.querySelector('.odc-status')).toHaveAttribute('data-family', 'pending')
  })

  it('names every POS of a store', () => {
    const both = [{ ...BUSINESSES[0], third_party_integrations: [link(), link({ third_party_integration_id: 6 })] }]
    draw({ businesses: both })
    const fast = rowOf('Fast Bite')
    expect(within(fast).getByText('Simphony')).toBeInTheDocument()
    expect(within(fast).getByText('Square')).toBeInTheDocument()
  })

  it('a POS that is turned off reads "Turned off"', () => {
    draw({ businesses: [{ ...BUSINESSES[0], third_party_integrations: [link({ enabled: false })] }] })
    expect(within(rowOf('Fast Bite')).getByText('Turned off')).toBeInTheDocument()
  })

  // redesign PM-16: main drew the header of "Disabled reason" with no cell
  it('PM-16: the Inactive tab adds the Disabled reason column, with the reason of the store', () => {
    draw({ activeState: false })
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Status', 'Disabled reason'])
    expect(within(rowOf('Dono')).getByText('No orders in 30 days')).toBeInTheDocument()
  })

  it('the Active tab has no Disabled reason column', () => {
    draw()
    expect(headers()).not.toContain('Disabled reason')
  })
})

describe('PosMenuTable — columns the person chose (C7)', () => {
  it('offers ID and POS as always shown, hides Business and Status, and resets', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog', { name: 'Manage columns' })
    expect(within(dialog).getByRole('checkbox', { name: 'ID' })).toBeDisabled()
    expect(within(dialog).getByRole('checkbox', { name: 'POS' })).toBeDisabled()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Business' }))
    expect(headers()).toEqual(['ID', 'POS', 'Status'])
    await user.click(within(dialog).getByRole('checkbox', { name: 'Status' }))
    expect(headers()).toEqual(['ID', 'POS'])
    await user.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Status'])
  })
})

describe('PosMenuTable — opening a store', () => {
  it('a click on a row opens that store', async () => {
    const user = userEvent.setup()
    const { onOpenBusiness } = draw()
    await user.click(within(rowOf('KCF')).getByText('KCF'))
    expect(onOpenBusiness).toHaveBeenCalledTimes(1)
    expect(onOpenBusiness).toHaveBeenCalledWith(BUSINESSES[1])
  })

  it('Enter on a focused row opens it', async () => {
    const user = userEvent.setup()
    const { onOpenBusiness } = draw()
    act(() => rowOf('Fast Bite').focus())
    await user.keyboard('{Enter}')
    expect(onOpenBusiness).toHaveBeenCalledWith(BUSINESSES[0])
  })

  it('marks the open store (a number, or the text of the URL) and has no selection column', () => {
    draw({ activeBusinessId: '4' })
    expect(rowOf('KCF')).toHaveAttribute('aria-current', 'true')
    expect(rowOf('Fast Bite')).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('PosMenuTable — states that are not rows', () => {
  it('loading draws 10 skeleton rows and reads "Loading stores" once', () => {
    draw({ loading: true, businesses: [] })
    const table = screen.getByRole('table', { name: 'Stores and their POS' })
    expect(table).toHaveAttribute('aria-busy', 'true')
    expect(table.querySelectorAll('tbody tr[data-skeleton]')).toHaveLength(10)
    expect(screen.getByText('Loading stores')).toBeInTheDocument()
  })

  it('a search with no results says the term and "Clear search" clears it', async () => {
    const user = userEvent.setup()
    const { onClearSearch } = draw({ businesses: [], searchValue: 'zzz' })
    expect(screen.getByText('No businesses found for "zzz". Try another name, email, or phone.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onClearSearch).toHaveBeenCalledTimes(1)
  })

  it('with no search, the empty Active and Inactive tabs say so', () => {
    const { rerender, onOpenBusiness, onClearSearch, onRetry } = draw({ businesses: [] })
    expect(screen.getByText('No active businesses to show.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    rerender(
      <PosMenuTable
        businesses={[]}
        loading={false}
        error={null}
        integrations={INTEGRATIONS}
        citiesList={CITIES}
        activeState={false}
        searchValue=''
        activeBusinessId={null}
        onOpenBusiness={onOpenBusiness}
        onClearSearch={onClearSearch}
        onRetry={onRetry}
      />
    )
    expect(screen.getByText('No inactive businesses to show.')).toBeInTheDocument()
  })

  // redesign PM-15: main left an empty table when the list failed
  it('PM-15: an error says what failed (the API text when it sends one) and "Try again" retries', async () => {
    const user = userEvent.setup()
    const { onRetry } = draw({ businesses: [], error: ['Something broke upstream'] })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something broke upstream')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('PM-15: an error with no text of its own says the stores could not be loaded', () => {
    draw({ businesses: [], error: [{}] })
    expect(screen.getByText('The stores could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('an error that arrives as plain text uses that text', () => {
    draw({ businesses: [], error: 'Network down' })
    expect(screen.getByText('Network down')).toBeInTheDocument()
  })
})

describe('PosMenuTable — phone (PM-08)', () => {
  beforeEach(() => { mockState.phone = true })

  it('draws a card per store with its name, POS and status, and no table', () => {
    draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(BUSINESSES.length)
    const fast = screen.getByRole('link', { name: 'Open Fast Bite' }).closest('li')
    expect(within(fast).getByText('Fast Bite')).toBeInTheDocument()
    expect(within(fast).getByText('Simphony · Miami')).toBeInTheDocument()
    expect(within(fast).getByText('Connected')).toBeInTheDocument() // D1 (C)
    const dono = screen.getByRole('link', { name: "Open Dono's Pizza" }).closest('li')
    expect(within(dono).getByText('Square · Austin')).toBeInTheDocument()
    expect(within(dono).getByText('Setup pending')).toBeInTheDocument()
  })

  it('a store with no POS shows only the city and "Not connected"', () => {
    draw()
    const kcf = screen.getByRole('link', { name: 'Open KCF' }).closest('li')
    expect(within(kcf).getByText('Miami')).toBeInTheDocument()
    expect(within(kcf).getByText('Not connected')).toBeInTheDocument()
    expect(kcf.querySelector('.odc-status')).toBeNull()
  })

  it('a click on a card opens the store, and the link points to ?id=', async () => {
    const user = userEvent.setup()
    const { onOpenBusiness } = draw()
    const anchor = screen.getByRole('link', { name: 'Open KCF' })
    expect(anchor.getAttribute('href')).toContain('id=4')
    await user.click(anchor)
    expect(onOpenBusiness).toHaveBeenCalledWith(BUSINESSES[1])
  })

  it('loading, empty and error use the same states', async () => {
    const user = userEvent.setup()
    const loading = draw({ loading: true, businesses: [] })
    expect(screen.getByText('Loading stores')).toBeInTheDocument()
    loading.unmount()
    const empty = draw({ businesses: [], searchValue: 'zzz' })
    expect(screen.getByText('No businesses found for "zzz". Try another name, email, or phone.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(empty.onClearSearch).toHaveBeenCalledTimes(1)
    empty.unmount()
    const failed = draw({ businesses: [], error: ['Boom'] })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(failed.onRetry).toHaveBeenCalledTimes(1)
  })
})

// main #394: SingleBusiness of main, in the table: the reason and date of the state, the plugin warning and one fix action
describe('PosMenuTable — main #394 status and fix action', () => {
  const plugin = { name: 'Square', root: 'https://square.example', setup_url: '/setup?project=@{project_code}' }
  const square = { id: 6, name: 'Square', type: 'pos', logo: 'square.png', plugin_id: 2, plugin }
  const store = (id, name, changes) => ({ id, name, city_id: 10, enabled: true, third_party_integrations: [link({ business_id: id, third_party_integration_id: 6, ...changes })] })
  const drawStores = (businesses, integrations = [square], props = {}) => draw({ businesses, integrations, ...props })

  afterEach(() => { session.user = { id: 1, level: 0 } })

  it('a failed POS says why and when, and offers Reconnect that opens the setup page without opening the store', async () => {
    const user = userEvent.setup()
    const { onOpenBusiness } = drawStores([store(2, 'Fast Bite', { setup_status: 'failed', setup_message: 'Token expired', setup_status_updated_at: '2026-10-20' })])
    const row = rowOf('Fast Bite')
    expect(within(row).getByText('Needs attention')).toBeInTheDocument()
    expect(within(row).getByText('Token expired')).toBeInTheDocument()
    expect(within(row).getByText('on 2026-10-20')).toBeInTheDocument()
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Status', 'Actions'])
    await user.click(within(row).getByRole('button', { name: 'Reconnect · Fast Bite' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', 'https://square.example/setup?project=proj-1')
    expect(onOpenBusiness).not.toHaveBeenCalled()
  })

  // D1 (C): a link with no reported status is connected, so it offers nothing to fix
  it('a pending setup offers Continue setup; a connected POS, one with no reported status and a store without one offer nothing', () => {
    drawStores([
      store(2, 'Fast Bite', { setup_status: 'pending' }),
      store(3, 'Dono', { setup_status: 'success' }),
      { id: 4, name: 'KCF', city_id: 10, enabled: true, third_party_integrations: [] },
      store(5, 'Old Link', { setup_status: null })
    ])
    expect(within(rowOf('Fast Bite')).getByRole('button', { name: 'Continue setup · Fast Bite' })).toBeInTheDocument()
    expect(within(rowOf('Old Link')).queryByRole('button')).toBeNull()
    expect(within(rowOf('Old Link')).getByText('Connected')).toBeInTheDocument()
    expect(within(rowOf('Dono')).queryByRole('button')).toBeNull()
    expect(within(rowOf('KCF')).queryByRole('button')).toBeNull()
  })

  it('no action column when no row needs fixing', () => {
    drawStores([store(3, 'Dono', { setup_status: 'success' })])
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Status'])
  })

  it('a disabled plugin warns beside the state and offers no action', () => {
    drawStores([store(2, 'Fast Bite', { setup_status: 'failed' })], [{ ...square, plugin: { ...plugin, enabled: false } }])
    const row = rowOf('Fast Bite')
    expect(within(row).getByRole('img', { name: 'The plugin of this integration is disabled.' })).toBeInTheDocument()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('a plugin without a setup page offers no action', () => {
    drawStores([store(2, 'Fast Bite', { setup_status: 'failed' })], [{ ...square, plugin: { ...plugin, setup_url: null } }])
    expect(within(rowOf('Fast Bite')).queryByRole('button')).toBeNull()
  })

  it('a Calendly setup is no action for someone who is not an administrator (main )', () => {
    session.user = { id: 2, level: 2 }
    drawStores([store(2, 'Fast Bite', { setup_status: 'failed' })], [{ ...square, plugin: { ...plugin, setup_url: 'https://calendly.com/team/setup' } }])
    expect(within(rowOf('Fast Bite')).queryByRole('button')).toBeNull()
  })

  // review r1
  it('a catalog entry without its plugin warns of nothing', () => {
    drawStores([store(2, 'Fast Bite', { setup_status: 'success' })], [{ ...square, plugin: undefined }])
    expect(within(rowOf('Fast Bite')).queryByRole('img', { name: /plugin/ })).toBeNull()
  })

  it('a plugin page a row opened stays open when the reload of the list fails', async () => {
    const user = userEvent.setup()
    const businesses = [store(2, 'Fast Bite', { setup_status: 'failed' })]
    const { rerender } = drawStores(businesses)
    await user.click(within(rowOf('Fast Bite')).getByRole('button', { name: 'Reconnect · Fast Bite' }))
    await screen.findByRole('dialog', { name: 'Square' })
    rerender(<PosMenuTable businesses={businesses} loading={false} error={['Network error']} integrations={[square]} citiesList={CITIES} activeState searchValue='' activeBusinessId={null} onOpenBusiness={vi.fn()} onClearSearch={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Square' })).toBeInTheDocument()
  })

  it('a phone card carries the action under it', () => {
    mockState.phone = true
    drawStores([store(2, 'Fast Bite', { setup_status: 'failed' })])
    expect(screen.getByRole('button', { name: 'Reconnect · Fast Bite' })).toBeInTheDocument()
  })
})
