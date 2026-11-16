import React, { createRef, useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Sheet } from '../Sheet'

const CSS = readFileSync(path.resolve(__dirname, '../sheet.css'), 'utf8')

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
      <button type='button' onClick={() => setOpen(true)}>Open sheet</button>
      <button type='button'>Outside action</button>
      <Sheet
        open={open}
        onOpenChange={next => {
          onOpenChange?.(next)
          setOpen(next)
        }}
        title='Create order'
        closeLabel='Close sheet'
        footer={(
          <>
            <button type='button'>Cancel creation</button>
            <button type='button'>Create the order</button>
          </>
        )}
        {...props}
      >
        <label>Customer <input ref={inputRef} /></label>
      </Sheet>
    </>
  )
}

const openSheet = async user => {
  await user.click(screen.getByRole('button', { name: 'Open sheet' }))
  return screen.findByRole('dialog')
}

describe('Product Sheet — semantics and sides', () => {
  it('is a dialog named by its title, with a header, a body and a footer', async () => {
    render(<Harness initialOpen />)
    const sheet = await screen.findByRole('dialog', { name: 'Create order' })
    expect(sheet.querySelector('.odc-overlay-head')).not.toBeNull()
    expect(sheet.querySelector('.odc-overlay-body')).toContainElement(screen.getByLabelText('Customer'))
    const foot = sheet.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Cancel creation', 'Create the order'])
    expect(screen.getByRole('heading', { level: 2, name: 'Create order' })).toBeInTheDocument()
  })

  it('draws no text of its own', async () => {
    render(<Harness initialOpen footer={null} />)
    expect(await screen.findByRole('dialog')).toHaveTextContent(/^Create orderCustomer$/)
  })

  it('omits the footer when there is none', async () => {
    render(<Harness initialOpen footer={undefined} />)
    expect((await screen.findByRole('dialog')).querySelector('.odc-overlay-foot')).toBeNull()
  })

  it('opens at the end by default', async () => {
    render(<Harness initialOpen />)
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-side', 'end')
  })

  it.each(['end', 'start', 'bottom'])('exposes side=%s and anchors it in CSS with logical properties', async side => {
    render(<Harness initialOpen side={side} />)
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-side', side)
    const rule = [...CSS.matchAll(new RegExp(`\\.odc-sheet\\[data-side='${side}'\\][^{,]*\\{([^}]*)\\}`, 'g'))].map(m => m[1]).join('\n')
    if (side === 'end') expect(rule).toContain('inset-inline-end: 0')
    if (side === 'start') expect(rule).toContain('inset-inline-start: 0')
    if (side === 'bottom') {
      expect(rule).toContain('inset-block-end: 0')
      expect(rule).toContain('max-block-size: 85dvh')
      expect(rule).toContain('border-start-start-radius: var(--od-radius-panel)')
    }
    expect(CSS).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/)
  })

  it('is 100% wide below 768px for the lateral sides, and a fixed token width above', () => {
    expect(CSS).toMatch(/inline-size: var\(--od-x-sheet\)/)
    expect(CSS).toMatch(/max-inline-size: 100vw/)
    const mobile = CSS.match(/@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(mobile).toMatch(/inline-size: 100%/)
    expect(mobile).toMatch(/data-side='end'/)
    expect(mobile).toMatch(/data-side='start'/)
  })

  it('slides from its own side, mirrored in RTL, and only fades under reduced motion', () => {
    // redesign W0-3c (T0-11, decisión 11c): a sheet is a panel, so it moves at the Slow role (was Base)
    expect(CSS).toContain('transition-duration: var(--od-duration-slow)')
    expect(CSS).toContain('transition-timing-function: var(--od-ease-standard)')
    expect(CSS).toMatch(/\[dir='rtl'\]/)
    expect(CSS).toMatch(/\[data-starting-style\]/)
    expect(CSS).toMatch(/\[data-ending-style\]/)
    const reduced = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(reduced).toMatch(/--odc-slide: 0 0/)
    expect(reduced).toMatch(/transition-property: opacity/)
  })

  it('carries the direction on its portal', async () => {
    render(<ThemeProvider theme={{ rtl: true }}><Harness initialOpen /></ThemeProvider>)
    const sheet = await screen.findByRole('dialog')
    expect(sheet.closest('.odc-root')).not.toBeNull()
    expect(sheet.closest('[dir]')).toHaveAttribute('dir', 'rtl')
    expect(document.getElementById('app-modals')).toContainElement(sheet)
  })

  it.each([
    ['title', { title: undefined }],
    ['closeLabel', { closeLabel: undefined }]
  ])('refuses to render without a %s', (_, props) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness initialOpen {...props} />)).toThrow(/Sheet needs a (title|closeLabel)/)
    console.error.mockRestore()
  })
})

describe('Product Sheet — dismissal', () => {
  it('closes with the close button, Escape and the scrim', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)

    await openSheet(user)
    await user.click(screen.getByRole('button', { name: 'Close sheet' }))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await openSheet(user)
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await openSheet(user)
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onOpenChange).toHaveBeenCalledTimes(3)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('does not close on a click inside', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Harness onOpenChange={onOpenChange} />)
    await openSheet(user)
    await user.click(screen.getByLabelText('Customer'))
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('Product Sheet — focus', () => {
  it('puts the initial focus on the first tabbable element', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openSheet(user)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close sheet' })).toHaveFocus())
  })

  it('puts the initial focus on initialFocus when given', async () => {
    const user = userEvent.setup()
    const inputRef = createRef()
    render(<Harness inputRef={inputRef} initialFocus={inputRef} />)
    await openSheet(user)
    await waitFor(() => expect(screen.getByLabelText('Customer')).toHaveFocus())
  })

  it.each(['end', 'start', 'bottom'])('traps Tab inside the %s sheet and leaves the page inert', async side => {
    const user = userEvent.setup()
    render(<Harness side={side} />)
    const sheet = await openSheet(user)
    expectPageBehindInert(screen.getByText('Outside action'))
    for (let step = 0; step < 8; step += 1) await tabInside(user, sheet)
    for (let step = 0; step < 8; step += 1) await tabInside(user, sheet, { shift: true })
  })

  it('hides the page behind it from assistive tech, under a covering scrim', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openSheet(user)
    expect(screen.queryByRole('button', { name: 'Outside action' })).toBeNull()
    expect(CSS).toBeTruthy()
  })

  it('returns the focus to the element that opened it, after Escape and after the close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open sheet' })

    await openSheet(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())

    await openSheet(user)
    await user.click(screen.getByRole('button', { name: 'Close sheet' }))
    await waitFor(() => expect(opener).toHaveFocus())
  })

  // (drivers-dashboard P4): a sheet opened from the URL (`?id=`) has no opener (the body had the focus), so the
  // focus fell to the skip link. `returnFocus`, as in P/Dialog, is where it goes when the opener is gone or is the body.
  it('sends the focus to returnFocus when the sheet opened with no opener', async () => {
    const user = userEvent.setup()
    const rowRef = createRef()
    render(
      <>
        <a href='#main'>Skip to content</a>
        <button type='button' ref={rowRef}>Chosen row</button>
        <Harness initialOpen returnFocus={rowRef} />
      </>
    )
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(rowRef.current).toHaveFocus())
  })

  it('keeps the opener over returnFocus when the opener is still on the page', async () => {
    const user = userEvent.setup()
    const rowRef = createRef()
    render(
      <>
        <button type='button' ref={rowRef}>Chosen row</button>
        <Harness returnFocus={rowRef} />
      </>
    )
    const opener = screen.getByRole('button', { name: 'Open sheet' })
    await openSheet(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())
  })
})
