// redesign W0-8c (T0-32)
import { describe, expect, it } from 'vitest'
import {
  ALLOW_FILE,
  check,
  extractImports,
  formatReport,
  governedKind,
  loadAllow,
  resolveSpecifier
} from '../../../scripts/redesign/orders-import-guard.mjs'

const UI = 'src/@/components-dashboard/src/ui/src/components'
const entry = (file, specifier, extra = {}) => ({ file, import: specifier, reason: 'because', wave: 'W4-1', ...extra })

describe('orders import guard: the scanner', () => {
  it('reads every import form', () => {
    const source = [
      "import { A } from '../../Orders'",
      "import B from '../../Orders/OrdersManager'",
      "import '../../Orders/CreateCustomOrder/steps.css'",
      'import {',
      '  C,',
      "  D } from '~ui/src/components/Orders/DateTypeSelector'",
      "const E = await import('../../Orders/Lazy')",
      "const F = require('../../Orders/Cjs')",
      "vi.mock('../../Orders', () => ({}))",
      "export * from '../../Orders/Re'"
    ].join('\n')
    expect(extractImports(source).map(i => i.specifier)).toEqual([
      '../../Orders',
      '../../Orders/OrdersManager',
      '../../Orders/CreateCustomOrder/steps.css',
      '~ui/src/components/Orders/DateTypeSelector',
      '../../Orders/Lazy',
      '../../Orders/Cjs',
      '../../Orders/Re'
    ])
  })

  it('ignores commented imports and strings that are not imports', () => {
    const source = [
      "// import { A } from '../../Orders'",
      "/* import { B } from '../../Orders' */",
      "const label = '../../Orders'"
    ].join('\n')
    expect(extractImports(source)).toEqual([])
  })

  it('resolves relative paths, the three aliases, and leaves packages alone', () => {
    expect(resolveSpecifier(`${UI}/Users/UserDetails/index.js`, '../../Orders/OrdersManager')).toBe(`${UI}/Orders/OrdersManager`)
    expect(resolveSpecifier(`${UI}/Users/UserDetails/index.js`, '../../Orders')).toBe(`${UI}/Orders`)
    expect(resolveSpecifier('src/pages/X/index.js', '~ui/src/components/Orders')).toBe(`${UI}/Orders`)
    expect(resolveSpecifier('src/pages/X/index.js', '~components/ui/src/components/Orders/A')).toBe(`${UI}/Orders/A`)
    expect(resolveSpecifier('src/pages/X/index.js', '~/@/components-dashboard/src/ui/src/components/Orders/A')).toBe(`${UI}/Orders/A`)
    expect(resolveSpecifier('src/pages/X/index.js', 'react')).toBeNull()
    expect(resolveSpecifier('src/pages/X/index.js', '~ui')).toBe('src/@/components-dashboard/src/ui')
  })

  it('decides which rule governs a file', () => {
    expect(governedKind(`${UI}/Orders/OrdersManager/index.js`)).toBeNull()
    expect(governedKind(`${UI}/Stores/Foo/index.js`)).toBe('ui')
    expect(governedKind(`${UI}/Stores/Foo/__tests__/Foo.test.jsx`)).toBeNull()
    expect(governedKind(`${UI}/Shared/Product/Sheet.jsx`)).toBe('product')
    expect(governedKind(`${UI}/Shared/Product/__tests__/Sheet.test.jsx`)).toBe('product')
    expect(governedKind('src/pages/OrdersList/index.js')).toBeNull()
    expect(governedKind('src/pages/StoresList/index.js')).toBe('page')
    expect(governedKind(`${UI}/Stores/Foo/foo.css`)).toBeNull()
  })
})

