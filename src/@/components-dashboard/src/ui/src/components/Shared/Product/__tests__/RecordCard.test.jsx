// redesign W1-1 (T1-1): RecordCard, the card of a record promoted from Orders/OrdersTable/OrderCard.jsx.
// The order-specific behaviour (accept / reject, session, role) is tested through OrdersTable.cards.test.jsx.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecordCard, RecordCardList } from '../RecordCard'

const item = (id, extra = {}) => ({
  id,
  href: `/list?id=${id}`,
  label: `Record #${id}`,
  title: `#${id}`,
  status: <span>Pending</span>,
  from: <span>Origin {id}</span>,
  to: <span>Target {id}</span>,
  indicator: <span>On time</span>,
  figure: <span>$10.00</span>,
  ...extra
})

const list = (props = {}) => render(<RecordCardList label='Records' items={[]} {...props} />)

describe('RecordCard', () => {
  it('needs a label: the name of its link', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ul><RecordCard id={1} title='#1' /></ul>)).toThrow('RecordCard needs a label')
    quiet.mockRestore()
  })

  it('an empty label is a translation, not a missing name: it renders', () => {
    render(<ul><RecordCard {...item(1)} label='' /></ul>)
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', '')
  })

  it('is a link to href, named by label, with the ids and states in data-* and aria-*', () => {
    render(<ul><RecordCard {...item(7)} active arrived tint='delayed' tour='tour_start' /></ul>)
    const link = screen.getByRole('link', { name: 'Record #7' })
    expect(link).toHaveAttribute('href', '/list?id=7')
    const card = link.closest('li')
    expect(card).toHaveAttribute('data-row-id', '7')
    expect(card).toHaveAttribute('data-active', '')
    expect(card).toHaveAttribute('data-new', '')
    expect(card).toHaveAttribute('data-status', 'delayed')
    expect(card).toHaveAttribute('data-tour', 'tour_start')
    expect(card).toHaveAttribute('aria-current', 'true')
  })

  it('a plain click on the link opens; a modified click is left to the browser', () => {
    const onOpen = vi.fn()
    render(<ul><RecordCard {...item(1)} onOpen={onOpen} /></ul>)
    const link = screen.getByRole('link')
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true)
    expect(fireEvent.click(link, { metaKey: true })).toBe(true)
    expect(onOpen).not.toHaveBeenCalled()
    // the card handler sees a click that already came through the link: it ignores it, so one click opens once
    expect(fireEvent.click(link)).toBe(false)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('a click on the card opens; a click inside the actions never does', () => {
    const onOpen = vi.fn()
    const actions = <div data-card-actions=''><button type='button'>Do it</button></div>
    render(<ul><RecordCard {...item(1)} actions={actions} onOpen={onOpen} /></ul>)
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }))
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Origin 1'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('draws from, an arrow and to; the third row only when it has something', () => {
    const { container, rerender } = render(<ul><RecordCard {...item(1)} /></ul>)
    const people = container.querySelector('.odc-order-card-people')
    expect(people.children).toHaveLength(3)
    expect(people.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.odc-order-card-logistics')).toBeNull()
    rerender(<ul><RecordCard {...item(1)} schedule={[null, 'Tomorrow', false, 'ETA 5 min']} /></ul>)
    const when = container.querySelector('.odc-order-card-when')
    expect(Array.from(when.children).map(node => node.textContent)).toEqual(['Tomorrow', 'ETA 5 min'])
    rerender(<ul><RecordCard {...item(1)} assignee={<span>Ana</span>} /></ul>)
    expect(container.querySelector('.odc-order-card-driver')).toHaveTextContent('Ana')
  })

  it('shows the note beside the indicator only when it has one', () => {
    const { container, rerender } = render(<ul><RecordCard {...item(1)} /></ul>)
    expect(container.querySelector('.odc-order-card-age')).toBeNull()
    rerender(<ul><RecordCard {...item(1)} indicatorNote='2 hours ago' /></ul>)
    expect(container.querySelector('.odc-order-card-age')).toHaveTextContent('2 hours ago')
    expect(container.querySelector('.odc-order-card-total')).toHaveTextContent('$10.00')
  })
})

