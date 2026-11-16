// in Arabic the legacy editor of /my-products/dashboard (and the franchise website) put its labels and the theme's
// texts on the left: no node of the editor set the alignment, so they took Bootstrap's `text-align: left` of the body. The
// editor's root (Container) aligns to the start, so RTL reads from the right. The source as text, like touchTargets390.test.js.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(path.join(__dirname, '..', 'styles.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const template = (name) => {
  const start = source.indexOf(`export const ${name} = `)
  const end = source.indexOf('\nexport const ', start + 1)
  return source.slice(start, end < 0 ? undefined : end)
}

describe('legacy website editor · RTL alignment', () => {
  it('the editor root aligns its text to the start', () => {
    expect(template('Container')).toMatch(/text-align:\s*start;/)
  })
})
