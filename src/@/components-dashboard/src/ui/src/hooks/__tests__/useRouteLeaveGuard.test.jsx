// redesign D-81 (owner, 2026-10-19): useRouteLeaveGuard. A page with unsaved work sends every way out of it to the host's
// `requestLeave`: a route change to another pathname (push, replace, back), ⌘K and Mia (registerRouteLeaveGuard) and the tab closing
// (beforeunload). A change inside the same pathname never asks; a clean page is never held.
import React from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter, useHistory } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestRouteLeave } from '../../utils/routeLeaveGuard'
import { useRouteLeaveGuard } from '../useRouteLeaveGuard'

let history
const Probe = ({ active, requestLeave }) => {
  history = useHistory()
  useRouteLeaveGuard({ active, requestLeave })
  return null
}

const renderAt = (props, entries = ['/start']) => {
  const tree = (next) => (
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Probe {...next} />
    </MemoryRouter>
  )
  const view = render(tree(props))
  return { ...view, update: (next) => view.rerender(tree(next)) }
}

const where = () => `${history.location.pathname}${history.location.search}`

// the host: remembers the way out it was asked about; the test answers it
const makeHost = () => {
  const asked = []
  return { asked, requestLeave: vi.fn((proceed, onCancel) => { asked.push({ proceed, onCancel }) }) }
}

const beforeUnloadListeners = (spy) => spy.mock.calls.filter(([type]) => type === 'beforeunload')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useRouteLeaveGuard · route changes', () => {
  it('a clean page is never held: it navigates without asking', () => {
    const host = makeHost()
    renderAt({ active: false, requestLeave: host.requestLeave })
    act(() => history.push('/elsewhere'))
    expect(where()).toBe('/elsewhere')
    expect(host.requestLeave).not.toHaveBeenCalled()
  })

  it('a push to another pathname is held and asks once; the address does not move', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    act(() => history.push('/elsewhere?x=1'))
    expect(where()).toBe('/start')
    expect(host.requestLeave).toHaveBeenCalledTimes(1)
  })

  it('proceed repeats the push, and only once the host lets go', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    act(() => history.push('/elsewhere?x=1'))
    expect(where()).toBe('/start')
    act(() => host.asked[0].proceed())
    expect(where()).toBe('/elsewhere?x=1')
    expect(host.requestLeave).toHaveBeenCalledTimes(1)
  })

  it('not calling proceed (Keep editing, or a Save that failed) leaves the user on the page', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    act(() => history.push('/elsewhere'))
    expect(where()).toBe('/start')
    // nothing else happens: the next try asks again
    act(() => history.push('/elsewhere'))
    expect(host.requestLeave).toHaveBeenCalledTimes(2)
    expect(where()).toBe('/start')
  })

  it('a replace to another pathname is held and repeated as a replace', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    act(() => history.replace('/elsewhere'))
    expect(where()).toBe('/start')
    act(() => host.asked[0].proceed())
    expect(where()).toBe('/elsewhere')
    expect(history.length).toBe(1)
  })

  it('the same pathname goes through without asking: the query string, the hash and a replace of them', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    act(() => history.replace({ pathname: '/start', search: '?section=layout' }))
    act(() => history.push({ pathname: '/start', search: '?section=images', hash: '#top' }))
    expect(where()).toBe('/start?section=images')
    expect(host.requestLeave).not.toHaveBeenCalled()
  })

  it('back to another pathname is held and, on proceed, goes back by its distance', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave }, ['/first', '/start'])
    // MemoryRouter opens on the last entry
    expect(where()).toBe('/start')
    act(() => history.goBack())
    expect(where()).toBe('/start')
    expect(host.requestLeave).toHaveBeenCalledTimes(1)
    act(() => host.asked[0].proceed())
    expect(where()).toBe('/first')
    expect(host.requestLeave).toHaveBeenCalledTimes(1)
  })

  it('the way out the user agreed to is not asked about twice, and a later one asks again', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    act(() => history.push('/elsewhere'))
    act(() => host.asked[0].proceed())
    expect(where()).toBe('/elsewhere')
    act(() => history.push('/another'))
    // still dirty: the block is back, so this one is asked about and held
    expect(host.requestLeave).toHaveBeenCalledTimes(2)
    expect(where()).toBe('/elsewhere')
  })

  it('if the host proceeds at once (nothing dirty after all) that very navigation goes on', () => {
    const requestLeave = vi.fn((proceed) => proceed())
    renderAt({ active: true, requestLeave })
    act(() => history.push('/elsewhere'))
    expect(requestLeave).toHaveBeenCalledTimes(1)
    expect(where()).toBe('/elsewhere')
  })

  it('stops holding when the page becomes clean again', () => {
    const host = makeHost()
    const { update } = renderAt({ active: true, requestLeave: host.requestLeave })
    update({ active: false, requestLeave: host.requestLeave })
    act(() => history.push('/elsewhere'))
    expect(where()).toBe('/elsewhere')
    expect(host.requestLeave).not.toHaveBeenCalled()
  })

  it('reads the latest requestLeave without subscribing again', () => {
    const first = makeHost()
    const second = makeHost()
    const { update } = renderAt({ active: true, requestLeave: first.requestLeave })
    update({ active: true, requestLeave: second.requestLeave })
    act(() => history.push('/elsewhere'))
    expect(first.requestLeave).not.toHaveBeenCalled()
    expect(second.requestLeave).toHaveBeenCalledTimes(1)
  })
})

