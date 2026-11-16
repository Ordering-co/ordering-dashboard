/* eslint-disable import/first */
// redesign CA-B3 (decisions 1 and 2): the page header of the campaigns list: title and count, «New campaign» (primary), «Refresh»
// (secondary, always visible) and, for level 0 only, the help line with the link to customer support.
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  catalog: {}, // what the runtime catalog of the API says for a key, over the default text
  subdomain: 'ordering' // the project's subdomain, for the legacy CampaignHeader
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text],
  useSession: () => [{ user: { level: 0 } }],
  useApi: () => [{}, { configurations: { subdomain: mockState.subdomain } }]
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: () => {} }]
}))

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { CampaignsHeader } from '../CampaignsHeader'
import { CampaignHeader } from '../../CampaignHeader'

const MARKETING_INFO = 'Create campaigns to reach your customer with news, offers and new products. Need help with the set-up? Contact our team here:'

const setup = (props = {}) => {
  const onNew = vi.fn()
  const onRefresh = vi.fn()
  const view = render(<CampaignsHeader count={12} onNew={onNew} onRefresh={onRefresh} {...props} />)
  return { onNew, onRefresh, ...view }
}

beforeEach(() => {
  mockState.catalog = {}
  mockState.subdomain = 'ordering'
})
afterEach(cleanup)

describe('title and count', () => {
  it('has the page title «Campaigns» as the only h1', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeInTheDocument()
  })

  it('names the count for a screen reader: «12 campaigns»', () => {
    const { container } = setup({ count: 12 })
    expect(screen.getByText('12 campaigns')).toBeInTheDocument()
    expect(container.querySelector('.odc-pagehead-count')).toHaveTextContent('12')
  })

  it('says «1 campaign» for one', () => {
    setup({ count: 1 })
    expect(screen.getByText('1 campaign')).toBeInTheDocument()
  })

  it('keeps a zero count (an empty list is a number, not an unknown)', () => {
    setup({ count: 0 })
    expect(screen.getByText('0 campaigns')).toBeInTheDocument()
  })

  it.each([[undefined], [null], [NaN], ['soon']])('draws no count while it is unknown (%j)', (count) => {
    const { container } = setup({ count })
    expect(container.querySelector('.odc-pagehead-count')).toBeNull()
    // no «NaN campaigns», «null campaigns» or «0 campaigns» label (the «New campaign» button is the only other text that ends so)
    expect(screen.queryByText(/^(?!New )\S+ campaigns?$/)).toBeNull()
  })

  it('takes the title and the count words from the catalog', () => {
    mockState.catalog = { CAMPAIGNS_TITLE: 'Campañas', CAMPAIGNS_COUNT_OTHER: '_count_ campañas' }
    setup({ count: 3 })
    expect(screen.getByRole('heading', { level: 1, name: 'Campañas' })).toBeInTheDocument()
    expect(screen.getByText('3 campañas')).toBeInTheDocument()
  })
})

describe('«New campaign» and «Refresh»', () => {
  it('«New campaign» is the primary action and calls onNew once', async () => {
    const user = userEvent.setup()
    const { onNew } = setup()
    const button = screen.getByRole('button', { name: 'New campaign' })
    expect(button).toHaveAttribute('data-variant', 'primary')
    await user.click(button)
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('«Refresh» is a secondary button and calls onRefresh once', async () => {
    const user = userEvent.setup()
    const { onRefresh, onNew } = setup()
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button).toHaveAttribute('data-variant', 'secondary')
    await user.click(button)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onNew).not.toHaveBeenCalled()
  })

  it('«Refresh» stays visible whatever the level and with no description', () => {
    setup({ supportUrl: undefined })
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
  })

  it('while refreshing «Refresh» is busy, keeps its name and does not send a second request', async () => {
    const user = userEvent.setup()
    const { onRefresh } = setup({ refreshing: true })
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('«Refresh» is not busy by default', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Refresh' })).not.toHaveAttribute('aria-busy')
  })

  it('«New campaign» keeps its words and its title when the header is narrow (the label is marked to collapse)', () => {
    setup()
    const button = screen.getByRole('button', { name: 'New campaign' })
    expect(button).toHaveAttribute('title', 'New campaign')
    expect(button.querySelector('[data-collapse-label]')).toHaveTextContent('New campaign')
  })
})

describe('description and support link (level 0 only: the host passes supportUrl)', () => {
  it('shows the help text and the «Customer support» link that opens in a new tab, safely', () => {
    const { container } = setup({ supportUrl: 'https://www.ordering.com/support' })
    expect(container.querySelector('.odc-pagehead-description')).toHaveTextContent(MARKETING_INFO)
    const link = screen.getByText('Customer support')
    expect(link).toHaveAttribute('href', 'https://www.ordering.com/support')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('the link sits inside the description, after the text', () => {
    const { container } = setup({ supportUrl: 'https://www.ordering.com/support' })
    const description = container.querySelector('.odc-pagehead-description')
    expect(description).toContainElement(screen.getByText('Customer support'))
    expect(description.textContent.indexOf('Contact our team here:')).toBeLessThan(description.textContent.indexOf('Customer support'))
  })

  it.each([[undefined], [null], ['']])('without supportUrl (%j) there is no description and no link', (supportUrl) => {
    const { container } = setup({ supportUrl })
    expect(container.querySelector('.odc-pagehead-description')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/Need help with the set-up/)).toBeNull()
  })
})

describe('menu button (the sidebar is collapsed)', () => {
  it('draws «Open menu» before the title only when the host gives onOpenMenu, and calls it', async () => {
    const user = userEvent.setup()
    const onOpenMenu = vi.fn()
    setup({ onOpenMenu })
    const menu = screen.getByRole('button', { name: 'Open menu' })
    expect(menu.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // the opener is PageHeader's `leading`: first child of the lead block, and the page's class is on the PageHeader itself
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    expect(menu.closest('.odc-pagehead')).toHaveClass('odc-campaign-head')
    await user.click(menu)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
  })

  it('has no menu button by default', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})

// (tanda O): the legacy CampaignHeader built the support link on the project's subdomain: www.undefined.com without one.
// (main #481): it is the Ordering.co support page for every project
describe('legacy CampaignHeader: support link (level 0)', () => {
  const renderLegacy = () => renderWithProviders(<CampaignHeader getCampaignList={() => {}} handleOpenDetail={() => {}} handleChangeSearch={() => {}} />)

  it.each([['with', 'ordering'], ['without', undefined]])('links to the Ordering.co support page, %s a subdomain', (_label, subdomain) => {
    mockState.subdomain = subdomain
    renderLegacy()
    expect(screen.getByText('Customer support')).toHaveAttribute('href', 'https://www.ordering.co/support/')
  })
})
