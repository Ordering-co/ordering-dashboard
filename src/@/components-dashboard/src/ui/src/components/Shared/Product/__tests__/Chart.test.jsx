// redesign home FA (D8, decisión 36, HM-06, HM-15, HM-18): Product Chart. One theme resolved from the --od-x-chart-*
// tokens (canvas cannot read CSS variables), slots by order, monotone curves from zero, and a data table that is always
// in the DOM. react-chartjs-2 is replaced by a capture of the props it receives.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ line: null, bar: null, resize: null }))
vi.mock('react-chartjs-2', () => {
  const plot = (key, testId) => {
    const Plot = props => {
      runtime[key] = props
      return (
        <canvas
          data-testid={testId}
          role={props.role}
          aria-label={props['aria-label']}
          aria-describedby={props['aria-describedby']}
        >
          {props.fallbackContent}
        </canvas>
      )
    }
    return Plot
  }
  return { Line: plot('line', 'line-chart'), Bar: plot('bar', 'bar-chart') }
})
// the Chart.js instance of a canvas, with a `resize` spy (the plot box asks it to measure again when it changes size)
vi.mock('chart.js', () => ({ Chart: { getChart: node => (node ? { resize: (...args) => runtime.resize?.(...args) } : undefined) } }))

import { Chart, useChartTheme } from '../Chart'

const css = readFileSync(path.join(__dirname, '..', 'chart.css'), 'utf8')

const LIGHT = {
  '--od-x-chart-1': 'rgb(38, 109, 240)',
  '--od-x-chart-2': 'rgb(255, 148, 24)',
  '--od-x-chart-3': 'rgb(8, 122, 75)',
  '--od-x-chart-4': 'rgb(91, 79, 209)',
  '--od-x-chart-5': 'rgb(233, 29, 99)',
  '--od-x-chart-6': 'rgb(152, 100, 0)',
  '--od-x-chart-comparison': 'rgb(150, 150, 150)',
  '--od-x-chart-grid': 'rgb(230, 230, 230)',
  '--od-x-chart-axis': 'rgb(100, 100, 100)',
  '--od-x-chart-line-width': '2px',
  '--od-font-sans': 'Inter, sans-serif',
  '--od-font-mono': 'JetBrains Mono, monospace',
  // redesign home R1 (Q-09): the tokens of the tooltip
  '--od-surface-strong': 'rgb(11, 12, 13)',
  '--od-text-inverse': 'rgb(255, 255, 255)',
  '--od-radius-control': '4px'
}
const DARK = {
  ...LIGHT,
  '--od-x-chart-1': 'rgb(78, 140, 252)',
  '--od-x-chart-2': 'rgb(217, 112, 26)',
  '--od-x-chart-comparison': 'rgb(120, 120, 120)',
  '--od-surface-strong': 'rgb(255, 255, 255)',
  '--od-text-inverse': 'rgb(11, 12, 13)'
}

let tokens
let reducedMotion

const stubTokens = () => vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
  getPropertyValue: name => (tokens(name) ?? '')
}))

const stubMedia = () => {
  window.matchMedia = vi.fn(query => ({
    matches: /reduce/.test(query) ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn()
  }))
}

const labels = ['01 Oct', '02 Oct', '03 Oct']
const sales = { id: 'sales', label: 'Sales', data: [12.5, 0, 30] }
const previous = { id: 'previous', label: 'Previous period', data: [10, 5, 20], comparison: true }
const table = { caption: 'Sales per day', xHeader: 'Day' }
const formatValue = value => `$${Number(value).toFixed(2)}`

const base = { type: 'line', label: 'Sales trend', labels, series: [sales], formatValue, table }
const draw = (props = {}) => render(<Chart {...base} {...props} />)

beforeEach(() => {
  runtime.line = null
  runtime.bar = null
  runtime.resize = vi.fn()
  reducedMotion = false
  tokens = name => (document.documentElement.getAttribute('data-od-theme') === 'dark' ? DARK : LIGHT)[name]
  stubTokens()
  stubMedia()
})

afterEach(() => {
  cleanup() // unmount first: the theme observer must not fire into a test that is over
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-od-theme')
})

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Product Chart · contract', () => {
  it('throws without a label, without a table caption or without a table x header', () => {
    quiet()
    expect(() => draw({ label: undefined })).toThrow(Error)
    expect(() => draw({ label: null })).toThrow(Error)
    expect(() => draw({ table: undefined })).toThrow(Error)
    expect(() => draw({ table: { xHeader: 'Day' } })).toThrow(Error)
    expect(() => draw({ table: { caption: 'Sales per day' } })).toThrow(Error)
    expect(() => draw({ table: { caption: null, xHeader: 'Day' } })).toThrow(Error)
  })

  it('does not throw with an empty label: an empty translation paints empty', () => {
    expect(() => draw({ label: '' })).not.toThrow()
    expect(screen.getByTestId('line-chart')).toHaveAttribute('aria-label', '')
  })

  it('rejects a type that is neither line nor bar', () => {
    quiet()
    expect(() => draw({ type: 'pie' })).toThrow(Error)
  })

  it('draws a line with Line and a bar with Bar', () => {
    draw()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByRole('figure')).toHaveAttribute('data-type', 'line')
    draw({ type: 'bar' })
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('carries data-size and defaults to the default size', () => {
    draw()
    expect(screen.getByRole('figure')).toHaveAttribute('data-size', 'default')
    draw({ size: 'compact', className: 'mine' })
    const compact = screen.getAllByRole('figure')[1]
    expect(compact).toHaveAttribute('data-size', 'compact')
    expect(compact).toHaveClass('odc-chart', 'mine')
  })
})

