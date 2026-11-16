import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Dialog } from '../Dialog'
import { Menu } from '../Menu'
import { SplitView, useSplitView } from '../SplitView'
import { RecordPanel } from '../RecordPanel'

const CSS = readFileSync(path.resolve(__dirname, '../split-view.css'), 'utf8')

// ── Environment: matchMedia by width, and token resolution ──
// jsdom has no matchMedia and resolves no CSS variable. The mock evaluates the
// (min-width) / (max-width) queries against a width the test controls, and tells
// listeners when it changes. tokenPx() measures a probe element whose inline style
// carries `inline-size:var(--token)`; the mock answers with the token's value.
const TOKENS = { '--od-x-panel': 520, '--od-x-panel-narrow': 440, '--od-x-dialog-lg': 720, '--od-space-4': 16 }
const originalRect = Element.prototype.getBoundingClientRect
let viewport

const installViewport = width => {
  viewport = { width, listeners: new Set() }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? viewport.width >= Number(value) : viewport.width <= Number(value)
  })
  window.matchMedia = query => {
    const mql = {
      media: query,
      get matches () { return matches(query) },
      addEventListener: (_, listener) => viewport.listeners.add(listener),
      removeEventListener: (_, listener) => viewport.listeners.delete(listener),
      addListener: listener => viewport.listeners.add(listener),
      removeListener: listener => viewport.listeners.delete(listener)
    }
    return mql
  }
  window.innerWidth = width
}

const resize = width => act(() => {
  viewport.width = width
  window.innerWidth = width
  viewport.listeners.forEach(listener => listener({ matches: true }))
})

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    const cssText = this.style?.cssText || ''
    const hit = Object.entries(TOKENS).find(([name]) => cssText.includes(`var(${name})`))
    return { width: hit ? hit[1] : 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0 }
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  Element.prototype.getBoundingClientRect = originalRect
  delete window.matchMedia
  window.localStorage.clear()
  document.getElementById('app-modals')?.remove()
})

// ── Fixtures ──
const PanelBody = () => {
  const { mode, open, expanded, onClose } = useSplitView()
  return (
    <div>
      <p data-testid='ctx'>{`${mode}|${open}|${expanded}`}</p>
      <button type='button' onClick={onClose}>Close panel</button>
      <input aria-label='Note' />
    </div>
  )
}

const Harness = ({ initialOpen = false, onClose, list, ...props }) => {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button type='button'>Before the view</button>
      <SplitView
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        panelLabel='Order details'
        resizeLabel='Resize the details panel'
        list={list ?? (
          <div>
            <input aria-label='Search orders' />
            <button type='button' onClick={() => setOpen(true)}>Open order 1</button>
          </div>
        )}
        panel={<PanelBody />}
        {...props}
      />
    </>
  )
}

const panelAside = () => screen.getByRole('complementary', { name: 'Order details' })
const separator = () => screen.getByRole('separator', { name: 'Resize the details panel' })
const listOf = () => screen.getByLabelText('Search orders').parentElement.parentElement
const tabInside = async (user, popup) => {
  await user.tab()
  await waitFor(() => expect(popup.contains(document.activeElement)).toBe(true))
}

describe('Product SplitView — contract', () => {
  it.each([
    ['panelLabel', { panelLabel: undefined }, 'SplitView needs a panelLabel'],
    ['resizeLabel', { resizeLabel: undefined }, 'SplitView needs a resizeLabel']
  ])('throws a clear Error without %s', (_, props, message) => {
    installViewport(1400)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness {...props} />)).toThrow(message)
  })

  it('draws no text of its own', () => {
    installViewport(1400)
    const { container } = render(<Harness initialOpen />)
    expect(container.textContent).toBe('Before the viewOpen order 1split|true|falseClose panel')
  })

  it('shows only the list, full width, when nothing is open', () => {
    installViewport(1400)
    render(<Harness />)
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByRole('separator')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Search orders')).toBeVisible()
    expect(listOf()).not.toHaveAttribute('hidden')
    expect(listOf()).not.toHaveAttribute('inert')
  })
})

