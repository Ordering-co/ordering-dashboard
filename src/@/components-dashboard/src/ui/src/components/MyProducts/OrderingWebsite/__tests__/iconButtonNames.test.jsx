/* eslint-disable import/first */
// (bugs H, #67.2): the legacy website editor kept its own copy of the domain «i» help. At 390px it hung 19px outside the
// viewport (`right: -100px`), opened on :hover only, and its «i» / menu IconButtons had no accessible name (axe button-name). Same
// fix as MyProducts/CustomDomain (fd63ae25a). jsdom lays nothing out, so the geometry is read from the CSS source.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }],
  useSite: () => [{ sites: [] }],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: (src) => src }],
  ExamineClick: ({ children }) => <>{children}</>,
  DragAndDrop: ({ children }) => <>{children}</>,
  OrderingWebsite: () => null
}))
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

const SITE = { id: 199, code: 'web_franchises_x', type: 'franchiseweb', name: 'Franchise website', temporal_domain: null }

const props = {
  orderingTheme: { loading: false, themes: [{ theme_id: 1, site_id: SITE.id }], error: null },
  themeValues: {
    website_theme: { components: { type: 'franchise', franchise_slug: null } },
    images: { components: { homepage_image_fullscreen: false } },
    theme_settings: { components: { style: { background_page: '#FFFFFF' }, values: { homepage_content: '', footer_content: '' } } }
  },
  setThemeValues: vi.fn(),
  advancedValues: {},
  setAdvancedValues: vi.fn(),
  themesList: { loading: false, themes: [], error: null },
  site: SITE,
  setSite: vi.fn(),
  businessesList: { loading: false, businesses: [], error: null },
  franchisesList: { loading: false, franchises: [], error: null },
  handleChangeInput: vi.fn(),
  formState: { loading: false, changes: {}, error: null },
  handleUpdateSite: vi.fn(),
  handleUpdateSiteTheme: vi.fn(),
  appId: 'web_franchises_x',
  type: 'franchiseweb',
  name: 'Franchise website',
  isFranchise: true,
  disableReplaceCode: true,
  setAppIdState: vi.fn()
}

const render = (route, isCollapse = false) => {
  const Wrapper = ({ children }) => (
    <ProjectContext.Provider value={[{ websiteProduct: 'web_franchises_x' }, {}]}>
      <InfoShareContext.Provider value={[{ isCollapse }, { handleMenuCollapse: vi.fn() }]}>
        {children}
      </InfoShareContext.Provider>
    </ProjectContext.Provider>
  )
  return renderWithProviders(<OrderingWebsiteUI {...props} />, { initialEntries: [route], theme, wrapper: Wrapper })
}

describe('legacy website editor: IconButton names', () => {
  it('names the domain info button next to «Settings franchise website»', () => {
    render('/my-products/franchises-website')
    expect(screen.getByRole('button', { name: 'Information' })).toBeTruthy()
  })

  it('names the header info button', () => {
    render('/my-products/ordering-website')
    expect(screen.getAllByRole('button', { name: 'Information' }).length).toBeGreaterThan(1)
  })

  it('names its menu opener', () => {
    render('/my-products/franchises-website', true)
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy()
  })
})

describe('legacy website editor: domain help tooltip', () => {
  const css = readFileSync(path.join(__dirname, '..', 'styles.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const block = name => {
    const start = css.indexOf(`export const ${name} = styled.`)
    expect(start, name).toBeGreaterThan(-1)
    const next = css.indexOf('\nexport const ', start + 1)
    return css.slice(start, next === -1 ? undefined : next)
  }
  // Declarations that apply below 576px: the block without its @media (min-width: 576px) rule.
  const phone = source => source.slice(0, source.indexOf('@media'))

  it('does not hang outside the viewport on a phone', () => {
    const content = phone(block('CustomDomainInfoContent'))
    expect(content).not.toMatch(/right:\s*-\d+px/)
    expect(content).toMatch(/inset-inline-end:\s*0/)
    expect(content).toMatch(/max-inline-size:\s*calc\(100vw - 32px\)/)
  })

  it('opens with keyboard focus as well as hover', () => {
    const info = block('CustomDomainInfo')
    expect(info).toMatch(/&:hover > div/)
    expect(info).toMatch(/&:focus-within > div/)
  })
})
