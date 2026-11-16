import React, { createRef, useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog, Dialog } from '../Dialog'

const CSS = readFileSync(path.resolve(__dirname, '../dialog.css'), 'utf8')

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

// The wrapper traps focus with Base UI's focus guards, which hand the focus back on the
// next tick; jsdom lands on a guard for an instant. What matters is where it settles,
// and that it never settles on the page behind.
const tabInside = async (user, popup, options) => {
  await user.tab(options)
  await waitFor(() => expect(popup.contains(document.activeElement)).toBe(true))
}

// jsdom has no `inert` and no hit testing. Base UI marks the page behind with
// aria-hidden + data-base-ui-inert (assistive tech and the tab order); in a browser
// the scrim (fixed, inset 0) takes the pointer.
const expectPageBehindInert = element => {
  const marked = element.closest('[data-base-ui-inert]')
  expect(marked).not.toBeNull()
  expect(marked).toHaveAttribute('aria-hidden', 'true')
}

const Harness = ({ onOpenChange, initialOpen = false, inputRef, ...props }) => {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button type='button' onClick={() => setOpen(true)}>Open dialog</button>
      <button type='button'>Outside action</button>
      <Dialog
        open={open}
        onOpenChange={next => {
          onOpenChange?.(next)
          setOpen(next)
        }}
        title='Edit address'
        closeLabel='Close dialog'
        footer={(
          <>
            <button type='button'>Discard</button>
            <button type='button'>Save address</button>
          </>
        )}
        {...props}
      >
        <label>Street <input ref={inputRef} /></label>
      </Dialog>
    </>
  )
}

const openDialog = async user => {
  await user.click(screen.getByRole('button', { name: 'Open dialog' }))
  return screen.findByRole('dialog')
}

describe('Product Dialog — semantics', () => {
  it('is a dialog named by its title and described by its description', async () => {
    render(<Harness initialOpen description='Used on the delivery receipt.' />)
    const dialog = await screen.findByRole('dialog', { name: 'Edit address' })
    expect(dialog).toHaveAccessibleDescription('Used on the delivery receipt.')
    expect(screen.getByRole('heading', { level: 2, name: 'Edit address' })).toBeInTheDocument()
  })

  it('has no description when none is given', async () => {
    render(<Harness initialOpen />)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveAttribute('aria-describedby')
  })

  it('draws no text of its own: only the title, the close label and what it is given', async () => {
    render(<Harness initialOpen footer={null} />)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/^Edit addressStreet$/)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveAttribute('title', 'Close dialog')
  })

  it('mounts in the shared legacy host, with the root class and the direction', async () => {
    render(<ThemeProvider theme={{ rtl: true }}><Harness initialOpen /></ThemeProvider>)
    const dialog = await screen.findByRole('dialog')
    const host = document.getElementById('app-modals')
    expect(host).toContainElement(dialog)
    expect(dialog.closest('.odc-root')).not.toBeNull()
    expect(dialog.closest('[dir]')).toHaveAttribute('dir', 'rtl')
  })

  it('lays out header, scrolling body and footer, with the footer in secondary-then-primary order', async () => {
    render(<Harness initialOpen />)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('.odc-overlay-head')).not.toBeNull()
    expect(dialog.querySelector('.odc-overlay-body')).toContainElement(screen.getByLabelText('Street'))
    const foot = dialog.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Discard', 'Save address'])
  })

  it('omits the footer when there is none', async () => {
    render(<Harness initialOpen footer={undefined} />)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('.odc-overlay-foot')).toBeNull()
  })

  it('renders nothing while closed', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['title', { title: undefined }],
    ['closeLabel', { closeLabel: undefined }]
  ])('refuses to render without a %s', (_, props) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness initialOpen {...props} />)).toThrow(/Dialog needs a (title|closeLabel)/)
    console.error.mockRestore()
  })
})

