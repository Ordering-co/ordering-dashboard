// redesign UC-B6 (M-13): the legacy Alert (`Shared/UI/Confirm.jsx`) only paints a string or a list of strings.
// What the SDK leaves in an error `result` is often something else (a `User` instance cast from a 200 with
// `error: true`, an `Error`, a `ProgressEvent`, a list of objects), and the Alert then opens with no message.
// `toAlertContent` turns that into the lines to paint, or the translated generic `fallback`.
const isText = (value) => typeof value === 'string' && value.trim() !== ''

// A plain object that carries its text in `message`. An `Error` also has one, but its text is not for the user.
const messageOf = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error) && isText(value.message)
    ? value.message
    : null
)

/**
 * @param {*} result what the API (or the failed request) left as the answer
 * @param {string} fallback the translated generic message
 * @returns {string[]} lines of text, never an empty list unless `fallback` is not text either
 */
export const toAlertContent = (result, fallback) => {
  let lines = []
  if (typeof result === 'string') lines = [result]
  else if (Array.isArray(result)) lines = result.flat(Infinity)
  else if (messageOf(result)) lines = [messageOf(result)]
  lines = lines.filter(isText)
  if (lines.length > 0) return lines
  return isText(fallback) ? [fallback] : []
}
