import { isNetworkFailure } from '../../../../../utils/networkFailure'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'

// redesign the text of an error of Payment reports that a person can read. The API answers some errors by key
// («API_ERROR_NOT_FOUND») and `translateApiMessage` gives the key back when the dictionary has no entry for it; the browser answers a
// request that never arrived with its own text («Failed to fetch»). Neither is for a person: both say `fallback` instead. A message in
// words, or a key the dictionary knows, is shown as it is. `notFoundText` (optional) is what a *_NOT_FOUND key says before the fallback.
const RAW_KEY = /^[A-Z][A-Z0-9_]{2,}$/

export const readableApiMessage = (t, message, fallback, notFoundText = fallback) => {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) return fallback
  if (isNetworkFailure(text)) return fallback
  const isKey = RAW_KEY.test(text)
  const shown = translateApiMessage(t, text, fallback, isKey ? (/NOT_FOUND$/.test(text) ? notFoundText : fallback) : text)
  return typeof shown === 'string' && RAW_KEY.test(shown.trim()) ? fallback : shown
}