describe('orders import guard: the check', () => {
  const file = `${UI}/Users/UserDetails/index.js`
  const source = "import { OrdersManager } from '../../Orders/OrdersManager'\n"

  it('fails a new import from Orders outside Orders', () => {
    const result = check({ sources: { [file]: source }, allow: [] })
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({ file, import: '../../Orders/OrdersManager', line: 1 })
    expect(formatReport(result)).toContain(`FAIL ${file}:1 imports '../../Orders/OrdersManager'`)
  })

  it('fails the barrel form and the alias form', () => {
    const sources = {
      [`${UI}/Stores/A/index.js`]: "import { DateTypeSelector } from '../../Orders'\n",
      [`${UI}/Stores/B/index.js`]: "import { X } from '~ui/src/components/Orders/X'\n"
    }
    expect(check({ sources, allow: [] }).violations).toHaveLength(2)
  })

  it('fails a page outside the Orders pages, passes OrdersList', () => {
    const text = "import { X } from '~ui/src/components/Orders/X'\n"
    expect(check({ sources: { 'src/pages/StoresList/index.js': text }, allow: [] }).violations).toHaveLength(1)
    expect(check({ sources: { 'src/pages/OrdersList/index.js': text }, allow: [] }).ok).toBe(true)
  })

  it('passes imports inside Orders and a listed import', () => {
    const inside = { [`${UI}/Orders/OrdersTable/index.js`]: "import { A } from '../OrdersManager'\n" }
    expect(check({ sources: inside, allow: [] }).ok).toBe(true)
    const result = check({ sources: { [file]: source }, allow: [entry(file, '../../Orders/OrdersManager')] })
    expect(result.ok).toBe(true)
    expect(result.allowed).toBe(1)
  })

  it('fails Shared/Product importing from Orders even when it is listed', () => {
    const product = `${UI}/Shared/Product/Sheet.jsx`
    const text = "import { X } from '../../Orders/OrdersManager'\n"
    const unlisted = check({ sources: { [product]: text }, allow: [] })
    expect(unlisted.ok).toBe(false)
    expect(unlisted.violations[0].why).toMatch(/Shared\/Product must never import from Orders/)

    const listed = check({ sources: { [product]: text }, allow: [entry(product, '../../Orders/OrdersManager')] })
    expect(listed.ok).toBe(false)
    expect(listed.violations).toHaveLength(1)
    expect(listed.invalid).toHaveLength(1)
    expect(listed.invalid[0].problems.join(' ')).toMatch(/no list for it/)
  })

  it('fails Shared/Product tests too', () => {
    const test = `${UI}/Shared/Product/__tests__/Sheet.test.jsx`
    const result = check({ sources: { [test]: "import { X } from '../../../Orders'\n" }, allow: [] })
    expect(result.ok).toBe(false)
  })

  it('fails an expired entry: the import is gone', () => {
    const result = check({ sources: { [file]: "import React from 'react'\n" }, allow: [entry(file, '../../Orders/OrdersManager')] })
    expect(result.ok).toBe(false)
    expect(result.stale).toHaveLength(1)
    expect(formatReport(result)).toContain('stale entry')
  })

  it('fails an entry whose file was deleted (full run)', () => {
    const ghost = entry(`${UI}/Users/Ghost/index.js`, '../../Orders')
    const result = check({ allow: [...loadAllow(), ghost] })
    expect(result.ok).toBe(false)
    expect(result.stale).toEqual([ghost])
  })

  it('fails an incomplete or duplicated entry', () => {
    const noReason = check({ sources: { [file]: source }, allow: [{ file, import: '../../Orders/OrdersManager', wave: 'W4-1' }] })
    expect(noReason.ok).toBe(false)
    expect(noReason.invalid[0].problems).toContain('missing reason')
    const twice = check({ sources: { [file]: source }, allow: [entry(file, '../../Orders/OrdersManager'), entry(file, '../../Orders/OrdersManager')] })
    expect(twice.ok).toBe(false)
    expect(twice.invalid[0].problems).toContain('duplicate entry')
  })

  it('with a family, only judges that family', () => {
    const other = entry(`${UI}/Delivery/UserDetails/index.js`, '../../Orders/OrdersManager')
    const result = check({ family: `${UI}/Users`, allow: [...loadAllow()] })
    expect(result.ok).toBe(true)
    expect(result.allowed).toBe(loadAllow().filter(e => e.file.startsWith(`${UI}/Users/`)).length)
    // An entry from another family is not judged (not stale) while the family's own imports still count.
    const foreign = check({ family: `${UI}/Users`, allow: [other] })
    expect(foreign.stale).toEqual([])
    expect(foreign.violations.length).toBeGreaterThan(0)
  })
})

describe('orders import guard: the real repository', () => {
  const allow = loadAllow()

  it('passes today with its list', () => {
    const result = check()
    expect(formatReport(result)).toMatch(/orders-import-guard: OK/)
    expect(result.ok).toBe(true)
    expect(result.allowed).toBe(allow.length)
  })

  it('lists every entry with a reason and a wave, none in Shared/Product', () => {
    expect(allow.length).toBeGreaterThan(0)
    for (const e of allow) {
      expect(e.reason).toBeTruthy()
      expect(e.wave).toMatch(/^W\d/)
      expect(e.file).not.toContain('/Shared/Product/')
    }
    expect(ALLOW_FILE).toMatch(/orders-import-allow\.json$/)
  })

  it('mutation: removing any real entry turns the guard red, naming the import', () => {
    allow.forEach((removed, index) => {
      const result = check({ allow: allow.filter((_, i) => i !== index) })
      expect(result.ok).toBe(false)
      expect(result.violations.map(v => `${v.file} ${v.import}`)).toContain(`${removed.file} ${removed.import}`)
    })
  }, 60000) // redesign W0 tramo B r2: one full scan per entry; 5s timed out in the full suite under load (W0-D-04 class)
})
