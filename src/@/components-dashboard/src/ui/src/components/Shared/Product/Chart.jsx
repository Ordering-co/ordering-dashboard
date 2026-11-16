import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Chart as ChartJS } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

import { cx } from './classNames'
import './product.css'
import './chart.css'

// redesign home FA (D8, decisión 36): trend chart for the dashboard on react-chartjs-2, with one theme resolved from the
// --od-x-chart-* tokens. Import it by file (Shared/Product/Chart): it is not in the barrel because it pulls Chart.js
// (~200 KB) into every page that imports the barrel. Loading and error states belong to the consumer.

const TYPES = ['line', 'bar']
const SLOTS = 6 // --od-x-chart-1 … --od-x-chart-6: more series is «Other» or small multiples, never an invented color
const SLOT_TOKENS = Array.from({ length: SLOTS }, (_, index) => `--od-x-chart-${index + 1}`)
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const COLOR_SCHEME = '(prefers-color-scheme: dark)'

// Marks of the dataviz skill (the values the brief fixes for canvas, which has no CSS): not colors, not CSS lengths.
const MARKS = {
  dash: [4, 4], // the comparison series
  hoverRadius: 4,
  barRadius: 4,
  barGap: 2,
  tickSize: 12,
  maxTicks: 7,
  // an X label wider than its share of the axis is cut with «…» (the tooltip and the table keep it whole).
  // The width of a character is estimated as 0.6 of the tick size, with `tickGap` px kept free between two labels; a cut
  // label keeps at least `minTickChars`.
  tickCharWidth: 0.6,
  tickGap: 8,
  minTickChars: 6,
  // (B5): a label of at most this many characters (an hour, a date) is never cut: when it does not fit, the axis draws fewer ticks
  wholeTickChars: 10,
  // redesign px kept free between two labels of the X axis before the callback skips some of them (half
  // of `tickGap`: the estimate of a character is a little wide for digits and dashes, so a date still has air around it)
  skipGap: 4,
  // redesign (row 72 Q-08): `durationTicks` keeps at most this many intervals on the Y axis
  durationIntervals: 6
}

// redesign (row 72 Q-08): the steps of a duration axis, in seconds: 1/2/5/10/15/30 s, 1/2/5/10/15/30 min and 1/2/3/6/12 h.
// Beyond 12 h the step goes by days (1, 2, 5, 10, 20, 50 … days).
const DURATION_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200]
const DAY = 86400

/**
 * The smallest human duration step (seconds) that covers `span` seconds in at most `MARKS.durationIntervals` intervals.
 * redesign a span of 0 (every time empty, e.g. «Today» before any order is delivered) takes the smallest
 * step: with none, Chart.js drew decimal ticks that the duration format rounded to «0 s / 1 s» over and over.
 */
const durationStepFor = span => {
  if (!Number.isFinite(span) || span < 0) return undefined
  if (span === 0) return DURATION_STEPS[0]
  const fits = step => span / step <= MARKS.durationIntervals
  const step = DURATION_STEPS.find(fits)
  if (step) return step
  for (let days = 1; ; days *= 10) {
    const found = [1, 2, 5].map(factor => factor * days * DAY).find(fits)
    if (found) return found
  }
}

/** The span of the data on a Y axis that includes zero, over every series (the comparison too); empty points are skipped. */
const spanOf = series => {
  let min = 0
  let max = 0
  series.forEach(item => (item.data || []).forEach(value => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    if (value > max) max = value
    if (value < min) min = value
  }))
  return max - min
}

const charWidth = MARKS.tickSize * MARKS.tickCharWidth

/** The characters of an X label that fit in `room` pixels (never fewer than `MARKS.minTickChars`). */
const charsThatFit = room => Math.max(MARKS.minTickChars, Math.floor((room - MARKS.tickGap) / charWidth))

// «12:00», «12:00 PM», «12:00:00 p. m.»: a time reads whole however many characters it has
const TIME_LABEL = /^\d{1,2}:\d{2}(:\d{2})?[\s\u202f\u00a0]*([ap]\.?[\s\u202f\u00a0]?m\.?)?$/i

/**
 * (B5): whether an X label is kept whole, never cut with «…». A short label (an hour, a date: at most
 * `MARKS.wholeTickChars` characters) or a time says its meaning only in full («12:00 P…» says nothing); only a long label
 * (a name) is cut to its room.
 */