describe('Product SplitView — split (from 1280px)', () => {
  it('is a named, non-modal aside beside the list, and the list stays usable', () => {
    installViewport(1400)
    render(<Harness initialOpen />)
    const aside = panelAside()
    expect(aside.tagName).toBe('ASIDE')
    expect(aside).not.toHaveAttribute('aria-modal')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(aside).getByRole('button', { name: 'Close panel' })).toBeInTheDocument()
    expect(listOf()).not.toHaveAttribute('hidden')
    expect(listOf()).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Open order 1' })).toBeInTheDocument()
  })

  it('moves the focus into the panel on open instead of losing it', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    expect(panelAside()).toHaveFocus()
    expect(panelAside()).toHaveAttribute('tabindex', '-1')
  })

  it('returns the focus to the opener on close, when it is still there', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open order 1' })
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(opener).toHaveFocus()
  })

  // parity audit 2 (B7): main closed the panel with Escape from anywhere in the page at 1000px or more.
  it('closes with Escape from anywhere in the page, in the panel or outside it', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    screen.getByLabelText('Search orders').focus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    // redesign F6c (Q2-02): a text field of the panel keeps the Escape; with the focus elsewhere in the panel it closes
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    await user.click(screen.getByLabelText('Note'))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  // redesign F6c (Q2-02): the QA found Escape in Notes, Email, a custom field Key and the chat composer closed the
  // order and threw away what was typed. A field of the panel owns its Escape.
  describe('Escape in a field of the panel', () => {
    const EditableBody = () => (
      <div>
        <input aria-label='Note' />
        <textarea aria-label='Comment' />
        <div role='textbox' contentEditable suppressContentEditableWarning tabIndex={0} aria-label='Rich' />
        <button type='button' role='combobox' aria-haspopup='listbox' aria-expanded='false' aria-label='Pick one'>Pick one</button>
        <button type='button' role='combobox' aria-haspopup='listbox' aria-expanded='true' aria-label='Open pick'>Open pick</button>
        <button type='button'>Plain button</button>
      </div>
    )

    it.each([
      ['an input', () => screen.getByLabelText('Note')],
      ['a textarea', () => screen.getByLabelText('Comment')],
      ['a contenteditable', () => screen.getByLabelText('Rich')],
      // redesign F6d (P4-01): only a select trigger whose list is open keeps the Escape; a closed one is a button
      ['a select trigger with its list open', () => screen.getByRole('combobox', { name: 'Open pick' })]
    ])('does not close the panel from %s', async (_, getField) => {
      installViewport(1400)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<EditableBody />} />)
      await user.click(getField())
      expect(getField()).toHaveFocus()
      await user.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('complementary', { name: 'Order details' })).toBeInTheDocument()
    })

    it('leaves what was typed and takes the focus out of the field, so the next Escape closes', async () => {
      installViewport(1400)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<EditableBody />} />)
      await user.type(screen.getByLabelText('Note'), 'gate code 4')
      await user.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Note')).toHaveValue('gate code 4')
      expect(screen.getByLabelText('Note')).not.toHaveFocus()
      expect(panelAside().contains(document.activeElement)).toBe(true)
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('still closes with Escape from a button of the panel', async () => {
      installViewport(1400)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<EditableBody />} />)
      await user.click(screen.getByRole('button', { name: 'Plain button' }))
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // redesign F6d (P4-01): after choosing a status or a driver the focus sits on the closed trigger; main closed the
    // panel with Escape from anywhere, so a closed trigger behaves like a button (through the guard).
    it('closes from a select trigger whose list is closed, like from a button', async () => {
      installViewport(1400)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<EditableBody />} />)
      await user.click(screen.getByRole('combobox', { name: 'Pick one' }))
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('goes through the close guard from a closed select trigger', async () => {
      installViewport(1400)
      const user = userEvent.setup()
      const onClose = vi.fn()
      const guard = vi.fn(() => true)
      const Guarded = () => {
        const { registerCloseGuard } = useSplitView()
        React.useEffect(() => registerCloseGuard(guard), [registerCloseGuard])
        return <button type='button' role='combobox' aria-haspopup='listbox' aria-expanded='false' aria-label='Pick one'>Pick one</button>
      }
      render(<Harness initialOpen onClose={onClose} panel={<Guarded />} />)
      await user.click(screen.getByRole('combobox', { name: 'Pick one' }))
      await user.keyboard('{Escape}')
      expect(guard).toHaveBeenCalledTimes(1)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('closes the overlay panel from a closed select trigger too', async () => {
      installViewport(1000)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<EditableBody />} />)
      const dialog = await screen.findByRole('dialog', { name: 'Order details' })
      await user.click(within(dialog).getByRole('combobox', { name: 'Pick one' }))
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // redesign F6d (Q3-09): the field the first Escape took the focus from, for the content to give it back
    it('tells the content which field the first Escape left, until the focus goes elsewhere in the panel', async () => {
      installViewport(1400)
      const user = userEvent.setup()
      let split
      const Probe = () => {
        split = useSplitView()
        return (
          <div>
            <input aria-label='Note' />
            <button type='button'>Plain button</button>
          </div>
        )
      }
      render(<Harness initialOpen panel={<Probe />} />)
      expect(split.getEscapedField()).toBeNull()
      await user.click(screen.getByLabelText('Note'))
      await user.keyboard('{Escape}')
      expect(split.getEscapedField()).toBe(screen.getByLabelText('Note'))
      await user.click(screen.getByRole('button', { name: 'Plain button' }))
      expect(split.getEscapedField()).toBeNull()
    })

    it('tells the content the field the first Escape left in the overlay panel as well', async () => {
      installViewport(1000)
      const user = userEvent.setup()
      let split
      const Probe = () => {
        split = useSplitView()
        return <input aria-label='Note' />
      }
      render(<Harness initialOpen panel={<Probe />} />)
      const dialog = await screen.findByRole('dialog', { name: 'Order details' })
      await user.click(within(dialog).getByLabelText('Note'))
      await user.keyboard('{Escape}')
      expect(split.getEscapedField()).toBe(within(dialog).getByLabelText('Note'))
    })

    it('does not close the overlay panel from a field either', async () => {
      installViewport(1000)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<EditableBody />} />)
      const dialog = await screen.findByRole('dialog', { name: 'Order details' })
      await user.click(within(dialog).getByLabelText('Note'))
      await user.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Order details' })).toBeInTheDocument()
    })
  })

  describe('close guard (unsaved changes)', () => {
    const GuardedBody = ({ guard }) => {
      const { registerCloseGuard, requestClose } = useSplitView()
      React.useEffect(() => registerCloseGuard(guard), [registerCloseGuard, guard])
      return <button type='button' onClick={requestClose}>Ask to close</button>
    }

    it('lets the content take over Escape: the panel stays until the content proceeds', async () => {
      installViewport(1400)
      const user = userEvent.setup()
      const onClose = vi.fn()
      const guard = vi.fn(() => true)
      render(<Harness initialOpen onClose={onClose} panel={<GuardedBody guard={guard} />} />)
      await user.click(screen.getByRole('button', { name: 'Ask to close' }))
      await user.keyboard('{Escape}')
      expect(guard).toHaveBeenCalledTimes(2)
      expect(onClose).not.toHaveBeenCalled()
      guard.mock.calls[0][0]()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // review of (422): a caller that closes the panel to show something else needs to know whether it closed or the
    // content took over (to ask about unsaved text), so it does not act later on an answer the user may never give.
    it('answers true when it closed and false when a guard took over', () => {
      installViewport(1400)
      let api
      const Probe = ({ guard }) => {
        api = useSplitView()
        React.useEffect(() => api.registerCloseGuard(guard), [guard])
        return null
      }
      const onClose = vi.fn()
      const { rerender } = render(<Harness initialOpen onClose={onClose} panel={<Probe guard={() => true} />} />)
      let answer
      act(() => { answer = api.requestClose() })
      expect(answer).toBe(false)
      expect(onClose).not.toHaveBeenCalled()
      rerender(<Harness initialOpen onClose={onClose} panel={<Probe guard={() => false} />} />)
      act(() => { answer = api.requestClose() })
      expect(answer).toBe(true)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes as always when the guard has nothing to protect', async () => {
      installViewport(1400)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<GuardedBody guard={() => false} />} />)
      await user.click(screen.getByRole('button', { name: 'Ask to close' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('guards the scrim click of the overlay panel too', async () => {
      installViewport(1000)
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness initialOpen onClose={onClose} panel={<GuardedBody guard={() => true} />} />)
      await screen.findByRole('dialog')
      await user.click(document.querySelector('.odc-overlay-backdrop'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('closes with Escape when the focus is on the page itself', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} />)
    document.activeElement?.blur()
    expect(document.body).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not listen while the panel is closed', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves an Escape that something inside already handled alone', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} />)
    const note = screen.getByLabelText('Note')
    note.addEventListener('keydown', event => event.preventDefault())
    await user.click(note)
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves an Escape that something outside the panel already handled alone', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} />)
    const search = screen.getByLabelText('Search orders')
    search.addEventListener('keydown', event => event.preventDefault())
    await user.click(search)
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close while a dialog is open on top: Escape closes the dialog first, then the panel', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onDialogClose = vi.fn()
    const Stack = () => {
      const [dialog, setDialog] = useState(true)
      return (
        <Dialog
          open={dialog}
          onOpenChange={next => { onDialogClose(next); setDialog(next) }}
          title='Confirm'
          closeLabel='Close'
        >
          <button type='button'>Inside the dialog</button>
        </Dialog>
      )
    }
    render(<Harness initialOpen onClose={onClose} list={<Stack />} />)
    await screen.findByRole('dialog', { name: 'Confirm' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onDialogClose).toHaveBeenCalledWith(false)
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close while a menu is open: Escape closes the menu first, then the panel', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} list={<Menu label='Actions' items={[{ key: 'a', label: 'Do it', onSelect: () => {} }]} />} />)
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close while a popover or listbox from a library is open (a dialog or menu role outside the panel)', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} />)
    const popup = document.createElement('div')
    popup.setAttribute('role', 'dialog')
    popup.setAttribute('aria-label', 'Filter')
    document.body.appendChild(popup)
    try {
      await user.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      popup.remove()
    }
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores an Escape that is composing text (an IME)', () => {
    installViewport(1400)
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} />)
    fireEvent.keyDown(screen.getByLabelText('Note'), { key: 'Escape', isComposing: true })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('uses the panel width token, and the narrow one between 1280 and 1359px', () => {
    installViewport(1400)
    const { container, unmount } = render(<Harness initialOpen />)
    expect(separator()).toHaveAttribute('aria-valuenow', '520')
    expect(container.querySelector('.odc-split').style.getPropertyValue('--odc-panel-size')).toBe('')
    unmount()
    installViewport(1300)
    render(<Harness initialOpen />)
    expect(separator()).toHaveAttribute('aria-valuenow', '440')
  })
})

describe('Product SplitView — the separator', () => {
  it('is a focusable vertical separator named by resizeLabel, with its range in px', () => {
    installViewport(1400)
    render(<Harness initialOpen />)
    const bar = separator()
    expect(bar).toHaveAttribute('aria-orientation', 'vertical')
    expect(bar).toHaveAttribute('aria-valuemin', '440')
    expect(bar).toHaveAttribute('aria-valuemax', '720')
    expect(bar).toHaveAttribute('aria-valuenow', '520')
    expect(bar).toHaveAttribute('tabindex', '0')
  })

  it('is focusable in the tab order, between the list and the panel', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Harness initialOpen />)
    screen.getByRole('button', { name: 'Open order 1' }).focus()
    await user.tab()
    expect(separator()).toHaveFocus()
    await user.tab()
    expect(within(panelAside()).getByRole('button', { name: 'Close panel' })).toHaveFocus()
  })

  it('resizes with the arrows by one --od-space-4 step, in the visual direction (LTR)', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const { container } = render(<Harness initialOpen />)
    separator().focus()
    await user.keyboard('{ArrowLeft}')
    expect(separator()).toHaveAttribute('aria-valuenow', '536')
    expect(container.querySelector('.odc-split').style.getPropertyValue('--odc-panel-size')).toBe('536px')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(separator()).toHaveAttribute('aria-valuenow', '504')
  })

  it('inverts the arrows in RTL', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<ThemeProvider theme={{ rtl: true }}><Harness initialOpen /></ThemeProvider>)
    separator().focus()
    await user.keyboard('{ArrowLeft}')
    expect(separator()).toHaveAttribute('aria-valuenow', '504')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(separator()).toHaveAttribute('aria-valuenow', '536')
  })

  it('goes to the minimum with Home and the maximum with End, and never past them', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Harness initialOpen />)
    separator().focus()
    await user.keyboard('{Home}')
    expect(separator()).toHaveAttribute('aria-valuenow', '440')
    await user.keyboard('{ArrowRight}')
    expect(separator()).toHaveAttribute('aria-valuenow', '440')
    await user.keyboard('{End}')
    expect(separator()).toHaveAttribute('aria-valuenow', '720')
    await user.keyboard('{ArrowLeft}')
    expect(separator()).toHaveAttribute('aria-valuenow', '720')
  })

  it('resizes by dragging with the pointer, clamped, and mirrored in RTL', () => {
    installViewport(1400)
    const { unmount } = render(<Harness initialOpen />)
    const bar = separator()
    fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 1000 })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 960 })
    expect(separator()).toHaveAttribute('aria-valuenow', '560')
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 100 })
    expect(separator()).toHaveAttribute('aria-valuenow', '720')
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 100 })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 1000 })
    expect(separator()).toHaveAttribute('aria-valuenow', '720')
    unmount()

    render(<ThemeProvider theme={{ rtl: true }}><Harness initialOpen /></ThemeProvider>)
    const rtlBar = separator()
    fireEvent.pointerDown(rtlBar, { pointerId: 1, button: 0, clientX: 200 })
    fireEvent.pointerMove(rtlBar, { pointerId: 1, clientX: 240 })
    expect(separator()).toHaveAttribute('aria-valuenow', '560')
  })
})

