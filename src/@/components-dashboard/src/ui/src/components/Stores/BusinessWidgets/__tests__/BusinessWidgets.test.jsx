// redesign stores 1.D (G5-03): the chat snippet's icon comes from a host that resolves.
// redesign stores 5.15a (; G5-04, G5-05): every snippet is a read-only code block with a named «Copy»; without the store's
// address the scripts that carry it say why instead of being empty; the help link never points to support.undefined.com.
import React from 'react'
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach, beforeEach, describe } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessWidgets } from '../index'

let apiState = { configurations: { subdomain: 'ordering' } }
let siteState = { sites: [], loading: false }
let storeUrl = (slug) => `https://shop.example.com/store/${slug}`
let projectState = { loading: false, websiteProduct: 'web_marketplace_26' }

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback],
  useApi: () => [{}, apiState],
  useSite: () => [siteState]
}))
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [projectState] }))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({
  useStoreWebsiteUrl: (slug) => storeUrl(slug)
}))

let writeText
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete navigator.clipboard
  apiState = { configurations: { subdomain: 'ordering' } }
  siteState = { sites: [], loading: false }
  storeUrl = (slug) => `https://shop.example.com/store/${slug}`
  projectState = { loading: false, websiteProduct: 'web_marketplace_26' }
})

const renderWidgets = () => render(
  <ThemeProvider theme={theme}>
    <BusinessWidgets business={{ id: 2, slug: 'my-store' }} />
  </ThemeProvider>
)

const iconSources = (snippet) => [...snippet.matchAll(/c\.src="([^"]+)"/g)].map(match => match[1])
const copy = async (name) => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })) })
}

describe('BusinessWidgets chat snippet (G5-03)', () => {
  it('loads the chat button icon from a host that resolves: the Ordering.co brand symbol', () => {
    const { container } = renderWidgets()
    fireEvent.click(screen.getByRole('radio', { name: 'Chat style integration' }))
    const snippet = [...container.querySelectorAll('textarea')].map(area => area.value).find(value => value.includes('ordering_bot_iframe'))

    expect(snippet).toBeTruthy()
    expect(snippet).toContain('https://shop.example.com/store/my-store')
    expect(iconSources(snippet)).toEqual(['https://brand.ordering.co/assets/logos/png/ordering-symbol-color-512.png'])
  })
})

describe('BusinessWidgets · copy (G5-04)', () => {
  it('every snippet is a read-only code block, never a disabled one', () => {
    const { container } = renderWidgets()
    const areas = [...container.querySelectorAll('textarea')]
    expect(areas).toHaveLength(6)
    areas.forEach(area => {
      expect(area).toHaveAttribute('readonly')
      expect(area).not.toBeDisabled()
    })
  })

  it('has one named Copy per snippet', () => {
    renderWidgets()
    expect(screen.getByRole('button', { name: 'Copy button code' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Copy PayPal script' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Copy popup script' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy inline script' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy .htaccess rules' })).toBeInTheDocument()
  })

  it('copies the popup script with the store address and says «Copied»', async () => {
    renderWidgets()
    await copy('Copy popup script')
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain('h.src="https://shop.example.com/store/my-store"')
    expect(screen.getAllByRole('status').some(node => node.textContent === 'Copied')).toBe(true)
  })

  it('the chat style copies the chat script', async () => {
    renderWidgets()
    fireEvent.click(screen.getByRole('radio', { name: 'Chat style integration' }))
    await copy('Copy chat script')
    expect(writeText.mock.calls[0][0]).toContain('ordering_bot_iframe')
  })

  it('the .htaccess rules copy without the indentation of the source', async () => {
    renderWidgets()
    await copy('Copy .htaccess rules')
    expect(writeText).toHaveBeenCalledWith('RewriteEngine On\nRewriteRule ^inline/(.+)$ /inline/ [NC,L] #where inline is the folder')
  })
})

describe('BusinessWidgets · without an address (G5-05)', () => {
  it('the scripts that carry it say why, with nothing to copy; the others stay', () => {
    storeUrl = () => null
    renderWidgets()
    expect(screen.getAllByText(/This store has no website address yet/)).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Copy popup script' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy inline script' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy button code' })).toBeInTheDocument()
  })

  it('while the sites load, nothing is said yet', () => {
    storeUrl = () => null
    siteState = { sites: [], loading: true }
    renderWidgets()
    expect(screen.queryByText(/This store has no website address yet/)).toBeNull()
  })

  it('while the project loads (its plan says whether it has a website), nothing is said yet', () => {
    storeUrl = () => null
    projectState = { loading: true, websiteProduct: null }
    renderWidgets()
    expect(screen.queryByText(/This store has no website address yet/)).toBeNull()
  })
})

describe('BusinessWidgets · help link (G5-05)', () => {
  // (main #481): the widget guide on docs.ordering.co, with or without a subdomain (never support.undefined.com)
  it.each([['with', { subdomain: 'ordering' }], ['without', {}]])('opens the widget guide on docs.ordering.co, %s a subdomain', (_label, configurations) => {
    apiState = { configurations }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWidgets()
    fireEvent.click(screen.getByRole('button', { name: 'Learn how to do it' }))
    expect(open).toHaveBeenCalledWith('https://docs.ordering.co/docs/products/dashboard/my-products/ordering-website-2/widget/', '_blank', 'noopener,noreferrer')
  })
})
