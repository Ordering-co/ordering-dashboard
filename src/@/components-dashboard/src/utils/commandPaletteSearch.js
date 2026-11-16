import { normalizeSettingsSearch } from './settingsIa'

/**
 * Local ranking for the command palette. Pure, no React.
 *
 * An entry is `{ id, title, subtitle?, aliases?: string[], keywords?: string[], boost? }`.
 * Every query term must match the title, an alias or a keyword. Matching
 * ignores case and accents, prefers whole words and word prefixes, and
 * tolerates one typo on terms of four letters or more.
 */

export const normalizeCommandText = normalizeSettingsSearch

export const tokenizeCommandQuery = (query) =>
  normalizeCommandText(query).split(/\s+/).filter(Boolean)

const toWords = (text) => normalizeCommandText(text).split(/[^a-z0-9]+/).filter(Boolean)

/**
 * One substitution, insertion, deletion or adjacent swap.
 */
export const isWithinOneEdit = (a = '', b = '') => {
  if (a === b) return true
  const lengthGap = Math.abs(a.length - b.length)
  if (lengthGap > 1) return false
  if (a.length === b.length) {
    const diffs = []
    for (let index = 0; index < a.length; index++) {
      if (a[index] !== b[index]) diffs.push(index)
      if (diffs.length > 2) return false
    }
    if (diffs.length === 1) return true
    return diffs.length === 2 &&
      diffs[1] === diffs[0] + 1 &&
      a[diffs[0]] === b[diffs[1]] &&
      a[diffs[1]] === b[diffs[0]]
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let skipped = false
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++
      j++
    } else {
      if (skipped) return false
      skipped = true
      j++
    }
  }
  return true
}

const prepareEntry = (entry) => {
  const title = normalizeCommandText(entry.title)
  const aliases = (entry.aliases || []).map(normalizeCommandText).filter(Boolean)
  return {
    title,
    titleWords: toWords(entry.title),
    aliases,
    aliasWords: aliases.flatMap(toWords),
    extra: normalizeCommandText([entry.subtitle, ...(entry.keywords || [])].filter(Boolean).join(' '))
  }
}

const scoreTerm = (prepared, term) => {
  const { title, titleWords, aliases, aliasWords, extra } = prepared
  if (titleWords.includes(term)) return 10
  if (titleWords.some(word => word.startsWith(term))) return 8
  if (aliasWords.includes(term)) return 7
  if (aliasWords.some(word => word.startsWith(term))) return 6
  if (title.includes(term)) return 4
  if (aliases.some(alias => alias.includes(term))) return 3
  if (extra.includes(term)) return 2
  if (term.length >= 4 && [...titleWords, ...aliasWords].some(word => isWithinOneEdit(term, word))) return 1
  return 0
}

/**
 * Relevance of `entry` for already tokenized `terms`. 0 means no match.
 */
export const scoreCommandEntry = (entry, terms = []) => {
  if (!entry || !terms.length) return 0
  const prepared = prepareEntry(entry)
  let score = 0
  for (const term of terms) {
    const termScore = scoreTerm(prepared, term)
    if (!termScore) return 0
    score += termScore
  }
  const phrase = terms.join(' ')
  if (prepared.title === phrase || prepared.aliases.includes(phrase)) score += 6
  else if (prepared.title.startsWith(phrase)) score += 3
  return score + (Number(entry.boost) || 0)
}

/**
 * Matching entries sorted by score, then title. Duplicate ids keep the best.
 */
export const rankCommandEntries = (entries = [], query = '', { limit } = {}) => {
  const terms = tokenizeCommandQuery(query)
  if (!terms.length) return []
  const best = new Map()
  ;(entries || []).forEach(entry => {
    const score = scoreCommandEntry(entry, terms)
    if (!score) return
    const current = best.get(entry.id)
    if (!current || current.score < score) best.set(entry.id, { ...entry, score })
  })
  const ranked = [...best.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return String(a.title).localeCompare(String(b.title), undefined, { sensitivity: 'base' })
  })
  return limit ? ranked.slice(0, limit) : ranked
}

/**
 * Whether `query` is the entry's whole title or one of its whole aliases (case and accents aside).
 */
export const isExactCommandMatch = (entry, query = '') => {
  const phrase = tokenizeCommandQuery(query).join(' ')
  if (!entry || !phrase) return false
  const { title, aliases } = prepareEntry(entry)
  return title === phrase || aliases.includes(phrase)
}

/**
 * Order of the local sections (`navigation`, `settings`, `actions`) for a query. when the best action is named
 * exactly as the query and no page or setting is, the actions go first: «add business owner» opens the add form, ahead of the
 * «Allow Business Owner to Register…» setting that only contains the words. Otherwise the order stays as given.
 */
export const orderLocalCommandSections = (sections = [], query = '') => {
  const actions = sections.find(section => section.key === 'actions')
  if (!actions?.items?.length || !isExactCommandMatch(actions.items[0], query)) return sections
  const others = sections.filter(section => section !== actions)
  if (others.some(section => section.items?.length && isExactCommandMatch(section.items[0], query))) return sections
  return [actions, ...others]
}

const startsAWord = (text, terms) => {
  const words = toWords(text || '')
  return terms.every(term => words.some(word => word.startsWith(term)))
}

// Records are found by the API on their name, e-mail or phone: their subtitle (customer, e-mail, phone) carries the match for orders and users
const SUBTITLE_MATCH_SECTIONS = ['orders', 'users']
// "Search in" hand-offs repeat the query in their title for every query: they say nothing about how well a page or a record matches
const NEVER_PROMOTED_SECTIONS = ['records']

/**
 * the order of the sections is decided by their best match. A section whose title says the query (every term is a whole word or the
 * start of one) goes ahead of a section that only matches by a typo (one edit, «carlos» for the alias «cargos»), by an alias, by a hidden key or by its
 * subtitle. Nothing is removed and the order is kept among sections of the same kind.
 */
export const orderSectionsByTitleMatch = (sections = [], query = '') => {
  const terms = tokenizeCommandQuery(query)
  if (!terms.length) return sections
  const isStrong = (section) => !!section && !NEVER_PROMOTED_SECTIONS.includes(section.key) && (section.items || []).some(item =>
    startsAWord(item.title, terms) || (SUBTITLE_MATCH_SECTIONS.includes(section.key) && startsAWord(item.subtitle, terms)))
  const strong = sections.filter(isStrong)
  if (!strong.length || strong.length === sections.length) return sections
  return [...strong, ...sections.filter(section => !strong.includes(section))]
}
