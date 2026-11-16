// redesign tramo B r2 (W0-PB1-01): a lazy page whose import() rejects leaves the shell on screen and shows the error state.
import React, { lazy, Suspense } from 'react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Link, Route, Switch, useLocation } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  session: { auth: true },
  infoShare: [{ isCollapse: false }, { handleMenuCollapse: () => {} }]
}))

vi.mock('~components', async (importOriginal) => ({
  ...(await importOriginal()),
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [mocks.session]
}))

vi.mock('~ui/src/contexts/InfoShareContext', () => ({
  useInfoShare: () => mocks.infoShare
}))

import { ChunkErrorBoundary, ChunkErrorState, reportBoundaryError } from '..'

const Page = () => <h1>Orders page</h1>
const GoodPage = lazy(() => Promise.resolve({ default: Page }))

// The same shape as App.js: shell (menu) around ChunkErrorBoundary > Suspense > Switch.
const Shell = ({ BadPage, onReload }) => {
  const { pathname } = useLocation()
  return (
    <div>
      <nav aria-label='menu'>
        <Link to='/orders'>Orders</Link>
        <Link to='/settings'>Settings</Link>
      </nav>
      <ChunkErrorBoundary resetKey={pathname} onReload={onReload}>
        <Suspense fallback={<p>loading</p>}>
          <Switch>
            <Route path='/orders' component={GoodPage} />
            <Route path='/settings' component={BadPage} />
          </Switch>
        </Suspense>
      </ChunkErrorBoundary>
    </div>
  )
}

// redesign tramo B r3 (W0-PB2-02): the boundary reports what it catches to the window (window.reportError); here that is a spy, so
// vitest does not take the reported error for an uncaught one. The tests of reporting install their own.
beforeEach(() => { window.reportError = vi.fn() })
afterEach(() => { vi.restoreAllMocks(); delete window.reportError })

