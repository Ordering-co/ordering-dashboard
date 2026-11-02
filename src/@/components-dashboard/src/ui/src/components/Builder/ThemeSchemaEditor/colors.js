// Colors as the editor shows and picks them: hex or rgba(), and their contrast.

/** `{ r, g, b, a }` of a hex, rgb() or rgba() color, or null. */
export const parseColor = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const hex = text.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (hex) {
    let digits = hex[1]
    if (digits.length <= 4) digits = digits.split('').map(c => c + c).join('')
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1
    }
  }
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i)
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] }
  return null
}

const toHexPart = (channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0').toUpperCase()

export const toHex = ({ r, g, b }) => `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`

/** What a color picker (no alpha) can show: `#rrggbb`. */
export const toPickerColor = (value) => {
  const color = parseColor(value)
  return color ? toHex(color).toLowerCase() : '#000000'
}

/**
 * The picked `#rrggbb`, keeping the transparency the color had when it may be
 * translucent (`alpha`); a color that may not is always opaque.
 */
export const fromPickerColor = (picked, previous, { alpha = true } = {}) => {
  const color = parseColor(picked)
  if (!color) return previous
  const before = parseColor(previous)
  if (alpha && before && before.a < 1) return `rgba(${color.r},${color.g},${color.b},${before.a})`
  return toHex(color)
}

/** The opacity of a color, 0 to 1: `transparent` is 0, anything unreadable 1. */
export const alphaOf = (value) => value === 'transparent' ? 0 : (parseColor(value)?.a ?? 1)

/**
 * `value` at `alpha` as the theme stores it: `#RRGGBB` when opaque,
 * `transparent` at 0, else `rgba(r,g,b,a)` with no spaces and at most two
 * decimals. Never `#RRGGBBAA`.
 */
export const withAlpha = (value, alpha) => {
  const color = parseColor(value) || { r: 0, g: 0, b: 0 }
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 100) / 100
  if (a >= 1) return toHex(color)
  if (a <= 0) return 'transparent'
  return `rgba(${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)},${a})`
}

/** How a color reads in the editor: `#RRGGBB`, or its rgba(). */
export const formatColor = (value) => {
  const color = parseColor(value)
  if (!color) return value === 'transparent' ? value : String(value ?? '')
  return color.a < 1 ? `rgba(${color.r},${color.g},${color.b},${color.a})` : toHex(color)
}

const luminance = ({ r, g, b }) => {
  const [lr, lg, lb] = [r, g, b].map(channel => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** WCAG contrast of two opaque colors, rounded to one decimal; null otherwise. */
export const getContrast = (first, second) => {
  const a = parseColor(first)
  const b = parseColor(second)
  if (!a || !b || a.a < 1 || b.a < 1) return null
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return Math.round(((light + 0.05) / (dark + 0.05)) * 10) / 10
}

/** `aaa`, `aa`, `large` (AA only for large text) or `low`. */
export const getContrastLevel = (ratio) => {
  if (ratio === null || ratio === undefined) return null
  if (ratio >= 7) return 'aaa'
  if (ratio >= 4.5) return 'aa'
  if (ratio >= 3) return 'large'
  return 'low'
}