describe('useRouteLeaveGuard · ⌘K and Mia', () => {
  it('a navigation of the palette asks first; it runs only when the host lets go, and its push is not asked about again', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    const go = vi.fn(() => history.push('/elsewhere'))
    requestRouteLeave(go)
    expect(go).not.toHaveBeenCalled()
    expect(host.requestLeave).toHaveBeenCalledTimes(1)
    act(() => host.asked[0].proceed())
    expect(go).toHaveBeenCalledTimes(1)
    expect(where()).toBe('/elsewhere')
    expect(host.requestLeave).toHaveBeenCalledTimes(1)
  })

  it('keeping the user leaves the palette navigation undone', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    const go = vi.fn()
    requestRouteLeave(go)
    expect(go).not.toHaveBeenCalled()
    expect(where()).toBe('/start')
  })

  it('a clean page does not register: the navigation runs at once', () => {
    const host = makeHost()
    renderAt({ active: false, requestLeave: host.requestLeave })
    const go = vi.fn()
    requestRouteLeave(go)
    expect(go).toHaveBeenCalledTimes(1)
    expect(host.requestLeave).not.toHaveBeenCalled()
  })

  it('unregisters on unmount', () => {
    const host = makeHost()
    const { unmount } = renderAt({ active: true, requestLeave: host.requestLeave })
    unmount()
    const go = vi.fn()
    requestRouteLeave(go)
    expect(go).toHaveBeenCalledTimes(1)
    expect(host.requestLeave).not.toHaveBeenCalled()
  })
})

