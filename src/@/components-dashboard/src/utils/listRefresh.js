// The Refresh button of a paginated list reads the page the user is on again.
// When that page no longer exists (the list shrank meanwhile), it goes to the
// last one that does.

/**
 * The page to read again after a refresh of `requestedPage` answered with
 * `pagination` and `count` rows, or null when that answer is fine as it is.
 * @param {number} requestedPage
 * @param {{ total_pages?: number }|null} pagination the API's pagination
 * @param {number} count rows the page came back with
 * @returns {number|null}
 */
export const getRefreshFallbackPage = (requestedPage, pagination, count) => {
  const totalPages = Number(pagination?.total_pages) || 0
  if (count > 0 || totalPages < 1 || requestedPage <= totalPages) return null
  return totalPages
}
