// the controller's `parseEvent` returns catalog strings with `<strong>` («<strong>_user_</strong> add money»)
// and the author's name already in them. Only `<strong>` and `<b>` (a project's own dictionary may use it) are read as
// bold; everything else, the author included, stays text, so a name with markup is shown as typed and never parsed.
const STRONG_TAG = /<(\/?)(?:strong|b)>/gi

/** A string as `[{ text, strong }]` segments, in order, without empty ones. */
export const strongSegments = (value) => {
  const text = String(value ?? '')
  const segments = []
  let strong = false
  let from = 0
  for (const match of text.matchAll(STRONG_TAG)) {
    if (match.index > from) segments.push({ text: text.slice(from, match.index), strong })
    strong = match[1] !== '/'
    from = match.index + match[0].length
  }
  if (from < text.length) segments.push({ text: text.slice(from), strong })
  return segments
}
