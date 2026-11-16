import React, { useEffect } from 'react'

import { useLanguage, useSession } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { focusPageStart } from '../../../../../utils/focusPageStart'
import { Button, EmptyState, IconButton } from '../Product'
import { Menu as MenuIcon } from '../Icon'
import { StepBoundary } from '../Product/Wizard/StepBoundary'
import { isChunkLoadError } from '~/utils/chunkReload'
import { reportBoundaryError } from '~/utils/reportBoundaryError'
// The page scope borrows the 404's frame (header row with the menu opener, gutter, state centred below): one stylesheet, not a copy.
import '../../PageNotFound/page-not-found.css'

// redesign tramo B r2 (W0-PB1-01): pages and the order panel are chunks loaded on demand. When one fails to load (a deploy
// replaced the files under an open tab, or the network dropped) `React.lazy` rejects and, with nothing to catch it, React
// unmounts the whole root: a blank screen. This boundary keeps the failure where it happened: the shell around it (menu,
// banners) stays, and the state offers the one action that works, reloading (a rejected lazy import is cached by React, so
// drawing the children again would not retry).
//
// `StepBoundary` is the generic error boundary of the repo (it has no text and no tie to the Wizard); it is imported by file
// so the Wizard barrel stays out of the entry.

export const reloadPage = () => window.location.reload()

// redesign tramo B r3 (W0-PB2-02, W0-QB2-03): the boundary catches ANY error of the content it wraps, not only a chunk that did not
// load, so it says which one it is and reports both.
//  - a load failure (the files were replaced by a deploy, or the network dropped): «The dashboard may have been updated…», reload;
//  - anything else (a bug while drawing): a generic text that does not blame a deploy or the connection;
//  - always reported: with no boundary React 18 rethrows to the window and DashboardAnalytics (listener of `error`) captures it as
//    `dashboard_runtime_error`; a boundary swallows it, so it is raised again here with `window.reportError` (the same `error`
//    event on window), or an `ErrorEvent` dispatched by hand where reportError does not exist.
// redesign tramo B r4 (W0-PB3-01): the report lives in utils/reportBoundaryError.js and StepBoundary does it by default, so it is
// reported once per error, here and in the wizard's boundaries alike.
export { reportBoundaryError }

/**
 * The error state: Product EmptyState (tone error, announced) with «Reload». `onClose` adds a secondary «Close» for panels.
 * `error` picks the text (load failure or other); `scope='order'` is the order panel: its title speaks of the order, not of a page; `scope='orderForm'` is the custom-order sheet: it speaks of the form.
 */
export const ChunkErrorState = ({ error, scope = 'page', onReload = reloadPage, onClose, className }) => {
  const [, t] = useLanguage()
  const [{ auth }] = useSession()
  const [infoState, infoActions] = useInfoShare()
  const loadFailure = isChunkLoadError(error)
  const isPage = scope === 'page'
  const handleMenuCollapse = infoActions?.handleMenuCollapse

  // the state is the whole page, so the focus goes to its start (the h1) when it was lost, and is not taken from a control
  // that still has it. Only the page scope: the panels around an intact page keep their own focus handling.
  useEffect(() => {
    if (!isPage) return
    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) focusPageStart(null)
  }, [isPage])

  // redesign tramo B cierre (W0-QB4-03, W0-PB4-02): `scope='orderForm'` is the custom-order wizard's sheet: the page behind it is intact,
  // what did not load is the form.
  const title = scope === 'order'
    ? t('ORDER_PANEL_ERROR_TITLE', 'This order could not be opened')
    : scope === 'orderForm'
      ? t('ORDER_FORM_ERROR_TITLE', 'The order form could not be loaded')
      : loadFailure
        ? t('CHUNK_LOAD_ERROR_TITLE', 'This page could not be loaded')
        : t('RUNTIME_ERROR_TITLE', 'Something went wrong')
  const description = loadFailure || !error
    ? t('CHUNK_LOAD_ERROR_TEXT', 'The dashboard may have been updated, or the connection dropped. Reload to continue.')
    : t('RUNTIME_ERROR_TEXT', 'An unexpected error stopped this from showing. Reload to continue; if it keeps happening, contact support.')
  const state = (
    <EmptyState
      tone='error'
      className={className}
      data-chunk-error=''
      data-error-kind={loadFailure || !error ? 'load' : 'render'}
      style={{ flex: '1 1 auto', minWidth: 0 }}
      // as the 404 (SC-6), a page-wide state has the page's one heading at the page title's size
      titleAs={isPage ? 'h1' : undefined}
      size={isPage ? 'page' : undefined}
      title={title}
      description={description}
      action={(
        <span style={{ display: 'inline-flex', gap: 'var(--od-space-2)' }}>
          <Button variant='primary' onClick={onReload}>{t('RELOAD', 'Reload')}</Button>
          {onClose && <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>}
        </span>
      )}
    />
  )
  if (!isPage) return state
  // (NF-01): on a phone the menu is closed and this state replaces the page that would have had its «Open menu» button; without
  // it «Reload» was the only control, and a reload that fails again left only the browser's back button. Same frame and condition as the 404.
  return (
    <div className='odc-root odc-nf' data-slot='chunk-error-page' style={{ flex: '1 1 auto' }}>
      <div className='odc-nf-head'>
        {auth && infoState?.isCollapse && handleMenuCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
      </div>
      {state}
    </div>
  )
}

/**
 * Boundary for a lazy chunk. `resetKey` (e.g. the pathname) draws the children again when it changes. `fallback`
 * replaces the default state (a node, or `({ error, reset }) => node`), for a panel that keeps its own frame.
 * Every caught error is reported once (see `reportBoundaryError`; StepBoundary does it) and then `onError` runs.
 */
export const ChunkErrorBoundary = ({ resetKey, onReload, onClose, fallback, onError, scope, children }) => (
  <StepBoundary
    resetKey={resetKey}
    onError={onError}
    fallback={fallback ?? (({ error }) => <ChunkErrorState error={error} scope={scope} onReload={onReload} onClose={onClose} />)}
  >
    {children}
  </StepBoundary>
)
