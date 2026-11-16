/* eslint-disable import/first */
import React from 'react'
import { act } from 'react'
import { beforeEach, afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  online: true,
  handlers: {}
}))

vi.mock('../../../../../index.js', () => {
  const events = {
    on: (name, fn) => { (mocks.handlers[name] = mocks.handlers[name] || new Set()).add(fn) },
    off: (name, fn) => { mocks.handlers[name]?.delete(fn) }
  }
  return {
    useLanguage: () => [null, (_key, fallback) => fallback],
    useEvent: () => [events]
  }
})

vi.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mocks.online
}))

import { WebsocketConnectionBanner } from '..'

const emit = (name) => act(() => { mocks.handlers[name]?.forEach(fn => fn()) })

// redesign (R2): the real-time connection notice on Product (InlineNotice warning), same events and copy.
describe('WebsocketConnectionBanner', () => {
  const originalLocation = window.location

  beforeEach(() => {
    mocks.online = true
    mocks.handlers = {}
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('is hidden on mount', () => {
    renderWithProviders(<WebsocketConnectionBanner />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a warning alert after websocket_connection_failed, with the blocked subtitle while online', () => {
    renderWithProviders(<WebsocketConnectionBanner />)

    emit('websocket_connection_failed')

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByText('Connection issue')).toBeInTheDocument()
    expect(screen.getByText(/Real-time updates are unavailable\./)).toBeInTheDocument()
    expect(screen.queryByText(/No internet connection detected/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('data-variant', 'secondary')
    expect(alert.querySelector('.odc-notice-action')).toContainElement(screen.getByRole('button', { name: 'Close' }))
  })

  it('uses the offline subtitle when the browser has no network', () => {
    mocks.online = false
    renderWithProviders(<WebsocketConnectionBanner />)

    emit('websocket_connection_failed')

    expect(screen.getByText('No internet connection detected. Check your network and try again.')).toBeInTheDocument()
    expect(screen.queryByText(/Real-time updates are unavailable/)).not.toBeInTheDocument()
  })

  it('hides on Close until the next restored + failed pair', () => {
    renderWithProviders(<WebsocketConnectionBanner />)

    emit('websocket_connection_failed')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    emit('websocket_connection_failed')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    emit('websocket_connection_restored')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    emit('websocket_connection_failed')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('hides when the connection is restored', () => {
    renderWithProviders(<WebsocketConnectionBanner />)

    emit('websocket_connection_failed')
    emit('websocket_connection_restored')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reloads the page on Refresh', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
    renderWithProviders(<WebsocketConnectionBanner />)

    emit('websocket_connection_failed')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops listening when it unmounts', () => {
    const { unmount } = renderWithProviders(<WebsocketConnectionBanner />)
    expect(mocks.handlers.websocket_connection_failed.size).toBe(1)

    unmount()

    expect(mocks.handlers.websocket_connection_failed.size).toBe(0)
    expect(mocks.handlers.websocket_connection_restored.size).toBe(0)
  })
  // (2): the ✕ unmounts with the notice; the focus it had goes to the start of the page, not to <body>.
  it('gives the focus of the ✕ to the start of the page when it closes the notice', () => {
    // jsdom draws no boxes; focusPageStart only picks a heading that has one
    const rects = vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}])
    onTestFinished(() => rects.mockRestore())
    renderWithProviders(<><WebsocketConnectionBanner /><main><h1>Orders list</h1></main></>)
    emit('websocket_connection_failed')

    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    fireEvent.click(close)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Orders list' }))
  })

  it('leaves the focus where it is when the ✕ did not have it', () => {
    renderWithProviders(<><WebsocketConnectionBanner /><main><h1>Orders list</h1><input aria-label='Search' /></main></>)
    emit('websocket_connection_failed')

    const search = screen.getByRole('textbox', { name: 'Search' })
    search.focus()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(document.activeElement).toBe(search)
  })
})
