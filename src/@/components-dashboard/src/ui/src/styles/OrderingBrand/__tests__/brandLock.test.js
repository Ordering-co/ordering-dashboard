import { describe, expect, it } from 'vitest'
import { checkOffline } from '../../../../../../../../../scripts/brand-tokens.mjs'
import { ORDERING_BRAND } from '../tokens.generated'

/**
 * Offline parity for the Ordering.co brand adapter: the vendored tokens and
 * font match `brand/ordering-brand.lock.json`, and the generated variables
 * match the vendored tokens. Fix with `pnpm brand:sync`.
 */
describe('Ordering.co brand lock', () => {
  it('keeps vendored files and generated variables in sync with the lock', () => {
    expect(checkOffline()).toEqual([])
  })

  it('defines every color variable in both color modes', () => {
    expect(Object.keys(ORDERING_BRAND.dark)).toEqual(Object.keys(ORDERING_BRAND.light))
    expect(ORDERING_BRAND.light['--od-action']).toBe('#266DF0')
  })
})
