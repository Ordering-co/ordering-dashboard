/* eslint-disable import/first */
// redesign ordering-website B3a (; D1, D2, D4, D6, D7): the sections editor of /my-products/ordering-website. Covered: the
// opt-in dispatch (without `layout` it is the legacy editor, with OW-05 fixed), the page header per route, the navigation (27 sections
// in 3 groups, `?section=` kept with the other parameters, disabled while loading), General (the site's fields with the theme mirror,
// the seven states of the custom domain, «Remove custom domain» only with Cloudflare), the save bar and the pure helpers of the
// drafts. The controller (B2) is a stand-in: its props are simulated; everything below it is the real thing, except the heavy legacy
// children the editor never mounts here.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory, useLocation } from 'react-router-dom'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({
  phone: false,
  collapsed: false,
  collapse: null,
  customDomainProps: null,
  history: null,
  sites: [],
  subdomain: 'orderingplus'
}))

const translate = (_key, text) => text

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }, { configurations: { subdomain: mockState.subdomain } }],
  useSite: () => [{ sites: mockState.sites }],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: (src) => src }],
  ExamineClick: ({ children }) => <>{children}</>,
  DragAndDrop: ({ children }) => <>{children}</>,
  OrderingWebsite: () => null
}))
vi.mock('../../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))
// The legacy children the editor does not mount in these cases (their own tests cover them)
vi.mock('../../../ContentForm', () => ({ ContentForm: () => null }))
vi.mock('../../../AdvancedSettings', () => ({ AdvancedSettings: () => null }))
vi.mock('../../../OrderingWidgets', () => ({ OrderingWidgets: () => null }))
vi.mock('../../../WhiteLabelCustomDomain', () => ({
  WhiteLabelCustomDomain: (props) => <div data-testid='wl-custom-domain' data-hide-title={String(!!props.hideTitle)}><button type='button' onClick={props.onClose}>Close wl stand-in</button></div>
}))
vi.mock('../../../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock', () => ({
  WhiteLabelCustomDomainBlock: (props) => <div data-testid='wl-domain-block'><button type='button' onClick={props.onRequestEdit}>Edit wl domain</button></div>
}))
vi.mock('../../../../Settings', () => ({ FilterSettings: () => null }))
// The custom domain form is the real controller's (its own tests); here it is a stand-in that shows what it was given
vi.mock('../../../CustomDomain', () => ({
  CustomDomain: (props) => {
    mockState.customDomainProps = props
    return <div data-testid='custom-domain'><button type='button' onClick={props.onClose}>Close stand-in</button></div>
  }
}))

import { requestRouteLeave } from '../../../../../utils/routeLeaveGuard'
import { LeaveGuardContext, useLeaveGuardHost } from '../../../../Shared/Product'
import { InfoShareContext } from '../../../../../contexts/InfoShareContext'
import { ProjectContext } from '../../../../../contexts/ProjectContext'
import { OrderingWebsiteUI } from '../../index'
import { buildSections } from '../sections'
import { countChanges, diffLeaves, setThemePath, updateObject } from '../themeDraft'

const theme = {
  ...defaultTheme,
  images: {
    preview: { marketplace: 'marketplace.png', franchise: 'franchise.png', singleStore: 'single.png' },
    myProducts: { orderingWebsite: 'ordering-website.png' }
  }
}

const SITE = { id: 7, code: 'website', type: 'web_marketplace_26', name: 'Marketplace Website', description: 'Your awesome website' }

const makeThemeValues = () => ({
  website_theme: { components: { type: 'marketplace', business_slug: '' } },
  images: { components: { logo: { components: { image: 'logo.jpg' } }, homepage_image_fullscreen: false } },
  theme_settings: { components: { style: { background_page: '#FFFFFF' }, values: { homepage_content: '', footer_content: '' } } },
  website_settings: { components: { values: { name: SITE.name, description: SITE.description } } }
})

const makeProps = (overrides = {}) => {
  const themeValues = makeThemeValues()
  return {
    layout: 'sections',
    orderingTheme: { loading: false, themes: [{ theme_id: 1, site_id: SITE.id }], error: null },
    themeValues,
    setThemeValues: vi.fn(),
    advancedValues: { my_products: { components: makeThemeValues() }, general: { components: { fonts: { primary: 'Inter' } } } },
    setAdvancedValues: vi.fn(),
    savedValues: { my_products: { components: makeThemeValues() }, general: { components: { fonts: { primary: 'Inter' } } } },
    savedSite: SITE,
    themesList: { loading: false, themes: [], error: null },
    site: SITE,
    setSite: vi.fn(),
    businessesList: { loading: false, businesses: [], error: null },
    franchisesList: { loading: false, franchises: [], error: null },
    handleChangeInput: vi.fn(),
    formState: { loading: false, changes: {}, error: null },
    handleUpdateSite: vi.fn(),
    handleUpdateSiteTheme: vi.fn(),
    handleSaveAll: vi.fn().mockResolvedValue({ ok: true }),
    discardChanges: vi.fn(),
    saving: false,
    appId: 'website',
    ...overrides
  }
}

const LocationProbe = () => {
  const location = useLocation()
  mockState.history = useHistory()
  return <output data-testid='location'>{`${location.pathname}${location.search}`}</output>
}

const tree = (props) => (
  <>
    <OrderingWebsiteUI {...props} />
    <LocationProbe />
  </>
)

const render = (props, { route = '/my-products/ordering-website', websiteProduct = 'web_marketplace_26' } = {}) => {
  const Wrapper = ({ children }) => (
    <ProjectContext.Provider value={[{ websiteProduct }, {}]}>
      <InfoShareContext.Provider value={[{ isCollapse: mockState.collapsed }, { handleMenuCollapse: mockState.collapse }]}>
        {children}
      </InfoShareContext.Provider>
    </ProjectContext.Provider>
  )
  const result = renderWithProviders(tree(props), { initialEntries: [route], theme, wrapper: Wrapper })
  // what the controller does when its state changes: the same editor with new props
  return { ...result, update: (next) => result.rerender(tree(next)) }
}

const sectionRows = () => [...document.querySelectorAll('button.odc-sectionnav-row[data-kind="section"]')]
const groupRows = () => [...document.querySelectorAll('button.odc-sectionnav-row[data-kind="group"]')]

beforeEach(() => {
  mockState.phone = false
  mockState.collapsed = false
  mockState.collapse = vi.fn()
  mockState.customDomainProps = null
  mockState.history = null
  mockState.sites = []
  mockState.subdomain = 'orderingplus'
})

describe('dispatch · the sections editor is opt-in', () => {
  it('without `layout` it is the legacy editor: «More settings for your» and the Basic / Advanced tabs, with the support link fixed (OW-05)', () => {
    render(makeProps({ layout: undefined }))
    expect(screen.getByRole('heading', { level: 2, name: /More settings for your/ })).toBeInTheDocument()
    expect(screen.getByText('Basic Settings')).toBeInTheDocument()
    expect(screen.getByText('Advanced settings')).toBeInTheDocument()
    expect(document.querySelector('a[href="https://www.ordering.co/support/"]')).not.toBeNull()
    // redesign tanda AB (C-2): the link reads «Contact support», not the raw URL
    expect(document.querySelector('a[href="https://www.ordering.co/support/"]')).toHaveTextContent(/^Contact support$/)
    expect(document.querySelector('.odc-ows')).toBeNull()
    // redesign tanda AB (C-2 review): a space between the sentence and the link (it read «here:Contact support»)
    expect(document.body.textContent).toContain('here: Contact support')
  })

  it('with `layout="sections"` the legacy editor is not drawn', () => {
    render(makeProps())
    expect(document.querySelector('.odc-ows')).not.toBeNull()
    expect(screen.queryByText('Basic Settings')).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: /More settings for your/ })).toBeNull()
  })
})

