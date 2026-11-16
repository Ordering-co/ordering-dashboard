// redesign AH (overlap sweep): below 1024px /all-in-one scrolls inside OrdersListContainer, which has 20px of padding.
// A sticky box stops at its scroller's padding, so the List / Map switch (sticky at the top) stuck 20px below the top edge and the
// order cards and drivers showed above it while the page scrolled. The container names its top padding and the switch gives it back.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = path.join(__dirname, '..', 'AllInOne')
const css = readFileSync(path.join(dir, 'all-in-one-board.css'), 'utf8')
const styles = readFileSync(path.join(dir, 'styles.js'), 'utf8')

describe('/all-in-one below 1024px: the sticky List / Map switch reaches the top edge of the scroller', () => {
  it('the scroller names its top padding, the same 20px it draws', () => {
    const container = styles.match(/export const OrdersListContainer = styled\.div`([\s\S]*?)\n`/)[1]
    expect(container).toMatch(/\n {2}padding: 20px;/)
    expect(container).toMatch(/--aio-scroll-pad-start: 20px;/)
  })

  it('the switch sticks past that padding', () => {
    const block = css.match(/@media \(max-width: 1023px\) \{\s*\.aio-view \{([^}]*)\}/)
    expect(block, '.aio-view under 1024px').toBeTruthy()
    expect(block[1]).toMatch(/position: sticky;/)
    expect(block[1]).toMatch(/inset-block-start: calc\(var\(--aio-scroll-pad-start, 0\) \* -1\);/)
  })
})
