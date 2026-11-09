export const AUTOLOGIN_STASH_KEY = '__ORDERING_AUTOLOGIN__'

const hasProtocol = (urlString) => /^[a-zA-Z][a-zA-Z+\-.]*:/.test(urlString)

// A one-time sign-in code is only accepted on the root path. Other pages use
// `code` for their own purposes (e.g. /password/reset?code=…&random=…).
export const isHandoffPath = (pathname) => !pathname || pathname === '/'

const readHandoffCode = (url) => (isHandoffPath(url.pathname) ? url.searchParams.get('code') : null)

export const stripAutologinTokenFromUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return urlString

  try {
    const absolute = hasProtocol(urlString)
    const url = absolute ? new URL(urlString) : new URL(urlString, 'https://placeholder.invalid')
    const hasCode = Boolean(readHandoffCode(url))
    if (!url.searchParams.has('token') && !hasCode) return urlString
    url.searchParams.delete('token')
    if (hasCode) url.searchParams.delete('code')
    if (!absolute) return `${url.pathname}${url.search}${url.hash}`
    return url.toString()
  } catch {
    return urlString
  }
}

export const readAutologinParams = (win) => {
  const query = new URLSearchParams(win?.location?.search || '')
  const stash = win?.[AUTOLOGIN_STASH_KEY]
  if (stash?.token || stash?.code) {
    return {
      token: stash.token || null,
      code: stash.code || null,
      project: stash.project ?? query.get('project')
    }
  }

  return {
    token: query.get('token'),
    code: isHandoffPath(win?.location?.pathname) ? query.get('code') : null,
    project: query.get('project')
  }
}

export const stashAndStripAutologinQuery = (win) => {
  if (!win?.location || !win.history?.replaceState) return

  const url = new URL(win.location.href)
  const token = url.searchParams.get('token')
  const code = readHandoffCode(url)
  if (!token && !code) return

  win[AUTOLOGIN_STASH_KEY] = {
    token,
    code,
    project: url.searchParams.get('project')
  }
  url.searchParams.delete('token')
  if (code) url.searchParams.delete('code')
  win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
