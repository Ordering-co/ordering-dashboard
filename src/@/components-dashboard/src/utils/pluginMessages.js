// Messages a plugin page sends to the dashboard window that opened it
// (docs/PLUGIN_PAGES.md). The page runs inside the plugin modal's iframe, or
// in a popup it opened; it calls
//   window.parent.postMessage({ type: 'ordering:plugin', event, ... }, '@{dashboard_origin}')
// The message only tells the dashboard what happened: the integration's state
// is always read again from the API, never taken from the message.

export const PLUGIN_MESSAGE_TYPE = 'ordering:plugin'

export const PLUGIN_MESSAGE_EVENTS = {
  // The setup ended; `status` is 'success' or 'failed', `message` optional,
  // `close: true` when the page also wants its window closed.
  SETUP_FINISHED: 'setup_finished',
  // The page asks the dashboard to close its window, like the X.
  CLOSE: 'close',
  // The page says how tall its content is (`height`, px), so the window
  // fits it instead of keeping a fixed height, and optionally the width it
  // wants (`size`, PLUGIN_FRAME_SIZES). Optional.
  RESIZE: 'resize'
}

// Widths a page can ask for with `size`. A page opened through links.launch
// starts `small`; any other `large`, the size plugin modals always had.
export const PLUGIN_FRAME_SIZES = {
  small: '640px',
  medium: '900px',
  large: '80vw'
}

// Bounds of a plugin window that reports its height: never shorter than
// this, never taller than 80% of the viewport (it scrolls inside).
export const PLUGIN_FRAME_MIN_HEIGHT = 160
export const PLUGIN_FRAME_MAX_VIEWPORT = 0.8
// A page opened through links.launch starts at this height until it reports
// its own; one that never does gets the maximum after this delay.
export const PLUGIN_FRAME_INITIAL_HEIGHT = 320
export const PLUGIN_FRAME_RESIZE_WAIT_MS = 1500

/**
 * The height of a plugin window for the content height its page reported,
 * within the bounds above.
 * @param {number} height
 * @param {number} viewportHeight
 * @returns {number}
 */
export const clampPluginFrameHeight = (height, viewportHeight = window.innerHeight) => {
  const max = Math.max(PLUGIN_FRAME_MIN_HEIGHT, Math.floor(viewportHeight * PLUGIN_FRAME_MAX_VIEWPORT))
  return Math.min(Math.max(Math.ceil(height), PLUGIN_FRAME_MIN_HEIGHT), max)
}

/**
 * Size of a plugin modal, decided before it opens so its width does not move:
 * `small` for a page opened through links.launch, `large` (the size plugin
 * modals always had) for any other, unless the page asked for a size. Its
 * height follows the page once the page reports one (or fits it from the
 * start); otherwise it is fixed.
 * @param {{ fits: boolean, size: string|null, height: number|null }} frame
 * @returns {{ width: string, height: string }}
 */
export const pluginModalSize = ({ fits, size, height }) => ({
  width: PLUGIN_FRAME_SIZES[size] || (fits ? PLUGIN_FRAME_SIZES.small : PLUGIN_FRAME_SIZES.large),
  height: (fits || height) ? 'auto' : '80vh'
})

/**
 * Height of the box that holds a plugin page: the height the page reported;
 * before that, the last height it reported (remembered) or a compact default
 * for a page that fits; otherwise the fixed height plugin modals always had.
 * @param {{ fits: boolean, height: number|null, initialHeight?: number|null }} frame
 * @returns {string}
 */
export const pluginFrameHeight = ({ fits, height, initialHeight = null }) => {
  if (height) return `${height}px`
  if (fits) return `${initialHeight || PLUGIN_FRAME_INITIAL_HEIGHT}px`
  return '85%'
}

const rememberedHeightKey = (key) => `ordering:pluginFrameHeight:${key}`

/**
 * The height a plugin page reported the last time it was open, so the next
 * time it opens at it instead of a default. Per browser; null when unknown
 * or storage is not available.
 * @param {string|null} key plugin key and page
 * @returns {number|null}
 */
export const rememberedPluginFrameHeight = (key) => {
  if (!key) return null
  try {
    const height = Number(window.localStorage.getItem(rememberedHeightKey(key)))
    return Number.isFinite(height) && height > 0 ? clampPluginFrameHeight(height) : null
  } catch (err) {
    return null
  }
}

export const rememberPluginFrameHeight = (key, height) => {
  if (!key) return
  try {
    window.localStorage.setItem(rememberedHeightKey(key), String(height))
  } catch (err) {
    // No storage: the next open starts at the default height
  }
}

/**
 * The origin of a URL, or null when it is not an absolute URL.
 * @param {string} url
 * @returns {string|null}
 */
export const getUrlOrigin = (url) => {
  try {
    return new URL(url).origin
  } catch (err) {
    return null
  }
}

/**
 * The value of the @{dashboard_origin} placeholder: where a plugin page sends
 * its messages.
 * @returns {string}
 */
export const getDashboardOrigin = () => encodeURIComponent(window.location.origin)

/**
 * The plugin message in a `message` event, or null when it is not one this
 * window accepts: it must come from the plugin's window (`source`), from the
 * origin of the URL that window opened (`origin`), carry the
 * 'ordering:plugin' type and a known event, and, when it names a store, be
 * about the store this window is for (`businessId`).
 * @param {MessageEvent} event
 * @param {{ source: Window|null, origin: string|null, businessId: number|string|null }} expected
 * @returns {{ event: string, status: 'success'|'failed'|null, message: string|null, close: boolean, height: number|null, size: string|null }|null}
 */
export const readPluginMessage = (event, { source, origin, businessId = null } = {}) => {
  if (!event || !source || !origin) return null
  if (event.source !== source || event.origin !== origin) return null

  const data = event.data
  if (!data || typeof data !== 'object' || data.type !== PLUGIN_MESSAGE_TYPE) return null
  if (!Object.values(PLUGIN_MESSAGE_EVENTS).includes(data.event)) return null

  if (data.business_id !== undefined && data.business_id !== null && businessId !== null &&
    String(data.business_id) !== String(businessId)) {
    return null
  }

  if (data.event === PLUGIN_MESSAGE_EVENTS.RESIZE) {
    const height = typeof data.height === 'number' ? data.height : NaN
    if (!Number.isFinite(height) || height <= 0) return null
    const size = Object.prototype.hasOwnProperty.call(PLUGIN_FRAME_SIZES, data.size) ? data.size : null
    return { event: data.event, status: null, message: null, close: false, height, size }
  }

  const status = data.event === PLUGIN_MESSAGE_EVENTS.SETUP_FINISHED
    ? (data.status === 'success' ? 'success' : 'failed')
    : null
  const message = typeof data.message === 'string' && data.message.trim() ? data.message.trim() : null

  // Closing is the page's call: a setup can finish and still show the user
  // something before it goes.
  const close = data.event === PLUGIN_MESSAGE_EVENTS.CLOSE || data.close === true

  return { event: data.event, status, message, close, height: null, size: null }
}
