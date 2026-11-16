import { describe, expect, it } from 'vitest'
import {
  ADVANCED_REPORT_GROUPS,
  ADVANCED_REPORTS,
  GROUP_TEXTS,
  REPORT_TEXTS,
  getAdvancedReport,
  reportPngName,
  reportSearchText
} from '../advancedReports'
import { buildOpenActionEntries } from '../commandPaletteActions'
import { rankCommandEntries } from '../commandPaletteSearch'

// redesign reports FA1 (D2, RP-02, RP-17): the 21 reports of main, copied here as the reference
// of what the palette had before the registry (commandPaletteActions.js:40-62 at that time).
const MAIN_PALETTE = [
  { id: 1, labelKey: 'DISTANCE', label: 'Distance', aliases: ['distancia'] },
  { id: 2, labelKey: 'DISTANCE_STORE_CUSTOMER', label: 'Distance in KM from the store to customer', aliases: ['distancia tienda cliente'] },
  { id: 3, labelKey: 'DISTANCE_STORE_CUSTOMER_RANGE_KM', label: 'Distance in KM from the store to customer (Range KM)', aliases: ['rango km'] },
  { id: 4, labelKey: 'SERVICE_TIMES', label: 'Service Times', aliases: ['tiempos de servicio'] },
  { id: 5, labelKey: 'DETAIL_COMPLETED_ORDERS', label: 'Detail of the completed orders of each delivery agency', aliases: ['ordenes completadas por agencia'] },
  { id: 6, labelKey: 'NUMBER_ORDERS_SPECIFIC_RANGE', label: 'Number of orders within a specific range', aliases: ['cantidad de ordenes por rango'] },
  { id: 7, labelKey: 'DRIVER_SCHEDULE', label: 'Driver schedule', aliases: ['horario de repartidores'] },
  { id: 8, labelKey: 'ORDER_STATUS_TEXT', label: 'Order status', aliases: ['estado de ordenes'] },
  { id: 9, labelKey: 'HEAT_MAP_WITH', label: 'Heat map with', aliases: ['mapa de calor', 'heatmap'] },
  { id: 10, labelKey: 'DRIVER_DISTANCE', label: 'Driver distance', aliases: ['distancia de repartidores'] },
  { id: 11, labelKey: 'DRIVER_TIME', label: 'Driver Time', aliases: ['tiempo de repartidores'] },
  { id: 12, labelKey: 'TOP_DRIVERS', label: 'Top drivers', aliases: ['mejores repartidores'] },
  { id: 13, labelKey: 'ORDERS', label: 'Orders', aliases: ['reporte de ordenes', 'orders report'] },
  { id: 14, labelKey: 'SALES', label: 'Sales', aliases: ['ventas', 'reporte de ventas', 'sales report'] },
  { id: 15, labelKey: 'REGISTER_USERS', label: 'Register users', aliases: ['usuarios registrados', 'registros'] },
  { id: 16, labelKey: 'CUSTOMER_SATISFACTION', label: 'Customer safisfaction', aliases: ['satisfaccion', 'customer satisfaction'] },
  { id: 17, labelKey: 'PAYMETHOD_SALES', label: 'Paymethod sales', aliases: ['ventas por metodo de pago'] },
  { id: 18, labelKey: 'AVERAGE_SALES', label: 'Average sales', aliases: ['ticket promedio', 'ventas promedio'] },
  { id: 19, labelKey: 'GENERAL_SALES', label: 'General sales', aliases: ['ventas generales'] },
  { id: 20, labelKey: 'TOP_SELLING_AND_CATEOGRY', label: 'Top selling and category', aliases: ['mas vendidos', 'top productos', 'best sellers'] },
  { id: 21, labelKey: 'SLA_ORDERS', label: 'SLA orders', aliases: ['sla', 'ordenes sla'] }
]
// redesign (n.º 21): report 22 is the clicks report of the ecommerce page («Real time» in main, with its aliases)
const CLICKS_PALETTE = { id: 22, labelKey: 'REAL_TIME', label: 'Real time', aliases: ['tiempo real', 'en vivo', 'clics'] }
const PALETTE = [...MAIN_PALETTE, CLICKS_PALETTE]

