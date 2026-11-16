import React, { useId, useMemo, useRef, useState } from 'react'
import { Bar } from 'react-chartjs-2'

import { useLanguage, useUtils } from '../../../../../index'
import { useChartTheme } from '../../Shared/Product/Chart'
import { wallText } from './reportBodyData'
import './report-body.css'

// redesign reports FC2 (D12, D13; RP-04; auditor 11; inventory A 7.D4, 7.D5): the schedule of the drivers (report 7).
// It is the chart of main (BI/ReportsDriverSchedule:45-168): four datasets (Available, Not available, Busy, Not busy) of floating bars on a
// horizontal axis, `indexAxis: 'y'`, the times in seconds from the start of the day. What changes: the four colors are the first four slots of the
// chart palette (decision 36) instead of four hex values, the legend is HTML in text color (each entry hides its series, ), the hours are the ones of the zone of the report (not the
// browser's), the chart is as tall as the number of drivers asks, and a table says the same for who cannot read a canvas.

const TICK_SIZE = 12 // the mark of the dataviz skill for canvas (Chart.jsx MARKS.tickSize)
const SECONDS_PER_HOUR = 3600
const MAX_TICKS = 8
const PALETTE_SLOTS = [1, 2, 3, 4]

const reducedMotion = () => typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)')?.matches === true

/**
 * The timeline of report 7. `model` is `timelineModel(data, zone)` of `reportBodyData.js` (the datasets of floating bars and the start of the day);
 * `filters.timeZone` is the zone the hours are written in. The block above decides the empty state: a day without shifts does not get here.
 */
export const ReportTimeline = ({ model, filters }) => {
  const [, t] = useLanguage()
  const [utils] = useUtils() || []
  const parseDate = utils?.parseDate
  const figureRef = useRef(null)
  const tableId = useId()
  const theme = useChartTheme(figureRef)
  // R3: the indexes of the series the reader hid from the legend, as main's native legend allowed
  const [off, setOff] = useState(() => new Set())
  const toggle = index => setOff(previous => {
    const next = new Set(previous)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    return next
  })

  const zone = filters?.timeZone || 'UTC'
  // one literal t() per name, so the i18n scanner sees every key (the same as main)
  const names = [
    t('AVAILABLE', 'Available'),
    t('NOT_AVAILABLE', 'Not Available'), // redesign reports R1 (P-a): the catalog text of the shared key
    t('BUSY', 'Busy'),
    t('NOT_BUSY', 'Not busy')
  ]

  const at = seconds => wallText(model.base + seconds * 1000)
  const timeOf = seconds => parseDate(at(seconds), { timeOnly: true, utc: false })
  const dateTimeOf = seconds => parseDate(at(seconds), { utc: false })

  const caption = t('ENTERPRISE_REPORT_7_TABLE_CAPTION', 'Driver schedule, _zone_ time').replace('_zone_', () => zone)
  const hoursStep = Math.max(1, Math.ceil(model.maxSeconds / SECONDS_PER_HOUR / MAX_TICKS))

  const chartData = useMemo(() => {
    if (!theme) return null
    return {
      datasets: model.sets.map((points, index) => ({
        label: names[index],
        data: points,
        backgroundColor: theme.colors[index],
        stack: index < 2 ? 'Stack 0' : 'Stack 1',
        // react-chartjs-2 merges the new dataset into the old one, so a shown series says `hidden: false` (as P/Chart does)
        hidden: off.has(index)
      }))
    }
  }, [theme, model, off, ...names])

  const options = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion() ? false : undefined,
    plugins: {
      legend: { display: false }, // the legend is HTML (below), in text color
      tooltip: {
        backgroundColor: theme?.surfaceStrong,
        titleColor: theme?.textInverse,
        bodyColor: theme?.textInverse,
        titleFont: { family: theme?.sans },
        bodyFont: { family: theme?.mono },
        cornerRadius: theme?.radiusControl,
        borderWidth: 0,
        callbacks: {
          title: items => `${items[0].label} - ${items[0].dataset.label}`,
          label: item => `${dateTimeOf(item.raw.x[0])} ~ ${dateTimeOf(item.raw.x[1])}`
        }
      }
    },
    scales: {
      x: {
        stacked: false,
        beginAtZero: true,
        grid: { color: theme?.grid, drawBorder: false },
        ticks: {
          color: theme?.axis,
          font: { size: TICK_SIZE, family: theme?.mono },
          stepSize: hoursStep * SECONDS_PER_HOUR,
          callback: value => timeOf(value)
        }
      },
      y: {
        stacked: false,
        grid: { display: false, drawBorder: false },
        ticks: { color: theme?.axis, font: { size: TICK_SIZE, family: theme?.sans } }
      }
    }
  }), [theme, model, hoursStep, parseDate])

  const rows = model.sets.flatMap((points, index) => points.map(point => ({ driver: point.y, status: names[index], from: point.x[0], to: point.x[1] })))

  return (
    <figure
      ref={figureRef}
      className='odc-chart odc-rp-timeline'
      data-type='bar'
      style={{ '--odc-rp-rows': model.drivers.length }}
    >
      <div className='odc-chart-plot'>
        {chartData && (
          <Bar data={chartData} options={options} role='img' aria-label={caption} aria-describedby={tableId} />
        )}
      </div>
      <ul className='odc-chart-legend'>
        {names.map((name, index) => (
          <li key={PALETTE_SLOTS[index]} className='odc-chart-legend-item'>
            <button
              type='button'
              className='odc-chart-legend-button'
              aria-pressed={!off.has(index)}
              onClick={() => toggle(index)}
            >
              <span className='odc-chart-swatch' data-slot={PALETTE_SLOTS[index]} aria-hidden='true' />
              <span>{name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className='odc-sr-only'>
        <table id={tableId}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope='col'>{t('DRIVER', 'Driver')}</th>
              <th scope='col'>{t('STATUS', 'Status')}</th>
              <th scope='col'>{t('ENTERPRISE_REPORT_7_FROM', 'From')}</th>
              <th scope='col'>{t('ENTERPRISE_REPORT_7_TO', 'To')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <th scope='row'>{row.driver}</th>
                <td>{row.status}</td>
                <td><span className='odc-figure'><bdi>{dateTimeOf(row.from)}</bdi></span></td>
                <td><span className='odc-figure'><bdi>{dateTimeOf(row.to)}</bdi></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
