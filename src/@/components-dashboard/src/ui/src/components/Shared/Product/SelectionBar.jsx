import React, { useEffect, useRef } from 'react'

import { X } from '../Icon'
import { IconButton } from './Button'
import { cx } from './classNames'
import './product.css'
import './selection-bar.css'

/**
 * Contextual selection bar (C6): «N selected · Select all M · actions · clear».
 * A named region; the counter is a polite status so a screen reader hears the
 * count change. Esc from inside the bar clears the selection. Pass `Button`s as
 * `actions` (`data-tone='danger'` marks the destructive one). All text, including
 * the clear button's name, comes from the caller.
 *
 * `busy` marks the region `aria-busy` and parks the select-all link (it stays in the tab
 * order, `aria-disabled`, so the focus is not lost); `message` is an inline alert next to
 * the count. If the select-all link had the focus and goes away, the focus moves to the
 * clear button instead of falling to the page.
 */
export const SelectionBar = ({
  label,
  countLabel,
  selectAllLabel,
  onSelectAll,
  actions,
  clearLabel,
  onClear,
  busy = false,
  message,
  className
}) => {
  // redesign W0-2 r2 (W0-Q1-01): empty translation paints empty, only a missing label throws
  if (label == null) throw new Error('SelectionBar needs a label')
  if (clearLabel == null) throw new Error('SelectionBar needs a clearLabel')
  const regionRef = useRef(null)
  const linkRef = useRef(null)
  const refocusRef = useRef(false)

  useEffect(() => {
    if (!refocusRef.current || busy) return
    refocusRef.current = false
    if (!linkRef.current) regionRef.current?.querySelector('[data-selbar-clear]')?.focus()
  })

  const handleSelectAll = () => {
    if (busy) return
    refocusRef.current = document.activeElement === linkRef.current
    onSelectAll()
  }

  return (
    <div
      ref={regionRef}
      role='region'
      aria-label={label}
      aria-busy={busy || undefined}
      className={cx('odc-root', 'odc-selbar', className)}
      onKeyDown={event => {
        if (event.key === 'Escape') onClear?.()
      }}
    >
      <span className='odc-selbar-count' role='status' aria-live='polite'>{countLabel}</span>
      {selectAllLabel && onSelectAll && (
        <button
          ref={linkRef}
          type='button'
          className='odc-selbar-link'
          aria-disabled={busy || undefined}
          onClick={handleSelectAll}
        >
          {selectAllLabel}
        </button>
      )}
      {message && <span className='odc-selbar-message' role='alert'>{message}</span>}
      <span className='odc-selbar-separator' aria-hidden='true' />
      <div className='odc-selbar-actions'>{actions}</div>
      <IconButton icon={X} label={clearLabel} size='sm' data-selbar-clear='' onClick={onClear} />
    </div>
  )
}
