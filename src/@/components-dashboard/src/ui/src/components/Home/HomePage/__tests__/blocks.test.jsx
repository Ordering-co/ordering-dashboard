// redesign home C2 (D3, D4, D6, D7, D9, D10, HM-03, HM-04, HM-09, HM-13, auditor 1, 3, 4, 10, 12, 15): the blocks of Home
// that C1 composes: Needs attention, setup guide, shortcuts, More Services and the project status badge.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ configs: {}, configurations: { subdomain: 'orderingplus' } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{}, { configurations: state.configurations }],
  useConfig: () => [{ configs: state.configs, loading: false }]
}))
vi.mock('react-hubspot-form', () => ({ default: () => <div data-testid='hubspot-form' /> }))

import { HOME_ATTENTION_KEYS, HOME_ATTENTION_PATHS } from '../../../../../../utils/homeMetrics'
import { NeedsAttention } from '../NeedsAttention'
import { SetupGuide, SetupGuideRestore } from '../SetupGuide'
import { Shortcuts } from '../Shortcuts'
import { MoreServices } from '../MoreServices'
import { ProjectStatusBadge } from '../../ProjectStatusBadge'

const noop = () => {}

// redesign home R1 (Q-01, Q-03, Q-07): jsdom has no layout, so the heights and gaps are pinned in the stylesheet itself
const css = readFileSync(path.join(__dirname, '..', 'blocks.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const ruleOf = (selector) => {
  const match = css.match(new RegExp(`(?:^|\\})\\s*${selector.replace(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : ''
}
const phoneBlock = () => {
  const open = css.indexOf('@media (max-width: 767px)')
  const start = css.indexOf('{', open)
  let depth = 1
  let index = start + 1
  while (depth > 0 && index < css.length) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') depth -= 1
    index += 1
  }
  return css.slice(start + 1, index - 1)
}

describe('NeedsAttention', () => {
  const counts = { pending: 4, late: 0, waitingDriver: 2, failedCarts: 8 }
  const loaded = { loading: false, error: null, counts }

  it('says how many activated stores Google is not showing, and opens Connect › Order with Google on them', () => {
    renderWithProviders(<NeedsAttention attention={{ ...loaded, counts: { ...counts, googleNotShown: 3 } }} keys={['pending', 'googleNotShown']} onRetry={noop} onNavigate={noop} />)
    const row = screen.getByRole('link', { name: '3 Stores Google is not showing' })
    expect(row).toHaveAttribute('href', '/connect/order-with-google?state=skipped')
    expect(screen.getByText('Activated for Order with Google, missing data')).toBeInTheDocument()
  })

  it('paints one link per count above zero, in the order of HOME_ATTENTION_KEYS, with the figure in its name', () => {
    // keys arrive scrambled and with a key whose count is 0: the order and the filter are the block's
    renderWithProviders(<NeedsAttention attention={loaded} keys={['failedCarts', 'late', 'pending', 'waitingDriver']} onRetry={noop} onNavigate={noop} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Needs attention' })).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.map(link => link.getAttribute('aria-label'))).toEqual([
      '4 Orders waiting for acceptance',
      '2 Deliveries waiting for a driver',
      '8 Carts with a failed payment'
    ])
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      HOME_ATTENTION_PATHS.pending,
      HOME_ATTENTION_PATHS.waitingDriver,
      HOME_ATTENTION_PATHS.failedCarts
    ])
    expect(HOME_ATTENTION_KEYS.indexOf('pending')).toBeLessThan(HOME_ATTENTION_KEYS.indexOf('waitingDriver'))
  })

  it('shows each row scope line and the count as an isolated figure', () => {
    renderWithProviders(<NeedsAttention attention={loaded} keys={HOME_ATTENTION_KEYS} onRetry={noop} onNavigate={noop} />)
    expect(screen.getByText('Pending and preorders · all dates')).toBeInTheDocument()
    expect(screen.getByText('Accepted or ready · all dates')).toBeInTheDocument()
    expect(screen.getByText('Open carts')).toBeInTheDocument()
    expect(screen.queryByText('Open orders past their time · all dates')).not.toBeInTheDocument()
    const figure = within(screen.getByRole('link', { name: '4 Orders waiting for acceptance' })).getByText('4')
    expect(figure.closest('.odc-figure')).not.toBeNull()
    expect(figure.tagName).toBe('BDI')
  })

  it('does not paint a row whose key the user does not see, even with a count', () => {
    renderWithProviders(<NeedsAttention attention={loaded} keys={['pending']} onRetry={noop} onNavigate={noop} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('says all clear when every count is zero (the card does not disappear)', () => {
    const clear = { loading: false, error: null, counts: { pending: 0, late: 0, waitingDriver: 0, failedCarts: 0 } }
    renderWithProviders(<NeedsAttention attention={clear} keys={HOME_ATTENTION_KEYS} onRetry={noop} onNavigate={noop} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Needs attention' })).toBeInTheDocument()
    expect(screen.getByText('All clear: nothing is waiting for you.')).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('paints as many skeleton rows as keys while loading', () => {
    const { container } = renderWithProviders(<NeedsAttention attention={{ loading: true, error: null, counts: {} }} keys={['pending', 'late', 'failedCarts']} onRetry={noop} onNavigate={noop} />)
    expect(container.querySelectorAll('[data-slot="home-attention-skeleton"]')).toHaveLength(3)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText('All clear: nothing is waiting for you.')).not.toBeInTheDocument()
  })

  // redesign home R1 (Q-04): F2 moves the focus to the title after «Try again»; the block only exposes the node
  it('Q-04: hands the title node to headingRef, focusable by script and not by Tab', () => {
    const headingRef = React.createRef()
    renderWithProviders(<NeedsAttention attention={loaded} keys={HOME_ATTENTION_KEYS} onRetry={noop} onNavigate={noop} headingRef={headingRef} />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Needs attention' })
    expect(headingRef.current).toBe(heading)
    expect(heading).toHaveAttribute('tabindex', '-1')
    heading.focus()
    expect(document.activeElement).toBe(heading)
  })

  // redesign home R1 (Q-01): the skeleton row has the shape of the real one (icon, two lines, figure, chevron) and the same minimum height
  it('Q-01: the skeleton row reproduces the real row: icon, two text lines, figure and chevron, in the same row class', () => {
    const { container } = renderWithProviders(<NeedsAttention attention={{ loading: true, error: null, counts: {} }} keys={['pending']} onRetry={noop} onNavigate={noop} />)
    const row = container.querySelector('[data-slot="home-attention-skeleton"]')
    expect(row).toHaveClass('odc-attention-row')
    expect(row.querySelectorAll('.odc-attention-text .odc-skeleton')).toHaveLength(2)
    expect(row.querySelectorAll('.odc-skeleton')).toHaveLength(5)
    expect(Array.from(row.children).map(child => child.className.split(' ')[0])).toEqual(['odc-skeleton', 'odc-attention-text', 'odc-skeleton', 'odc-skeleton'])
  })

  it('Q-01: the row sets min-block-size from one variable that holds the height of its own two lines, so skeleton and row share it', () => {
    expect(ruleOf('.odc-attention-row')).toMatch(/min-block-size:\s*max\([^;]*var\(--odc-attention-row-height\)\)/)
    const definition = ruleOf('.odc-attention')
    expect(definition).toMatch(/--odc-attention-row-height:\s*calc\(/)
    expect(definition).toContain('var(--od-x-type-body-size)')
    expect(definition).toContain('var(--od-x-type-caption-size)')
    expect(definition).toContain('var(--od-x-leading-ui)')
    expect(definition).toContain('var(--od-space-2)')
  })

  it('paints an error state with Try again that calls onRetry', () => {
    const onRetry = vi.fn()
    renderWithProviders(<NeedsAttention attention={{ loading: false, error: 'boom', counts: {} }} keys={HOME_ATTENTION_KEYS} onRetry={onRetry} onNavigate={noop} />)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load what needs your attention.")
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('paints nothing without keys', () => {
    const { container } = renderWithProviders(<NeedsAttention attention={loaded} keys={[]} onRetry={noop} onNavigate={noop} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('navigates in the app on a plain click and leaves modified clicks to the browser', () => {
    const onNavigate = vi.fn()
    renderWithProviders(<NeedsAttention attention={loaded} keys={HOME_ATTENTION_KEYS} onRetry={noop} onNavigate={onNavigate} />)
    const link = screen.getByRole('link', { name: '4 Orders waiting for acceptance' })
    expect(fireEvent.click(link)).toBe(false)
    expect(onNavigate).toHaveBeenCalledWith(HOME_ATTENTION_PATHS.pending)
    onNavigate.mockClear()
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true)
    expect(fireEvent.click(link, { metaKey: true })).toBe(true)
    expect(fireEvent.click(link, { button: 1 })).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
  })
})

describe('SetupGuide', () => {
  const steps = [
    { id: 'store', done: true, optional: false },
    { id: 'menu', done: true, optional: false },
    { id: 'zone', done: false, optional: false },
    { id: 'payment', done: false, optional: false },
    { id: 'drivers', done: false, optional: true },
    { id: 'domain', done: false, optional: true },
    { id: 'first_order', done: false, optional: false }
  ]
  const guide = { loading: false, error: null, eligible: true, hidden: false, steps, doneCount: 2, requiredCount: 5 }
  const admin = { level: 0 }
  const base = { guide, level: 0, canOpen: () => true, onHide: noop, onNavigate: noop, user: admin, configs: {} }
  const textOf = (node) => node.textContent.replace(/\s+/g, ' ').trim()

  it('paints nothing when the project is not eligible or the guide is hidden', () => {
    const { container, rerender } = renderWithProviders(<SetupGuide {...base} guide={{ ...guide, eligible: false }} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<SetupGuide {...base} guide={{ ...guide, hidden: true }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('titles the card by level and shows the progress as figures with a progressbar', () => {
    const { rerender } = renderWithProviders(<SetupGuide {...base} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Set up your marketplace' })).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAccessibleName('Set up your marketplace')
    const progress = screen.getByText((_content, node) => node.tagName === 'P' && textOf(node) === '2 of 5 done')
    expect(progress.querySelectorAll('.odc-figure bdi')).toHaveLength(2)
    rerender(<SetupGuide {...base} level={1} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Set up your store' })).toBeInTheDocument()
  })

  it('lists the steps in the fixed order with the optional tag and the done mark', () => {
    renderWithProviders(<SetupGuide {...base} />)
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    const titles = ['Create your first store', 'Create a menu with products', 'Add a delivery zone', 'Turn on a payment method', 'Add your drivers', 'Connect your own domain', 'Receive your first order']
    expect(items).toHaveLength(7)
    titles.forEach((title, index) => expect(items[index]).toHaveTextContent(title))
    expect(items[0]).toHaveTextContent('Name, logo, address and opening hours.')
    expect(items[6]).toHaveTextContent('It shows here as soon as it arrives.')
    expect(screen.getAllByText('Optional')).toHaveLength(2)
    expect(within(items[0]).getByText('Done')).toBeInTheDocument()
    expect(within(items[1]).getByText('Done')).toBeInTheDocument()
    expect(within(items[2]).queryByText('Done')).not.toBeInTheDocument()
  })

  it('arranges the steps by their id whatever order the controller sends', () => {
    renderWithProviders(<SetupGuide {...base} guide={{ ...guide, steps: [...steps].reverse() }} />)
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Create your first store')
    expect(items[6]).toHaveTextContent('Receive your first order')
  })

  it('gives the first pending step the primary action and the others a secondary link; done steps get none', () => {
    renderWithProviders(<SetupGuide {...base} />)
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(within(items[0]).queryByRole('link')).toBeNull()
    expect(within(items[1]).queryByRole('link')).toBeNull()
    const primary = within(items[2]).getByRole('link', { name: 'Start Add a delivery zone' })
    expect(primary).toHaveAttribute('href', '/stores/list')
    expect(primary).toHaveAttribute('data-variant', 'primary')
    expect(primary).toHaveClass('odc-btn')
    const secondary = within(items[3]).getByRole('link', { name: 'Start Turn on a payment method' })
    expect(secondary).toHaveAttribute('data-variant', 'secondary')
    expect(within(items[4]).getByRole('link')).toHaveAttribute('href', '/delivery/drivers-list?add=1')
    expect(within(items[5]).getByRole('link')).toHaveAttribute('href', '/my-products/ordering-website')
    expect(within(items[6]).getByRole('link')).toHaveAttribute('href', '/orders?add=custom_order')
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('data-variant') === 'primary')).toHaveLength(1)
  })

  it('paints no action for a destination the menu denies, asking by the path without query', () => {
    const canOpen = vi.fn(path => path !== '/stores/list')
    renderWithProviders(<SetupGuide {...base} canOpen={canOpen} />)
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(within(items[2]).queryByRole('link')).toBeNull()
    expect(within(items[3]).queryByRole('link')).toBeNull()
    expect(within(items[4]).getByRole('link')).toBeInTheDocument()
    expect(canOpen).toHaveBeenCalledWith('/delivery/drivers-list')
    expect(canOpen.mock.calls.every(([path]) => !path.includes('?'))).toBe(true)
  })

  it('opens the custom order only for who can create orders (the create:custom_order rule of the palette)', () => {
    renderWithProviders(<SetupGuide {...base} user={{ level: 2 }} level={2} />)
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items[6]).toHaveTextContent('Receive your first order')
    expect(within(items[6]).queryByRole('link')).toBeNull()
  })

  it('paints the optional steps only when the controller sends them (level 2: none)', () => {
    const required = steps.filter(step => !step.optional)
    renderWithProviders(<SetupGuide {...base} level={2} user={{ level: 2 }} guide={{ ...guide, steps: required }} />)
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText('Optional')).not.toBeInTheDocument()
    expect(screen.queryByText('Add your drivers')).not.toBeInTheDocument()
  })

  // redesign home R1 (Q-06): the primary is the first pending REQUIRED step that has an action; optional steps are never primary
  it('Q-06: a pending required step without action does not take the primary from the next required one that has it', () => {
    const canOpen = (route) => route !== '/stores/list'
    renderWithProviders(<SetupGuide {...base} canOpen={canOpen} />)
    const primaries = screen.getAllByRole('link').filter(link => link.getAttribute('data-variant') === 'primary')
    expect(primaries).toHaveLength(1)
    expect(primaries[0]).toHaveAccessibleName('Start Receive your first order')
  })

  it('Q-06: optional steps are never primary, even when they are the only ones pending with an action', () => {
    const done = steps.map(step => (step.optional ? step : { ...step, done: true }))
    renderWithProviders(<SetupGuide {...base} guide={{ ...guide, steps: done, doneCount: 5 }} />)
    expect(screen.getAllByRole('link').map(link => link.getAttribute('data-variant'))).toEqual(['secondary', 'secondary'])
  })

  it('Q-06: the domain step leads to the first web product the menu lets open, in order', () => {
    const hrefOfDomain = (canOpen) => {
      const view = renderWithProviders(<SetupGuide {...base} canOpen={canOpen} />)
      const item = view.container.querySelector('[data-step="domain"]')
      const link = item.querySelector('a')
      view.unmount()
      return link ? link.getAttribute('href') : null
    }
    expect(hrefOfDomain(() => true)).toBe('/my-products/ordering-website')
    expect(hrefOfDomain(route => route !== '/my-products/ordering-website')).toBe('/my-products/ordering-website-2')
    expect(hrefOfDomain(route => route === '/my-products/franchises-website')).toBe('/my-products/franchises-website')
    expect(hrefOfDomain(route => !route.startsWith('/my-products/'))).toBeNull()
  })

  // redesign home R1 (Q-04): F2 moves the focus to the title after «Show setup guide»
  it('Q-04: hands the title node to headingRef, focusable by script and not by Tab', () => {
    const headingRef = React.createRef()
    renderWithProviders(<SetupGuide {...base} headingRef={headingRef} />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Set up your marketplace' })
    expect(headingRef.current).toBe(heading)
    expect(heading).toHaveAttribute('tabindex', '-1')
  })

  it('Q-04: the skeleton title takes the headingRef too', () => {
    const headingRef = React.createRef()
    renderWithProviders(<SetupGuide {...base} headingRef={headingRef} guide={{ ...guide, loading: true, steps: [], doneCount: 0, requiredCount: 0 }} />)
    expect(headingRef.current).toBe(screen.getByRole('heading', { level: 2 }))
  })

  // redesign home R1 (Q-03): the card is reserved from the first paint when the project is expected to have it
  describe('Q-03 skeleton', () => {
    const none = { steps: [], doneCount: 0, requiredCount: 0 }

    it('paints the skeleton while today and the trend load, if a guide is expected and not hidden', () => {
      const { container } = renderWithProviders(<SetupGuide {...base} guide={{ ...guide, ...none, eligible: false, expected: true, loading: false }} />)
      expect(container.querySelector('[data-slot="home-guide"]')).toHaveAttribute('aria-busy', 'true')
    })

    it('paints the skeleton when it is eligible but the steps are not in yet', () => {
      const { container } = renderWithProviders(<SetupGuide {...base} guide={{ ...guide, ...none, expected: true, loading: false }} />)
      expect(container.querySelector('[data-slot="home-guide"]')).toHaveAttribute('aria-busy', 'true')
    })

    it('paints nothing when it is not expected, when it is hidden, or when the guide could not be read', () => {
      const { container, rerender } = renderWithProviders(<SetupGuide {...base} guide={{ ...guide, ...none, eligible: false, expected: false }} />)
      expect(container).toBeEmptyDOMElement()
      rerender(<SetupGuide {...base} guide={{ ...guide, ...none, expected: true, hidden: true }} />)
      expect(container).toBeEmptyDOMElement()
      rerender(<SetupGuide {...base} guide={{ ...guide, ...none, expected: true, error: 'boom' }} />)
      expect(container).toBeEmptyDOMElement()
    })

    // redesign home R1 (Q-03, measured: a 5-row skeleton grew 436 -> 560 px for level 0): one row per step the level gets
    it('has the card shape: title, progress line, bar and one row per step of the level (7 for level 0, 5 otherwise)', () => {
      const { unmount } = renderWithProviders(<SetupGuide {...base} level={0} guide={{ ...guide, ...none, expected: true, loading: true }} />)
      expect(document.querySelectorAll('[data-slot="home-guide"] .odc-guide-step')).toHaveLength(7)
      unmount()
      const { container } = renderWithProviders(<SetupGuide {...base} level={2} guide={{ ...guide, ...none, expected: true, loading: true }} />)
      const card = container.querySelector('[data-slot="home-guide"]')
      expect(card.querySelector('.odc-guide-progress, .odc-guide-progress-skeleton')).not.toBeNull()
      expect(card.querySelector('.odc-guide-bar')).not.toBeNull()
      const rows = card.querySelectorAll('.odc-guide-step')
      expect(rows).toHaveLength(5)
      rows.forEach(row => {
        expect(row.querySelector('.odc-guide-mark')).not.toBeNull()
        expect(row.querySelectorAll('.odc-guide-text .odc-skeleton')).toHaveLength(2)
      })
    })

    it('the text of a step keeps the height of its two lines, so the skeleton row and the real one are the same', () => {
      const text = ruleOf('.odc-guide-text')
      expect(text).toMatch(/min-block-size:\s*var\(--odc-guide-text-height\)/)
      const definition = ruleOf('.odc-guide')
      expect(definition).toMatch(/--odc-guide-text-height:\s*calc\(/)
      expect(definition).toContain('var(--od-x-type-body-size)')
      expect(definition).toContain('var(--od-x-type-caption-size)')
      expect(definition).toContain('var(--od-x-leading-ui)')
    })
  })

  it('paints a skeleton card while it loads without steps', () => {
    const { container } = renderWithProviders(<SetupGuide {...base} guide={{ ...guide, loading: true, steps: [], doneCount: 0, requiredCount: 0 }} />)
    expect(container.querySelector('[data-slot="home-guide"]')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.odc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('hides the guide on Hide guide', () => {
    const onHide = vi.fn()
    renderWithProviders(<SetupGuide {...base} onHide={onHide} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide guide' }))
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it('navigates in the app on a plain click of a step', () => {
    const onNavigate = vi.fn()
    renderWithProviders(<SetupGuide {...base} onNavigate={onNavigate} />)
    const link = screen.getByRole('link', { name: 'Start Add a delivery zone' })
    expect(fireEvent.click(link)).toBe(false)
    expect(onNavigate).toHaveBeenCalledWith('/stores/list')
    expect(fireEvent.click(link, { shiftKey: true })).toBe(true)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('SetupGuideRestore only paints with a hidden eligible guide and shows it back', () => {
    const onShow = vi.fn()
    const { container, rerender } = renderWithProviders(<SetupGuideRestore guide={{ ...guide, hidden: false }} onShow={onShow} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<SetupGuideRestore guide={{ ...guide, eligible: false, hidden: true }} onShow={onShow} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<SetupGuideRestore guide={{ ...guide, hidden: true }} onShow={onShow} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show setup guide' }))
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  // redesign home R1 (Q-04): F2 moves the focus to «Show setup guide» after «Hide guide»
  it('Q-04: SetupGuideRestore hands its button to buttonRef', () => {
    const buttonRef = React.createRef()
    renderWithProviders(<SetupGuideRestore guide={{ ...guide, hidden: true }} onShow={noop} buttonRef={buttonRef} />)
    expect(buttonRef.current).toBe(screen.getByRole('button', { name: 'Show setup guide' }))
  })
})

describe('Shortcuts', () => {
  const names = () => screen.queryAllByRole('link').map(link => link.textContent)

  it('paints the four shortcuts of an administrator in order, with the route of the palette entries', () => {
    renderWithProviders(<Shortcuts user={{ level: 0 }} configs={{}} onNavigate={noop} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Shortcuts' })).toBeInTheDocument()
    expect(names()).toEqual(['Create custom order', 'Add new store', 'Add promotion', 'Open carts'])
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
      '/orders?add=custom_order',
      '/stores/add',
      '/marketing/promotions-enterprise?view=advanced_offers&add=1',
      '/cart-recovery/open-carts'
    ])
    screen.getAllByRole('link').forEach(link => {
      expect(link).toHaveClass('odc-btn')
      expect(link).toHaveAttribute('data-variant', 'secondary')
    })
  })

  it('paints only the shortcuts the user has: a business owner has no carts and cannot create orders', () => {
    renderWithProviders(<Shortcuts user={{ level: 2 }} configs={{}} onNavigate={noop} />)
    expect(names()).not.toContain('Create custom order')
    expect(names()).not.toContain('Open carts')
    expect(names()).toContain('Add new store')
  })

  it('gives a read-only administrator no create shortcut (the palette gives them none)', () => {
    renderWithProviders(<Shortcuts user={{ level: 0, readOnlyAdmin: true }} configs={{}} onNavigate={noop} />)
    expect(names()).not.toContain('Create custom order')
    expect(names()).not.toContain('Add new store')
    expect(names()).not.toContain('Add promotion')
  })

  it('paints nothing when the user has no shortcut at all', () => {
    const { container } = renderWithProviders(<Shortcuts user={undefined} configs={{}} onNavigate={noop} />)
    expect(container).toBeEmptyDOMElement()
  })

  // redesign home R1 (Q-07, decision 12): neighbours at 12px or more, so the 44px areas of two shortcuts do not overlap
  it('Q-07: below 768 px the rows of shortcuts are 12px apart on both axes', () => {
    const phone = phoneBlock()
    const rule = phone.match(/\.odc-shortcuts-row\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/row-gap:\s*var\(--od-space-3\)/)
    expect(rule[1]).toMatch(/column-gap:\s*var\(--od-space-3\)/)
  })

  it('navigates in the app on a plain click and leaves modified clicks to the browser', () => {
    const onNavigate = vi.fn()
    renderWithProviders(<Shortcuts user={{ level: 0 }} configs={{}} onNavigate={onNavigate} />)
    const link = screen.getByRole('link', { name: 'Add new store' })
    expect(fireEvent.click(link)).toBe(false)
    expect(onNavigate).toHaveBeenCalledWith('/stores/add')
    onNavigate.mockClear()
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
  })
})

describe('MoreServices', () => {
  let open
  beforeEach(() => {
    state.configs = {}
    state.configurations = { subdomain: 'orderingplus' }
    open = vi.spyOn(window, 'open').mockImplementation(() => null)
  })
  afterEach(() => { open.mockRestore() })

  // main: the More Services cards (source code, custom work) are gone; level 0 keeps the support module
  it('offers level 0 no source code or custom work cards', () => {
    renderWithProviders(<MoreServices level={0} disableSupportModule />)
    expect(screen.queryByText('More Services')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View source code' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Contact us about custom work/ })).not.toBeInTheDocument()
  })

  it('paints no cards for level 2 and no support module either way', () => {
    const { container } = renderWithProviders(<MoreServices level={2} />)
    expect(screen.queryByText('More Services')).not.toBeInTheDocument()
    expect(screen.queryByText('Support')).not.toBeInTheDocument()
    expect(container.querySelector('a')).toBeNull()
  })

  it('paints the support module for level 1 without the cards, and hides it with disableSupportModule', () => {
    const { rerender } = renderWithProviders(<MoreServices level={1} />)
    expect(screen.queryByText('More Services')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Support' })).toBeInTheDocument()
    expect(screen.getByText('Contact our Sales Team')).toBeInTheDocument()
    expect(screen.getByText('Contact our Support Team')).toBeInTheDocument()
    rerender(<MoreServices level={1} disableSupportModule />)
    expect(screen.queryByText('Support')).not.toBeInTheDocument()
    expect(screen.queryByText('Contact our Sales Team')).not.toBeInTheDocument()
  })

  it('opens the same windows as before from the support buttons', () => {
    renderWithProviders(<MoreServices level={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sales Contact' }))
    expect(open).toHaveBeenLastCalledWith('https://www.ordering.co/contact/', '_blank', 'noopener,noreferrer')
    fireEvent.click(screen.getByRole('button', { name: 'Tech Support' }))
    expect(open).toHaveBeenLastCalledWith('https://docs.ordering.co/', '_blank', 'noopener,noreferrer')
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Today' }))
    const month = new Date()
    const expected = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    expect(open).toHaveBeenLastCalledWith(`https://calendly.com/luisana/group-onboarding-conference?month=${expected}`, '_blank', 'noopener,noreferrer')
  })

  // tanda O: without a subdomain the sales button opened www.undefined.com; it is the Ordering.co contact page
  it.each([undefined, ''])('sends Sales Contact to the Ordering.co contact page, never to www.undefined.com, when the subdomain is %j', (subdomain) => {
    state.configurations = { subdomain }
    renderWithProviders(<MoreServices level={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sales Contact' }))
    expect(open).toHaveBeenLastCalledWith('https://www.ordering.co/contact/', '_blank', 'noopener,noreferrer')
    expect(open.mock.calls.flat().join(' ')).not.toContain('www.undefined.com')
  })

  it('hides the onboarding lessons with the white label module', () => {
    state.configs = { white_label_module: { value: true } }
    renderWithProviders(<MoreServices level={0} />)
    expect(screen.getByText('Contact our Sales Team')).toBeInTheDocument()
    expect(screen.queryByText('On-boarding Lessons')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Schedule Today' })).not.toBeInTheDocument()
  })

  it('keeps the HubSpot form as unreachable as it is today (HM-03): nothing opens it', () => {
    renderWithProviders(<MoreServices level={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sales Contact' }))
    expect(screen.queryByTestId('hubspot-form')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ProjectStatusBadge', () => {
  const trial = { status: 'trialing', trial_end: '2026-10-04T12:35:54' }
  const NOW = new Date('2026-10-01T15:00:00.000Z').getTime()
  const family = (container) => container.querySelector('.odc-badge')

  it('paints an active project in the done family', () => {
    const { container } = renderWithProviders(<ProjectStatusBadge currentStatus='active' trialSubscription={null} statusLabel='Project Active' now={NOW} />)
    expect(family(container)).toHaveAttribute('data-family', 'done')
    expect(screen.getByText('Project Active')).toBeInTheDocument()
  })

  it('paints a running trial in the review family with data-status trialing and the days left', () => {
    const { container } = renderWithProviders(<ProjectStatusBadge currentStatus='active' trialSubscription={trial} statusLabel='Project Active' now={NOW} />)
    expect(family(container)).toHaveAttribute('data-family', 'review')
    expect(family(container)).toHaveAttribute('data-status', 'trialing')
    expect(screen.getByText('Free trial — 3 days left')).toBeInTheDocument()
    expect(screen.queryByText('Project Active')).not.toBeInTheDocument()
  })

  it('paints past due and any other status in the cancel family with the label it was given', () => {
    const { container, rerender } = renderWithProviders(<ProjectStatusBadge currentStatus='past_due' trialSubscription={trial} statusLabel='Payment past due' now={NOW} />)
    expect(family(container)).toHaveAttribute('data-family', 'cancel')
    expect(family(container)).not.toHaveAttribute('data-status')
    expect(screen.getByText('Payment past due')).toBeInTheDocument()
    expect(screen.queryByText(/Free trial/)).not.toBeInTheDocument()
    rerender(<ProjectStatusBadge currentStatus='canceled' trialSubscription={null} statusLabel='Canceled' now={NOW} />)
    expect(family(container)).toHaveAttribute('data-family', 'cancel')
  })

  it('uses the singular on the last day of a trial', () => {
    renderWithProviders(<ProjectStatusBadge currentStatus='active' trialSubscription={trial} statusLabel='Project Active' now={Date.UTC(2026, 9, 4, 10, 35, 54)} />)
    expect(screen.getByText('Free trial — 1 day left')).toBeInTheDocument()
  })
})
