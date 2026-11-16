/* eslint-disable import/first */
// redesign the two consumers that draw several series pass `toggleSeries` to P/Chart, so a click on a legend entry
// hides that series (the native legend of `main` did). Home and Business keep their static legend: this file does not touch them.
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ line: null }))
vi.mock('react-chartjs-2', () => ({
  Line: props => { runtime.line = props; return <canvas data-testid='line-chart' aria-label={props['aria-label']} /> },
  Bar: props => { runtime.line = props; return <canvas data-testid='bar-chart' aria-label={props['aria-label']} /> }
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text]
}))

import { DriverChartCard } from '../../../BusinessIntelligence/DriverAnalytics/DriverChartCard'
import { SeriesChart } from '../../../BusinessIntelligence/Reports/ReportCharts'

const TOKENS = { '--od-x-chart-1': 'rgb(38, 109, 240)', '--od-x-chart-2': 'rgb(255, 148, 24)' }
const series = [
  { id: 'completed', label: 'Completed', data: [600000, 500000] },
  { id: 'delivery', label: 'Delivery', data: [60, 50] }
]
const labels = ['10 Sep', '11 Sep']

beforeEach(() => {
  runtime.line = null
  vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ getPropertyValue: name => TOKENS[name] ?? '' }))
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete window.matchMedia
})

describe('the legend of the multi-series charts hides a series on click', () => {
  it('Times of /intelligence/drivers (DriverChartCard)', async () => {
    render(
      <DriverChartCard
        title='Times' block={{ loading: false, error: null }} empty={false} labels={labels} series={series}
        formatValue={value => `${value} s`} xHeader='Date' fileName='times' header={['Date']} rows={[]} durationTicks
      />
    )
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const legend = screen.getByRole('figure').querySelector('.odc-chart-legend')
    const completed = within(legend).getByRole('button', { name: 'Completed' })
    expect(completed).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(completed)
    expect(completed).toHaveAttribute('aria-pressed', 'false')
    expect(runtime.line.data.datasets.map(dataset => dataset.hidden)).toEqual([true, false])
    // the step follows the series left: 60 s are 10 s steps, not the days of «Completed»
    expect(runtime.line.options.scales.y.ticks.stepSize).toBe(10)
  })

  it('the charts of the reports (SeriesChart)', async () => {
    render(<SeriesChart type='line' title='Orders' xHeader='Date' labels={labels} series={series} formatValue={String} />)
    await waitFor(() => expect(runtime.line).not.toBeNull())
    const legend = screen.getByRole('figure').querySelector('.odc-chart-legend')
    fireEvent.click(within(legend).getByRole('button', { name: 'Delivery' }))
    expect(runtime.line.data.datasets.map(dataset => dataset.hidden)).toEqual([false, true])
  })
})
