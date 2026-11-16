// redesign AH · the overlap baseline: what the overlap sweep may still find, per url × width × state.
// Shared by overlap-sweep.mjs (compare, write) and scripts/redesign/gates.mjs step 8 (validate). Node only.
//
// scripts/redesign/overlap-baseline.json: { "entries": { "<url> @<width> <state>": ["<pair key>", …] } }. A pair key is the two
// selectors of overlapProbe («a × b»). A measurement with no entry must find 0 pairs; an entry lists only pairs still found
// (a gone pair is stale: lower the entry in the same change). Entries hold what is left on purpose, each with a reason in
// `reasons` (same key): a pair waiting for an owner decision, or one that is right as it is.
import { readFileSync } from 'node:fs'

export const OVERLAP_WIDTHS = [1440, 1280, 912, 390]
export const OVERLAP_STATES = ['initial', 'dirty']

/** overlap-routes.txt: one url per line; `#` starts a comment. */
export const readRoutes = file => readFileSync(file, 'utf8').split('\n').map(line => line.replace(/#.*/, '').trim()).filter(Boolean)

export const entryKey = (url, width, state) => `${url} @${width} ${state}`
export const parseEntryKey = key => {
  const m = /^(\S+) @(\d+) (\S+)$/.exec(key)
  return m ? { url: m[1], width: Number(m[2]), state: m[3] } : null
}

/** -> problems (strings); [] when the baseline is well formed and every entry names a url, width and state the sweep measures. */
export function validateBaseline ({ baseline, routes }) {
  const problems = []
  if (!baseline || typeof baseline !== 'object' || !baseline.entries || typeof baseline.entries !== 'object' || Array.isArray(baseline.entries)) {
    return ['overlap-baseline.json has no "entries" object']
  }
  const known = new Set(routes)
  const reasons = baseline.reasons && typeof baseline.reasons === 'object' ? baseline.reasons : {}
  for (const [key, pairs] of Object.entries(baseline.entries)) {
    const parsed = parseEntryKey(key)
    if (!parsed) { problems.push(`${key}: not «<url> @<width> <state>»`); continue }
    if (!known.has(parsed.url)) problems.push(`${key}: ${parsed.url} is not in overlap-routes.txt`)
    if (!OVERLAP_WIDTHS.includes(parsed.width)) problems.push(`${key}: width ${parsed.width} is not one of ${OVERLAP_WIDTHS.join(', ')}`)
    if (!OVERLAP_STATES.includes(parsed.state)) problems.push(`${key}: state ${parsed.state} is not one of ${OVERLAP_STATES.join(', ')}`)
    if (!Array.isArray(pairs) || pairs.length === 0 || pairs.some(p => typeof p !== 'string' || !p.includes(' × '))) {
      problems.push(`${key}: must be a non-empty list of pair keys («a × b»); a measurement with no pair has no entry`)
    }
    if (!(typeof reasons[key] === 'string' && reasons[key].trim())) problems.push(`${key}: no reason in "reasons" (why this pair is left)`)
  }
  for (const key of Object.keys(reasons)) if (!Object.hasOwn(baseline.entries, key)) problems.push(`reasons.${key}: no such entry`)
  return problems
}

/**
 * rows: overlap-sweep.mjs measurements ({ url, width, state, pairs: [{ key, a, b, overlap }] }; «n/a» and «error» are skipped).
 * -> { fresh: [{ entry, pair }], stale: [{ entry, key }] }: a pair the entry does not list, a listed pair that was not found.
 */
export function compareBaseline ({ rows, baseline }) {
  const entries = baseline?.entries || {}
  const fresh = []
  const stale = []
  for (const r of rows) {
    if (!OVERLAP_STATES.includes(r.state)) continue
    const entry = entryKey(r.url, r.width, r.state)
    const listed = new Set(entries[entry] || [])
    const seen = new Set(r.pairs.map(p => p.key))
    for (const pair of r.pairs) if (!listed.has(pair.key)) fresh.push({ entry, pair })
    for (const key of listed) if (!seen.has(key)) stale.push({ entry, key })
  }
  return { fresh, stale }
}

/** The baseline with the entries of `rows` rewritten (what was not measured is kept). Reasons of removed entries go too. */
export function rewriteBaseline ({ rows, baseline }) {
  const entries = { ...(baseline?.entries || {}) }
  const reasons = { ...(baseline?.reasons || {}) }
  for (const r of rows) {
    if (!OVERLAP_STATES.includes(r.state)) continue
    const entry = entryKey(r.url, r.width, r.state)
    if (r.pairs.length) entries[entry] = [...new Set(r.pairs.map(p => p.key))].sort()
    else { delete entries[entry]; delete reasons[entry] }
  }
  const sorted = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
  return { ...baseline, entries: sorted(entries), reasons: sorted(reasons) }
}