const isWhole = label => typeof label === 'string' && (label.length <= MARKS.wholeTickChars || TIME_LABEL.test(label))

/** An X label for the axis, cut with «…» when it is a long one and is longer than the characters that fit in `room` pixels. */
const axisLabel = (label, room) => {
  if (typeof label !== 'string' || !(room > 0) || isWhole(label)) return label
  const fits = charsThatFit(room)
  if (label.length <= fits) return label
  return `${label.slice(0, fits - 1).trimEnd()}…`
}

/**
 * redesign the width of the X axis. The scale's own width already leaves out the Y axis (Chart.js lays the
 * vertical axes out first); the chart area and the whole chart are the fallbacks while the scale has none (and in a test double).
 */
const axisWidth = scale => [scale?.width, scale?.maxWidth, scale?.chart?.chartArea?.width, scale?.chart?.width]
  .find(width => typeof width === 'number' && width > 0)

/**
 * redesign how many labels of the X axis fit side by side in `width` pixels, at most `MARKS.maxTicks`.
 * `maxTicksLimit` makes Chart.js skip by count and ignore the size of the labels, so a wide Y axis left a narrow X axis with the
 * same 7 dates and they overlapped. A label is cut to its room (see `axisLabel`), so only what the cut cannot shorten (the
 * `MARKS.minTickChars` floor) forces fewer labels. Without a width every label counts, as before.
 */
const ticksThatFit = (labels, width) => {
  const most = Math.min(labels.length, MARKS.maxTicks) || 1
  if (!(width > 0)) return most
  // (B5): the whole labels (short ones, times) are never cut, so their full length needs room; a long one needs what its cut leaves
  let whole = 0
  let cut = 0
  labels.forEach(label => {
    const length = String(label ?? '').length
    if (isWhole(label == null ? '' : String(label))) whole = Math.max(whole, length)
    else cut = Math.max(cut, length)
  })
  for (let count = most; count > 1; count--) {
    const room = width / count
    const chars = Math.max(whole, Math.min(cut, charsThatFit(room)))
    if (chars * charWidth + MARKS.skipGap <= room + 1e-6) return count
  }
  return 1
}

/** The step of an X axis that shows `fit` of `count` labels: every label (1) or every `step`-th one. */
const skipStep = (count, fit) => (fit < (Math.min(count, MARKS.maxTicks) || 1) ? Math.ceil(count / fit) : 1)

/**
 * whether `axisLabels` is a compact form `Chart` can use: one entry per label, each a string or an array of strings (the
 * lines of the label). Anything else is ignored and the axis is as it was.
 */
const isCompactAxis = (axisLabels, labels) => Array.isArray(axisLabels) && axisLabels.length === labels.length &&
  axisLabels.every(entry => typeof entry === 'string' || (Array.isArray(entry) && entry.every(line => typeof line === 'string')))

const linesOf = entry => (Array.isArray(entry) ? entry : [entry])

/**
 * like `ticksThatFit` for the compact form. No line is ever cut, so the longest line of every entry needs its room, and
 * when they do not fit side by side fewer marks are drawn. Without a width every mark counts.
 */
const compactTicksThatFit = (axisLabels, width) => {
  const most = Math.min(axisLabels.length, MARKS.maxTicks) || 1
  if (!(width > 0)) return most
  const longest = axisLabels.reduce((chars, entry) => Math.max(chars, ...linesOf(entry).map(line => line.length)), 0)
  for (let count = most; count > 1; count--) {
    if (longest * charWidth + MARKS.skipGap <= width / count + 1e-6) return count
  }
  return 1
}

/** whether some label that the axis would draw (the multiples of `step`) is cut with «…» in `room` pixels. */
const anyCut = (labels, step, room) => labels.some((label, index) => index % step === 0 && axisLabel(label, room) !== label)

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

// Subscribes to a media query. A matchMedia that answers nothing (a test double) reads as «no match».
const watchMedia = (query, listener) => {
  if (!canMatch()) return () => {}
  const media = window.matchMedia(query)
  if (!media) return () => {}
  if (media.addEventListener) {
    media.addEventListener('change', listener)
    return () => media.removeEventListener?.('change', listener)
  }
  media.addListener?.(listener) // old engines
  return () => media.removeListener?.(listener)
}

const usePrefersReducedMotion = () => useSyncExternalStore(
  listener => watchMedia(REDUCED_MOTION, listener),
  () => canMatch() && window.matchMedia(REDUCED_MOTION)?.matches === true,
  () => false
)