// tanda O row 6: a project without a subdomain opened www.undefined.com. Tandas AI and AJ (/965, decision 43)
// sent both support links to /support of the project subdomain; (main #481) makes it the Ordering.co support page for every
// project, so the links are the same with or without a subdomain, and nothing says «undefined».
describe('the support links, with or without a subdomain (row 6, decision 43, )', () => {
  // the legacy header and domain help are hover popups (hidden until hovered): found by text, not by role
  const helpLink = () => screen.getByText('customer support team')
  const noUndefined = () => {
    expect(document.body.textContent).not.toMatch(/undefined/i)
    expect([...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).join(' ')).not.toMatch(/undefined/i)
  }

  it.each(['orderingplus', undefined, '', '   '])('legacy editor (%j): «Contact support» and «customer support team» go to the Ordering.co support page', (subdomain) => {
    mockState.subdomain = subdomain
    render(makeProps({ layout: undefined }))
    expect(screen.getByText('Contact support')).toHaveAttribute('href', 'https://www.ordering.co/support/')
    expect(screen.getByText('Contact support')).toHaveAttribute('target', '_blank')
    expect(helpLink()).toHaveAttribute('href', 'https://www.ordering.co/support/')
    expect(helpLink()).toHaveAttribute('target', '_blank')
    noUndefined()
  })

  it.each(['orderingplus', undefined, ''])('sections editor (%j): the header link and the domain help go to the Ordering.co support page', (subdomain) => {
    mockState.subdomain = subdomain
    render(makeProps())
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'https://www.ordering.co/support/')
    expect(screen.getByRole('link', { name: 'customer support team' })).toHaveAttribute('href', 'https://www.ordering.co/support/')
    noUndefined()
  })
})

