import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// row 5 (O-4, K-3): the product is «Ordering.co» in every locale. The painted app descriptions dropped the old
// «Orderingplus» name, and the ORDERING key is the product name, not «pedido» / «Realizar pedidos».
const catalog = JSON.parse(readFileSync(resolve(__dirname, '../../../i18n/translations.json'), 'utf8'))

const PAINTED_KEYS = [
  'DRIVER_APP_FREE_TO_USE_DESCRIPTION', 'DRIVER_APP_BRANDED_DESCRIPTION', 'MULTI_STORE_CUSTOMER_APP_DESCRIPTION',
  'SINGLE_STORE_CUSTOMER_APP_DESCRIPTION', 'STORE_APP_FREE_TO_USE_DESCRIPTION', 'STORE_APP_BRANDED_DESCRIPTION',
  'POS_APP_FREE_TO_USE_DESCRIPTION'
]

describe('product name in the catalog', () => {
  it.each(PAINTED_KEYS)('%s names Ordering.co and starts each sentence with a capital', key => {
    for (const [locale, value] of Object.entries(catalog[key])) {
      expect(value, `${key}.${locale}`).not.toMatch(/orderingplus/i)
      expect(value, `${key}.${locale}`).toContain('Ordering.co')
      expect(value, `${key}.${locale}`).not.toMatch(/\. \p{Ll}/u)
    }
  })

  it('keeps ORDERING as the product name in every locale', () => {
    for (const [locale, value] of Object.entries(catalog.ORDERING)) {
      expect(value, `ORDERING.${locale}`).toBe('Ordering.co')
    }
  })
})