const CATALOG_ORDER = [13, 14, 18, 19, 17, 20, 8, 21, 3, 2, 1, 6, 5, 4, 9, 11, 12, 10, 7, 15, 16, 22]
const GROUPS = {
  sales: [13, 14, 18, 19, 17, 20],
  service: [8, 21, 3],
  delivery: [2, 1, 6, 5, 4, 9],
  drivers: [11, 12, 10, 7],
  customers: [15, 16, 22]
}
const defaultT = (_key, fallback) => fallback
const admin = () => buildOpenActionEntries({ user: { level: 0 }, configs: {} })
const reportEntries = () => admin().filter(entry => entry.id.startsWith('action:report-'))

describe('ADVANCED_REPORTS registry', () => {
  it('lists the 22 reports once each, in the catalog order', () => {
    expect(ADVANCED_REPORTS).toHaveLength(22)
    expect(ADVANCED_REPORTS.map(report => report.id)).toEqual(CATALOG_ORDER)
    expect(new Set(ADVANCED_REPORTS.map(report => report.id)).size).toBe(22)
    expect([...ADVANCED_REPORTS.map(report => report.id)].sort((a, b) => a - b)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1))
  })

  it('orders the groups like the catalog and puts every report in its group', () => {
    expect(ADVANCED_REPORT_GROUPS).toEqual(['sales', 'service', 'delivery', 'drivers', 'customers'])
    ADVANCED_REPORT_GROUPS.forEach(group => {
      expect(ADVANCED_REPORTS.filter(report => report.group === group).map(report => report.id)).toEqual(GROUPS[group])
    })
    expect(Object.keys(GROUP_TEXTS)).toEqual(ADVANCED_REPORT_GROUPS)
    expect(GROUP_TEXTS.sales(defaultT)).toBe('Sales')
    expect(GROUP_TEXTS.service(defaultT)).toBe('Stores and service')
    expect(GROUP_TEXTS.delivery(defaultT)).toBe('Delivery')
    expect(GROUP_TEXTS.drivers(defaultT)).toBe('Drivers')
    expect(GROUP_TEXTS.customers(defaultT)).toBe('Customers')
  })

  it('gives every report a name, a description, a legacy name and aliases', () => {
    ADVANCED_REPORTS.forEach(report => {
      // report 22 keeps the keys the clicks report had on the ecommerce page
      expect(report.nameKey).toBe(report.id === 22 ? 'ECOMMERCE_REPORT_CLICKS_NAME' : `ENTERPRISE_REPORT_${report.id}_NAME`)
      expect(report.descriptionKey).toBe(report.id === 22 ? 'ECOMMERCE_REPORT_CLICKS_DESCRIPTION' : `ENTERPRISE_REPORT_${report.id}_DESCRIPTION`)
      expect(report.name.length).toBeGreaterThan(3)
      expect(report.description.length).toBeGreaterThan(20)
      expect(report.description).not.toMatch(/description$/i)
      expect(report.description.endsWith('.')).toBe(true)
      expect(report.legacyKey).toBeTruthy()
      expect(report.legacyName).toBeTruthy()
      expect(report.aliases.length).toBeGreaterThan(0)
      expect(report.endpoint).toBeTruthy()
    })
  })

  it('keeps the legacy key, legacy name and Spanish aliases of main for each id', () => {
    PALETTE.forEach(main => {
      const report = getAdvancedReport(main.id)
      expect(report.legacyKey).toBe(main.labelKey)
      expect(report.legacyName).toBe(main.label)
      expect(report.aliases).toEqual(main.aliases)
    })
  })

  it('uses the new names of decisions.md', () => {
    const names = Object.fromEntries(ADVANCED_REPORTS.map(report => [report.id, report.name]))
    expect(names).toEqual({
      13: 'Orders over time',
      14: 'Sales over time',
      18: 'Average ticket by site and order type',
      19: 'Sales by brand',
      17: 'Sales by payment method',
      20: 'Top products and categories',
      8: 'Orders and rejections by store and brand',
      21: 'Orders by SLA status',
      3: 'Service times by store',
      2: 'Orders by delivery distance',
      1: 'Average delivery distance by store',
      6: 'Orders and sales by delivery company',
      5: 'Service times by delivery company',
      4: 'Service time ranges by delivery company',
      9: 'Order heat map',
      11: 'Service times by driver',
      12: 'Top drivers by orders',
      10: 'Distance by driver',
      7: 'Driver schedule',
      15: 'Registered users',
      16: 'Customer satisfaction',
      22: 'Clicks on stores, products and categories'
    })
  })

  it('mirrors the literal t() calls of REPORT_TEXTS with the registry data', () => {
    expect(Object.keys(REPORT_TEXTS).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1))
    ADVANCED_REPORTS.forEach(report => {
      const calls = []
      const texts = REPORT_TEXTS[report.id]((key, fallback) => {
        calls.push([key, fallback])
        return fallback
      })
      expect(texts).toEqual({ name: report.name, description: report.description, legacyName: report.legacyName })
      expect(calls).toEqual([
        [report.nameKey, report.name],
        [report.descriptionKey, report.description],
        [report.legacyKey, report.legacyName]
      ])
    })
  })

  // redesign the descriptions of the distance reports (1, 10) say «km» only when the project measures in km
  it('describes the distance reports in miles for a miles project, with keys of their own, and leaves the rest alone', () => {
    const miles = id => {
      const calls = []
      const texts = REPORT_TEXTS[id]((key, fallback) => { calls.push(key); return fallback }, 'MI')
      return { description: texts.description, calls }
    }
    expect(miles(1).description).toBe('Average distance from each store to its customers, in miles, for each period.')
    expect(miles(1).calls).toContain('ENTERPRISE_REPORT_1_DESCRIPTION_MI')
    expect(miles(10).description).toBe('Distance covered by each driver, in miles, for each period.')
    expect(miles(10).calls).toContain('ENTERPRISE_REPORT_10_DESCRIPTION_MI')
    ;[1, 10].forEach((id) => {
      expect(REPORT_TEXTS[id]((key, fallback) => fallback, 'KM').description).toBe(getAdvancedReport(id).description)
      expect(REPORT_TEXTS[id]((key, fallback) => fallback).description).toBe(getAdvancedReport(id).description)
    })
    expect(REPORT_TEXTS[13]((key, fallback) => fallback, 'MI').description).toBe(getAdvancedReport(13).description)
  })

  it('describes the data of the sample reports in one line', () => {
    expect(getAdvancedReport(3).description).toBe('Orders, sales and the times between order statuses, per store.')
    expect(getAdvancedReport(13).description).toBe('Orders per period, with the total.')
    expect(getAdvancedReport(21).description).toBe('Completed and cancelled orders on time, at risk or delayed.')
  })

  it('declares the endpoints, bodies and files of the matrix', () => {
    expect(getAdvancedReport(8)).toMatchObject({
      endpoint: 'business_orders_count_sales',
      endpoint1: 'franchise_orders_count_sales',
      body: 'pivot2',
      csv: { files: ['business_orders_count_sales_', 'franchise_orders_count_sales_'] }
    })
    expect(getAdvancedReport(18)).toMatchObject({
      endpoint: 'sites_sales_average',
      endpoint1: 'order_types_sales_average',
      body: 'pivot2',
      csv: { files: ['site_sales_average_', 'order_type_sales_average_'] }
    })
    expect(getAdvancedReport(20)).toMatchObject({
      endpoint: 'top_selling_v2',
      endpoint1: 'top_categories_v2',
      body: 'ranking2',
      csv: { files: ['top_selling_', 'top_category_'] }
    })
    expect(getAdvancedReport(1)).toMatchObject({ body: 'pivot', chart: 'bars', csv: { files: ['distance_per_brand_'] } })
    expect(getAdvancedReport(2)).toMatchObject({ body: 'pivot', chart: 'bars', csv: { files: ['order_delivery_'] } })
    expect(getAdvancedReport(7)).toMatchObject({ body: 'timeline', csv: { files: [] } })
    // redesign (n.º 21): the clicks report, report 22, has its own view and one CSV per kind of click
    expect(getAdvancedReport(22)).toMatchObject({
      kind: 'clicks',
      group: 'customers',
      endpoint: 'tracking_events',
      body: 'clicks',
      csv: { files: ['clicks_business_', 'clicks_product_', 'clicks_category_'] }
    })
    expect(ADVANCED_REPORTS.filter(report => report.kind === 'clicks').map(report => report.id)).toEqual([22])
    expect(getAdvancedReport(9).body).toBe('map')
    expect(getAdvancedReport(12).body).toBe('ranking')
    expect(getAdvancedReport(16).body).toBe('satisfaction')
    ;[13, 14, 15].forEach(id => expect(getAdvancedReport(id).body).toBe('line'))
    ;[1, 2, 3, 4, 5, 6, 10, 11, 17, 19, 21].forEach(id => expect(getAdvancedReport(id).body).toBe('pivot'))
    expect(getAdvancedReport(8).endpoint1).toBeTruthy()
    expect(ADVANCED_REPORTS.filter(report => report.endpoint1).map(report => report.id).sort((a, b) => a - b)).toEqual([8, 18, 20])
  })

  it('fixes the wrong file names of main and keeps the PNG names', () => {
    expect(getAdvancedReport(11).csv.files).toEqual(['driver_spent_times_'])
    expect(getAdvancedReport(17).csv.files).toEqual(['paymethod_sales_'])
    expect(getAdvancedReport(21).csv.files).toEqual(['sla_orders_'])
    expect(getAdvancedReport(5).csv.files).toEqual(['completed_orders_'])
    expect(getAdvancedReport(4).csv.files).toEqual(['service_times_'])
    expect(reportPngName(getAdvancedReport(1), defaultT)).toBe('Distance per brand')
    expect(reportPngName(getAdvancedReport(2), defaultT)).toBe('Orders delivery')
    expect(reportPngName(getAdvancedReport(7), defaultT)).toBe('driver_schedule')
    expect(reportPngName(getAdvancedReport(13), defaultT)).toBeNull()
  })

  it('declares the column rules of D8 only where they are needed', () => {
    expect(getAdvancedReport(2).columns).toEqual({ distance: 'count' })
    expect(getAdvancedReport(1).columns).toEqual({ average: 'km2' })
    expect(getAdvancedReport(10).columns).toEqual({ distance: 'meterToKm' })
    expect(ADVANCED_REPORTS.filter(report => report.columns).map(report => report.id).sort((a, b) => a - b)).toEqual([1, 2, 10])
  })

  it('has the pill matrix of 7, 10 and 21 (and the rest of main)', () => {
    expect(getAdvancedReport(7)).toMatchObject({
      pills: ['driverGroup', 'driver', 'zone', 'day'], storesByBrand: false, driversByGroup: true
    })
    expect(getAdvancedReport(10)).toMatchObject({
      pills: ['stores', 'driverGroup', 'driver', 'country', 'zone', 'period'], storesByBrand: false, driversByGroup: true
    })
    expect(getAdvancedReport(21)).toMatchObject({
      pills: ['driverGroup', 'driver', 'stores', 'zone', 'period'], storesByBrand: true, driversByGroup: true
    })
    // redesign (row 5, P7, D-31): report 12 narrows its drivers by group too, like 7, 10, 11 and 21
    expect(getAdvancedReport(12)).toMatchObject({ pills: ['driverGroup', 'driver', 'zone', 'period'], driversByGroup: true })
    expect(getAdvancedReport(8).pills).toEqual(['brand', 'stores', 'orderType', 'country', 'zone', 'period'])
    expect(getAdvancedReport(9).pills).toEqual(['brand', 'stores', 'driverGroup', 'driver', 'country', 'zone', 'period'])
    expect(getAdvancedReport(15).pills).toEqual(['channel', 'zone', 'period'])
    // the clicks view has its own channel row (`app_id`), so the registry does not list the `channel` pill (it writes `app_ids`)
    expect(getAdvancedReport(22).pills).toEqual(['country', 'brand', 'zone', 'period'])
    expect(getAdvancedReport(17).pills).toEqual(['driverGroup', 'brand', 'zone', 'period'])
    expect(getAdvancedReport(19).pills).toEqual(['driverGroup', 'brand', 'stores', 'country', 'zone', 'period'])
    expect(getAdvancedReport(1).pills).toEqual(['brand', 'stores', 'country', 'zone', 'period'])
    ADVANCED_REPORTS.forEach(report => {
      expect(typeof report.storesByBrand).toBe('boolean')
      expect(typeof report.driversByGroup).toBe('boolean')
      expect(report.pills).toContain('zone')
      expect(report.pills.includes('period') !== report.pills.includes('day')).toBe(true)
    })
  })
})

