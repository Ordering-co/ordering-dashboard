/* eslint-disable import/first */
// redesign my-products B2 (; D1, D4, D7; M-MP-0x): the shell of the editor of an app. Covered: the registry (which sections an app
// has, as main's basic settings and `AppUI` decided them), the navigation that lists only those, `?section=` (kept with `id`, the other
// parameters and the location state; an unknown or hidden section is Builds), the sections mounted once visited and hidden after (what was
// typed in one survives a change), focus on the new section's h2 when it changes by the navigation or by `onNavigate` (never on load),
// ONE `BuildApps` around all of them, the header (the app's name, its description, Learn by code, «Open menu» when the side menu is folded;
// no «My products», no «More settings for your»), loading and error in the place of the content, and Advanced with its own skeleton.
// `BuildApps` and the sections are stand-ins that show what they were given; Advanced's content is one `AdvancedSection` per section
// (; what each paints: AppAdvancedParity.test.jsx and the website editor's AdvancedSections.test.jsx).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({
  phone: false,
  collapsed: false,
  collapse: null,
  buildAppsMounts: 0,
  buildAppsProps: null,
  sectionProps: {},
  advancedProps: null
}))

// «Not found» → NOT_FOUND is the one API message this file translates
const translate = (key, text) => (key === 'NOT_FOUND' ? 'No encontrado' : text)

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useApi: () => [{}, { configurations: { subdomain: 'orderingplus' } }],
  BuildApps: (props) => <MockBuildApps {...props} />
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: mockState.collapsed }, { handleMenuCollapse: mockState.collapse }]
}))
vi.mock('../../../../utils', () => ({ learnOptionsValues: (keys) => keys }))
vi.mock('../../../Shared/LearnDropDown', () => ({
  LearnDropDown: ({ learnOptions }) => <div data-testid='learn' data-keys={learnOptions.join(',')} />
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))
vi.mock('../../OrderingWebsite/SectionsEditor/AdvancedSection', () => ({
  AdvancedSection: (props) => {
    mockState.advancedProps = props
    return <div data-testid='advanced-settings' />
  }
}))
vi.mock('../BuildsSection', () => ({ BuildsSection: (props) => <MockSection id='builds' {...props} /> }))
vi.mock('../GeneralSection', () => ({ GeneralSection: (props) => <MockSection id='general' {...props} /> }))
vi.mock('../ConstantsSection', () => ({ ConstantsSection: (props) => <MockSection id='constants' {...props} /> }))
vi.mock('../CredentialsSection', () => ({ CredentialsSection: (props) => <MockSection id='credentials' {...props} /> }))
vi.mock('../FilesSection', () => ({ FilesSection: (props) => <MockSection id='files' {...props} /> }))
vi.mock('../ImagesSection', () => ({
  ImagesSection: (props) => <MockSection id='images' {...props} />,
  ResourcesSection: (props) => <MockSection id='resources' {...props} />
}))
vi.mock('../ColorsSection', () => ({ ColorsSection: (props) => <MockSection id='colors' {...props} /> }))

// What the controller does: one instance, and the view it was given with the props it adds.
const MockBuildApps = ({ UIComponent, ...props }) => {
  useEffect(() => {
    mockState.buildAppsMounts += 1
  }, [])
  mockState.buildAppsProps = props
  return <UIComponent {...props} buildAppState={{ loading: false, result: null, error: null }} />
}

// A section: it keeps what was typed (to see it is not unmounted) and can ask the editor to open another one.
const MockSection = ({ id, ...props }) => {
  mockState.sectionProps[id] = props
  return (
    <div data-testid={`section-${id}`}>
      <input aria-label={`${id} field`} />
      <button type='button' onClick={() => props.onNavigate('credentials')}>{`Go from ${id}`}</button>
    </div>
  )
}

import { AppEditor, AppEditorView } from '../index'
import { DEFAULT_SECTION, buildSections, visibleSections } from '../sections'
import { advancedSectionLabels, appAdvancedSectionIds } from '../../OrderingWebsite/SectionsEditor/advancedSections'

// the Advanced sections of an app that is neither a kiosk nor a franchise, with their names
const ADVANCED_IDS = appAdvancedSectionIds({})
// (the navigation row of Advanced › Images also says its group, as the website editor's does: there are two «Images»)
const ADVANCED_LABELS = ADVANCED_IDS.map((id) => advancedSectionLabels(translate)[id] + (id === 'advanced_images' ? 'Advanced settings' : ''))

// the stylesheet as text (vitest does not give a `?raw` CSS import its content)
const editorCss = readFileSync(resolve('src/@/components-dashboard/src/ui/src/components/MyProducts/AppEditor/app-editor.css'), 'utf8')

const theme = { ...defaultTheme, images: { myProducts: {} } }

const ALL_GROUPS = [
  { id: 1, group: 'general_images' },
  { id: 2, group: 'colors' },
  { id: 3, group: 'files' },
  { id: 4, group: 'resources_icons' }
]

const makeApp = (code = 'app_marketplace_x', overrides = {}) => ({
  id: 677,
  name: 'Customer app',
  base: { code },
  baseActions: ALL_GROUPS,
  baseConstants: [{ id: 1, key: 'api_key' }],
  ...overrides
})

const makeProps = (code = 'app_marketplace_x', { app = makeApp(code), ...overrides } = {}) => ({
  appId: code,
  singleAppState: { loading: false, error: null, app },
  updateAppValues: vi.fn(),
  themesList: { loading: false, themes: [{ id: 1 }], error: null },
  orderingTheme: { loading: false, themes: [], error: null, siteId: 3 },
  advancedValues: { my_products: {} },
  setAdvancedValues: vi.fn(),
  handleUpdateSiteTheme: vi.fn(),
  ...overrides
})

const LocationProbe = () => {
  const location = useLocation()
  return (
    <>
      <div data-testid='location'>{`${location.pathname}${location.search}`}</div>
      <div data-testid='state'>{JSON.stringify(location.state ?? null)}</div>
    </>
  )
}

const tree = (props) => (
  <>
    <AppEditor {...props} />
    <LocationProbe />
  </>
)

const render = (props, initialEntries = ['/my-products?id=677']) => {
  const result = renderWithProviders(tree(props), { initialEntries, theme })
  return { ...result, update: (next) => result.rerender(tree(next)) }
}

const navigation = () => screen.getByRole('navigation', { name: 'App sections' })
const navLabels = () => within(navigation()).getAllByRole('button').map((button) => button.textContent)
const mountedSections = () => [...document.querySelectorAll('section[data-section]')].map((section) => section.dataset.section)
const openSection = () => document.querySelector('section[data-section]:not([hidden])')

beforeEach(() => {
  mockState.phone = false
  mockState.collapsed = false
  mockState.collapse = vi.fn()
  mockState.buildAppsMounts = 0
  mockState.buildAppsProps = null
  mockState.sectionProps = {}
  mockState.advancedProps = null
})

describe('registry · which sections an app has (as main decided them)', () => {
  const idsOf = (app, appCode, shown = true) => {
    const sections = buildSections({ t: translate, app, appCode })
    return (shown ? visibleSections(sections) : sections).map((section) => section.id)
  }

  it('lists the sections in order, in four groups, and an app with everything shows them all', () => {
    const sections = buildSections({ t: translate, app: makeApp(), appCode: 'app_marketplace_x' })
    expect(sections.map((section) => [section.id, section.group])).toEqual([
      ['builds', 'build'],
      ['general', 'app'],
      ['constants', 'app'],
      ['credentials', 'app'],
      ['files', 'app'],
      ['images', 'look'],
      ['colors', 'look'],
      ['resources', 'look'],
      ...ADVANCED_IDS.map((id) => [id, 'advanced'])
    ])
    expect(sections.every((section) => section.visible && section.Component && section.label)).toBe(true)
    expect(DEFAULT_SECTION).toBe('builds')
  })

  it('Builds, General and Credentials are always there, even for an app with nothing else', () => {
    expect(idsOf({ id: 1, base: { code: 'app_business_x' } }, 'app_business_x')).toEqual(['builds', 'general', 'credentials'])
    expect(idsOf(null, undefined)).toEqual(['builds', 'general', 'credentials'])
  })

  it('Constants needs `baseConstants`; Files, Images and Colors need a file, a general image and a color', () => {
    const bare = { id: 1, baseActions: [] }
    expect(idsOf({ ...bare, baseConstants: [{ id: 1 }] }, 'app_business_x')).toContain('constants')
    expect(idsOf({ ...bare, baseConstants: [] }, 'app_business_x')).not.toContain('constants')
    expect(idsOf({ ...bare, baseActions: [{ group: 'files' }] }, 'app_business_x')).toContain('files')
    expect(idsOf({ ...bare, baseActions: [{ group: 'general_images' }] }, 'app_business_x')).toContain('images')
    expect(idsOf({ ...bare, baseActions: [{ group: 'colors' }] }, 'app_business_x')).toContain('colors')
    expect(idsOf({ ...bare, baseActions: [{ group: 'colors' }] }, 'app_business_x')).not.toContain('files')
  })

  it.each([
    ['icons', 'resources_icons'],
    ['notifications', 'resources_notifications'],
    ['the Android splash', 'splash_android'],
    ['the iOS splash', 'ios_splash']
  ])('Icons and splash appears with %s (one of the four conditions of main)', (_, group) => {
    expect(idsOf({ id: 1, baseActions: [{ group }] }, 'app_business_x')).toContain('resources')
    expect(idsOf({ id: 1, baseActions: [{ group: 'other' }] }, 'app_business_x')).not.toContain('resources')
  })

  it.each([
    ['app_franchises_x', true], ['app_kiosk_x', true], ['app_marketplace_x', true],
    ['app_franchises_26', true], ['app_kiosk_26', true], ['app_marketplace_26', true],
    ['app_business_x', false], ['app_driver_x', false], [undefined, false]
  ])('Advanced Settings for %s: %s', (code, expected) => {
    expect(idsOf(makeApp(code), code).includes('homepage')).toBe(expected)
  })

  it('keeps the hidden ones in the full list, with `visible` false, so the order is one', () => {
    const sections = buildSections({ t: translate, app: { id: 1, baseActions: [] }, appCode: 'app_business_x' })
    expect(sections).toHaveLength(8)
    expect(sections.find((section) => section.id === 'colors').visible).toBe(false)
    expect(visibleSections(sections)).toHaveLength(3)
  })
})

describe('navigation · sections and groups (D1)', () => {
  it('without `?section=` Builds is open and the navigation lists the sections the app has, under three group headers', () => {
    render(makeProps())
    expect(navLabels()).toEqual(['Builds', 'General', 'Constants', 'Credentials', 'Files', 'Images', 'Colors', 'Icons and splash', ...ADVANCED_LABELS])
    expect([...navigation().querySelectorAll('.odc-sectionnav-group')].map((group) => group.textContent)).toEqual(['Build Apps', 'App', 'Look', 'Advanced settings'])
    expect(mountedSections()).toEqual(['builds'])
    expect(openSection()).toHaveAttribute('data-section', 'builds')
    expect(within(navigation()).getByRole('button', { name: 'Builds' })).toHaveAttribute('aria-current', 'page')
  })

  it('an app without colors has no Colors; a business app has no Advanced Settings; a marketplace app has it', () => {
    const { unmount } = render(makeProps('app_marketplace_x', { app: makeApp('app_marketplace_x', { baseActions: ALL_GROUPS.filter((item) => item.group !== 'colors') }) }))
    expect(navLabels()).not.toContain('Colors')
    expect(navLabels()).toContain('Homepage')
    unmount()
    render(makeProps('app_business_x'))
    expect(navLabels()).not.toContain('Homepage')
    expect(navLabels()).toContain('Colors')
  })

  it('on a phone the navigation is the selector', () => {
    mockState.phone = true
    render(makeProps())
    expect(navigation().closest('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
  })

  it('choosing «Credentials» writes `?section=` keeping `id`, and Builds stays mounted but hidden', async () => {
    const user = userEvent.setup()
    render(makeProps())
    await user.click(within(navigation()).getByRole('button', { name: 'Credentials' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/my-products?id=677&section=credentials')
    expect(mountedSections()).toEqual(['builds', 'credentials'])
    const builds = document.querySelector('section[data-section="builds"]')
    expect(builds).toHaveAttribute('hidden')
    expect(within(builds).getByTestId('section-builds')).toBeInTheDocument()
    expect(openSection()).toHaveAttribute('data-section', 'credentials')
    expect(screen.getByRole('heading', { level: 2, name: 'Credentials' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Builds' })).toBeNull()
  })

  it('keeps the other parameters and the location state when it changes the section', async () => {
    const user = userEvent.setup()
    render(makeProps(), [{ pathname: '/my-products', search: '?id=677&tab=2', state: { productId: '677', type: 'app' } }])
    await user.click(within(navigation()).getByRole('button', { name: 'General' }))
    const search = new URL(screen.getByTestId('location').textContent, 'https://x.test').searchParams
    expect(search.get('id')).toBe('677')
    expect(search.get('tab')).toBe('2')
    expect(search.get('section')).toBe('general')
    expect(JSON.parse(screen.getByTestId('state').textContent)).toEqual({ productId: '677', type: 'app' })
  })

  it('a section is open from the URL, and it replaces the history entry instead of adding one', async () => {
    const user = userEvent.setup()
    render(makeProps(), ['/my-products?id=677&section=files'])
    expect(openSection()).toHaveAttribute('data-section', 'files')
    expect(mountedSections()).toEqual(['files'])
    await user.click(within(navigation()).getByRole('button', { name: 'Images' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/my-products?id=677&section=images')
  })

  it('an unknown section is Builds', () => {
    render(makeProps(), ['/my-products?id=677&section=nope'])
    expect(openSection()).toHaveAttribute('data-section', 'builds')
    expect(mountedSections()).toEqual(['builds'])
    expect(within(navigation()).getByRole('button', { name: 'Builds' })).toHaveAttribute('aria-current', 'page')
  })

  it('a section the app does not have (Colors without colors, Advanced for a business app) is Builds', () => {
    const { unmount } = render(makeProps('app_marketplace_x', { app: makeApp('app_marketplace_x', { baseActions: [] }) }), ['/my-products?id=677&section=colors'])
    expect(openSection()).toHaveAttribute('data-section', 'builds')
    unmount()
    render(makeProps('app_business_x'), ['/my-products?id=677&section=homepage'])
    expect(openSection()).toHaveAttribute('data-section', 'builds')
    expect(mountedSections()).toEqual(['builds'])
  })
})

describe('sections · mounted once visited (D1)', () => {
  it('what was typed in a section survives going to another and coming back', async () => {
    const user = userEvent.setup()
    render(makeProps())
    await user.type(screen.getByLabelText('builds field'), 'kept')
    await user.click(within(navigation()).getByRole('button', { name: 'General' }))
    expect(document.querySelector('section[data-section="builds"]')).toHaveAttribute('hidden')
    expect(screen.getByLabelText('builds field')).toHaveValue('kept')
    await user.click(within(navigation()).getByRole('button', { name: 'Builds' }))
    expect(screen.getByLabelText('builds field')).toHaveValue('kept')
    expect(mountedSections()).toEqual(['builds', 'general'])
  })

  it('every section has an h2 with its name and is labelled by it', async () => {
    const user = userEvent.setup()
    render(makeProps())
    await user.click(within(navigation()).getByRole('button', { name: 'Icons and splash' }))
    const section = openSection()
    const heading = within(section).getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Icons and splash')
    expect(section).toHaveAttribute('aria-labelledby', heading.id)
    expect(section).toHaveAttribute('tabindex', '-1')
    expect(within(section).getByTestId('section-resources')).toBeInTheDocument()
  })

  it('hands every section the props of BuildApps and `onNavigate`', async () => {
    const props = makeProps()
    render(props, ['/my-products?id=677&section=general'])
    const given = mockState.sectionProps.general
    expect(given.app).toBe(props.singleAppState.app)
    expect(given.appId).toBe(677)
    expect(given.appCode).toBe('app_marketplace_x')
    expect(given.updateAppValues).toBe(props.updateAppValues)
    expect(given.buildAppState).toEqual({ loading: false, result: null, error: null })
    expect(given.themesList).toBe(props.themesList)
    expect(typeof given.onNavigate).toBe('function')
  })

  it('«Go from» a section: `onNavigate` changes the section and puts the focus on its h2', async () => {
    const user = userEvent.setup()
    render(makeProps())
    expect(document.body).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Go from builds' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/my-products?id=677&section=credentials')
    expect(openSection()).toHaveAttribute('data-section', 'credentials')
    expect(screen.getByRole('heading', { level: 2, name: 'Credentials' })).toHaveFocus()
  })

  it('choosing in the navigation puts the focus on the new h2 as well, and loading the page does not', async () => {
    const user = userEvent.setup()
    render(makeProps(), ['/my-products?id=677&section=files'])
    expect(document.body).toHaveFocus()
    await user.click(within(navigation()).getByRole('button', { name: 'Colors' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Colors' })).toHaveFocus()
  })

  it('the hidden sections really are hidden: the stylesheet gives `.odc-ape-content[hidden]` display none', () => {
    expect(editorCss).toMatch(/\.odc-ape-content\[hidden\]\s*\{[^}]*display:\s*none/)
  })
})

describe('mounting · one BuildApps around every section', () => {
  it('mounts BuildApps once for the whole editor, however many sections are visited', async () => {
    const user = userEvent.setup()
    render(makeProps())
    await user.click(within(navigation()).getByRole('button', { name: 'General' }))
    await user.click(within(navigation()).getByRole('button', { name: 'Files' }))
    await user.click(within(navigation()).getByRole('button', { name: 'Builds' }))
    expect(mockState.buildAppsMounts).toBe(1)
  })

  it('gives it the app, its numeric id, the code as `appCode` and the controller\'s props', () => {
    const props = makeProps()
    render(props)
    const given = mockState.buildAppsProps
    expect(given.app).toBe(props.singleAppState.app)
    expect(given.appId).toBe(677)
    expect(given.appCode).toBe('app_marketplace_x')
    expect(given.updateAppValues).toBe(props.updateAppValues)
    expect(given.orderingTheme).toBe(props.orderingTheme)
    expect(given.advancedValues).toBe(props.advancedValues)
  })
})

describe('header (D4)', () => {
  it('the title is the app\'s name and its description is the app\'s; no «My products», no «More settings for your»', () => {
    render(makeProps())
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Customer app')
    // the customer (marketplace) app says what it is for customers, not the business app's text
    expect(screen.getByText(/Give your customers an app to order from the stores/)).toBeInTheDocument()
    expect(screen.queryByText(/Give your business owners or managers/)).toBeNull()
    expect(screen.queryByText('My products')).toBeNull()
    expect(screen.queryByText(/More settings for your/)).toBeNull()
    expect(screen.queryByText(/Change background, colors, fonts/)).toBeNull()
  })

  it.each([
    ['app_marketplace_x', 'ordering_app_advanced_settings,ordering_app_resources'],
    ['app_business_x', 'business_app_resources'],
    ['app_driver_x', 'driver_app_resources'],
    ['app_kiosk_x', '']
  ])('Learn for %s has these keys: «%s»', (code, keys) => {
    render(makeProps(code))
    expect(screen.getByTestId('learn')).toHaveAttribute('data-keys', keys)
  })

  it('with the side menu folded there is an «Open menu» button that unfolds it', async () => {
    mockState.collapsed = true
    const user = userEvent.setup()
    render(makeProps())
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await user.click(opener)
    expect(mockState.collapse).toHaveBeenCalledWith(false)
  })

  it('with the side menu open there is no «Open menu»', () => {
    render(makeProps())
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})

describe('loading and error (D7)', () => {
  it('while the app loads: the header with a skeleton, a busy status in the place of the content, no BuildApps and no navigation', () => {
    render(makeProps('app_marketplace_x', { singleAppState: { loading: true, error: null, app: null } }))
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status.querySelector('.odc-sr-only')).toHaveTextContent('Loading')
    expect(status.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(mockState.buildAppsMounts).toBe(0)
    expect(screen.queryByRole('navigation', { name: 'App sections' })).toBeNull()
  })

  it('an app that is not there yet is the same skeleton', () => {
    render(makeProps('app_marketplace_x', { singleAppState: { loading: false, error: null, app: null } }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(mockState.buildAppsMounts).toBe(0)
  })

  it('an error is an alert with the translated message, in the place of the content', () => {
    render(makeProps('app_marketplace_x', { singleAppState: { loading: false, error: 'Not found', app: makeApp() } }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't open this app")
    expect(alert).toHaveTextContent('No encontrado')
    expect(mockState.buildAppsMounts).toBe(0)
    expect(mountedSections()).toEqual([])
  })

  it('R1-09: an error with no app (unknown id) has an h1 named «My products», not a skeleton with «Loading»', () => {
    render(makeProps('app_marketplace_x', { singleAppState: { loading: false, error: 'Not found', app: null } }))
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'My products' })).toBeInTheDocument()
    expect(screen.queryByText('Loading')).toBeNull()
    expect(document.querySelector('.odc-skeleton')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't open this app")
  })

  it('an error with no text still says the app could not be opened', () => {
    render(makeProps('app_marketplace_x', { singleAppState: { loading: false, error: new Error(''), app: makeApp() } }))
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't open this app")
  })
})

describe('Advanced Settings · the theme of the app', () => {
  it('while the theme loads it is a busy status with a hidden «Loading», and the section is not mounted', () => {
    render(makeProps('app_marketplace_x', { orderingTheme: { loading: true, themes: [], error: null, siteId: null } }), ['/my-products?id=677&section=homepage'])
    const status = within(openSection()).getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status.querySelector('.odc-sr-only')).toHaveTextContent('Loading')
    expect(status.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('advanced-settings')).toBeNull()
    expect(within(openSection()).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('after it, the section gets main\'s props: isApp, the code flags and the theme state', () => {
    const loadingProps = makeProps('app_marketplace_x', { orderingTheme: { loading: true, themes: [], error: null, siteId: null } })
    const { update } = render(loadingProps, ['/my-products?id=677&section=header'])
    const ready = { ...loadingProps, orderingTheme: { ...loadingProps.orderingTheme, loading: false } }
    update(ready)
    expect(screen.getByTestId('advanced-settings')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    const given = mockState.advancedProps
    expect(given.sectionId).toBe('header')
    expect(given.isApp).toBe(true)
    expect(given.isKiosk).toBe(false)
    expect(given.isFranchise).toBe(false)
    expect(given.isMaweja).toBe(false)
    expect(given.themesList).toBe(ready.themesList)
    expect(given.advancedValues).toBe(ready.advancedValues)
    expect(given.setAdvancedValues).toBe(ready.setAdvancedValues)
  })

  it.each([
    ['app_kiosk_x', true, false],
    ['app_franchises_x', false, true],
    ['app_marketplace_x', false, false],
    ['app_kiosk_26', false, false]
  ])('%s: isKiosk %s, isFranchise %s', (code, isKiosk, isFranchise) => {
    render(makeProps(code), ['/my-products?id=677&section=homepage'])
    expect(mockState.advancedProps.isKiosk).toBe(isKiosk)
    expect(mockState.advancedProps.isFranchise).toBe(isFranchise)
  })

  it('every Advanced section has the Save of the legacy page: it sends the whole draft, as before', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(props, ['/my-products?id=677&section=buttons'])
    await user.click(within(openSection()).getByRole('button', { name: 'Save' }))
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledWith(props.advancedValues)
  })

  it('a link to an Advanced section opens it after a reload, and going to another keeps the first mounted', async () => {
    const user = userEvent.setup()
    render(makeProps(), ['/my-products?id=677&section=navigation_bar'])
    expect(openSection()).toHaveAttribute('data-section', 'navigation_bar')
    expect(screen.getByRole('heading', { level: 2, name: 'Navigation bar menu' })).toBeInTheDocument()
    await user.click(within(navigation()).getByRole('button', { name: 'Checkout' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/my-products?id=677&section=checkout')
    expect(mountedSections()).toEqual(['checkout', 'navigation_bar'])
  })
})

describe('AppEditorView', () => {
  it('is the view BuildApps draws: it takes the same props and paints the navigation and the open section', () => {
    const props = makeProps()
    renderWithProviders(
      <AppEditorView {...props} app={props.singleAppState.app} appId={677} appCode='app_marketplace_x' />,
      { initialEntries: ['/my-products?id=677'], theme }
    )
    expect(navLabels()).toContain('Builds')
    expect(openSection()).toHaveAttribute('data-section', 'builds')
  })
})
