// redesign tramo B r4 (W0-PB3-01): the report of an error that a boundary swallowed, in a module of its own so StepBoundary (the generic
// boundary) and ChunkErrorBoundary (which wraps it) share it without importing each other.
// With no boundary React 18 rethrows a render error to the window and DashboardAnalytics (listener of `error`) captures it as
// `dashboard_runtime_error`; a boundary swallows it, so it is raised again with `window.reportError` (the same `error` event on
// window), or an `ErrorEvent` dispatched by hand where reportError does not exist.
export const reportBoundaryError = (error) => {
  if (typeof window === 'undefined') return
  try {
    if (typeof window.reportError === 'function') window.reportError(error)
    else window.dispatchEvent(new ErrorEvent('error', { error, message: String(error?.message ?? error) }))
  } catch (_) {}
}
