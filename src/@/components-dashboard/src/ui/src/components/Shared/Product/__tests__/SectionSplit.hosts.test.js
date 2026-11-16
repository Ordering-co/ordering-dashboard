import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign bugs F row 6 (D5 of stores 5.18): every host of P/SectionSplit adopts the opt-in `revealDetail`, so on a
// phone (stacked) the detail opens at its header (title, «‹ back», tabs) and not where the list was scrolled. Menu, payments and zones
// took it in 5.18; fees, customer fees, markups, promotions, taxes, channels, QR codes, store types and the shared menu products here.
// A new host must take it too.

const COMPONENTS = resolve(__dirname, '../../..')

const sources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name)
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
  return /\.jsx?$/.test(entry.name) ? [path] : []
})

// Each `<SectionSplit` opening tag, up to the `>` that closes it at depth 0 of the braces of its attributes.
const openingTags = source => {
  const tags = []
  let from = 0
  for (;;) {
    const start = source.indexOf('<SectionSplit', from)
    if (start === -1) return tags
    let depth = 0
    let end = start
    for (; end < source.length; end++) {
      const char = source[end]
      if (char === '{') depth++
      else if (char === '}') depth--
      else if (char === '>' && depth === 0) break
    }
    tags.push(source.slice(start, end + 1))
    from = end + 1
  }
}

const hosts = sources(COMPONENTS)
  .filter(path => !path.includes(join('Shared', 'Product')))
  .map(path => ({ path: relative(COMPONENTS, path), tags: openingTags(readFileSync(path, 'utf8')) }))
  .filter(host => host.tags.length > 0)

describe('P/SectionSplit hosts (bugs F row 6, D5 of 5.18)', () => {
  it('finds the hosts (the scan is not empty)', () => {
    expect(hosts.length).toBeGreaterThanOrEqual(12)
  })

  it.each(hosts.map(host => [host.path, host.tags]))('%s passes revealDetail', (_path, tags) => {
    for (const tag of tags) expect(tag).toMatch(/\brevealDetail\b/)
  })
})
