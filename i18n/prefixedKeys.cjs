'use strict'
/* catalog keys are unprefixed; the sync publishes them as <prefix><KEY>, and t() adds the prefix at runtime.
 * A key that already carries the prefix never reaches the screen: t('DASHBOARD_CONNECT') strips it and reads the published
 * DASHBOARD_CONNECT, which is the entry CONNECT, while the catalog's own DASHBOARD_CONNECT goes live as
 * DASHBOARD_DASHBOARD_CONNECT, which nobody reads. i18n:verify rejects the prefix in both places.
 */

function findPrefixedKeys ({ catalogKeys = [], codeKeys = [], prefix }) {
  if (!prefix) return []
  const errors = []
  for (const key of catalogKeys) {
    if (key.startsWith(prefix)) errors.push(`catalog key carries the app prefix ${prefix}: ${key} (it goes live as ${prefix}${key})`)
  }
  for (const key of codeKeys) {
    if (key.startsWith(prefix)) errors.push(`t() key carries the app prefix ${prefix}: ${key} (t() reads ${prefix}${key.substring(prefix.length)} instead)`)
  }
  return errors
}

module.exports = { findPrefixedKeys }