describe('getAdvancedReport', () => {
  it('accepts a number or a string', () => {
    expect(getAdvancedReport(13).id).toBe(13)
    expect(getAdvancedReport('13').id).toBe(13)
    expect(getAdvancedReport('21').id).toBe(21)
    expect(getAdvancedReport('22').id).toBe(22)
    expect(getAdvancedReport(22).id).toBe(22)
    expect(getAdvancedReport(1).id).toBe(1)
  })

  it('returns null for what is not one of the 22', () => {
    ;['0', 0, 'abc', '23', 23, null, undefined, '', '1.5', 1.5, '-1', '07x', NaN, {}].forEach(value => {
      expect(getAdvancedReport(value)).toBeNull()
    })
  })
})

describe('reportSearchText', () => {
  it('has the new name, the description, the legacy name and the aliases, lowercase and without accents', () => {
    const text = reportSearchText(getAdvancedReport(20), defaultT)
    expect(text).toContain('top products and categories')
    expect(text).toContain('top selling and category')
    expect(text).toContain('mas vendidos')
    expect(text).toContain(getAdvancedReport(20).description.toLowerCase())
    expect(text).toBe(text.toLowerCase())
  })

  it('removes accents and uses the translated legacy name', () => {
    const translate = (key, fallback) => (key === 'ORDERS' ? 'Órdenes' : fallback)
    const text = reportSearchText(getAdvancedReport(13), translate)
    expect(text).toContain('ordenes')
    expect(text).not.toMatch(/[áéíóúñ]/)
  })
})

