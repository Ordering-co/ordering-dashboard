/**
 * The Builder lists of a project are always paginated (api-core #3536):
 * `page` from 1, `page_size` up to 50 (a larger one falls back to 10), and
 * `limit` / `offset` are ignored. A list read without `page` answers only its
 * first page, so screens that need the whole list read it with this helper.
 */
export const BUILDER_MAX_PAGE_SIZE = 50

// A guard against an answer that never reaches its last page.
const MAX_PAGES = 100

export const withPage = (url, page, pageSize) => {
  const [path, hash = ''] = String(url).split('#')
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}page=${page}&page_size=${pageSize}${hash ? `#${hash}` : ''}`
}

/**
 * GETs every page of a paginated list with the options of `fetch`.
 * Answers `{ error, result }` as one request would: the whole list, or the
 * first failing page's `{ error: true, result }`. A list answered without
 * `pagination` is taken as complete. Network and JSON errors throw, like
 * `fetch` does.
 */
export const fetchAllPages = async (url, requestOptions, { pageSize = BUILDER_MAX_PAGE_SIZE, fetchImpl = fetch } = {}) => {
  const getPage = async (page) => {
    const response = await fetchImpl(withPage(url, page, pageSize), requestOptions)
    return response.json()
  }

  const first = await getPage(1)
  if (first?.error) return { error: true, result: first?.result }
  if (!Array.isArray(first?.result)) return { error: false, result: first?.result ?? [] }

  const totalPages = Math.min(Number(first?.pagination?.total_pages) || 1, MAX_PAGES)
  if (totalPages <= 1) return { error: false, result: first.result }

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => getPage(index + 2))
  )
  const failed = rest.find(content => content?.error)
  if (failed) return { error: true, result: failed?.result }

  return {
    error: false,
    result: rest.reduce((all, content) => all.concat(Array.isArray(content?.result) ? content.result : []), first.result)
  }
}
