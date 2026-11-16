// (review R1): in the Filters sheet the empty text of the legacy pickers (Delivery type, Country, City,
// Currency, Driver group, Payment method) is an Option / PlaceholderTitle box with 10px of padding, so those controls
// measured 39 and 35px beside the 30–32px of Order ID, Date, Business or Administrator, with the text 10px further in,
// and City's «Select City» took the value colour. Inside the sheet that box takes the trigger's line, indent and
// placeholder colour. Live at 1440: every control 32px, text 11px from the edge (before: 40.9 / 37px and 21px).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(__dirname, '../orders-filter-group.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const emptyText = css.match(/\.odc-ofs-body \.od-multi-select-trigger > :not\(\.od-multi-select-header, \.od-multi-select-chevron\) > \*\s*\{([^}]*)\}/)?.[1] ?? null

describe('Filters sheet · the empty text of a legacy picker', () => {
  it('has a rule for the box inside the trigger’s empty text', () => {
    expect(emptyText).not.toBeNull()
  })

  it('drops the legacy padding, so the control keeps the sheet height and the text its indent', () => {
    expect(emptyText).toMatch(/padding:\s*0/)
    expect(emptyText).toMatch(/line-height:\s*inherit/)
  })

  it('takes the placeholder colour of the trigger’s empty text (City drew it in the value colour)', () => {
    expect(emptyText).toMatch(/color:\s*inherit/)
  })
})
