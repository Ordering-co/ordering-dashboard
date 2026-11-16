// (D-62 · intelligence-business P3 · intelligence-reports P9): the shared BI keys with visible typos.
// The repo catalog is the source the final i18n:sync:live sends to the API (which today answers «Last 7 dyas», «Vlue»…);
// the code fallbacks are what a key missing from the API shows.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import catalog from '../../../../../../i18n/translations.json'

const root = resolve(__dirname, '../../../../../..')
const source = (path) => readFileSync(resolve(root, path), 'utf8')
const TYPOS = /safisf|dyas\b|\bVlue\b|Ramge|Tdoay|Yesterdya/i

describe('BI catalog typos', () => {
  it.each(['LAST_7_DAYS', 'VALUE', 'CUSTOMER_SATISFACTION', 'CUSTOMER_SATISFACTION_DESC', 'REGISTER_USERS', 'TOP_SELLING_AND_CATEOGRY', 'HEAT_MAP_WITH'])(
    '%s has no typo in any locale', (key) => {
      Object.values(catalog[key]).forEach(text => expect(text).not.toMatch(TYPOS))
    }
  )

  it('REGISTER_USERS names the users who registered, not an action', () => {
    expect(catalog.REGISTER_USERS.en).toBe('Registered users')
    expect(catalog.REGISTER_USERS.es).toBe('Usuarios registrados')
  })

  // HEAT_MAP_WITH («Heat map with») and the static legacy names stay: they are only the ⌘K aliases with the name main
  // painted, so the palette still finds each report by it (advancedReports.test.js).

  it.each([
    'src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsCustomerSatisfaction/index.js'
  ])('the fallbacks of %s have no typo', (path) => {
    const fallbacks = [...source(path).matchAll(/t\('[A-Z0-9_]+', '([^']*)'\)/g)].map(m => m[1])
    fallbacks.forEach(text => expect(text).not.toMatch(TYPOS))
    fallbacks.forEach(text => expect(text).not.toMatch(/^Register users$/i))
  })
})
