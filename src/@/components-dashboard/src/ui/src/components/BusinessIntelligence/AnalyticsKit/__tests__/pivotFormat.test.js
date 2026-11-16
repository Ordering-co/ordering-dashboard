// redesign reports FB1 (D6, D8, D9; RP-03, RP-05, RP-13, RP-16; auditor 2, 5, 9, 10): the text of the cells and headers of the report tables.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { cellText, distanceUnitOf, formatCell, formatDurationSigned, headerText, kmToUnit, pivotLayout } from '../pivotFormat'

// the project's formatters, in the shape the host gives them (comma as decimal separator, dot for thousands)
const parseNumber = (value, { decimal = 2 } = {}) => (parseFloat(value) || 0).toFixed(decimal).replace('.', ',')
const parsePrice = (value) => `$ ${parseNumber(value)}`
const makeFmt = (catalog = {}) => ({
  t: (key, text) => catalog[key] ?? text,
  parsePrice,
  parseNumber,
  parseDate: (date) => String(date)
})
const cell = (value, unit, refers) => ({ value, colspan: 1, value_unit: unit, value_refers: refers })

describe('formatDurationSigned', () => {
  const { t } = makeFmt()

  it.each([
    [157581, '1 d 19 h'],
    [-4439, '−1 h 13 min'],
    [432, '7 min 12 s'],
    [0, '0 s']
  ])('%s s reads «%s»', (seconds, text) => {
    expect(formatDurationSigned(t, seconds)).toBe(text)
  })

  it('the minus sign is U+2212, not a hyphen', () => {
    expect(formatDurationSigned(t, -4439).charCodeAt(0)).toBe(0x2212)
  })

  it.each([[null], [''], [NaN], [undefined], ['abc'], [Infinity]])('%s is no duration: null', (value) => {
    expect(formatDurationSigned(t, value)).toBeNull()
  })

  it('takes a number written as text and truncates to the two larger units like the kit does', () => {
    expect(formatDurationSigned(t, '432')).toBe('7 min 12 s')
    expect(formatDurationSigned(t, 3605)).toBe('1 h') // 1 h 0 min 5 s: the same window as formatDuration of reportFormat.js
    expect(formatDurationSigned(t, 90000)).toBe('1 d 1 h')
  })

  it('a value that rounds to zero seconds has no sign', () => {
    expect(formatDurationSigned(t, -0.2)).toBe('0 s')
  })

  it('uses the keys of the kit for h, min and s and its own for days', () => {
    const calls = []
    formatDurationSigned((key, text) => { calls.push(key); return text }, 157581)
    expect(calls).toContain('ENTERPRISE_REPORT_DURATION_DAYS')
    expect(calls).toContain('BUSINESS_REPORTS_DURATION_HOURS')
    const days = vi.fn((key, text) => text)
    formatDurationSigned(days, 86400)
    expect(days).toHaveBeenCalledWith('ENTERPRISE_REPORT_DURATION_DAYS', '_n_ d')
  })
})

describe('cellText', () => {
  const { t } = makeFmt()

  it('translates the statuses the API sends', () => {
    expect(cellText('COMPLETED', t)).toBe('Completed')
    expect(cellText('CANCELLED', t)).toBe('Cancelled')
    expect(cellText('COMPLETED', makeFmt({ COMPLETED: 'Terminado' }).t)).toBe('Terminado')
  })

  it('reads the distance ranges as «A–B km»', () => {
    expect(cellText('Between 0 to 1', t)).toBe('0–1 km')
    expect(cellText('Between 1 to 1.5', t)).toBe('1–1.5 km')
    expect(cellText('Between 1 to 1.5', makeFmt({ ENTERPRISE_REPORT_DISTANCE_RANGE: '_from_ a _to_ km' }).t)).toBe('1 a 1.5 km')
  })

  it('writes the decimals of a range with the number format of the project when it is given', () => {
    expect(cellText('Between 1 to 1.5', t, parseNumber)).toBe('1–1,5 km')
    expect(cellText('Between 0 to 1', t, parseNumber)).toBe('0–1 km')
  })

  it('«Others» has its own key', () => {
    expect(cellText('Others', t)).toBe('Others')
    expect(cellText('Others', makeFmt({ ENTERPRISE_REPORT_OTHERS: 'Otros' }).t)).toBe('Otros')
  })

  it('anything else comes as it arrives', () => {
    expect(cellText('Fast Bite', t)).toBe('Fast Bite')
    expect(cellText('app_marketplace_26', t)).toBe('app_marketplace_26')
    expect(cellText(7, t)).toBe('7')
  })
})

