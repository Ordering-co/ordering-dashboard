/* eslint-disable import/first */
// redesign ecommerce FC (D6, D7; C4): the card of one kind of click of /intelligence/ecommerce_reports. It paints the rows it is given
// (`clickRows` sorts them): a title per type, the figures, the top 10 in a `BarList` with «Show all N» (no chart and no «Expand»: n.º 20, P1),
// one CSV, and the states of the block. `P/Chart` stays a stand-in so that a chart that came back would be seen.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ charts: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text]
}))
vi.mock('../../../Shared/Product/Chart', () => ({
  Chart: (props) => {
    runtime.charts.push(props)
    return <div data-testid='chart' data-type={props.type} data-size={props.size} data-label={props.label}>{props.labels.join('|')}</div>
  }
}))
vi.mock('../../../../../../utils/businessReports', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadCsv: vi.fn()
}))

import { downloadCsv } from '../../../../../../utils/businessReports'
import { clickRows } from '../../../../../../utils/clicksReport'
import { ClicksCard } from '../ClicksCard'

// 12 stores in the order the API sends them (not sorted), two of them with the same name and different ids
const store = (id, name, total) => ({ object_id: id, name, total })
const BUSINESS = [
  store(1, 'Alpha Pizza', '10'),
  store(2, 'Beta Burgers', '50'),
  store(3, 'Gamma Grill', '30'),
  store(4, 'Beta Burgers', '50'),
  store(5, 'Delta Deli', 5),
  store(6, 'Epsilon', 4),
  store(7, 'Zeta', 3),
  store(8, 'Eta', 2),
  store(9, 'Theta', 1),
  store(10, 'Iota', 9),
  store(11, 'Kappa', 8),
  store(12, 'Lambda', 7)
]
const rowsOf = (list = BUSINESS, type = 'Business') => clickRows({ click: { [type]: list } }, type)
const SORTED = ['Beta Burgers', 'Beta Burgers', 'Gamma Grill', 'Alpha Pizza', 'Iota', 'Kappa', 'Lambda', 'Delta Deli', 'Epsilon', 'Zeta', 'Eta', 'Theta']

const renderCard = (props = {}) => {
  const onRetry = vi.fn()
  const view = render(<ClicksCard type='Business' rows={rowsOf()} loading={false} updating={false} error={null} onRetry={onRetry} {...props} />)
  return { onRetry, ...view }
}
const card = (name) => screen.getByRole('region', { name })
const normal = (node) => node.textContent.replace(/\s+/g, ' ').trim()

