/* eslint-disable import/first */
// main #399 and #400: the plugin page of Connect in a Product Dialog. The cases of main's
// BusinessSummaryPluginMessages.test.jsx that belong to the frame (messages, loading, height) run here on PluginFrameDialog; the launch
// and the placeholders are usePluginPage's (hooks/__tests__/usePluginPage.test.jsx, utils/__tests__/pluginPages.test.js).
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))

import { PluginFrameDialog } from '../PluginFrameDialog'

const URL_ = 'https://clover.example/wizard?code=one-time'
let handlers
const draw = (frame = {}, businessId = 7) => {
  handlers = { onClose: vi.fn(), onReload: vi.fn() }
  return render(
    <PluginFrameDialog
      frame={{ open: true, url: URL_, title: 'Clover', ...frame }}
      businessId={businessId}
      {...handlers}
    />
  )
}
const frame = () => screen.getByTitle('Clover')
const post = (data, origin = 'https://clover.example', source = frame().contentWindow) => act(() => {
  window.dispatchEvent(new MessageEvent('message', { source, origin, data: { type: 'ordering:plugin', ...data } }))
})

beforeEach(() => { mocks.showToast.mockClear() })
afterEach(() => { vi.useRealTimers() })

describe('PluginFrameDialog messages (main #399)', () => {
  it('reads the store again and stays open when the setup succeeded', () => {
    draw()
    post({ event: 'setup_finished', status: 'success', business_id: 7 })
    expect(handlers.onReload).toHaveBeenCalledTimes(1)
    expect(handlers.onClose).not.toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Clover connected.')
  })

  it('closes after the setup when the page asks', () => {
    draw()
    post({ event: 'setup_finished', status: 'success', business_id: 7, close: true })
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
    expect(handlers.onReload).toHaveBeenCalledTimes(1)
  })

  it('reads the store again but stays open when the setup failed, with the reason of the page', () => {
    draw()
    post({ event: 'setup_finished', status: 'failed', message: 'Wrong merchant', business_id: 7 })
    expect(handlers.onReload).toHaveBeenCalledTimes(1)
    expect(handlers.onClose).not.toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Wrong merchant')
  })

  it('closes on request, like the X, and reads the store again', () => {
    draw()
    post({ event: 'close' })
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
    expect(handlers.onReload).toHaveBeenCalledTimes(1)
  })

  it('ignores messages from another origin, another frame or about another store', () => {
    draw()
    post({ event: 'close' }, 'https://evil.example')
    post({ event: 'close' }, 'https://clover.example', window)
    post({ event: 'setup_finished', status: 'success', business_id: 8 })
    expect(handlers.onClose).not.toHaveBeenCalled()
    expect(handlers.onReload).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })
})

describe('PluginFrameDialog loading and size (main #400)', () => {
  it('shows the plugin loading until its page loads, then fades it in', () => {
    draw()
    expect(screen.getByRole('status')).toHaveTextContent('Loading Clover…')
    expect(frame()).not.toHaveAttribute('data-loaded')
    fireEvent.load(frame())
    expect(screen.queryByRole('status')).toBeNull()
    expect(frame()).toHaveAttribute('data-loaded')
  })

  it('a page that fits opens small at its remembered height and follows the height it reports, and nothing else happens', () => {
    draw({ fits: true, initialHeight: 410, frameKey: 'clover:setup' })
    const dialog = screen.getByRole('dialog', { name: 'Clover' })
    expect(dialog.style.getPropertyValue('--psp-frame-inline-size')).toBe('640px')
    const box = frame().parentElement
    expect(box.style.getPropertyValue('--psp-frame-block-size')).toBe('410px')
    post({ event: 'resize', height: 520 })
    expect(box.style.getPropertyValue('--psp-frame-block-size')).toBe('520px')
    expect(handlers.onReload).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('takes the size a page asks for once, and ignores a resize from another origin', () => {
    draw({ fits: true })
    const dialog = screen.getByRole('dialog', { name: 'Clover' })
    const box = frame().parentElement
    expect(box.style.getPropertyValue('--psp-frame-block-size')).toBe('320px')
    post({ event: 'resize', height: 300, size: 'medium' })
    post({ event: 'resize', height: 300, size: 'large' })
    expect(dialog.style.getPropertyValue('--psp-frame-inline-size')).toBe('900px')
    post({ event: 'resize', height: 600 }, 'https://evil.example')
    expect(box.style.getPropertyValue('--psp-frame-block-size')).toBe('300px')
  })

  // as useShowPluginPage does it for a plugin with links.launch: the window opens first, the one-time URL comes after
  it('gives the maximum height to a page that fits and never reports its height', () => {
    vi.useFakeTimers()
    const { rerender } = draw({ fits: true, url: null })
    rerender(<PluginFrameDialog frame={{ open: true, url: URL_, title: 'Clover', fits: true }} businessId={7} {...handlers} />)
    fireEvent.load(frame())
    act(() => { vi.advanceTimersByTime(1500) })
    const max = Math.floor(window.innerHeight * 0.8)
    expect(frame().parentElement.style.getPropertyValue('--psp-frame-block-size')).toBe(`${max}px`)
  })

  it('any other page keeps the large Dialog and its fixed height', () => {
    draw()
    expect(screen.getByRole('dialog', { name: 'Clover' }).style.getPropertyValue('--psp-frame-inline-size')).toBe('')
    expect(frame().parentElement.style.getPropertyValue('--psp-frame-block-size')).toBe('')
  })
})
