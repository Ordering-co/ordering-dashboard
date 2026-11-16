import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const api = vi.hoisted(() => ({ subdomain: 'example' }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{}, { configurations: { subdomain: api.subdomain } }]
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../Shared', () => ({
  LearnDropDown: () => null
}))

vi.mock('../../../../utils', () => ({
  learnOptionsValues: () => []
}))

vi.mock('../../../../styles', () => ({
  IconButton: ({ children, onClick }) => <button type='button' onClick={onClick}>{children}</button>,
  Button: ({ children, onClick }) => <button type='button' onClick={onClick}>{children}</button>
}))

import { AppLayout } from '../index'

const APP_STORE = 'https://apps.apple.com/us/app/customer-app-2-0/id1607414555'
const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.ordering.onlineorderingappv5'

const SUPPORT_ROUTE = { initialEntries: ['/my-products/customer-app'] }

const buildProps = (downloads) => ({
  appId: 'app_marketplace_x',
  appInfo: {
    title: 'Customer app',
    description: 'Description',
    live_title: 'Free to use',
    live_description: 'Live',
    brand_title: 'Branded',
    brand_description: 'Brand',
    images: { live: 'live.png', brand: 'brand.png' },
    downloads
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  api.subdomain = 'example'
})

describe('AppLayout store badges', () => {
  const downloads = [
    { id: 1, icon: 'app-store.png', link: APP_STORE },
    { id: 2, icon: 'play-store.png', link: GOOGLE_PLAY }
  ]

  it('renders each badge as a real button named after its store', () => {
    renderWithProviders(<AppLayout {...buildProps(downloads)} />)

    const appStore = screen.getByRole('button', { name: 'App Store' })
    const googlePlay = screen.getByRole('button', { name: 'Google Play' })
    expect(appStore.tagName).toBe('BUTTON')
    expect(appStore.getAttribute('type')).toBe('button')
    expect(googlePlay.tagName).toBe('BUTTON')
    expect(appStore.querySelector('img').getAttribute('src')).toBe('app-store.png')
  })

  it.each([['click', null], ['Enter', '{Enter}'], ['Space', ' ']])('%s on a badge opens its store link in a new, isolated tab', async (_label, key) => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithProviders(<AppLayout {...buildProps(downloads)} />)

    const googlePlay = screen.getByRole('button', { name: 'Google Play' })
    if (key) {
      googlePlay.focus()
      await user.keyboard(key)
    } else {
      await user.click(googlePlay)
    }

    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(GOOGLE_PLAY, '_blank', 'noopener,noreferrer')
  })

  it('prefers a name carried by the item over the one deduced from its link', () => {
    renderWithProviders(<AppLayout {...buildProps([{ id: 1, icon: 'a.png', link: APP_STORE, name: 'iOS app' }])} />)

    expect(screen.getByRole('button', { name: 'iOS app' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'App Store' })).toBeNull()
  })
})

describe('AppLayout support link', () => {
  it('points the support link at the Ordering.co support page and reads «Contact support»', () => {
    const { container } = renderWithProviders(<AppLayout {...buildProps([])} />, SUPPORT_ROUTE)

    const link = container.querySelector('a[target="_blank"]')
    expect(link.getAttribute('href')).toBe('https://www.ordering.co/support/')
    // redesign tanda AB (C-2): the text is «Contact support»; (main #481): the href is Ordering.co's
    expect(link.textContent).toBe('Contact support')
    // redesign tanda AB (C-3 review): a space between the sentence and the link
    expect(container.textContent).toContain('here: Contact support')
  })

  it('keeps the same support page, with no «undefined» anywhere, when the project has no subdomain', () => {
    api.subdomain = undefined
    const { container } = renderWithProviders(<AppLayout {...buildProps([])} />, SUPPORT_ROUTE)

    const sales = 'https://www.ordering.co/support/'
    const link = container.querySelector('a[target="_blank"]')
    expect(link.getAttribute('href')).toBe(sales)
    expect(link.textContent).toBe('Contact support')
    container.querySelectorAll('a[href]').forEach((a) => expect(a.getAttribute('href')).not.toContain('undefined'))
    expect(container.textContent).not.toContain('undefined')
  })
})