describe('Product Chart · colors by slot', () => {
  it('gives the series the slots in order, from the resolved tokens', async () => {
    draw({ series: [sales, { id: 'tips', label: 'Tips', data: [1, 2, 3] }] })
    await waitFor(() => expect(runtime.line.data.datasets[0].borderColor).toBe(LIGHT['--od-x-chart-1']))
    const [first, second] = runtime.line.data.datasets
    expect(first.borderColor).toBe(LIGHT['--od-x-chart-1'])
    expect(second.borderColor).toBe(LIGHT['--od-x-chart-2'])
    expect(first.label).toBe('Sales')
    expect(first.data).toEqual([12.5, 0, 30])
    expect(runtime.line.data.labels).toEqual(labels)
  })

  it('paints the comparison in its own token, dashed and unfilled, without taking a slot', async () => {
    draw({ series: [previous, sales] })
    await waitFor(() => expect(runtime.line.data.datasets[1].borderColor).toBe(LIGHT['--od-x-chart-1']))
    const [compared, own] = runtime.line.data.datasets
    expect(compared.borderColor).toBe(LIGHT['--od-x-chart-comparison'])
    expect(compared.borderDash).toEqual([4, 4])
    expect(compared.fill).toBe(false)
    expect(own.borderDash).toBeUndefined()
    expect(own.borderColor).toBe(LIGHT['--od-x-chart-1'])
  })

  it('takes the line width from the token', async () => {
    draw()
    await waitFor(() => expect(runtime.line.data.datasets[0].borderWidth).toBe(2))
  })

  it('accepts 6 series and throws with 7: a seventh is Other or small multiples, never an invented color', () => {
    const many = count => Array.from({ length: count }, (_, index) => ({ id: `s${index}`, label: `S${index}`, data: [1, 2, 3] }))
    draw({ series: many(6) })
    expect(runtime.line.data.datasets).toHaveLength(6)
    expect(runtime.line.data.datasets[5].borderColor).toBe(LIGHT['--od-x-chart-6'])
    quiet()
    expect(() => draw({ series: many(7) })).toThrow(Error)
  })

  it('does not count comparison series against the 6 slots', () => {
    const many = Array.from({ length: 6 }, (_, index) => ({ id: `s${index}`, label: `S${index}`, data: [1, 2, 3] }))
    expect(() => draw({ series: [...many, previous] })).not.toThrow()
  })

  it('paints bars in the slot color with a radius', async () => {
    draw({ type: 'bar', series: [sales, previous] })
    await waitFor(() => expect(runtime.bar.data.datasets[0].backgroundColor).toBe(LIGHT['--od-x-chart-1']))
    const [own, compared] = runtime.bar.data.datasets
    expect(own.borderRadius).toBe(4)
    expect(compared.backgroundColor).toBe(LIGHT['--od-x-chart-comparison'])
  })
})

