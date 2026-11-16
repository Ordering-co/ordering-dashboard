// redesign bi FC (D8, BI-02, BI-11, BI-12, BI-13, BI-14, auditor 7, 11): the ranking list, the satisfaction scores and the texts
// that come from data (order status names, durations).
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parseNumber: (value, options = {}) => Number(value).toFixed(options.decimal ?? 2) }]
}))
// Lot A1 writes this file at the same time: the test owns a faithful stand-in so it does not depend on it (integers, null when it is not a duration)
vi.mock('../../../../../../utils/businessReports', () => ({
  splitDuration: (value) => {
    if (value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return null
    const total = Math.round(Number(value))
    return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 }
  }
}))

import { orderStatus } from '../../../../utils/orderStatus'
import { BarList } from '../BarList'
import { SatisfactionScores } from '../SatisfactionScores'
import { orderStatusLabel, formatDuration } from '../reportFormat'

const items = [
  { id: 'a', name: 'Cheeseburger with a very long name that must wrap instead of pushing the figure out of the card', value: 40, hint: 'Downtown store' },
  { id: 'b', name: 'Fries', value: 20 },
  { id: 'c', name: 'Soda', value: 10 }
]

describe('BarList', () => {
  const renderList = (props = {}) => renderWithProviders(
    <BarList label='Top products' nameHeader='Product' valueHeader='Units' items={items} {...props} />
  )

  it('is a table named by a caption, with the two column headers for assistive technology', () => {
    const { container } = renderList()
    const table = screen.getByRole('table', { name: 'Top products' })
    expect(table.querySelector('caption')).toHaveTextContent('Top products')
    expect(table.querySelector('caption')).toHaveClass('odc-sr-only')
    expect(within(table).getByRole('columnheader', { name: 'Product' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Units' })).toBeInTheDocument()
    container.querySelectorAll('thead th > *').forEach(node => expect(node).toHaveClass('odc-sr-only'))
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('paints one body row per item, in the order it arrives, with the name as the row header', () => {
    renderList()
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows.map(row => within(row).getByRole('rowheader').textContent)).toEqual([
      expect.stringContaining('Cheeseburger with a very long name'),
      expect.stringContaining('Fries'),
      expect.stringContaining('Soda')
    ])
  })

  it('shows the secondary hint under the name, and nothing when there is none', () => {
    renderList()
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Downtown store')).toBeInTheDocument()
    expect(rows[1].querySelector('.odc-bi-bar-hint')).toBeNull()
  })

  it('paints the figure in an isolated .odc-figure with bdi, through formatValue', () => {
    renderList({ formatValue: value => `${value} units` })
    const figure = screen.getByText('40 units')
    expect(figure.tagName).toBe('BDI')
    expect(figure.closest('.odc-figure')).not.toBeNull()
    expect(screen.getByText('20 units').closest('.odc-figure')).not.toBeNull()
  })

  it('paints the figure as it comes when there is no formatValue', () => {
    renderList()
    expect(screen.getByText('40').closest('.odc-figure')).not.toBeNull()
  })

  it('draws the bar of the largest at 100% and the others in proportion, as a percentage only', () => {
    const { container } = renderList()
    const fills = Array.from(container.querySelectorAll('.odc-bi-bar-fill'))
    expect(fills.map(fill => fill.style.inlineSize)).toEqual(['100%', '50%', '25%'])
    fills.forEach(fill => {
      expect(fill.getAttribute('style')).toMatch(/^inline-size:\s*[\d.]+%;?$/)
      expect(fill).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('keeps the bar of a list whose largest value is 0 at 0%, and never goes negative or past 100%', () => {
    const { container, rerender } = renderList({ items: [{ id: 'z', name: 'Nothing', value: 0 }] })
    expect(container.querySelector('.odc-bi-bar-fill').style.inlineSize).toBe('0%')
    rerender(<BarList label='Top products' nameHeader='Product' valueHeader='Units' items={[{ id: 'n', name: 'Odd', value: -5 }, { id: 'p', name: 'Big', value: 8 }]} />)
    expect(Array.from(container.querySelectorAll('.odc-bi-bar-fill')).map(fill => fill.style.inlineSize)).toEqual(['0%', '100%'])
  })

  it('reads values that arrive as text', () => {
    const { container } = renderList({ items: [{ id: 'a', name: 'A', value: '30' }, { id: 'b', name: 'B', value: '15' }] })
    expect(Array.from(container.querySelectorAll('.odc-bi-bar-fill')).map(fill => fill.style.inlineSize)).toEqual(['100%', '50%'])
  })

  it('has no threshold classes and no inline colors: the bar is neutral whatever the value (BI-13)', () => {
    const { container } = renderList()
    const classes = Array.from(container.querySelectorAll('*')).flatMap(node => String(node.getAttribute('class') ?? '').split(/\s+/)).filter(Boolean)
    expect(classes.filter(name => !name.startsWith('odc-'))).toEqual([])
    expect(classes.filter(name => /danger|success|warning|error|red|green|high|low|bad|good|tone/i.test(name))).toEqual([])
    container.querySelectorAll('[style]').forEach(node => {
      expect(node.getAttribute('style')).not.toMatch(/color|background|fill|border/i)
    })
    expect(container.querySelectorAll('[data-tone]')).toHaveLength(0)
  })

  it('renders nothing when there are no items (the card says No data)', () => {
    const { container } = renderList({ items: [] })
    expect(container.querySelector('table')).toBeNull()
  })
})

describe('SatisfactionScores', () => {
  const rows = () => screen.getAllByRole('listitem')
  const filledStars = row => row.querySelectorAll('svg[data-filled="true"]').length
  const allStars = row => row.querySelectorAll('svg').length

  it('paints 4 full stars and the note 4.0 for "4.01": rounded to the nearest, not up (BI-02)', () => {
    renderWithProviders(<SatisfactionScores scores={{ general: '4.01' }} />)
    const [row] = rows()
    expect(filledStars(row)).toBe(4)
    expect(allStars(row)).toBe(5)
    const note = within(row).getByText('4.0')
    expect(note.tagName).toBe('BDI')
    expect(note.closest('.odc-figure')).not.toBeNull()
  })

  it('paints 4 stars for "3.5" (to the nearest, a half goes up) and 2 for "2.4"', () => {
    renderWithProviders(<SatisfactionScores scores={{ general: '3.5', quality: '2.4' }} />)
    const [general, quality] = rows()
    expect(filledStars(general)).toBe(4)
    expect(within(general).getByText('3.5')).toBeInTheDocument()
    expect(filledStars(quality)).toBe(2)
    expect(within(quality).getByText('2.4')).toBeInTheDocument()
  })

  it('paints all five for "5.00" and keeps numbers working as well as texts', () => {
    renderWithProviders(<SatisfactionScores scores={{ general: '5.00', quality: 3 }} />)
    const [general, quality] = rows()
    expect(filledStars(general)).toBe(5)
    expect(filledStars(quality)).toBe(3)
  })

  it('names the score for assistive technology as "4.0 out of 5", with the stars hidden from it', () => {
    renderWithProviders(<SatisfactionScores scores={{ general: '4.01' }} />)
    const [row] = rows()
    expect(within(row).getByRole('img', { name: '4.0 out of 5' })).toBeInTheDocument()
    row.querySelectorAll('svg').forEach(star => expect(star.closest('[aria-hidden="true"]')).not.toBeNull())
    expect(within(row).getByText('General')).toBeInTheDocument()
  })

  it('does not paint a note that is 0, empty or absent (as main)', () => {
    renderWithProviders(<SatisfactionScores scores={{ general: '4.50', quality: '0.00', delivery: 0, service: null, package: '' }} />)
    expect(rows()).toHaveLength(1)
    expect(screen.queryByText('Quality')).not.toBeInTheDocument()
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument()
    expect(screen.queryByText('Service')).not.toBeInTheDocument()
    expect(screen.queryByText('Package')).not.toBeInTheDocument()
  })

  it('keeps the order General, Quality, Delivery, Service, Package whatever the order of the keys', () => {
    renderWithProviders(<SatisfactionScores scores={{ package: '1.00', service: '2.00', delivery: '3.00', quality: '4.00', general: '5.00' }} />)
    expect(rows().map(row => row.querySelector('.odc-bi-score-name').textContent)).toEqual(['General', 'Quality', 'Delivery', 'Service', 'Package'])
  })

  it('renders nothing when there is no score at all (the card says No data)', () => {
    const { container } = renderWithProviders(<SatisfactionScores scores={{ general: '0.00', quality: 0 }} />)
    expect(container.querySelector('ul')).toBeNull()
    const { container: none } = renderWithProviders(<SatisfactionScores scores={undefined} />)
    expect(none.querySelector('ul')).toBeNull()
  })
})

describe('orderStatusLabel', () => {
  const spy = () => vi.fn((key, fallback) => fallback)

  it('uses the existing key and text of orderStatus.js for every known status (BI-12)', () => {
    orderStatus.forEach(({ key, slug, value }) => {
      const t = spy()
      expect(orderStatusLabel(t, key)).toBe(value)
      expect(t).toHaveBeenCalledTimes(1)
      expect(t).toHaveBeenCalledWith(slug, value)
    })
  })

  it('translates through t: the label is whatever t answers for that key', () => {
    const t = (key, fallback) => (key === 'COMPLETED_BY_ADMIN' ? 'Completado por el administrador' : fallback)
    expect(orderStatusLabel(t, 1)).toBe('Completado por el administrador')
  })

  it('reads a status that arrives as text', () => {
    expect(orderStatusLabel(spy(), '7')).toBe('Accepted by business')
  })

  it('says "Status 99" for an unknown status, with its own key, and never throws', () => {
    const t = spy()
    expect(orderStatusLabel(t, 99)).toBe('Status 99')
    expect(t).toHaveBeenCalledWith('BUSINESS_REPORTS_STATUS_N', 'Status _number_')
    expect(orderStatusLabel(spy(), '99')).toBe('Status 99')
    expect(orderStatusLabel(spy(), 27)).toBe('Status 27')
    expect(orderStatusLabel(spy(), -1)).toBe('Status -1')
  })

  it('does not take an empty value for status 0 (Pending Order)', () => {
    expect(orderStatusLabel(spy(), '')).not.toBe('Pending Order')
    expect(orderStatusLabel(spy(), null)).not.toBe('Pending Order')
    expect(orderStatusLabel(spy(), undefined)).not.toBe('Pending Order')
    expect(orderStatusLabel(spy(), 0)).toBe('Pending Order')
  })
})

describe('formatDuration', () => {
  const t = (key, fallback) => fallback

  it('says "5 h 45 min" for 20704.95 seconds: two units at most, the largest first', () => {
    expect(formatDuration(t, 20704.95)).toBe('5 h 45 min')
  })

  it('says "45 min 5 s", "6 s" and "0 s"', () => {
    expect(formatDuration(t, 2705)).toBe('45 min 5 s')
    expect(formatDuration(t, 6)).toBe('6 s')
    expect(formatDuration(t, 0)).toBe('0 s')
  })

  it('leaves out a unit that is zero: an exact hour is "1 h", an hour and 5 seconds is "1 h"', () => {
    expect(formatDuration(t, 3600)).toBe('1 h')
    expect(formatDuration(t, 3605)).toBe('1 h')
    expect(formatDuration(t, 120)).toBe('2 min')
  })

  it('says a dash when there is no duration', () => {
    expect(formatDuration(t, null)).toBe('—')
    expect(formatDuration(t, undefined)).toBe('—')
    expect(formatDuration(t, 'abc')).toBe('—')
  })

  it('asks for the abbreviations by key, with the number as a placeholder (no plurals)', () => {
    const calls = vi.fn((key, fallback) => fallback)
    formatDuration(calls, 20704.95)
    expect(calls).toHaveBeenCalledWith('BUSINESS_REPORTS_DURATION_HOURS', '_n_ h')
    expect(calls).toHaveBeenCalledWith('BUSINESS_REPORTS_DURATION_MINUTES', '_n_ min')
    const secs = vi.fn((key, fallback) => fallback)
    formatDuration(secs, 6)
    expect(secs).toHaveBeenCalledWith('BUSINESS_REPORTS_DURATION_SECONDS', '_n_ s')
  })

  // the stand-in above keeps the tests above hermetic; this one runs against the real splitDuration of lot A1
  it('agrees with the real splitDuration of businessReports.js', async () => {
    vi.doUnmock('../../../../../../utils/businessReports')
    vi.resetModules()
    const real = await import('../reportFormat')
    expect(real.formatDuration(t, 20704.95)).toBe('5 h 45 min')
    expect(real.formatDuration(t, 2705)).toBe('45 min 5 s')
    expect(real.formatDuration(t, 0)).toBe('0 s')
    expect(real.formatDuration(t, null)).toBe('—')
  })

  it('takes the words from the translation', () => {
    const es = (key, fallback) => ({ BUSINESS_REPORTS_DURATION_HOURS: '_n_ hs', BUSINESS_REPORTS_DURATION_MINUTES: '_n_ m' }[key] ?? fallback)
    expect(formatDuration(es, 20704.95)).toBe('5 hs 45 m')
  })
})