describe('formatCell', () => {
  const fmt = makeFmt()

  it('an empty cell is a dash and says it is empty', () => {
    expect(formatCell(cell(null, 'seconds', 'time'), { fmt })).toEqual({ text: '—', figure: false, empty: true })
    expect(formatCell(cell('', 'text', 'name'), { fmt })).toEqual({ text: '—', figure: false, empty: true })
    expect(formatCell(cell(null, 'number', 'id'), { fmt }).empty).toBe(true)
  })

  it('the id comes as the number it is', () => {
    expect(formatCell(cell(20499, 'number', 'id'), { fmt })).toEqual({ text: '20499', figure: true, empty: false })
  })

  it('text is text (a name, a business, a franchise)', () => {
    expect(formatCell(cell('Fast Bite', 'text', 'business'), { fmt })).toEqual({ text: 'Fast Bite', figure: false, empty: false })
    expect(formatCell(cell('Others', 'text', 'driver_company'), { fmt }).text).toBe('Others')
  })

  it('a status text goes through cellText, a range too (report 21 and 2)', () => {
    expect(formatCell(cell('COMPLETED', 'text', 'status'), { fmt })).toEqual({ text: 'Completed', figure: false, empty: false })
    expect(formatCell({ value: 'Between 0 to 1', colspan: 1 }, { fmt }).text).toBe('0–1 km')
  })

  it('a currency goes through parsePrice, without forcing a separator', () => {
    const parse = vi.fn(() => '$ 14,05')
    expect(formatCell(cell(14.05, 'currency', 'money'), { fmt: { ...fmt, parsePrice: parse } })).toEqual({ text: '$ 14,05', figure: true, empty: false })
    expect(parse).toHaveBeenCalledWith(14.05)
  })

  it('seconds are a signed duration, zero included', () => {
    expect(formatCell(cell(157581, 'seconds', 'time'), { fmt }).text).toBe('1 d 19 h')
    expect(formatCell(cell(-4439, 'seconds', 'time'), { fmt }).text).toBe('−1 h 13 min')
    expect(formatCell(cell(0, 'seconds', 'time'), { fmt })).toEqual({ text: '0 s', figure: true, empty: false })
  })

  it('quantities are whole numbers as they are, and decimals go through parseNumber', () => {
    expect(formatCell(cell(14, 'number', 'quantity'), { fmt }).text).toBe('14')
    expect(formatCell(cell(-39, 'number', 'quantity'), { fmt }).text).toBe('-39')
    expect(formatCell(cell(2.5, 'number', 'quantity'), { fmt }).text).toBe('2,50')
    expect(formatCell(cell(3, 'number', 'in_time'), { fmt }).figure).toBe(true)
  })

  it('a percentage ends in «%»: whole when it is whole, formatted when it has decimals', () => {
    expect(formatCell(cell(100, 'number', 'percentage'), { fmt })).toEqual({ text: '100%', figure: true, empty: false })
    expect(formatCell(cell(0, 'number', 'percentage'), { fmt }).text).toBe('0%')
    expect(formatCell(cell(33.3333, 'number', 'percentage'), { fmt }).text).toBe('33,33%')
  })

  it('meters are kilometres with two decimals, as main does (report 10)', () => {
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt })).toEqual({ text: '12,50', figure: true, empty: false })
    expect(formatCell(cell(0.47, 'meter', 'distance'), { fmt }).text).toBe('0,00')
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt, report: { columns: { distance: 'meterToKm' } } }).text).toBe('12,50')
  })

  it('the rule of the column of the registry goes first and is keyed by value_refers', () => {
    // report 2: km + distance are order counts
    const two = { columns: { distance: 'count' } }
    expect(formatCell(cell(5, 'km', 'distance'), { fmt, report: two })).toEqual({ text: '5', figure: true, empty: false })
    expect(formatCell(cell(5, 'km', 'distance'), { fmt }).text).toBe('5') // no rule: a whole number is a whole number
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt, report: two }).text).toBe('12500') // the rule wins over the unit
    // report 1: the average is km with two decimals
    const one = { columns: { average: 'km2' } }
    expect(formatCell(cell(0.00011866341318288926, 'number', 'average'), { fmt, report: one }).text).toBe('0,00')
    expect(formatCell(cell(12.3456, 'number', 'average'), { fmt, report: one }).text).toBe('12,35')
    // the rule does not touch the empty cell
    expect(formatCell(cell(null, 'number', 'average'), { fmt, report: one }).empty).toBe(true)
  })

  it('without a rule «average» goes through parseNumber as in main', () => {
    expect(formatCell(cell(0, 'number', 'average'), { fmt }).text).toBe('0,00')
  })

  it('a report without columns, or a rule that is not known, keeps going', () => {
    expect(formatCell(cell(5, 'km', 'distance'), { fmt, report: {} }).text).toBe('5')
    expect(formatCell(cell(5, 'km', 'distance'), { fmt, report: { columns: { distance: 'nope' } } }).text).toBe('5')
  })

  it('a cell with no unit and a number (the total of a footer) is a number; with no unit and text, text', () => {
    expect(formatCell({ value: 0.5, colspan: 1 }, { fmt })).toEqual({ text: '0,50', figure: true, empty: false })
    expect(formatCell({ value: 'Total', colspan: 2 }, { fmt })).toEqual({ text: 'Total', figure: false, empty: false })
  })

  it('a number that arrives as text is read; a text where a number was expected is kept', () => {
    expect(formatCell(cell('14.05', 'currency', 'money'), { fmt }).text).toBe('$ 14,05')
    expect(formatCell(cell('n/a', 'currency', 'money'), { fmt })).toEqual({ text: 'n/a', figure: false, empty: false })
  })

  it('every synthetic report cell gets a text (no throw, no «undefined», no «NaN»)', () => {
    const file = path.resolve(__dirname, 'fixtures/report-api-shapes.json')
    const shapes = JSON.parse(readFileSync(file, 'utf8')).result
    let seen = 0
    Object.values(shapes).flat().filter(entry => entry.kind === 'table').forEach(entry => {
      ;[...entry.body0, ...entry.footer].flat().forEach(c => {
        const out = formatCell({ value: c.v, colspan: c.cs, value_unit: c.u, value_refers: c.r }, { fmt })
        expect(out.text).not.toMatch(/undefined|NaN/)
        seen += 1
      })
    })
    expect(seen).toBeGreaterThan(100)
  })
})