describe('useRouteLeaveGuard · closing the tab', () => {
  it('beforeunload is registered only while there is unsaved work, and removed after', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const host = makeHost()
    const { update, unmount } = renderAt({ active: false, requestLeave: host.requestLeave })
    expect(beforeUnloadListeners(add)).toHaveLength(0)
    update({ active: true, requestLeave: host.requestLeave })
    expect(beforeUnloadListeners(add)).toHaveLength(1)
    update({ active: false, requestLeave: host.requestLeave })
    expect(beforeUnloadListeners(remove)).toHaveLength(1)
    update({ active: true, requestLeave: host.requestLeave })
    expect(beforeUnloadListeners(add)).toHaveLength(2)
    unmount()
    expect(beforeUnloadListeners(remove)).toHaveLength(2)
  })

  it('the listener asks the browser for its own prompt', () => {
    const host = makeHost()
    renderAt({ active: true, requestLeave: host.requestLeave })
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('a clean page lets the tab close without a prompt', () => {
    const host = makeHost()
    renderAt({ active: false, requestLeave: host.requestLeave })
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

// redesign bugs E: a page and a piece inside it may both hold unsaved work (the store editor and the menu's Custom fields,
// the stores list's editor and the Importers panel, a website and its sections editor). history v4 keeps one prompt only, so each
// `history.block` replaced the other one, and the inner one going clean set it to none: the outer page was no longer held.
describe('useRouteLeaveGuard · nested guards', () => {
  const Nested = ({ outer, inner }) => (
    <>
      <Probe {...outer} />
      {inner && <Probe {...inner} />}
    </>
  )
  const renderNested = (props) => {
    const tree = (next) => (
      <MemoryRouter initialEntries={['/start']}>
        <Nested {...next} />
      </MemoryRouter>
    )
    const view = render(tree(props))
    return { ...view, update: (next) => view.rerender(tree(next)) }
  }

  it('when the inner one goes clean, the outer one still holds the page', () => {
    const outer = makeHost()
    const inner = makeHost()
    const { update } = renderNested({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: true, requestLeave: inner.requestLeave } })
    update({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: false, requestLeave: inner.requestLeave } })
    act(() => history.push('/elsewhere'))
    expect(where()).toBe('/start')
    expect(outer.requestLeave).toHaveBeenCalledTimes(1)
    expect(inner.requestLeave).not.toHaveBeenCalled()
  })

  it('when the inner one unmounts, the outer one still holds the page', () => {
    const outer = makeHost()
    const inner = makeHost()
    const { update } = renderNested({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: true, requestLeave: inner.requestLeave } })
    update({ outer: { active: true, requestLeave: outer.requestLeave } })
    act(() => history.push('/elsewhere'))
    expect(where()).toBe('/start')
    expect(outer.requestLeave).toHaveBeenCalledTimes(1)
  })

  // review E2-1: the piece on top (the last that became dirty, as Custom fields over the store editor) answers first, as the nested
  // guards of P/LeaveGuard do; the page behind is asked only once it lets go
  it('both dirty: the last one to become dirty is asked first, then the other; the navigation is repeated once', () => {
    const outer = makeHost()
    const inner = makeHost()
    const { update } = renderNested({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: false, requestLeave: inner.requestLeave } })
    update({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: true, requestLeave: inner.requestLeave } })
    act(() => history.push('/elsewhere'))
    expect(inner.requestLeave).toHaveBeenCalledTimes(1)
    expect(outer.requestLeave).not.toHaveBeenCalled()
    act(() => inner.asked[0].proceed())
    expect(where()).toBe('/start')
    expect(outer.requestLeave).toHaveBeenCalledTimes(1)
    act(() => outer.asked[0].proceed())
    expect(where()).toBe('/elsewhere')
    expect(inner.requestLeave).toHaveBeenCalledTimes(1)
  })

  it('⌘K and Mia ask the same way: the last one first, then the other, and run once', () => {
    const outer = makeHost()
    const inner = makeHost()
    const { update } = renderNested({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: false, requestLeave: inner.requestLeave } })
    update({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: true, requestLeave: inner.requestLeave } })
    const go = vi.fn(() => history.push('/palette-target'))
    act(() => requestRouteLeave(go))
    expect(inner.requestLeave).toHaveBeenCalledTimes(1)
    expect(outer.requestLeave).not.toHaveBeenCalled()
    act(() => inner.asked[0].proceed())
    expect(go).not.toHaveBeenCalled()
    act(() => outer.asked[0].proceed())
    expect(go).toHaveBeenCalledTimes(1)
    // the push the user agreed to is not asked about again
    expect(where()).toBe('/palette-target')
    expect(outer.requestLeave).toHaveBeenCalledTimes(1)
    expect(inner.requestLeave).toHaveBeenCalledTimes(1)
  })

  it('one that keeps the user ends the way out: the other is not asked and the page stays', () => {
    const outer = makeHost()
    const inner = makeHost()
    renderNested({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: true, requestLeave: inner.requestLeave } })
    act(() => history.push('/elsewhere'))
    expect(outer.requestLeave.mock.calls.length + inner.requestLeave.mock.calls.length).toBe(1)
    expect(where()).toBe('/start')
  })

  it('the outer one alone, clean inner: back is held and repeated by its distance', () => {
    const outer = makeHost()
    const inner = makeHost()
    const tree = (next) => (
      <MemoryRouter initialEntries={['/first', '/start']} initialIndex={1}>
        <Nested {...next} />
      </MemoryRouter>
    )
    const view = render(tree({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: true, requestLeave: inner.requestLeave } }))
    view.rerender(tree({ outer: { active: true, requestLeave: outer.requestLeave }, inner: { active: false, requestLeave: inner.requestLeave } }))
    act(() => history.goBack())
    expect(where()).toBe('/start')
    act(() => outer.asked[0].proceed())
    expect(where()).toBe('/first')
  })
})
