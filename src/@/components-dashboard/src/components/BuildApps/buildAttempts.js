/**
 * The builds of a My Products app as they were asked for, newest first (api-core, Builder\AppBuildAttemptController:
 * `GET {root}/builder/apps/{appId}/builds`, paginated): what says when each file type (Ad hoc, App Store, APK, AAB…) was last built,
 * which the app's `builds` (the last build of each platform) does not. One page is read: a file type whose last build is older than
 * these attempts keeps its file and its links, without its date.
 *
 * Answers `{ ok, attempts }`.
 */
export const APP_BUILD_ATTEMPTS_PAGE_SIZE = 50

export const listAppBuildAttempts = async ({ root, token, appId, pageSize = APP_BUILD_ATTEMPTS_PAGE_SIZE, fetchImpl = fetch }) => {
  try {
    const response = await fetchImpl(`${root}/builder/apps/${encodeURIComponent(appId)}/builds?page=1&page_size=${pageSize}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    const body = await response.json()
    const ok = !body?.error && response.ok && Array.isArray(body?.result)
    return { ok, attempts: ok ? body.result : [] }
  } catch (err) {
    return { ok: false, attempts: [] }
  }
}
