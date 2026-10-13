import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStoreWebsiteUrl, useWebsiteUrl } from '../useWebsiteUrl'

const state = vi.hoisted(() => ({
  project: '22sept',
  subdomain: 'orderingplus',
  sites: [],
  loading: false,
  websiteProduct: 'web_marketplace_26'
}))

vi.mock('../../../../index', () => ({
  useApi: () => [{ project: state.project }, { configurations: { subdomain: state.subdomain } }],
  useSite: () => [{ sites: state.sites, loading: state.loading }]
}))
vi.mock('../../contexts/ProjectContext', () => ({
  useProjectState: () => [{ websiteProduct: state.websiteProduct }]
}))

beforeEach(() => {
  Object.assign(state, {
    project: '22sept',
    subdomain: 'orderingplus',
    sites: [],
    loading: false,
    websiteProduct: 'web_marketplace_26'
  })
})

describe('store website destinations', () => {
  it('uses v26 for the current project and updates when the project changes', () => {
    state.sites = [{ type: 'web_marketplace_26', temporal_domain: '22sept.orderingplus.com' }]
    const { result, rerender } = renderHook(() => useStoreWebsiteUrl('chick_fil_a'))
    expect(result.current).toBe('https://v26-22sept.orderingplus.com/store/chick_fil_a')

    state.project = 'another-project'
    state.sites = []
    rerender()
    expect(result.current).toBe('https://v26-another-project.orderingplus.com/store/chick_fil_a')
  })

  it('preserves the subscribed site custom domain and switches to Franchise', () => {
    state.sites = [
      { type: 'web_marketplace_26', domain: 'menu.example.com/', ssl_process_status: 'ended' },
      { type: 'franchiseweb', temporal_domain: '22sept.franchises.orderingplus.com' }
    ]
    const { result, rerender } = renderHook(() => useStoreWebsiteUrl('chick_fil_a'))
    expect(result.current).toBe('https://menu.example.com/store/chick_fil_a')
    state.websiteProduct = 'web_franchises_x'
    rerender()
    expect(result.current).toBe('https://22sept.franchises.orderingplus.com/store/chick_fil_a')
  })

  it('withholds links while unresolved or loading and when the store is missing', () => {
    const { result, rerender } = renderHook(({ slug }) => useStoreWebsiteUrl(slug), {
      initialProps: { slug: null }
    })
    expect(result.current).toBeNull()
    state.websiteProduct = null
    rerender({ slug: 'chick_fil_a' })
    expect(result.current).toBeNull()
    state.websiteProduct = 'web_marketplace_26'
    state.loading = true
    rerender({ slug: 'chick_fil_a' })
    expect(result.current).toBeNull()
    state.loading = false
    rerender({ slug: 'chick_fil_a' })
    expect(result.current).toBe('https://v26-22sept.orderingplus.com/store/chick_fil_a')
  })

  it('provides the same website root for project widgets', () => {
    const { result } = renderHook(() => useWebsiteUrl())
    expect(result.current).toBe('https://v26-22sept.orderingplus.com')
  })
})