describe('header · per route (D2)', () => {
  it('on /my-products/ordering-website: one h1 «Ordering website», Learn, the fixed support link and Visit', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(makeProps())
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Ordering website')
    expect(screen.getByRole('button', { name: /Learn/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'https://www.ordering.co/support/')
    const visit = screen.getByRole('button', { name: 'Visit my website' })
    expect(visit).toBeEnabled()
    await user.click(visit)
    expect(open).toHaveBeenCalledWith('https://v26-demo.orderingplus.com', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })

  // the opener is PageHeader's `leading`, the first child of the lead block; the description link keeps its class
  it('with the side menu folded the «Open menu» button leads the page header and unfolds it; with it open there is none', async () => {
    const user = userEvent.setup()
    mockState.collapsed = true
    const { unmount } = render(makeProps())
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    expect(opener.closest('.odc-pagehead')).toHaveClass('odc-ows-head')
    await user.click(opener)
    expect(mockState.collapse).toHaveBeenCalledExactlyOnceWith(false)
    unmount()
    mockState.collapsed = false
    render(makeProps())
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it('«Visit my Website» is disabled without the website product', () => {
    render(makeProps(), { websiteProduct: null })
    expect(screen.getByRole('button', { name: 'Visit my website' })).toBeDisabled()
  })

  it('on /my-products/ordering-website-2: h1 «Ordering website 2», and no Visit, no Learn, no description', () => {
    render(makeProps(), { route: '/my-products/ordering-website-2' })
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Ordering website 2')
    expect(screen.queryByRole('button', { name: 'Visit my website' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Learn/ })).toBeNull()
    expect(screen.queryByText(/Use the advanced configurations/)).toBeNull()
  })
})

describe('navigation · sections and groups (D1)', () => {
  it('lists 27 sections in 3 groups; only the group of the current section starts open', async () => {
    const user = userEvent.setup()
    render(makeProps())
    expect(groupRows().map(row => row.textContent)).toEqual(['Website', 'Advanced settings', 'Integrations'])
    expect(groupRows().map(row => row.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false'])
    expect(sectionRows().map(row => row.textContent)).toEqual(['General', 'Layout', 'Images', 'Colors & content'])
    await user.click(groupRows()[1])
    await user.click(groupRows()[2])
    expect(sectionRows()).toHaveLength(27)
    expect(sectionRows().slice(-1)[0]).toHaveTextContent('Ordering Widgets')
  })

  it('pressing a section writes `?section=` and keeps the other parameters', async () => {
    const user = userEvent.setup()
    render(makeProps(), { route: '/my-products/ordering-website?section=images&tab=1' })
    expect(sectionRows().find(row => row.hasAttribute('data-current'))).toHaveTextContent('Images')
    await user.click(screen.getByRole('button', { name: 'General' }))
    const search = new URL(screen.getByTestId('location').textContent, 'https://x.test').searchParams
    expect(search.get('section')).toBe('general')
    expect(search.get('tab')).toBe('1')
    expect(screen.getByRole('heading', { level: 2, name: 'General' })).toBeInTheDocument()
  })

  it('an unknown section is General; an Advanced section names its group before the title', async () => {
    const { unmount } = render(makeProps(), { route: '/my-products/ordering-website?section=nope' })
    expect(screen.getByRole('heading', { level: 2, name: 'General' })).toBeInTheDocument()
    expect(document.querySelector('.odc-ows-eyebrow')).toBeNull()
    unmount()
    render(makeProps(), { route: '/my-products/ordering-website?section=advanced_images' })
    expect(screen.getByRole('heading', { level: 2, name: 'Images' })).toBeInTheDocument()
    expect(document.querySelector('.odc-ows-eyebrow')).toHaveTextContent('Advanced settings')
    // its group opens with it
    expect(groupRows().map(row => row.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false'])
  })

  it('on a phone the navigation is the selector, with the 27 sections', async () => {
    mockState.phone = true
    const user = userEvent.setup()
    render(makeProps())
    expect(groupRows()).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: /Website sections/ }))
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(27)
  })

  it('while the theme loads the sections are disabled and the content is a skeleton', async () => {
    const user = userEvent.setup()
    render(makeProps({ orderingTheme: { loading: true, themes: [], error: null } }))
    await user.click(groupRows()[1])
    await user.click(groupRows()[2])
    expect(sectionRows()).toHaveLength(27)
    expect(sectionRows().every(row => row.disabled)).toBe(true)
    expect(document.querySelectorAll('.odc-ows-skeleton .odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
  })

  it('a franchise or a forced site drops the sections their editor never had', () => {
    const labels = (options) => buildSections({ t: translate, ...options }).map(section => section.id)
    expect(labels({})).toHaveLength(27)
    expect(labels({ isFranchise: true })).not.toEqual(expect.arrayContaining(['business_listing', 'checkout', 'popup_order_types', 'order_tracking', 'widgets']))
    expect(labels({ forcedSiteId: 5 })).not.toEqual(expect.arrayContaining(['buttons', 'widgets']))
  })
})

describe('General · name and description (D6)', () => {
  it('typing the name sends it to the controller and mirrors it in the theme, without touching the theme in hand', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Z')
    expect(props.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'name', value: 'Marketplace WebsiteZ' } })
    const mirrored = props.setThemeValues.mock.calls.at(-1)[0]
    expect(mirrored.website_settings.components.values.name).toBe('Marketplace WebsiteZ')
    expect(props.themeValues.website_settings.components.values.name).toBe('Marketplace Website')
    expect(mirrored).not.toBe(props.themeValues)
  })

  it('the description does the same, with its label («Description», fixed «Decription»)', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props)
    await user.type(screen.getByRole('textbox', { name: 'Description' }), '!')
    expect(props.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'description', value: 'Your awesome website!' } })
    expect(props.setThemeValues.mock.calls.at(-1)[0].website_settings.components.values.description).toBe('Your awesome website!')
  })

  it('in the dashboard there is no mirror', async () => {
    const user = userEvent.setup()
    const props = makeProps({ isDashboard: true })
    render(props)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Z')
    expect(props.handleChangeInput).toHaveBeenCalled()
    expect(props.setThemeValues).not.toHaveBeenCalled()
  })

  it('the temporal domain is a link with its URL; without the website product there is none', () => {
    const { unmount } = render(makeProps())
    const link = screen.getByRole('link', { name: 'https://v26-demo.orderingplus.com' })
    expect(link).toHaveAttribute('href', 'https://v26-demo.orderingplus.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.querySelector('.odc-figure')).not.toBeNull()
    expect(screen.getByText('Temporary domain')).toBeInTheDocument() // tanda AG: «Temporal» → «Temporary»
    unmount()
    render(makeProps(), { websiteProduct: null })
    expect(screen.queryByText('Temporary domain')).toBeNull()
  })
})

describe('General · custom domain (D6, D7)', () => {
  const DOMAIN = 'www.mybrand.com'
  const ISSUED = 'Your domain is now added. Please verify the custom domain link above.'

  it.each([
    ['issued', 'ended', 'done', 'Active', ISSUED],
    ['pre-issued', undefined, 'progress', 'In progress', 'Process almost finish, please wait'],
    ['pending_validation', undefined, 'pending', 'Pending', 'A custom domain is being created, please wait'],
    ['void', 'pending', 'pending', 'Pending', 'A custom domain is being created, please wait'],
    ['error', undefined, 'cancel', 'Error', 'Custom domain can\'t be created, please try again with valid data'],
    ['revoked', undefined, 'cancel', 'Revoked', 'Warning: Custom domain is revoked'],
    ['cancelled', undefined, 'cancel', 'Cancelled', 'Custom domain is cancelled'],
    ['expired', undefined, 'cancel', 'Expired', 'Custom domain is expired']
  ])('%s (process %s) paints a %s status «%s» and its sentence', (sslStatus, process, family, label, sentence) => {
    render(makeProps({ site: { ...SITE, domain: DOMAIN, ssl_status: sslStatus, ssl_process_status: process } }))
    const status = document.querySelector('.odc-status')
    expect(status).toHaveAttribute('data-family', family)
    expect(status).toHaveTextContent(label)
    expect(screen.getByText(sentence)).toBeInTheDocument()
    const visit = screen.queryByRole('link', { name: `Visit ${DOMAIN}` })
    if (sslStatus === 'error') expect(visit).toBeNull()
    else expect(visit).toHaveAttribute('href', `https://${DOMAIN}`)
  })

  it.each([
    ['issued with its process still pending', { ssl_status: 'issued', ssl_process_status: 'pending' }],
    ['a state it does not know', { ssl_status: 'something_else' }]
  ])('%s paints no status and no sentence (as before)', (_, state) => {
    render(makeProps({ site: { ...SITE, domain: DOMAIN, ...state } }))
    expect(document.querySelector('.odc-status')).toBeNull()
    expect(screen.getByText(DOMAIN)).toBeInTheDocument()
  })

  it('without a domain the button asks for one and nothing else shows', () => {
    render(makeProps())
    expect(screen.getByRole('button', { name: 'Request custom domain' })).toBeInTheDocument()
    expect(document.querySelector('.odc-status')).toBeNull()
    expect(screen.getByText(/When creating a custom domain/)).toBeInTheDocument()
    expect(screen.getByText('www.customerwebsite.com')).toHaveClass('odc-figure')
    expect(screen.getByRole('link', { name: 'customer support team' })).toHaveAttribute('href', 'https://www.ordering.co/support/') // tanda AI (decision 43),
  })

  it('«Change custom domain» opens the form in a dialog named «Custom domain», with the props the legacy modal gave it', async () => {
    const user = userEvent.setup()
    const props = makeProps({ site: { ...SITE, domain: DOMAIN, ssl_status: 'issued' }, isFranchise: false })
    render(props)
    await user.click(screen.getByRole('button', { name: 'Change custom domain' }))
    const dialog = await screen.findByRole('dialog', { name: 'Custom domain' })
    expect(within(dialog).getByTestId('custom-domain')).toBeInTheDocument()
    expect(mockState.customDomainProps).toMatchObject({ site: props.site, setSite: props.setSite, disableDescriptionInfo: true, isFranchise: false })
    await user.click(within(dialog).getByRole('button', { name: 'Close stand-in' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Custom domain' })).toBeNull())
  })

  it('«Remove custom domain» is only there with Cloudflare, and disabled while the form is saving', () => {
    const { unmount } = render(makeProps({ site: { ...SITE, domain: DOMAIN, ssl_status: 'issued' } }))
    expect(screen.queryByRole('button', { name: 'Remove custom domain' })).toBeNull()
    unmount()
    const second = render(makeProps({ site: { ...SITE, domain: DOMAIN, deployment_provider: 'cloudflare' } }))
    expect(screen.getByRole('button', { name: 'Remove custom domain' })).toBeEnabled()
    second.unmount()
    render(makeProps({ site: { ...SITE, domain: DOMAIN, deployment_provider: 'cloudflare' }, formState: { loading: true, changes: {}, error: null } }))
    expect(screen.getByRole('button', { name: 'Remove custom domain' })).toBeDisabled()
  })

  it('«Remove custom domain» asks first; Cancel removes nothing and the confirmation sends `{ domain: null }`', async () => {
    const user = userEvent.setup()
    const props = makeProps({ site: { ...SITE, domain: DOMAIN, deployment_provider: 'cloudflare' } })
    render(props)
    await user.click(screen.getByRole('button', { name: 'Remove custom domain' }))
    let dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Remove custom domain?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Are you sure you want to remove this custom domain?')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.handleUpdateSite).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Remove custom domain' }))
    dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove custom domain' }))
    expect(props.handleUpdateSite).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateSite).toHaveBeenCalledWith({ domain: null })
  })

  // redesign ordering-website review R1-01
  it('after removing the domain the focus goes to the custom domain button that stays, not to <body>', async () => {
    const user = userEvent.setup()
    const props = makeProps({ site: { ...SITE, domain: DOMAIN, deployment_provider: 'cloudflare' } })
    const { update } = render(props)
    props.handleUpdateSite.mockImplementation(async () => {
      update({ ...props, site: { ...SITE, domain: null } })
    })
    await user.click(screen.getByRole('button', { name: 'Remove custom domain' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove custom domain' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request custom domain' })).toHaveFocus())
  })
})

