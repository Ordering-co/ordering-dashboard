/* eslint-disable import/first */
// redesign stores 3.A: ImportersButton gains opt-in controlled props (open, onOpenChange, hideTrigger) so the phone
// header's «⋯» menu opens the same panel. Without them it behaves as before; the controlled cases pin that mode.
// redesign stores 3.C: the panel is a P/Sheet with levels (ImportersPanes). The same contract, plus: Escape goes back
// one level, the X closes the panel, and both ask first when a form of a level has unsaved work.
import React, { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ addQueryToUrl: vi.fn(), removeQueryToUrl: vi.fn(), dirty: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../../utils', () => ({
  addQueryToUrl: (...args) => mockState.addQueryToUrl(...args),
  removeQueryToUrl: (...args) => mockState.removeQueryToUrl(...args)
}))

// A list with one level and, inside it, a second level with a form that can be dirty.
vi.mock('../../ImportersListing', async () => {
  const { ImportersPane } = await import('../ImportersPanes')
  const { useLeaveGuard } = await import('../../../Shared/Product/LeaveGuard')
  const Form = () => {
    useLeaveGuard({ dirty: () => mockState.dirty, save: () => ({ ok: true }), discard: () => {} })
    return <input aria-label='Mapping name' />
  }
  const Detail = () => {
    const [mapping, setMapping] = useState(false)
    return (
      <>
        <button type='button' onClick={() => setMapping(true)}>Open mapping</button>
        {mapping && (
          <ImportersPane title='Edit mapping' onBack={() => setMapping(false)}>
            <Form />
          </ImportersPane>
        )}
      </>
    )
  }
  return {
    ImportersListing: (props) => {
      const [detail, setDetail] = useState(false)
      return (
        <div data-testid='importers-listing' data-has-success={props.onImportSuccess ? 'yes' : 'no'}>
          <button type='button' onClick={() => setDetail(true)}>Open detail</button>
          {detail && (
            <ImportersPane title='Import Products' onBack={() => setDetail(false)}>
              <Detail />
            </ImportersPane>
          )}
        </div>
      )
    }
  }
})

import { ImportersButton } from '../index'

const draw = (props = {}, route = '/stores/list') => {
  const tree = (p) => (
    <MemoryRouter initialEntries={[route]}>
      <ImportersButton {...p} />
    </MemoryRouter>
  )
  const utils = render(tree(props))
  return { ...utils, redraw: (next) => utils.rerender(tree(next)) }
}

const panel = () => screen.queryByRole('dialog', { name: 'Importers' })
const closePanel = () => userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])

beforeEach(() => {
  vi.clearAllMocks()
  mockState.dirty = false
  window.history.replaceState(null, '', '/stores/list')
})

describe('uncontrolled (no new props)', () => {
  it('renders the trigger, opens on click and writes ?header=importers, closes removing header', async () => {
    const setOpenSidebar = vi.fn()
    draw({ setOpenSidebar, onImportSuccess: vi.fn() })
    expect(panel()).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Importers/ }))
    await waitFor(() => expect(panel()).toBeInTheDocument())
    expect(screen.getByTestId('importers-listing')).toHaveAttribute('data-has-success', 'yes')
    expect(setOpenSidebar).toHaveBeenCalledWith('importer')
    expect(mockState.addQueryToUrl).toHaveBeenCalledWith({ header: 'importers' })

    await closePanel()
    expect(mockState.removeQueryToUrl).toHaveBeenCalledWith(['header'])
    await waitFor(() => expect(screen.queryByTestId('importers-listing')).not.toBeInTheDocument())
  })

  it('opens the panel on mount when the URL has ?header=importers', async () => {
    draw({}, '/stores/list?header=importers')
    await waitFor(() => expect(panel()).toBeInTheDocument())
  })

  it('is a Product button, not the legacy one', () => {
    draw()
    expect(screen.getByRole('button', { name: /Importers/ })).toHaveClass('odc-btn')
  })
})

