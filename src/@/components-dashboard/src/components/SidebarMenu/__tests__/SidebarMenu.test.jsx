/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const session = vi.hoisted(() => ({ current: {} }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [session.current]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Error: 'error' }
}))
vi.mock('../../../utils/fetchAllPages', () => ({
  fetchAllPages: vi.fn().mockResolvedValue({ error: false, result: [] })
}))

import { AI_AGENTS_CODE_TIMEOUT_MS, SidebarMenu } from '../index'

const AI_PROBE_URL = 'https://api.test/v400/en/demo/ai/agents?page=1&page_size=1&params=id'

const UI = ({ aiModuleEnabled }) => <output>{String(aiModuleEnabled)}</output>

describe('SidebarMenu controller AI module access', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    session.current = { token: 'test-token', user: { level: 0 } }
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the AI module as disabled when the AI API answers 403', async () => {
    fetchMock.mockResolvedValue({ status: 403, ok: false })

    render(<SidebarMenu UIComponent={UI} />)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false'))
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(AI_PROBE_URL, expect.objectContaining({ method: 'GET' }))
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
  })

  it('marks the AI module as enabled when the AI API answers', async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true })

    render(<SidebarMenu UIComponent={UI} />)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true'))
  })

  it.each([
    ['a server error', () => Promise.resolve({ status: 500, ok: false })],
    ['a network error', () => Promise.reject(new Error('offline'))]
  ])('leaves the AI module unknown on %s', async (_label, respond) => {
    fetchMock.mockImplementation(respond)

    render(<SidebarMenu UIComponent={UI} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent('null')
  })

  it.each([
    ['a business owner', { token: 'test-token', user: { level: 2 } }],
    ['a missing token', { user: { level: 0 } }]
  ])('does not check the AI module for %s', (_label, current) => {
    session.current = current

    render(<SidebarMenu UIComponent={UI} />)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('null')
  })
})

describe('SidebarMenu controller AI agents code', () => {
  const fetchMock = vi.fn()
  let getAiAgentsCode

  const CodeUI = props => {
    getAiAgentsCode = props.getAiAgentsCode
    return null
  }

  beforeEach(() => {
    // A business owner skips the AI module probe, so the only request is the code
    session.current = { token: 'test-token', user: { level: 2 } }
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks the API for a one-time code for ai.ordering.co with the session in the header', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: { code: 'one-time-code', expires_in: 60 } }) })
    render(<SidebarMenu UIComponent={CodeUI} />)

    await expect(getAiAgentsCode()).resolves.toBe('one-time-code')
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api.test/v400/en/demo/session_codes', expect.objectContaining({ method: 'POST' }))
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ target: 'ai_dashboard' })
  })

  it.each([
    ['an API error', () => Promise.resolve({ json: async () => ({ error: true, result: ['Unauthorized'] }) })],
    ['a network error', () => Promise.reject(new Error('offline'))]
  ])('answers no code on %s', async (_label, respond) => {
    fetchMock.mockImplementation(respond)
    render(<SidebarMenu UIComponent={CodeUI} />)

    await expect(getAiAgentsCode()).resolves.toBeNull()
  })

  it('gives up on a request that hangs, so the blank tab closes', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
      }))
      render(<SidebarMenu UIComponent={CodeUI} />)

      const code = getAiAgentsCode()
      await vi.advanceTimersByTimeAsync(AI_AGENTS_CODE_TIMEOUT_MS)

      await expect(code).resolves.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
