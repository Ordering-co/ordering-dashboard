// Opening a plugin's own pages (its setup and its `links`), docs/PLUGIN_PAGES.md.
// A plugin that declares `links.launch` is asked for a one-time URL first, so
// the user's session never travels in the page URL; any other plugin gets its
// page opened as before, with the placeholders filled in.
import { getPluginSetupPath } from './posPluginCatalog'

// Keys of `links` that are not pages of their own: never shown as buttons.
export const PLUGIN_RESERVED_LINKS = ['launch', 'connection_status', 'setup']

// How long the plugin has to answer the launch.
export const PLUGIN_LAUNCH_TIMEOUT_MS = 8000

const PLACEHOLDER = /@\{([^}]+)\}/g

export const isAbsoluteUrl = (url) => /^(?:https?:)?\/\//i.test(url || '')

/**
 * A plugin path joined to its root, or the path itself when it is absolute.
 * Null when there is no path, or no root to join it to.
 * @param {string|null} path
 * @param {string|null} root
 * @returns {string|null}
 */
export const resolvePluginUrl = (path, root) => {
  if (!path) return null
  if (isAbsoluteUrl(path)) return path
  if (!root) return null
  return root.endsWith('/') && path.startsWith('/') ? `${root}${path.slice(1)}` : `${root}${path}`
}

/**
 * Replaces the @{name} placeholders of a URL; unknown ones stay as they are.
 * @param {string} url
 * @param {object} variables
 * @returns {string}
 */
export const fillPluginPlaceholders = (url, variables) =>
  (url || '').replace(PLACEHOLDER, (match, key) => variables[key] !== undefined && variables[key] !== null ? variables[key] : match)

/**
 * The path of one of the plugin's pages: `setup` is its setup page
 * (setup_url, else links.setup), anything else the key of a link.
 * @param {object|null} plugin
 * @param {string} page
 * @returns {string|null}
 */
export const getPluginPagePath = (plugin, page) => {
  if (page === 'setup') return getPluginSetupPath(plugin)
  if (PLUGIN_RESERVED_LINKS.includes(page)) return null
  return plugin?.links?.[page] || null
}

/**
 * The keys of `links` that are pages the user can open: never the reserved
 * ones, nor the setup page under another key.
 * @param {object|null} plugin
 * @returns {Array<string>}
 */
export const getPluginPageLinkKeys = (plugin) => {
  const links = plugin?.links || {}
  const setupPath = getPluginSetupPath(plugin)
  return Object.keys(links).filter(key => !PLUGIN_RESERVED_LINKS.includes(key) && links[key] !== setupPath)
}

/**
 * Whether the plugin opens its pages through `links.launch`.
 * @param {object|null} plugin
 * @returns {boolean}
 */
export const hasPluginLaunch = (plugin) => Boolean(plugin?.links?.launch)

/**
 * Asks the plugin for the URL of one of its pages (`links.launch`): a POST
 * with the user's session in the Authorization header. The plugin answers
 * `{ error: false, result: { url } }`, a URL relative to its root or absolute,
 * with a short-lived single-use code instead of the session.
 * @param {{
 *   plugin: object,
 *   page: string,
 *   body: object,
 *   token: string,
 *   variables: object,
 *   timeoutMs?: number,
 *   fetchImpl?: function
 * }} options
 * @returns {Promise<{ url: string }|{ error: 'failed'|'timeout', message: string|null }>}
 */
export const requestPluginLaunch = async ({ plugin, page, body, token, variables, timeoutMs = PLUGIN_LAUNCH_TIMEOUT_MS, fetchImpl = fetch }) => {
  const launchUrl = resolvePluginUrl(fillPluginPlaceholders(plugin?.links?.launch, variables), plugin?.root)
  if (!launchUrl) return { error: 'failed', message: null }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(launchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ page, ...body }),
      signal: controller.signal
    })
    const json = await response.json().catch(() => null)
    const url = resolvePluginUrl(typeof json?.result?.url === 'string' ? json.result.url : null, plugin?.root)
    if (!response.ok || !json || json.error || !url) {
      // The plugin's reason, when it answers like the API ({ error, result }).
      const result = Array.isArray(json?.result) ? json.result[0] : json?.result
      const message = typeof result === 'string' && result.trim() ? result.trim() : null
      return { error: 'failed', message }
    }
    return { url }
  } catch (err) {
    return { error: controller.signal.aborted ? 'timeout' : 'failed', message: null }
  } finally {
    clearTimeout(timer)
  }
}
