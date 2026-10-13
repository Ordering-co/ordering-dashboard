import ResizeObserverPolyfill from 'resize-observer-polyfill'

/**
 * Chart.js uses ResizeObserver for responsive charts when the API is unavailable
 * (e.g. WebKit/iOS before adequate support).
 */
const installResizeObserverPolyfill = () => {
  if (typeof window === 'undefined') {
    return
  }

  if (typeof window.ResizeObserver !== 'undefined') {
    return
  }

  window.ResizeObserver = ResizeObserverPolyfill

  const sentryHub = window.__SENTRY__?.hub
  if (!sentryHub || typeof sentryHub.addBreadcrumb !== 'function') {
    return
  }

  try {
    sentryHub.addBreadcrumb({
      category: 'compat',
      message: 'ResizeObserver polyfill installed',
      level: 'info'
    })
  } catch (_error) {
    // Avoid breaking bootstrap if Sentry hub is incomplete
  }
}

installResizeObserverPolyfill()
