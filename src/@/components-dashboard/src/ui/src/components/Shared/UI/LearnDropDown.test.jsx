/* eslint-disable import/first */
// redesign audit-4 (P2-1): Learn is a menu of help links, so it is the Product Menu (menu / menuitem,
// roving focus, arrows) and not a listbox with a Tab stop per option.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({ level: 0 }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, fallback) => (key === 'LEARN' ? 'Learn' : fallback)],
  useSession: () => [{ user: { level: runtime.level } }]
}))

import { LearnDropDown, useLearnMenuItems } from './LearnDropDown'

const OPTIONS = [
  { value: 'overview', name: 'Orders list', url: 'https://help.ordering.co/orders' },
  { value: 'details', name: 'Order details', url: 'https://help.ordering.co/details' },
  { value: 'custom', name: 'Create custom order' }
]

const currentTheme = createDashboardTheme(theme)
const setup = (options = OPTIONS) => render(
  <ThemeProvider theme={currentTheme}><LearnDropDown learnOptions={options} /></ThemeProvider>
)
const trigger = () => screen.getByRole('button', { name: 'Learn' })
const openMenu = async user => {
  await user.click(trigger())
  return screen.findByRole('menu')
}

beforeEach(() => {
  runtime.level = 0
  vi.spyOn(window, 'open').mockImplementation(() => null)
})
afterEach(() => vi.restoreAllMocks())

describe('LearnDropDown · a menu of links (audit 4)', () => {
  it('is a button named «Learn» that announces a menu, with a 16px Product icon', () => {
    setup()
    const button = trigger()
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveClass('learn-drop-down')
    // The glyph is the Product icon class (16px through --od-x-icon), not a hard-coded 12px size.
    const icons = button.querySelectorAll('svg')
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach(icon => {
      expect(icon).toHaveClass('odc-icon')
      expect(icon).not.toHaveAttribute('width', '12')
    })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps the text in its own element, so the narrow head can hide it and keep the name', () => {
    setup()
    expect(trigger().querySelector('.od-learn-label')).toHaveTextContent('Learn')
  })

  it('opens a menu of menuitems in the order of the options, and never a listbox', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await openMenu(user)
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getAllByRole('menuitem').map(item => item.querySelector('.odc-menu-label').textContent))
      .toEqual(['Orders list', 'Order details', 'Create custom order'])
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('moves with the arrows, Home and End, and the items are not Tab stops', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await openMenu(user)
    const items = within(menu).getAllByRole('menuitem')
    await user.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{End}')
    expect(items[2]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(items[0]).toHaveFocus()
    // Roving focus: at most one item is reachable with Tab.
    expect(items.filter(item => item.tabIndex === 0).length).toBeLessThanOrEqual(1)
  })

  it('opens the option URL in a new tab with noopener, falls back to the help center, and closes', async () => {
    const user = userEvent.setup()
    setup()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Order details' }))
    expect(window.open).toHaveBeenLastCalledWith('https://help.ordering.co/details', '_blank', 'noopener,noreferrer')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Create custom order' }))
    expect(window.open).toHaveBeenLastCalledWith('https://docs.ordering.co/', '_blank', 'noopener,noreferrer')
  })

  it('selects with Enter from the keyboard and gives the focus back to the trigger on Escape', async () => {
    const user = userEvent.setup()
    setup()
    await openMenu(user)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(window.open).toHaveBeenCalledOnce()
    expect(window.open).toHaveBeenCalledWith('https://help.ordering.co/orders', '_blank', 'noopener,noreferrer')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await openMenu(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(trigger()).toHaveFocus()
  })

  it('tells every item opens a new tab: the external-link icon and the description, like the sidebar', async () => {
    const user = userEvent.setup()
    setup()
    const menu = await openMenu(user)
    // The hook the stylesheet uses to read the hint instead of drawing it.
    expect(menu).toHaveAttribute('data-learn-menu')
    for (const item of within(menu).getAllByRole('menuitem')) {
      expect(item.querySelector('svg.odc-icon')).not.toBeNull()
      expect(item).toHaveAccessibleDescription('opens in a new tab')
    }
    // The name stays the label: the hint is a description, not part of the name.
    expect(within(menu).getByRole('menuitem', { name: 'Orders list' })).toBeInTheDocument()
  })

  it('freezes the labels at mount and looks the URL up in the current options', async () => {
    const user = userEvent.setup()
    const rendered = setup([{ value: 'launch', name: 'Launch guide', url: 'https://help.ordering.co/launch' }])
    rendered.rerender(
      <ThemeProvider theme={currentTheme}>
        <LearnDropDown learnOptions={[{ value: 'launch', name: 'Updated guide', url: 'https://help.ordering.co/new' }]} />
      </ThemeProvider>
    )
    await openMenu(user)
    expect(screen.queryByRole('menuitem', { name: 'Updated guide' })).toBeNull()
    await user.click(screen.getByRole('menuitem', { name: 'Launch guide' }))
    expect(window.open).toHaveBeenCalledWith('https://help.ordering.co/new', '_blank', 'noopener,noreferrer')
  })

  it('stays gated to non-empty options and level-zero sessions', () => {
    const empty = setup([])
    expect(empty.container).toBeEmptyDOMElement()
    empty.unmount()
    runtime.level = 2
    const other = setup()
    expect(other.container).toBeEmptyDOMElement()
  })

  it('draws no value of its own: tokens only, and the new-tab hint is read, not drawn', () => {
    const css = readFileSync(path.join(__dirname, 'learn-drop-down.css'), 'utf8')
    expect(css).toMatch(/\.odc-menu\[data-learn-menu\]\s+\.odc-menu-description\s*{[^}]*clip:/)
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|\d+px/i)
    // The external-link mark points the other way in right-to-left, from the stylesheet (no class in the JSX).
    expect(css).toMatch(/\.odc-menu\[data-learn-menu\]\[dir='rtl'\]\s+\.odc-menu-icon\s*{[^}]*scale:\s*-1\s+1/)
  })
})

// redesign 5.6-B: on phones the Learn articles live in the page's «More actions» menu, which builds its items
// with the same hook LearnDropDown uses, so the labels, the hint, the gate and the opening are one thing.
describe('useLearnMenuItems · the items of the Learn menu, for another menu (5.6-B)', () => {
  const Probe = ({ options = OPTIONS, onItems }) => {
    onItems(useLearnMenuItems(options))
    return null
  }
  const items = (options) => {
    let result
    render(<Probe options={options} onItems={value => { result = value }} />)
    return result
  }

  it('returns one item per option, in order, with the external-link icon and the new-tab hint', () => {
    const result = items()
    expect(result.map(item => item.label)).toEqual(['Orders list', 'Order details', 'Create custom order'])
    expect(result.map(item => item.key)).toEqual(['overview', 'details', 'custom'])
    result.forEach(item => {
      expect(item.description).toBe('opens in a new tab')
      expect(typeof item.icon).toBe('function')
    })
  })

  it('selecting an item opens the same URL, or the help center without one, in a new tab with noopener', () => {
    const result = items()
    result[1].onSelect()
    expect(window.open).toHaveBeenLastCalledWith('https://help.ordering.co/details', '_blank', 'noopener,noreferrer')
    result[2].onSelect()
    expect(window.open).toHaveBeenLastCalledWith('https://docs.ordering.co/', '_blank', 'noopener,noreferrer')
  })

  it('returns nothing for empty options, no options at all or a session that is not level zero', () => {
    expect(items([])).toEqual([])
    expect(items(null)).toEqual([])
    runtime.level = 2
    expect(items()).toEqual([])
  })
})
