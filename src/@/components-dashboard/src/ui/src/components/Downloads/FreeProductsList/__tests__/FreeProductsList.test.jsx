import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'

const state = vi.hoisted(() => ({ isCollapse: false, collapse: vi.fn(), project: undefined, keys: [] }))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => { state.keys.push(key); return fallback }],
  useApi: () => [{ project: state.project }, { configurations: {} }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.collapse }]
}))
import { FreeProductsList } from '../index'

const theme = { ...dashboardTheme, images: { apps: { driverApp: '/driver.png', storeApp: '/business.png', callCenterApp: '/callcenter.png' }, icons: { delivery: '/delivery.svg', posTerminal: '/pos.svg', poster: '/kiosk.svg' }, general: { appStore: '/app-store.svg', googlePlay: '/google-play.svg' } } }
const renderCatalog = (overrides = {}) => renderWithProviders(<FreeProductsList />, { theme: { ...theme, ...overrides } })
const expectedLinks = [
  ['App Store · Driver App', 'https://apps.apple.com/app/driver-app-v26/id6526462318'],
  ['Google Play · Driver App', 'https://play.google.com/store/apps/details?id=com.orderingplus.driverapp'],
  ['App Store · Business App', 'https://apps.apple.com/app/business-app-v26/id6526502488'],
  ['Google Play · Business App', 'https://play.google.com/store/apps/details?id=com.orderingplus.storeapp'],
  ['Open Call Center', 'https://callcenter.orderingplus.com/signin']
]

describe('Free downloads catalog', () => {
  beforeEach(() => { state.isCollapse = false; state.project = undefined; state.keys = []; state.collapse.mockClear() })
  it('shows only the three Ordering products in the agreed order', () => {
    renderCatalog()
    expect(screen.getByRole('heading', { level: 1, name: 'Free downloads' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)).toEqual(['Driver App', 'Business App', 'Call Center'])
    expect(screen.getAllByText('By Ordering')).toHaveLength(3)
    expect(screen.queryByText(/Kiosk|POS|2\.0/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
  it.each(expectedLinks)('provides the exact safe destination for %s', (name, href) => {
    renderCatalog()
    const link = screen.getByRole('link', { name })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
  it('keeps the catalog static without opening product sidebars', async () => {
    renderCatalog()
    await userEvent.click(screen.getByRole('heading', { name: 'Business App' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
  })
  it('opens the collapsed sidebar through a named keyboard accessible control', async () => {
    state.isCollapse = true
    renderCatalog()
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    const user = userEvent.setup()
    await user.tab()
    expect(opener).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(state.collapse).toHaveBeenCalledExactlyOnceWith(false)
  })
  it('supports optional product imagery and RTL tenant themes', () => {
    renderCatalog({ images: {}, rtl: true, colors: { ...theme.colors, primary: '#5b247a' } })
    expect(screen.getByRole('heading', { name: 'Call Center' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
  it('shows the project code and a Copy button inside the sign-in note when the project is known', () => {
    state.project = 'orderingv1'
    renderCatalog()
    const note = screen.getByRole('note')
    expect(within(note).getByText('Sign in with your project and Ordering account.')).toBeInTheDocument()
    expect(within(note).getByText('Project code')).toBeInTheDocument()
    expect(within(note).getByText('orderingv1')).toBeInTheDocument()
    expect(within(note).getByRole('button', { name: 'Copy project code' })).toBeInTheDocument()
  })
  it('asks for the generic project-code keys, shared with Support, not the page-specific ones (#3)', () => {
    state.project = 'orderingv1'
    renderCatalog()
    expect(state.keys).toContain('PROJECT_CODE')
    expect(state.keys).toContain('COPY_PROJECT_CODE')
    expect(state.keys).not.toContain('FREE_DOWNLOADS_PROJECT_CODE')
    expect(state.keys).not.toContain('FREE_DOWNLOADS_COPY_PROJECT_CODE')
  })
  it('keeps the sign-in sentence and drops the code and Copy without a project', () => {
    renderCatalog()
    const note = screen.getByRole('note')
    expect(within(note).getByText('Sign in with your project and Ordering account.')).toBeInTheDocument()
    expect(screen.queryByText('Project code')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy project code' })).not.toBeInTheDocument()
  })
  it('draws no code and no Copy for an empty project', () => {
    state.project = ''
    renderCatalog()
    expect(screen.getByText('Sign in with your project and Ordering account.')).toBeInTheDocument()
    expect(screen.queryByText('Project code')).not.toBeInTheDocument()
    expect(document.querySelector('code')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy project code' })).not.toBeInTheDocument()
  })
  it('keeps the sign-in note static (note, not a live region) and the code left to right', () => {
    state.project = 'orderingv1'
    renderCatalog()
    const note = screen.getByRole('note')
    expect(note).not.toHaveAttribute('role', 'status')
    const bdi = screen.getByText('orderingv1')
    expect(bdi.tagName).toBe('BDI')
    expect(bdi).toHaveAttribute('dir', 'ltr')
    expect(bdi.closest('code')).not.toBeNull()
  })
  it('has no Free badge and no bottom brand note', () => {
    renderCatalog()
    expect(screen.queryByText('Free')).not.toBeInTheDocument()
    expect(screen.queryByText('These products use the Ordering brand.')).not.toBeInTheDocument()
  })
  it('names the new-tab warning from every link', () => {
    renderCatalog()
    for (const link of screen.getAllByRole('link')) {
      const target = document.getElementById(link.getAttribute('aria-describedby'))
      expect(target).not.toBeNull()
      expect(target).toHaveTextContent('opens in a new tab')
      // review r1 (pulido 1): only a description, never a stray sentence in the reading order
      expect(target).toHaveAttribute('hidden')
    }
  })
  it('reads the maker and the platforms as one line with its separator (review r1, pulido 2)', () => {
    renderCatalog()
    const meta = screen.getAllByText('By Ordering')[0].parentElement
    expect(meta.textContent).toBe('By Ordering · iOS · Android')
    expect(meta.querySelector('[aria-hidden]')).toBeNull()
  })
  it('draws every link as a secondary Product button, the Call Center one too', () => {
    renderCatalog()
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('odc-btn')
      expect(link).toHaveAttribute('data-variant', 'secondary')
    }
  })
  // redesign J5 row 46 (free-downloads P-1, ): a «Copy link» beside every link, no QR
  it.each(expectedLinks)('puts a copy button beside %s that copies its exact address', async (name, href) => {
    const user = userEvent.setup() // it installs its own clipboard
    renderCatalog()
    const link = screen.getByRole('link', { name })
    const copy = screen.getByRole('button', { name: `Copy link · ${name}` })
    expect(link.nextElementSibling?.contains(copy)).toBe(true)
    expect(link.parentElement).toHaveClass('odc-fd-link') // the pair wraps as one
    await user.click(copy)
    expect(await navigator.clipboard.readText()).toBe(href)
    expect(await screen.findAllByText('Copied')).not.toHaveLength(0)
  })
  it('falls back to an icon and no <img> when the tenant has no product imagery', () => {
    renderCatalog({ images: {} })
    const cards = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      expect(card.querySelector('img')).toBeNull()
      expect(card.querySelector('svg.odc-icon')).not.toBeNull()
    }
  })
})