describe('save bar · one for the whole editor (D4)', () => {
  const bar = () => screen.queryByRole('group', { name: 'Save changes' })

  it('is hidden without changes', () => {
    render(makeProps())
    expect(bar()).toBeNull()
  })

  it('a changed name says «1 unsaved change» and names «General»', () => {
    render(makeProps({ formState: { loading: false, changes: { name: 'New name' }, error: null } }))
    expect(within(bar()).getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(bar()).getByText(/General/)).toBeInTheDocument()
  })

  it('counts every pending change and names each section once, in the order of the navigation', () => {
    const themeValues = makeThemeValues()
    themeValues.theme_settings.components.style.background_page = '#000000'
    themeValues.images.components.logo.components.image = 'other.jpg'
    themeValues.website_theme.components.type = 'single_store'
    render(makeProps({ themeValues, formState: { loading: false, changes: { name: 'N', description: 'D', header: 'h.jpg' }, error: null } }))
    expect(within(bar()).getByText('5 unsaved changes')).toBeInTheDocument()
    expect(bar().querySelector('.odc-savebar-names')).toHaveTextContent('General, Layout, Images +1')
  })

  it('Save calls the controller and then says «Saved»', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: { loading: false, changes: { name: 'New name' }, error: null } })
    const { update } = render(props)
    // the controller stores the changes: what is pending is gone when its promise settles
    props.handleSaveAll.mockImplementation(async () => {
      update({ ...props, formState: { loading: false, changes: {}, error: null } })
      return { ok: true }
    })
    await user.click(within(bar()).getByRole('button', { name: 'Save changes' }))
    expect(props.handleSaveAll).toHaveBeenCalledTimes(1)
    expect(await within(bar()).findByRole('status')).toHaveTextContent('Saved')
  })

  it('a failed Save keeps the bar and says why, with the message of the API', async () => {
    const user = userEvent.setup()
    const props = makeProps({
      formState: { loading: false, changes: { name: 'New name' }, error: null },
      handleSaveAll: vi.fn().mockResolvedValue({ ok: false, error: 'Site not found' })
    })
    render(props)
    await user.click(within(bar()).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn\'t save your changes. Site not found')
    expect(within(bar()).getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('a Save that throws says so too', async () => {
    const user = userEvent.setup()
    const props = makeProps({
      formState: { loading: false, changes: { name: 'New name' }, error: null },
      handleSaveAll: vi.fn().mockRejectedValue(new Error('Network down'))
    })
    render(props)
    await user.click(within(bar()).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })

  it('Discard calls the controller and remounts the open section', async () => {
    const user = userEvent.setup()
    const props = makeProps({ formState: { loading: false, changes: { name: 'New name' }, error: null } })
    render(props)
    const before = document.querySelector('.odc-ows-content')
    await user.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.odc-ows-content')).not.toBe(before)
  })

  it('shows the busy state while the controller saves', () => {
    render(makeProps({ saving: true, formState: { loading: false, changes: { name: 'New name' }, error: null } }))
    expect(within(bar()).getByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('leaving the editor with unsaved changes (D-81, part A)', () => {
  // redesign D-81 (owner, 2026-10-19): a way out of /my-products/ordering-website with a dirty draft asks «Keep editing ·
  // Save and continue · Discard». The draft is ONE for all sections, so `?section=` never asks.
  const dirty = (overrides = {}) => makeProps({ formState: { loading: false, changes: { name: 'New name' }, error: null }, ...overrides })
  const OTHER = '/my-products/dashboard'
  const dialog = () => screen.queryByRole('alertdialog')
  const location = () => screen.getByTestId('location').textContent
  const leaveTo = (path) => act(() => mockState.history.push(path))

  it('a route change to another pathname with unsaved changes asks, and the address does not move', async () => {
    render(dirty())
    leaveTo(OTHER)
    const asking = await screen.findByRole('alertdialog')
    expect(within(asking).getByText('Save your changes?')).toBeInTheDocument()
    expect(within(asking).getByText(/You have unsaved changes in Ordering website\./)).toBeInTheDocument()
    expect(within(asking).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    expect(within(asking).getByRole('button', { name: 'Save and continue' })).toBeInTheDocument()
    expect(within(asking).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(location()).toBe('/my-products/ordering-website')
  })

  it('Keep editing closes the question and stays: nothing saved, nothing discarded', async () => {
    const user = userEvent.setup()
    const props = dirty()
    render(props)
    leaveTo(OTHER)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(dialog()).toBeNull())
    expect(location()).toBe('/my-products/ordering-website')
    expect(props.handleSaveAll).not.toHaveBeenCalled()
    expect(props.discardChanges).not.toHaveBeenCalled()
  })

  it('Discard drops the draft and leaves', async () => {
    const user = userEvent.setup()
    const props = dirty()
    render(props)
    leaveTo(OTHER)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
    expect(props.handleSaveAll).not.toHaveBeenCalled()
    expect(location()).toBe(OTHER)
  })

  it('Save and continue saves and, when it worked, leaves', async () => {
    const user = userEvent.setup()
    const props = dirty()
    render(props)
    leaveTo(OTHER)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(location()).toBe(OTHER))
    expect(props.handleSaveAll).toHaveBeenCalledTimes(1)
    expect(props.discardChanges).not.toHaveBeenCalled()
  })

  it('a Save that fails keeps the person on the page, with the reason in the save bar', async () => {
    const user = userEvent.setup()
    const props = dirty({ handleSaveAll: vi.fn().mockResolvedValue({ ok: false, error: 'Site not found' }) })
    render(props)
    leaveTo(OTHER)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(dialog()).toBeNull())
    expect(props.handleSaveAll).toHaveBeenCalledTimes(1)
    expect(location()).toBe('/my-products/ordering-website')
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn\'t save your changes. Site not found')
    expect(props.discardChanges).not.toHaveBeenCalled()
  })

  it('a Save that throws keeps the person on the page too', async () => {
    const user = userEvent.setup()
    const props = dirty({ handleSaveAll: vi.fn().mockRejectedValue(new Error('Network down')) })
    render(props)
    leaveTo(OTHER)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(dialog()).toBeNull())
    expect(location()).toBe('/my-products/ordering-website')
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })

  it('changing `?section=` never asks, from the navigation or from the address', async () => {
    const user = userEvent.setup()
    render(dirty(), { route: '/my-products/ordering-website?section=images' })
    await user.click(screen.getByRole('button', { name: 'General' }))
    expect(location()).toBe('/my-products/ordering-website?section=general')
    leaveTo('/my-products/ordering-website?section=colors')
    expect(location()).toBe('/my-products/ordering-website?section=colors')
    expect(dialog()).toBeNull()
  })

  it('without unsaved changes a route change goes at once, with no question', () => {
    render(makeProps())
    leaveTo(OTHER)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER)
  })

  it('⌘K and Mia ask first: the navigation runs only after Discard', async () => {
    const user = userEvent.setup()
    render(dirty())
    const go = vi.fn(() => mockState.history.push(OTHER))
    act(() => requestRouteLeave(go))
    expect(go).not.toHaveBeenCalled()
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(go).toHaveBeenCalledTimes(1)
    expect(location()).toBe(OTHER)
  })

  it('⌘K with Keep editing leaves everything where it was', async () => {
    const user = userEvent.setup()
    render(dirty())
    const go = vi.fn()
    act(() => requestRouteLeave(go))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    expect(go).not.toHaveBeenCalled()
    expect(location()).toBe('/my-products/ordering-website')
  })

  it('⌘K from a clean editor goes at once', () => {
    render(makeProps())
    const go = vi.fn()
    act(() => requestRouteLeave(go))
    expect(go).toHaveBeenCalledTimes(1)
    expect(dialog()).toBeNull()
  })

  it('closing the tab is guarded (beforeunload) only while the draft is dirty', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const props = makeProps()
    const { update, unmount } = render(props)
    const registered = () => add.mock.calls.filter(([type]) => type === 'beforeunload').length
    expect(registered()).toBe(0)
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    update(dirty())
    expect(registered()).toBe(1)
    const held = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(held)
    expect(held.defaultPrevented).toBe(true)
    update(props)
    const released = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(released)
    expect(released.defaultPrevented).toBe(false)
    unmount()
    add.mockRestore()
  })
})

describe('themeDraft · the pure helpers', () => {
  // redesign ordering-website review R1-02
  it('countChanges: a site field typed back to its saved value is no change', () => {
    const sections = buildSections({ t: translate })
    const base = { themeValues: {}, savedThemeValues: {}, advancedValues: {}, savedValues: {}, sections }
    expect(countChanges({ ...base, siteChanges: { name: 'Marketplace Website' }, savedSite: SITE }).count).toBe(0)
    expect(countChanges({ ...base, siteChanges: { name: 'Other' }, savedSite: SITE }).count).toBe(1)
  })

  // redesign ordering-website review R1-06
  it('buildSections: no Layout where the legacy editor drew no «Website Theme» (franchise, forced site)', () => {
    expect(buildSections({ t: translate }).map(section => section.id)).toContain('layout')
    expect(buildSections({ t: translate, isFranchise: true }).map(section => section.id)).not.toContain('layout')
    expect(buildSections({ t: translate, forcedSiteId: 9 }).map(section => section.id)).not.toContain('layout')
  })

  it('updateObject writes at a dotted path, in place, as the legacy editor did', () => {
    const object = { a: { b: { c: 1 } } }
    updateObject(object, 2, 'a.b.c')
    expect(object.a.b.c).toBe(2)
  })

  it('setThemePath returns a copy with [section, components, block] changed', () => {
    const themeValues = makeThemeValues()
    const next = setThemePath(themeValues, 'theme_settings', 'style.background_page', '#123456')
    expect(next.theme_settings.components.style.background_page).toBe('#123456')
    expect(themeValues.theme_settings.components.style.background_page).toBe('#FFFFFF')
    expect(next).not.toBe(themeValues)
  })

  it('diffLeaves lists the leaves that differ: objects walked, arrays and values whole, undefined = absent', () => {
    expect(diffLeaves({ a: 1, b: { c: 2, d: [1, 2] }, e: undefined }, { a: 1, b: { c: 3, d: [1, 2] } })).toEqual(['b.c'])
    expect(diffLeaves({ list: [1, 2, 3] }, { list: [1, 2] })).toEqual(['list'])
    expect(diffLeaves({ x: { y: 1 } }, {})).toEqual(['x.y'])
    expect(diffLeaves({}, { x: { y: 1, z: null } })).toEqual(['x.y', 'x.z'])
    expect(diffLeaves({ x: {} }, {})).toEqual([])
    expect(diffLeaves({ a: undefined }, {})).toEqual([])
    expect(diffLeaves({ a: { b: 1 } }, { a: 'text' })).toEqual(['a'])
    expect(diffLeaves({ same: { deep: [{ k: 1 }] } }, { same: { deep: [{ k: 1 }] } })).toEqual([])
  })

  describe('countChanges', () => {
    const sections = buildSections({ t: translate })
    const base = () => ({
      themeValues: makeThemeValues(),
      savedThemeValues: makeThemeValues(),
      advancedValues: { my_products: { components: makeThemeValues() }, general: { fonts: 'Inter' } },
      savedValues: { my_products: { components: makeThemeValues() }, general: { fonts: 'Inter' } },
      siteChanges: {},
      sections
    })

    it('counts nothing when nothing changed', () => {
      expect(countChanges(base())).toMatchObject({ count: 0, names: [] })
    })

    it('ignores the mirror `website_settings.*` of the theme', () => {
      const input = base()
      input.themeValues.website_settings.components.values.name = 'Other'
      expect(countChanges(input).count).toBe(0)
    })

    it('ignores `my_products.*` of Advanced (it is the theme, counted once) and `header` of the site (the controller adds it)', () => {
      const input = base()
      input.advancedValues.my_products.components.images.components.homepage_image_fullscreen = true
      input.siteChanges = { header: 'logo.jpg' }
      expect(countChanges(input).count).toBe(0)
    })

    it('counts the rest of Advanced, the theme and the site, and names the sections of the ones it can place', () => {
      const input = base()
      input.advancedValues.general.fonts = 'Roboto'
      input.themeValues.theme_settings.components.values.footer_content = '<p>x</p>'
      input.siteChanges = { name: 'N', logo: 'l.jpg', header: 'h.jpg' }
      expect(countChanges(input)).toMatchObject({ count: 4, names: ['General', 'Images', 'Colors & content'] })
    })

    it('has nothing to compare with before the saved values arrive', () => {
      expect(countChanges({ ...base(), savedThemeValues: undefined, savedValues: undefined, siteChanges: { domain: null } }))
        .toMatchObject({ count: 1, names: ['General'] })
    })
  })
})

// redesign J5 row 52 (ordering-website P-OW3, ): the franchise website on the sections editor. What its legacy editor had and
// the sections editor did not: the title, the site picker (with the leave question), the texts of General and the site's own
// temporal domain (FW-02).
describe('franchise website (J5 row 52)', () => {
  const FRANCHISE = { id: 30, code: 'web_franchises_x', type: 'franchiseweb', name: 'Franchise A', temporal_domain: 'franchise-a.tmp.example.com' }
  const OTHER_SITE = { id: 31, code: 'web_franchises_2', type: 'franchiseweb', name: 'Franchise B' }
  const franchiseProps = (overrides = {}) => makeProps({
    isFranchise: true,
    appId: FRANCHISE.code,
    site: FRANCHISE,
    savedSite: FRANCHISE,
    setAppIdState: vi.fn(),
    ...overrides
  })
  const ROUTE = { route: '/my-products/franchises-website', websiteProduct: 'web_franchises_x' }

  it('is titled «Franchise website» and General speaks of the franchise site, with its default domain', () => {
    render(franchiseProps(), ROUTE)
    expect(screen.getByRole('heading', { level: 1, name: 'Franchise website' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'Source demo franchise website')
    expect(screen.getByText('Default domain')).toBeInTheDocument()
    expect(screen.queryByText('Temporary domain')).toBeNull()
  })

  it('draws no site picker with a single franchise site', () => {
    mockState.sites = [FRANCHISE, SITE]
    render(franchiseProps(), ROUTE)
    expect(screen.queryByRole('button', { name: /Site: / })).toBeNull()
  })

  it('with two or more franchise sites, the picker names the site and opens another one at once when nothing is pending', async () => {
    mockState.sites = [FRANCHISE, OTHER_SITE, SITE]
    const props = franchiseProps()
    render(props, ROUTE)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Site: Franchise A' }))
    expect((await screen.findAllByRole('menuitemradio')).map(item => item.textContent)).toEqual(['Franchise A', 'Franchise B'])
    await user.click(await screen.findByRole('menuitemradio', { name: 'Franchise B' }))
    expect(props.setAppIdState).toHaveBeenCalledWith('web_franchises_2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('with unsaved changes, picking another site asks first; Discard opens it, Keep editing stays', async () => {
    mockState.sites = [FRANCHISE, OTHER_SITE]
    const props = franchiseProps({ formState: { loading: false, changes: { name: 'New name' }, error: null } })
    render(props, ROUTE)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Site: Franchise A' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Franchise B' }))
    const asking = await screen.findByRole('alertdialog')
    expect(within(asking).getByText(/You have unsaved changes in Franchise website\./)).toBeInTheDocument()
    await user.click(within(asking).getByRole('button', { name: 'Keep editing' }))
    expect(props.setAppIdState).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Site: Franchise A' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Franchise B' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
    expect(props.setAppIdState).toHaveBeenCalledWith('web_franchises_2')
  })
})

// redesign J5 row 52 (ordering-website P-OW3, ): the store's and the brand's white label (forcedSiteId) mount the sections
// editor inside a Stores panel. Embedded: no page header, the navigation is the selector, the section is local state (?section= is the
// Stores panel's own parameter), the draft asks through the panel's host, and the custom domain is the white-label one (SSL gate).
describe('white label, embedded in a Stores panel (J5 row 52)', () => {
  const WL_SITE = { id: 40, code: 'store_x_web', type: 'web_white_label', name: 'Store X Web' }
  const wlProps = (overrides = {}) => makeProps({ forcedSiteId: WL_SITE.id, appId: WL_SITE.code, site: WL_SITE, savedSite: WL_SITE, ...overrides })
  const STORE_ROUTE = { route: '/stores/list?id=12&section=white_label' }
  const HostProbe = ({ children }) => {
    const leave = useLeaveGuardHost()
    mockState.host = leave
    return <LeaveGuardContext.Provider value={leave.context}>{children}</LeaveGuardContext.Provider>
  }

  it('draws no page header and no h1, and its navigation is the selector', async () => {
    render(wlProps(), STORE_ROUTE)
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(groupRows()).toHaveLength(0)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Website sections/ }))
    expect((await screen.findAllByRole('menuitemradio')).length).toBeGreaterThan(0)
  })

  it('changes section without touching the address (the Stores panel owns ?section=)', async () => {
    render(wlProps(), STORE_ROUTE)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Website sections/ }))
    await user.click((await screen.findAllByRole('menuitemradio', { name: 'Images' }))[0]) // the Website one; Advanced has its own
    expect(screen.getByRole('heading', { level: 2, name: 'Images' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/stores/list?id=12&section=white_label')
  })

  it('registers its draft with the host around it, so the panel asks before dropping it', () => {
    const Wrapper = ({ children }) => (
      <ProjectContext.Provider value={[{ websiteProduct: 'web_marketplace_26' }, {}]}>
        <InfoShareContext.Provider value={[{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]}>
          <HostProbe>{children}</HostProbe>
        </InfoShareContext.Provider>
      </ProjectContext.Provider>
    )
    renderWithProviders(tree(wlProps({ formState: { loading: false, changes: { name: 'New name' }, error: null } })), { initialEntries: [STORE_ROUTE.route], theme, wrapper: Wrapper })
    expect(mockState.host.isDirty()).toBe(true)
  })

  it('a route change with unsaved changes is the host\'s to ask: the editor draws no dialog of its own', async () => {
    render(wlProps({ formState: { loading: false, changes: { name: 'New name' }, error: null } }), STORE_ROUTE)
    act(() => { mockState.history.push('/orders') })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('uses the white-label custom domain block and form (SSL gate), without a second title', async () => {
    render(wlProps(), STORE_ROUTE)
    expect(screen.getByTestId('wl-domain-block')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request custom domain' })).toBeNull()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit wl domain' }))
    const form = await screen.findByTestId('wl-custom-domain')
    expect(form).toHaveAttribute('data-hide-title', 'true')
    expect(mockState.customDomainProps).toBeNull()
  })
})

