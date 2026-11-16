import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const websiteState = vi.hoisted(() => ({ url: null }))

vi.mock('../useWebsiteUrl', () => ({
  useWebsiteUrl: () => websiteState.url,
  useStoreWebsiteUrl: () => websiteState.url
}))
vi.mock('../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{}, { configurations: { support_url: 'https://support.orderingplus.com' } }],
  useSession: () => [{ user: { level: 2 } }],
  useSite: () => [{ sites: [], loading: false }],
  Popup: () => null
}))
// redesign stores 5.15a: BusinessWidgets waits for the project's plan before saying a store has no address
vi.mock('../../contexts/ProjectContext', () => ({ useProjectState: () => [{ loading: false }] }))
vi.mock('../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

import { BusinessWidgets } from '../../components/Stores/BusinessWidgets'
import { OrderingWidgets } from '../../components/MyProducts/OrderingWidgets'

beforeEach(() => {
  websiteState.url = null
})

describe('widget website URLs', () => {
  it('updates BusinessWidgets scripts when the subscription URL resolves', () => {
    // redesign stores 5.15a (G5-05): without the address the two scripts that carry it are a notice, not empty boxes;
    // once it resolves they are drawn with it
    const { container, rerender } = renderWithProviders(
      <BusinessWidgets business={{ slug: 'chick_fil_a' }} />,
      { theme: themeJson }
    )
    const values = () => [...container.querySelectorAll('textarea')].map(textarea => textarea.value)

    expect(values().some(value => value.includes('ordering_iframe'))).toBe(false)
    expect(container.textContent).toContain('This store has no website address yet')
    expect(values().some(value => value.includes('RewriteEngine On'))).toBe(true)

    websiteState.url = 'https://v26-22sept.orderingplus.com/store/chick_fil_a'
    rerender(<BusinessWidgets business={{ slug: 'chick_fil_a' }} />)

    const scripts = values().filter(value => value.includes(websiteState.url))
    expect(scripts).toHaveLength(2)
    expect(scripts.every(value => value.includes('/store/chick_fil_a'))).toBe(true)
    expect(container.textContent).not.toContain('This store has no website address yet')
  })

  it('updates OrderingWidgets scripts when the subscription URL resolves', () => {
    const { container, rerender } = renderWithProviders(
      <OrderingWidgets />,
      { theme: themeJson }
    )
    const textareas = container.querySelectorAll('textarea')

    expect([...textareas].slice(0, 3).map(textarea => textarea.value)).toEqual(['', '', ''])
    expect(textareas[3].value).toContain('RewriteEngine On')

    websiteState.url = 'https://v26-22sept.orderingplus.com'
    rerender(<OrderingWidgets />)

    expect([...textareas].slice(0, 3).every(textarea => textarea.value.includes(websiteState.url))).toBe(true)
  })

  it('points the Chat style icon to the Ordering.co brand symbol', () => {
    // redesign ordering-website B1 (OW-04); (#481) moved it to the brand logo
    websiteState.url = 'https://v26-22sept.orderingplus.com'
    const { container } = renderWithProviders(
      <OrderingWidgets />,
      { theme: themeJson }
    )
    const chatStyle = [...container.querySelectorAll('textarea')]
      .map(textarea => textarea.value)
      .find(value => value.includes('ordering_bot_iframe'))

    expect(chatStyle).toContain('https://brand.ordering.co/assets/logos/png/ordering-symbol-color-512.png')
    expect(chatStyle).not.toContain('orderingweb.orderingplus/')
  })
})