describe('Product Chart · marks (HM-15)', () => {
  it('uses a monotone curve, so it never dips below the day with sales', async () => {
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    expect(runtime.line.data.datasets[0].cubicInterpolationMode).toBe('monotone')
  })

  it('starts the Y axis at zero', async () => {
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const y = runtime.line.options.scales.y
    expect(y.beginAtZero).toBe(true)
    expect(y.suggestedMin).toBe(0)
  })

  it('hides the points, shows them on hover and draws no area', async () => {
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const [dataset] = runtime.line.data.datasets
    expect(dataset.pointRadius).toBe(0)
    expect(dataset.pointHoverRadius).toBe(4)
    expect(dataset.fill).toBe(false)
  })

  it('keeps the X labels flat, thinned to 7, with a horizontal-only grid', async () => {
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const { x, y } = runtime.line.options.scales
    expect(x.ticks.maxRotation).toBe(0)
    expect(x.ticks.autoSkip).toBe(true)
    expect(x.ticks.maxTicksLimit).toBe(7)
    expect(x.grid.display).toBe(false)
    expect(y.grid.drawBorder).toBe(false)
    expect(y.grid.color).toBe(LIGHT['--od-x-chart-grid'])
    expect(x.ticks.color).toBe(LIGHT['--od-x-chart-axis'])
    expect(x.ticks.font).toMatchObject({ size: 12, family: LIGHT['--od-font-sans'] })
    expect(y.ticks.font).toMatchObject({ size: 12, family: LIGHT['--od-font-mono'] })
  })

  // (intelligence-ecommerce-reports P8): with many stores or products the flat X labels ran into each other.
  // A label longer than its share of the axis is cut with «…»; the tooltip title and the data table keep the whole name.
  // Review R-3: the cut follows the room (chart width ÷ shown ticks), so a period label with room stays whole.
  const tick = (x, index, width) => x.ticks.callback.call({ chart: { width } }, index, index)

  it('cuts long X labels with an ellipsis when they do not fit, and keeps the whole name in the tooltip and the table', async () => {
    const names = ['Pizza Palace Downtown Express', 'Bar', 'Twelve chars']
    draw({ type: 'bar', labels: names, series: [{ ...sales, data: [1, 2, 3] }] })
    await waitFor(() => expect(runtime.bar).not.toBeNull())
    const { x } = runtime.bar.options.scales
    // 300px for 3 ticks: 100px each, 8px of gap, room for 12 characters of 12px
    expect(tick(x, 0, 300)).toBe('Pizza Palac…')
    expect(tick(x, 1, 300)).toBe('Bar')
    expect(tick(x, 2, 300)).toBe('Twelve chars')
    expect(runtime.bar.options.plugins.tooltip.callbacks.title([{ label: names[0] }])).toBe(names[0])
    expect(screen.getAllByRole('rowheader', { name: names[0] }).length).toBeGreaterThan(0)
  })

  it('keeps a long label whole when the axis has room for it (a period label of a wide chart)', async () => {
    const periods = ['Week 41 · 12-10 – 17-10', 'Week 42 · 18-10 – 24-10']
    draw({ type: 'bar', labels: periods, series: [{ ...sales, data: [1, 2] }] })
    await waitFor(() => expect(runtime.bar).not.toBeNull())
    const { x } = runtime.bar.options.scales
    expect(tick(x, 0, 700)).toBe(periods[0])
    expect(tick(x, 1, 700)).toBe(periods[1])
    // never below six characters (a trailing space is dropped), however crowded
    expect(tick(x, 0, 40)).toBe('Week…')
  })

  it('leaves short labels such as dates as they are', async () => {
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    labels.forEach((name, index) => expect(tick(runtime.line.options.scales.x, index, 320)).toBe(name))
    // without a chart to measure (a test double), nothing is cut
    expect(runtime.line.options.scales.x.ticks.callback(0, 0)).toBe(labels[0])
  })

  it('formats the Y ticks and the tooltip with formatValue, and titles it with the X label', async () => {
    draw({ series: [sales, previous] })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const { options } = runtime.line
    expect(options.scales.y.ticks.callback(12.5)).toBe('$12.50')
    expect(options.interaction).toMatchObject({ mode: 'index', intersect: false })
    expect(options.plugins.tooltip).toMatchObject({ mode: 'index', intersect: false })
    expect(options.plugins.tooltip.callbacks.title([{ label: '02 Oct' }])).toBe('02 Oct')
    expect(options.plugins.tooltip.callbacks.label({ dataset: { label: 'Sales' }, parsed: { y: 30 } })).toBe('Sales: $30.00')
    expect(options.plugins.legend.display).toBe(false)
  })

  // redesign (row 72 Q-08): opt-in `durationTicks` snaps the Y step to a human duration step
  describe('durationTicks', () => {
    const stepFor = async (data, props = {}) => {
      runtime.line = null
      draw({ durationTicks: true, series: [{ id: 'time', label: 'Time', data }], ...props })
      await waitFor(() => expect(runtime.line).not.toBeNull())
      return runtime.line.options.scales.y.ticks.stepSize
    }

    it('does not touch the Y axis without the prop', async () => {
      draw({ series: [{ id: 'time', label: 'Time', data: [83, 40, 12] }] })
      await waitFor(() => expect(runtime.line).not.toBeNull())
      expect(runtime.line.options.scales.y.ticks).not.toHaveProperty('stepSize')
    })

    it.each([
      [[12, 83, 40], 15], // 83 s: 15 s steps, not Chart.js «nice» decimals
      [[1, 7, 3], 2],
      [[2, 3], 1],
      [[600, 2400, 3000], 600], // 50 min
      [[100000, 20000], 21600], // 27.8 h: 6 h
      [[36000, 5000], 7200] // 10 h: 2 h
    ])('snaps the step for %j to %i s', async (data, step) => {
      expect(await stepFor(data)).toBe(step)
    })

    it('keeps at most 6 intervals up to the largest hour step and goes by days beyond', async () => {
      expect(await stepFor([6 * 43200])).toBe(43200)
      expect(await stepFor([6 * 43200 + 1])).toBe(86400)
      expect(await stepFor([30 * 86400])).toBe(432000) // 30 days: 5 days
    })

    it('reads the largest value of every series, the comparison included, and ignores empty points', async () => {
      const step = await stepFor([5, null, 8], {
        series: [
          { id: 'time', label: 'Time', data: [5, null, 8] },
          { id: 'previous', label: 'Previous', data: [900, 100], comparison: true }
        ]
      })
      expect(step).toBe(300)
    })

    it('takes the span of negative values too (signed durations)', async () => {
      expect(await stepFor([-83, 10])).toBe(30)
    })

    // redesign with a range of 0 (the API sent every time as null, «Today») Chart.js got no step and drew decimal
    // ticks that the duration formatter rounded to «0 s / 1 s» again and again. The smallest step (1 s) leaves 0 s and 1 s once each.
    it('keeps the smallest step (1 s) when the range is 0, so no tick label repeats', async () => {
      expect(await stepFor([0, 0])).toBe(1)
      expect(await stepFor([null])).toBe(1)
      expect(await stepFor([null, null, null])).toBe(1)
    })

    it('still sets no step without the prop, even when every value is empty', async () => {
      draw({ series: [{ id: 'time', label: 'Time', data: [null, null] }] })
      await waitFor(() => expect(runtime.line).not.toBeNull())
      expect(runtime.line.options.scales.y.ticks).not.toHaveProperty('stepSize')
    })
  })

  // redesign with a wide Y axis («$ 10,000.00») the dates of the X axis ran into each other
  // («20-0925-0930-09…»): the room of a tick was taken from the width of the whole chart, Y axis included, and a label of
  // 5 characters («20-09») was never cut, so nothing made Chart.js skip. The room is now the width of the X scale itself
  // and, when the labels cannot fit side by side, the callback hands back `null` for the ones to skip.
  describe('X axis room', () => {
    const dates = Array.from({ length: 30 }, (_, index) => `${String(index + 1).padStart(2, '0')}-09`)
    const scale = (width, chartWidth = 400) => ({ width, chart: { width: chartWidth } })
    const shownOn = (x, width, chartWidth) => dates.map((_, index) => x.ticks.callback.call(scale(width, chartWidth), index, index)).filter(item => item != null)
    const drawDates = async () => {
      draw({ labels: dates, series: [{ ...sales, data: dates.map((_, index) => index) }] })
      await waitFor(() => expect(runtime.line).not.toBeNull())
      return runtime.line.options.scales.x
    }

    it('measures the room on the width of the X scale, not on the chart that includes the Y axis', async () => {
      const x = await drawDates()
      // the scale is 250px of a 400px chart (the Y axis took 150): with the chart width it would have kept 7 ticks
      const narrow = shownOn(x, 250, 400)
      expect(narrow.length).toBeLessThan(7)
      expect(narrow.length).toBeGreaterThan(1)
      expect(shownOn(x, 400, 400).length).toBe(30)
    })

    it('skips labels instead of letting them overlap: the ticks left have room for a 5-character date', async () => {
      const x = await drawDates()
      const shown = shownOn(x, 250)
      // a 5-character date is about 36px at 12px; the labels left keep at least that apart (the skipped ones are null)
      const kept = dates.map((_, index) => x.ticks.callback.call(scale(250), index, index)).map((item, index) => (item == null ? -1 : index)).filter(index => index >= 0)
      expect(shown[0]).toBe('01-09')
      kept.slice(1).forEach((index, at) => expect((index - kept[at]) * (250 / dates.length)).toBeGreaterThanOrEqual(36))
    })

    it('keeps the labels as they were when they fit, so Chart.js thins them to 7 as before', async () => {
      const x = await drawDates()
      expect(x.ticks.maxTicksLimit).toBe(7)
      dates.forEach((name, index) => expect(x.ticks.callback.call(scale(600), index, index)).toBe(name))
    })

    it('falls back to the chart width while the scale has none, and to no cut at all without a chart', async () => {
      const x = await drawDates()
      expect(shownOn(x, undefined, 250).length).toBeLessThan(7)
      expect(x.ticks.callback.call({}, 3, 3)).toBe(dates[3])
    })

    // (B5): an hour such as «12:00 PM» is never cut with «…»: when it does not fit, fewer whole ticks are drawn
    describe('short labels are never cut', () => {
      const hours = Array.from({ length: 24 }, (_, index) => `${index % 12 === 0 ? 12 : index % 12}:00 ${index < 12 ? 'AM' : 'PM'}`)
      const drawHours = async () => {
        draw({ labels: hours, series: [{ ...sales, data: hours.map((_, index) => index) }] })
        await waitFor(() => expect(runtime.line).not.toBeNull())
        return runtime.line.options.scales.x
      }
      const shownHours = (x, width) => hours.map((_, index) => x.ticks.callback.call(scale(width), index, index)).filter(item => item != null)

      it.each([300, 400, 500, 640, 900, 1300])('draws no «…» on hours at %ipx, only whole ticks', async width => {
        const x = await drawHours()
        const shown = shownHours(x, width)
        expect(shown.length).toBeGreaterThan(0)
        shown.forEach(text => {
          expect(text).not.toContain('…')
          expect(hours).toContain(text)
        })
      })

      it('thins the ticks until the whole hours have room (8 characters are about 58px at 12px)', async () => {
        const x = await drawHours()
        const shown = shownHours(x, 300)
        expect(shown.length).toBeLessThan(7)
        expect(shown.length).toBeGreaterThan(1)
        const kept = hours.map((_, index) => (x.ticks.callback.call(scale(300), index, index) == null ? -1 : index)).filter(index => index >= 0)
        kept.slice(1).forEach((index, at) => expect((index - kept[at]) * (300 / hours.length)).toBeGreaterThanOrEqual(58))
      })

      it('does not cut a time with seconds either, even when it is longer than 10 characters', async () => {
        const times = ['12:00:00 PM', '1:00:00 PM', '2:00:00 PM']
        draw({ labels: times, series: [{ ...sales, data: [1, 2, 3] }] })
        await waitFor(() => expect(runtime.line).not.toBeNull())
        const shown = times.map((_, index) => runtime.line.options.scales.x.ticks.callback.call(scale(60), index, index)).filter(item => item != null)
        expect(shown[0]).toBe('12:00:00 PM')
        shown.forEach(text => expect(text).not.toContain('…'))
      })

      it('still cuts a long category with «…» as before', async () => {
        const names = ['Downtown branch of the north', 'Airport kiosk terminal two']
        draw({ labels: names, series: [{ ...sales, data: [1, 2] }] })
        await waitFor(() => expect(runtime.line).not.toBeNull())
        const text = runtime.line.options.scales.x.ticks.callback.call(scale(120), 0, 0)
        expect(text.endsWith('…')).toBe(true)
        expect(text.length).toBeLessThan(names[0].length)
      })
    })

    it('keeps the first label and also works with the numeric tick value of the category scale', async () => {
      const x = await drawDates()
      expect(x.ticks.callback.call(scale(120), 0, 0)).toBe('01-09')
      expect(x.ticks.callback.call(scale(120), 7, 99)).toBeNull()
    })

    // a long label that does not fit (a week: «Week 41 · 14-10 – 20-10») was cut with «…» in the middle of its range. With
    // `axisLabels` (one entry per label, a string or the lines of a label) the whole axis takes the compact form when a label would be cut.
    describe('compact axis labels', () => {
      const weeks = (count, first = 41) => Array.from({ length: count }, (_, index) => {
        const start = 1 + index * 7
        const end = start + 6
        return { text: `Week ${first + index} · ${String(start).padStart(2, '0')}-10 – ${String(end).padStart(2, '0')}-10`, lines: [`Week ${first + index}`, `${String(start).padStart(2, '0')}-10 – ${String(end).padStart(2, '0')}-10`] }
      })
      const drawWeeks = async (count, extra = {}) => {
        const list = weeks(count)
        draw({ labels: list.map(week => week.text), axisLabels: list.map(week => week.lines), series: [{ ...sales, data: list.map((_, index) => index) }], ...extra })
        await waitFor(() => expect(runtime.line).not.toBeNull())
        return { x: runtime.line.options.scales.x, list }
      }
      const ticks = (x, count, width) => Array.from({ length: count }, (_, index) => x.ticks.callback.call(scale(width), index, index))
      const lineWidth = lines => Math.max(...lines.map(line => line.length)) * 12 * 0.6 + 4

      it('keeps the full label when it fits (1094 px, 2 weeks)', async () => {
        const { x, list } = await drawWeeks(2)
        expect(ticks(x, 2, 1094)).toEqual(list.map(week => week.text))
      })

      it('takes the compact form, with no «…», when the full label would be cut (324 px, 2 weeks)', async () => {
        const { x, list } = await drawWeeks(2)
        const shown = ticks(x, 2, 324)
        expect(shown).toEqual(list.map(week => week.lines))
        expect(JSON.stringify(shown)).not.toContain('…')
      })

      it('without axisLabels the label is cut as before', async () => {
        const list = weeks(2)
        draw({ labels: list.map(week => week.text), series: [{ ...sales, data: [1, 2] }] })
        await waitFor(() => expect(runtime.line).not.toBeNull())
        const text = runtime.line.options.scales.x.ticks.callback.call(scale(324), 0, 0)
        expect(typeof text).toBe('string')
        expect(text.endsWith('…')).toBe(true)
      })

      it('draws fewer marks, none cut, when 8 weeks do not fit in 324 px', async () => {
        const { x, list } = await drawWeeks(8)
        const shown = ticks(x, 8, 324)
        const kept = shown.map((item, index) => (item == null ? -1 : index)).filter(index => index >= 0)
        expect(kept.length).toBeGreaterThan(0)
        expect(kept.length).toBeLessThan(7)
        kept.forEach(index => expect(shown[index]).toEqual(list[index].lines))
        expect(JSON.stringify(shown)).not.toContain('…')
        // every line left has the room of its mark: the longest line plus the gap between two marks
        kept.slice(1).forEach((index, at) => expect((index - kept[at]) * (324 / 8)).toBeGreaterThanOrEqual(lineWidth(list[0].lines)))
      })

      it('uses the compact form for every mark, not only for the ones that would be cut (a short first label)', async () => {
        const labelsMixed = ['Today', 'Week 41 · 14-10 – 20-10']
        const axis = ['Today', ['Week 41', '14-10 – 20-10']]
        draw({ labels: labelsMixed, axisLabels: axis, series: [{ ...sales, data: [1, 2] }] })
        await waitFor(() => expect(runtime.line).not.toBeNull())
        expect(ticks(runtime.line.options.scales.x, 2, 324)).toEqual(axis)
      })

      it('ignores axisLabels of another length: the label is cut as before', async () => {
        const { x } = await drawWeeks(2, { axisLabels: [['Week 41', '14-10 – 20-10']] })
        const shown = ticks(x, 2, 324)
        shown.forEach(text => {
          expect(typeof text).toBe('string')
          expect(text.endsWith('…')).toBe(true)
        })
      })

      it('does not touch a label that fits, even with axisLabels (hours)', async () => {
        const hours = ['12:00 AM', '1:00 AM', '2:00 AM']
        draw({ labels: hours, axisLabels: hours.map(hour => [hour, '']), series: [{ ...sales, data: [1, 2, 3] }] })
        await waitFor(() => expect(runtime.line).not.toBeNull())
        expect(ticks(runtime.line.options.scales.x, 3, 324)).toEqual(hours)
      })

      it('leaves the tooltip and the table on the full labels', async () => {
        const { list } = await drawWeeks(2)
        expect(runtime.line.data.labels).toEqual(list.map(week => week.text))
        expect(runtime.line.options.plugins.tooltip.callbacks.title([{ label: list[0].text }])).toBe(list[0].text)
        const rows = screen.getAllByRole('rowheader', { hidden: true }).map(row => row.textContent)
        expect(rows).toEqual(expect.arrayContaining(list.map(week => week.text)))
      })
    })
  })

  // (B3): the plot box follows its container when the viewport shrinks live
  describe('follows its container', () => {
    let observers
    beforeEach(() => {
      observers = []
      globalThis.ResizeObserver = class {
        constructor (callback) {
          this.callback = callback
          this.observed = []
          this.disconnect = vi.fn()
          observers.push(this)
        }

        observe (node) { this.observed.push(node) }
        unobserve () {}
      }
    })
    afterEach(() => { delete globalThis.ResizeObserver })

    it('observes the plot box and asks the chart to resize when the box changes size', async () => {
      const { container } = draw()
      await waitFor(() => expect(runtime.line).not.toBeNull())
      const plot = container.querySelector('.odc-chart-plot')
      const mine = observers.find(observer => observer.observed.includes(plot))
      expect(mine).toBeTruthy()
      expect(runtime.resize).not.toHaveBeenCalled()
      act(() => mine.callback([{ target: plot }]))
      expect(runtime.resize).toHaveBeenCalledTimes(1)
    })

    it('stops observing when the chart goes away', async () => {
      const { container, unmount } = draw()
      await waitFor(() => expect(runtime.line).not.toBeNull())
      const mine = observers.find(observer => observer.observed.includes(container.querySelector('.odc-chart-plot')))
      unmount()
      expect(mine.disconnect).toHaveBeenCalled()
    })

    it('draws without a ResizeObserver (an old engine, or a test double) as before', async () => {
      delete globalThis.ResizeObserver
      draw()
      await waitFor(() => expect(runtime.line).not.toBeNull())
      expect(screen.getByTestId('line-chart')).toBeTruthy()
    })
  })

  it('fills the box and does not keep the aspect ratio, so the CSS height governs', async () => {
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    expect(runtime.line.options.responsive).toBe(true)
    expect(runtime.line.options.maintainAspectRatio).toBe(false)
  })
})

