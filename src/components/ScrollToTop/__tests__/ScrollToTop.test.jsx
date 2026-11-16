/* eslint-disable import/first */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  history: null,
  listener: null,
  unlisten: null
}))

vi.mock('react-router-dom', async () => {
  const ReactModule = await import('react')
  return {
    withRouter: Component => function RoutedComponent (props) {
      return ReactModule.createElement(Component, { ...props, history: runtime.history })
    }
  }
})

import { ScrollToTop } from '..'

describe('ScrollToTop support contract', () => {
  beforeEach(() => {
    runtime.listener = null
    runtime.unlisten = vi.fn()
    runtime.history = {
      listen: vi.fn((listener) => {
        runtime.listener = listener
        return runtime.unlisten
      })
    }
    window.scrollTo = vi.fn()
    window.history.replaceState(null, '', '/orders')
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('keeps store detail scroll, resets other routes and unsubscribes on unmount', () => {
    const view = render(<ScrollToTop><span>Page</span></ScrollToTop>)
    expect(screen.getByText('Page')).toBeInTheDocument()

    window.history.replaceState(null, '', '/store/pizza-place')
    act(() => runtime.listener({ pathname: '/store/pizza-place' }))
    expect(window.scrollTo).not.toHaveBeenCalled()

    window.history.replaceState(null, '', '/stores/list')
    act(() => runtime.listener({ pathname: '/stores/list' }))
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)

    window.history.replaceState(null, '', '/orders')
    act(() => runtime.listener({ pathname: '/orders' }))
    expect(window.scrollTo).toHaveBeenCalledTimes(2)

    view.unmount()
    expect(runtime.unlisten).toHaveBeenCalledOnce()
  })
})
