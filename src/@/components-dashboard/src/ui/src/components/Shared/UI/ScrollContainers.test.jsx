/* eslint-disable import/first */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  width: 1200,
  autoTheme: { rtl: false },
  dragWrapperWidth: 300,
  dragContainerWidth: 1000,
  resizeObservers: []
}))

vi.mock('../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: runtime.width, height: 800 })
}))

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => [runtime.autoTheme]
}))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))

import { AutoScroll } from './AutoScroll'
import { DragScroll } from './DragScroll'

const lightTheme = createDashboardTheme(theme)
const rtlTheme = { ...lightTheme, rtl: true }
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

const AutoFixture = ({ children = <button type='button'>Child action</button>, ...props }) => (
  <div data-auto-scrollport data-width='300'>
    <div data-auto-parent data-width='3000' data-scroll-width='3000'>
      <AutoScroll innerScroll {...props}>{children}</AutoScroll>
    </div>
  </div>
)

beforeEach(() => {
  runtime.width = 1200
  runtime.autoTheme = { rtl: false }
  runtime.dragWrapperWidth = 300
  runtime.dragContainerWidth = 1000
  runtime.resizeObservers = []
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
    if (this.dataset.width) return Number(this.dataset.width)
    if (this.dataset.slot === 'drag-scroll-scrollport') return runtime.dragWrapperWidth
    if (this.dataset.slot === 'drag-scroll-content') return runtime.dragContainerWidth
    return 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
    return Number(this.dataset.scrollWidth || this.dataset.width || 0)
  })
  vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
    constructor (callback) {
      this.callback = callback
      this.observe = vi.fn()
      this.disconnect = vi.fn()
      runtime.resizeObservers.push(this)
    }
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false }))
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('L2d-C9 AutoScroll', () => {
  it('keeps explicit ids, ancestor scrolling, exact distance, edge thresholds, and keyboard activation', async () => {
    const user = userEvent.setup()
    renderWithTheme(<AutoFixture scrollId='orderByOption' />)
    const root = document.querySelector('[data-slot="auto-scroll"]')
    const scrollport = root.parentElement.parentElement
    scrollport.scrollBy = vi.fn()

    expect(root).toHaveAttribute('id', 'orderByOption')
    expect(root).toHaveAttribute('data-scroll-target', 'ancestor-scrollport')
    expect(screen.getByRole('button', { name: 'Child action' })).toBeInTheDocument()
    const left = root.querySelector('[data-scroll-action="left"]')
    const right = screen.getByRole('button', { name: 'Scroll right' })
    expect(left).toHaveAttribute('data-hidden', '')
    expect(left).toBeDisabled()
    expect(left).toHaveAttribute('tabindex', '-1')
    expect(right).not.toHaveAttribute('data-hidden')
    expect(right).toHaveAttribute('type', 'button')
    expect(right).toHaveAttribute('aria-controls', 'orderByOption')

    right.focus()
    await user.keyboard('{Enter}')
    expect(scrollport.scrollBy).toHaveBeenCalledOnce()
    expect(scrollport.scrollBy).toHaveBeenCalledWith({ top: 0, left: 300, behavior: 'smooth' })

    scrollport.scrollLeft = 39
    fireEvent.scroll(scrollport)
    expect(left).toHaveAttribute('data-hidden', '')
    expect(left.parentElement).toBe(root)
    scrollport.scrollLeft = 40
    fireEvent.scroll(scrollport)
    expect(left).not.toHaveAttribute('data-hidden')
    scrollport.scrollLeft = 2661
    fireEvent.scroll(scrollport)
    expect(right).toHaveAttribute('data-hidden', '')
    scrollport.scrollLeft = 2660
    fireEvent.scroll(scrollport)
    expect(right).not.toHaveAttribute('data-hidden')
  })

  it('uses the 200px minimum and reduced-motion behavior without duplicating mouse action', async () => {
    const user = userEvent.setup()
    const rendered = renderWithTheme(
      <div data-auto-scrollport data-width='300'>
        <div data-auto-parent data-width='1000' data-scroll-width='1000'>
          <AutoScroll innerScroll scrollId='short-scroll'><span>Content</span></AutoScroll>
        </div>
      </div>
    )
    const root = rendered.container.querySelector('[data-slot="auto-scroll"]')
    const scrollport = root.parentElement.parentElement
    scrollport.scrollBy = vi.fn()
    const right = screen.getByRole('button', { name: 'Scroll right' })
    await user.click(right)
    expect(scrollport.scrollBy).toHaveBeenCalledOnce()
    expect(scrollport.scrollBy).toHaveBeenLastCalledWith({ top: 0, left: 200, behavior: 'smooth' })

    scrollport.scrollLeft = 200
    fireEvent.scroll(scrollport)
    await user.click(screen.getByRole('button', { name: 'Scroll left' }))
    expect(scrollport.scrollBy).toHaveBeenLastCalledWith({ top: 0, left: -200, behavior: 'smooth' })

    window.matchMedia.mockReturnValue({ matches: true })
    await user.click(right)
    expect(scrollport.scrollBy).toHaveBeenCalledTimes(3)
    expect(scrollport.scrollBy).toHaveBeenLastCalledWith({ top: 0, left: 200, behavior: 'auto' })
  })

  it('normalizes negative RTL visibility and hides modal arrows from focus at desktop width', () => {
    runtime.autoTheme = { rtl: true }
    const rendered = renderWithTheme(<AutoFixture scrollId='rtl-scroll' />, rtlTheme)
    const root = rendered.container.querySelector('[data-slot="auto-scroll"]')
    const scrollport = root.parentElement.parentElement
    const left = root.querySelector('[data-scroll-action="left"]')
    const right = root.querySelector('[data-scroll-action="right"]')
    expect(root).toHaveAttribute('dir', 'rtl')
    expect(left).not.toHaveAttribute('data-hidden')
    expect(right).toHaveAttribute('data-hidden', '')

    scrollport.scrollLeft = -40
    fireEvent.scroll(scrollport)
    expect(right).not.toHaveAttribute('data-hidden')
    scrollport.scrollLeft = -2681
    fireEvent.scroll(scrollport)
    expect(left).toHaveAttribute('data-hidden', '')
    scrollport.scrollLeft = -2680
    fireEvent.scroll(scrollport)
    expect(left).not.toHaveAttribute('data-hidden')

    rendered.rerender(<ThemeProvider theme={rtlTheme}><AutoFixture modal scrollId='rtl-scroll' /></ThemeProvider>)
    expect(root.querySelector('[data-scroll-action="left"]')).toHaveAttribute('data-hidden', '')
    expect(root.querySelector('[data-scroll-action="right"]')).toHaveAttribute('data-hidden', '')
    expect(within(root).queryByRole('button', { name: 'Scroll left' })).not.toBeInTheDocument()
  })

  it('isolates default instances and cleans one listener and observer per mount', () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const rendered = renderWithTheme(
      <>
        <AutoFixture><span>First</span></AutoFixture>
        <AutoFixture><span>Second</span></AutoFixture>
      </>
    )
    const roots = rendered.container.querySelectorAll('[data-slot="auto-scroll"]')
    expect(roots).toHaveLength(2)
    expect(roots[0].id).toMatch(/^autoscroll-/)
    expect(roots[1].id).toMatch(/^autoscroll-/)
    expect(roots[0].id).not.toBe(roots[1].id)
    const scrollAdds = add.mock.calls.filter(call => call[0] === 'scroll' && call[2]?.passive)
    expect(scrollAdds).toHaveLength(2)

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <>
          <AutoFixture><span>First updated</span></AutoFixture>
          <AutoFixture><span>Second updated</span></AutoFixture>
        </>
      </ThemeProvider>
    )
    expect(add.mock.calls.filter(call => call[0] === 'scroll' && call[2]?.passive)).toHaveLength(2)
    rendered.unmount()
    const scrollRemoves = remove.mock.calls.filter(call => call[0] === 'scroll')
    expect(scrollRemoves).toHaveLength(2)
    expect(scrollRemoves[0][1]).toBe(scrollAdds[0][1])
    expect(scrollRemoves[1][1]).toBe(scrollAdds[1][1])
    expect(runtime.resizeObservers).toHaveLength(2)
    runtime.resizeObservers.forEach(observer => expect(observer.disconnect).toHaveBeenCalledOnce())
  })
})

