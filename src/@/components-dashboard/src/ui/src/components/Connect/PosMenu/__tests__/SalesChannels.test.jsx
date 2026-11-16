/* eslint-disable import/first */
// redesign SC-B: /connect/sales-channels is the /connect/pos-menu page with kind='sales_channel'. The two controllers
// (PosMenuBusinessList, PosMenuBusinessDetails) are stubs that play the real ones (they hand their props to the UI, as those do, plus the
// state the test sets); the page shell, the table, the panel, the cards and the model are the real ones, and so are the Product wrappers.
// The legacy pieces (custom fields, schedule, logs, the help box) are stubs. SplitView is the real one, seen through a spy on its props.
import React from 'react'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

const seen = vi.hoisted(() => ({ list: null, details: null, split: null, help: null }))
const ctl = vi.hoisted(() => ({ props: {}, detailsProps: {} }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useUtils: () => [{ optimizeImage: (src) => src }],
  useSession: () => [{ user: { id: 1, level: 0 }, token: 'tok-1' }],
  useApi: () => [{ project: 'proj-1' }],
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  PosMenuBusinessList: ({ UIComponent, ...props }) => {
    seen.list = props
    return <UIComponent {...props} {...ctl.props} />
  },
  // the answer of the store is the row the page opened (the real one asks the API for it)
  PosMenuBusinessDetails: ({ UIComponent, ...props }) => {
    seen.details = props
    return (
      <UIComponent
        {...props}
        businessState={{ loading: false, error: null, business: props.business }}
        actionStatus={{ loading: false, error: null }}
        formState={{ loading: false, changes: {}, result: { error: false } }}
        setFormState={vi.fn()}
        handleChangeActiveBusiness={vi.fn().mockResolvedValue(undefined)}
        handleConnectBusiness={vi.fn().mockResolvedValue(undefined)}
        handleDisconnectBusiness={vi.fn().mockResolvedValue(undefined)}
        handlePushAction={vi.fn().mockResolvedValue(undefined)}
        handleSync={vi.fn().mockResolvedValue(undefined)}
        handleUpdateBusinessState={vi.fn()}
        handleSuccessAddBusinessItem={vi.fn()}
        handleSuccessDeleteBusinessItem={vi.fn()}
        updateBusiness={vi.fn()}
        {...ctl.detailsProps}
      />
    )
  },
  // the controller of the custom fields, which the panel now wires itself (PosCustomFieldsDialog)
  BusinessMetaFields: () => <div data-testid='custom-fields' />
}))
vi.mock('jsoneditor-react', () => ({ JsonEditor: () => null }))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
// the help box records its props (as ImportersShell does) so Learn can be read
vi.mock('../../InfoHelpBox', () => ({
  InfoHelpBox: (props) => {
    seen.help = props
    return props.open
      ? (
        <div role='dialog' aria-label='Help'>
          <p>{props.data.name}</p>
          <p>{props.data.description}</p>
        </div>
        )
      : null
  }
}))
vi.mock('../../../Stores', () => ({
  BusinessSchedule: () => <div data-testid='schedule' />
}))
vi.mock('../../../Shared', () => ({
  IntegrationLogs: () => <div data-testid='logs' />
}))
vi.mock('../../../Shared/Product', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    SplitView: (props) => {
      seen.split = props
      return <actual.SplitView {...props} />
    }
  }
})

import { SalesChannels } from '../../SalesChannels'
import { PosMenu } from '../index'

// The catalog of this page has sales channels only (integrationType: 'sales_channel'): the POS of a store is only in its own link
const uberEats = {
  id: 100,
  key: 'uber_eats_integration',
  name: 'Uber Eats',
  type: 'sales_channel',
  logo: 'https://logo.example/uber.png',
  plugin_id: 9,
  plugin_root: 'https://uber.example',
  plugin: { name: 'Uber Eats', root: 'https://uber.example', links: { general_settings: '/general' } }
}
const rappi = {
  id: 101,
  key: 'rappi_integration',
  name: 'Rappi',
  type: 'sales_channel',
  logo: 'https://logo.example/rappi.png',
  plugin_id: null,
  plugin: null,
  plugin_root: 'https://rappi.example'
}
// A sales channel that is called like a call provider: here it is a channel like the others, not a setup call
const deliverect = {
  id: 102,
  key: 'deliverect_integration',
  name: 'Deliverect',
  type: 'sales_channel',
  logo: 'https://logo.example/deliverect.png',
  plugin_id: null,
  plugin: null,
  plugin_root: 'https://deliverect.example'
}
const CATALOG = [uberEats, rappi, deliverect]

