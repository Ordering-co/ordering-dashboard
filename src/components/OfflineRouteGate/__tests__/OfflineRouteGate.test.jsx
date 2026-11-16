/* eslint-disable import/first */
// a short network cut must not unmount the page (it erased what was typed). The routes stay mounted, hidden and inert, and the
// offline page shows in their place; when the network is back the page reappears with its state.
import React, { Suspense, lazy, useEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Switch, useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~components', async (importOriginal) => ({
  ...(await importOriginal()),
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { useOnlineStatus } from '~ui/src/hooks/useOnlineStatus'
import { NotNetworkConnectivity } from '~ui/src/components/NotNetworkConnectivity'
import { focusPageStart, isShown } from '~components/utils/focusPageStart'
import { ShellMain } from '../../ShellMain'
import { OfflineRouteGate, useRoutesLocation } from '..'

const mounts = vi.fn()

// A page with a field and its own state, as any form of the dashboard.
const FormPage = () => {
  const [value, setValue] = useState('')
  useEffect(() => { mounts() }, [])
  return (
    <section>
      <h1>Notes page</h1>
      <input aria-label='Notes' value={value} onChange={event => setValue(event.target.value)} />
    </section>
  )
}

// A page that was never opened: a chunk to download, as every page of App.js (React.lazy)
const loadReports = vi.fn(() => Promise.resolve({ default: () => <h1>Reports page</h1> }))
const ReportsPage = lazy(() => loadReports())

// The menu or ⌘K: it lives outside the routes and navigates with or without network
const GoToReports = () => {
  const history = useHistory()
  return <button type='button' onClick={() => history.push('/reports')}>Reports</button>
}

// The same shape as App.js: ShellMain > NotNetworkConnectivity + OfflineRouteGate(online) > Switch(location). The status is the one App.js reads.
const Routes = () => {
  const online = useOnlineStatus()
  const routesLocation = useRoutesLocation(online)
  return (
    <ShellMain>
      <GoToReports />
      <NotNetworkConnectivity />
      <OfflineRouteGate online={online}>
        <Suspense fallback={<p>Loading</p>}>
          <Switch location={routesLocation}>
            <Route path='/notes' component={FormPage} />
            <Route path='/reports' component={ReportsPage} />
          </Switch>
        </Suspense>
      </OfflineRouteGate>
    </ShellMain>
  )
}

const Shell = () => (
  <MemoryRouter initialEntries={['/notes']}>
    <Routes />
  </MemoryRouter>
)

const setNetwork = (online) => act(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: online })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
})

describe('OfflineRouteGate', () => {
  beforeEach(() => {
    mounts.mockClear()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  })
  afterEach(() => {
    delete window.navigator.onLine
  })

  it('keeps the page and what was typed through a network cut, hidden and inert while it lasts', () => {
    render(<Shell />)
    const input = screen.getByLabelText('Notes')
    fireEvent.change(input, { target: { value: 'qa-typed' } })
    expect(input).toHaveValue('qa-typed')
    expect(screen.queryByRole('heading', { name: "You're offline" })).not.toBeInTheDocument()

    setNetwork(false)

    // the offline page shows in the page's place...
    expect(screen.getByRole('heading', { level: 1, name: "You're offline" })).toBeVisible()
    // ...and the page is still in the DOM (the same node), out of sight, out of the tab order and out of the reader's reach
    expect(screen.getByLabelText('Notes', { hidden: true })).toBe(input)
    expect(input).not.toBeVisible()
    const gate = input.closest('[data-slot="offline-route-gate"]')
    expect(gate).toHaveAttribute('hidden')
    expect(gate).toHaveAttribute('inert')
    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Notes page' })).not.toBeInTheDocument()

    setNetwork(true)

    // back online: the page reappears with its state, interactive, and it never mounted twice
    expect(screen.queryByRole('heading', { name: "You're offline" })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toBe(input)
    expect(input).toHaveValue('qa-typed')
    expect(input).toBeVisible()
    expect(gate).not.toHaveAttribute('hidden')
    expect(gate).not.toHaveAttribute('inert')
    fireEvent.change(input, { target: { value: 'qa-typed more' } })
    expect(input).toHaveValue('qa-typed more')
    expect(mounts).toHaveBeenCalledTimes(1)
  })

  // review of with the routes mounted, a navigation offline fetched the new page's chunk, failed and reloaded the tab
  it('does not fetch a new page while offline; the page opens once the network is back', async () => {
    loadReports.mockClear()
    render(<Shell />)
    const input = screen.getByLabelText('Notes')
    fireEvent.change(input, { target: { value: 'qa-typed' } })

    setNetwork(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))

    expect(loadReports).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Notes', { hidden: true })).toHaveValue('qa-typed')
    expect(screen.getByRole('heading', { level: 1, name: "You're offline" })).toBeVisible()

    setNetwork(true)

    expect(await screen.findByRole('heading', { name: 'Reports page' })).toBeVisible()
    expect(loadReports).toHaveBeenCalledTimes(1)
  })

  it('draws no box of its own while online, so the page stays a direct flex child of the layout', () => {
    render(<Shell />)
    expect(screen.getByLabelText('Notes').closest('[data-slot="offline-route-gate"]').style.display).toBe('contents')
  })

  it('does not let the page start (skip link, focusPageStart) pick the hidden page while offline', () => {
    render(<Shell />)
    // jsdom has no layout: every element gets a box, so `isShown` only tells hidden/inert/aria-hidden ancestors apart
    const boxed = Element.prototype.getClientRects
    Element.prototype.getClientRects = function () { return [{ width: 1, height: 1 }] }
    try {
      setNetwork(false)
      const pageTitle = screen.getByRole('heading', { name: 'Notes page', hidden: true })
      expect(isShown(pageTitle)).toBe(false)
      focusPageStart(null)
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: "You're offline" }))
      expect(document.activeElement).not.toBe(pageTitle)
    } finally {
      Element.prototype.getClientRects = boxed
    }
  })
})
