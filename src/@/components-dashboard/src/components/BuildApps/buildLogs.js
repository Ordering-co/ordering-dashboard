const getErrorMessage = (result, fallback) => {
  if (Array.isArray(result)) return result[0] ?? fallback
  if (typeof result === 'string' && result) return result
  return fallback
}

/**
 * Open the Jenkins build logs of an app in a new tab.
 * The API only serves /logs with a short-lived log_token, so the tab is opened
 * synchronously on the click (popup blockers drop window.open after an await),
 * then pointed at the signed URL once /logs/link answers. The token is never cached.
 */
export const openBuildLogs = async ({ root, appId, platform, token, fetchImpl = fetch, win = window }) => {
  const logsUrl = `${root}/builder/apps/${appId}/${platform}/logs`
  const tab = win.open('', '_blank')
  if (tab) tab.opener = null

  try {
    const response = await fetchImpl(`${logsUrl}/link`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    })
    const { error, result } = await response.json()
    if (error || !result?.log_token) {
      throw new Error(getErrorMessage(result, 'The log link could not be created.'))
    }

    const url = `${logsUrl}?log_token=${encodeURIComponent(result.log_token)}`
    if (tab) {
      tab.location = url
    } else {
      win.open(url, '_blank', 'noopener')
    }
    return { error: false, url }
  } catch (err) {
    if (tab) tab.close()
    return { error: true, message: err?.message ?? String(err) }
  }
}