describe('Product Chart · no CSS variables, no literal colors', () => {
  it('passes no var() to the canvas', async () => {
    draw({ series: [sales, previous] })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const serialized = JSON.stringify({ data: runtime.line.data, options: runtime.line.options })
    expect(serialized).not.toContain('var(')
  })

  it('leaves colors and fonts undefined when nothing resolves: Chart.js keeps its default, never a literal', async () => {
    tokens = () => ''
    draw({ series: [sales, previous] })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const [own, compared] = runtime.line.data.datasets
    expect(own.borderColor).toBeUndefined()
    expect(own.backgroundColor).toBeUndefined()
    expect(own.borderWidth).toBeUndefined()
    expect(compared.borderColor).toBeUndefined()
    const { x, y } = runtime.line.options.scales
    expect(x.ticks.color).toBeUndefined()
    expect(y.grid.color).toBeUndefined()
    expect(x.ticks.font.family).toBeUndefined()
    expect(y.ticks.font.family).toBeUndefined()
    expect(JSON.stringify(runtime.line.data)).not.toMatch(/#|rgb|hsl/)
  })

  it('has no color literal in the source', () => {
    const source = readFileSync(path.join(__dirname, '..', 'Chart.jsx'), 'utf8')
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/)
  })
})

describe('Product Chart · theme', () => {
  it('reads the theme again when data-od-theme changes on the root', async () => {
    draw()
    await waitFor(() => expect(runtime.line.data.datasets[0].borderColor).toBe(LIGHT['--od-x-chart-1']))
    await act(async () => document.documentElement.setAttribute('data-od-theme', 'dark'))
    await waitFor(() => expect(runtime.line.data.datasets[0].borderColor).toBe(DARK['--od-x-chart-1']))
  })

  it('reads it again when the nearest [data-ordering-brand] ancestor changes theme', async () => {
    tokens = name => (scope.getAttribute('data-od-theme') === 'dark' ? DARK : LIGHT)[name]
    const scope = document.createElement('div')
    scope.setAttribute('data-ordering-brand', '')
    document.body.appendChild(scope)
    render(<Chart {...base} />, { container: scope })
    await waitFor(() => expect(runtime.line.data.datasets[0].borderColor).toBe(LIGHT['--od-x-chart-1']))
    await act(async () => scope.setAttribute('data-od-theme', 'dark'))
    await waitFor(() => expect(runtime.line.data.datasets[0].borderColor).toBe(DARK['--od-x-chart-1']))
    scope.remove()
  })

  it('reads it again when prefers-color-scheme changes', async () => {
    const listeners = []
    window.matchMedia = vi.fn(query => ({
      matches: false,
      media: query,
      addEventListener: (_, listener) => { if (/color-scheme/.test(query)) listeners.push(listener) },
      removeEventListener: vi.fn()
    }))
    let scheme = 'light'
    tokens = name => (scheme === 'dark' ? DARK : LIGHT)[name]
    draw()
    await waitFor(() => expect(runtime.line.data.datasets[0].borderColor).toBe(LIGHT['--od-x-chart-1']))
    expect(listeners.length).toBeGreaterThan(0)
    scheme = 'dark'
    act(() => listeners.forEach(listener => listener()))
    await waitFor(() => expect(runtime.line.data.datasets[0].borderColor).toBe(DARK['--od-x-chart-1']))
  })

  it('exports useChartTheme: resolved values of the tokens read from the node', async () => {
    let seen
    const Probe = () => {
      const ref = React.useRef(null)
      seen = useChartTheme(ref)
      return <div ref={ref} />
    }
    render(<Probe />)
    await waitFor(() => expect(seen?.colors?.[0]).toBe(LIGHT['--od-x-chart-1']))
    expect(seen.colors).toHaveLength(6)
    expect(seen.comparison).toBe(LIGHT['--od-x-chart-comparison'])
    expect(seen.lineWidth).toBe(2)
    expect(seen.sans).toBe(LIGHT['--od-font-sans'])
    expect(seen.mono).toBe(LIGHT['--od-font-mono'])
    // redesign home R1 (Q-09): the tooltip tokens, resolved like the rest of the theme
    expect(seen.surfaceStrong).toBe(LIGHT['--od-surface-strong'])
    expect(seen.textInverse).toBe(LIGHT['--od-text-inverse'])
    expect(seen.radiusControl).toBe(4)
  })
})

