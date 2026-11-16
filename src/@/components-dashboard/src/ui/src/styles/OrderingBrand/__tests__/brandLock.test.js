import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkOffline } from '../../../../../../../../../scripts/brand-tokens.mjs'
import { ORDERING_BRAND } from '..'
import { variables } from '~/brand/ordering.tokens.generated'

/**
 * Offline parity for the Ordering.co brand adapter: the vendored tokens and
 * font match `brand/ordering-brand.lock.json`, the single token module
 * `src/brand/ordering.tokens.generated.js` comes from the same tokens, and
 * `OrderingBrand/allowlist.js` names variables that module provides. Fix the
 * lock with `pnpm brand:sync`, the module with
 * `node scripts/brand-system.mjs release-update`.
 */
describe('Ordering.co brand lock', () => {
  it('keeps vendored files, the token module and the allowlist in sync with the lock', async () => {
    expect(await checkOffline()).toEqual([])
  })

  it('defines every color variable in both color modes', () => {
    expect(Object.keys(ORDERING_BRAND.dark)).toEqual(Object.keys(ORDERING_BRAND.light))
    expect(ORDERING_BRAND.light['--od-action']).toBe('#266DF0')
  })

  it('takes every value from the single generated token module', () => {
    const pools = {
      root: [variables.root, variables.product],
      light: [variables.light, variables.root, variables.product],
      dark: [variables.dark, variables.root, variables.product]
    }
    for (const [scope, sources] of Object.entries(pools)) {
      for (const [name, value] of Object.entries(ORDERING_BRAND[scope])) {
        const source = sources.find(candidate => candidate[name] !== undefined)
        expect(source, `${scope} ${name} is not in src/brand/ordering.tokens.generated.js`).toBeDefined()
        expect(value, `${scope} ${name}`).toBe(source[name])
      }
    }
  })

  it('has no second generated token module next to the adapter', () => {
    expect(existsSync(resolve(__dirname, '../tokens.generated.js'))).toBe(false)
  })
})
