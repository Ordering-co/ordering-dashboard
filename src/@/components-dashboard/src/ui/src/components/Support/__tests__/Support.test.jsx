import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'

const state = vi.hoisted(() => ({ isCollapse: false, collapse: vi.fn(), project: undefined, subdomain: 'acme' }))
vi.mock('../../../../../index', () => ({
  useApi: () => [{ project: state.project }, { configurations: { subdomain: state.subdomain } }],
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.collapse }]
}))
import { Support } from '..'

const renderSupport = (overrides = {}) => renderWithProviders(<Support />, { theme: { ...dashboardTheme, ...overrides } })
const expectedLinks = [
  ['Contact sales', 'https://www.ordering.co/contact/'],
  ['Open help center', 'https://docs.ordering.co/']
]

// redesign SU-A (decisions D1–D5): /support on Product
describe('Support', () => {
  let openSpy

  beforeEach(() => {
    state.isCollapse = false
    state.project = undefined
    state.subdomain = 'acme'
    state.collapse.mockClear()
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    openSpy.mockRestore()
  })

  it('shows the page title and the two options in main\'s order, with exactly two links', () => {
    renderSupport()
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)).toEqual(['Sales team', 'Technical support'])
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it.each(expectedLinks)('provides the exact safe destination for %s', (name, href) => {
    renderSupport()
    const link = screen.getByRole('link', { name })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAccessibleDescription('opens in a new tab')
  })

  it('opens the destinations through plain links, never window.open', async () => {
    renderSupport()
    const user = userEvent.setup()
    for (const link of screen.getAllByRole('link')) {
      // jsdom does not navigate, so the click only proves no script handler took over
      await user.click(link)
    }
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('draws every link as a secondary Product button inside its card', () => {
    renderSupport()
    const cards = within(screen.getByRole('list', { name: 'Support' })).getAllByRole('listitem')
    expect(cards.map(card => card.getAttribute('data-option'))).toEqual(['sales', 'tech'])
    for (const card of cards) {
      const link = within(card).getByRole('link')
      expect(link).toHaveClass('odc-btn')
      expect(link).toHaveAttribute('data-variant', 'secondary')
    }
  })

  it('names the new-tab warning from every link as a hidden description', () => {
    renderSupport()
    for (const link of screen.getAllByRole('link')) {
      const target = document.getElementById(link.getAttribute('aria-describedby'))
      expect(target).not.toBeNull()
      expect(target).toHaveTextContent('opens in a new tab')
      expect(target).toHaveAttribute('hidden')
    }
  })

  it('shows Open menu only when the sidebar is collapsed', () => {
    renderSupport()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('opens the collapsed sidebar through a named keyboard accessible control', async () => {
    state.isCollapse = true
    renderSupport()
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    const user = userEvent.setup()
    await user.tab()
    expect(opener).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(state.collapse).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('shows the project code, never the subdomain, and a Copy button inside the note when the project is known', () => {
    state.project = 'orderingv1'
    renderSupport()
    const note = screen.getByRole('note')
    expect(within(note).getByText('Our team will ask for your project code.')).toBeInTheDocument()
    expect(within(note).getByText('Project code')).toBeInTheDocument()
    expect(within(note).getByText('orderingv1')).toBeInTheDocument()
    expect(within(note).queryByText('acme')).not.toBeInTheDocument()
    expect(within(note).getByRole('button', { name: 'Copy project code' })).toBeInTheDocument()
    const bdi = screen.getByText('orderingv1')
    expect(bdi.tagName).toBe('BDI')
    expect(bdi).toHaveAttribute('dir', 'ltr')
    expect(bdi.closest('code')).not.toBeNull()
  })

  it('keeps the sentence and drops the code and Copy without a project', () => {
    renderSupport()
    const note = screen.getByRole('note')
    expect(within(note).getByText('Our team will ask for your project code.')).toBeInTheDocument()
    expect(screen.queryByText('Project code')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy project code' })).not.toBeInTheDocument()
    expect(document.querySelector('code')).toBeNull()
  })

  // (main #481): both destinations are Ordering.co's, the same with or without configurations.subdomain (#89 and tanda O,
  // , had kept them off www.undefined.com); no href says «undefined»
  it.each([undefined, null, ''])('links both cards to Ordering.co and has no "undefined" href when the subdomain is %j', (subdomain) => {
    state.subdomain = subdomain
    renderSupport()
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Contact sales' })).toHaveAttribute('href', 'https://www.ordering.co/contact/')
    expect(screen.getByRole('link', { name: 'Open help center' })).toHaveAttribute('href', 'https://docs.ordering.co/')
    expect(document.querySelector('[href*="undefined"]')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)).toEqual(['Sales team', 'Technical support'])
  })

  it('mounts right to left without errors', () => {
    renderSupport({ rtl: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
