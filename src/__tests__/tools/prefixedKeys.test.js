// a key that carries the app prefix (DASHBOARD_) never reaches the screen: t() strips it and reads another entry,
// and the catalog's own prefixed entry goes live with the prefix twice. i18n:verify rejects it in the catalog and in t().
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { findPrefixedKeys } = require('../../../i18n/prefixedKeys.cjs')
const { scanKeys } = require('../../../i18n/scanKeys.cjs')
const { loadConfig } = require('../../../i18n/loadConfig.cjs')
const catalog = require('../../../i18n/translations.json')

describe('i18n › keys with the app prefix', () => {
  it('flags a prefixed catalog key and a prefixed t() key', () => {
    const errors = findPrefixedKeys({ catalogKeys: ['CONNECT', 'DASHBOARD_CONNECT'], codeKeys: ['DASHBOARD_WITH_STORE_MAP', 'SAVE'], prefix: 'DASHBOARD_' })
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatch(/catalog key .*DASHBOARD_CONNECT/)
    expect(errors[1]).toMatch(/t\(\) key .*DASHBOARD_WITH_STORE_MAP/)
  })

  it('the catalog has no key with the prefix', () => {
    const { prefix } = loadConfig()
    expect(Object.keys(catalog).filter(key => key.startsWith(prefix))).toEqual([])
  })

  it('no static t() call in src/ uses the prefix', () => {
    const { prefix } = loadConfig()
    expect(scanKeys().rows.map(row => row.key).filter(key => key.startsWith(prefix))).toEqual([])
  })
})