// An empty value (jsdom, or a token that does not exist) stays undefined so Chart.js keeps its own default.
const readToken = (style, name) => style.getPropertyValue(name).trim() || undefined

/** The theme canvas needs, as the resolved values of the tokens (canvas cannot read `var()`). */
export const readChartTheme = node => {
  const style = window.getComputedStyle(node)
  const width = parseFloat(readToken(style, '--od-x-chart-line-width'))
  const radius = parseFloat(readToken(style, '--od-radius-control'))
  return {
    colors: SLOT_TOKENS.map(name => readToken(style, name)),
    comparison: readToken(style, '--od-x-chart-comparison'),
    grid: readToken(style, '--od-x-chart-grid'),
    axis: readToken(style, '--od-x-chart-axis'),
    lineWidth: Number.isFinite(width) ? width : undefined,
    sans: readToken(style, '--od-font-sans'),
    mono: readToken(style, '--od-font-mono'),
    // redesign home R1 (Q-09, review P3): the tooltip, themed from the tokens (canvas cannot read `var()`)
    surfaceStrong: readToken(style, '--od-surface-strong'),
    textInverse: readToken(style, '--od-text-inverse'),
    radiusControl: Number.isFinite(radius) ? radius : undefined
  }
}

const sameTheme = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)

/**
 * Resolves the chart theme from the node's computed style and reads it again when the brand theme changes:
 * `data-od-theme` on the root or on the nearest `[data-ordering-brand]` ancestor, or `prefers-color-scheme`.
 * Returns `null` until the first read (before paint), then the theme.
 */
export const useChartTheme = ref => {
  const [theme, setTheme] = useState(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const sync = () => setTheme(previous => {
      const next = readChartTheme(node)
      return previous && sameTheme(previous, next) ? previous : next
    })
    sync()
    let observer = null
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(sync)
      const scope = node.closest?.('[data-ordering-brand]')
      const targets = [document.documentElement, scope].filter((target, index, all) => target && all.indexOf(target) === index)
      targets.forEach(target => observer.observe(target, { attributes: true, attributeFilter: ['data-od-theme'] }))
    }
    const unwatch = watchMedia(COLOR_SCHEME, sync)
    return () => {
      observer?.disconnect()
      unwatch()
    }
  }, [ref])
  return theme
}

/**
 * (B3): Chart.js keeps the size it measured and only redraws when its own observer fires; on a live change of viewport
 * (1440 -> 390) the canvas kept its old width and spilled out of the card. This watches the plot box (the element that always
 * follows its card) and asks the chart to measure again whenever the box changes. Where there is no ResizeObserver nothing changes.
 */
const useFollowBox = boxRef => {
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver !== 'function') return undefined
    // the instance is found by its canvas (not by a ref to the component, which the test doubles of react-chartjs-2 do not take)
    const observer = new ResizeObserver(() => ChartJS.getChart(box.querySelector('canvas'))?.resize())
    observer.observe(box)
    return () => observer.disconnect()
  }, [boxRef])
}

const assertProps = ({ type, label, table, series }) => {
  if (label == null) throw new Error('Chart needs a label: the accessible name of the chart')
  if (table?.caption == null || table?.xHeader == null) throw new Error('Chart needs table.caption and table.xHeader: the alternative table is part of the chart')
  if (!TYPES.includes(type)) throw new Error(`Unknown chart type: ${type}`)
  if (series.filter(item => !item.comparison).length > SLOTS) throw new Error(`Chart takes ${SLOTS} series at most: a seventh is «Other» or small multiples, never a new color`)
}

const buildDataset = (type, serie, color, theme, hidden) => {
  const common = { label: serie.label, data: serie.data, borderDash: serie.comparison ? MARKS.dash : undefined }
  // redesign only with `toggleSeries` (`hidden` undefined otherwise). react-chartjs-2 merges the new dataset
  // into the old one, so a shown series must say `hidden: false` or it would keep the `true` of the click before.
  if (hidden !== undefined) common.hidden = hidden
  if (type === 'bar') {
    return { ...common, backgroundColor: color, borderRadius: MARKS.barRadius, inflateAmount: -MARKS.barGap / 2 }
  }
  return {
    ...common,
    borderColor: color,
    backgroundColor: color,
    borderWidth: theme.lineWidth,
    cubicInterpolationMode: 'monotone', // HM-15: never dips below zero between days with data
    fill: false,
    pointRadius: 0,
    pointHoverRadius: MARKS.hoverRadius,
    pointHoverBackgroundColor: color
  }
}

