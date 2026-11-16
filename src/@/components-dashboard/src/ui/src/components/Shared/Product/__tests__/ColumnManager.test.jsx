import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ColumnManager } from '../ColumnManager'

const COLUMNS = [
  { id: 'order', label: 'Order', visible: true, locked: true },
  { id: 'status', label: 'Status', visible: true, locked: true },
  { id: 'sla', label: 'SLA', visible: true, widthHidden: true },
  { id: 'driver', label: 'Driver', visible: true },
  { id: 'channel', label: 'Channel', visible: false, widthHidden: true }
]

const TEXTS = {
  triggerLabel: 'Columns',
  title: 'Table columns',
  resetLabel: 'Reset',
  lockedNote: 'Always shown',
  widthHiddenNote: 'Hidden at this width',
  moveUpLabel: label => `Move ${label} up`,
  moveDownLabel: label => `Move ${label} down`
}

const setup = ({ columns = COLUMNS, ...props } = {}) => {
  const onChange = vi.fn()
  const onReset = vi.fn()
  const view = render(<ColumnManager columns={columns} onChange={onChange} onReset={onReset} {...TEXTS} {...props} />)
  return { onChange, onReset, ...view }
}

const open = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Columns' }))
  return screen.findByRole('dialog', { name: 'Table columns' })
}

const row = (label) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) }).closest('li')