describe('ChunkErrorBoundary around the routes', () => {
  it('shows the error state with the menu still on screen, and «Reload» calls onReload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const BadPage = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    const onReload = vi.fn()
    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}><Shell BadPage={BadPage} onReload={onReload} /></MemoryRouter>
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This page could not be loaded')
    expect(screen.getByRole('navigation', { name: 'menu' })).toBeInTheDocument()
    expect(container.textContent).not.toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('draws again when the path changes (the key is the pathname)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const BadPage = lazy(() => Promise.reject(new Error('chunk gone')))
    render(<MemoryRouter initialEntries={['/settings']}><Shell BadPage={BadPage} onReload={vi.fn()} /></MemoryRouter>)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('link', { name: 'Orders' }))
    expect(await screen.findByRole('heading', { name: 'Orders page' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

// redesign tramo B r3 (W0-PB2-02, W0-QB2-03): the text depends on the kind of error, and every caught error is reported.
describe('ChunkErrorBoundary tells a load failure from any other error, and reports both', () => {
  const Boom = ({ error }) => { throw error }
  const draw = (error, props = {}) => render(<ChunkErrorBoundary {...props}><Boom error={error} /></ChunkErrorBoundary>)
  // window.reportError is a spy (see beforeEach): the boundary calls it with the error, and DashboardAnalytics listens to the `error`
  // event it raises on window. React's own dev rethrow also fires `error` events on window, so the spy is what is counted.
  it.each([
    new TypeError('Failed to fetch dynamically imported module: /a.js'),
    new TypeError('Importing a module script failed.'),
    new Error('Unable to preload CSS for /assets/a.css'),
    Object.assign(new Error('Loading chunk 3 failed.'), { name: 'ChunkLoadError' })
  ])('a load failure (%s) keeps the «dashboard may have been updated» text', (error) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    draw(error)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('This page could not be loaded')
    expect(alert).toHaveTextContent('The dashboard may have been updated, or the connection dropped')
    expect(alert).toHaveAttribute('data-error-kind', 'load')
  })

  it('any other error gets a generic text that does not blame a deploy or the connection', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    draw(new TypeError("Cannot read properties of undefined (reading 'a')"))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong')
    expect(alert).toHaveTextContent('An unexpected error stopped this from showing')
    expect(alert).not.toHaveTextContent(/updated|connection/)
    expect(alert).not.toHaveTextContent(/try again/i)
    expect(alert).toHaveAttribute('data-error-kind', 'render')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it.each([
    ['a render error', new TypeError('boom while drawing')],
    ['a load failure', new TypeError('Failed to fetch dynamically imported module')]
  ])('reports %s through window.reportError once, and still calls onError', (_name, error) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    draw(error, { onError })
    expect(window.reportError).toHaveBeenCalledTimes(1)
    expect(window.reportError.mock.calls[0][0]).toBe(error)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBe(error)
  })

  it('reportBoundaryError dispatches an ErrorEvent when the browser has no window.reportError', () => {
    delete window.reportError
    const seen = []
    const listener = (event) => seen.push([event.error, event.message])
    window.addEventListener('error', listener)
    try {
      const error = new Error('no reportError here')
      reportBoundaryError(error)
      expect(seen).toEqual([[error, 'no reportError here']])
    } finally { window.removeEventListener('error', listener) }
  })

  it('the order panel scope names the order in the title, for both kinds', () => {
    render(<ChunkErrorState scope='order' error={new TypeError('x')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This order could not be opened')
    expect(screen.getByRole('alert')).not.toHaveTextContent(/page/i)
  })

  // redesign tramo B cierre (W0-QB4-03, W0-PB4-02)
  it('the orderForm scope names the form in the title and keeps the load description and «Reload»', () => {
    render(<ChunkErrorState scope='orderForm' error={new TypeError('Failed to fetch dynamically imported module: /a.js')} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The order form could not be loaded')
    expect(alert).not.toHaveTextContent('This page could not be loaded')
    expect(alert).toHaveAttribute('data-error-kind', 'load')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})

// the page error state follows the 404 and the offline page (NF-01, D5/D6): a phone can open the menu from it, its title is the
// page's h1 at page-title size, and the focus does not stay on <body>. The panel scopes (order, orderForm) are not pages and do not change.
describe('the page error state, as the 404', () => {
  let handleMenuCollapse
  const boxed = Element.prototype.getClientRects
  const loadFailure = new TypeError('Failed to fetch dynamically imported module: /a.js')

  beforeEach(() => {
    handleMenuCollapse = vi.fn()
    mocks.session = { auth: true }
    mocks.infoShare = [{ isCollapse: true }, { handleMenuCollapse }]
    // jsdom has no layout: give every element a box so `isShown` (focusPageStart) only tells hidden ancestors apart
    Element.prototype.getClientRects = function () { return [{ width: 1, height: 1 }] }
  })
  afterEach(() => {
    Element.prototype.getClientRects = boxed
    document.body.focus()
  })

  it('titles the page with an h1 at page size, inside the alert, and keeps «Reload» as it was', () => {
    const onReload = vi.fn()
    render(<ChunkErrorState error={loadFailure} onReload={onReload} />)
    const alert = screen.getByRole('alert')
    const heading = screen.getByRole('heading', { level: 1, name: 'This page could not be loaded' })
    expect(alert).toContainElement(heading)
    expect(alert).toHaveAttribute('data-size', 'page')
    expect(heading.tagName).toBe('H1')
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('offers «Open menu» when the sidebar is collapsed (the phone) and opens it', () => {
    render(<ChunkErrorState error={loadFailure} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it.each([
    ['the sidebar is not collapsed', { auth: true }, false],
    ['nobody is logged in', { auth: false }, true]
  ])('has no «Open menu» when %s', (_name, session, isCollapse) => {
    mocks.session = session
    mocks.infoShare = [{ isCollapse }, { handleMenuCollapse }]
    render(<ChunkErrorState error={loadFailure} />)
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('moves the focus to the title when it was lost (on <body>), and marks it for the brand ring', () => {
    expect(document.activeElement).toBe(document.body)
    render(<ChunkErrorState error={loadFailure} />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(document.activeElement).toBe(heading)
    expect(heading).toHaveAttribute('data-odc-page-start')
  })

  it('does not take the focus from a control that still has it', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    render(<ChunkErrorState error={loadFailure} />)
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it.each(['order', 'orderForm'])('leaves the %s panel scope as it was: a body-size title, no menu button, no focus change', (scope) => {
    render(<ChunkErrorState scope={scope} error={loadFailure} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).not.toHaveAttribute('data-size')
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
    expect(document.activeElement).toBe(document.body)
  })
})
