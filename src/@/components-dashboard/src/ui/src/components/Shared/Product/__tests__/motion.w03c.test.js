// redesign W0-3c (T0-11, decisión 11c): panels, sheets, dialogs and their scrim enter and leave at the published Slow role
// (--od-duration-slow, 420ms); popovers and compact changes stay at Base. jsdom paints nothing, so the contract is pinned in the
// stylesheets (the computed transition-duration measured live is in the delivery notes). With prefers-reduced-motion: reduce an
// overlay fades or stays still: nothing translates, scales or keeps a keyframe animation.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const sheet = read('sheet.css')
const dialog = read('dialog.css')
const split = read('split-view.css')

/** The body of the first `selector { ... }` rule whose selector list is exactly `selector`. */
const rule = (source, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(source)
  return match ? match[1] : ''
}

/** Every `@media (prefers-reduced-motion: reduce) { ... }` body (balanced braces). */
const reduced = (source) => {
  const bodies = []
  let from = 0
  for (;;) {
    const at = source.indexOf('@media (prefers-reduced-motion: reduce)', from)
    if (at === -1) return bodies.join('\n')
    const open = source.indexOf('{', at)
    let depth = 0
    let end = open
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++
      if (source[end] === '}' && --depth === 0) break
    }
    bodies.push(source.slice(open + 1, end))
    from = end
  }
}

const declarations = (body, property) =>
  [...body.matchAll(new RegExp(`(?:^|[\\s;{])${property}\\s*:\\s*([^;}]+)`, 'g'))].map((m) => m[1].trim())

describe('overlay durations (W0-3c, decision 11c)', () => {
  it('the sheet slides at Slow', () => {
    expect(rule(sheet, '.odc-sheet')).toMatch(/transition-duration:\s*var\(--od-duration-slow\)/)
  })

  it('the dialog and its scrim enter and leave at Slow', () => {
    expect(rule(dialog, '.odc-overlay-backdrop')).toMatch(/transition:\s*opacity var\(--od-duration-slow\)/)
    expect(rule(dialog, '.odc-dialog')).toMatch(/transition-duration:\s*var\(--od-duration-slow\)/)
  })

  it('the split-view panel, and the overlay sheet it becomes, are Slow', () => {
    expect(rule(split, '.odc-split-panel')).toMatch(/animation:\s*odc-split-in var\(--od-duration-slow\)/)
    expect(rule(split, '.odc-split-overlay')).toMatch(/transition-duration:\s*var\(--od-duration-slow\)/)
  })

  it('nothing in these files is a popover or a compact change, so none stays at Base; the grip line keeps Fast', () => {
    for (const css of [sheet, dialog, split]) {
      expect(css).not.toMatch(/--od-duration-base/)
      expect(css).not.toMatch(/\b\d+(\.\d+)?m?s\b(?![-\w])/)
    }
    expect(rule(split, '.odc-split-sep::after')).toMatch(/transition:\s*background-color var\(--od-duration-fast\)/)
  })
})

describe('reduced motion (W0-3c)', () => {
  it.each([
    ['sheet.css', sheet],
    ['dialog.css', dialog],
    ['split-view.css', split]
  ])('%s declares a reduced-motion block', (_name, css) => {
    expect(reduced(css).length).toBeGreaterThan(0)
  })

  it.each([
    ['sheet.css', sheet],
    ['dialog.css', dialog],
    ['split-view.css', split]
  ])('%s leaves no transform, translate, scale or keyframe animation inside it', (_name, css) => {
    const body = reduced(css)
    expect(declarations(body, 'transform')).toEqual([])
    expect(declarations(body, 'scale')).toEqual([])
    for (const value of declarations(body, 'translate')) expect(value).toMatch(/^(none|0 0)$/)
    for (const value of declarations(body, 'animation')) expect(value).toBe('none')
    for (const value of declarations(body, 'transition')) expect(value).toBe('none')
    for (const value of declarations(body, 'transition-property')) expect(value).toBe('opacity')
  })

  it('the offset of the entering and leaving state is cancelled, including the phone bottom-sheet one', () => {
    for (const css of [sheet, dialog, split]) {
      const body = reduced(css)
      const states = [...body.matchAll(/([^{}]*\[data-(?:starting|ending)-style\][^{}]*)\{([^}]*)\}/g)]
      if (css === split) {
        // the inline panel is a keyframe animation: it is switched off, not offset
        expect(rule(body, '.odc-split-panel')).toMatch(/animation:\s*none/)
      }
      expect(states.length).toBeGreaterThan(0)
      for (const [, , declared] of states) expect(declared).toMatch(/translate:\s*0 0/)
    }
  })
})