describe('Product ColumnManager', () => {
  it('has a named trigger that reports its popup and its expanded state', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByRole('button', { name: 'Columns' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await open(user)
    expect(screen.getByRole('button', { name: 'Columns' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens a dialog named by its title, with one checkbox per column', async () => {
    const user = userEvent.setup()
    setup()
    const dialog = await open(user)
    expect(within(dialog).getByRole('heading', { name: 'Table columns' })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(COLUMNS.length)
    expect(within(dialog).getByRole('checkbox', { name: /^Driver/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('checkbox', { name: /^Channel/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles a column with the whole row text and reports the next list', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await open(user)
    await user.click(screen.getByText('Driver'))
    expect(onChange).toHaveBeenCalledOnce()
    const next = onChange.mock.calls[0][0]
    expect(next.map(c => c.id)).toEqual(COLUMNS.map(c => c.id))
    expect(next.find(c => c.id === 'driver').visible).toBe(false)
    expect(next.filter(c => c.id !== 'driver')).toEqual(COLUMNS.filter(c => c.id !== 'driver'))
  })

  it('shows a hidden column as visible again when toggled on', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await open(user)
    await user.click(screen.getByRole('checkbox', { name: /^Channel/ }))
    expect(onChange.mock.calls[0][0].find(c => c.id === 'channel').visible).toBe(true)
  })

  it('does not toggle a locked column and says why', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await open(user)
    const order = screen.getByRole('checkbox', { name: /^Order/ })
    expect(order).toBeDisabled()
    await user.click(order)
    expect(onChange).not.toHaveBeenCalled()
    expect(within(row('Order')).getByText('Always shown')).toBeInTheDocument()
    expect(screen.getAllByText('Always shown')).toHaveLength(2)
    expect(within(row('Driver')).queryByText('Always shown')).not.toBeInTheDocument()
  })

  it('notes a width-hidden column only while the user keeps it visible', async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    expect(within(row('SLA')).getByText('Hidden at this width')).toBeInTheDocument()
    expect(within(row('Channel')).queryByText('Hidden at this width')).not.toBeInTheDocument()
    expect(within(row('Driver')).queryByText('Hidden at this width')).not.toBeInTheDocument()
    expect(screen.getAllByText('Hidden at this width')).toHaveLength(1)
  })

  it('describes the checkbox by its note', async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    const sla = screen.getByRole('checkbox', { name: /^SLA/ })
    expect(sla).toHaveAccessibleDescription('Hidden at this width')
  })

  it('moves a column up, reporting the new order', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Move Driver up' }))
    expect(onChange.mock.calls[0][0].map(c => c.id)).toEqual(['order', 'status', 'driver', 'sla', 'channel'])
  })

  it('swaps exactly the two neighbours and keeps every column intact', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Move SLA down' }))
    const next = onChange.mock.calls[0][0]
    expect(next.map(c => c.id)).toEqual(['order', 'status', 'driver', 'sla', 'channel'])
    expect(next).toHaveLength(COLUMNS.length)
    expect(next.find(c => c.id === 'sla')).toEqual(COLUMNS[2])
  })

  it('disables move up on the first column and move down on the last', async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    expect(screen.getByRole('button', { name: 'Move Order up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Order down' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move Channel down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Channel up' })).toBeEnabled()
  })

  it('keeps focus on the same button of the moved row, in its new position', async () => {
    const user = userEvent.setup()
    const Harness = () => {
      const [columns, setColumns] = React.useState(COLUMNS)
      return <ColumnManager columns={columns} onChange={setColumns} onReset={() => {}} {...TEXTS} />
    }
    render(<Harness />)
    await open(user)
    const down = screen.getByRole('button', { name: 'Move SLA down' })
    down.focus()
    await user.keyboard('{Enter}')
    const labels = () => screen.getAllByRole('checkbox').map(c => c.textContent)
    expect(labels().map(l => l.replace(/Always shown|Hidden at this width/, ''))).toEqual(['Order', 'Status', 'Driver', 'SLA', 'Channel'])
    expect(screen.getByRole('button', { name: 'Move SLA down' })).toHaveFocus()
    await user.keyboard('{Enter}')
    // SLA is now last: its move-down is disabled, so focus falls to the other button of the row.
    expect(screen.getByRole('button', { name: 'Move SLA up' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Move SLA up' })).toHaveFocus()
    expect(labels().map(l => l.replace(/Always shown|Hidden at this width/, ''))).toEqual(['Order', 'Status', 'Driver', 'SLA', 'Channel'])
  })

  it('calls onReset from the header button', async () => {
    const user = userEvent.setup()
    const { onReset, onChange } = setup()
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
  })

  // redesign 5.2 audit-3: focus used to start on «Reset», which undoes the configuration.
  it('starts the focus on the first checkbox you can change, not on «Reset»', async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    // Order and Status are locked (disabled), so the first one that takes focus is SLA.
    await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: /^SLA/ })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Reset' })).not.toHaveFocus()
  })

  it('starts on the first checkbox when none is locked, and falls back to the popup when all are', async () => {
    const user = userEvent.setup()
    const free = COLUMNS.map(column => ({ ...column, locked: false }))
    const { unmount } = setup({ columns: free })
    await open(user)
    await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: /^Order/ })).toHaveFocus())
    unmount()
    setup({ columns: COLUMNS.map(column => ({ ...column, locked: true })) })
    const dialog = await open(user)
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(screen.getByRole('button', { name: 'Reset' })).not.toHaveFocus()
  })

  it('closes with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const trigger = screen.getByRole('button', { name: 'Columns' })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('hides the grip handle from assistive technology', async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    const grips = document.querySelectorAll('.odc-cm-grip')
    expect(grips).toHaveLength(COLUMNS.length)
    for (const grip of grips) expect(grip).toHaveAttribute('aria-hidden', 'true')
  })

  it('reorders by dragging the grip with a pointer', async () => {
    const user = userEvent.setup()
    const Harness = ({ spy }) => {
      const [columns, setColumns] = React.useState(COLUMNS)
      return <ColumnManager columns={columns} onChange={next => { spy(next); setColumns(next) }} onReset={() => {}} {...TEXTS} />
    }
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await open(user)
    // Five 32px rows stacked from y=0: row i covers [32i, 32i + 32).
    for (const [index, li] of [...document.querySelectorAll('.odc-cm-row')].entries()) {
      li.getBoundingClientRect = () => ({ top: index * 32, bottom: index * 32 + 32, height: 32, left: 0, right: 200, width: 200, x: 0, y: index * 32 })
    }
    const grip = row('Driver').querySelector('.odc-cm-grip')
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 3 * 32 + 10, button: 0 })
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 2 * 32 + 10 })
    expect(spy.mock.calls.at(-1)[0].map(c => c.id)).toEqual(['order', 'status', 'driver', 'sla', 'channel'])
    fireEvent.pointerUp(grip, { pointerId: 1, clientY: 2 * 32 + 10 })
    // After release, moving the pointer no longer reorders.
    const calls = spy.mock.calls.length
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 0 })
    expect(spy.mock.calls.length).toBe(calls)
  })

  // redesign F6d-4b (Q2-17): a column the current view cannot show is disabled and says why; opt-in per column.
  it('disables a column marked disabled, keeps its state, and says its own note', async () => {
    const user = userEvent.setup()
    const columns = COLUMNS.map(c => c.id === 'driver' ? { ...c, disabled: true, note: 'Only in Pending' } : c)
    const { onChange } = setup({ columns })
    await open(user)
    const box = screen.getByRole('checkbox', { name: /^Driver/ })
    expect(box).toBeDisabled()
    expect(box).toHaveAttribute('aria-checked', 'true')
    expect(within(row('Driver')).getByText('Only in Pending')).toBeInTheDocument()
    expect(box).toHaveAccessibleDescription('Only in Pending')
    await user.click(screen.getByText('Driver'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('lets a disabled column still be moved, and does not start the focus on it', async () => {
    const user = userEvent.setup()
    const columns = COLUMNS.map(c => c.id === 'sla' ? { ...c, disabled: true, note: 'Only in Pending' } : c)
    const { onChange } = setup({ columns })
    await open(user)
    expect(screen.getByRole('checkbox', { name: /^Driver/ })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Move SLA down' }))
    expect(onChange.mock.calls[0][0].map(c => c.id)).toEqual(['order', 'status', 'driver', 'sla', 'channel'])
  })

  it('adds a note to a column that is not disabled', async () => {
    const user = userEvent.setup()
    const columns = COLUMNS.map(c => c.id === 'driver' ? { ...c, note: 'Beta' } : c)
    setup({ columns })
    await open(user)
    expect(within(row('Driver')).getByText('Beta')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /^Driver/ })).not.toBeDisabled()
  })

  it('keeps the locked note ahead of a column note', async () => {
    const user = userEvent.setup()
    const columns = COLUMNS.map(c => c.id === 'status' ? { ...c, note: 'Other' } : c)
    setup({ columns })
    await open(user)
    expect(within(row('Status')).getByText('Always shown')).toBeInTheDocument()
    expect(within(row('Status')).queryByText('Other')).toBeNull()
  })

  it('refuses to render without its texts', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const key of Object.keys(TEXTS)) {
      const texts = { ...TEXTS }
      delete texts[key]
      expect(() => render(<ColumnManager columns={COLUMNS} onChange={() => {}} onReset={() => {}} {...texts} />))
        .toThrow(new RegExp(key))
    }
    vi.restoreAllMocks()
  })
})

// (bugs H): the positioner mounts in document.body, so it takes the overlay role and not
// `raised`: a raised layer (1…) falls behind the sticky headers (100) of the page.
describe('Product ColumnManager layer', () => {
  const css = readFileSync(path.resolve(__dirname, '../column-manager.css'), 'utf8')

  it('lifts the body-mounted positioner to the overlay role', () => {
    expect(css).toMatch(/\.odc-cm-positioner\s*\{\s*z-index: calc\(var\(--od-x-layer-overlay\) \+ 19\)/)
  })

  it('keeps the positioner out of the raised role', () => {
    expect(css).not.toMatch(/\.odc-cm-positioner\s*\{[^}]*--od-x-layer-raised/)
  })
})
