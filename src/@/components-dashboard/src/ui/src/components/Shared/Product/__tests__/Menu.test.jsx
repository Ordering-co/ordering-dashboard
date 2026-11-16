import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Copy, Ellipsis, Printer, Trash2 } from '../../Icon'
import { Menu } from '../Menu'

const makeItems = (overrides = {}) => ({
  print: vi.fn(),
  clone: vi.fn(),
  refund: vi.fn(),
  remove: vi.fn(),
  ...overrides
})

const itemsFor = (fns, { refundDisabled = true } = {}) => [
  { key: 'print', label: 'Print…', icon: Printer, onSelect: fns.print },
  { key: 'clone', label: 'Clone order…', icon: Copy, onSelect: fns.clone },
  {
    key: 'refund',
    label: 'Refund…',
    onSelect: fns.refund,
    disabled: refundDisabled,
    description: 'Only paid orders can be refunded'
  },
  { key: 'remove', label: 'Delete order…', icon: Trash2, onSelect: fns.remove, tone: 'danger', separatorBefore: true }
]

const setup = (props = {}, fnOverrides) => {
  const fns = makeItems(fnOverrides)
  const view = render(
    <Menu label='More actions' icon={Ellipsis} items={itemsFor(fns)} {...props} />
  )
  return { fns, ...view }
}

const trigger = () => screen.getByRole('button', { name: 'More actions' })
const open = async user => {
  await user.click(trigger())
  return screen.findByRole('menu')
}

describe('Product Menu', () => {
  it('names the trigger and announces a closed menu popup', () => {
    setup()
    const button = trigger()
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('data-icon-only')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens a menu with its menuitems in order and flags the trigger as expanded', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await open(user)
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    const names = within(menu).getAllByRole('menuitem').map(item => item.textContent)
    expect(names).toEqual([
      'Print…',
      'Clone order…',
      'Refund…Only paid orders can be refunded',
      'Delete order…'
    ])
    expect(within(menu).getByRole('menuitem', { name: 'Refund…' })).toBeInTheDocument()
  })

  it('draws a text trigger with a chevron when no icon is given', () => {
    setup({ icon: undefined, label: 'Actions' })
    const button = screen.getByRole('button', { name: 'Actions' })
    expect(button).not.toHaveAttribute('data-icon-only')
    expect(button).toHaveAttribute('data-variant', 'secondary')
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('uses a ghost icon trigger by default and honours triggerVariant', () => {
    const { unmount } = setup()
    expect(trigger()).toHaveAttribute('data-variant', 'ghost')
    unmount()
    setup({ triggerVariant: 'secondary' })
    expect(trigger()).toHaveAttribute('data-variant', 'secondary')
  })

  it('calls onSelect with the click and closes', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    await open(user)
    await user.click(screen.getByRole('menuitem', { name: 'Clone order…' }))
    expect(fns.clone).toHaveBeenCalledOnce()
    expect(fns.print).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('selects with Enter and Space from the keyboard', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    await open(user)
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    expect(fns.print).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    await open(user)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.keyboard(' ')
    expect(fns.clone).toHaveBeenCalledOnce()
  })

  it('moves with arrows, Home, End and type-ahead', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await open(user)
    const items = within(menu).getAllByRole('menuitem')
    await user.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{End}')
    expect(items[3]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(items[0]).toHaveFocus()
    await user.keyboard('d')
    expect(items[3]).toHaveFocus()
  })

  it('never calls onSelect for a disabled item and shows the reason', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    const menu = await open(user)
    const refund = within(menu).getByRole('menuitem', { name: 'Refund…' })
    expect(refund).toHaveAttribute('aria-disabled', 'true')
    expect(refund).toHaveAttribute('data-disabled')
    expect(within(menu).getByText('Only paid orders can be refunded')).toBeVisible()
    expect(refund).toHaveAccessibleDescription('Only paid orders can be refunded')
    await user.click(refund)
    expect(fns.refund).not.toHaveBeenCalled()
    refund.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(fns.refund).not.toHaveBeenCalled()
  })

  it('marks the danger item with its tone and nothing else', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await open(user)
    expect(within(menu).getByRole('menuitem', { name: 'Delete order…' })).toHaveAttribute('data-tone', 'danger')
    for (const name of ['Print…', 'Clone order…']) {
      expect(within(menu).getByRole('menuitem', { name })).not.toHaveAttribute('data-tone')
    }
  })

  it('draws a separator exactly where separatorBefore asks, before that item', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await open(user)
    const separators = within(menu).getAllByRole('separator')
    expect(separators).toHaveLength(1)
    const children = [...separators[0].parentElement.children]
    expect(children[children.indexOf(separators[0]) + 1]).toBe(
      within(menu).getByRole('menuitem', { name: 'Delete order…' })
    )
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    await open(user)
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(trigger()).toHaveFocus()
    expect(fns.print).not.toHaveBeenCalled()
  })

  it('reports open changes', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    setup({ onOpenChange })
    await open(user)
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything())
  })

  it('renders the popup in a portal with the Product root class and the direction', async () => {
    const user = userEvent.setup()
    const { container } = setup({ dir: 'rtl' })
    const menu = await open(user)
    expect(container.contains(menu)).toBe(false)
    const root = menu.closest('.odc-root')
    expect(root).not.toBeNull()
    expect(root).toHaveAttribute('dir', 'rtl')
  })

  it('has no text of its own: only the label and the items it receives', async () => {
    const user = userEvent.setup()
    setup({ items: [{ key: 'a', label: 'Only one', onSelect: () => {} }] })
    const menu = await open(user)
    expect(menu).toHaveTextContent(/^Only one$/)
  })

  it('refuses a menu without a label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Menu icon={Ellipsis} items={[]} />)).toThrow('Menu needs a label')
  })
})

