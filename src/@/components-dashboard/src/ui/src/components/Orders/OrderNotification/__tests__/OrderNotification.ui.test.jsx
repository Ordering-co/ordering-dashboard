/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ handlers: {}, configs: {}, loading: false }))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: runtime.configs, loading: runtime.loading }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useEvent: () => [{
    on: (name, handler) => { runtime.handlers[name] = handler },
    off: (name) => { delete runtime.handlers[name] }
  }],
  OrderNotification: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('react-toastify', () => ({ toast: Object.assign(vi.fn(), { configure: vi.fn() }) }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))
vi.mock('react-toastify/dist/ReactToastify.css', () => ({}))
// Legacy modal and alert: a real dialog only when open, so a stray modal is visible to the test.
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Modal: ({ open, title, children }) => (open ? <div role='dialog' aria-label={title || 'modal'}>{children}</div> : null)
}))

import { OrderNotification } from '..'
import { toast } from 'react-toastify'
import { captureException } from '@sentry/react'

const theme = {
  colors: {},
  images: { general: { registerOrder: 'register.png' }, logos: { isotype: 'iso.png' } },
  sounds: { notificationOgg: 'n.ogg', notificationMp3: 'n.mp3' }
}
const mount = (props) => render(<ThemeProvider theme={theme}><OrderNotification {...props} /></ThemeProvider>)

const SOUND = 'The sound will be played on this page whenever a new order is received.'

describe('OrderNotification UI · sound notice', () => {
  beforeEach(() => {
    localStorage.clear()
    runtime.handlers = {}
    runtime.configs = {}
    runtime.loading = false
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  })

  it('shows an inline info notice with the sound text, Accept and Don’t show again', () => {
    mount()
    const notice = screen.getByText(SOUND).closest('[data-tone]')
    expect(notice).toHaveAttribute('data-tone', 'info')
    expect(notice).toHaveAttribute('role', 'status')
    expect(within(notice).getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(within(notice).getByRole('button', { name: 'Don\'t show again' })).toBeInTheDocument()
    expect(notice.querySelector('svg.odc-icon')).toBeInTheDocument()
  })

  it('is not a modal: no dialog, nothing inert, focus is not taken', () => {
    const before = document.activeElement
    mount()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(document.querySelector('[aria-modal="true"]')).toBeNull()
    expect(document.activeElement).toBe(before)
  })

  it('does not show when the choice was already saved (same key as before)', () => {
    localStorage.setItem('new_order_notification', '1')
    mount()
    expect(screen.queryByText(SOUND)).not.toBeInTheDocument()
  })

  it('Accept closes the notice and saves nothing', async () => {
    mount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.queryByText(SOUND)).not.toBeInTheDocument()
    expect(localStorage.getItem('new_order_notification')).toBeNull()
  })

  it('Don’t show again saves new_order_notification=1 and closes', async () => {
    mount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Don\'t show again' }))
    expect(localStorage.getItem('new_order_notification')).toBe('1')
    expect(screen.queryByText(SOUND)).not.toBeInTheDocument()
  })

  it('has no text of its own beyond the translated keys (no raw keys on screen)', () => {
    const { container } = mount()
    expect(container.textContent).not.toMatch(/SOUND_WILL_BE_PLAYED|DONT_SHOW_AGAIN|ACCEPT/)
  })
})

