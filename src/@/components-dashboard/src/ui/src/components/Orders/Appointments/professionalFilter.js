// redesign apply-list row 23 (appointments P-2): the agenda is filtered by professional on the client, from the `professional`
// (id, name, lastname, photo) that every appointment already carries. No request, no URL: the page keeps the choice.

// «Name Lastname», the way the event and the List view name the professional
const nameOf = (professional) => [professional?.name, professional?.lastname].filter(Boolean).join(' ')

// What tells one professional from another: the id as a string; with no id (nothing in orderingv1 shows the real shape of
// `calendar_events`, and the W1-7b fixture has none) the name, prefixed so it never meets an id. null: neither, not offered.
const keyOf = (professional) => {
  if (professional?.id != null && professional.id !== '') return String(professional.id)
  const name = nameOf(professional)
  return name ? `name:${name}` : null
}

// One option per distinct professional of `events`, sorted by label: [{ value, label }] (`value` from keyOf; the label is the name,
// or the id when the record has no name). Appointments with no professional contribute nothing, so an agenda without professionals
// has no options.
export const professionalOptions = (events, locale) => {
  const byKey = new Map()
  ;(events || []).forEach(event => {
    const value = keyOf(event?.professional)
    if (value === null) return
    if (!byKey.has(value)) byKey.set(value, { value, label: nameOf(event.professional) || String(event.professional.id) })
  })
  const options = Array.from(byKey.values())
  // review J4 #2: professionals with an id who share a name get their number, so the options never read the same
  const sameName = options.reduce((count, option) => count.set(option.label, (count.get(option.label) || 0) + 1), new Map())
  options.forEach(option => {
    if (sameName.get(option.label) > 1 && !option.value.startsWith('name:')) option.label = `${option.label} · #${option.value}`
  })
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  return options.sort((a, b) => collator.compare(a.label, b.label) || (a.value < b.value ? -1 : 1))
}

// The appointments of the professional `key` (a value of professionalOptions). With none chosen (null or '') it is the very same
// list, so nothing downstream recomputes.
export const filterByProfessional = (events, key) => {
  if (key == null || key === '') return events
  const wanted = String(key)
  return (events || []).filter(event => keyOf(event?.professional) === wanted)
}
