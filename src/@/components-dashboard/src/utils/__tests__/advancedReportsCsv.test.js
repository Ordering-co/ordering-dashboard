import { afterEach, describe, expect, it, vi } from 'vitest'
import { CSV_BOM, downloadText, pivotToCsv, seriesToCsv } from '../advancedReportsCsv'

// redesign reports FA2 (D11, RP-19, auditor 11): the table CSV of main, with quotes only where a value needs them

/**
 * The CSV text `main` builds for a table: the body of `downloadCSV` in `BI/ReportsBusinessSpend/index.js:57-99` and
 * `BI/ReportsSpentTime/index.js:50-92`, and with `currency` the variant of `BI/ReportsOrderStatus/index.js:63-106` and
 * `BI/ReportsAverageSales/index.js:49-92`. The file is the BOM plus this text (the `Blob` of `main`).
 */
const mainBuilder = (reportData, { currency = false } = {}) => {
  let csv = ''
  reportData.content.header.rows.forEach((tr) => {
    tr.forEach((th) => {
      csv += `${th.value},`
      for (let i = 1; i < th.colspan; i++) {
        csv += ' ,'
      }
    })
    csv += '\n'
  })
  csv += '\n'
  reportData.content.body.rows.forEach((tr) => {
    tr.forEach((th) => {
      if (currency && th.value_unit === 'currency') csv += `${th.value}$,`
      else csv += `${th.value},`
      for (let i = 1; i < th.colspan; i++) {
        csv += ' ,'
      }
    })
    csv += '\n'
  })
  csv += '\n'
  reportData.content.footer.rows.forEach((tr) => {
    tr.forEach((th) => {
      csv += `${th.value},`
      for (let i = 1; i < th.colspan; i++) {
        csv += ' ,'
      }
    })
    csv += '\n'
  })
  csv += '\n'
  return '﻿' + csv
}

const cell = (value, extra = {}) => ({ value, colspan: 1, ...extra })

const table = () => ({
  content: {
    header: {
      rows: [
        [cell('Business', { colspan: 2 }), cell('Week 2026-39', { colspan: 2 }), cell('Week 2026-40', { colspan: 2 })],
        [cell('ID'), cell('Name'), cell('Orders'), cell('Sales'), cell('Orders'), cell('Sales')]
      ]
    },
    body: {
      rows: [
        [cell(2, { value_unit: 'number' }), cell('Fast Bite'), cell(14, { value_unit: 'number' }), cell('1234.5', { value_unit: 'currency' }), cell(0, { value_unit: 'number' }), cell(0, { value_unit: 'currency' })],
        [cell(7, { value_unit: 'number' }), cell('Pizza Place'), cell(3, { value_unit: 'number' }), cell('99.9', { value_unit: 'currency' }), cell(5, { value_unit: 'number' }), cell('10', { value_unit: 'currency' })]
      ]
    },
    footer: {
      rows: [
        [cell('Total', { colspan: 2 }), cell(17), cell('1334.4', { value_unit: 'currency' }), cell(5), cell('10', { value_unit: 'currency' })]
      ]
    }
  }
})