describe('Product SplitView — persistence', () => {
  const KEY = 'orders.split'

  it('keeps the chosen width under storageKey and restores it', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const { unmount } = render(<Harness initialOpen storageKey={KEY} />)
    separator().focus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(window.localStorage.getItem(KEY)).toBe('552')
    unmount()
    render(<Harness initialOpen storageKey={KEY} />)
    expect(separator()).toHaveAttribute('aria-valuenow', '552')
  })

  it('stores nothing without a storageKey', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Harness initialOpen />)
    separator().focus()
    await user.keyboard('{ArrowLeft}')
    expect(window.localStorage).toHaveLength(0)
  })

  it('clamps a stored width to the range and ignores garbage', () => {
    installViewport(1400)
    window.localStorage.setItem(KEY, '9999')
    const { unmount } = render(<Harness initialOpen storageKey={KEY} />)
    expect(separator()).toHaveAttribute('aria-valuenow', '720')
    unmount()
    window.localStorage.setItem(KEY, 'wide')
    render(<Harness initialOpen storageKey={KEY} />)
    expect(separator()).toHaveAttribute('aria-valuenow', '520')
  })

  it('does not break when reading or writing the storage throws', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    render(<Harness initialOpen storageKey={KEY} />)
    expect(separator()).toHaveAttribute('aria-valuenow', '520')
    separator().focus()
    await user.keyboard('{ArrowLeft}')
    expect(separator()).toHaveAttribute('aria-valuenow', '536')
  })

  it('does not break when the storage itself is unreachable', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('SecurityError') })
    render(<Harness initialOpen storageKey={KEY} />)
    separator().focus()
    await user.keyboard('{ArrowLeft}')
    expect(separator()).toHaveAttribute('aria-valuenow', '536')
  })
})