describe('Product Dialog — sizes', () => {
  it.each([
    ['sm', 'dialog-sm'],
    ['md', 'dialog-md'],
    ['lg', 'dialog-lg']
  ])('size %s reads --od-x-%s, and is exposed in data-size', async (size, token) => {
    render(<Harness initialOpen size={size} />)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', size)
    const rule = CSS.match(new RegExp(`\\.odc-dialog\\[data-size='${size}'\\]\\s*\\{([^}]*)\\}`))
    expect(rule?.[1]).toContain(`inline-size: var(--od-x-${token})`)
  })

  it('defaults to md', async () => {
    render(<Harness initialOpen />)
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-size', 'md')
  })

  it('becomes a bottom sheet below 768px with full-width footer buttons, and never wider than the viewport', () => {
    const mobile = CSS.match(/@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(mobile).toMatch(/\.odc-dialog\[data-size\]\s*\{[^}]*inset-block: auto 0/)
    expect(mobile).toMatch(/inline-size: 100%/)
    expect(mobile).toMatch(/border-radius: var\(--od-radius-panel\) var\(--od-radius-panel\) 0 0/)
    expect(mobile).toMatch(/\.odc-overlay-foot > \.odc-btn[^{]*\{[^}]*flex: 1/)
    expect(CSS).toMatch(/max-inline-size: calc\(100vw - 2 \* var\(--od-x-viewport-gap\)\)/)
    // Full width only on mobile: the base footer rule must not stretch buttons.
    const baseFoot = CSS.match(/\n\.odc-overlay-foot\s*\{([^}]*)\}/)?.[1] || ''
    expect(baseFoot).toContain('justify-content: flex-end')
    expect(baseFoot).not.toContain('flex: 1')
  })

  // redesign W0-3c (T0-11, decisión 11c): a dialog is an overlay, so it moves at the Slow role (was Base)
  it('moves with the slow duration and none under reduced motion', () => {
    expect(CSS).toMatch(/\[data-starting-style\]/)
    expect(CSS).toMatch(/\[data-ending-style\]/)
    expect(CSS).toContain('var(--od-duration-slow) var(--od-ease-standard)')
    const reduced = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(reduced).toMatch(/transition: none/)
  })
})

describe('Product Dialog — dismissal', () => {
  it('closes from the close button', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes with Escape', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await openDialog(user)
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes with a click outside, on the scrim', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await openDialog(user)
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('does not close on a click inside', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await openDialog(user)
    await user.click(screen.getByLabelText('Street'))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('with dismissible=false ignores Escape and the scrim, but the close button still works', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} dismissible={false} />)
    await openDialog(user)
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // redesign IM-D3: opt-in `closeDisabled`, for a dialog that cannot be left while it works (the menu import)
  it('with closeDisabled the close button is disabled and Escape and the scrim do not close', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} closeDisabled />)
    await openDialog(user)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('without closeDisabled (or with it false) the close button is enabled and Escape closes, as before', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} closeDisabled={false} />)
    await openDialog(user)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeEnabled()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closeDisabled leaves the dialog usable: its footer buttons still work', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Harness initialOpen closeDisabled footer={<button type='button' onClick={onSave}>Save address</button>} />)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Save address' }))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('releases the shared host once it has closed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialog(user)
    expect(document.getElementById('app-modals')).not.toBeNull()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.getElementById('app-modals')).toBeNull())
  })
})

describe('Product Dialog — focus', () => {
  it('puts the initial focus on the first tabbable element', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialog(user)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus())
  })

  it('puts the initial focus on initialFocus when given', async () => {
    const user = userEvent.setup()
    const inputRef = createRef()
    render(<Harness inputRef={inputRef} initialFocus={inputRef} />)
    await openDialog(user)
    await waitFor(() => expect(screen.getByLabelText('Street')).toHaveFocus())
  })

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openDialog(user)
    for (let step = 0; step < 8; step += 1) {
      await tabInside(user, dialog)
      expect(document.activeElement).not.toBe(screen.getByText('Outside action'))
    }
    for (let step = 0; step < 8; step += 1) await tabInside(user, dialog, { shift: true })
  })

  it('leaves the page behind inert: hidden from assistive tech and out of the tab order, under a covering scrim', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openDialog(user)
    expectPageBehindInert(screen.getByText('Outside action'))
    expect(screen.queryByRole('button', { name: 'Outside action' })).toBeNull()
    expect(CSS).toMatch(/\.odc-overlay-backdrop\s*\{[^}]*position: fixed;[^}]*inset: 0/)
  })

  it('returns the focus to the element that opened it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open dialog' })
    await openDialog(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('can return to the trigger of a preceding menu that has already closed', async () => {
    const user = userEvent.setup()
    render(<Harness preferReturnFocus returnFocus={() => screen.getByText('Outside action')} />)
    const target = screen.getByRole('button', { name: 'Outside action' })
    await openDialog(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(target).toHaveFocus())
  })

  it('returns the focus to the opener after the close button too', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open dialog' })
    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    await waitFor(() => expect(opener).toHaveFocus())
  })
})

const Stack = ({ onDialogChange, onCancel }) => {
  const [confirm, setConfirm] = useState(false)
  return (
    <Dialog open title='Edit address' closeLabel='Close dialog' onOpenChange={onDialogChange}
      footer={<button type='button' onClick={() => setConfirm(true)}>Delete address</button>}
    >
      <p>Body</p>
      <ConfirmDialog
        open={confirm}
        title='Delete address?'
        confirmLabel='Delete address now'
        cancelLabel='Keep address'
        closeLabel='Close confirmation'
        onConfirm={() => setConfirm(false)}
        onCancel={() => { onCancel(); setConfirm(false) }}
      >
        This cannot be undone.
      </ConfirmDialog>
    </Dialog>
  )
}