// redesign home R1 (Q-09, review P3): the tooltip is themed from the tokens, not Chart.js's black at 80 % in Helvetica
describe('Product Chart · tooltip theme (Q-09)', () => {
  it('takes the strong surface, the inverse text, sans for the title, mono for the values and the control radius, with no border', async () => {
    draw({ series: [sales, previous] })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const tooltip = runtime.line.options.plugins.tooltip
    expect(tooltip.backgroundColor).toBe(LIGHT['--od-surface-strong'])
    expect(tooltip.titleColor).toBe(LIGHT['--od-text-inverse'])
    expect(tooltip.bodyColor).toBe(LIGHT['--od-text-inverse'])
    expect(tooltip.titleFont).toMatchObject({ family: LIGHT['--od-font-sans'] })
    expect(tooltip.bodyFont).toMatchObject({ family: LIGHT['--od-font-mono'] })
    expect(tooltip.cornerRadius).toBe(4)
    expect(tooltip.borderWidth).toBe(0)
  })

  it('follows the theme when it changes (dark inverts the surface)', async () => {
    draw()
    await waitFor(() => expect(runtime.line.options.plugins.tooltip.backgroundColor).toBe(LIGHT['--od-surface-strong']))
    await act(async () => document.documentElement.setAttribute('data-od-theme', 'dark'))
    await waitFor(() => expect(runtime.line.options.plugins.tooltip.backgroundColor).toBe(DARK['--od-surface-strong']))
    expect(runtime.line.options.plugins.tooltip.bodyColor).toBe(DARK['--od-text-inverse'])
  })

  it('leaves the tooltip colors, fonts and radius to Chart.js when nothing resolves, never a literal', async () => {
    tokens = () => ''
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const tooltip = runtime.line.options.plugins.tooltip
    expect(tooltip.backgroundColor).toBeUndefined()
    expect(tooltip.titleColor).toBeUndefined()
    expect(tooltip.bodyColor).toBeUndefined()
    expect(tooltip.titleFont.family).toBeUndefined()
    expect(tooltip.bodyFont.family).toBeUndefined()
    expect(tooltip.cornerRadius).toBeUndefined()
  })
})