describe('reportSearchText with extra aliases', () => {
  // redesign the catalog adds the search terms of the retired Ecommerce page, as ⌘K does
  it('adds the terms it is given, without accents', () => {
    expect(reportSearchText(getAdvancedReport(2), defaultT)).not.toContain('discount dashboard')
    expect(reportSearchText(getAdvancedReport(2), defaultT, ['Discount dashboard', 'descuentos'])).toContain('discount dashboard')
    expect(reportSearchText(getAdvancedReport(2), defaultT, undefined)).toBe(reportSearchText(getAdvancedReport(2), defaultT))
  })
})

describe('command palette entries of the reports', () => {
  it('keeps the id, path, subtitle, icon and boost of today for ids 1 to 21, and gives report 22 the same', () => {
    const entries = reportEntries()
    expect(entries.map(entry => entry.id)).toEqual(PALETTE.map(main => `action:report-${main.id}`))
    entries.forEach((entry, index) => {
      expect(entry.path).toBe(`/intelligence/reports?id=${index + 1}`)
      expect(entry.subtitle).toBe('Enterprise reports')
      expect(entry.icon).toBe('intelligence')
      expect(entry.boost).toBe(-1)
      expect(entry.group).toBe('actions')
    })
  })

  it('titles each entry with the new name and keeps the old aliases plus the legacy name', () => {
    reportEntries().forEach(entry => {
      const id = Number(entry.id.replace('action:report-', ''))
      const report = getAdvancedReport(id)
      const main = PALETTE.find(item => item.id === id)
      expect(entry.title).toBe(report.name)
      const expected = [...main.aliases, 'reporte', 'informe', 'report', main.label]
      // redesign (n.º 21): reports 1 to 3 and 22 also take the search terms of the retired Ecommerce reports page, after these
      expect(entry.aliases.slice(0, expected.length)).toEqual(expected)
      if (![1, 2, 3, 22].includes(id)) expect(entry.aliases).toEqual(expected)
    })
  })

  it('translates the title and the legacy alias', () => {
    const t = (key, fallback) => (key === 'ENTERPRISE_REPORT_13_NAME' ? 'Órdenes en el tiempo' : key === 'ORDERS' ? 'Órdenes' : fallback)
    const entry = buildOpenActionEntries({ t, user: { level: 0 }, configs: {} }).find(item => item.id === 'action:report-13')
    expect(entry.title).toBe('Órdenes en el tiempo')
    expect(entry.aliases).toContain('Órdenes')
  })

  it('still finds each report by its name in main (pedido del coordinador)', () => {
    const entries = reportEntries()
    PALETTE.forEach(main => {
      const found = rankCommandEntries(entries, main.label).map(entry => entry.id)
      expect(found, `search "${main.label}"`).toContain(`action:report-${main.id}`)
    })
  })

  it('still finds each report by its old Spanish aliases and by its new name', () => {
    const entries = reportEntries()
    PALETTE.forEach(main => {
      main.aliases.forEach(alias => {
        expect(rankCommandEntries(entries, alias).map(entry => entry.id), `alias "${alias}"`).toContain(`action:report-${main.id}`)
      })
      const report = getAdvancedReport(main.id)
      expect(rankCommandEntries(entries, report.name).map(entry => entry.id), `name "${report.name}"`).toContain(`action:report-${main.id}`)
    })
  })
})
