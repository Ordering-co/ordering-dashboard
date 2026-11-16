import React, { useEffect, useLayoutEffect, useRef } from 'react'

import { Check, CircleAlert } from '../Icon'
import { Button } from './Button'
import { cx } from './classNames'
import { tokenPx } from './positioning'
import './product.css'
import './save-bar.css'

// redesign UF-B1b (decision 1): promoted from Settings/SettingsHubForm/SettingsSaveBar.jsx (decision 4) when
// the profile form became its second surface. It is presentational and has no text of its own: the form gives it the count of
// unsaved changes, their names, the saving flag, the error and the «saved» flag, the handlers, and every string already translated.

/** How many field names the bar lists before «+n». */
const NAMES_SHOWN = 3

// The box the sticky bar sticks to: the nearest ancestor that scrolls on the block axis (null: the page).
const SCROLLS = /auto|scroll/
const scrollerOf = node => {
  for (let element = node.parentElement; element; element = element.parentElement) {
    if (element === document.body || element === document.documentElement) return null
    if (SCROLLS.test(window.getComputedStyle(element).overflowY || '')) return element
  }
  return null
}

// redesign stores: the toast is fixed bottom-end and covered Discard / Save (at 390px a tap on Save landed on it). While
// a bar is drawn it publishes its height + a gap as --od-toast-offset on <html>, and UI/toast.css lifts the toast by it. Each drawn
// bar owns one entry; the variable is the tallest entry, and it is removed when the last entry goes, so one bar cleaning up never
// erases another's offset.
const TOAST_OFFSET_VAR = '--od-toast-offset'
const TOAST_OFFSET_GAP = 12
const toastOffsets = new Set()
const publishToastOffset = () => {
  const style = document.documentElement.style
  if (toastOffsets.size === 0) {
    style.removeProperty(TOAST_OFFSET_VAR)
    return
  }
  let tallest = 0
  toastOffsets.forEach(entry => { tallest = Math.max(tallest, entry.height) })
  style.setProperty(TOAST_OFFSET_VAR, `${Math.ceil(tallest) + TOAST_OFFSET_GAP}px`)
}

/**
 * Sticky save bar: «N unsaved changes · A, B, C +2 · Discard · Save». Visible from the first change, while saving, with an error
 * or while «saved». A named group; the error is an alert and the «saved» notice is a status.
 *
 * Focus: the button that had it (Save) goes away when the changes are stored, so the focus moves to the «Saved» status instead of
 * falling to `<body>`. When the bar goes away with the focus inside it, the focus goes back to the form it belongs to: the first
 * element matching `formSelector` inside the bar's parent (a sibling form), else the closest ancestor that matches (a bar rendered
 * inside the form). That element needs `tabIndex={-1}` to be focusable; with none, the focus is left alone.
 *
 * Inside a `<form>`, `saveType='submit'` turns Save into the form's submit button: Enter in a field and the form's own
 * validation keep working, and `onSave` becomes optional. While saving it is a plain button so a click cannot submit twice.
 *
 * redesign stores 2.A (decision 4): OPT-IN retry. With `onRetry`, the error line (an error that is drawn, not while saving)
 * gets a small ghost button with `retryLabel` right after the error text, for a failed save the user can simply try again. It is
 * the form's own handler (usually the same as `onSave`). Without `onRetry` the bar is exactly as before.
 *
 * Figures stay prose (decision 11: mono never in prose), so `countText` is a sentence, not a `.odc-figure`.
 *
 * @param {object} props
 * @param {string} props.label accessible name of the group (required; `''` paints empty)
 * @param {number} [props.count] unsaved changes, counted by visible field
 * @param {string} [props.countText] «2 unsaved changes», already translated and pluralized
 * @param {string[]} [props.names] names of the changed fields (the first three are listed)
 * @param {(n: number) => string} [props.moreText] «+n» for the names that do not fit (required when they overflow)
 * @param {boolean} [props.saving]
 * @param {string|null} [props.errorText] the composed error, already translated (null: no error)
 * @param {() => void} [props.onRetry] draws a «retry» button after the error text (opt-in)
 * @param {string} [props.retryLabel] «Try again», already translated (required when `onRetry` is given and the error is drawn)
 * @param {boolean} [props.saved] a save just ended well (the form clears it after a while)
 * @param {string} [props.savedText] «Saved» (required while the saved notice is drawn)
 * @param {string} [props.discardLabel] required when `count > 0`
 * @param {string} [props.saveLabel] required when `count > 0`
 * @param {'button'|'submit'} [props.saveType]
 * @param {() => void} [props.onDiscard]
 * @param {() => void} [props.onSave] optional with `saveType='submit'`
 * @param {string} [props.formSelector] CSS selector of the form that gets the focus back (default `'form'`)
 * @param {string} [props.className]
 */
