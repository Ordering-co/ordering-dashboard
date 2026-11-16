/**
 * Keyboard of the C18 dropdown list (FirstSelect and MultiSelect inside the orders surfaces): arrows,
 * Home / End and type-ahead move the focus between the rows; the select itself keeps Enter, Space and
 * Escape. Rows are `[role="option"]` elements that can take the focus; group headings and disabled rows
 * are skipped.
 */
const ENABLED_OPTION = '[role="option"]:not([aria-disabled="true"])'
const TYPEAHEAD_RESET = 700

export const enabledOptions = list => Array.from(list?.querySelectorAll(ENABLED_OPTION) ?? [])

/**
 * Focuses the selected row (or the first one, or the last one); false when the list has no row to take it.
 * With nothing selected, the first row that is not a dangerous action takes it: the list opens at the top, where
 * «Remove assigned driver» is, and an arrow key must never land on it first (redesign F6c, P3-02).
 */
export const focusOption = (list, which = 'selected') => {
  const rows = enabledOptions(list)
  const firstSafe = () => rows.find(row => !row.hasAttribute('data-danger')) ?? rows[0]
  const target = which === 'last'
    ? rows[rows.length - 1]
    : which === 'selected'
      ? rows.find(row => row.getAttribute('aria-selected') === 'true') ?? firstSafe()
      : rows[0]
  target?.focus()
  return !!target
}

/**
 * Puts the focus in the search field of the list, when it has one (redesign F6d-2, Q3-06: the list opens ready to
 * type, as the pill popovers do). False when there is no search field.
 */
export const focusSearch = list => {
  const search = list?.querySelector('input[type="search"]')
  search?.focus()
  return !!search
}

/**
 * A printable key pressed on the field while its list is open and has no search field: the type-ahead runs from the
 * top of the list and the focus jumps to the match (redesign F6d-2, Q3-06). Returns true when it handled the key.
 */
export const typeaheadFromField = (event, list, typeahead) => {
  if (!list || list.querySelector('input[type="search"]')) return false
  if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.metaKey || event.altKey) return false
  const target = typeahead(event.key, enabledOptions(list), null)
  if (!target) return false
  event.preventDefault()
  target.focus()
  return true
}

/** A type-ahead buffer: the letters typed within a short while, matched against the start of the row text. */
export const createTypeahead = () => {
  let buffer = ''
  let timer = 0
  return (key, rows, current) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => { buffer = '' }, TYPEAHEAD_RESET)
    buffer += key.toLocaleLowerCase()
    const repeated = buffer.length > 1 && [...buffer].every(letter => letter === buffer[0])
    const needle = repeated ? buffer[0] : buffer
    const from = rows.indexOf(current)
    // One letter (or the same letter again) goes on to the next match; several letters refine the current one.
    const ordered = needle.length > 1 && from > -1
      ? [...rows.slice(from), ...rows.slice(0, from)]
      : [...rows.slice(from + 1), ...rows.slice(0, from + 1)]
    return ordered.find(row => row.textContent.trim().toLocaleLowerCase().startsWith(needle))
  }
}

/**
 * Handles a key pressed inside the list. Returns true when it moved the focus (the caller then has
 * nothing else to do). `typeahead` comes from `createTypeahead()`, kept by the select in a ref.
 */
export const navigateOptions = (event, list, typeahead) => {
  const rows = enabledOptions(list)
  const current = event.target.closest?.('[role="option"]')
  const index = rows.indexOf(current)
  const search = list.querySelector('input')
  const move = target => {
    if (!target) return false
    event.preventDefault()
    target.focus()
    return true
  }
  switch (event.key) {
    case 'ArrowDown':
      // From outside the rows (the search field) it enters the list on the first row that is not a dangerous action
      // (redesign F6c P3-02 / F6d-2 Q3-06): Enter must never remove something by accident.
      return move(index < 0 ? rows.find(row => !row.hasAttribute('data-danger')) ?? rows[0] : rows[Math.min(index + 1, rows.length - 1)])
    case 'ArrowUp':
      if (index === 0 && search) return move(search)
      return move(index < 0 ? undefined : rows[Math.max(index - 1, 0)])
    case 'Home':
      return current ? move(rows[0]) : false
    case 'End':
      return current ? move(rows[rows.length - 1]) : false
    default:
      if (!current || event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.metaKey || event.altKey) return false
      return move(typeahead(event.key, rows, current))
  }
}
