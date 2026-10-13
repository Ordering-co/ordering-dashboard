'use strict'

/**
 * Shared t('KEY', 'fallback') scanner for generate + verify.
 * Scans src/ (app + submodule). Excludes dynamic-prefix keys like t('DAY' + n).
 */

const fs = require('fs')
const path = require('path')

const ROOT = 'src'
// Dashboard UI/controllers live in-tree under components-dashboard (not a git submodule).
// Do not match the generic `src/@/components` prefix — that falsely hits this folder name.
const COMPONENTS_LIB = path.join('src', '@', 'components-dashboard')
const exts = new Set(['.js', '.jsx', '.ts', '.tsx'])

const FALLBACK_OVERRIDES = {
  THE_DRIVER_IS_CLOSE: 'The driver is close',
  ORDER_ATTRIBUTE_CHANGED_FROM_TO: 'Order _attribute_ changed from _from_ to _to_.',
  ORDER_ATTRIBUTE_CHANGED_TO: 'Order _attribute_ changed to _to_.',
  ESTIMATED_DELIVERY_TIME: 'Estimated delivery time: _min_ min.',
  ESTIMATED_PREPARATION_TIME: 'Estimated preparation time: _min_ min.',
  DRIVER_ASSIGNED_AS_DRIVER: '_driver_ was assigned as driver.',
  DRIVER_UNASSIGNED: 'Driver unassigned',
  APP_ID: 'App ID',
  AUTHOR: 'Author',
  GUEST_USER: 'Guest user',
  USER_AGENT: 'User agent',
  LOCATION: 'Location',
  IP: 'IP'
}

const TYPO_CORRECTIONS_SUBMODULE = {
  ACH_BANK_TRANSFER: 'ACH Bank transfer',
  PRODUCT_ADDED_NOTIFICATION: 'Product _PRODUCT_ added successfully',
  PRODUCT_UPDATED_NOTIFICATION: 'Product _PRODUCT_ updated successfully',
  SPECIFIC_LOGISTIC_ORDER_ORDERED: 'Logistic order _NUMBER_ has been ordered',
  SPECIFIC_LOGISTIC_ORDER_UPDATED: 'Your logistic order number _NUMBER_ has updated',
  SPECIFIC_ORDER_ACCEPTED: 'You accepted the order number _NUMBER_',
  SPECIFIC_ORDER_REJECTED: 'You rejected the order number _NUMBER_'
}

const DYNAMIC_ADDED = {
  DAY1: 'Monday',
  DAY2: 'Tuesday',
  DAY3: 'Wednesday',
  DAY4: 'Thursday',
  DAY5: 'Friday',
  DAY6: 'Saturday',
  DAY7: 'Sunday'
}

function walk (dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (full.includes('node_modules')) continue
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (exts.has(path.extname(full))) out.push(full)
  }
  return out
}

function readString (src, i) {
  const q = src[i]
  if (q !== '\'' && q !== '"' && q !== '`') return null
  let out = ''
  let j = i + 1
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') { out += src[j + 1]; j += 2; continue }
    if (c === q) return { value: out, end: j + 1 }
    out += c; j++
  }
  return null
}

const skipWs = (src, i) => { while (i < src.length && /\s/.test(src[i])) i++; return i }

function readFallback (src, commaIdx) {
  const i = skipWs(src, commaIdx + 1)
  const direct = readString(src, i)
  if (direct) return direct.value
  const close = src.indexOf(')', commaIdx)
  if (close === -1) return null
  const orIdx = src.indexOf('||', i)
  if (orIdx === -1 || orIdx > close) return null
  const afterOr = readString(src, skipWs(src, orIdx + 2))
  return afterOr ? afterOr.value : null
}

function bestValue (key, e) {
  if (e.values.size) {
    let best = null
    let bestScore = -1
    for (const [v, c] of e.values) {
      const score = c.app * 1000 + c.app + c.sub
      if (score > bestScore) { bestScore = score; best = v }
    }
    return best
  }
  if (FALLBACK_OVERRIDES[key] != null) return FALLBACK_OVERRIDES[key]
  return ''
}

/**
 * @returns {{ rows: Array<{key:string,value:string,source:string,note:string,conflict:boolean}>, stats: object }}
 */
function scanKeys () {
  const files = walk(ROOT, [])
  const re = /\bt\(/g
  const keys = new Map()
  let dynamicSkipped = 0
  let totalCalls = 0

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    const source = file.includes(COMPONENTS_LIB) ? 'submodule' : 'app'
    let m
    while ((m = re.exec(src))) {
      const i = skipWs(src, m.index + 2)
      const keyStr = readString(src, i)
      if (!keyStr) continue
      const key = keyStr.value
      if (!/^[A-Z0-9_]+$/.test(key)) continue
      const j = skipWs(src, keyStr.end)
      if (src[j] === '+') { dynamicSkipped++; continue }
      totalCalls++
      if (!keys.has(key)) {
        keys.set(key, { values: new Map(), inApp: false, inSub: false, noFb: 0, runtimeVar: 0 })
      }
      const e = keys.get(key)
      if (source === 'app') e.inApp = true
      else e.inSub = true
      if (src[j] === ',') {
        const fbValue = readFallback(src, j)
        if (fbValue) {
          const cur = e.values.get(fbValue) || { app: 0, sub: 0 }
          cur[source === 'app' ? 'app' : 'sub']++
          e.values.set(fbValue, cur)
        } else {
          e.runtimeVar = (e.runtimeVar || 0) + 1
        }
      } else {
        e.noFb++
      }
    }
  }

  const rows = []
  for (const [key, e] of keys) {
    const source = e.inApp && e.inSub ? 'both' : (e.inApp ? 'app' : 'submodule')
    let value = bestValue(key, e)
    let note = ''
    if (e.noFb > 0 && !e.values.size) note = 'no_fallback_in_code:value_supplied'
    if (!value && e.runtimeVar > 0) note = 'runtime_variable_fallback:no_static_value'
    if (TYPO_CORRECTIONS_SUBMODULE[key] != null) {
      value = TYPO_CORRECTIONS_SUBMODULE[key]
      note = 'typo_fixed_in_db_only:submodule_code_needs_fix'
    }
    rows.push({ key, value, source, note, conflict: e.values.size > 1 })
  }

  for (const [key, value] of Object.entries(DYNAMIC_ADDED)) {
    if (!keys.has(key)) {
      rows.push({ key, value, source: 'app', note: 'DYNAMIC_KEY_added', conflict: false })
    }
  }

  rows.sort((a, b) => a.key.localeCompare(b.key))

  return {
    rows,
    keys,
    filesScanned: files.length,
    totalCalls,
    dynamicSkipped
  }
}

module.exports = {
  scanKeys,
  FALLBACK_OVERRIDES,
  TYPO_CORRECTIONS_SUBMODULE,
  DYNAMIC_ADDED
}
