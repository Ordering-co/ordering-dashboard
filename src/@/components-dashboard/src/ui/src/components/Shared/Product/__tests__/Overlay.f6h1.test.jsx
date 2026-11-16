import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { ConfirmDialog, Dialog, useOverlayLayer } from '../Dialog'
import { Sheet } from '../Sheet'

// redesign F6h-1 (A2-01): every modal layer traps focus synchronously (Tab and Shift+Tab never reach the page,
// however fast the keys come) and leaves the page behind `inert`, not only aria-hidden. Non-modal layers (a filter
// popover, a date range) keep the page live (D-11). Only the topmost layer is interactive.

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

const Opener = ({ label = 'Open', children, renderLayer }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type='button' onClick={() => setOpen(true)}>{label}</button>
      {renderLayer({ open, close: () => setOpen(false) })}
      {children}
    </>
  )
}

const dialogLayer = ({ open, close }) => (
  <Dialog
    open={open}
    onOpenChange={next => !next && close()}
    title='Edit address'
    closeLabel='Close dialog'
    footer={(<><button type='button'>Discard</button><button type='button'>Save address</button></>)}
  >
    <label>Street <input /></label>
  </Dialog>
)

const confirmLayer = ({ open, close }) => (
  <ConfirmDialog
    open={open}
    title='Delete order #1?'
    confirmLabel='Delete order'
    cancelLabel='Keep order'
    closeLabel='Close confirmation'
    onCancel={close}
    onConfirm={close}
  >
    This cannot be undone.
  </ConfirmDialog>
)

const sheetLayer = ({ open, close }) => (
  <Sheet
    open={open}
    onOpenChange={next => !next && close()}
    title='Filters'
    closeLabel='Close sheet'
    footer={(<button type='button'>Apply filters</button>)}
  >
    <label>Business <input /></label>
  </Sheet>
)

const Page = ({ renderLayer }) => (
  <div data-testid='page'>
    <Opener renderLayer={renderLayer}>
      <button type='button'>Accept order</button>
      <a href='#home'>Home</a>
    </Opener>
  </div>
)

const isInert = element => element.closest('[inert]') !== null

describe.each([
  ['Dialog', dialogLayer, 'dialog'],
  ['ConfirmDialog', confirmLayer, 'alertdialog'],
  ['Sheet', sheetLayer, 'dialog']
])('%s — modal containment (A2-01)', (_name, renderLayer, role) => {
  it('keeps Tab and Shift+Tab inside, key by key, never reaching the page behind', async () => {
    const user = userEvent.setup()
    const { container } = render(<Page renderLayer={renderLayer} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const popup = await screen.findByRole(role)
    // No waiting between keys: a quick typist must never land outside, not even for an instant.
    for (let index = 0; index < 9; index++) {
      await user.tab()
      expect(popup.contains(document.activeElement), `Tab #${index + 1}`).toBe(true)
    }
    for (let index = 0; index < 9; index++) {
      await user.tab({ shift: true })
      expect(popup.contains(document.activeElement), `Shift+Tab #${index + 1}`).toBe(true)
    }
    expect(container.contains(document.activeElement)).toBe(false)
  })

  it('puts focus back inside the popup when it had fallen on the page behind (body, a click on text)', async () => {
    const user = userEvent.setup()
    render(<Page renderLayer={renderLayer} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const popup = await screen.findByRole(role)
    document.activeElement.blur()
    expect(document.activeElement).toBe(document.body)
    await user.tab()
    expect(popup.contains(document.activeElement)).toBe(true)
  })

  it('marks the page behind inert while open and clears it on close, giving the focus back to the opener', async () => {
    const user = userEvent.setup()
    const { container } = render(<Page renderLayer={renderLayer} />)
    const opener = screen.getByRole('button', { name: 'Open' })
    expect(isInert(opener)).toBe(false)
    await user.click(opener)
    const popup = await screen.findByRole(role)
    expect(container).toHaveAttribute('inert')
    expect(isInert(screen.getByRole('button', { name: 'Accept order', hidden: true }))).toBe(true)
    expect(isInert(popup)).toBe(false)
    expect(document.getElementById('app-modals')).not.toHaveAttribute('inert')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole(role)).toBeNull())
    expect(container).not.toHaveAttribute('inert')
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
    expect(opener).toHaveFocus()
  })
})

describe('non-modal layers (D-11)', () => {
  const Popover = () => {
    const [open, setOpen] = useState(false)
    const { layer, popupRef, lastFocusedRef, portalStyle } = useOverlayLayer(open, { modal: false })
    return (
      <>
        <button type='button' onClick={() => setOpen(true)}>Open popover</button>
        {layer.ready && layer.host && (
          <div ref={popupRef} data-testid='popover' style={portalStyle} onFocusCapture={event => { lastFocusedRef.current = event.target }}>
            <button type='button'>Inside</button>
          </div>
        )}
      </>
    )
  }

  it('leaves the page live: no inert anywhere and Tab is not trapped', async () => {
    const user = userEvent.setup()
    const { container } = render(<><Popover /><button type='button'>Page action</button></>)
    await user.click(screen.getByRole('button', { name: 'Open popover' }))
    await screen.findByTestId('popover')
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
    expect(container).not.toHaveAttribute('inert')
    await user.tab()
    await user.tab()
    await user.tab()
    // Not trapped: focus is free to leave the popover.
    expect(screen.getByTestId('popover').contains(document.activeElement)).toBe(false)
  })
})

describe('nested modal layers: only the top one is interactive', () => {
  const Stack = () => {
    const [confirm, setConfirm] = useState(false)
    return (
      <Page
        renderLayer={({ open, close }) => (
          <>
            <Sheet
              open={open}
              onOpenChange={next => !next && close()}
              title='Order'
              closeLabel='Close sheet'
              footer={(<button type='button' onClick={() => setConfirm(true)}>Delete…</button>)}
            >
              <button type='button'>Change Status</button>
            </Sheet>
            <ConfirmDialog
              open={confirm}
              title='Delete order #1?'
              confirmLabel='Delete order'
              cancelLabel='Keep order'
              closeLabel='Close confirmation'
              onCancel={() => setConfirm(false)}
              onConfirm={() => setConfirm(false)}
            >
              Gone for good.
            </ConfirmDialog>
          </>
        )}
      />
    )
  }

  it('makes the sheet inert under the confirmation, traps Tab in the confirmation, and wakes the sheet on cancel', async () => {
    const user = userEvent.setup()
    const { container } = render(<Stack />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const sheet = await screen.findByRole('dialog', { name: 'Order' })
    await user.click(screen.getByRole('button', { name: 'Delete…' }))
    const confirm = await screen.findByRole('alertdialog')

    expect(container).toHaveAttribute('inert')
    expect(isInert(sheet)).toBe(true)
    expect(isInert(confirm)).toBe(false)
    for (let index = 0; index < 7; index++) {
      await user.tab()
      expect(confirm.contains(document.activeElement), `Tab #${index + 1}`).toBe(true)
    }
    for (let index = 0; index < 7; index++) {
      await user.tab({ shift: true })
      expect(confirm.contains(document.activeElement), `Shift+Tab #${index + 1}`).toBe(true)
    }

    await user.click(screen.getByRole('button', { name: 'Keep order' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(isInert(sheet)).toBe(false)
    expect(container).toHaveAttribute('inert')
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true))
    await user.tab()
    expect(sheet.contains(document.activeElement)).toBe(true)
  })
})
