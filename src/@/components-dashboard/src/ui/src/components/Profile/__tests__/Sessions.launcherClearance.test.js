// redesign (batch O, row 19 c): on a phone the fixed Mia launcher (48px circle, bottom right) covered the last sign-out
// control of /profile. The sessions card is the last block of the page, so on a phone it keeps room below it, equal to the
// launcher's footprint plus a gap, and the end of the scroll lands above the launcher. jsdom lays nothing out, so the contract is
// read from the stylesheets. The launcher and its z-index are not touched.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const sessionsCss = strip(readFileSync(path.join(__dirname, '..', 'Sessions', 'profile-sessions.css'), 'utf8'))
const launcherCss = strip(readFileSync(path.join(__dirname, '..', '..', 'Assistant', 'assistant.css'), 'utf8'))

describe('/profile sessions card clears the Mia launcher', () => {
  const phone = sessionsCss.split('@media (max-width: 767px)').slice(1).join('')

  it('reserves room below the card for the launcher offset, its height and a gap', () => {
    const rule = phone.match(/\.odc-profile-sessions \{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const value = rule[1].match(/margin-block-end:\s*calc\(([^;]*)\);/)
    expect(value).not.toBeNull()
    // the launcher sits at bottom: space-4 + space-1 + safe area and is target-coarse + space-1 tall
    expect(value[1]).toContain('var(--od-space-4)')
    expect(value[1]).toContain('var(--od-x-target-coarse)')
    expect(value[1]).toContain('env(safe-area-inset-bottom)')
    expect(value[1]).toContain('var(--od-space-3)')
  })

  // the launcher is visible at every width (only print hides it), so the room cannot live only below 768px
  it('also reserves the room from 768px up, where the launcher is a pill target-coarse + space-2 tall', () => {
    const wide = sessionsCss.split('@media (max-width: 767px)')[0]
    const rule = wide.match(/\.odc-profile-sessions \{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const value = rule[1].match(/margin-block-end:\s*calc\(([^;]*)\);/)
    expect(value).not.toBeNull()
    expect(value[1]).toContain('var(--od-space-4)')
    expect(value[1]).toContain('var(--od-space-1)')
    expect(value[1]).toContain('var(--od-x-target-coarse)')
    expect(value[1]).toContain('var(--od-space-2)')
    expect(value[1]).toContain('env(safe-area-inset-bottom)')
    expect(value[1]).toContain('var(--od-space-3)')
    // the pill (min-block-size) is the height the room has to cover
    expect(launcherCss.match(/\.odc-as-launcher \{([^}]*)\}/)[1]).toMatch(/min-block-size: calc\(var\(--od-x-target-coarse\) \+ var\(--od-space-2\)\);/)
  })

  it('leaves the launcher as it was: same offsets and a layer below the chrome', () => {
    const launcher = launcherCss.match(/\.odc-as-launcher \{([^}]*)\}/)[1]
    expect(launcher).toMatch(/position: fixed;/)
    expect(launcher).toMatch(/bottom: calc\(var\(--od-space-4\) \+ var\(--od-space-1\) \+ env\(safe-area-inset-bottom\)\);/)
    expect(launcher).toMatch(/z-index: calc\(var\(--od-x-layer-chrome\) - 10\);/)
  })
})