// redesign home R1 (Q-08, review P2): a series with its own X labels names its own day in the tooltip and in the table
describe('Product Chart · labels per series (Q-08)', () => {
  const dates = ['01 Sep', '02 Sep', '03 Sep']
  const withDates = { ...previous, labels: dates }

  it('prefixes the tooltip row of a series with its own label, and leaves the others as they were', async () => {
    draw({ series: [sales, withDates] })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const { label } = runtime.line.options.plugins.tooltip.callbacks
    expect(label({ datasetIndex: 1, dataIndex: 0, dataset: { label: 'Previous period' }, parsed: { y: 10 } })).toBe('01 Sep · Previous period: $10.00')
    expect(label({ datasetIndex: 1, dataIndex: 2, dataset: { label: 'Previous period' }, parsed: { y: 20 } })).toBe('03 Sep · Previous period: $20.00')
    expect(label({ datasetIndex: 0, dataIndex: 0, dataset: { label: 'Sales' }, parsed: { y: 12.5 } })).toBe('Sales: $12.50')
  })

  it('does not invent a prefix when the series has no label at that index', async () => {
    draw({ series: [sales, { ...previous, labels: ['01 Sep'] }] })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const { label } = runtime.line.options.plugins.tooltip.callbacks
    expect(label({ datasetIndex: 1, dataIndex: 2, dataset: { label: 'Previous period' }, parsed: { y: 20 } })).toBe('Previous period: $20.00')
  })

  it('adds a column with the dates of that series to the table, before its values', () => {
    draw({ series: [sales, withDates] })
    const data = screen.getByRole('figure').querySelector('table[id]')
    const columns = within(data).getAllByRole('columnheader', { hidden: true })
    expect(columns.map(cell => cell.textContent)).toEqual(['Day', 'Sales', 'Previous period · Day', 'Previous period'])
    const rows = data.querySelectorAll('tbody tr')
    expect(Array.from(rows[1].querySelectorAll('td')).map(cell => cell.textContent)).toEqual(['$0.00', '02 Sep', '$5.00'])
  })

  it('keeps the table of a chart without series labels as it was (no extra column)', () => {
    draw({ series: [sales, previous] })
    const data = screen.getByRole('figure').querySelector('table[id]')
    expect(within(data).getAllByRole('columnheader', { hidden: true })).toHaveLength(3)
  })

  it('the fallback table of the canvas carries the same extra column', () => {
    draw({ series: [sales, withDates] })
    const fallback = screen.getByTestId('line-chart').querySelector('table')
    expect(fallback.textContent).toBe(screen.getByRole('figure').querySelector('table[id]').textContent)
    expect(fallback.textContent).toContain('Previous period · Day')
  })
})