// a site that did not load was drawn as an empty site (Name focused but not accepting text, no save bar, no notice).
describe('a site that does not load', () => {
  const failed = (overrides = {}) => makeProps({
    orderingTheme: { loading: false, themes: [], error: ['Internal server error'] },
    site: null,
    savedSite: null,
    savedValues: null,
    themeValues: {},
    advancedValues: {},
    reloadSite: vi.fn(),
    ...overrides
  })

  it.each([
    ['/my-products/ordering-website'],
    ['/my-products/ordering-website-2']
  ])('%s says it could not load the website, offers Retry and draws no form', async (route) => {
    const props = failed()
    render(props, { route })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load your website.")
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    expect(document.querySelector('.odc-ows-content')).toBeNull()
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(props.reloadSite).toHaveBeenCalledOnce()
  })

  it('the page header stays, so the person still knows where they are', () => {
    render(failed())
    expect(screen.getByRole('heading', { level: 1, name: 'Ordering website' })).toBeInTheDocument()
  })

  it('while it loads again it shows the skeleton, not the error; and when it loads, the form', () => {
    const props = failed()
    const { update } = render(props)
    update({ ...props, orderingTheme: { loading: true, themes: [], error: ['Internal server error'] } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.querySelector('.odc-ows-skeleton')).not.toBeNull()
    update(makeProps())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeInTheDocument()
  })

  it('a stale error with the theme already loaded does not hide the form', () => {
    render(makeProps({ orderingTheme: { loading: false, themes: [{ theme_id: 1, site_id: SITE.id }], error: ['old'] } }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeInTheDocument()
  })

  it('the white label embedded in a Stores panel gets the same state', async () => {
    const props = failed({ forcedSiteId: 12 })
    render(props, { route: '/stores?id=3' })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your website.")
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.reloadSite).toHaveBeenCalledOnce()
  })
})