// redesign tramo A r4 (W0-QA2-04): the focus is on a control of the loading skeleton (its «Close») when the real panel arrives and the
// control leaves the page: the focus goes to the control with the same name in the real panel, else to the panel, never to <body>.
describe('Product SplitView — the control that has the focus is replaced (W0-QA2-04)', () => {
  const Swap = ({ ready }) => ready
    ? <div key='real'><button type='button' aria-label='Close'>real</button><input aria-label='Note' /></div>
    : <div key='skeleton'><button type='button' aria-label='Close'>skeleton</button></div>
  const Swapping = ({ named = true }) => {
    const [ready, setReady] = React.useState(false)
    return (
      <>
        <button type='button' data-testid='arrive' onClick={() => setReady(true)}>arrive</button>
        {named ? <Swap ready={ready} /> : (ready ? <input key='note' aria-label='Note' /> : <button key='noname' type='button'>no name</button>)}
      </>
    )
  }
  const arrive = () => act(() => { document.querySelector('[data-testid="arrive"]').dispatchEvent(new MouseEvent('click', { bubbles: true })) })

  it.each([[1400, 'split'], [1000, 'overlay'], [500, 'full']])('at %i (%s) the focus passes to the real «Close»', async (width) => {
    installViewport(width)
    render(<Harness initialOpen panel={<Swapping />} />)
    const panel = await screen.findByLabelText('Order details')
    const skeletonClose = within(panel).getByRole('button', { name: 'Close' })
    act(() => skeletonClose.focus())
    expect(skeletonClose).toHaveFocus()
    arrive()
    await waitFor(() => expect(skeletonClose.isConnected).toBe(false))
    const real = within(panel).getByRole('button', { name: 'Close' })
    await waitFor(() => expect(real).toHaveFocus())
    expect(document.body).not.toHaveFocus()
  })

  it.each([[1400], [1000]])('at %i, with no control of the same name, the focus goes to the panel itself', async (width) => {
    installViewport(width)
    render(<Harness initialOpen panel={<Swapping named={false} />} />)
    const panel = await screen.findByLabelText('Order details')
    act(() => within(panel).getByRole('button', { name: 'no name' }).focus())
    arrive()
    await within(panel).findByLabelText('Note')
    await waitFor(() => expect(panel).toHaveFocus())
  })

  it('leaves the focus alone when it is outside the panel', async () => {
    installViewport(1400)
    render(<Harness initialOpen panel={<Swapping />} />)
    const panel = await screen.findByLabelText('Order details')
    act(() => within(panel).getByRole('button', { name: 'Close' }).focus())
    const outside = screen.getByRole('button', { name: 'Before the view' })
    act(() => outside.focus())
    arrive()
    await waitFor(() => expect(within(panel).getByLabelText('Note')).toBeInTheDocument())
    expect(outside).toHaveFocus()
  })
})

