import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import theme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { McpSetupGuide } from '../McpSetupGuide'
import { McpCopyButton } from '../shared'

const status = { url: 'https://api.ordering.co/mcp/project-a', tools: ['whoami'] }
const guide = (currentStatus = status) => <ThemeProvider theme={theme}><McpSetupGuide status={currentStatus} /></ThemeProvider>
const deferred = () => {
  let resolvePromise, rejectPromise
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('MCP setup prompt copy', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('copies the default Claude prompt, then the selected Codex prompt with the current project URL', async () => {
    const { rerender } = render(guide())
    const copy = screen.getByRole('button', { name: 'Copy to LLM' })
    expect(copy).toHaveTextContent('Copy to LLM')
    fireEvent.click(copy)
    await waitFor(() => expect(copy).toHaveTextContent('Copied'))
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('connecting Ordering MCP to Claude Code')
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain(status.url)
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('"Authorization": "Bearer ${ORDERING_MCP_KEY}"') // eslint-disable-line no-template-curly-in-string

    fireEvent.click(screen.getByRole('tab', { name: 'Codex' }))
    expect(copy).toHaveTextContent('Copy to LLM')
    rerender(guide({ url: 'https://api.ordering.co/mcp/project-b', token: 'ord_mcp_DO_NOT_COPY' }))
    fireEvent.click(copy)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2))
    const prompt = navigator.clipboard.writeText.mock.calls[1][0]
    expect(prompt).toContain('connecting Ordering MCP to Codex')
    expect(prompt).toContain('https://api.ordering.co/mcp/project-b')
    expect(prompt).toContain('bearer_token_env_var = "ORDERING_MCP_KEY"')
    expect(prompt).not.toContain('project-a')
    expect(prompt).not.toContain('DO_NOT_COPY')
  })

  it('reports clipboard failure and supports retry without falsely saying copied', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Denied'))
    render(guide())
    const copy = screen.getByRole('button', { name: 'Copy to LLM' })
    fireEvent.click(copy)
    await waitFor(() => expect(copy).toHaveTextContent('Copy failed. Try again.'))
    expect(copy).not.toHaveTextContent('Copied')
    expect(copy).toBeEnabled()
    fireEvent.click(copy)
    await waitFor(() => expect(copy).toHaveTextContent('Copied'))
  })

  it('handles an unavailable clipboard without unhandled errors', async () => {
    Object.assign(navigator, { clipboard: undefined })
    render(guide())
    fireEvent.click(screen.getByRole('button', { name: 'Copy to LLM' }))
    expect(await screen.findByText('Copy failed. Try again.')).toBeInTheDocument()
  })

  it('ignores an obsolete clipboard completion after changing assistant, including its pending state', async () => {
    const oldCopy = deferred()
    const currentCopy = deferred()
    navigator.clipboard.writeText.mockReturnValueOnce(oldCopy.promise).mockReturnValueOnce(currentCopy.promise)
    render(guide())
    const copy = screen.getByRole('button', { name: 'Copy to LLM' })
    fireEvent.click(copy)
    expect(copy).toBeDisabled()
    fireEvent.click(screen.getByRole('tab', { name: 'Codex' }))
    expect(copy).toBeEnabled()
    fireEvent.click(copy)
    await act(async () => oldCopy.resolve())
    expect(copy).toBeDisabled()
    expect(copy).not.toHaveTextContent('Copied')
    await act(async () => currentCopy.resolve())
    expect(copy).toBeEnabled()
    expect(copy).toHaveTextContent('Copied')
  })

  it('ignores an obsolete failure after the project URL changes', async () => {
    const oldCopy = deferred()
    navigator.clipboard.writeText.mockReturnValueOnce(oldCopy.promise)
    const { rerender } = render(guide())
    const copy = screen.getByRole('button', { name: 'Copy to LLM' })
    fireEvent.click(copy)
    rerender(guide({ url: 'https://api.ordering.co/mcp/project-b' }))
    await act(async () => oldCopy.reject(new Error('Denied')))
    expect(copy).toHaveTextContent('Copy to LLM')
    expect(copy).toBeEnabled()
  })

  it('resets successful feedback after two seconds and cancels timers on unmount', async () => {
    vi.useFakeTimers()
    const { unmount } = render(guide())
    const copy = screen.getByRole('button', { name: 'Copy to LLM' })
    await act(async () => fireEvent.click(copy))
    expect(copy).toHaveTextContent('Copied')
    act(() => vi.advanceTimersByTime(2000))
    expect(copy).toHaveTextContent('Copy to LLM')
    await act(async () => fireEvent.click(copy))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a feedback timer when copying completes after unmount', async () => {
    vi.useFakeTimers()
    const pending = deferred()
    navigator.clipboard.writeText.mockReturnValueOnce(pending.promise)
    const { unmount } = render(guide())
    fireEvent.click(screen.getByRole('button', { name: 'Copy to LLM' }))
    unmount()
    await act(async () => pending.resolve())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the visible Copy label and aria-only labels of existing key/URL consumers', async () => {
    render(<ThemeProvider theme={theme}><McpCopyButton text='test-key' label='Copy the key' /></ThemeProvider>)
    const copy = screen.getByRole('button', { name: 'Copy the key' })
    expect(copy).toHaveTextContent(/^Copy$/)
    fireEvent.click(copy)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-key'))
    expect(copy).toHaveTextContent('Copied')
  })
})
