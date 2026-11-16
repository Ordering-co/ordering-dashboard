import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAdvancedReport, REPORT_TEXTS } from '../advancedReports'
import {
  ECOMMERCE_REPORT_GROUPS,
  ECOMMERCE_REPORT_LIST,
  ECOMMERCE_REPORT_TEXTS,
  ECOMMERCE_REPORTS,
  getEcommerceLegacyAliases,
  getEcommerceReport,
  getEcommerceReportsRedirectPath,
  getEnterpriseIdOfEcommerceReport
} from '../ecommerceReports'

// redesign ecommerce FC (D1, D2, D4): the registry of the 4 reports of /intelligence/ecommerce_reports

const defaultT = (_key, fallback) => fallback

describe('ECOMMERCE_REPORTS registry', () => {
  it('lists the 4 reports in the order of the page', () => {
    expect(ECOMMERCE_REPORT_LIST.map(report => report.id)).toEqual([1, 2, 3, 4])
    expect(ECOMMERCE_REPORTS.map(report => report.id)).toEqual([1, 2, 3, 4])
  })

  it('resolves 1 to 3 with the advanced report and its group', () => {
    ECOMMERCE_REPORTS.slice(0, 3).forEach((entry) => {
      expect(entry.kind).toBe('advanced')
      expect(entry.report).toBe(getAdvancedReport(entry.advancedId))
      expect(entry.group).toBe(entry.report.group)
    })
    expect(ECOMMERCE_REPORTS.map(entry => entry.group)).toEqual(['delivery', 'delivery', 'service', 'customers'])
  })

  it('describes clicks as its own kind with its endpoint and pills', () => {
    const clicks = ECOMMERCE_REPORTS[3]
    expect(clicks).toMatchObject({
      id: 4,
      kind: 'clicks',
      group: 'customers',
      endpoint: 'tracking_events',
      pills: ['country', 'brand', 'zone']
    })
    expect(clicks.report).toBeUndefined()
  })

  it('keeps the names of main as legacy names', () => {
    expect(ECOMMERCE_REPORTS.map(entry => entry.legacyName)).toEqual([
      'Users',
      'Discount dashboard',
      'Dashboard with store map',
      'Real time'
    ])
    expect(ECOMMERCE_REPORTS.map(entry => entry.legacyKey)).toEqual([
      'USERS',
      'DISCOUNT_DASHBOARD',
      'STORE_MAP_DASHBOARD',
      'REAL_TIME'
    ])
  })

  it('lists only the groups that have a report, in the order of the catalog', () => {
    expect(ECOMMERCE_REPORT_GROUPS).toEqual(['service', 'delivery', 'customers'])
  })
})

describe('getEcommerceReport', () => {
  it('finds ids 1 to 4, as number or string', () => {
    for (const id of [1, 2, 3, 4]) {
      expect(getEcommerceReport(id).id).toBe(id)
      expect(getEcommerceReport(String(id)).id).toBe(id)
    }
    expect(getEcommerceReport('4').kind).toBe('clicks')
  })

  it('returns null for anything else, also the valid Enterprise ids', () => {
    for (const id of ['5', '21', '0', 'abc', null, undefined, '1.5', '', '01', 5, 21, 0, {}, []]) {
      expect(getEcommerceReport(id)).toBeNull()
    }
  })
})