describe('controlled with hideTrigger', () => {
  it('draws no trigger, follows `open`, writes the URL when it turns true and reports the close', async () => {
    const onOpenChange = vi.fn()
    const { redraw } = draw({ open: false, onOpenChange, hideTrigger: true })
    expect(screen.queryByRole('button', { name: /Importers/ })).not.toBeInTheDocument()
    expect(panel()).not.toBeInTheDocument()
    expect(mockState.addQueryToUrl).not.toHaveBeenCalled()

    redraw({ open: true, onOpenChange, hideTrigger: true })
    await waitFor(() => expect(panel()).toBeInTheDocument())
    expect(mockState.addQueryToUrl).toHaveBeenCalledWith({ header: 'importers' })

    await closePanel()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockState.removeQueryToUrl).toHaveBeenCalledWith(['header'])
  })

  it('does not rewrite the URL when open turns true and header=importers is already there', () => {
    window.history.replaceState(null, '', '/stores/list?header=importers')
    const { redraw } = draw({ open: false, onOpenChange: vi.fn(), hideTrigger: true }, '/stores/list?header=importers')
    redraw({ open: true, onOpenChange: vi.fn(), hideTrigger: true })
    expect(mockState.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('keeps the trigger when only controlled (hideTrigger off) and asks the owner to open on click', async () => {
    const onOpenChange = vi.fn()
    draw({ open: false, onOpenChange })
    await userEvent.click(screen.getByRole('button', { name: /Importers/ }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(mockState.addQueryToUrl).toHaveBeenCalledWith({ header: 'importers' })
    expect(panel()).not.toBeInTheDocument()
  })

  it('calls onOpenChange(true) on mount when the URL has ?header=importers', () => {
    const onOpenChange = vi.fn()
    draw({ open: false, onOpenChange, hideTrigger: true }, '/stores/list?header=importers')
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(panel()).not.toBeInTheDocument()
  })

  it('gives the focus to returnFocusRef when the panel closes and its opener has left the page', async () => {
    const more = document.createElement('button')
    more.textContent = 'More actions'
    document.body.appendChild(more)
    const onOpenChange = vi.fn()
    const { redraw } = draw({ open: true, onOpenChange, hideTrigger: true, returnFocusRef: { current: more } })
    await waitFor(() => expect(panel()).toBeInTheDocument())
    await closePanel()
    redraw({ open: false, onOpenChange, hideTrigger: true, returnFocusRef: { current: more } })
    await waitFor(() => expect(document.activeElement).toBe(more))
    more.remove()
  })

  // (Y leftover): a panel opened from the URL has no opener (the body had the focus); «Close» gave the focus to «Skip to
  // content». It goes to the Importers trigger, or to the page's h1 when there is none.
  describe('opened from ?header=importers', () => {
    // Base UI was handed <body> as the opener and focused the first tabbable element of the document: in the app, the shell's
    // «Skip to content». jsdom has no layout, so the link says it is drawn (getClientRects) to be tabbable as in the browser.
    let skip
    beforeEach(() => {
      skip = document.createElement('a')
      skip.href = '#main'
      skip.textContent = 'Skip to content'
      skip.getClientRects = () => [{ width: 120, height: 20 }]
      document.body.prepend(skip)
    })
    afterEach(() => skip.remove())

    it('Close gives the focus to its own Importers button', async () => {
      draw({}, '/stores/list?header=importers')
      await waitFor(() => expect(panel()).toBeInTheDocument())
      await closePanel()
      await waitFor(() => expect(panel()).not.toBeInTheDocument())
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Importers' })))
    })

    it('Close gives the focus to the trigger of the page (returnFocusRef) when its own is hidden', async () => {
      const trigger = document.createElement('button')
      trigger.textContent = 'Importers'
      document.body.appendChild(trigger)
      const Host = () => {
        const [open, setOpen] = useState(false)
        return <ImportersButton open={open} onOpenChange={setOpen} hideTrigger returnFocusRef={{ current: trigger }} />
      }
      render(<MemoryRouter initialEntries={['/stores/list?header=importers']}><Host /></MemoryRouter>)
      await waitFor(() => expect(panel()).toBeInTheDocument())
      await closePanel()
      await waitFor(() => expect(panel()).not.toBeInTheDocument())
      await waitFor(() => expect(document.activeElement).toBe(trigger))
      trigger.remove()
    })

    it('Close gives the focus to the page h1 when there is no trigger', async () => {
      const heading = document.createElement('h1')
      heading.textContent = 'Stores'
      document.body.appendChild(heading)
      const Host = () => {
        const [open, setOpen] = useState(false)
        return <ImportersButton open={open} onOpenChange={setOpen} hideTrigger returnFocusRef={{ current: null }} />
      }
      render(<MemoryRouter initialEntries={['/stores/list?header=importers']}><Host /></MemoryRouter>)
      await waitFor(() => expect(panel()).toBeInTheDocument())
      await closePanel()
      await waitFor(() => expect(panel()).not.toBeInTheDocument())
      await waitFor(() => expect(document.activeElement).toBe(heading))
      expect(heading).toHaveAttribute('tabindex', '-1')
      heading.remove()
    })
  })
})

describe('levels (3.C)', () => {
  it('stacks the levels and gives each one a way back with the name of the level under it', async () => {
    draw({}, '/stores/list?header=importers')
    await waitFor(() => expect(panel()).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Open detail' }))
    expect(await screen.findByRole('heading', { name: 'Import Products' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importers' })).toBeInTheDocument() // «‹ Importers»
    await userEvent.click(screen.getByRole('button', { name: 'Open mapping' }))
    expect(await screen.findByRole('heading', { name: 'Edit mapping' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close Edit mapping' })).toBeInTheDocument()

    // the depth widens the Sheet (importers.css, from 1100px)
    expect(panel()).toHaveAttribute('data-detail', 'true')
  })

  it('Escape goes back one level at a time and only then closes the panel', async () => {
    draw({}, '/stores/list?header=importers')
    await waitFor(() => expect(panel()).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Open detail' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open mapping' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit mapping' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Import Products' })).toBeInTheDocument()
    expect(mockState.removeQueryToUrl).not.toHaveBeenCalled()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Import Products' })).not.toBeInTheDocument())
    expect(panel()).not.toHaveAttribute('data-detail')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(mockState.removeQueryToUrl).toHaveBeenCalledWith(['header']))
  })

  it('going back from a level with unsaved work asks first; Keep editing stays, Discard goes back', async () => {
    draw({}, '/stores/list?header=importers')
    await waitFor(() => expect(panel()).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Open detail' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open mapping' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    mockState.dirty = true

    await userEvent.click(screen.getByRole('button', { name: 'Close Edit mapping' }))
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Edit mapping' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close Edit mapping' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit mapping' })).not.toBeInTheDocument())
  })

  it('closing the panel with unsaved work in a level asks first', async () => {
    draw({}, '/stores/list?header=importers')
    await waitFor(() => expect(panel()).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Open detail' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open mapping' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
    mockState.dirty = true

    await closePanel()
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    expect(mockState.removeQueryToUrl).not.toHaveBeenCalled()
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Discard' })) })
    await waitFor(() => expect(mockState.removeQueryToUrl).toHaveBeenCalledWith(['header']))
  })
})

// review (3.C): fixes from the fresh review of the lot
describe('review fixes', () => {
  it('reopening after a close writes ?header=importers again (the router location is stale after replaceState)', async () => {
    window.history.replaceState(null, '', '/stores/list?header=importers')
    const onOpenChange = vi.fn()
    const { redraw } = draw({ open: true, onOpenChange, hideTrigger: true }, '/stores/list?header=importers')
    await waitFor(() => expect(panel()).toBeInTheDocument())
    redraw({ open: false, onOpenChange, hideTrigger: true })
    window.history.replaceState(null, '', '/stores/list') // what removeQueryToUrl does
    mockState.addQueryToUrl.mockClear()
    redraw({ open: true, onOpenChange, hideTrigger: true })
    expect(mockState.addQueryToUrl).toHaveBeenCalledWith({ header: 'importers' })
  })

  it('opening a level takes the focus to its title and closing it gives the focus back to its opener', async () => {
    draw({}, '/stores/list?header=importers')
    await waitFor(() => expect(panel()).toBeInTheDocument())
    const opener = screen.getByRole('button', { name: 'Open detail' })
    opener.focus()
    await userEvent.click(opener)
    const title = await screen.findByRole('heading', { name: 'Import Products' })
    await waitFor(() => expect(document.activeElement).toBe(title))
    await userEvent.click(screen.getByRole('button', { name: 'Close Import Products' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Import Products' })).not.toBeInTheDocument())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open detail' })))
  })
})

// redesign bugs E: the sidebar, links, back/forward, ⌘K and Mia ask too while a level of the panel holds unsaved work.
// The forms live in the hosts of the levels (ImportersPane), so the levels tell the panel when they hold unsaved work.
describe('ImportersButton · ways out of the page', () => {
  const route = {}
  const drawWithHistory = () => render(
    <MemoryRouter initialEntries={['/stores/list?header=importers']}>
      <ImportersButton />
      <Route path='*' render={({ history, location }) => { route.history = history; route.path = location.pathname; return null }} />
    </MemoryRouter>
  )
  const openDirtyMapping = async () => {
    await waitFor(() => expect(panel()).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Open detail' }))
    mockState.dirty = true
    await userEvent.click(await screen.findByRole('button', { name: 'Open mapping' }))
    await screen.findByRole('heading', { name: 'Edit mapping' })
  }

  it('a route change to another page asks first; Keep editing stays on the page', async () => {
    drawWithHistory()
    await openDirtyMapping()
    act(() => { route.history.push('/orders') })
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    expect(route.path).toBe('/stores/list')
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(route.path).toBe('/stores/list')
  })

  it('⌘K and Mia ask first; Discard lets them go', async () => {
    const { requestRouteLeave } = await import('../../../../utils/routeLeaveGuard')
    drawWithHistory()
    await openDirtyMapping()
    const go = vi.fn()
    act(() => { requestRouteLeave(go) })
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(go).toHaveBeenCalledTimes(1))
  })

  // review E2-5: a level that leaves with its unsaved work (Discard) no longer holds the page
  it('once the dirty level is gone, the page is free again', async () => {
    drawWithHistory()
    await openDirtyMapping()
    await userEvent.click(screen.getByRole('button', { name: 'Close Edit mapping' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit mapping' })).not.toBeInTheDocument())
    act(() => { route.history.push('/orders') })
    expect(route.path).toBe('/orders')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('with nothing unsaved the page is never held', async () => {
    drawWithHistory()
    await waitFor(() => expect(panel()).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Open detail' }))
    act(() => { route.history.push('/orders') })
    expect(route.path).toBe('/orders')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
