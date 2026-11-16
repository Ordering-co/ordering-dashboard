/**
 * Resolve the backend-internal project code behind a possible public alias.
 * `apiRoot` is a versioned API root (`url/version/language/project`); `/current`
 * always answers with the internal code (`result.code`), even when `project` in
 * the path is an alias. Returns null on any error so callers can keep whatever
 * project they already have instead of blocking on this lookup.
 */
export const fetchProjectCode = async (apiRoot) => {
  try {
    const response = await fetch(`${apiRoot}/current`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    const { error, result } = await response.json()
    return !error && typeof result?.code === 'string' && result.code ? result.code : null
  } catch {
    return null
  }
}
