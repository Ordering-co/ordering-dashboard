// redesign tramo A r2 (W0-PA1-02): coarseHitArea keeps the coarse-pointer trigger it had before W0-3d. Its 11 inherited hosts
// were never measured at phone width, so a mouse at 390px must not get their ::after.
import { describe, expect, it } from 'vitest'
import { coarseHitArea } from './touchTarget'

const cssText = coarseHitArea.join('')

describe('coarseHitArea trigger', () => {
  it('opens its media block for a coarse pointer only, not for a phone-width viewport', () => {
    expect(cssText).toMatch(/@media \(pointer: coarse\)\s*\{/)
    expect(cssText).not.toMatch(/max-width/)
  })
})