describe('Product Dialog — coexistence with other layers', () => {
  it('lets only the topmost layer react to Escape', async () => {
    const user = userEvent.setup()
    const onDialogChange = vi.fn()
    const onCancel = vi.fn()
    render(<Stack onDialogChange={onDialogChange} onCancel={onCancel} />)
    await user.click(await screen.findByRole('button', { name: 'Delete address' }))
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onDialogChange).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Edit address' })).toBeInTheDocument()
  })
})

const ConfirmHarness = ({ onConfirm = vi.fn(), onCancel = vi.fn(), ...props }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type='button' onClick={() => setOpen(true)}>Remove this order</button>
      <button type='button'>Outside action</button>
      <ConfirmDialog
        open={open}
        title='Delete order #13729?'
        confirmLabel='Delete order'
        cancelLabel='Keep order'
        closeLabel='Close confirmation'
        onConfirm={() => { onConfirm(); setOpen(false) }}
        onCancel={() => { onCancel(); setOpen(false) }}
        {...props}
      >
        This cannot be undone.
      </ConfirmDialog>
    </>
  )
}

const openConfirm = async user => {
  await user.click(screen.getByRole('button', { name: 'Remove this order' }))
  return screen.findByRole('alertdialog')
}

describe('Product ConfirmDialog', () => {
  it('is an alertdialog named by the object and described by the consequence', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    const dialog = await openConfirm(user)
    expect(dialog).toHaveAccessibleName('Delete order #13729?')
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.')
    expect(dialog).toHaveAttribute('data-size', 'sm')
  })

  it('puts the initial focus on Cancel, not on the destructive action', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    await openConfirm(user)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep order' })).toHaveFocus())
  })

  it('keeps Cancel before the confirm action, which reads as verb + object', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness tone='danger' />)
    const dialog = await openConfirm(user)
    const foot = dialog.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Keep order', 'Delete order'])
    expect(screen.getByRole('button', { name: 'Delete order', hidden: false })).toHaveAttribute('data-variant', 'danger')
  })

  it('uses the primary variant for a money or non-destructive confirmation', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness tone='primary' confirmLabel='Refund $35.23' />)
    await openConfirm(user)
    expect(screen.getByRole('button', { name: 'Refund $35.23' })).toHaveAttribute('data-variant', 'primary')
  })

  it('Escape cancels and never confirms', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmHarness onConfirm={onConfirm} onCancel={onCancel} />)
    await openConfirm(user)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('a click outside and the close button cancel and never confirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmHarness onConfirm={onConfirm} onCancel={onCancel} />)
    await openConfirm(user)
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await openConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Close confirmation' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Cancel cancels once', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmHarness onConfirm={onConfirm} onCancel={onCancel} />)
    await openConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Keep order' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirming calls onConfirm exactly once', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmHarness onConfirm={onConfirm} onCancel={onCancel} />)
    await openConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Delete order', description: '' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('while busy, blocks Escape, the scrim, Cancel, the close button and a second confirmation', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmHarness busy onConfirm={onConfirm} onCancel={onCancel} />)
    await openConfirm(user)
    const confirm = screen.getByRole('button', { name: 'Delete order', description: '' })
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Keep order' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close confirmation' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    await user.click(confirm)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('confirmDisabled disables only the confirm action', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmHarness confirmDisabled onConfirm={onConfirm} />)
    await openConfirm(user)
    const confirm = screen.getByRole('button', { name: 'Delete order', description: '' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keep order' })).toBeEnabled()
  })

  it('traps Tab and Shift+Tab inside the confirmation', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    const dialog = await openConfirm(user)
    for (let step = 0; step < 8; step += 1) await tabInside(user, dialog)
    for (let step = 0; step < 8; step += 1) await tabInside(user, dialog, { shift: true })
  })

  it('leaves the page behind inert', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    await openConfirm(user)
    expectPageBehindInert(screen.getByText('Outside action'))
    expect(screen.queryByRole('button', { name: 'Outside action' })).toBeNull()
  })

  it('returns the focus to the element that opened it', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    const opener = screen.getByRole('button', { name: 'Remove this order' })
    await openConfirm(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('refuses to render without the labels that make it accessible', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const missing of ['title', 'closeLabel', 'confirmLabel', 'cancelLabel']) {
      expect(() => render(
        <ConfirmDialog
          open
          title='Delete order #1?'
          confirmLabel='Delete order'
          cancelLabel='Keep order'
          closeLabel='Close'
          onConfirm={() => {}}
          onCancel={() => {}}
          {...{ [missing]: undefined }}
        />
      )).toThrow(/ConfirmDialog needs/)
    }
    console.error.mockRestore()
  })

  it('does not close when the scrim is pressed inside the popup (event does not bubble out)', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmHarness onCancel={onCancel} />)
    await openConfirm(user)
    fireEvent.click(screen.getByText('This cannot be undone.'))
    expect(onCancel).not.toHaveBeenCalled()
  })
})