// redesign tramo A r5 (W0-PA3-04): the focus is only given back to the twin if the control that left HAD it when it left.
describe('Product SplitView — a focus the user took out of the panel is not given back (W0-PA3-04)', () => {
  const Swap = ({ ready }) => ready
    ? <div key='real'><button type='button' aria-label='Close'>real</button></div>
    : <div key='skeleton'><button type='button' aria-label='Close'>skeleton</button></div>
  const Swapping = () => {
    const [ready, setReady] = React.useState(false)
    return (
      <>
        <button type='button' data-testid='arrive' onClick={() => setReady(true)}>arrive</button>
        <Swap ready={ready} />
      </>
    )
  }
  const arrive = () => act(() => { document.querySelector('[data-testid="arrive"]').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  const settle = () => act(async () => { await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 20)) })

  it.each([[1400], [1000]])('at %i, a blur to <body> with the control still in the page is forgotten: the twin does not take the focus', async (width) => {
    installViewport(width)
    render(<Harness initialOpen panel={<Swapping />} />)
    const panel = await screen.findByLabelText('Order details')
    const skeletonClose = within(panel).getByRole('button', { name: 'Close' })
    act(() => skeletonClose.focus())
    act(() => skeletonClose.blur())
    expect(document.body).toHaveFocus()
    await settle() // a real click on an empty zone is a task of its own; jsdom needs the turn
    arrive()
    await waitFor(() => expect(skeletonClose.isConnected).toBe(false))
    await settle()
    expect(within(panel).getByRole('button', { name: 'Close' })).not.toHaveFocus()
    // the overlay's own trap may take the focus to the dialog; in the split nobody does
    if (width >= 1280) expect(document.body).toHaveFocus()
  })

  it('a focus that went to the page and then to <body> is forgotten too', async () => {
    installViewport(1400)
    render(<Harness initialOpen panel={<Swapping />} />)
    const panel = await screen.findByLabelText('Order details')
    act(() => within(panel).getByRole('button', { name: 'Close' }).focus())
    const outside = screen.getByRole('button', { name: 'Before the view' })
    act(() => outside.focus())
    act(() => outside.blur())
    arrive()
    await settle()
    expect(within(panel).getByRole('button', { name: 'Close' })).not.toHaveFocus()
    expect(document.body).toHaveFocus()
  })

  it('still gives the focus to the twin when the control that had it is the one taken out of the page', async () => {
    installViewport(1400)
    render(<Harness initialOpen panel={<Swapping />} />)
    const panel = await screen.findByLabelText('Order details')
    act(() => within(panel).getByRole('button', { name: 'Close' }).focus())
    arrive()
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Close' })).toHaveFocus())
  })
})

