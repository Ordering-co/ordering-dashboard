/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  token: 'a-token',
  root: 'https://api.example.com',
  project: 'current',
  config: { configs: {}, fetchedWithToken: true }
}))

vi.mock('../../../../../index', () => ({
  useApi: () => [{ root: mocks.root, project: mocks.project }],
  useSession: () => [{ token: mocks.token }],
  useConfig: () => [mocks.config]
}))
vi.mock('~/analytics/posthog', () => ({ captureDashboardOperation: vi.fn() }))

import { ProjectProvider, useProjectState } from '..'

const Probe = () => {
  const [state] = useProjectState()
  return <pre data-testid='state'>{JSON.stringify(state)}</pre>
}

const mockFetchSequence = (responses) => {
  let call = 0
  global.fetch = vi.fn((url) => {
    if (url.endsWith('/current/support')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ error: false, result: { intercom_allowed: true } }) })
    const response = responses[Math.min(call, responses.length - 1)]
    call += 1
    return Promise.resolve({ ok: true, status: 200, json: async () => response })
  })
}

describe('ProjectProvider', () => {
  afterEach(() => {
    mocks.token = 'a-token'
    mocks.root = 'https://api.example.com'
    mocks.project = 'current'
    mocks.config = { configs: {}, fetchedWithToken: true }
    vi.restoreAllMocks()
  })

  it('resolves the first trialing subscription as trialSubscription (not the active plan)', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      {
        error: false,
        result: [
          { status: 'canceled', plan: { plan: { id: 'old' } } },
          { status: 'trialing', trial_end: '2026-02-01T00:00:00.000Z', start_date: '2026-01-01T00:00:00.000Z' }
        ]
      }
    ])

    render(<ProjectProvider><Probe /></ProjectProvider>)

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent)
      expect(state.loading).toBe(false)
    })

    const state = JSON.parse(screen.getByTestId('state').textContent)
    expect(state.trialSubscription).toEqual({
      status: 'trialing',
      trial_end: '2026-02-01T00:00:00.000Z',
      start_date: '2026-01-01T00:00:00.000Z'
    })
    expect(state.websiteProduct).toBe('web_marketplace_26')
    // No 'active' subscription in this fixture: `plan` resolution (pre-existing, untouched
    // logic) finds none, matching the trialing subscription being surfaced separately.
    expect(state.plan).toBeUndefined()
  })

  it('sets trialSubscription to null when there is no trialing subscription', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      { error: false, result: [{ status: 'active', plan: { plan: { id: 'pro' } } }] }
    ])

    render(<ProjectProvider><Probe /></ProjectProvider>)

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent)
      expect(state.loading).toBe(false)
    })

    const state = JSON.parse(screen.getByTestId('state').textContent)
    expect(state.trialSubscription).toBeNull()
    expect(state.plan).toEqual({ id: 'pro' })
    expect(state.websiteProduct).toBe('web_marketplace_26')
  })

  it('sets trialSubscription to null when the subscriptions request errors', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      { error: true, result: null }
    ])

    render(<ProjectProvider><Probe /></ProjectProvider>)

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent)
      expect(state.loading).toBe(false)
    })

    const state = JSON.parse(screen.getByTestId('state').textContent)
    expect(state.trialSubscription).toBeNull()
    expect(state.websiteProduct).toBe('web_marketplace_26')
  })

  it('resolves the franchise website from configs when the subscriptions request errors', async () => {
    mocks.config = { configs: { web_franchises_x: { value: true } }, fetchedWithToken: true }
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      { error: true, result: [{}] }
    ])

    render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false)
    })
    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBe('web_franchises_x')
  })

  it('prefers the marketplace website from configs when both websites are enabled', async () => {
    mocks.config = { configs: { web_franchises_x: { value: true }, web_marketplace_26: { value: true } }, fetchedWithToken: true }
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      { error: true, result: ['Limited access to the billing manager for this project, contact them.'] }
    ])

    render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false)
    })
    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBe('web_marketplace_26')
  })

  it('waits for the session configs before resolving a website without subscriptions', async () => {
    mocks.config = { configs: {}, fetchedWithToken: false }
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      { error: true, result: [{}] }
    ])

    const { rerender } = render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false)
    })
    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBeNull()

    mocks.config = { configs: { web_franchises_x: { value: true } }, fetchedWithToken: true }
    rerender(<ProjectProvider><Probe /></ProjectProvider>)
    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBe('web_franchises_x')
  })

  it('does not carry the configs fallback into the next session', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      { error: true, result: [{}] }
    ])

    const { rerender } = render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBe('web_marketplace_26')
    })

    mocks.token = 'next-token'
    global.fetch = vi.fn(() => new Promise(() => {}))
    rerender(<ProjectProvider><Probe /></ProjectProvider>)

    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBeNull()
  })

  it('keeps the website product unresolved when the project request errors', async () => {
    mockFetchSequence([
      { error: true, result: null },
      {
        error: false,
        result: [{ status: 'active', products: [{ product: { builder_product_unit: 'web_franchises_x' } }] }]
      }
    ])

    render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false)
    })
    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBeNull()
  })

  it('keeps website product unresolved until the subscriptions response settles', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<ProjectProvider><Probe /></ProjectProvider>)

    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBeNull()
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(true)
    })
  })

  it('resolves website product from an active or trialing plan or addon product', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      {
        error: false,
        result: [
          {
            status: 'canceled',
            plan: { plan: { products: [{ product: { builder_product_unit: 'web_franchises_x' } }] } }
          },
          {
            status: 'trialing',
            products: [{ enabled: true, product: { builder_product_unit: 'web_franchises_x' } }]
          }
        ]
      }
    ])

    render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false)
    })
    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBe('web_franchises_x')
  })

  it('clears the previous session trial before the next subscriptions request resolves', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme', current_status: 'active' } },
      {
        error: false,
        result: [
          {
            status: 'trialing',
            trial_end: '2026-02-01T00:00:00.000Z',
            start_date: '2026-01-01T00:00:00.000Z',
            products: [{ enabled: true, product: { builder_product_unit: 'web_franchises_x' } }]
          }
        ]
      }
    ])

    const { rerender } = render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent)
      expect(state.trialSubscription?.status).toBe('trialing')
      expect(state.websiteProduct).toBe('web_franchises_x')
    })

    mocks.token = 'next-token'
    global.fetch = vi.fn(() => new Promise(() => {}))
    rerender(<ProjectProvider><Probe /></ProjectProvider>)

    const state = JSON.parse(screen.getByTestId('state').textContent)
    expect(state.trialSubscription).toBeNull()
    expect(state.websiteProduct).toBeNull()
  })

  it('does not leak a previous project product when its response resolves late', async () => {
    let resolveOldSubscriptions
    global.fetch = vi.fn((url) => {
      if (url === 'https://old-api.example.com/current') {
        return Promise.resolve({
          json: async () => ({ error: false, result: { id: 1, current_status: 'active' } })
        })
      }
      if (url === 'https://old-api.example.com/billing/subscriptions') {
        return new Promise(resolve => { resolveOldSubscriptions = resolve })
      }
      if (url === 'https://new-api.example.com/current') {
        return Promise.resolve({
          json: async () => ({ error: false, result: { id: 2, current_status: 'active' } })
        })
      }
      return Promise.resolve({
        json: async () => ({
          error: false,
          result: [{ status: 'active', products: [{ product: { builder_product_unit: 'web_marketplace_26' } }] }]
        })
      })
    })
    mocks.root = 'https://old-api.example.com'

    const { rerender } = render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => expect(resolveOldSubscriptions).toBeTypeOf('function'))

    mocks.root = 'https://new-api.example.com'
    rerender(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBe('web_marketplace_26')
    })

    await act(async () => {
      resolveOldSubscriptions({
        json: async () => ({
          error: false,
          result: [{
            status: 'active',
            products: [{ product: { builder_product_unit: 'web_franchises_x' } }]
          }]
        })
      })
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(JSON.parse(screen.getByTestId('state').textContent).websiteProduct).toBe('web_marketplace_26')
  })

  it('clears project and plan before a changed identity resolves, including logout', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1, code: 'acme' } },
      { error: false, result: [{ status: 'active', plan: { plan: { id: 100 } } }] }
    ])
    const view = render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('state').textContent).plan?.id).toBe(100))
    mocks.token = null
    view.rerender(<ProjectProvider><Probe /></ProjectProvider>)
    let state = JSON.parse(screen.getByTestId('state').textContent)
    expect(state.plan).toBeNull()
    expect(state.project).toEqual({})
    expect(state.planResolved).toBe(false)
    mocks.token = 'next-token'
    global.fetch = vi.fn(() => new Promise(() => {}))
    view.rerender(<ProjectProvider><Probe /></ProjectProvider>)
    state = JSON.parse(screen.getByTestId('state').textContent)
    expect(state.plan).toBeNull()
    expect(state.planResolved).toBe(false)
  })

  it('distinguishes a confirmed empty plan from unreadable billing', async () => {
    mockFetchSequence([
      { error: false, result: { id: 1 } },
      { error: false, result: [] }
    ])
    const view = render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false))
    expect(JSON.parse(screen.getByTestId('state').textContent).planResolved).toBe(true)
    mocks.token = 'next-token'
    mockFetchSequence([
      { error: false, result: { id: 1 } },
      { error: true, result: null }
    ])
    view.rerender(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false))
    expect(JSON.parse(screen.getByTestId('state').textContent).planResolved).toBe(false)
  })

  it.each([null, {}])('keeps plan unresolved when current returns %j without a project identity', async project => {
    mockFetchSequence([
      { error: false, result: project },
      { error: false, result: [] }
    ])
    render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false))
    expect(JSON.parse(screen.getByTestId('state').textContent).planResolved).toBe(false)
  })

  it.each(['current', 'billing'])('keeps plan unresolved after an unsuccessful %s HTTP response', async failedRequest => {
    global.fetch = vi.fn(async url => {
      const isCurrent = url.endsWith('/current')
      const failed = failedRequest === (isCurrent ? 'current' : 'billing')
      return {
        ok: !failed,
        status: failed ? 503 : 200,
        json: async () => ({ error: false, result: isCurrent ? { id: 1 } : [] })
      }
    })
    render(<ProjectProvider><Probe /></ProjectProvider>)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('state').textContent).loading).toBe(false))
    expect(JSON.parse(screen.getByTestId('state').textContent).planResolved).toBe(false)
  })
})
