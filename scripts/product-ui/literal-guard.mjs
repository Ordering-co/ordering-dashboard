/**
 * Literal guard for new pilot code (orders pilot, Part 2, wave 4).
 *
 * New product code reads every color, size, space, weight, line height and
 * duration from a variable: --od-* (release) or --od-x-* (candidates, in
 * src/brand/candidates.css). This scanner reports literal values so the test
 * can fail on them. It is deliberately strict:
 *
 *  - CSS: every declaration value is checked. Breakpoints in @media/@container
 *    preludes are the only lengths allowed (a var() cannot go there).
 *  - JS/JSX: string literals with colors or lengths, and numeric inline styles
 *    on size properties.
 *
 * Allowed without a variable: 0, percentages, fr, viewport units (layout, not
 * design values), unitless multipliers inside calc(), flex factors,
 * opacity, and keywords (transparent, currentColor, inherit, none, auto…).
 *
 * redesign W0-5 (T0-17): z-index is no longer in that list. It reads the layer
 * scale (--od-x-layer-*, src/brand/candidates.css): `var(--od-x-layer-<role>)`,
 * `calc(var(--od-x-layer-<role>) + n)` (also `- n`, `* -1`), the overlay
 * registry's `var(--od-dialog-layer)`, or the keywords auto / inherit / initial /
 * unset / revert. Any number (0 and -1 included) is a finding.
 */

const COLOR_NAMES = [
  'white', 'black', 'red', 'green', 'blue', 'gray', 'grey', 'orange', 'yellow',
  'pink', 'purple', 'silver', 'navy', 'teal', 'maroon', 'olive', 'lime', 'aqua', 'fuchsia'
]
const HEX = /#[0-9a-f]{3,8}\b/i
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
const NAMED = new RegExp(`(^|[\\s,(:])(${COLOR_NAMES.join('|')})(?=$|[\\s,);!])`, 'i')
const LENGTH = /(^|[^\w-])-?(?:\d*\.)?\d+(px|rem|em|pt|pc|cm|mm|in|q|ex|ch|ms|s)\b/i
// Unitless numbers are fine for these properties (they are not design values).
const UNITLESS_OK = /^(flex|flex-grow|flex-shrink|order|opacity|scale|grid-row|grid-column|grid-area|counter-increment|counter-reset|tab-size|orphans|widows|-webkit-line-clamp|line-clamp|animation-iteration-count|fill-opacity|stroke-opacity|aspect-ratio)$/i
// Unitless numbers that ARE design values and must come from a token.
const UNITLESS_TOKENISED = /^(font-weight|line-height|letter-spacing|stroke-width)$/i

// redesign W0-5 (T0-17): the only z-index values governed code may hold.
const LAYER_ROLE = '(?:raised|sticky|chrome|drawer|overlay|notice)'
const Z_INDEX_OK = new RegExp(
  `^(?:auto|inherit|initial|unset|revert|var\\(--od-x-layer-${LAYER_ROLE}\\)|var\\(--od-dialog-layer\\)` +
  `|calc\\(\\s*var\\(--od-x-layer-${LAYER_ROLE}\\)\\s*(?:[+-]\\s*\\d+|\\*\\s*-1)\\s*\\))$`, 'i')

const lineOf = (text, index) => text.slice(0, index).split('\n').length

const stripCssComments = text => text.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))

const checkValue = (property, value) => {
  if (/^z-index$/i.test(property)) return Z_INDEX_OK.test(value.trim()) ? null : 'literal z-index'
  const clean = value
    .replace(/url\([^)]*\)/gi, 'url()')
    .replace(/var\(--[\w-]+/g, 'var(--x')
    .trim()
  if (HEX.test(clean)) return 'hex color'
  if (COLOR_FN.test(clean)) return 'color function'
  if (NAMED.test(clean)) return 'named color'
  if (LENGTH.test(clean)) return 'literal length or duration'
  if (UNITLESS_TOKENISED.test(property)) {
    const withoutVars = clean.replace(/var\([^)]*\)/g, '')
    if (/(^|[^\w-])(?:\d*\.)?\d+\b/.test(withoutVars) && !/^(normal|inherit|initial|unset)$/i.test(withoutVars)) {
      return `literal ${property}`
    }
  }
  return null
}

/** Scans plain CSS. Returns [{ line, property, value, reason }]. */
export const scanCss = source => {
  const text = stripCssComments(source)
  const findings = []
  let depth = 0
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '{') {
      depth += 1
      start = index + 1
    } else if (char === ';' || char === '}') {
      const segment = text.slice(start, index)
      const colon = segment.indexOf(':')
      if (depth > 0 && colon > -1) {
        const property = segment.slice(0, colon).trim()
        const value = segment.slice(colon + 1).replace(/!important/i, '').trim()
        // Custom property declarations are checked like any other value.
        if (/^[-\w]+$/.test(property) && !/^@/.test(property)) {
          const reason = checkValue(property, value)
          const offset = start + segment.indexOf(property)
          if (reason) findings.push({ line: lineOf(text, offset), property, value, reason })
        }
      }
      if (char === '}') depth = Math.max(0, depth - 1)
      start = index + 1
    }
  }
  return findings
}

const SIZE_PROPS = 'width|height|minWidth|minHeight|maxWidth|maxHeight|inlineSize|blockSize|minInlineSize|minBlockSize|maxInlineSize|maxBlockSize|margin|marginTop|marginBottom|marginLeft|marginRight|marginInline|marginBlock|marginInlineStart|marginInlineEnd|marginBlockStart|marginBlockEnd|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingInline|paddingBlock|paddingInlineStart|paddingInlineEnd|paddingBlockStart|paddingBlockEnd|gap|rowGap|columnGap|top|left|right|bottom|inset|insetInline|insetBlock|insetInlineStart|insetInlineEnd|fontSize|lineHeight|letterSpacing|fontWeight|borderRadius|borderWidth'
const NUMERIC_STYLE = new RegExp(`\\b(${SIZE_PROPS})\\s*:\\s*-?(?:\\d*\\.)?[1-9]\\d*`, 'g')
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g

/** Scans JS/JSX source for literal colors and sizes. */
export const scanJs = source => {
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (match, lead) => lead + ' '.repeat(match.length - lead.length))
  const findings = []
  for (const match of text.matchAll(STRING_LITERAL)) {
    const value = match[2]
    // import specifiers and test ids are not values
    if (/^[./~@]/.test(value) && !/\s/.test(value)) continue
    let reason = null
    if (HEX.test(value)) reason = 'hex color'
    else if (COLOR_FN.test(value)) reason = 'color function'
    else if (/(^|[\s:(,])-?(?:\d*\.)?\d+(px|rem|em|pt)\b/i.test(value)) reason = 'literal length'
    else if (/z-index\s*:\s*-?\d/i.test(value)) reason = 'literal z-index'
    if (reason) findings.push({ line: lineOf(text, match.index), property: 'string', value, reason })
  }
  for (const match of text.matchAll(NUMERIC_STYLE)) {
    findings.push({ line: lineOf(text, match.index), property: match[1], value: match[0], reason: 'numeric inline style' })
  }
  // redesign W0-5 (T0-17): zIndex: <number> (0 and -1 included) in an inline style or a style object.
  for (const match of text.matchAll(/\bzIndex\s*:\s*['"]?-?\d+/g)) {
    findings.push({ line: lineOf(text, match.index), property: 'zIndex', value: match[0], reason: 'literal z-index' })
  }
  return findings
}

export const scanSource = (source, file) => (/\.css$/i.test(file) ? scanCss(source) : scanJs(source))
