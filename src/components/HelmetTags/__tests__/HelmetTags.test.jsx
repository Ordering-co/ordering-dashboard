// (owner decision D-64 · delivery-services P-7 · intelligence-reports P9): an admin panel is not offered to
// search engines. Every page says `noindex, nofollow` (in index.html, before any script, and in the tags of the page), no
// page carries the «a dummy description» filler, and the titles are the names the menu gives.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import helmetData from '../../../helmetdata.json'
import catalog from '../../../../i18n/translations.json'

// The configs and the dictionary are swapped per test: `state.configs` is what useConfig returns, `state.dictionary` what t() translates.
const state = vi.hoisted(() => ({ configs: { dashboard_title: { value: 'Acme' } }, dictionary: {} }))
vi.mock('~components', () => ({
  useConfig: () => [{ configs: state.configs }],
  useLanguage: () => [{}, (key, fallback) => state.dictionary[key] ?? fallback]
}))
vi.mock('styled-components', async (importOriginal) => ({ ...(await importOriginal()), useTheme: () => ({}) }))

const { HelmetTags } = await import('../index')

const robotsOf = () => [...document.head.querySelectorAll('meta[name="robots"]')].map(meta => meta.getAttribute('content'))

describe('HelmetTags and the page data', () => {
  it('index.html says noindex, nofollow before any script', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const at = html.indexOf('<meta name="robots" content="noindex, nofollow" />')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(html.indexOf('<script'))
  })

  it.each(['orders', 'businesses', 'reports', 'forgotpassword', 'builder'])('the page %s is noindex, nofollow', async (page) => {
    render(<HelmetTags page={page} />)
    await waitFor(() => expect(robotsOf()).toContain('noindex, nofollow'))
    expect(robotsOf().some(content => /\bindex, follow/.test(content) && !/noindex/.test(content))).toBe(false)
  })

  it('no page keeps the filler description, keywords or an indexing robots value', () => {
    Object.entries(helmetData).forEach(([page, data]) => {
      expect(data.description, page).not.toMatch(/dummy/i)
      expect(data.keywords, page).not.toMatch(/dummy|test/i)
      expect(data.robots, page).toBe('noindex, nofollow')
    })
  })

  it('renders no description or keywords tag when the page has none', async () => {
    render(<HelmetTags page='orders' />)
    await waitFor(() => expect(document.title).toBe('Acme - Orders list'))
    expect(document.head.querySelector('meta[name="description"][data-react-helmet]')).toBeNull()
    expect(document.head.querySelector('meta[name="keywords"][data-react-helmet]')).toBeNull()
  })

  it.each([
    ['brand', 'Brands'],
    ['devices', 'Devices'],
    ['reports', 'Enterprise reports'],
    ['reviews', 'Reviews manager'],
    ['callcenter_agents', 'Call center agents'],
    ['drivers_managers', 'Drivers managers'],
    ['drivers_companies', 'Delivery companies'],
    ['drivers_groups', 'Delivery groups'],
    ['drivers_time_display', 'Drivers time display'],
    ['business_payment_reports', 'Payment reports'],
    ['business_add', 'Add store'],
    ['store', 'Products'],
    ['free_products', 'Free downloads'],
    // review R-9: /schools had no entry and fell back to the app title
    ['schools', 'Schools'],
    // (decision 33): the menu and the H1 say «Promotions» since batch AE
    ['enterprise_promotions', 'Promotions']
  ])('the tab of %s is named as the menu names it (%s)', (page, title) => {
    expect(helmetData[page].title).toBe(title)
  })

  // the same key as the menu entry, so a translation (or a project's own text) changes the menu and the tab together
  it('titles Promotions with the key of its menu entry', async () => {
    expect(helmetData.enterprise_promotions.titleKey).toBe('PROMOTIONS')
    state.dictionary = { PROMOTIONS: 'Promociones' }
    render(<HelmetTags page='enterprise_promotions' />)
    await waitFor(() => expect(document.title).toBe('Acme - Promociones'))
    state.dictionary = {}
  })
})

