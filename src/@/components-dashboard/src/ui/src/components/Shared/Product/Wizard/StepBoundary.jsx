import React from 'react'

import { reportBoundaryError } from '~/utils/reportBoundaryError'

/**
 * Error boundary of the create-order wizard (redesign fix-qa E3). A runtime error inside a step or
 * inside the map must never blank the app: the boundary draws `fallback` in its place and the rest of
 * the wizard (stepper, summary, footer) keeps working.
 *
 * `fallback` is a node or a function `({ error, reset }) => node`. `resetKey` changes -> the boundary
 * tries to draw its children again (e.g. the step changed or the data it was drawing changed).
 * The component has no text of its own.
 *
 * redesign tramo B r4 (W0-PB3-01): every caught error is reported with `window.reportError` (see utils/reportBoundaryError.js), because
 * a boundary swallows what React would have rethrown to the window, where DashboardAnalytics listens. `report={false}` turns it off.
 *
 * redesign W0-2c (D-23): «Try again» in a fallback calls `reset()`, which removes the fallback where the focus was.
 * `focusOnReset` (a ref, or a function that returns the element) says where it goes then: the step title or the
 * control the step came from. It is applied only when the error clears and the focus fell to <body> (or nowhere);
 * a focus the user already moved is never taken. Without it the boundary does not touch the focus.
 *
 * redesign W0-2 r2 (W0-Q1-02): the mirror moment. When a step fails, the control that had the focus is unmounted by the
 * fallback and the focus fell to <body>. `focusOnError` (same shape as `focusOnReset`: a ref, or a function that returns the
 * element) says where it goes when the boundary goes from no error to an error, and only if the focus is on <body> or left
 * the document; a focus that is still somewhere live is never taken. The target may be the step title (the role=alert
 * notice is announced and the focus is not lost) or the fallback's own action. Without it the boundary does not touch the focus.
 */
export class StepBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { error: null }
    this.reset = this.reset.bind(this)
  }

  static getDerivedStateFromError (error) {
    return { error }
  }

  componentDidCatch (error, info) {
    // redesign tramo B r4 (W0-PB3-01): a swallowed error is still reported to the window (as with no boundary, as in main), once.
    // `report={false}` is for a caller that reports it itself.
    if (this.props.report !== false) reportBoundaryError(error)
    this.props.onError?.(error, info)
  }

  componentDidUpdate (previous, previousState) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.reset()
    // redesign W0-2c (D-23)
    if (previousState.error && !this.state.error) this.restoreFocus()
    // redesign W0-2 r2 (W0-Q1-02)
    if (!previousState.error && this.state.error) this.keepFocusOnError()
  }

  // redesign W0-2 r2 (W0-Q1-02)
  keepFocusOnError () {
    const { focusOnError } = this.props
    if (!focusOnError) return
    const active = document.activeElement
    if (active && active !== document.body && document.contains(active)) return
    const target = typeof focusOnError === 'function' ? focusOnError() : focusOnError.current
    if (target && target.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true })
  }

  // redesign W0-2c (D-23)
  restoreFocus () {
    const { focusOnReset } = this.props
    if (!focusOnReset) return
    const active = document.activeElement
    if (active && active !== document.body && document.contains(active)) return
    const target = typeof focusOnReset === 'function' ? focusOnReset() : focusOnReset.current
    if (target && target.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true })
  }

  reset () {
    this.setState({ error: null })
  }

  render () {
    const { error } = this.state
    if (!error) return this.props.children
    const { fallback } = this.props
    return typeof fallback === 'function' ? fallback({ error, reset: this.reset }) : (fallback ?? null)
  }
}
