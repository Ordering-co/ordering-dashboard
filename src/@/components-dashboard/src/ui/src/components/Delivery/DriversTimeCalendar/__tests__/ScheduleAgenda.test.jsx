/* eslint-disable import/first */
// redesign DT-B3 (DT-06, DT-08, DT-09, DT-18, DT-24): the phone agenda of the drivers' time calendar (under 768px): a card per driver
// and a row per day of the range. The text comes out of the real helpers of blockData.js; only the environment (language, the
// project date format) is simulated. The Product wrappers are real.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
  // the project date format, as parseDate writes it: «14 Oct 2026»
  useUtils: () => [{
    parseDate: (value) => {
      const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
      return `${day} ${MONTHS[month - 1]} ${year}`
    }
  }]
}))

import { ScheduleAgenda } from '../ScheduleAgenda'
import { scanCss } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const DAY = '2026-10-14'
const WEEK = { from: '2026-10-11', to: '2026-10-17' }
const ONE_DAY = { from: DAY, to: DAY }

const block = (id, start, end, extra = {}) => ({
  id,
  name: '',
  description: '',
  start,
  end,
  break_start: null,
  break_end: null,
  rrule: null,
  until: null,
  ...extra
})
const halfHour = (index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}:00`

const carlosBlock = block(9000, '2026-10-14 09:00:00', '2026-10-14 17:00:00', {
  break_start: '2026-10-14 13:00:00',
  break_end: '2026-10-14 13:30:00'
})
const sofiaBlock = block(9002, '2026-10-16 08:00:00', '2026-10-16 12:00:00', { name: 'Weekly run' })

const carlos = { id: 71, name: 'Carlos', lastname: 'Mendoza', email: 'carlos.mendoza@example.com', photo: null, delivery_blocks: [carlosBlock] }
const jessica = { id: 72, name: 'Jessica', lastname: 'Rivera', email: 'jessica@example.com', photo: 'https://example.com/jessica.png', delivery_blocks: [] }
const sofia = { id: 74, name: 'Sofia', lastname: 'Gil', email: 'sofia@example.com', delivery_blocks: [sofiaBlock] }
// the API may leave delivery_blocks out (DT-24)
const bare = { id: 75, name: 'Bare', lastname: 'Bones', email: 'bare@example.com' }

let current
const draw = (props = {}) => {
  current = {
    users: [carlos, jessica, sofia, bare],
    loading: false,
    range: ONE_DAY,
    today: DAY,
    is12: false,
    onOpenBlock: vi.fn(),
    onAddBlock: vi.fn(),
    onShowDay: vi.fn(),
    ...props
  }
  return render(<ScheduleAgenda {...current} />)
}

const cardOf = (container, id) => container.querySelector(`li[data-user-id="${id}"]`)
const dayOf = (card, day) => card.querySelector(`li[data-day="${day}"]`)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScheduleAgenda · cards', () => {
  it('is a list with a card per driver: avatar, full name, #id as a figure and the email', () => {
    const { container } = draw()
    expect(screen.getByRole('list', { name: 'Drivers time display' })).toBeInTheDocument()
    expect(container.querySelectorAll('li[data-user-id]')).toHaveLength(4)
    const card = cardOf(container, 71)
    expect(card.querySelector('.odc-avatar')).toHaveTextContent('CM')
    const name = within(card).getByText('Carlos Mendoza')
    expect(name.tagName).toBe('STRONG')
    expect(name).toHaveAttribute('dir', 'auto')
    expect(within(card).getByText('#71')).toHaveClass('odc-figure')
    expect(within(card).getByText('carlos.mendoza@example.com')).toHaveAttribute('dir', 'ltr')
    expect(cardOf(container, 72).querySelector('img')).toHaveAttribute('src', 'https://example.com/jessica.png')
  })

  it('a driver with no email draws no separator', () => {
    const { container } = draw({ users: [{ id: 90, name: 'No', lastname: 'Mail' }] })
    expect(cardOf(container, 90).querySelector('.odc-sa-sub').textContent).toBe('#90')
  })
})

describe('ScheduleAgenda · one day', () => {
  it('has a single row per card and no day heading', () => {
    const { container } = draw()
    const card = cardOf(container, 71)
    expect(card.querySelectorAll('li[data-day]')).toHaveLength(1)
    expect(card.querySelector('time')).toBeNull()
    expect(within(card).queryByText('14 Oct 2026')).toBeNull()
  })

  it('the block is a button with its hours and its break, named «time, break time, driver»', async () => {
    const { container } = draw()
    const card = cardOf(container, 71)
    const button = within(card).getByRole('button', { name: '09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza' })
    expect(within(button).getByText('09:00 – 17:00')).toHaveClass('odc-figure')
    expect(within(button).getByText('13:00 – 13:30')).toHaveClass('odc-figure')
    expect(button).toHaveTextContent('break')
    await userEvent.click(button)
    expect(current.onOpenBlock).toHaveBeenCalledWith(carlos, carlosBlock, DAY)
  })

  it('a block without a break shows no break, and a named one shows its name', () => {
    const named = block(9100, '2026-10-14 06:00:00', '2026-10-14 10:00:00', { name: 'Early run' })
    const { container } = draw({ users: [{ ...jessica, delivery_blocks: [named] }] })
    const button = within(cardOf(container, 72)).getByRole('button', { name: 'Early run, 06:00 – 10:00, Jessica Rivera' })
    expect(button).toHaveTextContent('Early run')
    expect(button).not.toHaveTextContent('break')
  })

  it('a 12-hour clock reads in the block and in its name', () => {
    const { container } = draw({ is12: true })
    expect(within(cardOf(container, 71)).getByRole('button', { name: '09:00 AM – 05:00 PM, break 01:00 PM – 01:30 PM, Carlos Mendoza' })).toBeInTheDocument()
  })

  it('«Add shift» passes the day with no hour and is named with the driver and the date', async () => {
    const { container } = draw()
    const add = within(cardOf(container, 71)).getByRole('button', { name: 'Add shift for Carlos Mendoza on 14 Oct 2026' })
    expect(add).toHaveTextContent('Add shift')
    await userEvent.click(add)
    expect(current.onAddBlock).toHaveBeenCalledWith(carlos, DAY, null)
  })

  it('a driver with no blocks says «No shifts» and still offers «Add shift»', () => {
    const { container } = draw()
    const card = cardOf(container, 72)
    expect(within(card).getByText('No shifts')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /^Add shift/ })).toBeInTheDocument()
    expect(within(cardOf(container, 71)).queryByText('No shifts')).toBeNull()
  })

  it('a past day offers no «Add shift» (DT-18) but lists its blocks', async () => {
    const past = '2026-10-13'
    const pastBlock = block(9200, '2026-10-13 09:00:00', '2026-10-13 12:00:00')
    const { container } = draw({ range: { from: past, to: past }, users: [{ ...carlos, delivery_blocks: [pastBlock] }, jessica] })
    expect(screen.queryByRole('button', { name: /^Add shift/ })).toBeNull()
    expect(within(cardOf(container, 72)).getByText('No shifts')).toBeInTheDocument()
    await userEvent.click(within(cardOf(container, 71)).getByRole('button', { name: '09:00 – 12:00, Carlos Mendoza' }))
    expect(current.onOpenBlock).toHaveBeenCalledWith(expect.anything(), pastBlock, past)
  })
})

describe('ScheduleAgenda · several days', () => {
  it('has a row per day of the range for each driver, with the visible date', () => {
    const { container } = draw({ range: WEEK })
    const card = cardOf(container, 71)
    const rows = card.querySelectorAll('li[data-day]')
    expect(Array.from(rows).map(row => row.dataset.day)).toEqual([
      '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'
    ])
    expect(within(rows[0]).getByText('11 Oct 2026').tagName).toBe('TIME')
    expect(within(rows[6]).getByText('17 Oct 2026')).toBeInTheDocument()
    // never an ISO date in sight
    expect(card.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('the block sits in its own day; the other days say «No shifts»', () => {
    const { container } = draw({ range: WEEK })
    const card = cardOf(container, 71)
    expect(within(dayOf(card, DAY)).getByRole('button', { name: /09:00 – 17:00/ })).toBeInTheDocument()
    expect(within(dayOf(card, DAY)).queryByText('No shifts')).toBeNull()
    expect(within(dayOf(card, '2026-10-15')).getByText('No shifts')).toBeInTheDocument()
    expect(card.querySelectorAll('li[data-day] button[class*="odc-sa-block"]')).toHaveLength(1)
    expect(within(card).getAllByText('No shifts')).toHaveLength(6)
  })

  it('today is marked with aria-current', () => {
    const { container } = draw({ range: WEEK })
    const card = cardOf(container, 71)
    expect(dayOf(card, DAY)).toHaveAttribute('aria-current', 'date')
    expect(card.querySelectorAll('[aria-current="date"]')).toHaveLength(1)
  })

  it('«Add shift» is on today and the days after it, not before (DT-18), and passes the pressed day', async () => {
    const { container } = draw({ range: WEEK })
    const card = cardOf(container, 71)
    expect(within(card).getAllByRole('button', { name: /^Add shift for/ })).toHaveLength(4)
    for (const past of ['2026-10-11', '2026-10-12', '2026-10-13']) {
      expect(within(dayOf(card, past)).queryByRole('button', { name: /^Add shift/ })).toBeNull()
    }
    await userEvent.click(within(dayOf(card, '2026-10-16')).getByRole('button', { name: 'Add shift for Carlos Mendoza on 16 Oct 2026' }))
    expect(current.onAddBlock).toHaveBeenCalledWith(carlos, '2026-10-16', null)
    await userEvent.click(within(dayOf(card, DAY)).getByRole('button', { name: 'Add shift for Carlos Mendoza on 14 Oct 2026' }))
    expect(current.onAddBlock).toHaveBeenLastCalledWith(carlos, DAY, null)
  })

  it('a block opens with its day', async () => {
    const { container } = draw({ range: WEEK })
    await userEvent.click(within(dayOf(cardOf(container, 74), '2026-10-16')).getByRole('button', { name: 'Weekly run, 08:00 – 12:00, Sofia Gil' }))
    expect(current.onOpenBlock).toHaveBeenCalledWith(sofia, sofiaBlock, '2026-10-16')
  })

  it('several blocks in a day are all listed, in order of start (the agenda has room for them)', () => {
    const late = block(9300, '2026-10-14 18:00:00', '2026-10-14 20:00:00')
    const early = block(9301, '2026-10-14 06:00:00', '2026-10-14 08:00:00')
    const mid = block(9302, '2026-10-14 12:00:00', '2026-10-14 14:00:00')
    const { container } = draw({ range: WEEK, users: [{ ...jessica, delivery_blocks: [late, early, mid] }] })
    const buttons = within(dayOf(cardOf(container, 72), DAY)).getAllByRole('button', { name: /Jessica Rivera$/ })
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
      '06:00 – 08:00, Jessica Rivera',
      '12:00 – 14:00, Jessica Rivera',
      '18:00 – 20:00, Jessica Rivera'
    ])
  })

  it('a range that crosses a month tells the 15th of October from the 15th of November (DT-09)', () => {
    const october = block(9400, '2026-10-15 09:00:00', '2026-10-15 10:00:00')
    const november = block(9401, '2026-11-15 14:00:00', '2026-11-15 16:00:00')
    const { container } = draw({
      range: { from: '2026-10-15', to: '2026-11-15' },
      users: [{ ...carlos, delivery_blocks: [october, november] }]
    })
    const card = cardOf(container, 71)
    expect(card.querySelectorAll('li[data-day]')).toHaveLength(32)
    expect(dayOf(card, '2026-10-15')).toHaveTextContent('09:00 – 10:00')
    expect(dayOf(card, '2026-10-15')).not.toHaveTextContent('14:00 – 16:00')
    expect(dayOf(card, '2026-11-15')).toHaveTextContent('14:00 – 16:00')
    expect(dayOf(card, '2026-11-15')).not.toHaveTextContent('09:00 – 10:00')
  })
})

describe('ScheduleAgenda · states', () => {
  it('without drivers and not loading says «No drivers found»', () => {
    draw({ users: [] })
    expect(screen.getByText('No drivers found')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('a missing list is empty; delivery_blocks missing or null or 30 blocks do not throw (DT-24)', () => {
    const empty = draw({ users: undefined })
    expect(screen.getByText('No drivers found')).toBeInTheDocument()
    empty.unmount()
    const many = Array.from({ length: 30 }, (_, index) => block(9500 + index, `2026-10-14 ${halfHour(index)}`, `2026-10-14 ${halfHour(index + 1)}`))
    expect(() => draw({ users: [bare, { id: 76, name: 'Null', delivery_blocks: null }, { id: 77, name: 'Many', delivery_blocks: many }] })).not.toThrow()
    expect(within(screen.getByRole('list', { name: 'Drivers time display' })).getAllByRole('button', { name: /^(0|1)\d:\d\d – /, hidden: false })).toHaveLength(30)
  })

  it('loading draws skeleton cards, announces itself once and shows no empty state', () => {
    const { container } = draw({ loading: true, users: [] })
    expect(container.querySelectorAll('li[data-skeleton]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('.odc-sa')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No drivers found')).toBeNull()
  })

  it('loading hides the old cards (they belong to another range)', () => {
    const { container } = draw({ loading: true })
    expect(container.querySelector('li[data-user-id]')).toBeNull()
  })

  it('works without handlers (a press is harmless)', async () => {
    const { container } = draw({ onOpenBlock: undefined, onAddBlock: undefined, onShowDay: undefined })
    await userEvent.click(within(cardOf(container, 71)).getByRole('button', { name: /09:00 – 17:00/ }))
    await userEvent.click(within(cardOf(container, 71)).getByRole('button', { name: /^Add shift/ }))
  })
})

describe('schedule-agenda.css', () => {
  const css = readFileSync(resolvePath(__dirname, '../schedule-agenda.css'), 'utf8')

  it('has no literal color, length, weight, duration or z-index (the Product literal guard)', () => {
    expect(scanCss(css)).toEqual([])
  })

  it('every var(--od-*) it reads is a defined token', () => {
    const defined = new Set()
    for (const file of ['src/brand/ordering.tokens.generated.css', 'src/brand/candidates.css']) {
      const source = readFileSync(resolvePath(__dirname, '../../../../../../../../../../', file), 'utf8')
      for (const match of source.matchAll(/(--od-[\w-]+)\s*:/g)) defined.add(match[1])
    }
    const used = [...new Set(Array.from(css.matchAll(/var\((--od-[\w-]+)/g)).map(match => match[1]))]
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter(name => !defined.has(name))).toEqual([])
    expect(css).not.toMatch(/var\(--[\w-]+\s*,/)
  })

  it('uses logical properties only', () => {
    expect(css).not.toMatch(/\b(margin|padding|border)-(left|right|top|bottom)\b/)
    expect(css).not.toMatch(/(^|[\s;{])(left|right|top|bottom|width|height|min-width|max-width|min-height|max-height)\s*:/m)
    expect(css).not.toMatch(/text-align:\s*(left|right)/)
  })

  it('never scrolls sideways at 390: no scroller, and text wraps instead of clipping', () => {
    expect(css).not.toMatch(/overflow(-x)?:\s*(auto|scroll)/)
    expect(css).not.toMatch(/white-space:\s*nowrap/)
  })

  it('every own class starts with odc-sa- and the 44px reach is a pseudo-element under a coarse pointer or a phone', () => {
    const own = Array.from(css.matchAll(/\.(odc-[a-z0-9-]+)/g)).map(match => match[1])
    expect([...new Set(own)].filter(name => name !== 'odc-sa' && !name.startsWith('odc-sa-') && !['odc-icon', 'odc-figure'].includes(name))).toEqual([])
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[\s\S]*::after[\s\S]*inset:\s*var\(--od-x-target-inset\)/)
  })

  it('the block button shows a focus ring from the focus tokens', () => {
    expect(css).toMatch(/\.odc-sa-block:focus-visible\s*\{[^}]*outline:\s*var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
  })
})