beforeEach(() => {
  vi.clearAllMocks()
  runtime.charts = []
  delete window.matchMedia
})
afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('the title and the figures', () => {
  it.each([
    ['Business', 'Clicks on stores'],
    ['Product', 'Clicks on products'],
    ['Category', 'Clicks on categories']
  ])('%s is the card «%s», a section named by its h2', (type, title) => {
    renderCard({ type, rows: rowsOf([store(1, 'A', 4)], type) })
    expect(within(card(title)).getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
  })

  it('says the total of clicks and how many rows are in the list, both as figures', () => {
    renderCard()
    const summary = card('Clicks on stores').querySelector('.odc-ec-clicks-summary')
    // 50 + 50 + 30 + 10 + 9 + 8 + 7 + 5 + 4 + 3 + 2 + 1
    expect(normal(summary)).toBe('179 clicks · 12 in the list')
    expect(summary.querySelectorAll('.odc-figure')).toHaveLength(2)
  })
})

describe('the top 10 and «Show all N» (n.º 20, P1)', () => {
  const topTable = () => within(card('Clicks on stores')).getByRole('table', { name: /^(Top 10|All): Clicks on stores$/ })
  const bodyRows = () => within(topTable()).getAllByRole('row').slice(1)
  const names = () => bodyRows().map(row => within(row).getByRole('rowheader').textContent)

  it('draws no chart: the top 10 is the only view of the rows', () => {
    renderCard()
    expect(within(card('Clicks on stores')).queryByTestId('chart')).toBeNull()
    expect(runtime.charts).toEqual([])
  })

  it('lists the first 10 in a table «Top 10», keeping both stores with the same name', () => {
    renderCard()
    const region = card('Clicks on stores')
    expect(within(region).getByRole('heading', { level: 3, name: 'Top 10' })).toBeInTheDocument()
    const table = within(region).getByRole('table', { name: 'Top 10: Clicks on stores' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(10)
    expect(rows.map(row => within(row).getByRole('rowheader').textContent)).toEqual(SORTED.slice(0, 10))
    expect(rows.map(row => within(row).getByRole('cell').textContent)).toEqual(['50', '50', '30', '10', '9', '8', '7', '5', '4', '3'])
    expect(within(table).getByRole('columnheader', { name: 'Clicks' })).toBeInTheDocument()
  })

  it('«Show all 12» reveals every row, in place and in the same order, and «Show less» goes back to the top 10', async () => {
    renderCard()
    const region = card('Clicks on stores')
    const button = within(region).getByRole('button', { name: 'Show all 12' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(names()).toEqual(SORTED)
    expect(within(region).queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(region).queryByRole('heading', { level: 3, name: 'Top 10' })).toBeNull()
    const less = within(region).getByRole('button', { name: 'Show less' })
    expect(less).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(less)
    expect(names()).toEqual(SORTED.slice(0, 10))
    expect(within(region).getByRole('button', { name: 'Show all 12' })).toBeInTheDocument()
  })

  it('a list of 10 or fewer has nothing more to show: no «Show all»', () => {
    renderCard({ rows: rowsOf(BUSINESS.slice(0, 10)) })
    expect(screen.queryByRole('button', { name: /^Show/ })).toBeNull()
    expect(bodyRows()).toHaveLength(10)
  })

  it('a list of 3 shows 3 rows and no «Show all»', () => {
    renderCard({ rows: rowsOf(BUSINESS.slice(0, 3)) })
    expect(bodyRows()).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /^Show/ })).toBeNull()
  })

  it('«Show all N» is per card and says how many rows the list has', async () => {
    const many = Array.from({ length: 271 }, (_, index) => store(index + 1, `Item ${index + 1}`, index + 1))
    renderCard({ type: 'Product', rows: rowsOf(many, 'Product') })
    const region = card('Clicks on products')
    await userEvent.click(within(region).getByRole('button', { name: 'Show all 271' }))
    expect(within(within(region).getByRole('table')).getAllByRole('row')).toHaveLength(272)
  })
})

describe('«Download CSV» (D7)', () => {
  it('downloads the rows sorted by clicks, with the header of main and a file named after the type', async () => {
    renderCard({ rows: rowsOf(BUSINESS.slice(0, 4)) })
    await userEvent.click(within(card('Clicks on stores')).getByRole('button', { name: 'Download CSV: Clicks on stores' }))
    expect(downloadCsv).toHaveBeenCalledTimes(1)
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^clicks_business_\d+\.csv$/),
      'CLICKS OF BUSINESS, Clicks\nBeta Burgers,50,\nBeta Burgers,50,\nGamma Grill,30,\nAlpha Pizza,10,\n'
    )
  })

  it('names the file after the type and quotes a name with a comma', async () => {
    renderCard({ type: 'Product', rows: rowsOf([store(1, 'Fries, large', 3)], 'Product') })
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV: Clicks on products' }))
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^clicks_product_\d+\.csv$/),
      'CLICKS OF PRODUCT, Clicks\n"Fries, large",3,\n'
    )
  })

  it('is the only download: there is no second button with the same rows', () => {
    renderCard()
    expect(screen.getAllByRole('button', { name: /^Download/ })).toHaveLength(1)
  })
})

describe('no «Expand» (n.º 20, P1)', () => {
  it('has no «Expand» button and opens no dialog: the chart and its enlarged view are gone', () => {
    renderCard()
    expect(screen.queryByRole('button', { name: /^Expand/ })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the states of the block (D10)', () => {
  it('without rows says so, with no top, no «Show all» and the download really disabled', () => {
    renderCard({ rows: [] })
    const region = card('Clicks on stores')
    expect(within(region).getByText('No clicks in this period.')).toBeInTheDocument()
    expect(within(region).queryByRole('table')).toBeNull()
    expect(within(region).queryByRole('button', { name: /^Show/ })).toBeNull()
    expect(within(region).getByRole('button', { name: 'Download CSV: Clicks on stores' })).toBeDisabled()
  })

  it('while it loads shows a skeleton (busy), no data, and the download is disabled', () => {
    renderCard({ loading: true })
    const region = card('Clicks on stores')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(within(region).queryByRole('table')).toBeNull()
    expect(within(region).queryByRole('button', { name: /^Show/ })).toBeNull()
    expect(within(region).getByRole('button', { name: 'Download CSV: Clicks on stores' })).toBeDisabled()
  })

  it('with an error says it for this block only, with «Try again», which retries; the download is disabled', async () => {
    const { onRetry } = renderCard({ error: new Error('boom'), rows: [] })
    const region = card('Clicks on stores')
    expect(within(region).getByText('Clicks on stores could not be loaded.')).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Download CSV: Clicks on stores' })).toBeDisabled()
    await userEvent.click(within(region).getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('while updating keeps the old rows dimmed and busy, and does not download them under the new filters', () => {
    renderCard({ updating: true })
    const region = card('Clicks on stores')
    const body = region.querySelector('.odc-ec-clicks-body')
    expect(body).toHaveAttribute('aria-busy', 'true')
    expect(body).toHaveAttribute('data-stale')
    expect(within(region).getByRole('table', { name: 'Top 10: Clicks on stores' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Download CSV: Clicks on stores' })).toBeDisabled()
  })

  it('when it is not updating the body is neither busy nor dimmed', () => {
    renderCard()
    const body = card('Clicks on stores').querySelector('.odc-ec-clicks-body')
    expect(body).not.toHaveAttribute('aria-busy')
    expect(body).not.toHaveAttribute('data-stale')
  })
})
