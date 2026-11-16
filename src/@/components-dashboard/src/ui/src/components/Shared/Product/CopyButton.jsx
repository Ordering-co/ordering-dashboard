import React, { useEffect, useRef, useState } from 'react'

import { Check, Copy } from '../Icon'
import { Button, IconButton } from './Button'
import { cx } from './classNames'
import './product.css'
import './copy-button.css'

// redesign stores 5.15a (G5-04): the copy button of a snippet, a link or a code, promoted to P/ (the coordinator, 2026-10-11).
// The local copies (McpTokens, BusinessSyncStoreDetail, CustomerOverview) move to it in .

export const COPIED_FOR_MS = 2000

// The Clipboard API exists only in a secure context (https, localhost). Elsewhere (a dashboard opened by a private IP over http),
// and when the browser refuses it, a selected off-screen textarea and `execCommand('copy')` still copy. Nothing is logged.
const copyText = async (text) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {}
  }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.insetBlockStart = '0'
  area.style.opacity = '0'
  const focused = document.activeElement
  document.body.appendChild(area)
  area.focus({ preventScroll: true })
  area.select()
  let done = false
  try {
    done = document.execCommand('copy')
  } catch {
    done = false
  }
  area.remove()
  focused?.focus?.({ preventScroll: true })
  return done
}

/**
 * Copies `text` (C4). A native button that says «Copy» and, for two seconds after a copy, «Copied» with a check; the change is
 * announced through a polite live region. When the copy fails it says so beside the button (`failedLabel`), never silently.
 *
 * The piece has no text of its own: `label` is the accessible name and says what is copied («Copy popup script»: it starts with
 * the visible word, WCAG 2.5.3), `copyLabel`, `copiedLabel` and `failedLabel` are the visible words. All are required.
 * Without `text` (nothing to copy yet) the button is disabled. Size and variant are the P/Button ones (32px, 44px on a phone).
 *
 * redesign stores 5.18: OPT-IN `iconOnly`, the copy beside a value (an email, a URL): a P/IconButton named by `label`
 * (ghost unless `variant` says otherwise), its glyph a check while «Copied» is announced; `copyLabel` is not drawn and not needed.
 * Without it the button is exactly as before.
 *
 * Review F2 (stores 5.18): OPT-IN `announce={false}` with `onResult('copied' | 'failed')`, for a host that says the result itself in
 * one line under its block (beside an icon button the failure squeezed the value it copies). The piece then draws no status.
 */
export const CopyButton = React.forwardRef(function ProductCopyButton ({
  text,
  label,
  copyLabel,
  copiedLabel,
  failedLabel,
  variant,
  size = 'md',
  iconOnly = false,
  announce = true,
  onResult,
  onCopy,
  className,
  disabled,
  ...props
}, ref) {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('CopyButton needs a label')
  if (!iconOnly && copyLabel == null) throw new Error('CopyButton needs a copyLabel')
  if (copiedLabel == null) throw new Error('CopyButton needs a copiedLabel')
  if (failedLabel == null) throw new Error('CopyButton needs a failedLabel')

  const [state, setState] = useState('idle') // idle · copied · failed
  const timer = useRef(null)
  const generation = useRef(0)

  // a new text is a new copy: what was said about the old one goes
  useEffect(() => {
    generation.current += 1
    clearTimeout(timer.current)
    setState('idle')
  }, [text])
  useEffect(() => () => {
    generation.current += 1
    clearTimeout(timer.current)
  }, [])

  const handleCopy = async () => {
    if (!text) return
    const current = ++generation.current
    clearTimeout(timer.current)
    const done = await copyText(String(text))
    if (current !== generation.current) return
    setState(done ? 'copied' : 'failed')
    onResult?.(done ? 'copied' : 'failed')
    if (done) {
      onCopy?.()
      timer.current = setTimeout(() => {
        if (current === generation.current) setState('idle')
      }, COPIED_FOR_MS)
    }
  }

  const copied = state === 'copied'
  const shared = {
    ref,
    size,
    disabled: disabled || !text,
    'data-copied': copied ? 'true' : undefined,
    ...props,
    onClick: handleCopy
  }
  return (
    <span className={cx('odc-copy', className)}>
      {iconOnly
        ? <IconButton {...shared} icon={copied ? Check : Copy} label={label} variant={variant ?? 'ghost'} />
        : (
          <Button {...shared} variant={variant ?? 'secondary'} icon={copied ? Check : Copy} aria-label={label}>
            {/* both words share one cell, so the button keeps its width when the word changes */}
            <span className='odc-copy-words'>
              <span className='odc-copy-word' aria-hidden={copied ? 'true' : undefined}>{copyLabel}</span>
              <span className='odc-copy-word' aria-hidden={copied ? undefined : 'true'}>{copiedLabel}</span>
            </span>
          </Button>
          )}
      {announce && (
        <span role='status' className={state === 'failed' ? 'odc-copy-failed' : 'odc-sr-only'}>
          {copied ? copiedLabel : state === 'failed' ? failedLabel : ''}
        </span>
      )}
    </span>
  )
})
