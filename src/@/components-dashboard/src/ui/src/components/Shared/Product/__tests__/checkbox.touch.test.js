import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// tanda P: decision 12 gives every control a 44px area on a coarse pointer OR below 768px, as switch.css and field.css
// do. The checkbox only grew on a coarse pointer, so in a narrow window with a mouse a click 14px from the box of a card fell on the
// card's link and opened the record; and the «Select all» row stayed 32px tall.
const css = readFileSync(resolve(__dirname, '../checkbox.css'), 'utf8')

describe('P/Checkbox · the touch area', () => {
  it('grows to 44px on a coarse pointer or below 768px, the box and the labelled row alike', () => {
    const touch = css.slice(css.indexOf('@media (pointer: coarse), (max-width: 767px)'))
    expect(css).toContain('@media (pointer: coarse), (max-width: 767px)')
    expect(touch).toMatch(/\.odc-checkbox \{[^}]*inline-size:\s*var\(--od-x-target-coarse\)[^}]*block-size:\s*var\(--od-x-target-coarse\)/)
    expect(touch).toMatch(/\.odc-checkbox-labelled \{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
  })

  it('has no rule for the coarse pointer alone', () => {
    expect(css).not.toMatch(/@media \(pointer: coarse\) \{/)
  })
})
