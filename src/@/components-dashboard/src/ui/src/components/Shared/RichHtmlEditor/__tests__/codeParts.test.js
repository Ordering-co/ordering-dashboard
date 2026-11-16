import { describe, expect, it } from 'vitest'
import { joinCode, newScopeId, scopeCss, splitCode, unscopeCss } from '../codeParts'

const ID = 'abc123'
const P = `[data-od-scope="${ID}"]`

const isSubsequence = (original, output) => {
  let at = 0
  for (const ch of output) if (ch === original[at]) at++
  return at === original.length
}

describe('newScopeId', () => {
  it('is six lowercase base36 characters', () => {
    for (let i = 0; i < 200; i++) expect(newScopeId()).toMatch(/^[a-z0-9]{6}$/)
  })

  it('pads when Math.random gives fewer digits', () => {
    const original = Math.random
    Math.random = () => 0.5
    try {
      expect(newScopeId()).toMatch(/^[a-z0-9]{6}$/)
    } finally {
      Math.random = original
    }
  })
})

describe('scopeCss', () => {
  it('prefixes a simple rule with one space', () => {
    expect(scopeCss('.promo a:hover { color: red }', ID)).toBe(`${P} .promo a:hover { color: red }`)
  })

  it('prefixes every selector of a list and keeps the whitespace around them', () => {
    expect(scopeCss('h1,\n  h2 ,h3 {\n  margin: 0;\n}', ID)).toBe(`${P} h1,\n  ${P} h2 ,${P} h3 {\n  margin: 0;\n}`)
  })

  it('does not split on commas inside :is(), :not() or attribute values', () => {
    expect(scopeCss(':is(a, b) > i, :not(.x, .y) { top: 0 }', ID)).toBe(`${P} :is(a, b) > i, ${P} :not(.x, .y) { top: 0 }`)
    expect(scopeCss('[data-x="a,b"], p { top: 0 }', ID)).toBe(`${P} [data-x="a,b"], ${P} p { top: 0 }`)
    expect(scopeCss("[data-x='a,b'] { top: 0 }", ID)).toBe(`${P} [data-x='a,b'] { top: 0 }`)
  })

  it('gives html, body, :root and * no special treatment', () => {
    expect(scopeCss('html, body, :root, * { margin: 0 }', ID)).toBe(`${P} html, ${P} body, ${P} :root, ${P} * { margin: 0 }`)
  })

  it('handles the :scope forms', () => {
    expect(scopeCss(':scope { a: b }', ID)).toBe(`${P} { a: b }`)
    expect(scopeCss(':scope > p { a: b }', ID)).toBe(`${P} > p { a: b }`)
    expect(scopeCss(':scope:hover { a: b }', ID)).toBe(`${P}:hover { a: b }`)
    expect(scopeCss(':scope p { a: b }', ID)).toBe(`${P} p { a: b }`)
    expect(scopeCss(':scope, p { a: b }', ID)).toBe(`${P}, ${P} p { a: b }`)
  })

  it('keeps comments before a selector and inside a selector list', () => {
    expect(scopeCss('/* intro */\n.a { x: y }', ID)).toBe(`/* intro */\n${P} .a { x: y }`)
    expect(scopeCss('.a, /* second */ .b { x: y }', ID)).toBe(`${P} .a, /* second */ ${P} .b { x: y }`)
    expect(scopeCss('/* one */ /* two */ .a { x: y }', ID)).toBe(`/* one */ /* two */ ${P} .a { x: y }`)
  })

  it('does not read braces or commas inside comments as syntax', () => {
    expect(scopeCss('.a /* { , ; } */ { x: y }', ID)).toBe(`${P} .a /* { , ; } */ { x: y }`)
  })

  it('leaves strings with { } ; , alone', () => {
    const css = '.a::before { content: "{ } ; ," }\n.b::after { content: \'}\\\'{\' }'
    expect(scopeCss(css, ID)).toBe(`${P} .a::before { content: "{ } ; ," }\n${P} .b::after { content: '}\\'{' }`)
  })

  it('leaves url(data:...;base64,...) alone', () => {
    const css = '.a { background: url(data:image/png;base64,iVBOR/+w==) no-repeat }\n.b { top: 0 }'
    expect(scopeCss(css, ID)).toBe(`${P} .a { background: url(data:image/png;base64,iVBOR/+w==) no-repeat }\n${P} .b { top: 0 }`)
    const quoted = '.a { background: url("x;y{z}.png") }'
    expect(scopeCss(quoted, ID)).toBe(`${P} .a { background: url("x;y{z}.png") }`)
  })

  it('handles backslash escapes outside strings', () => {
    expect(scopeCss('.a\\,b, .c\\{ { x: y }', ID)).toBe(`${P} .a\\,b, ${P} .c\\{ { x: y }`)
  })

  it('copies statements unchanged', () => {
    const css = '@charset "utf-8";\n@import url("a.css") screen;\n@namespace svg url(http://x);\n@layer a, b;\n.a { x: y }'
    expect(scopeCss(css, ID)).toBe(`@charset "utf-8";\n@import url("a.css") screen;\n@namespace svg url(http://x);\n@layer a, b;\n${P} .a { x: y }`)
  })

  it('recurses into @media and @supports', () => {
    const css = '@media (max-width: 600px) {\n  .a, .b { x: y }\n}\n@supports (display: grid) { .c { x: y } }'
    expect(scopeCss(css, ID)).toBe(`@media (max-width: 600px) {\n  ${P} .a, ${P} .b { x: y }\n}\n@supports (display: grid) { ${P} .c { x: y } }`)
  })

  it('recurses into nested grouping rules and is case-insensitive', () => {
    const css = '@MEDIA screen { @supports (a: b) { @layer x { .a { x: y } } .b { x: y } } }\n@container (min-width: 1px) { .c { x: y } }'
    expect(scopeCss(css, ID)).toBe(`@MEDIA screen { @supports (a: b) { @layer x { ${P} .a { x: y } } ${P} .b { x: y } } }\n@container (min-width: 1px) { ${P} .c { x: y } }`)
  })

  it('handles @layer blocks, @document and @starting-style', () => {
    expect(scopeCss('@layer base { .a { x: y } }', ID)).toBe(`@layer base { ${P} .a { x: y } }`)
    expect(scopeCss('@starting-style { .a { x: y } }', ID)).toBe(`@starting-style { ${P} .a { x: y } }`)
  })

  it('leaves @keyframes untouched, vendor-prefixed too', () => {
    const css = '@keyframes spin { from { a: b } 50% { a: c } to { a: d } }\n@-webkit-keyframes spin { from { a: b } to { a: d } }\n.a { x: y }'
    expect(scopeCss(css, ID)).toBe(`@keyframes spin { from { a: b } 50% { a: c } to { a: d } }\n@-webkit-keyframes spin { from { a: b } to { a: d } }\n${P} .a { x: y }`)
  })

  it('leaves keyframes inside @media untouched', () => {
    const css = '@media screen { @keyframes k { from { a: b } to { a: c } } .a { x: y } }'
    expect(scopeCss(css, ID)).toBe(`@media screen { @keyframes k { from { a: b } to { a: c } } ${P} .a { x: y } }`)
  })

  it('leaves @font-face, @page, @property and unknown at-rules untouched', () => {
    const css = '@font-face { font-family: X; src: url(x.woff2) }\n@page :first { margin: 0 }\n@property --x { syntax: "<length>"; inherits: false }\n@counter-style c { system: cyclic }\n@font-feature-values X { @styleset { a: 1 } }\n@unknown foo { .a { x: y } }'
    expect(scopeCss(css, ID)).toBe(css)
  })

  it('leaves a declaration block with a nested rule untouched', () => {
    const css = '.a { color: red; .b { color: blue } &:hover { color: green } }\n.c { x: y }'
    expect(scopeCss(css, ID)).toBe(`${P} .a { color: red; .b { color: blue } &:hover { color: green } }\n${P} .c { x: y }`)
  })

  it('returns empty and whitespace-only css as it is', () => {
    expect(scopeCss('', ID)).toBe('')
    expect(scopeCss('  \n ', ID)).toBe('  \n ')
  })

  describe('unbalanced css', () => {
    const cases = {
      'missing closing brace': '.a { color: red;\n.b { x: y }',
      'missing closing brace in @media': '@media screen { .a { x: y }',
      'stray closing brace': '.a { x: y } }\n.b { x: y }',
      'stray closing brace first': '} .a { x: y }',
      'unterminated comment': '.a { x: y } /* oops\n.b { x: y }',
      'unterminated string': '.a::before { content: "oops }\n.b { x: y }',
      'unclosed paren': '.a:is(b, c { x: y }\n.d { x: y }',
      'selector without block': '.a, .b',
      'dangling backslash': '.a { x: y } \\'
    }
    for (const [name, css] of Object.entries(cases)) {
      it(`keeps every character and round-trips: ${name}`, () => {
        const scoped = scopeCss(css, ID)
        expect(isSubsequence(css, scoped)).toBe(true)
        expect(unscopeCss(scoped, ID)).toBe(css)
      })
    }

    it('still scopes the rules it understands', () => {
      expect(scopeCss('.a { x: y } }\n.b { x: y }', ID)).toBe(`${P} .a { x: y } }\n${P} .b { x: y }`)
      expect(scopeCss('.a { color: red;', ID)).toBe(`${P} .a { color: red;`)
    })
  })
})

