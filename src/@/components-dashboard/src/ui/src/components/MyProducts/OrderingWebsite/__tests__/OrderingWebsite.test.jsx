import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  projectStatus: { websiteProduct: 'web_marketplace_26' }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  ExamineClick: ({ children }) => children,
  DragAndDrop: ({ children }) => children,
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'acme', root: 'https://api.test/v400/en/acme' }, { configurations: { subdomain: 'orderingplus' } }],
  OrderingWebsite: () => null,
  useSite: () => [{ sites: [] }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
vi.mock('../../../../contexts/ProjectContext', () => ({
  useProjectState: () => [mocks.projectStatus]
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  Modal: () => null,
  ImageCrop: () => null,
  ColorPicker: () => null,
  LearnDropDown: () => null
}))
vi.mock('../../ContentForm', () => ({ ContentForm: () => null }))
vi.mock('../../AdvancedSettings', () => ({ AdvancedSettings: () => null }))
vi.mock('../../CustomDomain', () => ({ CustomDomain: () => null }))
vi.mock('../../WhiteLabelCustomDomain', () => ({ WhiteLabelCustomDomain: () => null }))
vi.mock('../../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock', () => ({ WhiteLabelCustomDomainBlock: () => null }))
vi.mock('../../WebsiteMigration', () => ({ WebsiteInBuilder: () => null, WebsiteMigration: () => null }))
vi.mock('../../OrderingWidgets', () => ({ OrderingWidgets: () => null }))
vi.mock('../../../Settings', () => ({ FilterSettings: () => null }))
vi.mock('../SelectBusiness', () => ({ SelectBusiness: () => null }))

import { OrderingWebsiteUI } from '..'

const theme = {
  ...defaultTheme,
  images: {
    preview: { marketplace: 'm.png', franchise: 'f.png', singleStore: 's.png' },
    myProducts: { orderingWebsite: 'w.png' },
    general: {}
  }
}

const renderWebsite = (props = {}) => renderWithProviders(
  <OrderingWebsiteUI
    orderingTheme={{ loading: false }}
    themeValues={{}}
    advancedValues={{}}
    site={{ id: 5, code: props.appId, type: props.appId, name: 'Website' }}
    {...props}
  />,
  { theme, initialEntries: [props.path || '/my-products/ordering-website-2'] }
)

describe('OrderingWebsiteUI temporal domain', () => {
  afterEach(() => {
    mocks.projectStatus = { websiteProduct: 'web_marketplace_26' }
  })

  it('shows the marketplace 26 domain on Ordering website 2 for a franchise subscription', () => {
    mocks.projectStatus = { websiteProduct: 'web_franchises_x' }
    renderWebsite({ appId: 'web_marketplace_26' })

    expect(screen.getByRole('link', { name: 'https://v26-acme.orderingplus.com' })).toBeTruthy()
  })

  it('shows the marketplace 26 domain on Ordering website 2 before the website product resolves', () => {
    mocks.projectStatus = { websiteProduct: null }
    renderWebsite({ appId: 'web_marketplace_26' })

    expect(screen.getByRole('link', { name: 'https://v26-acme.orderingplus.com' })).toBeTruthy()
  })

  it('keeps the subscribed franchise domain on the Ordering website page', () => {
    mocks.projectStatus = { websiteProduct: 'web_franchises_x' }
    renderWebsite({ appId: 'website', path: '/my-products/ordering-website' })

    expect(screen.getByRole('link', { name: 'https://acme.franchises.orderingplus.com' })).toBeTruthy()
  })
})