describe('pivotToCsv', () => {
  it('is the file of main byte for byte for a table with colspan and footer', () => {
    const reportData = table()
    const csv = pivotToCsv(reportData.content)
    expect(csv).toBe(mainBuilder(reportData))
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toContain('Business, ,Week 2026-39, ,Week 2026-40, ,\n')
    expect(csv).toContain('\n\n2,Fast Bite,14,1234.5,0,0,\n')
    expect(csv.endsWith('Total, ,17,1334.4,5,10,\n\n')).toBe(true)
  })

  it('writes the raw header text, the raw seconds and no currency sign by default', () => {
    const reportData = {
      content: {
        header: { rows: [[cell('Driver'), cell('Report header driver times', { colspan: 3 })]] },
        body: { rows: [[cell('Ana (3)'), cell(3725), cell(0), cell(61)]] },
        footer: { rows: [] }
      }
    }
    const csv = pivotToCsv(reportData.content)
    expect(csv).toBe(mainBuilder(reportData))
    expect(csv).toContain('3725')
    expect(csv).not.toContain('$')
  })

  it('adds the sign to the currency cells of the body when asked, as reports 8 and 18 do in main', () => {
    const reportData = table()
    const csv = pivotToCsv(reportData.content, { currencySuffix: '$' })
    expect(csv).toBe(mainBuilder(reportData, { currency: true }))
    expect(csv).toContain('2,Fast Bite,14,1234.5$,0,0$,\n')
    // only the body: the footer and the header stay as they come
    expect(csv).toContain('Total, ,17,1334.4,5,10,\n')
  })

  it('puts in double quotes the value with a comma, a quote or a line break, and nothing else changes (RP-19)', () => {
    const reportData = table()
    reportData.content.body.rows[0][1] = cell('Burger, Fries & Co')
    reportData.content.body.rows[1][1] = cell('The "Best" Pizza')
    reportData.content.footer.rows[0][0] = cell('Total\nall', { colspan: 2 })
    const csv = pivotToCsv(reportData.content)
    expect(csv).toContain('2,"Burger, Fries & Co",14,')
    expect(csv).toContain('7,"The ""Best"" Pizza",3,')
    expect(csv).toContain('"Total\nall", ,17,')
    // the same table with plain names is untouched by the quoting
    expect(pivotToCsv(table().content)).toBe(mainBuilder(table()))
  })

  it('quotes a header with a comma and keeps the filler of the colspan outside the quotes', () => {
    const reportData = table()
    reportData.content.header.rows[0][0] = cell('Store, brand', { colspan: 2 })
    expect(pivotToCsv(reportData.content).split('\n')[0]).toBe('﻿"Store, brand", ,Week 2026-39, ,Week 2026-40, ,')
  })

  it('quotes the currency cell with its sign inside', () => {
    const reportData = table()
    reportData.content.body.rows[0][3] = cell('1,234.5', { value_unit: 'currency' })
    expect(pivotToCsv(reportData.content, { currencySuffix: '$' })).toContain('14,"1,234.5$",0,')
  })

  it('answers null, without a TypeError, when there is nothing to download', () => {
    expect(pivotToCsv(undefined)).toBeNull()
    expect(pivotToCsv(null)).toBeNull()
    expect(pivotToCsv([])).toBeNull()
    expect(pivotToCsv({})).toBeNull()
    expect(pivotToCsv({ header: {} })).toBeNull()
    expect(pivotToCsv({ header: { rows: 'x' }, body: { rows: [[cell(1)]] } })).toBeNull()
  })

  it('answers null for a table with no body rows, the case where main downloads nothing', () => {
    const reportData = table()
    reportData.content.body.rows = []
    expect(pivotToCsv(reportData.content)).toBeNull()
    delete reportData.content.body
    expect(pivotToCsv(reportData.content)).toBeNull()
  })

  it('accepts a table with no footer', () => {
    const reportData = table()
    delete reportData.content.footer
    expect(pivotToCsv(reportData.content)).toBe(mainBuilder({ content: { ...reportData.content, footer: { rows: [] } } }))
  })
})

describe('seriesToCsv', () => {
  it('writes the file of main for the charts: the header as «A, B» and rows with the trailing comma', () => {
    expect(seriesToCsv(['Time', 'Orders'], [['Day 2026-10-03', 5], ['Day 2026-10-04', 0]])).toBe('Time, Orders\nDay 2026-10-03,5,\nDay 2026-10-04,0,\n')
    expect(seriesToCsv(['Driver', 'Orders'], [['Ana (3)', 12]])).toBe('Driver, Orders\nAna (3),12,\n')
  })

  it('quotes a name with a comma, a quote or a line break', () => {
    expect(seriesToCsv(['Products', 'Orders'], [['Burger, large', 3], ['The "Big" one', 2]])).toBe('Products, Orders\n"Burger, large",3,\n"The ""Big"" one",2,\n')
  })

  it('writes only the header when there are no rows, and survives bad input', () => {
    expect(seriesToCsv(['Time', 'Sales'], [])).toBe('Time, Sales\n')
    expect(seriesToCsv(['Time', 'Sales'], null)).toBe('Time, Sales\n')
  })
})

describe('downloadText', () => {
  afterEach(() => {
    // jsdom has no object URLs: the test puts them there and takes them out
    delete URL.createObjectURL
    delete URL.revokeObjectURL
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const BOM_BYTES = [0xef, 0xbb, 0xbf]
  const bytesOf = (blob) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result)))
    reader.readAsArrayBuffer(blob)
  })

  const spyOnDownload = () => {
    const blobs = []
    const links = []
    URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return 'blob:csv' })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { links.push({ download: this.download, href: this.href }) })
    return { blobs, links }
  }

  it('clicks a link with the file name and a file that starts with one BOM only', async () => {
    const { blobs, links } = spyOnDownload()
    downloadText('service_times_1.csv', 'a,b,\n')
    downloadText('service_times_2.csv', pivotToCsv(table().content))
    expect(links.map(link => link.download)).toEqual(['service_times_1.csv', 'service_times_2.csv'])
    expect(links[0].href).toBe('blob:csv')
    // the bytes, because reading a blob as text drops the BOM: EF BB BF, then the text
    const first = await bytesOf(blobs[0])
    expect(first.slice(0, 3)).toEqual(BOM_BYTES)
    expect(String.fromCharCode(...first.slice(3))).toBe('a,b,\n')
    const second = await bytesOf(blobs[1])
    expect(second.slice(0, 3)).toEqual(BOM_BYTES)
    expect(second.slice(3, 11)).toEqual([...'Business'].map(char => char.charCodeAt(0)))
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('does nothing without text', () => {
    const { links } = spyOnDownload()
    downloadText('x.csv', null)
    downloadText('x.csv', undefined)
    expect(links).toHaveLength(0)
  })
})
