/**
 * The signed links of My Products, asked for with the session instead of the
 * public `{project}/builder/apps/{app_id}/downloads/*` routes (api-core,
 * Builder\AppArtifactLinkController):
 *
 * - install: `POST {root}/builder/apps/{appId}/install-link/{platform}/{mode}/{file}`, a link that installs the app's latest APK or
 *   iOS ad hoc IPA on a phone and lasts 24 hours, `{ url, expires_at, platform, mode, file }` (the Builder section's contract). An
 *   AAB or an App Store IPA answers `build.not_installable`.
 * - download: `POST {root}/builder/apps/{appId}/download-link/{platform}/{mode}/{file}`, a storage link of 15 minutes to the file,
 *   downloaded with the app's name.
 *
 * Both answer `{ ok, result, errorCodes }`; a refusal carries the API's `error_codes` (`build.artifact_missing`, …).
 */
const requestLink = async ({ root, token, appId, kind, platform, mode, file, fetchImpl = fetch }) => {
  const path = [platform, mode, file].map(part => encodeURIComponent(part)).join('/')
  try {
    const response = await fetchImpl(`${root}/builder/apps/${encodeURIComponent(appId)}/${kind}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    let body = {}
    try {
      body = await response.json()
    } catch (err) {
      body = { error: true }
    }
    const ok = !body?.error && response.ok && !!body?.result?.url
    return { ok, result: ok ? body.result : null, errorCodes: Array.isArray(body?.error_codes) ? body.error_codes : [] }
  } catch (err) {
    return { ok: false, result: null, errorCodes: [] }
  }
}

export const createAppInstallLink = (options) => requestLink({ ...options, kind: 'install-link' })

export const getAppDownloadLink = (options) => requestLink({ ...options, kind: 'download-link' })