// redesign 5.4: the new orders modal is a Product Dialog (C8): title "New orders received", one line per
// order and a primary "Got it". What this block asserts about the old markup (the h1 "New orders have been
// received!", "Order #77 has been ordered." and the artwork) was replaced; the trigger and the ids are the same.
describe('OrderNotification UI · new orders dialog (redesign 5.4)', () => {
  // One act per order: the controller registers the handler again after each arrival, as the socket does.
  const arrive = (...orders) => orders.forEach(order => act(() => runtime.handlers.order_added(order)))
  const lines = dialog => within(dialog).getAllByRole('listitem').map(item => item.textContent)

  beforeEach(() => {
    localStorage.setItem('new_order_notification', '1')
    runtime.handlers = {}
    runtime.configs = {}
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  })
  afterEach(() => {
    document.getElementById('app-modals')?.remove()
    vi.useRealTimers()
  })

  it('opens a medium dialog named New orders received with the order that arrived, on order_added', async () => {
    mount()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    arrive({ id: 77, delivery_type: 1 })
    const dialog = await screen.findByRole('dialog', { name: 'New orders received' })
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(lines(dialog)).toEqual(['Order #77'])
    expect(within(dialog).getByText('#77')).toHaveClass('odc-mono')
  })

  it('lists one line per order and has no decorative image', async () => {
    mount()
    arrive({ id: 77, delivery_type: 1 }, { id: 78, delivery_type: 1 })
    const dialog = await screen.findByRole('dialog')
    expect(lines(dialog)).toEqual(['Order #77', 'Order #78'])
    expect(dialog.querySelector('img')).toBeNull()
    expect(within(dialog).queryByText(/has been ordered/)).not.toBeInTheDocument()
  })

  it('footer has one primary Got it and focus starts there', async () => {
    mount()
    arrive({ id: 77, delivery_type: 1 })
    const dialog = await screen.findByRole('dialog')
    const footer = within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button')
    expect(footer.map(button => button.textContent)).toEqual(['Got it'])
    expect(footer[0]).toHaveAttribute('data-variant', 'primary')
    await waitFor(() => expect(footer[0]).toHaveFocus())
  })

  it.each([
    ['Got it', user => user.click(screen.getByRole('button', { name: 'Got it' }))],
    ['the close button', user => user.click(screen.getByRole('button', { name: 'Close' }))],
    ['Escape', user => user.keyboard('{Escape}')]
  ])('%s closes it and empties the list: the next order starts a fresh one', async (_, dismiss) => {
    const user = userEvent.setup()
    mount()
    arrive({ id: 77, delivery_type: 1 })
    await screen.findByRole('dialog')
    await dismiss(user)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    arrive({ id: 90, delivery_type: 1 })
    expect(lines(await screen.findByRole('dialog'))).toEqual(['Order #90'])
  })

  it('does not list the same order twice', async () => {
    mount()
    arrive({ id: 77, delivery_type: 1 }, { id: 77, delivery_type: 1 })
    expect(lines(await screen.findByRole('dialog'))).toEqual(['Order #77'])
  })

  it('with the toast configured it opens no dialog', () => {
    runtime.configs = { notification_toast: { value: 'true' } }
    mount()
    arrive({ id: 77, delivery_type: 1 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ignores gift cards, other customers and non-delivery orders as before', () => {
    mount({ customerId: 5, isOnlyDelivery: true })
    arrive({ id: 1, products: [{ type: 'gift_card' }], customer_id: 5, delivery_type: 1 })
    arrive({ id: 2, customer_id: 6, delivery_type: 1 })
    arrive({ id: 3, customer_id: 5, delivery_type: 2 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the sound looping every 3 s while it is open and stops when it closes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mount()
    fireEvent.mouseDown(document)
    arrive({ id: 77, delivery_type: 1 })
    await screen.findByRole('dialog')
    HTMLMediaElement.prototype.play.mockClear()
    act(() => { vi.advanceTimersByTime(3100) })
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    HTMLMediaElement.prototype.play.mockClear()
    act(() => { vi.advanceTimersByTime(9000) })
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('has no dialog left over from the removed alert', () => {
    mount()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Ordering')).not.toBeInTheDocument()
  })
})

const nativePlay = HTMLMediaElement.prototype.play

describe('OrderNotification UI · audio playback failures', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.setItem('new_order_notification', '1')
    runtime.handlers = {}
    runtime.configs = {}
    runtime.loading = false
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    vi.mocked(toast).mockClear()
    vi.mocked(captureException).mockClear()
  })

  afterEach(() => {
    HTMLMediaElement.prototype.play = nativePlay
    document.getElementById('app-modals')?.remove()
    vi.useRealTimers()
  })

  const arrive = () => act(() => runtime.handlers.order_added({ id: 77, delivery_type: 1 }))

  it.each(['dialog', 'toast'])('keeps the %s notification when playback is blocked', async (mode) => {
    runtime.configs = { notification_toast: { value: String(mode === 'toast') } }
    HTMLMediaElement.prototype.play.mockRejectedValue(new DOMException('Playback blocked', 'NotAllowedError'))
    mount()
    fireEvent.mouseDown(document)
    arrive()
    await act(async () => { await vi.advanceTimersByTimeAsync(6100) })

    if (mode === 'toast') {
      expect(toast).toHaveBeenCalledTimes(1)
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
    } else {
      expect(screen.getByRole('dialog', { name: 'New orders received' })).toHaveTextContent('Order #77')
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
    }
    expect(captureException).not.toHaveBeenCalled()
  })

  it('starts the interval after a later interaction and stops on unmount', async () => {
    const { unmount } = mount()
    arrive()
    await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    fireEvent.mouseDown(document)
    await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  })

  it.each(['dialog', 'toast'])('respects disabled sound in %s mode', async (mode) => {
    runtime.configs = {
      notification_toast: { value: String(mode === 'toast') },
      disable_sound_notification: true
    }
    mount()
    fireEvent.mouseDown(document)
    arrive()
    await act(async () => { await vi.advanceTimersByTimeAsync(6100) })
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    if (mode === 'toast') expect(toast).toHaveBeenCalledTimes(1)
    else expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('reports unexpected playback failures as handled errors', async () => {
    const error = new DOMException('Unsupported source', 'NotSupportedError')
    runtime.configs = { notification_toast: { value: 'true' } }
    HTMLMediaElement.prototype.play.mockRejectedValue(error)
    mount()
    fireEvent.mouseDown(document)
    arrive()
    await act(async () => {})
    expect(toast).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(error)
  })

  it('reports one unexpected dialog failure while the sound repeats', async () => {
    const error = new DOMException('Unsupported source', 'NotSupportedError')
    HTMLMediaElement.prototype.play.mockRejectedValue(error)
    mount()
    fireEvent.mouseDown(document)
    arrive()
    await act(async () => { await vi.advanceTimersByTimeAsync(6100) })
    expect(screen.getByRole('dialog', { name: 'New orders received' })).toHaveTextContent('Order #77')
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(error)
  })

  it('does not report playback interrupted by a close or a new load', async () => {
    runtime.configs = { notification_toast: { value: 'true' } }
    HTMLMediaElement.prototype.play.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
    mount()
    fireEvent.mouseDown(document)
    arrive()
    await act(async () => {})
    expect(toast).toHaveBeenCalledTimes(1)
    expect(captureException).not.toHaveBeenCalled()
  })
})

// redesign F6d (Q3-03): from 768px the sound notice is one line like the connection one: the text clips with an ellipsis
// (and says itself in a title) and the actions keep their place. Under 768px it still wraps: there it is what there is to read.
describe('OrderNotification UI · one line from 768px (Q3-03)', () => {
  beforeEach(() => { localStorage.clear() })

  const css = readFileSync(path.join(__dirname, '../order-notification.css'), 'utf8')
  const ruleOf = (selector, source = css) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [...source.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*{([^}]*)}`, 'g'))].map(match => match[1]).join('\n')
  }
  const mediaOf = (query) => css.match(new RegExp(`@media\\s*\\(${query}\\)\\s*{([\\s\\S]*?)\\n}`))?.[1] ?? ''

  it('carries the full text as a title, for when it is clipped', () => {
    mount()
    expect(screen.getByText(SOUND)).toHaveAttribute('title', SOUND)
  })

  it('wraps and keeps its text basis only under 768px', () => {
    const phone = mediaOf('max-width:\\s*767px')
    expect(phone).toMatch(/\.odc-notice\.odc-sound-notice\s*{[^}]*flex-wrap:\s*wrap/)
    expect(phone).toMatch(/\.odc-notice-text\s*{[^}]*flex:\s*1 1 var\(--od-x-measure\)/)
    const outsideMedia = css.replace(/@media[^{]*{[\s\S]*?\n}/g, '')
    expect(ruleOf('.odc-notice.odc-sound-notice', outsideMedia)).not.toMatch(/flex-wrap:\s*wrap/)
    expect(outsideMedia).not.toMatch(/--od-x-measure/)
  })

  it('from 768px does not wrap: the text takes what is left and clips with an ellipsis, the actions stay in one row', () => {
    const wide = mediaOf('min-width:\\s*768px')
    expect(wide).toMatch(/\.odc-notice\.odc-sound-notice\s*{[^}]*flex-wrap:\s*nowrap/)
    expect(wide).toMatch(/\.odc-sound-notice \.odc-notice-text\s*{[^}]*flex:\s*1 1 0/)
    expect(wide).toMatch(/\.odc-sound-notice \.odc-notice-text\s*{[^}]*text-overflow:\s*ellipsis/)
    expect(wide).toMatch(/\.odc-sound-notice \.odc-notice-text\s*{[^}]*white-space:\s*nowrap/)
    expect(wide).toMatch(/\.odc-sound-actions\s*{[^}]*flex-wrap:\s*nowrap/)
  })
})