export const SaveBar = ({
  label,
  count = 0,
  countText,
  names = [],
  moreText,
  saving = false,
  errorText = null,
  onRetry,
  retryLabel,
  saved = false,
  savedText,
  discardLabel,
  saveLabel,
  saveType = 'button',
  onDiscard,
  onSave,
  formSelector = 'form',
  className
}) => {
  // empty translation paints empty, only a missing label throws (W0-Q1-01)
  if (label == null) throw new Error('SaveBar needs a label')
  const savedRef = useRef(null)
  const pressedRef = useRef(false)

  useEffect(() => {
    if (!saved || !pressedRef.current) return
    pressedRef.current = false
    const active = document.activeElement
    if (!active || active === document.body || !document.body.contains(active)) savedRef.current?.focus()
  }, [saved])

  const visible = count > 0 || saving || errorText != null || saved

  // redesign settings R-02: when the bar goes with the focus inside it, the focus goes back to its form.
  const rootRef = useRef(null)
  const parentRef = useRef(null)
  const focusInsideRef = useRef(false)
  // Read before the commit that removes the bar: the node and the focus are still in the document.
  if (!visible && rootRef.current && rootRef.current.contains(document.activeElement)) focusInsideRef.current = true
  useEffect(() => {
    if (visible) {
      parentRef.current = rootRef.current?.parentElement || parentRef.current
      return
    }
    if (!focusInsideRef.current) return
    focusInsideRef.current = false
    const parent = parentRef.current
    // redesign UF-B1b: the lookup was `.odc-hub-form`; now the consumer's selector (a form that holds the bar, or a sibling)
    const form = parent?.querySelector(formSelector) || parent?.closest(formSelector)
    const active = document.activeElement
    if (form && (!active || active === document.body)) form.focus({ preventScroll: true })
  }, [visible, formSelector])

  // redesign stores 5.18 (F7 of 5.11, m3 of 5.13): the bar is sticky at the foot of its scroller. It appears with the
  // first keystroke and, on a phone, is two rows tall (≈100px): it covered the field being typed in, and the scroll margin some hosts
  // give their controls (70px) was not enough. While the bar is drawn, a focused control that comes before it and sits under it is
  // brought above it with a gap: when the bar appears or changes size, when the focus moves and while typing. Nothing else moves.
  useEffect(() => {
    if (!visible) return undefined
    const bar = rootRef.current
    if (!bar) return undefined
    let frame = 0
    const reveal = () => {
      frame = 0
      const active = document.activeElement
      if (!active || active === document.body || !bar.isConnected || bar.contains(active)) return
      // review F1: a focused container of the bar (the panel, the form it gives the focus back to) is not a field under it
      if (active.contains(bar)) return
      // only what comes before the bar in the page can be under it: what follows is below its own place
      if (!(bar.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_PRECEDING)) return
      const field = active.getBoundingClientRect()
      const box = bar.getBoundingClientRect()
      if (field.height === 0 || field.right <= box.left || field.left >= box.right) return
      const scroller = scrollerOf(bar)
      if (scroller && !scroller.contains(active)) return
      const gap = tokenPx('--od-space-4', bar) || 0
      const top = scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0
      // as much as it takes to clear the bar, never so much that the field's own top leaves the scroller
      const delta = Math.min(field.bottom + gap - box.top, field.top - top - gap)
      if (delta <= 0) return
      if (scroller) scroller.scrollBy?.({ top: delta })
      else window.scrollBy?.({ top: delta })
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(reveal)
    }
    schedule()
    document.addEventListener('focusin', schedule)
    document.addEventListener('input', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(bar)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('input', schedule)
      observer?.disconnect()
    }
  }, [visible])

  // keep the toast above the bar while it is drawn (measured before paint; follows the bar when it changes size)
  useLayoutEffect(() => {
    if (!visible) return undefined
    const bar = rootRef.current
    if (!bar) return undefined
    const entry = { height: 0 }
    const measure = () => {
      entry.height = bar.getBoundingClientRect().height || 0
      publishToastOffset()
    }
    toastOffsets.add(entry)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(bar)
    return () => {
      observer?.disconnect()
      toastOffsets.delete(entry)
      publishToastOffset()
    }
  }, [visible])

  if (!visible) return null

  if (count > 0) {
    if (discardLabel == null) throw new Error('SaveBar needs a discardLabel')
    if (saveLabel == null) throw new Error('SaveBar needs a saveLabel')
  }
  const showError = Boolean(errorText) && !saving
  if (showError && onRetry && retryLabel == null) throw new Error('SaveBar needs a retryLabel when it has onRetry')
  const showSaved = saved && count === 0 && !saving
  if (showSaved && savedText == null) throw new Error('SaveBar needs a savedText')

  const shown = names.slice(0, NAMES_SHOWN)
  const more = names.length - shown.length
  if (count > 0 && more > 0 && moreText == null) throw new Error('SaveBar needs a moreText when the names overflow')

  return (
    <div
      ref={rootRef}
      className={cx('odc-savebar', className)}
      role='group'
      aria-label={label}
      data-saving={saving ? '' : undefined}
    >
      <div className='odc-savebar-text'>
        {count > 0 && (
          <p className='odc-savebar-count'>
            {countText != null && <span className='odc-savebar-total'>{countText}</span>}
            {shown.length > 0 && (
              <span className='odc-savebar-names'>
                {countText != null && ' · '}
                {shown.join(', ')}
                {more > 0 && ` ${moreText(more)}`}
              </span>
            )}
          </p>
        )}
        {showError && (
          <div className='odc-savebar-error'>
            <p className='odc-savebar-message' data-tone='error' role='alert'>
              <CircleAlert className='odc-icon' aria-hidden='true' />
              <span>{errorText}</span>
            </p>
            {/* review F3-R7: next to the alert, not inside it (the label is not read as part of the error) */}
            {onRetry && <Button variant='ghost' size='sm' onClick={() => onRetry()}>{retryLabel}</Button>}
          </div>
        )}
        {showSaved && (
          <p ref={savedRef} className='odc-savebar-message' data-tone='success' role='status' tabIndex={-1}>
            <Check className='odc-icon' aria-hidden='true' />
            <span>{savedText}</span>
          </p>
        )}
      </div>
      {count > 0 && (
        <div className='odc-savebar-actions'>
          <Button disabled={saving} onClick={onDiscard}>
            {discardLabel}
          </Button>
          <Button
            variant='primary'
            type={saveType === 'submit' && !saving ? 'submit' : 'button'}
            busy={saving}
            onClick={() => {
              pressedRef.current = true
              onSave?.()
            }}
          >
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
