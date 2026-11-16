import React, { useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useEditorPanel } from '../useEditorPanel'
import { useEditorPanel as useEditorPanelFromBarrel } from '..'
import { registerSidebar } from '../../UI/sidebar-layer'
import { CONFIRM_DIALOG_LAYER, useDialogLayer } from '../../UI/dialog-layer'

// redesign SP-F0 (E0)
const Panel = ({ open = true, onClose, resetKey, modalBelow, modal, hook = useEditorPanel }) => {
  const panelRef = useRef(null)
  hook({ open, panelRef, onClose, resetKey, modalBelow, modal })
  return open ? <div ref={panelRef} tabIndex={-1} data-testid='panel'><button type='button'>inside</button></div> : null
}

const Dialog = () => {
  const popupRef = useRef(null)
  const lastFocusedRef = useRef(null)
  useDialogLayer({ open: true, kind: CONFIRM_DIALOG_LAYER, popupRef, lastFocusedRef })
  return <div role='dialog' ref={popupRef} />
}

const press = (target, code) => fireEvent.keyDown(target, { key: code, code })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useEditorPanel', () => {
  it('is exported by the Product barrel', () => {
    expect(useEditorPanelFromBarrel).toBe(useEditorPanel)
  })

  it('moves the focus into the panel when it opens', () => {
    render(<Panel />)
    expect(document.activeElement).toBe(screen.getByTestId('panel'))
  })

  it('gives the focus back to the opener when it closes, if the opener is still in the page', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { rerender } = render(<Panel open />)
    expect(document.activeElement).toBe(screen.getByTestId('panel'))
    rerender(<Panel open={false} />)
    expect(document.activeElement).toBe(opener)
  })

  it('does not give the focus back to an opener that left the page', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const focus = vi.spyOn(opener, 'focus')
    const { rerender } = render(<Panel open />)
    focus.mockClear()
    opener.remove()
    rerender(<Panel open={false} />)
    expect(focus).not.toHaveBeenCalled()
  })

  it('focuses the panel again when resetKey changes', () => {
    const { rerender } = render(<Panel resetKey='a' />)
    screen.getByText('inside').focus()
    expect(document.activeElement).toBe(screen.getByText('inside'))
    rerender(<Panel resetKey='b' />)
    expect(document.activeElement).toBe(screen.getByTestId('panel'))
  })

  it('does not move the focus while it is closed', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    render(<Panel open={false} />)
    expect(document.activeElement).toBe(outside)
  })

  it('closes on Escape when it is the layer on top, at any window width', () => {
    const onClose = vi.fn()
    render(<Panel onClose={onClose} />)
    press(screen.getByText('inside'), 'Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    const onClose = vi.fn()
    render(<Panel onClose={onClose} />)
    press(screen.getByText('inside'), 'Enter')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close while a dialog layer is open: the dialog takes the key', () => {
    const onClose = vi.fn()
    render(<><Panel onClose={onClose} /><Dialog /></>)
    press(screen.getByRole('dialog'), 'Escape')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close when another sidebar is the layer on top', () => {
    const onClose = vi.fn()
    render(<Panel onClose={onClose} />)
    const other = document.createElement('div')
    document.body.appendChild(other)
    const unregister = registerSidebar({ current: other })
    press(other, 'Escape')
    expect(onClose).not.toHaveBeenCalled()
    unregister()
  })

  it('does not listen while closed', () => {
    const onClose = vi.fn()
    render(<Panel open={false} onClose={onClose} />)
    press(document.body, 'Escape')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stops listening once it closes', () => {
    const onClose = vi.fn()
    const { rerender } = render(<Panel onClose={onClose} />)
    rerender(<Panel open={false} onClose={onClose} />)
    act(() => { press(document.body, 'Escape') })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls the latest onClose without re-registering', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Panel onClose={first} />)
    rerender(<Panel onClose={second} />)
    press(screen.getByText('inside'), 'Escape')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

// redesign bugs Q: the panel that covers the screen is modal
describe('useEditorPanel · modalBelow', () => {
  const realMatchMedia = window.matchMedia
  let width
  let listeners

  // the window as a matchMedia double that only knows `(max-width: Npx)`
  const installMatchMedia = (initial) => {
    width = initial
    listeners = new Set()
    window.matchMedia = vi.fn(query => {
      const limit = Number(/max-width:\s*(\d+)px/.exec(query)?.[1])
      return {
        get matches () { return width <= limit },
        media: query,
        addEventListener: (_type, listener) => listeners.add(listener),
        removeEventListener: (_type, listener) => listeners.delete(listener)
      }
    })
  }
  const resizeTo = (next) => act(() => {
    width = next
    listeners.forEach(listener => listener())
  })

  const Page = (props) => (
    <div data-testid='app'>
      <nav data-testid='menu'><button type='button'>Open menu</button></nav>
      <main data-testid='main'>
        <ul data-testid='list'><li><button type='button'>Next page</button></li></ul>
        <Panel {...props} />
      </main>
    </div>
  )
  const isInert = (id) => screen.getByTestId(id).hasAttribute('inert')

  afterEach(() => {
    window.matchMedia = realMatchMedia
  })

  it('narrow: what is beside the panel and its ancestors is inert and the panel is a modal dialog', () => {
    installMatchMedia(390)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    render(<Page modalBelow={500} />)
    expect(isInert('menu')).toBe(true)
    expect(isInert('list')).toBe(true)
    expect(outside).toHaveAttribute('inert')
    expect(isInert('app')).toBe(false)
    expect(isInert('main')).toBe(false)
    expect(screen.getByTestId('panel')).toHaveAttribute('role', 'dialog')
    expect(screen.getByTestId('panel')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('inside').closest('[inert]')).toBeNull()
  })

  it('narrow: the shared dialog host and the Base UI portals are left alone', () => {
    installMatchMedia(390)
    const host = document.createElement('div')
    host.id = 'app-modals'
    const portal = document.createElement('div')
    portal.setAttribute('data-base-ui-portal', '')
    document.body.append(host, portal)
    render(<Page modalBelow={500} />)
    expect(host).not.toHaveAttribute('inert')
    expect(portal).not.toHaveAttribute('inert')
    expect(isInert('menu')).toBe(true)
  })

  it('wide: nothing is inert and the panel has no dialog role', () => {
    installMatchMedia(1440)
    render(<Page modalBelow={500} />)
    expect(document.querySelector('[inert]')).toBeNull()
    expect(screen.getByTestId('panel')).not.toHaveAttribute('role')
    expect(screen.getByTestId('panel')).not.toHaveAttribute('aria-modal')
  })

  it('without the option (the other consumers) nothing changes, even on a narrow window', () => {
    installMatchMedia(390)
    render(<Page />)
    expect(document.querySelector('[inert]')).toBeNull()
    expect(screen.getByTestId('panel')).not.toHaveAttribute('role')
  })

  it('follows the window: narrower turns it on, wider turns it off', () => {
    installMatchMedia(1440)
    render(<Page modalBelow={500} />)
    resizeTo(390)
    expect(isInert('list')).toBe(true)
    expect(screen.getByTestId('panel')).toHaveAttribute('aria-modal', 'true')
    resizeTo(1440)
    expect(document.querySelector('[inert]')).toBeNull()
    expect(screen.getByTestId('panel')).not.toHaveAttribute('aria-modal')
  })

  it('closing the panel takes inert away', () => {
    installMatchMedia(390)
    const { rerender } = render(<Page modalBelow={500} />)
    expect(isInert('list')).toBe(true)
    rerender(<Page modalBelow={500} open={false} />)
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('unmounting leaves nothing behind', () => {
    installMatchMedia(390)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const { unmount } = render(<Page modalBelow={500} />)
    expect(outside).toHaveAttribute('inert')
    unmount()
    expect(outside).not.toHaveAttribute('inert')
    expect(document.querySelector('[inert]')).toBeNull()
    expect(listeners.size).toBe(0)
  })

  it('what opens later (a dialog) is not made inert', () => {
    installMatchMedia(390)
    render(<Page modalBelow={500} />)
    const later = document.createElement('div')
    document.body.appendChild(later)
    expect(later).not.toHaveAttribute('inert')
  })
})

// redesign bugs Q (adjustment): `modal` is decided by the consumer (the store editor: its panel is `full`, whatever the
// window width), with no matchMedia.
describe('useEditorPanel · modal', () => {
  const realMatchMedia = window.matchMedia
  const Page = (props) => (
    <div data-testid='app'>
      <nav data-testid='menu'><button type='button'>Open menu</button></nav>
      <main data-testid='main'>
        <ul data-testid='list'><li><button type='button'>Next page</button></li></ul>
        <Panel {...props} />
      </main>
    </div>
  )
  const isInert = (id) => screen.getByTestId(id).hasAttribute('inert')

  afterEach(() => {
    window.matchMedia = realMatchMedia
  })

  it('modal true: what is beside the panel and its ancestors is inert and the panel is a modal dialog, without matchMedia', () => {
    window.matchMedia = undefined
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    render(<Page modal />)
    expect(isInert('menu')).toBe(true)
    expect(isInert('list')).toBe(true)
    expect(outside).toHaveAttribute('inert')
    expect(isInert('app')).toBe(false)
    expect(isInert('main')).toBe(false)
    expect(screen.getByTestId('panel')).toHaveAttribute('role', 'dialog')
    expect(screen.getByTestId('panel')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('inside').closest('[inert]')).toBeNull()
  })

  it('changing modal to false clears inert, the role and aria-modal', () => {
    const { rerender } = render(<Page modal />)
    expect(isInert('list')).toBe(true)
    rerender(<Page modal={false} />)
    expect(document.querySelector('[inert]')).toBeNull()
    expect(screen.getByTestId('panel')).not.toHaveAttribute('role')
    expect(screen.getByTestId('panel')).not.toHaveAttribute('aria-modal')
    rerender(<Page modal />)
    expect(isInert('list')).toBe(true)
    expect(screen.getByTestId('panel')).toHaveAttribute('aria-modal', 'true')
  })

  it('is only modal while the panel is open, and unmounting leaves nothing behind', () => {
    const { rerender, unmount } = render(<Page modal />)
    rerender(<Page modal open={false} />)
    expect(document.querySelector('[inert]')).toBeNull()
    rerender(<Page modal />)
    expect(isInert('list')).toBe(true)
    unmount()
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('without the option, or with modal false, a wide or narrow window changes nothing', () => {
    render(<Page />)
    expect(document.querySelector('[inert]')).toBeNull()
    expect(screen.getByTestId('panel')).not.toHaveAttribute('aria-modal')
  })

  it('modalBelow keeps working next to it (compatibility)', () => {
    window.matchMedia = vi.fn(query => ({ matches: Number(/max-width:\s*(\d+)px/.exec(query)?.[1]) >= 390, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<Page modalBelow={500} />)
    expect(screen.getByTestId('panel')).toHaveAttribute('aria-modal', 'true')
    expect(isInert('list')).toBe(true)
  })
})

// redesign bugs Q, final review: closing a modal panel gives the focus back to its opener, an inert someone else set
// while it was open is left in place, and the document head and the toast host are never touched.
describe('useEditorPanel · modal, review fixes', () => {
  const OpenerPage = ({ open, opener }) => (
    <div data-testid='app'>
      <nav data-testid='menu'><button type='button'>Open menu</button></nav>
      <main data-testid='main'>
        <ul data-testid='list'><li><button type='button' ref={opener}>Open KCF</button></li></ul>
        <Panel modal open={open} />
      </main>
    </div>
  )

  it('gives the focus back to the opener even though it was inert while the panel was open', () => {
    // a browser does not focus an element inside an inert subtree (jsdom does): the double keeps that rule
    const realFocus = HTMLElement.prototype.focus
    const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (options) {
      if (this.closest('[inert]')) return
      return realFocus.call(this, options)
    })
    try {
      let openerNode = null
      const opener = (node) => { if (node) openerNode = node }
      const { rerender } = render(<OpenerPage open={false} opener={opener} />)
      act(() => openerNode.focus())
      rerender(<OpenerPage open opener={opener} />)
      expect(document.activeElement).toBe(screen.getByTestId('panel'))
      rerender(<OpenerPage open={false} opener={opener} />)
      expect(document.querySelector('[inert]')).toBeNull()
      expect(document.activeElement).toBe(openerNode)
    } finally {
      spy.mockRestore()
    }
  })

  it('leaves the inert of an element that someone else made inert while the panel was open', () => {
    const Page = ({ open }) => (
      <div data-testid='app'>
        <nav data-testid='menu'><button type='button'>Open menu</button></nav>
        <main data-testid='main'><Panel modal open={open} /></main>
      </div>
    )
    const { rerender } = render(<Page open />)
    expect(screen.getByTestId('menu')).toHaveAttribute('inert')
    // e.g. the sidebar collapses on a narrower window and React sets its own inert on it
    screen.getByTestId('menu').setAttribute('inert', '')
    rerender(<Page open={false} />)
    expect(screen.getByTestId('menu')).toHaveAttribute('inert')
  })

  it('never makes the document head or the toast host inert', () => {
    const toast = document.createElement('div')
    toast.id = 'toast-container'
    document.body.appendChild(toast)
    render(<Panel modal />)
    expect(document.head.hasAttribute('inert')).toBe(false)
    expect(toast.hasAttribute('inert')).toBe(false)
  })
})
