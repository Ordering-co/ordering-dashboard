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
  Popup: () => null
}))
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
    const { container, rerender } = renderWithProviders(
      <BusinessWidgets business={{ slug: 'chick_fil_a' }} />,
      { theme: themeJson }
    )
    const textareas = container.querySelectorAll('textarea')

    expect([...textareas].slice(0, 2).map(textarea => textarea.value)).toEqual(['', ''])
    expect(textareas[2].value).toContain('RewriteEngine On')

    websiteState.url = 'https://v26-22sept.orderingplus.com/store/chick_fil_a'
    rerender(<BusinessWidgets business={{ slug: 'chick_fil_a' }} />)

    expect(textareas[0].value).toContain(websiteState.url)
    expect(textareas[1].value).toContain(websiteState.url)
    expect(textareas[0].value).toContain('/store/chick_fil_a')
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
})
