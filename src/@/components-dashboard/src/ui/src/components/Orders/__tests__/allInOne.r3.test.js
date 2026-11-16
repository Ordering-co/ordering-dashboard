// redesign tramo A r3 (W0-QA1-02): /all-in-one, sub-bar of the order list on a phone. «Create custom order» sat on top of
// the Status pill (the pill's wrapper was shrunk to 38px by `flex: 1` and the 84px pill ran under the controls).
// Measured live at 390 and 320: elementFromPoint at the centre of Status returned «Create custom order» before; the pill after,
// and the touch probe reports 0 crossings. Here the CSS that does it is pinned (jsdom has no layout).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..', '..')
const read = file => readFileSync(path.join(COMPONENTS, file), 'utf8')

const styled = (source, name) => {
  const start = source.indexOf(`export const ${name} = styled`)
  expect(start, name).toBeGreaterThan(-1)
  const next = source.indexOf('\nexport const ', start + 10)
  return source.slice(start, next === -1 ? undefined : next)
}

describe('W0-QA1-02: the sub-bar of /all-in-one wraps on a phone instead of stacking controls', () => {
  const allInOne = read('Orders/AllInOne/styles.js')

  it('the row of controls wraps below 768px', () => {
    const block = styled(allInOne, 'OrderSubFilterControls')
    expect(block).toMatch(/\n {2}@media \(max-width: 767px\) \{\s*flex-wrap: wrap;\s*row-gap: 8px;/)
  })

  it('the Status wrapper keeps its pill: content width, no shrinking to zero basis, on a phone', () => {
    const block = styled(allInOne, 'OrderStatusSubFilterWrapper')
    const phone = block.match(/\n {2}@media \(max-width: 767px\) \{([^}]*)\}/)
    expect(phone, 'phone @media in the wrapper').toBeTruthy()
    expect(phone[1]).toMatch(/flex:\s*1 0 auto/)
    expect(phone[1]).toMatch(/min-width:\s*fit-content/)
  })

  it('the controls keep 8px between their rows and under them (Export has a 6px area above and below its 32px box)', () => {
    const controls = read('Orders/OrdersDashboardControls/styles.js')
    expect(styled(controls, 'InnerContnet')).toMatch(/@media \(max-width: 767px\) \{\s*row-gap: 8px;/)
    expect(styled(controls, 'OrderDashboardControlsContainer')).toMatch(/@media \(max-width: 767px\) \{\s*margin-bottom: 8px;/)
  })
})

describe('W0-QA1-02: the L3 guard pins the interpolations of the file, so the phone rules are static', () => {
  it('leaves the two dynamic expressions as the ruleset pinned them (no @media inside the isColumn interpolations)', () => {
    const allInOne = read('Orders/AllInOne/styles.js')
    for (const name of ['OrderSubFilterControls', 'OrderStatusSubFilterWrapper']) {
      const block = styled(allInOne, name)
      // eslint-disable-next-line no-template-curly-in-string
      const interpolation = block.slice(block.indexOf('${({ isColumn })'), block.indexOf('`}\n') + 2)
      expect(interpolation, name).not.toContain('@media')
    }
  })
})
