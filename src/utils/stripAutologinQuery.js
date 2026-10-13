export const AUTOLOGIN_STASH_KEY = '__ORDERING_AUTOLOGIN__'

const hasProtocol = (urlString) => /^[a-zA-Z][a-zA-Z+\-.]*:/.test(urlString)

export const stripAutologinTokenFromUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return urlString

  try {
    const absolute = hasProtocol(urlString)
    const url = absolute ? new URL(urlString) : new URL(urlString, 'https://placeholder.invalid')
    if (!url.searchParams.has('token')) return urlString
    url.searchParams.delete('token')
    if (!absolute) return `${url.pathname}${url.search}${url.hash}`
    return url.toString()
  } catch {
    return urlString
  }
}

export const readAutologinParams = (win) => {
  const query = new URLSearchParams(win?.location?.search || '')
  const stash = win?.[AUTOLOGIN_STASH_KEY]
  if (stash?.token) {
    return {
      token: stash.token,
      project: stash.project ?? query.get('project')
    }
  }

  return {
    token: query.get('token'),
    project: query.get('project')
  }
}

export const stashAndStripAutologinQuery = (win) => {
  if (!win?.location || !win.history?.replaceState) return

  const url = new URL(win.location.href)
  const token = url.searchParams.get('token')
  if (!token) return

  win[AUTOLOGIN_STASH_KEY] = {
    token,
    project: url.searchParams.get('project')
  }
  url.searchParams.delete('token')
  win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
