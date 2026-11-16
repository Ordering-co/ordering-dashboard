/* eslint-disable import/first */
// round 2: main added a legacy website's move to Builder — `siteMissing` (a page that creates no site,
// `disableSiteCreation`, found none) and `withMigration` (the legacy site's own migration, `WebsiteMigration` / `WebsiteInBuilder`
// from ../../WebsiteMigration) — ported here into BOTH layouts this editor can take (`OrderingWebsiteUI`: the legacy form without
// `layout`, the sections editor with `layout='sections'`). Covered, for each layout:
//  - siteMissing sends to Builder at once: no editor, no skeleton (the bug this closes: without the gate the editor waited forever
//    for a site that would never exist);
//  - withMigration with an already migrated site: only the migration message, no editor, no «Websites are now made in Builder»;
//  - withMigration not yet migrated (the migration status loaded): the editor shows, with the migration offer above it;
//  - no withMigration (the dashboard, the franchise and the white-label wrappers never pass it): the editor as before, nothing
//    migration-related mounted (no fetch to /sites/:id/migration happens at all).
// `WebsiteMigration` / `WebsiteInBuilder` are the real components (their own states are covered by WebsiteMigration/__tests__); only
// its controller's network and the heavy legacy children this editor never needs here are stood in for.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const translate = (_key, text) => text

vi.mock('../../../../../../index', async () => {
  const { WebsiteMigration } = await vi.importActual('../../../../../../components/WebsiteMigration')
  return {
    WebsiteMigration,
    useLanguage: () => [{}, translate],
    useConfig: () => [{ configs: {} }],
    useApi: () => [{ project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }],
    useSite: () => [{ sites: [] }],
    useSession: () => [{ user: { level: 0 } }],
    useUtils: () => [{ optimizeImage: (src) => src }],
    ExamineClick: ({ children }) => <>{children}</>,
    DragAndDrop: ({ children }) => <>{children}</>,
    OrderingWebsite: () => null
  }
})
// The WebsiteMigration controller (components/WebsiteMigration) reads these two directly, not through the barrel above
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'jwt', user: { id: 7 } }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v400/en/demo' }] }))
// Heavy legacy/sections children neither layout needs for this gate (their own tests cover them)
vi.mock('../../ContentForm', () => ({ ContentForm: () => null }))
vi.mock('../../AdvancedSettings', () => ({ AdvancedSettings: () => null }))
vi.mock('../../OrderingWidgets', () => ({ OrderingWidgets: () => null }))
vi.mock('../../WhiteLabelCustomDomain', () => ({ WhiteLabelCustomDomain: () => null }))
vi.mock('../../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock', () => ({ WhiteLabelCustomDomainBlock: () => null }))
vi.mock('../../CustomDomain', () => ({ CustomDomain: () => null }))
vi.mock('../../../Settings', () => ({ FilterSettings: () => null }))

import { InfoShareContext } from '../../../../contexts/InfoShareContext'
import { ProjectContext } from '../../../../contexts/ProjectContext'
import { OrderingWebsiteUI } from '../index'

const theme = {
  ...defaultTheme,
  images: {
    preview: { marketplace: 'marketplace.png', franchise: 'franchise.png', singleStore: 'single.png' },
    myProducts: { orderingWebsite: 'ordering-website.png' }
  }
}

const SITE = { id: 7, code: 'website', name: 'Marketplace Website', description: 'Your awesome website' }

const makeThemeValues = () => ({
  website_theme: { components: { type: 'marketplace', business_slug: '' } },
  images: { components: { logo: { components: { image: 'logo.jpg' } }, homepage_image_fullscreen: false } },
  theme_settings: { components: { style: { background_page: '#FFFFFF' }, values: { homepage_content: '', footer_content: '' } } },
  website_settings: { components: { values: { name: SITE.name, description: SITE.description } } }
})

const makeProps = (overrides = {}) => {
  const themeValues = makeThemeValues()
  return {
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
    ensureSite: vi.fn(),
    reloadSite: vi.fn(),
    saving: false,
    appId: 'website',
    ...overrides
  }
}

const render = (props) => {
  const Wrapper = ({ children }) => (
    <ProjectContext.Provider value={[{ websiteProduct: 'web_marketplace_26' }, {}]}>
      <InfoShareContext.Provider value={[{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]}>
        {children}
      </InfoShareContext.Provider>
    </ProjectContext.Provider>
  )
  return renderWithProviders(<OrderingWebsiteUI {...props} />, { initialEntries: ['/my-products/ordering-website'], theme, wrapper: Wrapper })
}

/** Answers GET of `/sites/:id/migration` once; main's own WebsiteMigration tests cover the POST and the other statuses. */
const mockMigrationApi = (status, extra = {}) => {
  global.fetch = vi.fn((url) => {
    expect(url).toBe('https://api.test/v400/en/demo/sites/7/migration')
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ error: false, result: { status, migrated_at: null, url: null, product_id: null, domain: null, cname_target: null, ...extra } })
    })
  })
}

// «Visit my website» (and the page description) belong to the product card main hides with the editor
const visitShown = () => screen.queryAllByText(/Visit my website/i).length > 0
const noSkeleton = () => expect(document.querySelectorAll('.odc-skeleton, .odc-ows-skeleton')).toHaveLength(0)

describe.each([
  ['legacy editor (no `layout`)', undefined],
  ['sections editor (`layout="sections"`)', 'sections']
])('%s · the  website-migration gate ( round 2)', (_label, layout) => {
  const editorShown = () => (layout === 'sections'
    ? document.querySelector('.odc-ows-body') != null
    : document.querySelector('input[name="name"]') != null)

  it('siteMissing (a page with no site creation, none found): WebsiteInBuilder, no editor, no skeleton', () => {
    render(makeProps({ layout, disableSiteCreation: true, siteMissing: true, site: null, savedSite: null }))
    expect(screen.getByRole('heading', { name: 'Websites are now made in Builder' })).toBeInTheDocument()
    expect(editorShown()).toBe(false)
    expect(visitShown()).toBe(false)
    noSkeleton()
  })

  it('withMigration + an already migrated site: only the migration message, no editor', async () => {
    mockMigrationApi('migrated')
    render(makeProps({ layout, withMigration: true }))
    expect(await screen.findByRole('heading', { name: 'This website was migrated to the new editor' }, { timeout: 5000 })).toBeInTheDocument()
    expect(editorShown()).toBe(false)
    expect(visitShown()).toBe(false)
    expect(screen.queryByRole('heading', { name: 'Websites are now made in Builder' })).toBeNull()
  })

  it('withMigration, not yet migrated (the status loaded): the editor shows, with the migration offer above it', async () => {
    mockMigrationApi('eligible')
    render(makeProps({ layout, withMigration: true }))
    expect(await screen.findByRole('heading', { name: 'Move to the new website editor' }, { timeout: 5000 })).toBeInTheDocument()
    expect(editorShown()).toBe(true)
    expect(visitShown()).toBe(true)
  })

  it('no withMigration (dashboard, franchise and white-label wrappers): the editor as before, nothing migration-related mounted', () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('no fetch expected without withMigration')))
    render(makeProps({ layout }))
    expect(editorShown()).toBe(true)
    expect(visitShown()).toBe(true)
    expect(screen.queryByRole('heading', { name: 'Websites are now made in Builder' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /new website editor|new editor/ })).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