describe('Product Chart · alternative table (HM-18)', () => {
  it('is always in the DOM with caption, column headers and one row per label', () => {
    draw({ series: [sales, previous] })
    const figure = screen.getByRole('figure')
    const data = figure.querySelector('table[id]')
    const view = within(data)
    expect(view.getByText('Sales per day').tagName).toBe('CAPTION')
    const columns = view.getAllByRole('columnheader', { hidden: true })
    expect(columns.map(cell => cell.textContent)).toEqual(['Day', 'Sales', 'Previous period'])
    columns.forEach(cell => expect(cell).toHaveAttribute('scope', 'col'))
    const rows = data.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(3)
    const header = rows[0].querySelector('th')
    expect(header).toHaveAttribute('scope', 'row')
    expect(header.textContent).toBe('01 Oct')
    const cells = rows[2].querySelectorAll('td')
    expect(Array.from(cells).map(cell => cell.textContent)).toEqual(['$30.00', '$20.00'])
  })

  it('isolates each figure in .odc-figure > bdi and shows no ISO date', () => {
    draw()
    const cell = screen.getByRole('figure').querySelector('tbody td')
    expect(cell.querySelector('.odc-figure > bdi')?.textContent).toBe('$12.50')
    expect(screen.getByRole('figure').textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('hides the table visually with the shared class, not from assistive tech', () => {
    draw()
    const data = screen.getByRole('figure').querySelector('table[id]')
    expect(data.closest('.odc-sr-only')).not.toBeNull()
    expect(data.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('names the canvas, marks it as an image and describes it with the table', () => {
    draw()
    const canvas = screen.getByTestId('line-chart')
    expect(canvas).toHaveAttribute('role', 'img')
    expect(canvas).toHaveAttribute('aria-label', 'Sales trend')
    const id = canvas.getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    expect(document.getElementById(id).tagName).toBe('TABLE')
    expect(document.getElementById(id)).toBe(screen.getByRole('figure').querySelector('table[id]'))
  })

  it('gives the canvas the same table as fallback content, without repeating the id', () => {
    draw({ series: [sales, previous] })
    const canvas = screen.getByTestId('line-chart')
    const fallback = canvas.querySelector('table')
    expect(fallback).not.toBeNull()
    expect(fallback.getAttribute('id')).toBeNull()
    expect(fallback.textContent).toBe(screen.getByRole('figure').querySelector('table[id]').textContent)
  })

  it('leaves a missing value empty instead of inventing one', () => {
    draw({ series: [{ id: 'sales', label: 'Sales', data: [12.5, null, 30] }] })
    const rows = screen.getByRole('figure').querySelectorAll('table[id] tbody tr')
    expect(rows[1].querySelector('td').textContent).toBe('')
  })
})

describe('Product Chart · legend', () => {
  it('paints an HTML legend with 2 or more series, in text color, with a dashed swatch for the comparison', () => {
    draw({ series: [sales, previous] })
    const legend = screen.getByRole('figure').querySelector('.odc-chart-legend')
    expect(legend).not.toBeNull()
    expect(within(legend).getByText('Sales')).toBeInTheDocument()
    expect(within(legend).getByText('Previous period')).toBeInTheDocument()
    const swatches = legend.querySelectorAll('.odc-chart-swatch')
    expect(swatches).toHaveLength(2)
    expect(swatches[0]).toHaveAttribute('data-slot', '1')
    expect(swatches[0]).toHaveAttribute('aria-hidden', 'true')
    expect(swatches[1]).toHaveAttribute('data-comparison')
  })

  it('numbers the swatches by slot, skipping the comparison', () => {
    draw({ series: [previous, sales, { id: 'tips', label: 'Tips', data: [1, 2, 3] }] })
    const swatches = screen.getByRole('figure').querySelectorAll('.odc-chart-swatch')
    expect(Array.from(swatches).map(swatch => swatch.getAttribute('data-slot'))).toEqual([null, '1', '2'])
  })

  it('paints no legend with a single series: the block title names it', () => {
    draw()
    expect(screen.getByRole('figure').querySelector('.odc-chart-legend')).toBeNull()
  })
})

// redesign `main` hid a series with a click on its legend entry (the native legend of Chart.js) and the axis
// rescaled; on drivers' Times chart «Completed» reaches ~7 days and flattens the other series. Opt-in `toggleSeries`.
describe('Product Chart · toggleSeries', () => {
  const three = [
    { id: 'completed', label: 'Completed', data: [600000, 500000, 400000] },
    { id: 'delivery', label: 'Delivery', data: [60, 50, 40] },
    { id: 'pickup', label: 'Pick up', data: [30, 20, 10] }
  ]
  const legendOf = () => screen.getByRole('figure').querySelector('.odc-chart-legend')
  const hiddenOf = () => runtime.line.data.datasets.map(dataset => dataset.hidden)

  it('keeps the legend as static text by default: no buttons', () => {
    draw({ series: three })
    expect(legendOf().querySelectorAll('button')).toHaveLength(0)
    expect(within(legendOf()).getAllByRole('listitem')).toHaveLength(3)
  })

  it('does not add a hidden key to the datasets by default', async () => {
    draw({ series: three })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    runtime.line.data.datasets.forEach(dataset => expect(dataset).not.toHaveProperty('hidden'))
  })

  it('makes each legend entry a native button with aria-pressed, pressed meaning visible', () => {
    draw({ series: three, toggleSeries: true })
    const buttons = within(legendOf()).getAllByRole('button')
    expect(buttons).toHaveLength(3)
    buttons.forEach(button => {
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })
    expect(buttons[1]).toHaveAccessibleName('Delivery')
    expect(buttons[1].querySelector('.odc-chart-swatch')).toHaveAttribute('aria-hidden', 'true')
  })

  it('hides a series on click and shows it again on the next one, leaving the other datasets alone', async () => {
    draw({ series: three, toggleSeries: true })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    expect(hiddenOf()).toEqual([false, false, false])
    const [completed, delivery] = within(legendOf()).getAllByRole('button')
    fireEvent.click(completed)
    expect(completed).toHaveAttribute('aria-pressed', 'false')
    expect(delivery).toHaveAttribute('aria-pressed', 'true')
    expect(hiddenOf()).toEqual([true, false, false])
    fireEvent.click(completed)
    expect(completed).toHaveAttribute('aria-pressed', 'true')
    expect(hiddenOf()).toEqual([false, false, false])
  })

  it('rescales the duration step to the series left visible', async () => {
    draw({ series: three, toggleSeries: true, durationTicks: true })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    expect(runtime.line.options.scales.y.ticks.stepSize).toBe(172800) // 600000 s: days
    fireEvent.click(within(legendOf()).getAllByRole('button')[0])
    expect(runtime.line.options.scales.y.ticks.stepSize).toBe(10) // 60 s left: 10 s
  })

  it('keeps every series in the alternative table and the tooltip index while one is hidden', async () => {
    draw({ series: three, toggleSeries: true })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    fireEvent.click(within(legendOf()).getAllByRole('button')[0])
    const table = screen.getByRole('figure').querySelector('table')
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Day', 'Completed', 'Delivery', 'Pick up'])
    expect(runtime.line.options.plugins.tooltip.callbacks.label({ datasetIndex: 2, dataIndex: 0, dataset: { label: 'Pick up' }, parsed: { y: 30 } })).toBe('Pick up: $30.00')
  })

  it('keeps the slot colors of the series when one is hidden', async () => {
    draw({ series: three, toggleSeries: true })
    await waitFor(() => expect(runtime.line).not.toBeNull())
    fireEvent.click(within(legendOf()).getAllByRole('button')[0])
    expect(runtime.line.data.datasets.map(dataset => dataset.borderColor)).toEqual([LIGHT['--od-x-chart-1'], LIGHT['--od-x-chart-2'], LIGHT['--od-x-chart-3']])
  })

  it('works for bars too, and with a comparison series', async () => {
    draw({ type: 'bar', series: [sales, previous], toggleSeries: true })
    await waitFor(() => expect(runtime.bar).not.toBeNull())
    fireEvent.click(within(legendOf()).getByRole('button', { name: 'Previous period' }))
    expect(runtime.bar.data.datasets.map(dataset => dataset.hidden)).toEqual([false, true])
  })

  it('paints no legend (and so no buttons) with a single series, as without the prop', () => {
    draw({ toggleSeries: true })
    expect(legendOf()).toBeNull()
  })
})

describe('Product Chart · motion', () => {
  it('turns the animation off under prefers-reduced-motion: reduce', async () => {
    reducedMotion = true
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    expect(runtime.line.options.animation).toBe(false)
  })

  it('leaves the animation to Chart.js otherwise', async () => {
    draw()
    await waitFor(() => expect(runtime.line).not.toBeNull())
    expect(runtime.line.options.animation).toBeUndefined()
  })
})

describe('Product Chart · empty', () => {
  it('paints the box with nothing inside when every series is empty', () => {
    draw({ series: [{ id: 'sales', label: 'Sales', data: [] }], labels: [] })
    const figure = screen.getByRole('figure')
    expect(figure.querySelector('.odc-chart-plot')).not.toBeNull()
    expect(screen.queryByTestId('line-chart')).toBeNull()
    expect(figure.querySelector('.odc-chart-plot').childNodes).toHaveLength(0)
    expect(figure.querySelector('.odc-chart-legend')).toBeNull()
    expect(figure).toHaveAttribute('data-empty')
  })
})

describe('chart.css', () => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const ruleOf = selector => clean.match(new RegExp(`(?:^|\\})\\s*${selector.replace(/[.[\]'=-]/g, '\\$&')}\\s*\\{([^{}]*)\\}`))?.[1]

  it('sizes the box by data-size with the height tokens', () => {
    expect(ruleOf('.odc-chart')).toMatch(/var\(--od-x-chart-height\)/)
    expect(ruleOf(".odc-chart[data-size='compact']")).toMatch(/var\(--od-x-chart-height-compact\)/)
    expect(ruleOf('.odc-chart')).toMatch(/min-inline-size:\s*0/)
  })

  it('draws the legend with tokens and the dashed comparison swatch', () => {
    expect(ruleOf('.odc-chart-legend')).toMatch(/gap:\s*var\(--od-/)
    expect(clean).toMatch(/border-block-start:\s*var\(--od-x-chart-line-width\)\s+dashed\s+var\(--od-x-chart-comparison\)/)
    expect(clean).toMatch(/--od-text-muted/)
    expect(clean).toMatch(/--od-x-type-caption-size/)
  })

  // redesign the toggle button of a legend entry, with tokens, a visible focus and the 44px target
  it('draws the toggle legend button with tokens: ring, 44px on a coarse pointer or below 768px, dimmed and struck through when off', () => {
    const button = ruleOf('.odc-chart-legend-button')
    expect(button).toMatch(/background:\s*none|background:\s*transparent/)
    expect(button).toMatch(/color:\s*inherit/)
    expect(clean).toMatch(/\.odc-chart-legend-button:focus-visible\s*\{[^}]*var\(--od-focus-ring-width\)[^}]*var\(--od-focus-ring-color\)/)
    expect(clean).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*\.odc-chart-legend-button\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    expect(clean).toMatch(/\.odc-chart-legend-button\[aria-pressed='false'\][^{]*\{[^}]*line-through/)
    expect(clean).toMatch(/\.odc-chart-legend-button\[aria-pressed='false'\][^{]*\{[^}]*var\(--od-x-text-subtle\)/)
  })

  // with a fine pointer the toggle button is 24px tall at least (WCAG 2.5.8); the dot and the text keep their size
  it('gives the toggle legend button the 24px target of a fine pointer, outside the media query', () => {
    const button = ruleOf('.odc-chart-legend-button')
    expect(button).toMatch(/min-block-size:\s*var\(--od-x-target-fine\)/)
    expect(button).toMatch(/align-items:\s*center/)
    expect(button).not.toMatch(/\b(?:font-size|line-height)\s*:/)
    expect(clean.indexOf('--od-x-target-fine')).toBeLessThan(clean.indexOf('@media (pointer: coarse)'))
  })

  // (B3): the sized canvas cannot hold its container wide, and the box clips what Chart.js has not redrawn yet
  it('keeps the canvas out of the flow of the plot box and clips the box, so a shrinking viewport narrows it', () => {
    const plot = ruleOf('.odc-chart-plot')
    expect(plot).toMatch(/min-inline-size:\s*0/)
    expect(plot).toMatch(/overflow:\s*hidden/)
    expect(ruleOf('.odc-chart-plot > canvas')).toMatch(/position:\s*absolute/)
  })

  it('assigns each slot its token', () => {
    for (const slot of [1, 2, 3, 4, 5, 6]) {
      expect(clean).toContain(`var(--od-x-chart-${slot})`)
    }
  })
})