describe('headerText', () => {
  const base = { ...makeFmt() }
  const header = (value, extra = {}, catalog) => headerText(value, { t: makeFmt(catalog).t, ...extra })

  it('(1) a period label goes to periodText with the parsed period', () => {
    const periodText = vi.fn(period => `${period.unit} ${period.number}: ${period.start} to ${period.end}`)
    expect(header('Week 2026-39', { periodText })).toBe('week 39: 2026-09-27 to 2026-10-03')
    expect(periodText).toHaveBeenCalledWith(expect.objectContaining({ unit: 'week', start: '2026-09-27', end: '2026-10-03', number: 39 }), 'Week 2026-39')
    expect(header('Day 2026-10-03', { periodText: period => period.unit })).toBe('day')
  })

  it('a period label with no periodText comes as it arrives', () => {
    expect(header('Week 2026-39')).toBe('Week 2026-39')
  })

  it('(2) API_REPORT_HEADER_SPEND_a_TO_b names the two statuses and says nothing else', () => {
    const statusLabel = n => ({ 4: 'Preparation completed', 3: 'Driver arrived by business' })[n]
    expect(header('API_REPORT_HEADER_SPEND_4_TO_3', { statusLabel })).toBe('Preparation completed → Driver arrived by business')
    // without statusLabel the names of the kit (orderStatusLabel)
    expect(header('API_REPORT_HEADER_SPEND_9_TO_11')).toBe('Pick up completed by driver → Delivery completed by driver')
    expect(header('API_REPORT_HEADER_SPEND_4_TO_3', { statusLabel }, { ENTERPRISE_REPORT_STATUS_SPAN: '_from_ ⇒ _to_' })).toBe('Preparation completed ⇒ Driver arrived by business')
  })

  it('(3) the known API_REPORT_HEADER_* keys have their own text', () => {
    expect(header('API_REPORT_HEADER_ORDERS_PARTICIPATION')).toBe('Share of orders')
    expect(header('API_REPORT_HEADER_SALES_PARTICIPATION')).toBe('Share of sales')
    expect(header('API_REPORT_HEADER_REJECTED')).toBe('Rejected')
    expect(header('API_REPORT_HEADER_REJECTED_PERCENTAGE')).toBe('Rejected (%)')
    expect(header('API_REPORT_HEADER_AVERAGE_TICKET')).toBe('Average ticket')
    expect(header('API_REPORT_HEADER_TOTAL_VS_IDEAL')).toBe('Total vs ideal')
    expect(header('API_REPORT_HEADER_RANK')).toBe('Rank')
    expect(header('API_REPORT_HEADER_IN_TIME')).toBe('On time')
    expect(header('API_REPORT_HEADER_AT_RISK')).toBe('At risk')
    expect(header('API_REPORT_HEADER_DELAYED')).toBe('Delayed')
    expect(header('API_GENERAL')).toBe('General')
  })

  it('(4) the markers become the name of the column', () => {
    expect(header('Report header sites')).toBe('Site')
    expect(header('Report header order types')).toBe('Order type')
    expect(header('Report header payment method')).toBe('Payment method')
    expect(header('Report header driver times')).toBe('Driver')
    expect(header('Report header status')).toBe('Status')
    expect(header('Report header date/time')).toBe('Date')
    expect(header('Report header users')).toBe('Users')
    expect(header('Report header category')).toBe('Category')
    expect(header('Report header qualification')).toBe('Score')
    expect(header('Report header quantity')).toBe('Quantity')
    expect(header('Report header products')).toBe('Product')
  })

  it('(5) the English texts of the API use the key that exists, and a translated catalog wins', () => {
    expect(header('Orders', {}, { ORDERS: 'Pedidos' })).toBe('Pedidos')
    expect(header('Sales', {}, { SALES: 'Ventas' })).toBe('Ventas')
    expect(header('Name', {}, { NAME: 'Nombre' })).toBe('Nombre')
    expect(header('ID', {}, { ID: 'N.º' })).toBe('N.º')
    expect(header('Percentage', {}, { PERCENTAGE: 'Porcentaje' })).toBe('Porcentaje')
    expect(header('Driver companies', {}, { DRIVER_COMPANIES: 'Empresas' })).toBe('Empresas')
    ;['Distance', 'Business', 'Businesses', 'Drivers', 'Franchises', 'Last name', 'Total', 'Driver company'].forEach(text => {
      expect(header(text)).toBe(text)
    })
    expect(header('Average Distance')).toBe('Average distance')
    expect(header('Time between business acceptance and delivery completion')).toBe('Time between business acceptance and delivery completion')
  })

  it('(6) anything else comes as it arrives, and an empty header stays empty', () => {
    expect(header('Something new')).toBe('Something new')
    expect(header('')).toBe('')
    expect(header(null)).toBe('')
  })

  it('never calls t() without a default text (RP-03: it would paint DASHBOARD_…)', () => {
    const t = vi.fn((key, text) => text)
    ;['Foo', 'API_REPORT_HEADER_NOT_KNOWN', 'API_REPORT_HEADER_SPEND_x_TO_y', 'Orders', 'Report header sites', 'API_REPORT_HEADER_RANK', 'Week 2026-39'].forEach(value => {
      headerText(value, { t, periodText: () => 'p' })
    })
    t.mock.calls.forEach(([key, text]) => {
      expect(typeof key).toBe('string')
      expect(typeof text).toBe('string')
    })
    expect(headerText('API_REPORT_HEADER_NOT_KNOWN', { t })).toBe('API_REPORT_HEADER_NOT_KNOWN')
  })

  it('every t() of the file carries a literal key and a default text', () => {
    const source = readFileSync(path.resolve(__dirname, '../pivotFormat.js'), 'utf8')
    expect(source).not.toMatch(/\bt\(\s*value\b/)
    const all = source.match(/\bt\(/g) || []
    const literal = source.match(/\bt\(\s*'[A-Z0-9_]+'\s*,\s*'(?:[^'\\]|\\.)+'\s*\)/g) || []
    expect(literal.length).toBeGreaterThan(30)
    expect(literal).toHaveLength(all.length) // no t() with a computed key or without its default text
    expect(base.t).toBeTypeOf('function')
  })
})

describe('pivotLayout', () => {
  const row = (...cells) => cells
  const c = (refers, colspan = 1) => ({ value: 1, colspan, value_unit: 'number', value_refers: refers })
  const h = (value, colspan = 1) => ({ value, colspan })

  it('the columns that name the row are the leading ones with a known value_refers; the row header is the first that is not an id', () => {
    const content = {
      header: { rows: [row(h('Business', 2), h('Week 2026-39', 3), h('Week 2026-40', 3)), row(h('ID'), h('Name'), h('Orders'))] },
      body: { rows: [row(c('id'), c('business'), c('quantity'), c('money'), c('time'), c('quantity'), c('money'), c('time'))] }
    }
    expect(pivotLayout(content)).toEqual({ columnCount: 8, fixedCount: 2, rowHeaderColumn: 1, groupStarts: [2, 5] })
  })

  it('report 10: id, driver, driver are three fixed columns', () => {
    const content = {
      header: { rows: [row(h('Drivers', 3), h('Week 2026-39'), h('Week 2026-40'))] },
      body: { rows: [row(c('id'), c('driver'), c('driver'), c('distance'), c('distance'))] }
    }
    expect(pivotLayout(content)).toMatchObject({ fixedCount: 3, rowHeaderColumn: 1, groupStarts: [3, 4] })
  })

  it('with no known column the first one is fixed (report 2)', () => {
    const content = {
      header: { rows: [row(h('Distance'), h('Week 2026-39', 2), h('Week 2026-40', 2))] },
      body: { rows: [row({ value: 'Between 0 to 1', colspan: 1 }, c('distance'), c('percentage'), c('distance'), c('percentage'))] }
    }
    expect(pivotLayout(content)).toMatchObject({ fixedCount: 1, rowHeaderColumn: 0, groupStarts: [1, 3] })
  })

  it('report 21: a status alone is the fixed column, with an empty first header', () => {
    const content = {
      header: { rows: [row(h(''), h('Week 2026-39', 3), h('Week 2026-40', 3))] },
      body: { rows: [row(c('status'), c('in_time'), c('at_risk'), c('delayed'), c('in_time'), c('at_risk'), c('delayed'))] }
    }
    expect(pivotLayout(content)).toMatchObject({ fixedCount: 1, groupStarts: [1, 4] })
  })

  it('no rows (report 4), no content or no header do not throw', () => {
    const empty = { header: { rows: [row(h('Driver companies', 2))] }, body: { rows: [] } }
    expect(pivotLayout(empty)).toMatchObject({ columnCount: 2, fixedCount: 1, groupStarts: [] })
    expect(pivotLayout(null)).toEqual({ columnCount: 1, fixedCount: 1, rowHeaderColumn: 0, groupStarts: [] })
    expect(pivotLayout({ body: { rows: [] } })).toMatchObject({ columnCount: 1 })
  })
})

// redesign (row 4, intelligence-reports P4, D-30): the distances of the reports are written in the unit of the project. The rule is the one of
// `parseDistance` (UtilsContext): `distance_unit_km` '1' is km, a `distance_unit` value wins, only «MI» (any case) is miles; a mile is 0.621371 of a km.
describe('the unit of the distances (miles where the project asks for them)', () => {
  const mi = { ...makeFmt(), distanceUnit: 'MI' }
  const km = { ...makeFmt(), distanceUnit: 'KM' }

  it('reads the unit of the project like parseDistance does', () => {
    expect(distanceUnitOf({})).toBe('KM')
    expect(distanceUnitOf(undefined)).toBe('KM')
    expect(distanceUnitOf({ distance_unit_km: { value: '1' } })).toBe('KM')
    expect(distanceUnitOf({ distance_unit: { value: 'mi' } })).toBe('MI')
    expect(distanceUnitOf({ distance_unit: { value: 'MI' } })).toBe('MI')
    expect(distanceUnitOf({ distance_unit_km: { value: '1' }, distance_unit: { value: 'MI' } })).toBe('MI')
    expect(distanceUnitOf({ distance_unit: { value: 'km' } })).toBe('KM')
    expect(distanceUnitOf({ distance_unit: { value: '' }, distance_unit_km: { value: '0' } })).toBe('KM')
  })

  it('converts kilometres only for miles', () => {
    expect(kmToUnit(10, 'KM')).toBe(10)
    expect(kmToUnit(10, undefined)).toBe(10)
    expect(kmToUnit(10, 'MI')).toBeCloseTo(6.21371, 5)
    expect(kmToUnit(null, 'MI')).toBeNull()
  })

  it('meters are miles with two decimals and the unit in the cell (report 10)', () => {
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt: mi })).toEqual({ text: '7,77 mi', figure: true, empty: false })
    expect(formatCell(cell(0.47, 'meter', 'distance'), { fmt: mi }).text).toBe('0,00 mi')
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt: mi, report: { columns: { distance: 'meterToKm' } } }).text).toBe('7,77 mi')
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt: { ...mi, t: makeFmt({ MI: 'mil' }).t } }).text).toBe('7,77 mil')
  })

  it('the average of report 1 (km2) is miles with two decimals', () => {
    const one = { columns: { average: 'km2' } }
    expect(formatCell(cell(12.3456, 'number', 'average'), { fmt: mi, report: one }).text).toBe('7,67 mi')
    expect(formatCell(cell(null, 'number', 'average'), { fmt: mi, report: one }).empty).toBe(true)
  })

  it('a km project reads exactly as before', () => {
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt: km })).toEqual({ text: '12,50', figure: true, empty: false })
    expect(formatCell(cell(12.3456, 'number', 'average'), { fmt: km, report: { columns: { average: 'km2' } } }).text).toBe('12,35')
    expect(formatCell(cell(12500, 'meter', 'distance'), { fmt: makeFmt() }).text).toBe('12,50')
  })

  it('counts, percentages and durations are never converted', () => {
    expect(formatCell(cell(5, 'km', 'distance'), { fmt: mi, report: { columns: { distance: 'count' } } }).text).toBe('5')
    expect(formatCell(cell(33.3333, 'number', 'percentage'), { fmt: mi }).text).toBe('33,33%')
    expect(formatCell(cell(432, 'seconds', 'time'), { fmt: mi }).text).toBe('7 min 12 s')
  })

  it('the ranges of report 2 are converted and written in miles, rounded to two decimals', () => {
    const { t } = makeFmt()
    expect(cellText('Between 0 to 1', t, undefined, 'MI')).toBe('0–0.62 mi')
    expect(cellText('Between 1 to 1.5', t, undefined, 'MI')).toBe('0.62–0.93 mi')
    expect(cellText('Between 5 to 10', t, undefined, 'MI')).toBe('3.11–6.21 mi')
    // a limit that is a whole number of miles has no decimals
    expect(cellText('Between 1.60934 to 3.21869', t, undefined, 'MI')).toBe('1–2 mi')
    expect(cellText('Between 0 to 1', makeFmt({ MI: 'mil' }).t, undefined, 'MI')).toBe('0–0.62 mil')
  })

  it('the decimals of a range in miles go through the number format of the project', () => {
    const { t } = makeFmt()
    expect(cellText('Between 1 to 1.5', t, parseNumber, 'MI')).toBe('0,62–0,93 mi')
    expect(cellText('Between 1.60934 to 3.21869', t, parseNumber, 'MI')).toBe('1–2 mi')
    expect(formatCell({ value: 'Between 1 to 1.5', colspan: 1 }, { fmt: mi }).text).toBe('0,62–0,93 mi')
  })

  it('the ranges of a km project keep the km text and the key of the catalog', () => {
    const { t } = makeFmt()
    expect(cellText('Between 1 to 1.5', t, undefined, 'KM')).toBe('1–1.5 km')
    expect(cellText('Between 1 to 1.5', t, parseNumber)).toBe('1–1,5 km')
    expect(cellText('Between 1 to 1.5', makeFmt({ ENTERPRISE_REPORT_DISTANCE_RANGE: '_from_ a _to_ km' }).t, undefined, 'KM')).toBe('1 a 1.5 km')
  })

  // redesign the API sends the last range of report 2 as «More than 5» (km, no unit); it gets the unit of the project like the other ranges
  it('writes the open last range of report 2 with the unit of the project', () => {
    const { t } = makeFmt()
    expect(cellText('More than 5', t)).toBe('More than 5 km')
    expect(cellText('More than 5', t, undefined, 'KM')).toBe('More than 5 km')
    expect(cellText('More than 5', t, undefined, 'MI')).toBe('More than 3.11 mi')
    expect(cellText('More than 1.60934', t, undefined, 'MI')).toBe('More than 1 mi')
    expect(cellText('More than 5', t, parseNumber, 'MI')).toBe('More than 3,11 mi')
    expect(cellText('More than 2.5', t, parseNumber, 'KM')).toBe('More than 2,5 km')
    expect(formatCell({ value: 'More than 5', colspan: 1 }, { fmt: mi }).text).toBe('More than 3,11 mi')
    expect(cellText('More than 5', makeFmt({ ENTERPRISE_REPORT_DISTANCE_MORE_THAN_MI: 'Más de _n_ mi' }).t, undefined, 'MI')).toBe('Más de 3.11 mi')
  })

  it('leaves other texts that start with «More than» as they come', () => {
    const { t } = makeFmt()
    expect(cellText('More than a week', t, undefined, 'MI')).toBe('More than a week')
  })

  // redesign «Cancelled» next to «Completed» in sentence case; the shared CANCELLED key is «cancelled» in other screens, so BI has its own
  it('writes the statuses of report 21 in sentence case with keys of BI, not the shared CANCELLED', () => {
    const calls = []
    const t = (key, text) => { calls.push(key); return text }
    expect(cellText('COMPLETED', t)).toBe('Completed')
    expect(cellText('CANCELLED', t)).toBe('Cancelled')
    expect(calls).not.toContain('CANCELLED')
  })
})