const squareNested = { id: 300, name: 'Square', type: 'pos', logo: 'https://logo.example/square.png' }

const BUSINESSES = [
  {
    id: 7,
    name: 'Fast Bite',
    city_id: 1,
    enabled: true,
    third_party_integrations: [
      { business_id: 7, third_party_integration_id: 100, enabled: true, external_id: 'store-123', setup_status: 'completed' },
      { business_id: 7, third_party_integration_id: 300, enabled: true, third_party_integration: squareNested }
    ]
  },
  { id: 8, name: 'KCF', city_id: 1, enabled: true, third_party_integrations: [] },
  {
    id: 9,
    name: 'Pizza Hub',
    city_id: 1,
    enabled: false,
    disabled_reason: 'No orders in 30 days',
    third_party_integrations: [{ business_id: 9, third_party_integration_id: 101, enabled: false }]
  }
]

const baseCtl = (overrides = {}) => ({
  businessList: { loading: false, error: null, businesses: BUSINESSES },
  integrationsList: { loading: false, error: null, thirdPartyIntegrations: CATALOG },
  pagination: { currentPage: 1, pageSize: 10, total: 3, totalPages: 1, from: 1, to: 3 },
  searchValue: '',
  selectedBusinessActiveState: true,
  handleChangeBusinessActiveState: vi.fn(),
  handleSucessUpdateBusiness: vi.fn(),
  handleInstallPosIntegration: vi.fn(),
  installingPluginRoot: null,
  getIntegrations: vi.fn(),
  loadBusinesses: vi.fn(),
  refreshBusinesses: vi.fn(),
  onSearch: vi.fn(),
  onBusinessRedirect: vi.fn(),
  getPageBusinesses: vi.fn(),
  filterValues: {},
  businessTypeSelected: null,
  channelFilterSelected: null,
  handleChangeChannelFilter: vi.fn(),
  inActiveBusinesses: { loading: false, businesses: [{ id: 99 }] },
  citiesList: [{ id: 1, name: 'Miami' }],
  ...overrides
})

const ROUTE = '/connect/sales-channels'

const renderPage = (ctlOverrides = {}, Page = SalesChannels, { route = ROUTE, configFile = {} } = {}) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  return renderWithProviders(<Page isUseQuery />, {
    initialEntries: [route],
    wrapper: ({ children }) => (
      <ConfigFileContext.Provider value={[configFile, vi.fn()]}>{children}</ConfigFileContext.Provider>
    )
  })
}
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))

// jsdom answers matchMedia with `matches: false`: the split view and the table read (min|max)-width queries, so one is installed that
// evaluates them against a width (1440: the split mode, the panel sits beside the list)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent.trim())
const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) })

let restoreViewport
beforeEach(() => {
  restoreViewport = installViewport(1440)
  ctl.detailsProps = {}
  Object.keys(seen).forEach(key => { seen[key] = null })
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('SalesChannels: what it passes the controller', () => {
  it('mounts the POS list controller as sales_channel, with the kind for the UI', () => {
    renderPage()
    expect(seen.list).toMatchObject({
      asDashboard: true,
      isSearchByBusinessName: true,
      isSearchByBusinessEmail: true,
      isSearchByBusinessPhone: true,
      integrationType: 'sales_channel',
      kind: 'sales_channel',
      defaultActive: true,
      paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'pages' }
    })
  })

  it('PosMenu without a kind still sends pos', () => {
    renderPage({}, PosMenu)
    expect(seen.list.integrationType).toBe('pos')
    expect(seen.list.kind).toBeUndefined()
  })
})

describe('SalesChannels: header', () => {
  it('is called Sales Channels and says what it is for', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Sales channels' })).toBeInTheDocument()
    expect(screen.getByText('Connect each store to the marketplaces that sell it and send its menu to them.')).toBeInTheDocument()
    expect(screen.queryByText('POS & Menu Sync')).toBeNull()
  })

  it('keeps the split view width under sales-channels-panel', () => {
    renderPage()
    expect(seen.split.storageKey).toBe('sales-channels-panel')
  })
})

