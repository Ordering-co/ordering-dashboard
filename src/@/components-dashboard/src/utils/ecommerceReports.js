import { ADVANCED_REPORT_GROUPS, REPORT_TEXTS, getAdvancedReport } from './advancedReports'

/**
 * Registry of the 4 reports of /intelligence/ecommerce_reports. Pure data, no React and no `t`: the page
 * and the command palette (⌘K) read the same list. Reports 1 to 3 are three of the 21 Enterprise reports
 * (same view, same requests); 4 is the clicks report, which has its own view.
 */

// redesign ecommerce FC (D1, D2): id of this page → report. `advancedId` points to the Enterprise report.
// `legacyKey`/`legacyName` are the name `main` painted: they stay as palette aliases.
export const ECOMMERCE_REPORT_LIST = [
  { id: 1, advancedId: 1, legacyKey: 'USERS', legacyName: 'Users', aliases: ['reporte de usuarios'] },
  { id: 2, advancedId: 2, legacyKey: 'DISCOUNT_DASHBOARD', legacyName: 'Discount dashboard', aliases: ['descuentos', 'reporte de descuentos'] },
  { id: 3, advancedId: 3, legacyKey: 'STORE_MAP_DASHBOARD', legacyName: 'Dashboard with store map', aliases: ['mapa de tiendas'] },
  {
    id: 4,
    kind: 'clicks',
    group: 'customers',
    legacyKey: 'REAL_TIME',
    legacyName: 'Real time',
    aliases: ['tiempo real', 'en vivo', 'clics'],
    endpoint: 'tracking_events',
    pills: ['country', 'brand', 'zone']
  }
]

const resolve = (entry) => {
  if (entry.advancedId === undefined) return entry
  const report = getAdvancedReport(entry.advancedId)
  return { ...entry, kind: 'advanced', report, group: report.group }
}

export const ECOMMERCE_REPORTS = ECOMMERCE_REPORT_LIST.map(resolve)

// The groups of the Enterprise catalog that have a report here, in the same order
export const ECOMMERCE_REPORT_GROUPS = ADVANCED_REPORT_GROUPS.filter(
  group => ECOMMERCE_REPORTS.some(entry => entry.group === group)
)

const REPORTS_BY_ID = new Map(ECOMMERCE_REPORTS.map(entry => [entry.id, entry]))

/**
 * The report of an id (number or string), or null when it is none of the 4:
 * `'5'`, `'21'` (valid Enterprise ids), `'0'`, `'abc'`, `'1.5'`, `null`.
 */
export const getEcommerceReport = (id) => {
  if (typeof id === 'string' && !/^[1-9]\d*$/.test(id)) return null
  if (typeof id !== 'string' && typeof id !== 'number') return null
  return REPORTS_BY_ID.get(Number(id)) || null
}

// redesign ecommerce FC (D2): literal t() calls (the i18n scanner only sees literals).
// 1 to 3 take name and description from the Enterprise report; `legacyName` is the call of main.
export const ECOMMERCE_REPORT_TEXTS = {
  1: (t) => ({
    name: REPORT_TEXTS[1](t).name,
    description: REPORT_TEXTS[1](t).description,
    legacyName: t('USERS', 'Users')
  }),
  2: (t) => ({
    name: REPORT_TEXTS[2](t).name,
    description: REPORT_TEXTS[2](t).description,
    legacyName: t('DISCOUNT_DASHBOARD', 'Discount dashboard')
  }),
  3: (t) => ({
    name: REPORT_TEXTS[3](t).name,
    description: REPORT_TEXTS[3](t).description,
    legacyName: t('STORE_MAP_DASHBOARD', 'Dashboard with store map')
  }),
  4: (t) => ({
    name: t('ECOMMERCE_REPORT_CLICKS_NAME', 'Clicks on stores, products and categories'),
    description: t('ECOMMERCE_REPORT_CLICKS_DESCRIPTION', 'What customers opened most in the apps and websites, in the period.'),
    legacyName: t('REAL_TIME', 'Real time')
  })
}

// redesign (n.º 21, ecommerce P2): /intelligence/ecommerce_reports is retired and redirects into Enterprise reports.
// Reports 1 to 3 are Enterprise reports 1 to 3; Clicks (4 here) is Enterprise report 22.
export const ECOMMERCE_CLICKS_ENTERPRISE_ID = 22
const ENTERPRISE_REPORTS_PATH = '/intelligence/reports'

/** Enterprise report id of an id of the retired page (1 to 4), or null for any other value. */
export const getEnterpriseIdOfEcommerceReport = (id) => {
  const entry = getEcommerceReport(id)
  if (!entry) return null
  return entry.advancedId ?? ECOMMERCE_CLICKS_ENTERPRISE_ID
}

/**
 * Where an old link goes: `?id=1|2|3` keeps the report, `?id=4` (Clicks) is `?id=22`, anything else lands on the catalog.
 * `search` is the query string of /intelligence/ecommerce_reports.
 */
export const getEcommerceReportsRedirectPath = (search = '') => {
  const enterpriseId = getEnterpriseIdOfEcommerceReport(new URLSearchParams(search).get('id'))
  return enterpriseId ? `${ENTERPRISE_REPORTS_PATH}?id=${enterpriseId}` : ENTERPRISE_REPORTS_PATH
}

/**
 * Search terms the retired page had (⌘K), by Enterprise report id, so no search loses its report: `ecommerce`, the Spanish
 * aliases, the names `main` painted (translated, via literal `t()` calls in ECOMMERCE_REPORT_TEXTS) and the page name.
 */
export const getEcommerceLegacyAliases = (t) => {
  const pageName = t('COMMAND_PALETTE_ECOMMERCE_REPORTS', 'Ecommerce reports')
  return Object.fromEntries(ECOMMERCE_REPORTS.map(entry => [
    getEnterpriseIdOfEcommerceReport(entry.id),
    [...new Set([...entry.aliases, entry.legacyName, ECOMMERCE_REPORT_TEXTS[entry.id](t).legacyName, pageName, 'reportes de ecommerce', 'ecommerce'])]
  ]))
}
