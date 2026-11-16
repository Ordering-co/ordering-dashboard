// redesign W0-7 (T0-24): the page header generalized from the pilot's OrdersContentHeader. Layout is not measurable in
// jsdom, so the structure that reserves the status line and the rules that keep one row are pinned (the pilot's tests
// do the same: OrdersContentHeader.stableLayout.test.jsx).
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Copy, Menu as MenuIcon, Printer } from '../../Icon'
import { Button, IconButton } from '../Button'
import { PageHeader } from '../PageHeader'

const css = readFileSync(path.join(__dirname, '../page-header.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
// The body of the first rule with exactly this selector (top level, or inside a block when `within` is given).
const ruleOf = (selector, source = css) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&')
  return [...source.matchAll(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^{}]*)\\}`, 'g'))].map(match => match[1]).join('\n')
}
// The text of a `@media|@container <query> { … }` block, nested rules included.
const blockOf = (prelude) => {
  const from = css.indexOf(prelude)
  if (from === -1) return ''
  const open = css.indexOf('{', from)
  let depth = 1
  let index = open + 1
  while (depth > 0 && index < css.length) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') depth -= 1
    index += 1
  }
  return css.slice(open + 1, index - 1)
}

const menuItems = (overrides = {}) => [
  { key: 'print', label: 'Print…', icon: Printer, onSelect: vi.fn(), ...overrides },
  { key: 'clone', label: 'Clone…', icon: Copy, onSelect: vi.fn() }
]

describe('PageHeader · title and count', () => {
  it('draws the title as the page h1, with its full text as title', () => {
    render(<PageHeader title='Deliveries' />)
    const heading = screen.getByRole('heading', { level: 1, name: 'Deliveries' })
    expect(heading).toHaveAttribute('title', 'Deliveries')
    expect(heading).toHaveClass('odc-pagehead-title')
  })

  it('throws without a title (undefined or null), and an empty one paints an empty h1', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PageHeader />)).toThrow('PageHeader needs a title')
    expect(() => render(<PageHeader title={null} />)).toThrow('PageHeader needs a title')
    quiet.mockRestore()
    const { container } = render(<PageHeader title='' />)
    expect(container.querySelector('h1')).toHaveTextContent('')
  })

  it('draws the count next to the title, read by its own name and not as a bare number', () => {
    render(<PageHeader title='Orders' count={744} countLabel='744 orders' />)
    expect(screen.getByText('744 orders')).toHaveClass('odc-sr-only')
    const figure = screen.getByText('744')
    expect(figure).toHaveAttribute('aria-hidden', 'true')
    const row = screen.getByRole('heading', { level: 1 }).parentElement
    expect([...row.children].slice(0, 2).map(node => node.className.split(' ')[0])).toEqual(['odc-pagehead-title', 'odc-count'])
    expect(row.children[1]).toContainElement(screen.getByText('744 orders'))
  })

  it('keeps a count of zero (a loaded, empty list) and leaves the badge out without a count', () => {
    const { container, rerender } = render(<PageHeader title='Orders' count={0} countLabel='No orders' />)
    expect(container.querySelector('.odc-count')).toHaveTextContent('0')
    rerender(<PageHeader title='Orders' />)
    expect(container.querySelector('.odc-count')).toBeNull()
  })

  it('throws with a count and no countLabel', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PageHeader title='Orders' count={3} />)).toThrow('PageHeader needs a countLabel')
    quiet.mockRestore()
  })
})

describe('PageHeader · the «More» menu', () => {
  it('draws no menu when there are no actions, and throws no moreLabel error for an empty list', () => {
    const { rerender } = render(<PageHeader title='Orders' />)
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    rerender(<PageHeader title='Orders' actions={[]} />)
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    expect(document.querySelector('.odc-pagehead-actions')).toBeNull()
  })

  it('draws the menu with its list when there are actions: named trigger, items, select', async () => {
    const user = userEvent.setup()
    const items = menuItems()
    render(<PageHeader title='Orders' actions={items} moreLabel='More' />)
    const trigger = screen.getByRole('button', { name: 'More' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('data-icon-only')
    await user.click(trigger)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Print…', 'Clone…'])
    await user.click(within(menu).getByRole('menuitem', { name: 'Clone…' }))
    expect(items[1].onSelect).toHaveBeenCalledOnce()
    expect(items[0].onSelect).not.toHaveBeenCalled()
  })

  it('opens from the keyboard and Escape returns the focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<PageHeader title='Orders' actions={menuItems()} moreLabel='More' />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()
  })

  it('throws with actions and no moreLabel; an empty moreLabel paints an unnamed icon button', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PageHeader title='Orders' actions={menuItems()} />)).toThrow('PageHeader needs a moreLabel')
    quiet.mockRestore()
    render(<PageHeader title='Orders' actions={menuItems()} moreLabel='' />)
    expect(document.querySelector('.odc-pagehead-actions button')).toHaveAttribute('aria-label', '')
  })

  it('draws a node passed as actions as it is, in the group, with no menu and no moreLabel', () => {
    render(<PageHeader title='Orders' actions={<button type='button'>Export</button>} />)
    expect(screen.getByRole('button', { name: 'Export' }).parentElement).toHaveClass('odc-pagehead-actions')
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  })
})

describe('PageHeader · the group, back and description', () => {
  it('orders the group Learn, «More», primary action: the primary is always last', () => {
    render(
      <PageHeader
        title='Deliveries'
        learn={<button type='button'>Learn</button>}
        actions={menuItems()}
        moreLabel='More'
        primaryAction={<Button variant='primary'>New delivery</Button>}
      />
    )
    const group = document.querySelector('.odc-pagehead-actions')
    expect([...group.children].map(node => node.getAttribute('aria-label') || node.textContent))
      .toEqual(['Learn', 'More', 'New delivery'])
    expect(screen.getByRole('button', { name: 'New delivery' })).toHaveAttribute('data-variant', 'primary')
  })

  it('draws the back button only with onBack, named by backLabel, flipped in RTL', async () => {
    const onBack = vi.fn()
    const { rerender } = render(<PageHeader title='Order 12' />)
    expect(screen.queryByRole('button', { name: 'Back to orders' })).toBeNull()
    rerender(<PageHeader title='Order 12' backLabel='Back to orders' onBack={onBack} />)
    const back = screen.getByRole('button', { name: 'Back to orders' })
    expect(back.querySelector('.odc-icon-flip')).not.toBeNull()
    expect(back.nextElementSibling).toBe(screen.getByRole('heading', { level: 1 }))
    await userEvent.click(back)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('throws with onBack and no backLabel', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PageHeader title='Order 12' onBack={() => {}} />)).toThrow('PageHeader needs a backLabel')
    quiet.mockRestore()
  })

  it('draws the description under the row, and nothing without it', () => {
    const { container, rerender } = render(<PageHeader title='Deliveries' description='Orders out for delivery' />)
    const row = container.querySelector('.odc-pagehead-row')
    expect(row.nextElementSibling).toHaveTextContent('Orders out for delivery')
    rerender(<PageHeader title='Deliveries' />)
    expect(container.querySelector('.odc-pagehead-description')).toBeNull()
  })
})

describe('PageHeader · the live-status slot reserves its line', () => {
  const live = <span role='status'>Live</span>

  it('is in the row, between the count and the group, whether there is a status or not', () => {
    const { container } = render(
      <PageHeader title='Orders' count={3} countLabel='3 orders' primaryAction={<Button>New</Button>} />
    )
    const row = container.querySelector('.odc-pagehead-row')
    // redesign tramo B r4 (W0-QB3-01, -02): back, title, count and status are one block; the actions are the only other child of the row
    expect([...row.children].map(node => node.className.split(' ')[0])).toEqual(['odc-pagehead-lead', 'odc-pagehead-actions'])
    expect([...row.querySelector('.odc-pagehead-lead').children].map(node => node.className.split(' ')[0]))
      .toEqual(['odc-pagehead-title', 'odc-count', 'odc-pagehead-status'])
    expect(row.querySelector('.odc-pagehead-status')).toHaveAttribute('data-empty', '')
  })

  it('keeps the same slot (not remounted, not removed) when the status comes and goes', () => {
    const { container, rerender } = render(<PageHeader title='Orders' primaryAction={<Button>New</Button>} />)
    const slot = container.querySelector('.odc-pagehead-status')
    const row = container.querySelector('.odc-pagehead-lead')
    const childCount = row.children.length
    rerender(<PageHeader title='Orders' status={live} primaryAction={<Button>New</Button>} />)
    expect(container.querySelector('.odc-pagehead-status')).toBe(slot)
    expect(slot).not.toHaveAttribute('data-empty')
    expect(within(slot).getByRole('status')).toHaveTextContent('Live')
    expect(row.children).toHaveLength(childCount)
    rerender(<PageHeader title='Orders' primaryAction={<Button>New</Button>} />)
    expect(container.querySelector('.odc-pagehead-status')).toBe(slot)
    expect(slot).toHaveAttribute('data-empty', '')
    expect(slot).toBeEmptyDOMElement()
    expect(row.children).toHaveLength(childCount)
  })

  it('reserves a control-height line in CSS (the slot and the row), never display: none; the row wraps only when the title would fall under its minimum', () => {
    const slot = ruleOf('.odc-pagehead-status')
    expect(slot).toMatch(/min-block-size:\s*var\(--od-x-control-height\)/)
    expect(slot).not.toMatch(/display:\s*none|visibility:\s*hidden/)
    expect(css).not.toMatch(/\[data-empty\][^{]*\{[^}]*display:\s*none/)
    const row = ruleOf('.odc-pagehead-row', css.replace(blockOf('@container (max-width: 599px)'), ''))
    // redesign tramo B r4 (W0-QB3-01, -02): the row wraps at any width; what keeps the block whole is its flex-basis (tramoB.r4.test.jsx)
    expect(row).toMatch(/flex-wrap:\s*wrap/)
    expect(row).toMatch(/min-block-size:\s*var\(--od-x-control-height\)/)
  })

  it('on a phone viewport or a coarse pointer the row and the slot reserve 44px (the buttons are 44 visible)', () => {
    const block = blockOf('@media (pointer: coarse), (max-width: 767px)')
    expect(block).toMatch(/\.odc-pagehead-row,\s*\.odc-pagehead-status\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    // 44 visible, not a pseudo-element: neighbours are < 12px apart there
    expect(css).not.toMatch(/::after/)
  })
})

// The title is the page's start (focusPageStart gives it tabindex -1 and focuses it): the browser's default ring is replaced by the
// brand ring, and only for keyboard-style focus.
describe('PageHeader · the title focus ring', () => {
  it('draws the brand focus ring on :focus-visible, and no ring on a plain programmatic focus', () => {
    const ring = ruleOf('.odc-pagehead-title:focus-visible')
    expect(ring).toMatch(/outline:\s*var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
    expect(ring).toMatch(/outline-offset:\s*var\(--od-focus-ring-offset\)/)
    expect(ruleOf('.odc-pagehead-title:focus:not(:focus-visible)')).toMatch(/outline:\s*none/)
  })
})

describe('PageHeader · a long title', () => {
  // PH-1: the full name stays in `title`, for the text cut at the third line
  it('keeps its full text in the title attribute, as the h1 and in one block with the count', () => {
    const long = 'Administrador de tarjetas de regalo de todas las sucursales de la cadena en todos los países'
    const { container } = render(<PageHeader title={long} count={3} countLabel='3 cards' />)
    const heading = screen.getByRole('heading', { level: 1, name: long })
    expect(heading).toHaveAttribute('title', long)
    expect(container.querySelector('.odc-pagehead-lead')).toContainElement(heading)
    expect(container.querySelector('.odc-pagehead-lead')).toContainElement(container.querySelector('.odc-count'))
  })
})

describe('PageHeader · one row, narrow header', () => {
  // PH-1: this test said «no wrap, truncated» (white-space: nowrap); the title now wraps by words to two lines and only the third is cut
  it('the title is the item that gives: it wraps to two lines, then truncates; everything else keeps its size', () => {
    const title = ruleOf('.odc-pagehead-title')
    expect(title).not.toMatch(/white-space:\s*nowrap/)
    expect(title).toMatch(/flex:\s*0 1 auto/)
    expect(title).toMatch(/min-inline-size:\s*0/) // redesign tramo B r4 (W0-QB3-01): it gives inside the block; the minimum is the BLOCK's, so a short title is never widened
    expect(title).toMatch(/overflow:\s*hidden/)
    expect(title).toMatch(/overflow-wrap:\s*anywhere/) // a word longer than the line breaks instead of overflowing
    expect(title).toMatch(/display:\s*-webkit-box/)
    expect(title).toMatch(/-webkit-box-orient:\s*vertical/)
    expect(title).toMatch(/-webkit-line-clamp:\s*2\b/)
    expect(title).toMatch(/(?<!-webkit-)line-clamp:\s*2\b/)
    expect(title).toMatch(/text-overflow:\s*ellipsis/) // inert with the clamp; kept as the one-line fallback the tramo B r3/r4 pins name
    expect(ruleOf('.odc-pagehead-lead > *')).toMatch(/flex:\s*none/)
    // PH-1: the narrow container only changes the size: it must not bring back one-line truncation or change the clamp
    const narrowTitle = ruleOf('.odc-pagehead-title', blockOf('@container (max-width: 599px)'))
    expect(narrowTitle).toMatch(/font-size:\s*var\(--od-x-type-section-size\)/)
    expect(narrowTitle).not.toMatch(/white-space|text-overflow|line-clamp|display/)
    // the block stays one block and centres its children: with a two-line title the arrow, the count and the status sit at its middle
    expect(ruleOf('.odc-pagehead-lead')).toMatch(/align-items:\s*center/)
    expect(ruleOf('.odc-pagehead-lead')).toMatch(/min-block-size:\s*var\(--od-x-control-height\)/) // a one-line title does not change the row's height
    // redesign tramo B cierre (W0-QB4-02): the group keeps its size (flex: none) up to its row's width, and wraps past it, never overflows
    expect(ruleOf('.odc-pagehead-actions')).toMatch(/flex-wrap:\s*wrap/)
    expect(ruleOf('.odc-pagehead-actions')).toMatch(/flex:\s*none/)
    expect(ruleOf('.odc-pagehead-actions')).toMatch(/max-inline-size:\s*100%/)
    expect(ruleOf('.odc-pagehead-actions')).toMatch(/min-inline-size:\s*0/)
    expect(ruleOf('.odc-pagehead-actions')).toMatch(/justify-content:\s*flex-end/)
    expect(ruleOf('.odc-pagehead-actions > *')).toMatch(/flex:\s*none/)
  })

  // redesign tramo B r3 (W0-QB2-06): the narrow container is where the row may wrap (it was: nowrap, r2: wrap everywhere)
  it('decides by the header\'s own width (container query, 600px) and narrows the row only there', () => {
    expect(ruleOf('.odc-pagehead')).toMatch(/container-type:\s*inline-size/)
    const block = blockOf('@container (max-width: 599px)')
    expect(block).not.toBe('')
    expect(block).not.toMatch(/flex-wrap/) // redesign tramo B r4: wrapping is not a narrow-only rule any more
    expect(block).not.toMatch(/display:\s*none/)
    expect(block).toMatch(/\.odc-pagehead-title\s*\{[^}]*font-size:\s*var\(--od-x-type-section-size\)/)
  })

  it('narrow, the marked text is clipped, not removed: the name stays, the count and the primary action are not marked', () => {
    const block = blockOf('@container (max-width: 599px)')
    expect(block).toMatch(/\[data-collapse-label\]\s*\{[^}]*clip-path:\s*inset\(50%\)/)
    // nothing narrow targets the children of the actions, but the one opt-in a page marks itself (`> [data-fill]`, )
    expect(block).not.toMatch(/odc-count|odc-pagehead-actions\s*>(?!\s*\[data-fill\])/)
  })

  // (DD-09): narrow only, an action marked `data-fill` spans the line, and so does the group that holds it
  it('narrow, an action marked data-fill and its group take a whole line; the wide rules do not mention it', () => {
    const block = blockOf('@container (max-width: 599px)')
    expect(block).toMatch(/\.odc-pagehead-actions:has\(> \[data-fill\]\)\s*\{[^}]*flex:\s*1 1 100%/)
    // a direct child of the actions only: `data-fill` elsewhere in the header (a skeleton, a card) is not touched
    expect(block).toMatch(/\.odc-pagehead-actions > \[data-fill\]\s*\{[^}]*flex:\s*1 1 100%/)
    expect(css).not.toMatch(/\.odc-pagehead \[data-fill\]/)
    expect(ruleOf('.odc-pagehead-actions')).not.toMatch(/data-fill/)
  })

  it('the group ends the row by the logical margin, so it follows RTL', () => {
    expect(ruleOf('.odc-pagehead-actions')).toMatch(/margin-inline-start:\s*auto/)
    expect(css).not.toMatch(/\b(?:left|right|margin-left|margin-right|padding-left|padding-right)\s*:/)
  })
})

// (P-1, N-FD1): the pages' own «Open menu» button moves into the header, first in the lead block, so it is
// centred with the title and never splits from it. Opt-in: without `leading` the header is exactly what it was.
describe('PageHeader · the leading slot', () => {
  const opener = (onClick = () => {}) => <IconButton icon={MenuIcon} label='Open menu' onClick={onClick} />

  it('without leading, the lead block holds only the title and the status slot (the markup does not change)', () => {
    const { container } = render(<PageHeader title='Deliveries' />)
    const lead = container.querySelector('.odc-pagehead-lead')
    expect([...lead.children].map(node => node.className)).toEqual(['odc-pagehead-title', 'odc-pagehead-status'])
    const { container: empty } = render(<PageHeader title='Deliveries' leading={false} />)
    expect(empty.querySelector('.odc-pagehead-lead').innerHTML).toBe(lead.innerHTML)
    expect(empty.querySelector('.odc-pagehead').getAttribute('leading')).toBeNull()
  })

  it('draws the node first in the lead block, before the back button and the title, with its own name and handler', async () => {
    const onClick = vi.fn()
    const { container } = render(<PageHeader title='Store 9' leading={opener(onClick)} backLabel='Back to stores' onBack={() => {}} />)
    const lead = container.querySelector('.odc-pagehead-lead')
    const button = within(lead).getByRole('button', { name: 'Open menu' })
    expect(lead.firstElementChild).toBe(button)
    expect(button.nextElementSibling).toBe(screen.getByRole('button', { name: 'Back to stores' }))
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('takes the place of nothing when the node is false or null (a page that shows it only with the menu folded)', () => {
    const { container, rerender } = render(<PageHeader title='Drivers' leading={null} />)
    expect(container.querySelector('.odc-pagehead-lead').firstElementChild).toHaveClass('odc-pagehead-title')
    rerender(<PageHeader title='Drivers' leading={opener()} />)
    expect(container.querySelector('.odc-pagehead-lead').firstElementChild).toHaveAttribute('aria-label', 'Open menu')
  })

  it('marks the block only when there is a leading node, and the mark adds the button and its gap to the block\'s minimum', () => {
    const { container, rerender } = render(<PageHeader title='Drivers' leading={false} />)
    expect(container.querySelector('.odc-pagehead-lead')).not.toHaveAttribute('data-leading')
    rerender(<PageHeader title='Drivers' leading={opener()} />)
    expect(container.querySelector('.odc-pagehead-lead')).toHaveAttribute('data-leading', '')
    // the title keeps the minimum it had when the button sat outside the header (10 title sizes); the button and its gap come on top
    expect(ruleOf('.odc-pagehead-lead[data-leading]')).toMatch(/flex-basis:\s*calc\(var\(--od-x-type-title-size\) \* 10 \+ var\(--od-x-control-height\) \+ var\(--od-space-3\)\)/)
  })

  // the 10-title-sizes minimum (220px) stayed inside the narrow container, where the title is already at the section size,
  // so on 375-414px phones the actions dropped although they fit. The narrow container lowers the block's minimum (both variants);
  // wide (container >= 600px) keeps the 10 title sizes, checked above and below.
  it('the narrow container lowers the block minimum with the title (section size), with and without the leading button', () => {
    const narrow = blockOf('@container (max-width: 599px)')
    const lead = ruleOf('.odc-pagehead-lead', narrow)
    // measured: the natural width of the «Orders» block is 124.2px (mouse) and 132.7px (touch) with a 15.75px section title,
    // so the minimum is 8.4 section sizes (132.3px): just under the touch width, not lower (7.75 left a 322-333px band where «Orders»
    // broke mid-word), and over the width where the actions do not fit beside it (320px)
    expect(lead).toMatch(/flex-basis:\s*calc\(var\(--od-x-type-section-size\) \* 8\.4\)/)
    // the narrow lead gap is the small one (space-1), so the button's share is a control and that gap
    expect(ruleOf('.odc-pagehead-lead[data-leading]', narrow)).toMatch(/flex-basis:\s*calc\(var\(--od-x-type-section-size\) \* 8\.4 \+ var\(--od-x-control-height\) \+ var\(--od-space-1\)\)/)
    // never to 0 (W0-QB1-03): it stays a flex-basis, not a width or a 0 shorthand, and the title still wraps inside the block
    expect(lead).not.toMatch(/flex:|flex-shrink|min-inline-size|\bwidth\b/)
    expect(css.replace(narrow, '')).toMatch(/\.odc-pagehead-lead\s*\{[^}]*flex:\s*1 1 calc\(var\(--od-x-type-title-size\) \* 10\)/)
  })

  it('keeps its size in the block (every child but the title is flex: none) and is 44px on a phone, like the row buttons', () => {
    expect(ruleOf('.odc-pagehead-lead > *')).toMatch(/flex:\s*none/)
    expect(blockOf('@media (pointer: coarse), (max-width: 767px)')).toMatch(/\.odc-pagehead-row \.odc-btn\s*\{[^}]*min-inline-size:\s*var\(--od-x-target-coarse\)/)
  })
})

// (W1, owner decision 28 B): a report title cut to ~122px at 390. The opt-in `wideTitle` gives the lead block
// the whole row in a narrow header, so the actions drop to the next line and the two-line title has the row's width. Off by default.
describe('PageHeader · wideTitle (opt-in, the report header)', () => {
  it('marks the lead block only when asked; without it the header is unchanged', () => {
    const { container, rerender } = render(<PageHeader title='Average ticket by site and channel' actions={<Button>Switch report</Button>} />)
    expect(container.querySelector('.odc-pagehead-lead')).not.toHaveAttribute('data-wide-title')
    rerender(<PageHeader wideTitle title='Average ticket by site and channel' actions={<Button>Switch report</Button>} />)
    expect(container.querySelector('.odc-pagehead-lead')).toHaveAttribute('data-wide-title', '')
    expect(container.querySelector('.odc-pagehead')).not.toHaveAttribute('wideTitle')
  })

  it('takes the whole row only in the narrow container, and keeps the two-line clamp', () => {
    const narrow = blockOf('@container (max-width: 599px)')
    expect(ruleOf('.odc-pagehead-lead[data-wide-title]', narrow)).toMatch(/flex-basis:\s*100%/)
    expect(css.replace(narrow, '')).not.toMatch(/data-wide-title/)
    expect(ruleOf('.odc-pagehead-title')).toMatch(/-webkit-line-clamp:\s*2\b/)
  })
})