describe('Product SplitView — overlay (768 to 1279px)', () => {
  it('opens as a modal dialog named by panelLabel, with no separator, the list kept mounted', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Search orders'), 'abc')
    const opener = screen.getByRole('button', { name: 'Open order 1' })
    await user.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Order details' })
    expect(within(dialog).getByRole('button', { name: 'Close panel' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByRole('separator')).toBeNull()
    expect(within(dialog).getByTestId('ctx')).toHaveTextContent('overlay|true|false')
    const marked = opener.closest('[data-base-ui-inert]')
    expect(marked).not.toBeNull()
    expect(marked).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByLabelText('Search orders', { hidden: true })).toHaveValue('abc')
  })

  it('traps the focus inside while open', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    render(<Harness initialOpen />)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await tabInside(user, dialog)
    await tabInside(user, dialog)
    await tabInside(user, dialog)
  })

  it('closes with Escape and returns the focus to the opener', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'Open order 1' })
    await user.click(opener)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  // redesign tramo A r3 (W0-QA1-05): at 1024 the focus fell to <body>: it opened on the Close button of the loading skeleton,
  // and the real panel replaced the skeleton. The overlay opens on the dialog itself, as the aside of split and full does.
  it('opens with the focus on the dialog itself, the way the aside of the split and full modes does', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Order details' })
    await waitFor(() => expect(dialog).toHaveFocus())
    expect(dialog).toHaveAttribute('tabindex', '-1')
  })

  it('keeps the focus in the dialog when the content that was there at the start (a skeleton) is replaced', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    const Swapping = () => {
      const [ready, setReady] = React.useState(false)
      React.useEffect(() => { const id = setTimeout(() => setReady(true), 50); return () => clearTimeout(id) }, [])
      return ready
        ? <input aria-label='Real note' />
        : <button type='button'>Loading skeleton</button>
    }
    render(<Harness panel={<Swapping />} />)
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Order details' })
    await within(dialog).findByLabelText('Real note')
    expect(within(dialog).queryByRole('button', { name: 'Loading skeleton' })).toBeNull()
    expect(dialog).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('closes with a click on the scrim', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} />)
    await screen.findByRole('dialog')
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Product SplitView — full (below 768px)', () => {
  it('hides the list but keeps it mounted, and brings the panel to the whole view', async () => {
    installViewport(600)
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Search orders'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    const list = listOf()
    expect(list).toHaveAttribute('hidden')
    expect(list).toHaveAttribute('inert')
    expect(list).toContainElement(screen.getByLabelText('Search orders', { hidden: true }))
    expect(screen.queryByRole('separator')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(panelAside()).toHaveFocus()
    expect(within(panelAside()).getByTestId('ctx')).toHaveTextContent('full|true|false')
  })

  it('keeps the list state and returns the focus to the opener on close', async () => {
    installViewport(600)
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Search orders'), 'abc')
    const opener = screen.getByRole('button', { name: 'Open order 1' })
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(listOf()).not.toHaveAttribute('hidden')
    expect(listOf()).not.toHaveAttribute('inert')
    expect(screen.getByLabelText('Search orders')).toHaveValue('abc')
    expect(opener).toHaveFocus()
  })
})

describe('Product SplitView — expanded', () => {
  it('in split, hides the list, gives the panel the whole width, keeps telling the content it is split', () => {
    installViewport(1400)
    const { container } = render(<Harness initialOpen expanded />)
    expect(listOf()).toHaveAttribute('hidden')
    expect(listOf()).toHaveAttribute('inert')
    expect(screen.queryByRole('separator')).toBeNull()
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'panel')
    expect(within(panelAside()).getByTestId('ctx')).toHaveTextContent('split|true|true')
  })

  it('in overlay, is an inline panel rather than a dialog', () => {
    installViewport(1000)
    render(<Harness initialOpen expanded />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(listOf()).toHaveAttribute('hidden')
    expect(within(panelAside()).getByTestId('ctx')).toHaveTextContent('overlay|true|true')
  })

  it('brings the list back when it stops being expanded', () => {
    installViewport(1400)
    const { rerender } = render(<Harness initialOpen expanded />)
    rerender(<Harness initialOpen expanded={false} />)
    expect(listOf()).not.toHaveAttribute('hidden')
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })
})

describe('Product SplitView — useSplitView and the viewport', () => {
  // R1-07: the panel keeps the place it opened in, so what follows the window here is the mode the content is told
  it('tells the panel content the mode, and follows the window', () => {
    installViewport(1400)
    render(<Harness initialOpen />)
    const ctx = () => screen.getByTestId('ctx')
    expect(ctx()).toHaveTextContent('split|true|false')
    resize(1000)
    expect(ctx()).toHaveTextContent('overlay|true|false')
    resize(600)
    expect(ctx()).toHaveTextContent('full|true|false')
    resize(1280)
    expect(ctx()).toHaveTextContent('split|true|false')
    resize(1279)
    expect(ctx()).toHaveTextContent('overlay|true|false')
    resize(768)
    expect(ctx()).toHaveTextContent('overlay|true|false')
    resize(767)
    expect(ctx()).toHaveTextContent('full|true|false')
  })

  it('opens as a dialog from 768 to 1279 and not at the edges around it', () => {
    for (const [width, dialog] of [[1280, false], [1279, true], [768, true], [767, false]]) {
      installViewport(width)
      const { unmount } = render(<Harness initialOpen />)
      expect(!!screen.queryByRole('dialog', { name: 'Order details', hidden: true })).toBe(dialog)
      unmount()
    }
  })

  it('hands onClose to the content', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initialOpen onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// R1-07: crossing 1280 changed the panel from an aside to a Base UI dialog in a portal, which is another
// place in the React tree: the panel was unmounted and what was typed in it was lost.
describe('Product SplitView — the panel survives a change of mode (R1-07)', () => {
  it.each([
    ['split to overlay and back', 1400, 1000, 1400],
    ['overlay to split and back', 1000, 1400, 1000],
    ['split to full and back', 1400, 600, 1400]
  ])('keeps the same panel, with what was typed in it: %s', async (_, first, second, third) => {
    installViewport(first)
    const user = userEvent.setup()
    render(<Harness initialOpen />)
    const note = screen.getByLabelText('Note')
    await user.type(note, 'half a message')
    for (const width of [second, third]) {
      resize(width)
      const kept = screen.getByLabelText('Note')
      expect(kept).toBe(note)
      expect(kept).toHaveValue('half a message')
      expect(kept.isConnected).toBe(true)
    }
  })

  it('keeps the panel state of a component with its own state, not only an uncontrolled input', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const Counter = () => {
      const [count, setCount] = useState(0)
      return <button type='button' onClick={() => setCount(count + 1)}>{`Count ${count}`}</button>
    }
    render(<Harness initialOpen panel={<Counter />} />)
    await user.click(screen.getByRole('button', { name: 'Count 0' }))
    resize(1000)
    expect(screen.getByRole('button', { name: 'Count 1', hidden: true })).toBeInTheDocument()
    resize(1400)
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument()
  })

  it('still unmounts the panel when it closes', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Harness initialOpen />)
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByLabelText('Note')).toBeNull()
  })

  // R1-07 (round 2): the place of the panel (aside or dialog) is decided when it opens and kept while it stays open
  it('opened in the aside at 1400 and the window shrinking to 1000: no dialog, the list hidden, the panel full width in the same aside', () => {
    installViewport(1400)
    const { container } = render(<Harness initialOpen />)
    const aside = panelAside()
    resize(1000)
    expect(container.querySelector('.odc-split-overlay')).toBeNull()
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
    expect(panelAside()).toBe(aside)
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'panel')
    expect(listOf()).toHaveAttribute('hidden')
    expect(listOf()).toHaveAttribute('inert')
    expect(screen.getByTestId('ctx')).toHaveTextContent('overlay|true|false')
    resize(1400)
    expect(container.querySelector('.odc-split')).toHaveAttribute('data-view', 'split')
    expect(listOf()).not.toHaveAttribute('hidden')
  })

  it('opened in the dialog at 1000 and the window growing to 1400 or shrinking to 600: it stays in the dialog until it closes', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Order details' })
    resize(1400)
    expect(screen.getByRole('dialog', { name: 'Order details', hidden: true })).toBe(dialog)
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(within(dialog).getByTestId('ctx')).toHaveTextContent('split|true|false')
    resize(600)
    expect(screen.getByRole('dialog', { name: 'Order details', hidden: true })).toBe(dialog)
    expect(within(dialog).getByTestId('ctx')).toHaveTextContent('full|true|false')
  })

  it('forgets the place when it closes: the next opening follows the window again', async () => {
    installViewport(1000)
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    await screen.findByRole('dialog', { name: 'Order details' })
    resize(1400)
    await user.click(within(screen.getByRole('dialog', { name: 'Order details', hidden: true })).getByRole('button', { name: 'Close panel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Open order 1' }))
    expect(panelAside()).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })
})

