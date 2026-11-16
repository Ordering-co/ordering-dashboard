// redesign (lot D, decisions 7 and 8): the pure helpers of the Theme tab. No React, no writes into their inputs.
import { THEME_TITLES } from './themeTitles'

/** A deep copy of a JSON value (`undefined` stays `undefined`). */
export const cloneValues = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

// The merge of `recursiveAssign` in `main`, with one fix. redesign (OP-18): `main` skipped every falsy stored value
// (`if (b)`), so a stored `false`, `0` or `''` over a default showed the default, and «Update» wrote the default back over it.
// Only a missing value (`undefined` or `null`) keeps the default now.
const merge = (a, b) => {
  if (b === undefined || b === null) return a
  if (Object(b) !== b) return b
  const target = Object(a) !== a ? {} : a
  for (const key in b) {
    target[key] = merge(target[key], b[key])
  }
  return target
}

/**
 * The values the form starts from: the defaults of the theme with the values stored for the site on top, deeply.
 * redesign (audit): `main` wrote into `values_default` of the loaded record; this works on clones of both inputs, so
 * neither is touched and the result shares no object with them.
 */
export const buildBase = (defaults, values) => merge(cloneValues(defaults), cloneValues(values)) ?? {}

/** A copy of `object` with `value` written at `path` (`'a.b.c'`). Only the objects along the path are copied. */
export const setAt = (object, path, value) => {
  const keys = path.split('.')
  const write = (node, index) => {
    const copy = Array.isArray(node) ? [...node] : { ...(node !== null && typeof node === 'object' ? node : {}) }
    const key = keys[index]
    copy[key] = index === keys.length - 1 ? value : write(copy[key], index + 1)
    return copy
  }
  return write(object, 0)
}

const isBranch = (value) => value !== null && typeof value === 'object' && Object.keys(value).length > 0

const collectLeaves = (value, path, into) => {
  if (isBranch(value)) {
    Object.keys(value).forEach(key => collectLeaves(value[key], path === '' ? key : `${path}.${key}`, into))
  } else {
    into.set(path, JSON.stringify(value))
  }
  return into
}

/** How many leaves of `current` differ from `base` (a leaf is compared by its JSON; one added or removed counts too). */
export const countChanges = (base, current) => {
  const before = collectLeaves(base, '', new Map())
  const after = collectLeaves(current, '', new Map())
  let changes = 0
  new Set([...before.keys(), ...after.keys()]).forEach(path => {
    if (before.get(path) !== after.get(path)) changes += 1
  })
  return changes
}

/**
 * What the `onInput` of the border radius input did to the typed text in `main`, as a function of that text: past 99, a lone dot
 * or a second dot drop the last character; otherwise only digits, dot and slash survive (up to 9; a lone 0 is dropped), else empty.
 */
export const filterBorderRadius = (text) => {
  if (Number(text) > 99 || text === '.' || (text.match(/\./g) || []).length > 1) return text.slice(0, -1)
  const match = text.match(`^[${text === '0' ? '1' : '0'}-9/.]{1,9}$`)
  return match ? match[0] : ''
}

/** `#rgb` or `#rrggbb`: the values the Theme tab draws as a color. */
export const validHexColor = (colorCode) => /^#[0-9A-F]{6}$/i.test(colorCode) || /^#[0-9A-F]{3}$/i.test(colorCode)

/**
 * The title of a block, component or option. redesign J5 row 48 (ordering-products P-4, ): main passed the function
 * `key.toUpperCase` (not its result) to `t`, so every title was the key of the theme JSON in English in all 12 languages (M-OP1).
 * A known key now goes through its literal key in THEME_TITLES; any other keeps the English of the theme, without calling `t`.
 */
export const getTitle = (t, key) => {
  const title = Object.prototype.hasOwnProperty.call(THEME_TITLES, key) ? THEME_TITLES[key] : null
  return title ? title(t) : String(key).replace(/_/g, ' ')
}

/** The first text of an API error (`['msg']`, `'msg'` or `[{ message }]`), or `undefined`. */
export const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)