describe('unscopeCss', () => {
  it('removes the prefix from each selector', () => {
    expect(unscopeCss(`${P} .a, ${P} .b { x: y }`, ID)).toBe('.a, .b { x: y }')
  })

  it('turns a bare prefix back into :scope', () => {
    expect(unscopeCss(`${P} { x: y }`, ID)).toBe(':scope { x: y }')
    expect(unscopeCss(`${P} > p { x: y }`, ID)).toBe(':scope > p { x: y }')
    expect(unscopeCss(`${P} + p, ${P} ~ p { x: y }`, ID)).toBe(':scope + p, :scope ~ p { x: y }')
    expect(unscopeCss(`${P}:hover { x: y }`, ID)).toBe(':scope:hover { x: y }')
  })

  it('leaves selectors without the prefix and other ids alone', () => {
    expect(unscopeCss('.a { x: y }', ID)).toBe('.a { x: y }')
    expect(unscopeCss('[data-od-scope="zzz999"] .a { x: y }', ID)).toBe('[data-od-scope="zzz999"] .a { x: y }')
  })

  it('recurses into grouping rules and skips keyframes', () => {
    expect(unscopeCss(`@media screen { ${P} .a { x: y } }\n@keyframes k { from { a: b } }`, ID))
      .toBe('@media screen { .a { x: y } }\n@keyframes k { from { a: b } }')
  })

  it('normalizes :scope followed by a descendant space', () => {
    expect(unscopeCss(scopeCss(':scope p { x: y }', ID), ID)).toBe('p { x: y }')
  })

  it('is the inverse of scopeCss', () => {
    const samples = [
      '.promo a:hover { color: red }',
      '/* intro */\nh1, /* mid */ h2 {\n  margin: 0;\n}\n\n@media (max-width: 600px) {\n  .a:is(b, c) { x: y }\n}',
      ':scope { a: b }\n:scope > p { a: b }\n:scope:hover { a: b }\n:scope + p, :scope ~ p { a: b }',
      '@import url("a.css");\n@keyframes k { from { a: b } 50% { a: c } to { a: d } }\n@font-face { font-family: X }',
      '.a { color: red; .b { color: blue } }',
      '[data-x="a,b"] , .c\t{ x: y }',
      'html, body, :root, * { margin: 0 }'
    ]
    for (const css of samples) expect(unscopeCss(scopeCss(css, ID), ID)).toBe(css)
  })
})