// F1: open record A, move to B without closing, close: the focus went back to the row that OPENED the
// panel (A), not to the row of the record that is open (B).
describe('Product SplitView — the focus goes back to the row of the open record (F1)', () => {
  const Records = ({ onClose }) => {
    const [openId, setOpenId] = useState(null)
    const rows = [1, 2].map(id => (
      <li key={id} data-row-id={id}>
        <button type='button' onClick={() => setOpenId(id)}>{`Record ${id}`}</button>
      </li>
    ))
    return (
      <SplitView
        open={openId != null}
        onClose={() => { onClose?.(); setOpenId(null) }}
        panelLabel='Record details'
        resizeLabel='Resize the details panel'
        list={<ul role='list'>{rows}</ul>}
        panel={<PanelBody />}
      />
    )
  }

  it('gives the focus back to the row of B, not of A, when the panel closes with its button', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Records />)
    await user.click(screen.getByRole('button', { name: 'Record 1' }))
    await user.click(screen.getByRole('button', { name: 'Record 2' }))
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.getByRole('button', { name: 'Record 2' })).toHaveFocus()
  })

  it('does the same when B is a row whose cell is not focusable (the click lands on the row)', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const Plain = () => {
      const [openId, setOpenId] = useState(null)
      return (
        <SplitView
          open={openId != null}
          onClose={() => setOpenId(null)}
          panelLabel='Record details'
          resizeLabel='Resize the details panel'
          list={(
            <ul role='list'>
              {[1, 2].map(id => (
                <li key={id} data-row-id={id} tabIndex={0} onClick={() => setOpenId(id)}><span>{`Cell ${id}`}</span></li>
              ))}
            </ul>
          )}
          panel={<PanelBody />}
        />
      )
    }
    render(<Plain />)
    await user.click(screen.getByText('Cell 1'))
    await user.click(screen.getByText('Cell 2'))
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.getByText('Cell 2').closest('li')).toHaveFocus()
  })

  it('still gives it back to the opener when the panel never changed record', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    render(<Records />)
    await user.click(screen.getByRole('button', { name: 'Record 1' }))
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.getByRole('button', { name: 'Record 1' })).toHaveFocus()
  })

  it('does not take a click on a control that is not a row of the list (a filter) for the opener', async () => {
    installViewport(1400)
    const user = userEvent.setup()
    const WithFilter = () => {
      const [openId, setOpenId] = useState(null)
      return (
        <SplitView
          open={openId != null}
          onClose={() => setOpenId(null)}
          panelLabel='Record details'
          resizeLabel='Resize the details panel'
          list={(
            <div>
              <button type='button'>Filter</button>
              <ul role='list'><li data-row-id='1'><button type='button' onClick={() => setOpenId(1)}>Record 1</button></li></ul>
            </div>
          )}
          panel={<PanelBody />}
        />
      )
    }
    render(<WithFilter />)
    await user.click(screen.getByRole('button', { name: 'Record 1' }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.getByRole('button', { name: 'Record 1' })).toHaveFocus()
  })
})