describe('Product Menu single choice (FA-4)', () => {
  const choices = (checked, onSelect = () => {}) => [
    { key: 'ontime', type: 'radio', label: 'On time', checked: checked === 'ontime', onSelect: () => onSelect('ontime') },
    { key: 'risk', type: 'radio', label: 'At risk', checked: checked === 'risk', onSelect: () => onSelect('risk') },
    { key: 'late', type: 'radio', label: 'Delayed', checked: checked === 'late', onSelect: () => onSelect('late') }
  ]
  const choiceMenu = (checked, onSelect, extra = []) => render(
    <Menu label='SLA' items={[...extra, ...choices(checked, onSelect)]} />
  )
  const openChoices = async user => {
    await user.click(screen.getByRole('button', { name: 'SLA' }))
    return screen.findByRole('menu')
  }

  it('exposes radio items as menuitemradio with the current choice in aria-checked', async () => {
    const user = userEvent.setup()
    choiceMenu('risk')
    const menu = await openChoices(user)
    const radios = within(menu).getAllByRole('menuitemradio')
    expect(radios.map(item => item.textContent)).toEqual(['On time', 'At risk', 'Delayed'])
    expect(radios.map(item => item.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(within(menu).queryAllByRole('menuitem')).toHaveLength(0)
  })

  it('draws a visible mark only on the checked item and keeps the labels aligned', async () => {
    const user = userEvent.setup()
    choiceMenu('late')
    const menu = await openChoices(user)
    const radios = within(menu).getAllByRole('menuitemradio')
    expect(radios.map(item => item.querySelector('.odc-menu-mark svg') !== null)).toEqual([false, false, true])
    // Every radio keeps the mark slot, so an unchecked label starts where a checked one does.
    expect(radios.every(item => item.querySelector('.odc-menu-mark') !== null)).toBe(true)
    expect(radios[2].querySelector('.odc-menu-mark')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows no mark when nothing is checked', async () => {
    const user = userEvent.setup()
    choiceMenu(undefined)
    const menu = await openChoices(user)
    expect(menu.querySelectorAll('.odc-menu-mark svg')).toHaveLength(0)
    within(menu).getAllByRole('menuitemradio').forEach(item => expect(item).toHaveAttribute('aria-checked', 'false'))
  })

  it('calls onSelect of the chosen item with a click and with the keyboard, then closes', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    choiceMenu('ontime', onSelect)
    let menu = await openChoices(user)
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Delayed' }))
    expect(onSelect).toHaveBeenLastCalledWith('late')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    menu = await openChoices(user)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('calls onSelect again for the item that is already checked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    choiceMenu('risk', onSelect)
    const menu = await openChoices(user)
    await user.click(within(menu).getByRole('menuitemradio', { name: 'At risk' }))
    expect(onSelect).toHaveBeenCalledWith('risk')
  })

  it('moves with arrows, Home and End across the radios like across any item', async () => {
    const user = userEvent.setup()
    choiceMenu('ontime')
    const menu = await openChoices(user)
    const [first, , last] = within(menu).getAllByRole('menuitemradio')
    await user.keyboard('{ArrowDown}')
    expect(first).toHaveFocus()
    await user.keyboard('{End}')
    expect(last).toHaveFocus()
    await user.keyboard('{Home}')
    expect(first).toHaveFocus()
  })

  it('mixes with plain items, separators and a disabled radio without touching them', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const clear = vi.fn()
    render(
      <Menu
        label='SLA'
        items={[
          ...choices('risk', onSelect).map(item => item.key === 'late' ? { ...item, disabled: true } : item),
          { key: 'clear', label: 'Clear', onSelect: clear, separatorBefore: true }
        ]}
      />
    )
    const menu = await openChoices(user)
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(3)
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Clear'])
    expect(menu.querySelectorAll('.odc-menu-separator')).toHaveLength(1)
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Delayed' }))
    expect(onSelect).not.toHaveBeenCalled()
    await user.click(within(menu).getByRole('menuitem', { name: 'Clear' }))
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('leaves items without a type exactly as they were (menuitem, no mark slot)', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await open(user)
    expect(within(menu).queryAllByRole('menuitemradio')).toHaveLength(0)
    expect(menu.querySelector('.odc-menu-mark')).toBeNull()
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4)
  })

  it('keeps one choice per group when two runs of radios are separated by another item', async () => {
    const user = userEvent.setup()
    render(
      <Menu
        label='SLA'
        items={[
          { key: 'a', type: 'radio', label: 'A', checked: true },
          { key: 'sep', label: 'Other' },
          { key: 'b', type: 'radio', label: 'B', checked: true }
        ]}
      />
    )
    const menu = await openChoices(user)
    expect(within(menu).getAllByRole('menuitemradio').map(item => item.getAttribute('aria-checked'))).toEqual(['true', 'true'])
  })
})

// (bugs H): the positioner mounts in document.body, so it takes the overlay role and not
// `raised`: a raised layer (1…) falls behind the sticky headers (100) of the page.
describe('Product Menu layer', () => {
  const css = readFileSync(path.resolve(__dirname, '../menu.css'), 'utf8')

  it('lifts the body-mounted positioner to the overlay role', () => {
    expect(css).toMatch(/\.odc-menu-positioner\s*\{\s*z-index: calc\(var\(--od-x-layer-overlay\) \+ 9\)/)
  })

  it('keeps the positioner out of the raised role', () => {
    expect(css).not.toMatch(/\.odc-menu-positioner\s*\{[^}]*--od-x-layer-raised/)
  })
})