describe('L2d-C9 DragScroll', () => {
  it('tracks native LTR scrolling and scrolls by 200px from mouse or keyboard actions', async () => {
    const user = userEvent.setup()
    renderWithTheme(<DragScroll><button type='button'>Child receipt</button></DragScroll>)
    const root = document.querySelector('[data-slot="drag-scroll"]')
    const scrollport = document.querySelector('[data-slot="drag-scroll-scrollport"]')
    const content = document.querySelector('[data-slot="drag-scroll-content"]')
    scrollport.scrollBy = vi.fn()
    expect(content).toHaveAttribute('role', 'list')
    expect(screen.queryByRole('button', { name: 'Scroll left' })).not.toBeInTheDocument()
    const right = screen.getByRole('button', { name: 'Scroll right' })
    expect(right).toHaveAttribute('type', 'button')
    await user.click(right)
    expect(scrollport.scrollBy).toHaveBeenCalledOnce()
    expect(scrollport.scrollBy).toHaveBeenLastCalledWith({ top: 0, left: 200, behavior: 'smooth' })

    scrollport.scrollLeft = 11
    fireEvent.scroll(scrollport)
    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument()
    scrollport.scrollLeft = 690
    fireEvent.scroll(scrollport)
    expect(screen.queryByRole('button', { name: 'Scroll right' })).not.toBeInTheDocument()
    expect(root).not.toHaveAttribute('data-dragging')
  })

  it('uses 10% for large content and auto behavior for reduced motion', async () => {
    runtime.dragContainerWidth = 3000
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true }))
    })
    const user = userEvent.setup()
    renderWithTheme(<DragScroll><span>Wide content</span></DragScroll>)
    const scrollport = document.querySelector('[data-slot="drag-scroll-scrollport"]')
    scrollport.scrollBy = vi.fn()
    await user.click(screen.getByRole('button', { name: 'Scroll right' }))
    expect(scrollport.scrollBy).toHaveBeenCalledWith({ top: 0, left: 300, behavior: 'auto' })
  })

  it('tracks the RTL negative model with exact >10 boundaries', () => {
    renderWithTheme(<DragScroll><span>RTL content</span></DragScroll>, rtlTheme)
    const scrollport = document.querySelector('[data-slot="drag-scroll-scrollport"]')
    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scroll right' })).not.toBeInTheDocument()

    scrollport.scrollLeft = -10
    fireEvent.scroll(scrollport)
    expect(screen.queryByRole('button', { name: 'Scroll right' })).not.toBeInTheDocument()
    scrollport.scrollLeft = -11
    fireEvent.scroll(scrollport)
    expect(screen.getByRole('button', { name: 'Scroll right' })).toBeInTheDocument()
    scrollport.scrollLeft = -690
    fireEvent.scroll(scrollport)
    expect(screen.queryByRole('button', { name: 'Scroll left' })).not.toBeInTheDocument()
  })

  it('uses immediate drag refs, preserves the child click, and leaves native touch to scroll events', () => {
    const childClick = vi.fn()
    renderWithTheme(<DragScroll><button type='button' onClick={childClick}>Clickable child</button></DragScroll>)
    const root = document.querySelector('[data-slot="drag-scroll"]')
    const scrollport = document.querySelector('[data-slot="drag-scroll-scrollport"]')
    Object.defineProperty(scrollport, 'ontouchstart', { configurable: true, value: undefined })
    scrollport.scrollLeft = 10
    fireEvent.mouseDown(scrollport, { screenX: 100 })
    expect(root).toHaveAttribute('data-dragging', '')
    fireEvent.mouseMove(scrollport, { screenX: 70 })
    expect(scrollport.scrollLeft).toBe(40)
    fireEvent.mouseUp(scrollport)
    expect(root).not.toHaveAttribute('data-dragging')
    fireEvent.click(screen.getByRole('button', { name: 'Clickable child' }))
    expect(childClick).toHaveBeenCalledOnce()

    Object.defineProperty(scrollport, 'ontouchstart', { configurable: true, value: null })
    fireEvent.mouseDown(scrollport, { screenX: 100 })
    expect(root).not.toHaveAttribute('data-dragging')
    scrollport.scrollLeft = 80
    fireEvent.scroll(scrollport)
    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument()
  })

  it('cleans the delayed measurement timeout on unmount', () => {
    vi.useFakeTimers()
    const clearTimeout = vi.spyOn(window, 'clearTimeout')
    const rendered = renderWithTheme(<DragScroll><span>Content</span></DragScroll>)
    rendered.unmount()
    expect(clearTimeout).toHaveBeenCalledOnce()
  })
})