describe('SalesChannels: Learn', () => {
  // Learn fell to INTEGRATION_DESCRIPTION, which talks about connecting a POS
  it('opens the help about sales channels, not the one of POS', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Learn' }))
    const help = screen.getByRole('dialog', { name: 'Help' })
    expect(within(help).getByText('Sales channels')).toBeInTheDocument()
    expect(seen.help.data.description).toMatch(/^Open a store and connect it to the marketplaces that sell it/)
    expect(seen.help.data.description).toMatch(/Push the menu/)
    expect(seen.help.data.description).not.toMatch(/POS/)
    expect(seen.help.data.description).not.toMatch(/^Connect with any of our available integrations/)
    expect(seen.help.data.more_info).toBe('https://docs.ordering.co/docs/products/dashboard/help-community-ai-agents/')
  })
})

describe('SalesChannels: table', () => {
  it('has ID, Business, POS and Sales Channels, and no Status, with its own label', () => {
    renderPage()
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Sales channels'])
    expect(screen.getByRole('table', { name: 'Stores and their sales channels' })).toBeInTheDocument()
  })

  it('names the channels of a store and its POS, the POS taken from the nested link', () => {
    renderPage()
    const fast = rowOf('Fast Bite')
    expect(within(fast).getByText('Uber Eats')).toBeInTheDocument()
    expect(within(fast).getByText('Square')).toBeInTheDocument()
    // decoration only: the name is beside it
    expect(fast.querySelector('img[src="https://logo.example/uber.png"]')).toHaveAttribute('alt', '')
    expect(within(fast).queryByText('Not connected')).toBeNull()
  })

  it('a store without channels draws a hidden dash and says «Not connected» for a screen reader', () => {
    renderPage()
    const kcf = rowOf('KCF')
    const dashes = within(kcf).getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
    dashes.forEach(dash => expect(dash).toHaveAttribute('aria-hidden', 'true'))
    const spoken = within(kcf).getAllByText('Not connected')
    spoken.forEach(node => expect(node.classList.contains('odc-sr-only')).toBe(true))
  })

  it('a channel that is turned off says so', () => {
    renderPage()
    const pizza = rowOf('Pizza Hub')
    expect(within(pizza).getByText('Rappi')).toBeInTheDocument()
    expect(within(pizza).getByText('Turned off')).toBeInTheDocument()
    expect(within(rowOf('Fast Bite')).queryByText('Turned off')).toBeNull()
  })

  it('the column manager keeps ID and lets Business, POS and Sales Channels be hidden', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog', { name: 'Manage columns' })
    expect(within(dialog).getByRole('checkbox', { name: 'ID' })).toBeDisabled()
    for (const name of ['Business', 'POS', 'Sales channels']) {
      expect(within(dialog).getByRole('checkbox', { name })).toBeEnabled()
    }
    await user.click(within(dialog).getByRole('checkbox', { name: 'Business' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'POS' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Sales channels' }))
    expect(headers()).toEqual(['ID'])
    await user.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Sales channels'])
  })

  it('Inactive adds the Disabled reason with its reason', () => {
    renderPage({ selectedBusinessActiveState: false })
    expect(headers()).toEqual(['ID', 'Business', 'POS', 'Sales channels', 'Disabled reason'])
    expect(within(rowOf('Pizza Hub')).getByText('No orders in 30 days')).toBeInTheDocument()
  })

  // redesign SC-R1-3: no reason is the same hidden dash as an empty POS cell, not an empty cell
  it('Inactive draws a hidden dash when a store has no reason', () => {
    renderPage({ selectedBusinessActiveState: false })
    const cells = within(rowOf('KCF')).getAllByRole('cell')
    const reason = cells[cells.length - 1]
    expect(reason).toHaveTextContent('—')
    expect(within(reason).getByText('—')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SalesChannels: phone', () => {
  it('draws a card per store whose line names the channels, the POS and the city, with no status', () => {
    restoreViewport()
    restoreViewport = installViewport(390)
    renderPage()
    const list = screen.getByRole('list', { name: 'Stores and their sales channels' })
    const fast = within(list).getByRole('link', { name: 'Open Fast Bite' }).closest('li')
    expect(within(fast).getByText('Uber Eats · POS: Square · Miami')).toBeInTheDocument()
    expect(within(fast).queryByText('Connected')).toBeNull()
    // redesign SC-R1-2: a store on no channel says so
    expect(within(within(list).getByRole('link', { name: 'Open KCF' }).closest('li')).getByText('No sales channels · Miami')).toBeInTheDocument()
  })
})

describe('SalesChannels: store panel', () => {
  const openFastBite = async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(within(rowOf('Fast Bite')).getByText('Fast Bite'))
    return user
  }

  it('opening a row mounts the panel for sales channels', async () => {
    await openFastBite()
    expect(ctl.props.onBusinessRedirect).toHaveBeenCalledWith(7)
    expect(seen.details).toMatchObject({ businessId: 7, kind: 'sales_channel' })
    expect(screen.getByRole('heading', { level: 2, name: 'Fast Bite' })).toBeInTheDocument()
  })

  it('«Connected sales channels» has the Uber Eats card with Push menu, and not the POS', async () => {
    await openFastBite()
    const connected = screen.getByRole('region', { name: 'Connected sales channels' })
    const card = within(connected).getByRole('article', { name: 'Uber Eats' })
    expect(within(card).getByRole('button', { name: 'Push menu' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Sync menu' })).toBeNull()
    expect(within(connected).queryByRole('article', { name: 'Square' })).toBeNull()
  })

  it('«Other sales channels» lists Rappi with Contact us, not Install, and no setup call', async () => {
    await openFastBite()
    const other = screen.getByRole('region', { name: 'Other sales channels' })
    const contact = within(other).getByRole('link', { name: 'Contact us · Rappi' })
    expect(contact).toHaveAttribute('href', 'https://www.ordering.co/contact/')
    expect(contact).toHaveAttribute('target', '_blank')
    expect(within(other).queryByRole('button', { name: 'Install Rappi' })).toBeNull()
    expect(within(other).queryByText('Uber Eats')).toBeNull()
    expect(screen.queryByText('Book setup call')).toBeNull()
    expect(screen.queryByRole('link', { name: /Book setup call/ })).toBeNull()
  })

  it('a sales channel called Deliverect is a channel with its button, not a call', async () => {
    await openFastBite()
    const other = screen.getByRole('region', { name: 'Other sales channels' })
    const names = within(other).getAllByRole('listitem').map(item => item.querySelector('.psp-row-name')?.textContent)
    expect(names).toEqual(['Rappi', 'Deliverect'])
    expect(within(other).getByRole('button', { name: 'Install Deliverect' })).toBeInTheDocument()
    expect(within(other).queryByText('Checkmate')).toBeNull()
  })

  it('a store with no channel gets «Connect a sales channel»', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(within(rowOf('KCF')).getByText('KCF'))
    expect(screen.queryByRole('region', { name: 'Connected sales channels' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Connect a sales channel' })).getByRole('heading', { level: 3 })).toBeInTheDocument()
  })

  it('a failed list of channels says so with its own words', async () => {
    const user = userEvent.setup()
    renderPage({ integrationsList: { loading: false, error: 'boom', thirdPartyIntegrations: [] } })
    await user.click(within(rowOf('KCF')).getByText('KCF'))
    expect(screen.getByText("The sales channel list couldn't load.")).toBeInTheDocument()
    // redesign SC-R1-1: no «Connect a sales channel» heading over an empty list
    expect(screen.queryByRole('region', { name: 'Connect a sales channel' })).toBeNull()
  })

  it('a store on every channel has no «Other sales channels» heading over nothing', async () => {
    const user = userEvent.setup()
    renderPage({ integrationsList: { loading: false, error: null, thirdPartyIntegrations: [uberEats] } })
    await user.click(within(rowOf('Fast Bite')).getByText('Fast Bite'))
    expect(screen.getByRole('region', { name: 'Connected sales channels' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Other sales channels' })).toBeNull()
  })
})

// the Channel filter is sales_channel-only (connectKind), built from the sales channels already loaded for the table
// (integrationsList), and its choice is kept in ?channel=.
describe('SalesChannels: Channel filter', () => {
  it('shows the Channel pill with «All channels» first and the sales channels catalog', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(seen.list.salesChannelsFilterEnabled).toBe(true)
    const pill = screen.getByRole('button', { name: 'Channel' })
    await user.click(pill)
    const box = await screen.findByRole('dialog', { name: 'Channel' })
    expect(within(box).getAllByRole('option').map(option => option.textContent)).toEqual(['All channels', 'Uber Eats', 'Rappi', 'Deliverect'])
  })

  it('/connect/pos-menu (kind pos) never shows the Channel pill', () => {
    renderPage({}, PosMenu, { route: '/connect/pos-menu' })
    expect(seen.list.salesChannelsFilterEnabled).toBe(false)
    expect(screen.queryByRole('button', { name: 'Channel' })).toBeNull()
  })

  it('an empty sales channels catalog draws no Channel pill', () => {
    renderPage({ integrationsList: { loading: false, error: null, thirdPartyIntegrations: [] } }, SalesChannels, {})
    expect(screen.queryByRole('button', { name: 'Channel' })).toBeNull()
  })

  it('?channel= in the address starts the controller filtered by that channel, and the pill shows its name', () => {
    renderPage({ channelFilterSelected: 100 }, SalesChannels, { route: `${ROUTE}?channel=100` })
    expect(seen.list.defaultChannel).toBe(100)
    expect(screen.getByRole('button', { name: /^Channel\s*Uber Eats$/ })).toBeInTheDocument()
  })

  // the page-1 reset of the request itself is the controller's job (PosMenuBusinessList.salesChannelsFilter.test.jsx); here only
  // the UI's own contract is checked: the controller is told and the choice reaches the address
  it('picking a channel tells the controller and writes ?channel=', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Channel' }))
    const box = await screen.findByRole('dialog', { name: 'Channel' })
    await user.click(within(box).getByRole('option', { name: 'Rappi' }))
    expect(ctl.props.handleChangeChannelFilter).toHaveBeenCalledWith(101)
    expect(urlParams().channel).toBe('101')
  })

  it('picking «All channels» clears the filter and ?channel= from the address', async () => {
    const user = userEvent.setup()
    renderPage({ channelFilterSelected: 100 }, SalesChannels, { route: `${ROUTE}?channel=100` })
    await user.click(screen.getByRole('button', { name: /^Channel/ }))
    const box = await screen.findByRole('dialog', { name: 'Channel' })
    await user.click(within(box).getByRole('option', { name: 'All channels' }))
    expect(ctl.props.handleChangeChannelFilter).toHaveBeenCalledWith(null)
    expect(urlParams().channel).toBeUndefined()
  })

  it('a stale ?channel= (channel gone, or no sales channels left) keeps the pill so «All channels» can clear it', async () => {
    const user = userEvent.setup()
    renderPage(
      { channelFilterSelected: 999, integrationsList: { loading: false, error: null, thirdPartyIntegrations: [] } },
      SalesChannels,
      { route: `${ROUTE}?channel=999` }
    )
    await user.click(screen.getByRole('button', { name: /^Channel/ }))
    const box = await screen.findByRole('dialog', { name: 'Channel' })
    await user.click(within(box).getByRole('option', { name: 'All channels' }))
    expect(ctl.props.handleChangeChannelFilter).toHaveBeenCalledWith(null)
    expect(urlParams().channel).toBeUndefined()
  })
})