// SC-4 (from , /schools): the card always drew an <a>; with no URL per record there was no card that is not a link (and an <a>
// without href is not focusable). OPT-IN `link={false}`: the same card with no link in it. Nothing changes without the prop.
describe('RecordCard · link={false}', () => {
  const plain = (extra = {}) => ({ ...item(3), href: undefined, ...extra })

  it('without the prop it is the same link as ever, with or without href', () => {
    const { container, rerender } = render(<ul><RecordCard {...item(3)} /></ul>)
    expect(container.querySelector('a.odc-order-card-link')).toHaveAttribute('href', '/list?id=3')
    rerender(<ul><RecordCard {...plain()} /></ul>)
    expect(container.querySelector('a.odc-order-card-link')).not.toHaveAttribute('href')
    expect(container.querySelector('button')).toBeNull()
  })

  it('with no onOpen the title is plain text: no link, no button, nothing to focus', () => {
    const { container } = render(<ul><RecordCard {...plain()} link={false} /></ul>)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    const title = container.querySelector('.odc-order-card-title')
    expect(title).toHaveTextContent('#3')
    expect(title.tagName).toBe('SPAN')
    expect(title).not.toHaveAttribute('tabindex')
    expect(container.querySelector('.odc-order-card')).toHaveAttribute('data-static', '')
    expect(container.querySelector('.odc-order-card')).toHaveAttribute('data-row-id', '3')
  })

  it('needs no label then: there is no link to name', () => {
    const { label, ...rest } = plain()
    expect(() => render(<ul><RecordCard {...rest} link={false} /></ul>)).not.toThrow()
  })

  it('a click on a card with nothing to open does nothing', () => {
    const { container } = render(<ul><RecordCard {...plain()} link={false} /></ul>)
    expect(() => fireEvent.click(container.querySelector('.odc-order-card'))).not.toThrow()
  })

  it('with onOpen the title is a real button, named by label, reachable by keyboard, that opens once', () => {
    const onOpen = vi.fn()
    render(<ul><RecordCard {...plain()} link={false} onOpen={onOpen} /></ul>)
    expect(screen.queryByRole('link')).toBeNull()
    const button = screen.getByRole('button', { name: 'Record #3' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('odc-order-card-link')
    button.focus()
    expect(button).toHaveFocus()
    fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Origin 3'))
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('an href is ignored: a card that is not a link never points anywhere', () => {
    const { container } = render(<ul><RecordCard {...item(3)} link={false} /></ul>)
    expect(container.querySelector('[href]')).toBeNull()
  })

  it('goes through the list too', () => {
    const { container } = list({ items: [plain({ link: false })] })
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('.odc-order-card-title')).toHaveTextContent('#3')
  })

  it('the CSS gives it no overlay and no hover tint, and strips the button', () => {
    const css = readFileSync(path.join(__dirname, '..', 'record-card.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.odc-order-card:not\(\[data-skeleton\]\):not\(\[data-static\]\):hover/)
    expect(css).not.toMatch(/\.odc-order-card-title::after/)
    expect(css).toMatch(/button\.odc-order-card-link \{[^}]*border:\s*0/)
  })
})

describe('RecordCardList', () => {
  it('needs a label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<RecordCardList items={[]} />)).toThrow('RecordCardList needs a label')
    quiet.mockRestore()
  })

  it('is a named list with one card per item', () => {
    list({ items: [item(1), item(2)] })
    const records = screen.getByRole('list', { name: 'Records' })
    expect(records).not.toHaveAttribute('aria-busy', 'true')
    expect(within(records).getAllByRole('listitem')).toHaveLength(2)
  })

  it('loading is skeleton cards (the count asked for), busy, announced, and no links', () => {
    const { container } = list({ loading: true, loadingLabel: 'Loading records', skeletonCount: 4, items: [item(1)] })
    expect(screen.getByText('Loading records')).toBeInTheDocument()
    expect(container.querySelector('ul')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(4)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('loading without a page size is ten cards', () => {
    const { container } = list({ loading: true })
    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(10)
  })

  it('empty is the node it was given, and no list', () => {
    list({ empty: <p>Nothing here</p> })
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  // redesign DL-R2 (parity: the phone had no «Select all» for the page): an opt-in row above the cards
  describe('selectAll (opt-in)', () => {
    const select = (extra = {}) => ({ label: 'Select all', checked: false, onToggle: vi.fn(), ...extra })

    it('without the prop the list is exactly as before: no checkbox, nothing before the list', () => {
      const { container } = list({ items: [item(1), item(2)] })
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(container.querySelector('.odc-order-cards').firstElementChild).toBe(screen.getByRole('list', { name: 'Records' }))
    })

    it('with the prop it is a checkbox named by its label, visible, above the cards', () => {
      const { container } = list({ items: [item(1), item(2)], selectAll: select() })
      const box = screen.getByRole('checkbox', { name: 'Select all' })
      expect(box).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByText('Select all')).toBeVisible()
      const root = container.querySelector('.odc-order-cards')
      expect(root.firstElementChild).toContainElement(box)
      expect(root.firstElementChild.nextElementSibling).toBe(screen.getByRole('list', { name: 'Records' }))
    })

    it('reports true and mixed', () => {
      const view = list({ items: [item(1)], selectAll: select({ checked: true }) })
      expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
      view.rerender(<RecordCardList label='Records' items={[item(1)]} selectAll={select({ checked: 'mixed' })} />)
      expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'mixed')
    })

    it('a click calls onToggle once, with nothing', () => {
      const selectAll = select()
      list({ items: [item(1)], selectAll })
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
      expect(selectAll.onToggle).toHaveBeenCalledTimes(1)
      expect(selectAll.onToggle).toHaveBeenCalledWith()
    })

    it('is not drawn while loading, nor with no items', () => {
      const view = list({ loading: true, loadingLabel: 'Loading', items: [item(1)], selectAll: select() })
      expect(screen.queryByRole('checkbox')).toBeNull()
      view.rerender(<RecordCardList label='Records' items={[]} empty={<p>Nothing</p>} selectAll={select()} />)
      expect(screen.queryByRole('checkbox')).toBeNull()
    })

    it('needs a label (missing throws); an empty one is a translation and renders', () => {
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => list({ items: [item(1)], selectAll: select({ label: undefined }) })).toThrow('RecordCardList selectAll needs a label')
      quiet.mockRestore()
      list({ items: [item(1)], selectAll: select({ label: '' }) })
      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })
  })

  it('children render inside the same root, after the list', () => {
    const { container } = list({ items: [item(1)], children: <p>Dialog host</p> })
    const root = container.querySelector('.odc-order-cards')
    expect(root).toContainElement(screen.getByText('Dialog host'))
    expect(root.lastElementChild).toBe(screen.getByText('Dialog host'))
  })
})

// redesign stores 5.18 (from 5.13): the arrow stands between `from` and `to`; a card that has no destination (a fee, a
// markup, a person) drew it pointing at nothing.
describe('RecordCard · the «from → to» arrow (stores 5.18)', () => {
  const arrow = () => document.querySelector('.odc-order-card-arrow')

  it('is drawn between from and to', () => {
    render(<ul><RecordCard {...item(1)} from={<span>Fast Bite</span>} to={<span>Ana</span>} /></ul>)
    expect(arrow()).not.toBeNull()
  })

  it('is not drawn without a destination, nor without an origin', () => {
    const { unmount } = render(<ul><RecordCard {...item(1)} from={<span>Fixed</span>} to={null} /></ul>)
    expect(arrow()).toBeNull()
    expect(screen.getByText('Fixed')).toBeInTheDocument()
    unmount()
    render(<ul><RecordCard {...item(2)} from={undefined} to={<span>Ana</span>} /></ul>)
    expect(arrow()).toBeNull()
  })
})