describe('splitCode', () => {
  it('returns empty parts for nothing', () => {
    const empty = { html: '', css: '', scopeId: null }
    expect(splitCode(undefined)).toEqual(empty)
    expect(splitCode(null)).toEqual(empty)
    expect(splitCode('')).toEqual(empty)
  })

  it('has no js key and no scoped flag: the css is always scoped', () => {
    expect(Object.keys(splitCode('<p>a</p>')).sort()).toEqual(['css', 'html', 'scopeId'])
  })

  it('reads css saved without a wrapper as it is, with no id yet', () => {
    expect(splitCode('<p>a</p>\n<style>\n.a { x: y }\n</style>')).toEqual({
      html: '<p>a</p>',
      css: '.a { x: y }',
      scopeId: null
    })
  })

  it('reads the scoped wrapper and unscopes the css', () => {
    const saved = `<div data-od-scope="${ID}">\n<p class="a">hi</p>\n</div>\n<style>\n${P} .a { x: y }\n${P} > p { x: y }\n</style>`
    expect(splitCode(saved)).toEqual({
      html: '<p class="a">hi</p>',
      css: '.a { x: y }\n:scope > p { x: y }',
      scopeId: ID
    })
  })

  it('does not take a wrapper with other attributes or uppercase ids', () => {
    const other = '<div data-od-scope="ABC123" class="x">\n<p>a</p>\n</div>\n<style>\n.a { x: y }\n</style>'
    expect(splitCode(other).scopeId).toBe(null)
    expect(splitCode(other).html).toBe('<div data-od-scope="ABC123" class="x">\n<p>a</p>\n</div>')
  })

  it('does not take a wrapper that does not wrap everything', () => {
    const partial = `<div data-od-scope="${ID}">\n<p>a</p>\n</div>\n<p>after</p>\n<style>\n.a { x: y }\n</style>`
    expect(splitCode(partial).scopeId).toBe(null)
  })

  it('keeps scripts in the html, bare or not', () => {
    const saved = '<p>a</p>\n<script>\nwindow.x = 1\n</script>\n<script src="a.js"></script>\n<style>\n.a { x: y }\n</style>'
    expect(splitCode(saved)).toEqual({
      html: '<p>a</p>\n<script>\nwindow.x = 1\n</script>\n<script src="a.js"></script>',
      css: '.a { x: y }',
      scopeId: null
    })
  })

  it('keeps <style media> and <link> in the html', () => {
    const saved = '<link rel="stylesheet" href="a.css">\n<style media="print">\n.a { x: y }\n</style>\n<p>a</p>'
    const parts = splitCode(saved)
    expect(parts.html).toBe(saved)
    expect(parts.css).toBe('')
  })

  it('joins several style blocks with a blank line and drops empty ones', () => {
    const saved = '<style>\n\n.a { x: y }\n\n</style>\n<p>a</p>\n<STYLE>\n   \n</STYLE>\n<style>\n.b { x: y }\n</style>'
    expect(splitCode(saved)).toEqual({
      html: '<p>a</p>',
      css: '.a { x: y }\n\n.b { x: y }',
      scopeId: null
    })
  })

  it('collapses runs of blank lines in the html', () => {
    expect(splitCode('<p>a</p>\n\n\n\n<p>b</p>').html).toBe('<p>a</p>\n\n<p>b</p>')
  })
})