// redesign home R1 (Q-08, review P2): a series may carry its own X labels (`labels`), e.g. the days of a previous period
const hasOwnLabels = item => Array.isArray(item.labels) && item.labels.length > 0

const ChartTable = ({ id, table, labels, series, show }) => (
  <table id={id}>
    <caption>{table.caption}</caption>
    <thead>
      <tr>
        <th scope='col'>{table.xHeader}</th>
        {series.map(item => (
          <React.Fragment key={item.id}>
            {hasOwnLabels(item) && <th scope='col'>{`${item.label} · ${table.xHeader}`}</th>}
            <th scope='col'>{item.label}</th>
          </React.Fragment>
        ))}
      </tr>
    </thead>
    <tbody>
      {labels.map((name, index) => (
        <tr key={`${name}-${index}`}>
          <th scope='row'>{name}</th>
          {series.map(item => (
            <React.Fragment key={item.id}>
              {hasOwnLabels(item) && <td>{item.labels[index]}</td>}
              <td>
                <span className='odc-figure'><bdi>{show(item.data?.[index])}</bdi></span>
              </td>
            </React.Fragment>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)

const LegendEntry = ({ item, slot }) => (
  <>
    <span
      className='odc-chart-swatch'
      data-slot={slot ?? undefined}
      data-comparison={item.comparison ? '' : undefined}
      aria-hidden='true'
    />
    <span>{item.label}</span>
  </>
)

/**
 * Line or bar chart. Colors come from the slot by the order of the non-comparison series (never cycled), the comparison
 * series is the neutral dashed one. `labels` arrive already formatted by the consumer (`parseDate`, never ISO) and
 * `formatValue` formats the Y axis, the tooltip and the table. The data table is always in the DOM, visually hidden.
 * A series may bring its own `labels` (already formatted, one per point): the tooltip row then says that day
 * («23-08 · Previous 30 days: $ 0.00») and the table gets a date column for it.
 * `durationTicks` (opt-in, for a Y axis in seconds): the Y step snaps to a human duration step (15 s, 5 min, 2 h …) from the data
 * range, instead of the «nice» decimals of Chart.js (1 min 23 s). Without it the axis is as it was.
 * `toggleSeries` (opt-in, redesign ): each entry of the legend becomes a button (`aria-pressed`, pressed = visible)
 * that hides or shows its series, and the Y axis rescales to the series left. Without it the legend is static text, as before. The
 * table keeps every series.
 * `axisLabels` (opt-in, ): the compact form of the X axis, an array parallel to `labels` (same length) whose entries are a
 * string or an array of lines (Chart.js draws an array as a label of several lines), e.g. `['Week 41', '14-10 – 20-10']`. It is used
 * only when a label that the axis would draw does not fit and would be cut with «…»: then every mark takes the compact form, no line of
 * it is cut, and fewer marks are drawn when the longest line does not fit. The tooltip and the table keep `labels`. Without it, or with
 * another length, the axis is as it was.
 */
export const Chart = ({
  type = 'line',
  label,
  labels = [],
  series = [],
  formatValue = value => String(value),
  table,
  size = 'default',
  className,
  durationTicks = false,
  toggleSeries = false,
  axisLabels
}) => {
  assertProps({ type, label, table, series })
  const figureRef = useRef(null)
  const plotRef = useRef(null)
  const tableId = useId()
  const theme = useChartTheme(figureRef)
  useFollowBox(plotRef)
  const reducedMotion = usePrefersReducedMotion()

  // redesign ids of the series the reader hid from the legend (only with `toggleSeries`)
  const [off, setOff] = useState(() => new Set())
  const isOff = item => toggleSeries && off.has(item.id)
  const toggle = id => setOff(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const show = value => (value == null ? '' : formatValue(value))
  const empty = series.every(item => !item.data?.length)
  let slot = 0
  const slots = series.map(item => (item.comparison ? null : ++slot))

  const data = useMemo(() => {
    if (!theme) return null
    return {
      labels,
      datasets: series.map((item, index) =>
        buildDataset(type, item, item.comparison ? theme.comparison : theme.colors[slots[index] - 1], theme, toggleSeries ? off.has(item.id) : undefined))
    }
  }, [theme, type, labels, series, toggleSeries, off])

  // redesign (row 72 Q-08): only with `durationTicks`; undefined leaves the step to Chart.js
  // (over the series left visible, so hiding «Completed» rescales the step to the others)
  const durationStep = durationTicks ? durationStepFor(spanOf(series.filter(item => !isOff(item)))) : undefined

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion ? false : undefined,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: theme?.axis,
          font: { size: MARKS.tickSize, family: theme?.sans },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: MARKS.maxTicks,
          // `this` is the scale. redesign the room of a tick is the width of the X axis (not of the
          // chart, which includes a wide Y axis) shared by the ticks that fit. When fewer than `maxTicksLimit` fit, the callback
          // returns `null` for every label that is not a multiple of `step` (Chart.js drops a tick without label before it
          // skips by count), so the dates are skipped instead of printed over each other.
          // with `axisLabels`, when a label that is drawn would be cut, the whole axis takes the compact form (every mark, so
          // the axis reads the same all along); no line of it is cut, fewer marks are drawn when they do not fit.
          callback: function (value, index) {
            const at = typeof value === 'number' ? value : index
            const width = axisWidth(this)
            const fit = ticksThatFit(labels, width)
            const step = skipStep(labels.length, fit)
            const room = width / (step > 1 ? Math.ceil(labels.length / step) : fit)
            if (isCompactAxis(axisLabels, labels) && anyCut(labels, step, room)) {
              const compactStep = skipStep(labels.length, compactTicksThatFit(axisLabels, width))
              if (compactStep > 1 && at % compactStep !== 0) return null
              return axisLabels[at]
            }
            if (step > 1 && at % step !== 0) return null
            return axisLabel(labels[at], room)
          }
        }
      },
      y: {
        beginAtZero: true, // HM-15
        suggestedMin: 0,
        grid: { color: theme?.grid, drawBorder: false },
        ticks: {
          color: theme?.axis,
          font: { size: MARKS.tickSize, family: theme?.mono },
          ...(durationStep ? { stepSize: durationStep } : {}),
          callback: value => show(value)
        }
      }
    },
    plugins: {
      legend: { display: false }, // the legend is HTML (below), in text color
      tooltip: {
        mode: 'index',
        intersect: false,
        // redesign home R1 (Q-09, review P3): the surface, the text, the fonts and the radius of the tokens; no border
        backgroundColor: theme?.surfaceStrong,
        titleColor: theme?.textInverse,
        bodyColor: theme?.textInverse,
        titleFont: { family: theme?.sans },
        bodyFont: { family: theme?.mono },
        cornerRadius: theme?.radiusControl,
        borderWidth: 0,
        callbacks: {
          title: items => items[0]?.label,
          // redesign home R1 (Q-08, review P2): a series with its own labels names its own day
          label: context => {
            const own = series[context.datasetIndex]?.labels?.[context.dataIndex]
            const text = `${context.dataset.label}: ${show(context.parsed?.y)}`
            return own == null || own === '' ? text : `${own} · ${text}`
          }
        }
      }
    }
  }), [theme, reducedMotion, formatValue, series, labels, axisLabels, durationStep])

  const Plot = type === 'bar' ? Bar : Line

  return (
    <figure
      ref={figureRef}
      className={cx('odc-chart', className)}
      data-type={type}
      data-size={size}
      data-empty={empty ? '' : undefined}
    >
      <div ref={plotRef} className='odc-chart-plot'>
        {!empty && data && (
          <Plot
            data={data}
            options={options}
            role='img'
            aria-label={label}
            aria-describedby={tableId}
            fallbackContent={<ChartTable table={table} labels={labels} series={series} show={show} />}
          />
        )}
      </div>
      {!empty && series.length > 1 && (
        <ul className='odc-chart-legend'>
          {series.map((item, index) => (
            <li key={item.id} className='odc-chart-legend-item'>
              {toggleSeries
                ? (
                  <button
                    type='button'
                    className='odc-chart-legend-button'
                    aria-pressed={!isOff(item)}
                    onClick={() => toggle(item.id)}
                  >
                    <LegendEntry item={item} slot={slots[index]} />
                  </button>
                  )
                : <LegendEntry item={item} slot={slots[index]} />}
            </li>
          ))}
        </ul>
      )}
      {!empty && (
        <div className='odc-sr-only'>
          <ChartTable id={tableId} table={table} labels={labels} series={series} show={show} />
        </div>
      )}
    </figure>
  )
}
