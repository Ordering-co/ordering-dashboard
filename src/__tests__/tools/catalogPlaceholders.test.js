// tanda P: DAY_N translated its own marker («Día {{día}}», «يوم {{يوم}}») in 9 languages, so the code that replaces
// {{day}} found nothing and the page showed the raw marker. Every translation keeps the markers of its English source.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const catalog = JSON.parse(readFileSync(resolve(__dirname, '../../../i18n/translations.json'), 'utf8'))
const markers = (text) => (String(text).match(/\{\{[^}]+\}\}|_[a-z]+_|%[sd]/g) || []).sort()

describe('i18n catalog markers', () => {
  it('every translation keeps the {{…}}, _x_ and %s/%d markers of the English text', () => {
    const lost = []
    for (const [key, row] of Object.entries(catalog)) {
      const source = markers(row.en || '').join(' ')
      for (const [locale, value] of Object.entries(row)) {
        if (locale === 'en' || !value) continue
        if (markers(value).join(' ') !== source) lost.push(`${key} [${locale}]`)
      }
    }
    expect(lost).toEqual([])
  })
})
