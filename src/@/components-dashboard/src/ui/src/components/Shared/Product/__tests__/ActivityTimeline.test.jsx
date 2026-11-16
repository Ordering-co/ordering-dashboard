import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ActivityTimeline } from '../ActivityTimeline'
import { SegmentedControl } from '../SegmentedControl'

const ITEMS = [
  {
    id: 'e3',
    at: 'Oct 2, 16:51',
    title: <>Status changed to <b>Delivery completed by driver</b></>,
    by: 'by Driver Test · driver app',
    key: true,
    details: <span className='odc-mono'>App id ordering-react-native</span>
  },
  { id: 'e2', at: 'Oct 2, 16:31', title: <>Status changed to <b>Picked up by driver</b></>, by: 'by Driver Test' },
  { id: 'e1', at: 'Oct 2, 15:51', title: 'Order placed', key: true }
]

const setup = (props = {}) => render(
  <ActivityTimeline label='Order activity' detailsLabel='Technical details' items={ITEMS} {...props} />
)

describe('Product ActivityTimeline (C9)', () => {
  it('is a named list with one item per event, in the given order', () => {
    setup()
    const list = screen.getByRole('list', { name: 'Order activity' })
    expect(list.tagName).toBe('OL')
    const entries = within(list).getAllByRole('listitem')
    expect(entries).toHaveLength(3)
    expect(entries[0]).toHaveTextContent('Oct 2, 16:51')
    expect(entries[1]).toHaveTextContent('Oct 2, 16:31')
    expect(entries[2]).toHaveTextContent('Oct 2, 15:51')
  })

  it('writes the absolute time in a <time> element, as given', () => {
    setup()
    const times = [...document.querySelectorAll('time')]
    expect(times.map(time => time.textContent)).toEqual(['Oct 2, 16:51', 'Oct 2, 16:31', 'Oct 2, 15:51'])
    // redesign W0-3a (T0-9, decisión 11a): the time is a figure (mono and tabular digits), not plain mono, and not its label
    times.forEach(time => {
      expect(time).toHaveClass('odc-figure')
      expect(time).not.toHaveClass('odc-mono')
    })
    expect(screen.getAllByRole('listitem')[0].querySelector('.odc-feed-what')).not.toHaveClass('odc-figure')
  })

  // redesign tramo A r3 (W0-QA1-09)
  it('gives the <time> the machine value of the event as dateTime, and none when the item has none', () => {
    setup({ items: [{ id: 'a', at: 'Oct 2, 16:51', datetime: '2026-10-02T16:51:00.000Z', title: 'A' }, { id: 'b', at: 'Oct 2, 15:51', title: 'B' }] })
    const [first, second] = [...document.querySelectorAll('time')]
    expect(first).toHaveAttribute('datetime', '2026-10-02T16:51:00.000Z')
    expect(second).not.toHaveAttribute('datetime')
  })

  it('renders the title with its bold parts, and the author when present', () => {
    setup()
    const first = screen.getAllByRole('listitem')[0]
    expect(first.querySelector('b')).toHaveTextContent('Delivery completed by driver')
    expect(first).toHaveTextContent('by Driver Test · driver app')
    expect(screen.getAllByRole('listitem')[2].querySelector('.odc-feed-by')).toBeNull()
  })

  it('marks key events without relying on color alone being the only text', () => {
    setup()
    const [first, second, third] = screen.getAllByRole('listitem')
    expect(first).toHaveAttribute('data-key')
    expect(second).not.toHaveAttribute('data-key')
    expect(third).toHaveAttribute('data-key')
  })

  it('keeps technical details folded by default and opens them on demand', async () => {
    const user = userEvent.setup()
    setup()
    const details = document.querySelectorAll('details')
    expect(details).toHaveLength(1)
    expect(details[0].open).toBe(false)
    expect(details[0]).not.toHaveAttribute('open')
    const summary = screen.getByText('Technical details')
    expect(summary.tagName).toBe('SUMMARY')
    await user.click(summary)
    expect(details[0].open).toBe(true)
    expect(details[0]).toHaveTextContent('App id ordering-react-native')
    await user.click(summary)
    expect(details[0].open).toBe(false)
  })

  it('draws a details block only for events that have details', () => {
    setup()
    const entries = screen.getAllByRole('listitem')
    expect(entries[0].querySelector('details')).not.toBeNull()
    expect(entries[1].querySelector('details')).toBeNull()
  })

  it('requires detailsLabel when some event has details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ActivityTimeline label='Order activity' items={ITEMS} />)).toThrow('ActivityTimeline needs detailsLabel')
  })

  it('does not need detailsLabel when no event has details', () => {
    render(<ActivityTimeline label='Order activity' items={ITEMS.slice(1)} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('requires a label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ActivityTimeline items={ITEMS} detailsLabel='Technical details' />)).toThrow('ActivityTimeline needs a label')
  })

  it('renders the empty node and no list when there are no events', () => {
    render(<ActivityTimeline label='Order activity' items={[]} empty={<p>No activity yet</p>} />)
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('renders the filter above the list', () => {
    const filter = (
      <SegmentedControl
        label='Show'
        value='all'
        onValueChange={() => {}}
        options={[{ value: 'all', label: 'All' }, { value: 'status', label: 'Status' }]}
      />
    )
    setup({ filter })
    const group = screen.getByRole('group', { name: 'Show' })
    const list = screen.getByRole('list', { name: 'Order activity' })
    expect(group.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the filter when the filtered list is empty', () => {
    render(
      <ActivityTimeline
        label='Order activity'
        items={[]}
        empty={<p>Nothing here</p>}
        filter={<button type='button'>Filter</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('has no text of its own', () => {
    render(<ActivityTimeline label='Activity' items={[{ id: 'a', at: '10:00', title: 'Created' }]} />)
    expect(screen.getByRole('list')).toHaveTextContent(/^10:00Created$/)
  })
})
