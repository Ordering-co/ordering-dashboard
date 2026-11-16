// (review R2): «Driver store status» was translated as a data store of a software driver (ar مخزن, el
// «προγραμμάτων οδήγησης», it «archivio», pt «repositório», tr «Depo»), and 38 Greek delivery values called the driver a
// device driver. A driver is the catalog's DRIVER term in each language and a store is a shop.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const catalog = JSON.parse(readFileSync(path.resolve(__dirname, '../../../../../../../../../../i18n/translations.json'), 'utf8'))

describe('driver and store terms in the catalog', () => {
  it('DRIVER_STORE_STATUS speaks of a shop and a delivery driver', () => {
    const value = catalog.DRIVER_STORE_STATUS
    expect(value.ar).not.toMatch(/مخزن/)
    expect(value.el).not.toMatch(/προγραμμ/)
    expect(value.it).not.toMatch(/archivio/i)
    expect(value.pt).not.toMatch(/reposit/i)
    expect(value.tr).not.toMatch(/Depo/)
    for (const locale of ['ar', 'el', 'it', 'pt', 'tr']) {
      expect(value[locale].toLowerCase(), locale).toContain(catalog.DRIVER[locale].toLowerCase().slice(0, 4))
    }
  })

  it('no Greek value calls a driver a device driver (προγράμματα οδήγησης)', () => {
    const wrong = Object.entries(catalog)
      .filter(([, value]) => /προγραμμάτων οδήγησης|προγράμματα οδήγησης|πρόγραμμα οδήγησης/.test(value.el || ''))
      .map(([key]) => key)
    expect(wrong).toEqual([])
  })

  it('no Arabic store value says warehouse (مخزن) where English says store', () => {
    for (const key of ['EXCLUDE_STORE_OF_GOOGLE_FEEDS', 'STORE_MESSAGE_1', 'STORE_MESSAGE_2', 'STORE_MESSAGE_3', 'STORE_MESSAGE_4']) {
      expect(catalog[key].ar, key).not.toMatch(/مخزن/)
    }
  })
})
