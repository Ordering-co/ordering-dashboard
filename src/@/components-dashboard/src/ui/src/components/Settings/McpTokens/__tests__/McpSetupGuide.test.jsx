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

  it('copies one canonical prompt without tenant or credentials, regardless of manual client', async () => {
    const { rerender } = render(guide())
    const copy = screen.getByRole('button', { name: 'Copy prompt to connect' })
    fireEvent.click(copy)
    await waitFor(() => expect(copy).toHaveTextContent('Copied'))
    const prompt = navigator.clipboard.writeText.mock.calls[0][0]
    expect(prompt).toBe('Connect me to Ordering.co: clone https://github.com/Ordering-co/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step.')
    rerender(guide({ url: 'https://api.ordering.co/mcp/project-b', token: 'ord_mcp_DO_NOT_COPY' }))
    fireEvent.click(copy)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2))
    expect(navigator.clipboard.writeText.mock.calls[1][0]).toBe(prompt)
    expect(prompt).not.toContain('project-b')
    expect(prompt).not.toContain('DO_NOT_COPY')
    expect(screen.getByRole('link', { name: 'Complete guide' })).toHaveAttribute('href', 'https://docs.ordering.co/docs/developers/mcp/')
  })

  it('reports clipboard failure and supports retry without falsely saying copied', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Denied'))
    render(guide())
    const copy = screen.getByRole('button', { name: 'Copy prompt to connect' })
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
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt to connect' }))
    expect(await screen.findByText('Copy failed. Try again.')).toBeInTheDocument()
  })

  it('ignores obsolete completions when a copy consumer changes text', async () => {
    const oldCopy = deferred()
    const currentCopy = deferred()
    navigator.clipboard.writeText.mockReturnValueOnce(oldCopy.promise).mockReturnValueOnce(currentCopy.promise)
    const consumer = text => <ThemeProvider theme={theme}><McpCopyButton text={text} buttonText='Copy prompt to connect' /></ThemeProvider>
    const { rerender } = render(consumer('first'))
    const copy = screen.getByRole('button', { name: 'Copy prompt to connect' })
    fireEvent.click(copy)
    expect(copy).toBeDisabled()
    rerender(consumer('second'))
    expect(copy).toBeEnabled()
    fireEvent.click(copy)
    await act(async () => oldCopy.resolve())
    expect(copy).toBeDisabled()
    expect(copy).not.toHaveTextContent('Copied')
    await act(async () => currentCopy.resolve())
    expect(copy).toHaveTextContent('Copied')
  })

  it('ignores obsolete failures when a copy consumer changes text', async () => {
    const oldCopy = deferred()
    navigator.clipboard.writeText.mockReturnValueOnce(oldCopy.promise)
    const consumer = text => <ThemeProvider theme={theme}><McpCopyButton text={text} buttonText='Copy prompt to connect' /></ThemeProvider>
    const { rerender } = render(consumer('first'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt to connect' }))
    rerender(consumer('second'))
    await act(async () => oldCopy.reject(new Error('Denied')))
    expect(screen.getByRole('button', { name: 'Copy prompt to connect' })).toHaveTextContent('Copy prompt to connect')
  })

  it('resets successful feedback after two seconds and cancels timers on unmount', async () => {
    vi.useFakeTimers()
    const { unmount } = render(guide())
    const copy = screen.getByRole('button', { name: 'Copy prompt to connect' })
    await act(async () => fireEvent.click(copy))
    expect(copy).toHaveTextContent('Copied')
    act(() => vi.advanceTimersByTime(2000))
    expect(copy).toHaveTextContent('Copy prompt to connect')
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
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt to connect' }))
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
