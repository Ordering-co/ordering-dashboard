// (review R1): the head of /orders keeps «Create custom order» whole and lets the title truncate (F6b, D-18),
// so the button's label decides how much title is left. In German it read «Erstellen Sie eine benutzerdefinierte
// Bestellung» (320px at 1440 with the panel open), and the title «Bestellliste» fell to «Be…». The label is a short
// infinitive like the English one; Danish and Dutch said «custom sequence» (rækkefølge, volgorde) instead of an order.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const catalog = JSON.parse(readFileSync(path.resolve(__dirname, '../../../../../../../../../../i18n/translations.json'), 'utf8'))
const label = catalog.CREATE_CUSTOM_ORDER

describe('CREATE_CUSTOM_ORDER keeps the head of /orders readable', () => {
  it('is short in every locale: never more than twice the English label', () => {
    for (const [locale, text] of Object.entries(label)) {
      expect(text.length, locale).toBeGreaterThan(0)
      expect(text.length, `${locale}: ${text}`).toBeLessThanOrEqual(label.en.length * 2)
    }
  })

  it('says «order» in German, Danish and Dutch, not a polite imperative or a sequence', () => {
    expect(label.de).toBe('Bestellung erstellen')
    expect(label.da).toBe('Opret tilpasset ordre')
    expect(label.nl).toBe('Aangepaste bestelling maken')
  })
})
