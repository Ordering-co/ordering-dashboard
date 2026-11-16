// (tanda H, #67): the legacy My products editor had IconButtons with no accessible name (axe button-name): the
// menu openers (CustomProject, OrderingWidgets, AppLayout) and the "i" help buttons (CustomDomain, AppLayout). The hidden
// help of CustomDomain also hung 19px outside a 390px viewport and only opened on :hover. jsdom lays nothing out, so the
// geometry is read from the CSS source, as Shared/SideBar/__tests__/sidebarRowHeight.test.js does.
// MyProducts/OrderingWebsite/ is owned by another session and is not covered here.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{}, { configurations: { subdomain: 'example' } }],
  useConfig: () => [{ configs: {} }],
  CustomDomain: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: true }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../hooks/useWebsiteUrl', () => ({
  useWebsiteUrl: () => 'https://example.test'
}))

vi.mock('../../Shared', () => ({
  Alert: () => null,
  LearnDropDown: () => null
}))

vi.mock('../../../utils', () => ({
  learnOptionsValues: () => []
}))

import { CustomProject } from '../CustomProject'
import { OrderingWidgets } from '../OrderingWidgets'
import { AppLayout } from '../AppLayout'
import { CustomDomain } from '../CustomDomain'

const theme = { ...defaultTheme, images: { myProducts: { customProject: 'custom-project.png' } } }
const render = (ui, entry = '/') => renderWithProviders(ui, { theme, initialEntries: [entry] })

const appLayoutProps = {
  appId: 'app_marketplace_x',
  appInfo: {
    title: 'Customer app',
    description: 'Description',
    live_title: 'Free to use',
    live_description: 'Live',
    brand_title: 'Branded',
    brand_description: 'Brand',
    images: { live: 'live.png', brand: 'brand.png' }
  }
}

describe('legacy My products editor: IconButton names', () => {
  it('CustomProject names its menu opener', () => {
    render(<CustomProject />)
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy()
  })

  it('OrderingWidgets names its menu opener', () => {
    render(<OrderingWidgets />)
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy()
  })

  it('AppLayout names its menu opener', () => {
    render(<AppLayout {...appLayoutProps} />)
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy()
  })

  it('AppLayout names its header info button', () => {
    render(<AppLayout {...appLayoutProps} />, '/my-products/ordering-website')
    expect(screen.getByRole('button', { name: 'Information' })).toBeTruthy()
  })

  it('CustomDomain names its domain info button', () => {
    render(<CustomDomain handleChangeFormState={vi.fn()} formState={{ changes: {} }} />)
    expect(screen.getByRole('button', { name: 'Information' })).toBeTruthy()
  })
})

describe('CustomDomain hidden help tooltip', () => {
  const ROOT = path.join(__dirname, '..', 'CustomDomain')
  const css = readFileSync(path.join(ROOT, 'styles.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
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
