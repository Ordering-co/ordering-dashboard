/* eslint-disable import/first */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  events: null,
  handlers: {},
  history: null,
  historyListener: null,
  languageState: null,
  merge: null,
  theme: null,
  unlisten: null
}))

vi.mock('react-router-dom', () => ({
  useHistory: () => runtime.history
}))

vi.mock('~components', () => ({
  useEvent: () => [runtime.events],
  useLanguage: () => [runtime.languageState]
}))

vi.mock('~ui/src/contexts/ThemeContext', () => ({
  useTheme: () => [runtime.theme, { merge: runtime.merge }]
}))

import { ListenPageChanges } from '..'

describe('ListenPageChanges support contracts', () => {
  beforeEach(() => {
    runtime.handlers = {}
    runtime.historyListener = null
    runtime.languageState = { language: { rtl: false } }
    runtime.theme = { rtl: false }
    runtime.merge = vi.fn()
    runtime.unlisten = vi.fn()
    runtime.events = {
      emit: vi.fn(),
      on: vi.fn((event, handler) => { runtime.handlers[event] = handler }),
      off: vi.fn()
    }
    runtime.history = {
      location: { pathname: '/orders', search: '?status=open&site=3' },
      listen: vi.fn((listener) => {
        runtime.historyListener = listener
        return runtime.unlisten
      }),
      push: vi.fn(),
      replace: vi.fn()
    }
  })

  it('emits the current route, handles event navigation and removes exact listeners', () => {
    const view = render(<ListenPageChanges><span>Dashboard</span></ListenPageChanges>)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(runtime.events.emit).toHaveBeenCalledWith('change_view', {
      page: 'orders',
      params: {},
      query: { status: 'open', site: '3' }
    })
    expect(runtime.events.on).toHaveBeenCalledWith('go_to_page', runtime.handlers.go_to_page)
    expect(runtime.events.on).toHaveBeenCalledWith('get_current_view', runtime.handlers.get_current_view)

    act(() => {
      runtime.handlers.go_to_page({
        page: 'profile',
        search: '?tab=sessions',
        replace: true,
        state: { from: 'orders' }
      })
    })
    // main (#404): with state, the query goes in `search`; history v4 does not read it out of `pathname` (Page not found)
    expect(runtime.history.replace).toHaveBeenCalledWith({
      pathname: '/profile',
      search: '?tab=sessions',
      state: { from: 'orders' }
    })

    runtime.history.location = { pathname: '/profile', search: '?tab=sessions' }
    act(() => runtime.historyListener({ pathname: '/profile' }))
    expect(runtime.events.emit).toHaveBeenLastCalledWith('change_view', {
      page: 'profile',
      params: {},
      query: { tab: 'sessions' }
    })

    view.unmount()
    expect(runtime.unlisten).toHaveBeenCalledOnce()
    expect(runtime.events.off).toHaveBeenCalledWith('go_to_page', runtime.handlers.go_to_page)
    expect(runtime.events.off).toHaveBeenCalledWith('get_current_view', runtime.handlers.get_current_view)
  })

  it('merges RTL only when the mounted language direction differs from the theme', () => {
    runtime.languageState = { language: { rtl: true } }
    const view = render(<ListenPageChanges />)
    expect(runtime.merge).toHaveBeenCalledWith({ rtl: true })

    runtime.merge.mockClear()
    runtime.theme = { rtl: true }
    view.rerender(<ListenPageChanges />)
    expect(runtime.merge).not.toHaveBeenCalled()

    runtime.languageState = { language: { rtl: false } }
    view.rerender(<ListenPageChanges />)
    expect(runtime.merge).toHaveBeenCalledWith({ rtl: false })
  })

  // redesign F6g-2: [dir='rtl'] selectors and the odc-icon-flip rule match on <html>, so the document carries the language
  it('sets dir and lang on the document element from the active language', () => {
    runtime.languageState = { language: { code: 'ar', rtl: true } }
    const view = render(<ListenPageChanges />)
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.getAttribute('lang')).toBe('ar')

    runtime.languageState = { language: { code: 'en', rtl: false } }
    view.rerender(<ListenPageChanges />)
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })

  it('leaves the document direction alone until the language is known', () => {
    document.documentElement.setAttribute('dir', 'rtl')
    runtime.languageState = { language: undefined }
    render(<ListenPageChanges />)
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    document.documentElement.removeAttribute('dir')
  })
})
