/**
 * The language of a legal notice text for a Dashboard language code (`es`, `es-MX` → `es`),
 * `en` when the notice has no text for it
 * @param {Object} texts the notice texts by language; must have `en`
 * @param {String} code
 */
export const getNoticeLanguage = (texts, code) => {
  const language = typeof code === 'string' ? code.trim().toLowerCase().split(/[-_]/)[0] : null
  return Object.prototype.hasOwnProperty.call(texts, language) ? language : 'en'
}
