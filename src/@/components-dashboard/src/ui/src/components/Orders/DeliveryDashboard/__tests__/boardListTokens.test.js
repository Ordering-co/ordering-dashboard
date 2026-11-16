// redesign deliveries-followups P4: the list column of the /deliveries board is 400 / 440 / 480px at 1024 / 1280 / 1440
// (DV-04). The widths are tokens of their own, --od-x-board-list-*, under their anchor in candidates.css, not neighbours' tokens
// (--od-x-dialog-sm, --od-x-panel-narrow) and a calc of the spacing scale.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', '..', '..')
const read = file => readFileSync(path.join(ROOT, file), 'utf8')
const BOARD = read('src/@/components-dashboard/src/ui/src/components/Orders/DeliveryDashboard/delivery-board.css').replace(/\/\*[\s\S]*?\*\//g, '')
const CANDIDATES = read('src/brand/candidates.css')

const listSizeAt = (minWidth) => {
  const scope = minWidth ? BOARD.slice(BOARD.indexOf(`@media (min-width: ${minWidth}px)`)) : BOARD
  return scope.match(/\.odb-board\s*\{[^}]*?--odb-list-size:\s*([^;]+);/)?.[1].trim()
}

describe('P4 · the board list widths are --od-x-board-list-* tokens', () => {
  it('candidates.css holds them under their anchor: 400, 440 and 480px', () => {
    const anchor = CANDIDATES.indexOf('/* deliveries-followups P4 light */')
    expect(anchor).toBeGreaterThan(-1)
    const block = CANDIDATES.slice(anchor, CANDIDATES.indexOf('}', anchor))
    expect(block).toMatch(/--od-x-board-list-sm:\s*400px;/)
    expect(block).toMatch(/--od-x-board-list-md:\s*440px;/)
    expect(block).toMatch(/--od-x-board-list-lg:\s*480px;/)
  })

  it.each([
    [null, 'var(--od-x-board-list-sm)'],
    [1280, 'var(--od-x-board-list-md)'],
    [1440, 'var(--od-x-board-list-lg)']
  ])('from %s the list takes %s', (minWidth, token) => {
    expect(listSizeAt(minWidth)).toBe(token)
  })

  it('no neighbour token and no calc set the width any more', () => {
    const declarations = [...BOARD.matchAll(/--odb-list-size:\s*([^;]+);/g)].map(([, value]) => value)
    expect(declarations).toHaveLength(3)
    declarations.forEach(value => expect(value).toMatch(/^var\(--od-x-board-list-(sm|md|lg)\)$/))
  })
})
