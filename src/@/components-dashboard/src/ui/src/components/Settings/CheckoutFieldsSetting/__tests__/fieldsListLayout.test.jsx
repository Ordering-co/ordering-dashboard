// (batch AC, settings ST6): «Checkout form fields» (the hub section user_information) stacks three legacy lists:
// cart and customer fields, address fields and card fields. At 390 px they painted a 700-weight title of 22 px split in two
// lines, 52 px of side margins, 20 px chevrons and a blank band under the last list. Presentation only: the lists still open
// the same panels. These tests read the CSS the styled components emit and the markup they draw.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ServerStyleSheet, ThemeProvider } from 'styled-components'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  CheckoutFieldsSetting: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  AddressFieldsSetting: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  SideBar: ({ open, children }) => open ? <aside>{children}</aside> : null
}))

import * as CheckoutStyles from '../styles'
import * as AddressStyles from '../../AddressFieldsSetting/styles'
import * as CardStyles from '../../CardFieldsSetting/styles'
import { CheckoutFieldsSetting } from '..'
import { AddressFieldsSetting } from '../../AddressFieldsSetting'
import { CardFieldsSetting } from '../../CardFieldsSetting'

const cssOf = (Component, props = {}) => {
  const sheet = new ServerStyleSheet()
  try {
    renderToString(sheet.collectStyles(<ThemeProvider theme={theme}><Component {...props} /></ThemeProvider>))
    return sheet.getStyleTags().replace(/\s+/g, ' ')
  } finally {
    sheet.seal()
  }
}

const lists = [
  ['CheckoutFieldsSetting', CheckoutStyles],
  ['AddressFieldsSetting', AddressStyles],
  ['CardFieldsSetting', CardStyles]
]

describe.each(lists)('%s list styles', (_name, styles) => {
  it('titles the list with the section role of Product, at the weight of the role', () => {
    const css = cssOf(styles.Header)
    expect(css).toMatch(/h1 ?\{[^}]*font-size: ?var\(--od-type-section-title-size\)/)
    expect(css).toMatch(/h1 ?\{[^}]*font-weight: ?var\(--od-font-weight-semibold\)/)
    expect(css).not.toMatch(/font-weight: ?700/)
    expect(css).not.toContain('--od-type-title-size')
  })

  it('lets the title wrap inside its row instead of being squeezed by the old 35 px margin', () => {
    const css = cssOf(styles.Header)
    expect(css).not.toMatch(/margin-(left|right): ?35px/)
    expect(css).toMatch(/min-inline-size: ?0/)
  })

  it('takes its side margins from the hub, not from a 20 px padding of its own', () => {
    const css = cssOf(styles.SitesListContainer)
    expect(css).not.toMatch(/padding: ?[^;]*20px/)
    expect(css).toMatch(/padding: ?0;/)
  })

  it('spaces the list and its rows with spacing tokens, never px', () => {
    for (const Component of [styles.SitesListContainer, styles.Header, styles.SitesWrapper, styles.SiteItem]) {
      const css = cssOf(Component)
      expect(css).not.toMatch(/(margin|padding)[a-z-]*: ?[^;{}]*\d+px/)
    }
    expect(cssOf(styles.SitesWrapper)).toMatch(/margin-block-start: ?var\(--od-space-\d\)/)
    expect(cssOf(styles.SiteItem)).toMatch(/padding: ?var\(--od-space-3\) var\(--od-space-4\)/)
  })

  it('draws no icon size of its own on the row: the chevron is the Product icon', () => {
    const css = cssOf(styles.SiteItem)
    expect(css).not.toMatch(/svg ?\{[^}]*font-size/)
  })

  it('keeps the 44 px area of a row under touch or on a phone', () => {
    const css = cssOf(styles.SiteItem)
    expect(css).toMatch(/@media \(pointer: ?coarse\), ?\(max-width: ?767px\) ?\{[^}]*min-block-size: ?var\(--od-x-target-coarse\)/)
  })

  it('leaves no bottom padding on the list: the hub body already closes the section', () => {
    const css = cssOf(styles.SitesListContainer)
    expect(css).not.toMatch(/padding: ?[^;]*\b20px/)
    expect(css).not.toMatch(/(min-height|min-block-size|height|block-size): ?\d+px/)
  })
})

const sites = [{ id: 7, code: 'web_dashboard_x' }, { id: 8, code: 'app_driver_x' }]
const baseProps = {
  sitesState: { loading: false, sites },
  checkoutFieldsState: { fields: [] },
  validationFieldState: { fields: [] },
  selectedSiteId: null,
  setSelectedSiteId: vi.fn(),
  actionState: { loading: false, error: null },
  avoidExpand: true
}

describe.each([
  ['cart and customer fields', CheckoutFieldsSetting, 'Cart and customer fields'],
  ['address fields', AddressFieldsSetting, 'Address fields'],
  ['card fields', CardFieldsSetting, 'Credit Card fields']
])('%s markup', (_name, Component, title) => {
  it('keeps the title as an h1 and one native button per channel, with a Product (Lucide) chevron', () => {
    renderWithProviders(<Component {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(sites.length)
    for (const row of rows) {
      expect(row.tagName).toBe('BUTTON')
      const chevron = row.querySelector('svg')
      expect(chevron).toBeTruthy()
      // Lucide draws a 24 box with a stroke; the Bootstrap glyph is a 16 box filled with the text color
      expect(chevron.getAttribute('class')).toMatch(/lucide-chevron-right/)
      expect(chevron.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(chevron.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

describe('the hub stacks the three lists with one gap', () => {
  it('defines the stack with spacing tokens and no fixed height', () => {
    const css = readFileSync(resolve(__dirname, '../../SettingsHub/settings-hub.css'), 'utf8')
    const rule = css.match(/\.odc-hub-fields-stack \{([^}]*)\}/)
    expect(rule).toBeTruthy()
    expect(rule[1]).toMatch(/display: grid/)
    expect(rule[1]).toMatch(/gap: var\(--od-space-5\)/)
    expect(rule[1]).not.toMatch(/(min-)?(block-)?height|block-size/)
  })
})