describe('Product SplitView — styles', () => {
  it('lays out the split on the panel-size variable, wide by default and narrow below 1360px', () => {
    expect(CSS).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+var\(--odc-panel-size\)/)
    expect(CSS).toMatch(/--odc-panel-size:\s*var\(--od-x-panel\)/)
    expect(CSS).toMatch(/@media \(min-width: 1280px\) and \(max-width: 1359px\)[\s\S]*--odc-panel-size:\s*var\(--od-x-panel-narrow\)/)
  })

  it('gives the separator a hairline, a fine grip and a coarse one, and a visible focus', () => {
    expect(CSS).toMatch(/\.odc-split-sep[\s\S]*var\(--od-x-target-fine\)/)
    expect(CSS).toMatch(/@media \(pointer: coarse\)[\s\S]*var\(--od-x-target-coarse\)/)
    expect(CSS).toMatch(/\.odc-split-sep:focus-visible[\s\S]*var\(--od-focus-ring-color\)/)
  })

  // redesign W0-3c (T0-11, decisión 11c): the detail panel is a panel, so it moves at the Slow role (was Base)
  it('moves with the slow duration and does not move under reduced motion', () => {
    expect(CSS).toMatch(/animation:[^;]*var\(--od-duration-slow\)[^;]*var\(--od-ease-standard\)/)
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/)
  })

  it('uses logical properties only', () => {
    // Breakpoints in @media preludes are the only physical-looking text allowed.
    const rules = CSS.replace(/@(media|container)[^{]*/g, '')
    expect(rules).not.toMatch(/\b(margin|padding|border)-(left|right|top|bottom)\b|\b(left|right|top|bottom)\s*:|\b(width|height|min-width|max-width|min-height|max-height)\s*:/)
  })
})

// Owner decision 22 B (2026-10-21, RV-3): «Open as page» from the overlay moves the panel (the dialog → the aside), which remounts it and
// drops what was typed. `guardPlaceChange(proceed)` asks the content's close guards first, only when the panel sits in the overlay;
// anywhere else the place does not change and `proceed` runs at once. Opt-in: nothing else calls it.
describe('SplitView · guardPlaceChange (owner decision 22)', () => {
  const Probe = ({ guard, onApi }) => {
    const api = useSplitView()
    onApi(api)
    React.useEffect(() => (guard ? api.registerCloseGuard(guard) : undefined), [guard])
    return null
  }

  it('in the overlay a guard that takes over stops the change, and proceeds when it answers', () => {
    installViewport(1100)
    let api
    const guard = vi.fn(() => true)
    const proceed = vi.fn()
    render(<Harness initialOpen panel={<Probe guard={guard} onApi={value => { api = value }} />} />)
    let answer
    act(() => { answer = api.guardPlaceChange(proceed) })
    expect(answer).toBe(false)
    expect(guard).toHaveBeenCalledTimes(1)
    expect(proceed).not.toHaveBeenCalled()
    act(() => { guard.mock.calls[0][0]() })
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('in the overlay with nothing to protect it proceeds at once', () => {
    installViewport(1100)
    let api
    const proceed = vi.fn()
    render(<Harness initialOpen panel={<Probe guard={() => false} onApi={value => { api = value }} />} />)
    let answer
    act(() => { answer = api.guardPlaceChange(proceed) })
    expect(answer).toBe(true)
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('inline (split) the panel does not move: no guard is asked', () => {
    installViewport(1400)
    let api
    const guard = vi.fn(() => true)
    const proceed = vi.fn()
    render(<Harness initialOpen panel={<Probe guard={guard} onApi={value => { api = value }} />} />)
    act(() => { api.guardPlaceChange(proceed) })
    expect(guard).not.toHaveBeenCalled()
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('outside a SplitView it just proceeds', () => {
    let api
    const proceed = vi.fn()
    render(<Probe onApi={value => { api = value }} />)
    act(() => { api.guardPlaceChange(proceed) })
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  // The chain the 13 panels use: a RecordPanel with unsaved typing asks its «Discard your changes?» before «Open as page» from the overlay
  it('with a dirty RecordPanel in the overlay, «Open as page» asks first; Keep editing stays, Discard opens it as a page', async () => {
    installViewport(1100)
    const user = userEvent.setup()
    const Panel = ({ expanded, onExpandedChange }) => {
      const split = useSplitView()
      const [draft, setDraft] = useState('')
      return (
        <RecordPanel
          title='Store editor'
          closeLabel='Close'
          dirty={draft !== ''}
          discardTitle='Discard your changes?'
          discardDescription='What you typed is not saved yet.'
          discardConfirmLabel='Discard'
          keepEditingLabel='Keep editing'
          headerActions={(
            <button type='button' onClick={() => split.guardPlaceChange(() => onExpandedChange(!expanded))}>
              {expanded ? 'Back to split view' : 'Open as page'}
            </button>
          )}
        >
          <label>Store name<input value={draft} onChange={event => setDraft(event.target.value)} /></label>
        </RecordPanel>
      )
    }
    const Host = () => {
      const [expanded, setExpanded] = useState(false)
      return (
        <SplitView
          open
          expanded={expanded}
          onClose={() => {}}
          panelLabel='Order details'
          resizeLabel='Resize the details panel'
          list={<div />}
          panel={<Panel expanded={expanded} onExpandedChange={setExpanded} />}
        />
      )
    }
    render(<Host />)
    await user.type(await screen.findByLabelText('Store name'), 'Pizza')
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByLabelText('Store name')).toHaveValue('Pizza')
    expect(screen.getByRole('button', { name: 'Open as page' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
  })
})