describe('ECOMMERCE_REPORT_TEXTS', () => {
  it('has the 4 ids', () => {
    expect(Object.keys(ECOMMERCE_REPORT_TEXTS)).toEqual(['1', '2', '3', '4'])
  })

  it('takes name and description of 1 to 3 from REPORT_TEXTS', () => {
    ECOMMERCE_REPORT_LIST.slice(0, 3).forEach((entry) => {
      const texts = ECOMMERCE_REPORT_TEXTS[entry.id](defaultT)
      const advanced = REPORT_TEXTS[entry.advancedId](defaultT)
      expect(texts.name).toBe(advanced.name)
      expect(texts.description).toBe(advanced.description)
    })
  })

  it('keeps the literal call of main as the legacy name of 1 to 3', () => {
    const calls = []
    const spy = (key, fallback) => { calls.push([key, fallback]); return fallback }
    expect(ECOMMERCE_REPORT_TEXTS[1](spy).legacyName).toBe('Users')
    expect(ECOMMERCE_REPORT_TEXTS[2](spy).legacyName).toBe('Discount dashboard')
    expect(ECOMMERCE_REPORT_TEXTS[3](spy).legacyName).toBe('Dashboard with store map')
    expect(calls).toEqual(expect.arrayContaining([
      ['USERS', 'Users'],
      ['DISCOUNT_DASHBOARD', 'Discount dashboard'],
      ['STORE_MAP_DASHBOARD', 'Dashboard with store map']
    ]))
  })

  it('gives clicks its new name, description and the name of main', () => {
    const calls = []
    const spy = (key, fallback) => { calls.push([key, fallback]); return fallback }
    expect(ECOMMERCE_REPORT_TEXTS[4](spy)).toEqual({
      name: 'Clicks on stores, products and categories',
      description: 'What customers opened most in the apps and websites, in the period.',
      legacyName: 'Real time'
    })
    expect(calls).toEqual([
      ['ECOMMERCE_REPORT_CLICKS_NAME', 'Clicks on stores, products and categories'],
      ['ECOMMERCE_REPORT_CLICKS_DESCRIPTION', 'What customers opened most in the apps and websites, in the period.'],
      ['REAL_TIME', 'Real time']
    ])
  })

  it('translates through t', () => {
    const upper = (_key, fallback) => fallback.toUpperCase()
    expect(ECOMMERCE_REPORT_TEXTS[4](upper).name).toBe('CLICKS ON STORES, PRODUCTS AND CATEGORIES')
  })
})

// redesign (n.º 21, ecommerce P2): the page is merged into Enterprise reports
describe('getEcommerceReportsRedirectPath', () => {
  it.each([
    ['?id=1', '/intelligence/reports?id=1'],
    ['?id=2', '/intelligence/reports?id=2'],
    ['?id=3', '/intelligence/reports?id=3'],
    ['?id=4', '/intelligence/reports?id=22'],
    ['?foo=bar&id=4&x=1', '/intelligence/reports?id=22']
  ])('%s keeps the report', (search, path) => {
    expect(getEcommerceReportsRedirectPath(search)).toBe(path)
  })

  it.each([undefined, '', '?', '?id=', '?id=0', '?id=5', '?id=21', '?id=22', '?id=abc', '?id=1.5', '?id=01', '?tab=1'])(
    '%s lands on the catalog',
    (search) => {
      expect(getEcommerceReportsRedirectPath(search)).toBe('/intelligence/reports')
    }
  )

  it('maps ids 1 to 4 to Enterprise 1, 2, 3 and 22', () => {
    expect([1, 2, 3, 4].map(getEnterpriseIdOfEcommerceReport)).toEqual([1, 2, 3, 22])
    expect(getEnterpriseIdOfEcommerceReport(5)).toBeNull()
  })

  it('App.js redirects the route for level 0 only, as before, and no longer mounts the page', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.js'), 'utf8')
    expect(app).toMatch(/<ProtectedRoute path='\/intelligence\/ecommerce_reports' allowedLevels=\{\[0\]\}>\s*<Redirect to=\{getEcommerceReportsRedirectPath\(search\)\} \/>/)
    expect(app).not.toMatch(/pages\/EcommerceReports/)
  })
})

describe('getEcommerceLegacyAliases', () => {
  it('moves every search term of the retired page to Enterprise reports 1, 2, 3 and 22', () => {
    const aliases = getEcommerceLegacyAliases(defaultT)
    expect(Object.keys(aliases)).toEqual(['1', '2', '3', '22'])
    expect(aliases[1]).toEqual(expect.arrayContaining(['ecommerce', 'Ecommerce reports', 'Users', 'reporte de usuarios']))
    expect(aliases[2]).toEqual(expect.arrayContaining(['ecommerce', 'Ecommerce reports', 'Discount dashboard', 'descuentos', 'reporte de descuentos']))
    expect(aliases[3]).toEqual(expect.arrayContaining(['ecommerce', 'Ecommerce reports', 'Dashboard with store map', 'mapa de tiendas']))
    expect(aliases[22]).toEqual(expect.arrayContaining(['ecommerce', 'Ecommerce reports', 'Real time', 'tiempo real', 'en vivo', 'clics']))
  })

  it('translates the legacy names and the page name', () => {
    const t = (key, fallback) => ({ REAL_TIME: 'Tiempo exacto', COMMAND_PALETTE_ECOMMERCE_REPORTS: 'Informes de comercio' }[key] || fallback)
    expect(getEcommerceLegacyAliases(t)[22]).toEqual(expect.arrayContaining(['Tiempo exacto', 'Informes de comercio']))
  })
})