// the tab title is translated with t(), carries the same brand on every route and is written in sentence case.
describe('the tab title', () => {
  beforeEach(() => {
    state.configs = { dashboard_title: { value: 'Acme' } }
    state.dictionary = {}
    delete window.__FIRST_LOAD__
  })

  it('translates the title with the dictionary of the interface language (German)', async () => {
    state.dictionary = { PROFILE: 'Profil', ORDERS_LIST: 'Bestellliste' }
    render(<HelmetTags page='profile' />)
    await waitFor(() => expect(document.title).toBe('Acme - Profil'))
  })

  it('falls back to the English text of helmetdata.json when the dictionary has no entry', async () => {
    render(<HelmetTags page='orders' />)
    await waitFor(() => expect(document.title).toBe('Acme - Orders list'))
  })

  it('translates the title of the products tab when the page gives no store name', async () => {
    state.dictionary = { PRODUCTS: 'Produkte' }
    render(<HelmetTags page='store' />)
    await waitFor(() => expect(document.title).toBe('Acme - Produkte'))
  })

  it('does not translate a title the page chooses itself (a store name)', async () => {
    state.dictionary = { PRODUCTS: 'Produkte' }
    render(<HelmetTags page='store' helmetTitle='Pizza house' />)
    await waitFor(() => expect(document.title).toBe('Acme - Pizza house'))
  })

  it('titles the 404 page with the same brand as the rest and a translated name', async () => {
    state.dictionary = { PAGE_UNAVAILABLE_TITLE: 'Diese Seite ist nicht verfügbar' }
    render(<HelmetTags page='not_found' />)
    await waitFor(() => expect(document.title).toBe('Acme - Diese Seite ist nicht verfügbar'))
  })

  it('uses the same brand on the logged-out routes: the first-load dashboard_title when the configs lack it', async () => {
    state.configs = {}
    window.__FIRST_LOAD__ = { configs: { dashboard_title: { value: 'Acme' } } }
    render(<HelmetTags page='forgotpassword' />)
    await waitFor(() => expect(document.title).toBe('Acme - Forgot password'))
  })

  it('keeps the same reserve (the app name) on every route when no project title is known', async () => {
    state.configs = {}
    render(<HelmetTags page='forgotpassword' />)
    await waitFor(() => expect(document.title).toBe('Ordering.co Dashboard - Forgot password'))
    render(<HelmetTags page='not_found' />)
    await waitFor(() => expect(document.title).toBe("Ordering.co Dashboard - This page isn't available"))
  })

  it('writes every title in sentence case (only the first word and product names are capitalized)', () => {
    const allowed = new Set(['POS', 'Google'])
    Object.entries(helmetData).filter(([page]) => page !== 'app').forEach(([page, { title }]) => {
      const words = title.split(' ').slice(1)
      const capitalized = words.filter(word => /^[A-Z]/.test(word) && !allowed.has(word))
      expect(capitalized, `${page}: ${title}`).toEqual([])
    })
  })

  it('gives each page a catalog key; a reused key has exactly the English title, a new one is PAGE_TITLE_*', () => {
    const withoutKey = Object.entries(helmetData).filter(([, data]) => !data.titleKey).map(([page]) => page)
    // the app entry is the project name; `assistant` is a proper name; the rest are pages no route renders today (TODO: key when one does)
    expect(withoutKey.sort()).toEqual([
      'all_settings', 'app', 'assistant', 'basic_settings', 'ecommerce_reports', 'enterprise_settings', 'gift_cards_settings',
      'operation_settings', 'pages', 'plugin_settings', 'pro_settings', 'rewards_programs', 'standard_settings', 'wallets_refunds'
    ])
    Object.entries(helmetData).filter(([, data]) => data.titleKey).forEach(([page, { title, titleKey }]) => {
      if (catalog[titleKey]) expect(catalog[titleKey].en, `${page} -> ${titleKey}`).toBe(title)
      else expect(titleKey, page).toMatch(/^PAGE_TITLE_[A-Z0-9_]+$/)
    })
  })
})
