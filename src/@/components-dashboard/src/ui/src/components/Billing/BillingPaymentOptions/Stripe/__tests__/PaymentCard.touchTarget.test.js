// redesign (batch O, row 19 a): the ⋮ of a saved card measured 26x24 at 390px. The 44px area comes from a centred
// `::after` on the button, active on a coarse pointer or below 768px, so the visible 26x24 box and the menu (`top: 100%` of the
// wrapper) do not move. jsdom evaluates no media query or pseudo-element, so the contract is read from the stylesheet text.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(path.join(__dirname, '..', 'styles.js'), 'utf8')

const block = (name) => {
  const start = source.indexOf(`export const ${name} = `)
  const next = source.indexOf('\nexport const ', start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

describe('Stripe saved card ⋮ touch target', () => {
  const wrapper = block('CardItemActionsWrapper')

  it('keeps the visible 26x24 box', () => {
    expect(wrapper).toMatch(/width: 26px;/)
    expect(wrapper).toMatch(/height: 24px;/)
  })

  it('grows the hit area to 44px with a centred ::after on a coarse pointer or a phone width', () => {
    expect(wrapper).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\) \{/)
    const media = wrapper.slice(wrapper.indexOf('@media (pointer: coarse), (max-width: 767px)'))
    expect(media).toMatch(/position: relative;/)
    expect(media).toMatch(/&::after \{/)
    expect(media).toMatch(/position: absolute;/)
    expect(media).toMatch(/top: 50%;/)
    expect(media).toMatch(/left: 50%;/)
    expect(media).toMatch(/width: max\(100%, var\(--od-touch-target-minimum, 44px\)\);/)
    expect(media).toMatch(/height: max\(100%, var\(--od-touch-target-minimum, 44px\)\);/)
    expect(media).toMatch(/transform: translate\(-50%, -50%\);/)
  })

  it('does not grow the box with min-width or min-height, so the menu at top: 100% stays put', () => {
    expect(wrapper).not.toMatch(/min-(width|height)/)
    expect(block('ActionsContent')).toMatch(/top: 100%;/)
  })
})