describe('joinCode', () => {
  it('returns only the trimmed html when there is no css, with no wrapper', () => {
    expect(joinCode({ html: '  <p>a</p>\n', css: '  \n' })).toBe('<p>a</p>')
    expect(joinCode({ html: '<p>a</p>', css: '', scopeId: ID })).toBe('<p>a</p>')
    expect(joinCode({})).toBe('')
  })

  it('wraps the html and scopes the css', () => {
    expect(joinCode({ html: '<p class="a">hi</p>\n', css: '\n.a { x: y }\n:scope > p { x: y }\n', scopeId: ID }))
      .toBe(`<div data-od-scope="${ID}">\n<p class="a">hi</p>\n</div>\n<style>\n${P} .a { x: y }\n${P} > p { x: y }\n</style>`)
  })

  it('wraps an empty html', () => {
    expect(joinCode({ css: '.a { x: y }', scopeId: ID }))
      .toBe(`<div data-od-scope="${ID}">\n\n</div>\n<style>\n${P} .a { x: y }\n</style>`)
  })

  it('never writes css unscoped: without an id it makes one', () => {
    const joined = joinCode({ html: '<p>a</p>', css: '.a { x: y }' })
    const id = joined.match(/^<div data-od-scope="([a-z0-9]{6})">/)?.[1]
    expect(id).toBeTruthy()
    expect(joined).toBe(`<div data-od-scope="${id}">\n<p>a</p>\n</div>\n<style>\n[data-od-scope="${id}"] .a { x: y }\n</style>`)
  })
})

describe('round trips', () => {
  const parts = [
    { html: '<p class="a">hi</p>', css: '.a { x: y }', scopeId: ID },
    { html: '<section>\n  <h1>t</h1>\n</section>\n<script>\nwindow.x = 1\n</script>', css: '/* c */\nh1, h2 { a: b }\n\n@media screen { .a { x: y } }\n:scope { a: b }', scopeId: 'z9y8x7' },
    { html: '', css: '.a { x: y }', scopeId: ID }
  ]

  it('splitCode(joinCode(parts)) returns the same parts', () => {
    for (const part of parts) expect(splitCode(joinCode(part))).toEqual(part)
  })

  it('css saved without a wrapper comes back scoped, the same css and html', () => {
    const joined = joinCode(splitCode('<p>a</p>\n<style>\n.a { x: y }\n</style>'))
    const back = splitCode(joined)
    expect(back.html).toBe('<p>a</p>')
    expect(back.css).toBe('.a { x: y }')
    expect(back.scopeId).toMatch(/^[a-z0-9]{6}$/)
  })

  it('joinCode(splitCode(x)) is x for strings produced by joinCode', () => {
    const produced = [
      ...parts.map(joinCode),
      joinCode({ html: '<p>a</p>', css: '.a { x: y }' }),
      joinCode({ html: '<p>a</p>' })
    ]
    for (const x of produced) expect(joinCode(splitCode(x))).toBe(x)
  })
})
