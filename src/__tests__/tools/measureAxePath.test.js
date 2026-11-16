// redesign messages R2.5: measure.mjs read axe-core from one machine's absolute path (/Users/aimac/…), so it failed with
// ENOENT on every other machine. The path is resolved from the installed @axe-core/playwright instead.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveAxeSource } from '../../../scripts/redesign/tools/axe-path.mjs'

const MEASURE = resolve(__dirname, '../../../scripts/redesign/tools/measure.mjs')

describe('measure.mjs · axe-core path', () => {
  it('resolves axe.min.js from the installed packages, on this machine', () => {
    const path = resolveAxeSource()
    expect(path).toMatch(/axe-core[\\/]axe\.min\.js$/)
    expect(existsSync(path)).toBe(true)
  })

  it('carries no absolute path of a user folder', () => {
    expect(readFileSync(MEASURE, 'utf8')).not.toMatch(/['"]\/Users\//)
  })
})
