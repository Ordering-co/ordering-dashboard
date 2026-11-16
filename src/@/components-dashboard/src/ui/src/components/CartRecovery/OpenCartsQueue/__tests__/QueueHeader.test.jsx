/* eslint-disable import/first */
// redesign OC-F1 (OC-Q1-01, OC-Q1-05): the status area under the title is two fixed rows at every width and in every state,
// so the header is as tall before the rules and the figures load as after, and with the panel open as closed.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{ parsePrice: (value) => `$${Number(value).toFixed(2)}` }]
}))

import { QueueHeader } from '../QueueHeader'

const COUNTS = { followUp: 16, paymentFailed: 8, live: 0, all: 49 }

const draw = (props = {}) => render(
  <MemoryRouter>
    <QueueHeader counts={COUNTS} view='followUp' onViewChange={vi.fn()} {...props} />
  </MemoryRouter>
)
const rows = (container) => ({
  recovery: container.querySelector('[data-oc-row="recovery"]'),
  figures: container.querySelector('[data-oc-row="figures"]')
})

describe('QueueHeader status area', () => {
  it('has the recovery row and the figures row once loaded, each with its full text in title', () => {
    const { container } = draw({
      rules: { loading: false, total: 8, enabled: 0 },
      dayFigures: { loading: false, activeToday: 12, atStakeToday: 1200.5, capped: false }
    })
    const { recovery, figures } = rows(container)
    expect(recovery).not.toBeNull()
    expect(figures).not.toBeNull()
    expect(recovery).toHaveAttribute('title', 'Automatic recovery: 0 of 8 rules on · Manage rules')
    expect(figures).toHaveAttribute('title', 'Active today 12 · At stake today $1200.50')
    expect(recovery).toHaveTextContent('Automatic recovery: 0 of 8 rules on')
    expect(figures).toHaveTextContent('Active today')
  })

  it('keeps both rows while the rules and the figures load, each with a skeleton', () => {
    const { container } = draw({ rules: { loading: true }, dayFigures: { loading: true } })
    const { recovery, figures } = rows(container)
    expect(recovery.querySelector('.odc-skeleton')).not.toBeNull()
    expect(figures.querySelector('.odc-skeleton')).not.toBeNull()
  })

  it('keeps both rows when the API gave no figures and the rules are unknown (the header must not shrink)', () => {
    const { container } = draw({ rules: { loading: false, total: null, enabled: null }, dayFigures: { loading: false } })
    const { recovery, figures } = rows(container)
    expect(recovery).not.toBeNull()
    expect(figures).not.toBeNull()
    expect(figures).toHaveTextContent('')
  })

  it('has exactly the same two rows in every state: the status area never gains or loses a line', () => {
    const states = [
      { rules: { loading: true }, dayFigures: { loading: true } },
      { rules: { loading: false, total: 8, enabled: 3 }, dayFigures: { loading: false, activeToday: 4, atStakeToday: 10, capped: true } },
      {}
    ]
    states.forEach(state => {
      const { container, unmount } = draw(state)
      expect(container.querySelectorAll('.odc-oc-statusline > [data-oc-row]')).toHaveLength(2)
      unmount()
    })
  })

  it('the capped figure carries its plus in the title too', () => {
    const { container } = draw({
      rules: { loading: false, total: 8, enabled: 3 },
      dayFigures: { loading: false, activeToday: 50, atStakeToday: 99, capped: true }
    })
    expect(rows(container).figures).toHaveAttribute('title', 'Active today 50 · At stake today $99.00+')
  })
})

describe('QueueHeader tabs', () => {
  it('draws the four views', () => {
    draw({})
    expect(screen.getAllByRole('tab')).toHaveLength(4)
  })

  // a count that could not be read is not a count that is on its way: it used to stay in a skeleton for ever
  it('tells a count that is loading (skeleton) from one that failed (a dash named for a screen reader, no skeleton)', () => {
    draw({ counts: { followUp: null, paymentFailed: 'unavailable', live: 1, all: 'unavailable' } })
    const tab = (name) => screen.getByRole('tab', { name: new RegExp(name) })
    expect(tab('Follow up').querySelector('.odc-skeleton')).not.toBeNull()
    const failed = tab('Payment failed')
    expect(failed.querySelector('.odc-skeleton')).toBeNull()
    expect(failed).toHaveTextContent('—')
    expect(failed).toHaveTextContent('Count unavailable')
    expect(failed.querySelector('.odc-count')).not.toHaveAttribute('data-attention')
    expect(tab('Live now')).toHaveTextContent('1 cart')
    // the title shows no count at all for a failed «All»
    expect(screen.queryByText('unavailable')).toBeNull()
    expect(screen.queryByText(/\d+ carts/)).toBeNull()
  })
})
