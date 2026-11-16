// The Builder website keeps one string per content (`homepage_content`, `footer_content`) and the site renders it as it is, so a `<style>`
// works there and a `<script>` does not run. The code view splits that string in two tabs (HTML, CSS) and joins them back into one string.
//
// The CSS only ever reaches this content. It is saved as a wrapper plus a rewritten stylesheet:
//   <div data-od-scope="abc123">
//   ...html...
//   </div>
//   <style>
//   [data-od-scope="abc123"] .promo a { ... }
//   </style>
// The editor shows the CSS without the prefix and adds it back on save. Scoping is text rewriting on purpose: the storefront supports old
// browsers, so native `@scope` and CSS nesting are out, and a text walker keeps the author's formatting and comments byte for byte (CSSOM
// would reserialize them). Whatever the walker does not understand is copied through, so it never drops characters.
//
// Only bare `<style>` blocks are split out. A `<style media>`, a `<link>` and every `<script>` stay in the HTML tab as written.
const STYLE = /<style>([\s\S]*?)<\/style>/gi
const WRAPPER = /^<div data-od-scope="([a-z0-9]+)">([\s\S]*)<\/div>$/
const LEADING = /^(?:\s|\/\*[\s\S]*?\*\/)*/
// Rules that hold other rules. Any other at-rule is copied whole (keyframe steps like `50%` must not be prefixed).
const GROUPING = /^@(?:media|supports|layer|container|document|starting-style)(?![\w-])/i

const prefixOf = (id) => `[data-od-scope="${id}"]`

export const newScopeId = () => {
  const id = Math.random().toString(36).slice(2, 8)
  return id.padEnd(6, '0')
}

// Index just past a comment, string or escape starting at `i`, or -1 when `i` starts none of them.
const skipOpaque = (css, i, limit) => {
  const c = css[i]
  if (c === '/' && css[i + 1] === '*') {
    const end = css.indexOf('*/', i + 2)
    return end === -1 || end + 2 > limit ? limit : end + 2
  }
  if (c === '\\') return Math.min(i + 2, limit)
  if (c === '"' || c === "'") {
    let j = i + 1
    while (j < limit) {
      if (css[j] === '\\') j += 2
      else if (css[j] === c) return j + 1
      else if (css[j] === '\n') return j // a bad string ends at the line break
      else j++
    }
    return limit
  }
  return -1
}

// Index of the first top-level `{`, `;` or `}` from `start`, or `limit` when there is none.
const findDelimiter = (css, start, limit) => {
  let depth = 0
  let i = start
  while (i < limit) {
    const skipped = skipOpaque(css, i, limit)
    if (skipped !== -1) {
      i = skipped
      continue
    }
    const c = css[i]
    if (c === '(' || c === '[') depth++
    else if ((c === ')' || c === ']') && depth > 0) depth--
    else if (depth === 0 && (c === '{' || c === ';' || c === '}')) return i
    i++
  }
  return limit
}

// Index of the `}` that closes the block opened at `open`, or `limit` when it never closes.
const findBlockEnd = (css, open, limit) => {
  let depth = 1
  let parens = 0
  let i = open + 1
  while (i < limit) {
    const skipped = skipOpaque(css, i, limit)
    if (skipped !== -1) {
      i = skipped
      continue
    }
    const c = css[i]
    if (c === '(') parens++
    else if (c === ')' && parens > 0) parens--
    else if (parens === 0 && c === '{') depth++
    else if (parens === 0 && c === '}' && --depth === 0) return i
    i++
  }
  return limit
}

// Splits a selector list on its top-level commas. The pieces joined with ',' give the list back.
const splitSelectors = (list) => {
  const parts = []
  let depth = 0
  let from = 0
  let i = 0
  while (i < list.length) {
    const skipped = skipOpaque(list, i, list.length)
    if (skipped !== -1) {
      i = skipped
      continue
    }
    const c = list[i]
    if (c === '(' || c === '[') depth++
    else if ((c === ')' || c === ']') && depth > 0) depth--
    else if (c === ',' && depth === 0) {
      parts.push(list.slice(from, i))
      from = i + 1
    }
    i++
  }
  parts.push(list.slice(from))
  return parts
}

// Applies `mapSelector` to the selector of each piece, keeping the whitespace and comments around it.
const mapSelectorList = (list, mapSelector) => splitSelectors(list).map((part) => {
  const lead = part.match(LEADING)[0]
  const body = part.slice(lead.length)
  const core = body.replace(/\s+$/, '')
  if (!core) return part
  return lead + mapSelector(core) + body.slice(core.length)
}).join(',')

const processRules = (css, from, limit, mapSelector) => {
  let out = ''
  let pos = from
  while (pos < limit) {
    const delimiter = findDelimiter(css, pos, limit)
    if (delimiter >= limit) {
      out += css.slice(pos, limit)
      break
    }
    if (css[delimiter] !== '{') {
      // A statement (`@import ...;`) or a stray `}`
      out += css.slice(pos, delimiter + 1)
      pos = delimiter + 1
      continue
    }
    const prelude = css.slice(pos, delimiter)
    const lead = prelude.match(LEADING)[0]
    const end = findBlockEnd(css, delimiter, limit)
    if (prelude[lead.length] === '@') {
      if (GROUPING.test(prelude.slice(lead.length))) {
        out += prelude + '{' + processRules(css, delimiter + 1, end, mapSelector)
        if (end < limit) out += '}'
      } else {
        out += css.slice(pos, Math.min(end + 1, limit))
      }
    } else {
      out += lead + mapSelectorList(prelude.slice(lead.length), mapSelector) + css.slice(delimiter, Math.min(end + 1, limit))
    }
    pos = end + 1
  }
  return out
}

export const scopeCss = (css, id) => {
  const prefix = prefixOf(id)
  return processRules(css, 0, css.length, (selector) => {
    const scope = selector.match(/^:scope(?![\w-])/i)
    return scope ? prefix + selector.slice(scope[0].length) : `${prefix} ${selector}`
  })
}

export const unscopeCss = (css, id) => {
  const prefix = prefixOf(id)
  return processRules(css, 0, css.length, (selector) => {
    if (!selector.startsWith(prefix)) return selector
    const rest = selector.slice(prefix.length)
    if (rest.startsWith(' ') && rest.trim() && !/^[>+~]/.test(rest.trimStart())) return rest.slice(1)
    return ':scope' + rest
  })
}

export const splitCode = (source) => {
  const text = source ?? ''
  const blocks = []
  const rest = text.replace(STYLE, (_match, body) => {
    blocks.push(body.replace(/^\n+|\s+$/g, ''))
    return ''
  })
  const html = rest.replace(/\n{3,}/g, '\n\n').trim()
  const css = blocks.filter(Boolean).join('\n\n')
  const wrapped = html.match(WRAPPER)
  if (wrapped) return { html: wrapped[2].trim(), css: unscopeCss(css, wrapped[1]), scopeId: wrapped[1] }
  // CSS saved before scoping existed, or written by hand: it gets its wrapper the next time the content is saved from here.
  return { html, css, scopeId: null }
}

// CSS goes after the markup, and always scoped: it only ever reaches this content.
export const joinCode = ({ html = '', css = '', scopeId = null }) => {
  const markup = html.trim()
  const sheet = css.trim()
  if (!sheet) return markup
  const id = scopeId || newScopeId()
  return `<div data-od-scope="${id}">\n${markup}\n</div>\n<style>\n${scopeCss(sheet, id)}\n</style>`
}
