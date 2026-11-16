import React, { useState } from 'react'
import { Chart } from 'chart.js'
import { ThemeProvider, useTheme } from 'styled-components'

// redesign home F3: the Product wrappers of the new Home read the --od-x-* candidates, which the app loads from src/index.js
import '../../../src/brand/candidates.css'

import { InfoShareContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/InfoShareContext'
import { ProjectContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/ProjectContext'
import { HomePage } from '../../../src/@/components-dashboard/src/ui/src/components/Home/HomePage'
import { HOME_API_ROOT } from './home-page-language'

// redesign home F3: the chart is drawn by P/Chart (a canvas with a theme read from --od-x-chart-*). The probe also lists every string
// of the options and datasets that still holds a CSS `var(`, which a canvas cannot resolve.
const cssVariables = (value, path = 'chart', seen = new Set()) => {
  if (typeof value === 'string') return value.includes('var(') ? [path] : []
  if (!value || typeof value !== 'object' || typeof value === 'function' || seen.has(value)) return []
  seen.add(value)
  return Object.entries(value).flatMap(([key, child]) => cssVariables(child, `${path}.${key}`, seen))
}
window.__OD_HOME_CHART__ = () => {
  const canvas = document.querySelector('canvas')
  const chart = canvas && Chart.getChart(canvas)
  return chart
    ? {
        animationsDisabled: chart.options.animation === false,
        labels: chart.data.labels,
        datasets: chart.data.datasets.map(dataset => ({ label: dataset.label, data: dataset.data, borderColor: dataset.borderColor, borderDash: dataset.borderDash })),
        data: chart.data.datasets[0].data,
        borderColor: chart.data.datasets[0].borderColor,
        axisType: chart.options.scales.x.type,
        tickColors: [chart.options.scales.x.ticks.color, chart.options.scales.y.ticks.color],
        tickFont: chart.options.scales.x.ticks.font?.family ?? Chart.defaults.font.family,
        cssVariables: [...cssVariables(chart.options, 'options'), ...cssVariables(chart.data, 'data')]
      }
    : null
}

// redesign home F3: the fake API of the real Home controller. It answers by the same paths the controller requests and logs each one
// in `__OD_HOME_REQUESTS__`. The clock of the spec is 2026-09-15 00:00 in UTC, so the windows are fixed:
// today 2026-09-15, same weekday last week 2026-09-08, trend 2026-08-16..2026-09-14, previous 2026-07-17..2026-08-15.
// `data=empty` is a project without sales or orders (the setup guide asks for stores, payment methods and drivers).
const apiAnswer = (path, params, empty) => {
  const lapse = params.get('lapse')
  const rows = (time, key, values) => values.map((value, index) => ({ time: `${time[index]}`, [key]: value }))
  if (path === '/reports/sales' || path === '/reports/orders') {
    const key = path.endsWith('sales') ? 'sales' : 'orders'
    if (lapse === 'today') return empty ? [] : rows(['2026-09-15 00:00:00', '2026-09-15 00:00:00'], key, key === 'sales' ? [734.5, 500] : [10, 7])
    if (lapse === '2026-09-08,2026-09-08') return rows(['2026-09-08 00:00:00', '2026-09-08 05:00:00'], key, key === 'sales' ? [100, 200] : [2, 3])
    if (lapse === '2026-08-16,2026-09-14') return empty ? [] : rows(['2026-08-20 00:00:00', '2026-09-01 00:00:00', '2026-09-08 00:00:00', '2026-09-14 00:00:00'], key, [80, 120, 240.5, 360])
    if (lapse === '2026-07-17,2026-08-15') return empty ? [] : rows(['2026-07-20 00:00:00', '2026-08-10 00:00:00'], key, [200, 400.5])
    return []
  }
  if (path === '/reports/orders_status') return lapse === 'today' ? [{ status: 1, orders: 15 }, { status: 2, orders: 2 }] : [{ status: 1, orders: 4 }, { status: 2, orders: 1 }]
  if (path === '/business') return [{ id: 1, name: 'Fixture store', enabled: true, menus_count: 1, zones: [] }]
  if (/^\/business\/\d+\/paymethods$/.test(path)) return [{ id: 1, enabled: false }]
  return []
}
const attentionTotals = { pending: 4, late: 2, waitingDriver: 5, failedCarts: 6 }
const attentionKey = (path, params) => {
  if (path === '/carts/dashboard') return 'failedCarts'
  const where = JSON.parse(params.get('where') || '{}')
  const attributes = (where.conditions || []).map(condition => condition.attribute)
  if (attributes.includes('time_status')) return 'late'
  if (attributes.includes('driver_id')) return 'waitingDriver'
  return 'pending'
}
const installFakeApi = () => {
  const realFetch = window.fetch.bind(window)
  const empty = new URLSearchParams(window.location.search).get('data') === 'empty'
  window.__OD_HOME_REQUESTS__ = []
  window.fetch = (input, init) => {
    const href = String(input?.url ?? input)
    if (!href.startsWith(HOME_API_ROOT)) return realFetch(input, init)
    const url = new URL(href)
    const path = url.pathname.slice(new URL(HOME_API_ROOT).pathname.length)
    window.__OD_HOME_REQUESTS__.push(`${path}${url.search}`)
    let body
    if (path === '/orders' || path === '/carts/dashboard') {
      body = { error: false, result: [], pagination: { total: empty ? 0 : attentionTotals[attentionKey(path, url.searchParams)] } }
    } else if (path === '/users') {
      body = { error: false, result: [], pagination: { total: 0 } }
    } else {
      body = { error: false, result: apiAnswer(path, url.searchParams, empty) }
    }
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }
}
installFakeApi()

const projectFor = status => {
  if (status === 'loading') return { loading: true, project: {}, plan: null, websiteProduct: null }
  if (status === 'none') return { loading: false, project: { id: 91, code: 'fixture-home' }, plan: { id: 3 }, websiteProduct: 'web_marketplace_26' }
  return {
    loading: false,
    project: {
      id: 91,
      code: 'fixture-home',
      current_status: status,
      ...(status === 'past_due' ? { project_current_status_until: '2026-09-18T00:00:00Z', current_status_until: '2026-09-18T00:00:00Z' } : {})
    },
    plan: { id: 3 },
    // main's ProjectContext derives this from subscriptions; the Visit button stays disabled without it.
    websiteProduct: 'web_marketplace_26'
  }
}

export const HomePageFixture = () => {
  const query = new URLSearchParams(window.location.search)
  const theme = useTheme()
  const [isCollapse, setIsCollapse] = useState(query.get('collapsed') === '1')
  const [collapseCalls, setCollapseCalls] = useState([])
  const handleMenuCollapse = value => {
    setIsCollapse(value)
    setCollapseCalls(current => [...current, value])
  }
  const status = query.get('status') || 'active'
  // redesign home F3: the status illustration images are gone from Home, so the fixture theme is the harness theme
  const fixtureTheme = theme
  return (
    <ThemeProvider theme={fixtureTheme}>
      <InfoShareContext.Provider value={[{ isCollapse }, { handleMenuCollapse }]}>
        <ProjectContext.Provider value={[projectFor(status), { getProjectStatus: () => {} }]}>
          <main data-testid='home-page-fixture' style={{ background: fixtureTheme.ordering?.semantic?.background, color: fixtureTheme.ordering?.semantic?.text?.default, minWidth: 0 }}>
            <HomePage disableSupportModule={query.get('disableSupport') === '1'} />
            <output data-testid='home-collapse-state'>{String(isCollapse)}</output>
            <output data-testid='home-collapse-calls'>{JSON.stringify(collapseCalls)}</output>
          </main>
        </ProjectContext.Provider>
      </InfoShareContext.Provider>
    </ThemeProvider>
  )
}
