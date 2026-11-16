// redesign bugs F row 9: the i18n scanner picks the text of SYNC_DEC_SECOND. Two files use the key and tie 1-1 (the
// Deliverect screen has a typo, «Delivery Manger»; BusinessSyncBasic says «Manager»); the tie goes to the first file scanned, so
// the typo reached the catalog. TYPO_CORRECTIONS_SUBMODULE settles it without touching the vetoed Deliverect file.
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { scanKeys, TYPO_CORRECTIONS_SUBMODULE } = require('../../../i18n/scanKeys.cjs')

describe('i18n scanner › SYNC_DEC_SECOND', () => {
  it('chooses the English text without the «Manger» typo', () => {
    const row = scanKeys().rows.find(item => item.key === 'SYNC_DEC_SECOND')
    expect(row).toBeTruthy()
    expect(row.value).not.toMatch(/Manger/)
    expect(row.value).toContain('Delivery Manager app.')
  })

  it('keeps the correction in TYPO_CORRECTIONS_SUBMODULE', () => {
    expect(TYPO_CORRECTIONS_SUBMODULE.SYNC_DEC_SECOND).toMatch(/^Deliverect integrates all your /)
  })
})
