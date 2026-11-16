import React, { useEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'

import { X } from '../Icon'
import { CONFIRM_DIALOG_LAYER, useDialogLayer } from '../UI/dialog-layer'
import { Button, IconButton } from './Button'
import { cx } from './classNames'
import { useProductDir } from './useProductDir'
import '../UI/dialog.css'
import './product.css'
import './dialog.css'

/**
 * Layer plumbing shared by Dialog, ConfirmDialog and Sheet. It joins the legacy
 * dialog layer registry (`Shared/UI/dialog-layer`), so a Product overlay and a
 * legacy dialog can be open together: the portal mounts in the shared host, only
 * the topmost layer is modal and may dismiss on Escape or outside press, and the
 * focus goes back to the opener (or to the layer underneath).
 *
 * The layer stays registered while the popup plays its exit transition and is
 * released when Base UI reports the close as complete.
 *
 * `modal: false` is for a popover (a filter pill, the date range): while it is the only layer in the
 * shared host, the host lets the pointer through, so a click outside the popover closes it and still
 * reaches what was under it (redesign F1b, D-11). The popup takes the pointer back (`portalStyle`).
 * Dialog, ConfirmDialog and Sheet keep the default and block outside clicks.
 *
 * redesign F6h-1 (A2-01): a modal layer also traps Tab synchronously and leaves the page behind `inert` (see
 * `dialog-layer`), because Base UI's guards alone let a quick Tab reach <body>, the sidebar and the controls behind.
 * A non-modal layer does neither.
 */
export const useOverlayLayer = (open, { modal = true } = {}) => {
  const popupRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const openerRef = useRef(null)
  const previousOpenRef = useRef(false)
  const openRef = useRef(open)
  const [present, setPresent] = useState(open)
  openRef.current = open
  if (open && !present) setPresent(true)

  const layer = useDialogLayer({ open: present, kind: CONFIRM_DIALOG_LAYER, popupRef, lastFocusedRef, modal, trapFocus: modal, engaged: open })

  if (open && !previousOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement
  }
  useEffect(() => {
    previousOpenRef.current = open
  }, [open])

  return {
    layer,
    popupRef,
    lastFocusedRef,
    portalStyle: modal
      ? { '--od-dialog-layer': layer.order }
      : { '--od-dialog-layer': layer.order, pointerEvents: 'auto' },
    finalFocus: () => layer.resolveFinalFocus(openerRef.current),
    // redesign W0-2 r2 (W0-Q1-06): where the focus goes when the opener left the page (a control that remounted
    // while the overlay was open). `fallback` is an element, a ref or a function; the layer rules still apply.
    finalFocusWith: (fallback, preferFallback = false) => {
      const opener = openerRef.current
      if (!preferFallback && opener?.isConnected && opener !== document.body) return layer.resolveFinalFocus(opener)
      const target = typeof fallback === 'function' ? fallback() : (fallback && 'current' in fallback ? fallback.current : fallback)
      return layer.resolveFinalFocus(target?.isConnected ? target : opener)
    },
    onOpenChangeComplete: (isOpen) => {
      if (!isOpen && !openRef.current) setPresent(false)
    }
  }
}

/** Title (h2, start-aligned) and the close button. `closeDisabled` is for a busy confirmation. */
export const OverlayHeader = ({ title, closeLabel, onClose, closeDisabled }) => (
  <div className='odc-overlay-head'>
    <DialogPrimitive.Title className='odc-overlay-title'>{title}</DialogPrimitive.Title>
    <IconButton
      icon={X}
      label={closeLabel}
      className='odc-overlay-close'
      disabled={closeDisabled}
      onClick={onClose}
    />
  </div>
)

const portalClass = 'odc-root odc-overlay-portal'

/**
 * Product dialog (C8) on Base UI Dialog. Widths 400 / 560 / 720 (`sm`, `md`, `lg`),
 * title at the start, footer with the secondary action first and the primary last
 * (the consumer orders them); on mobile it becomes a bottom sheet and the footer
 * buttons take the full width.
 *
 * `title` and `closeLabel` are required (the dialog's name and the close button's
 * name); the wrapper has no text of its own. `dismissible={false}` turns off
 * Escape and outside press, for flows that must finish; the close button stays.
 * Focus starts on `initialFocus` or the first tabbable element, is trapped, and
 * returns to the opener. The page behind is inert.
 *
 * redesign IM-C (D3): OPT-IN `closeDisabled` (boolean, `false` by default) is for a dialog that cannot be left
 * while it works (the menu import): the close button is `disabled` and Escape and the scrim do not close it, whatever
 * `dismissible` says (like a busy ConfirmDialog). The rest of the dialog keeps working. Without the prop nothing changes.
 */
export const Dialog = ({
  open = false,
  onOpenChange,
  title,
  description,
  size = 'md',
  closeLabel,
  footer,
  initialFocus,
  dismissible = true,
  closeDisabled = false,
  className,
  children,
  returnFocus,
  preferReturnFocus = false,
  ...props
}) => {
  // redesign W0-2 r2 (W0-Q1-01): empty translation paints empty, only a missing label throws
  if (title == null) throw new Error('Dialog needs a title')
  if (closeLabel == null) throw new Error('Dialog needs a closeLabel')
  const dir = useProductDir()
  const { layer, popupRef, lastFocusedRef, portalStyle, finalFocus, finalFocusWith, onOpenChangeComplete } = useOverlayLayer(open)

  const handleOpenChange = (nextOpen, details) => {
    if (nextOpen || !open) return
    if (!layer.isActive || !dismissible || closeDisabled || details.reason !== 'escape-key') {
      details.cancel()
      return
    }
    onOpenChange?.(false)
  }

  if (!layer.ready) return null

  return (
    <DialogPrimitive.Root
      open={open}
      modal={layer.isActive}
      disablePointerDismissal
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <DialogPrimitive.Portal container={layer.host} className={portalClass} style={portalStyle} dir={dir}>
        <DialogPrimitive.Backdrop
          className='odc-overlay-backdrop'
          onClick={() => {
            if (layer.isActive && dismissible && !closeDisabled) onOpenChange?.(false)
          }}
        />
        <DialogPrimitive.Popup
          ref={popupRef}
          className={cx('odc-dialog', className)}
          data-size={size}
          dir={dir}
          initialFocus={layer.isActive ? (initialFocus ?? true) : false}
          finalFocus={returnFocus ? () => finalFocusWith(returnFocus, preferReturnFocus) : finalFocus}
          onFocusCapture={event => { lastFocusedRef.current = event.target }}
          {...props}
        >
          <OverlayHeader title={title} closeLabel={closeLabel} onClose={() => onOpenChange?.(false)} closeDisabled={closeDisabled || undefined} />
          <div className='odc-overlay-body'>
            {description && (
              <DialogPrimitive.Description render={<div />} className='odc-overlay-desc'>
                {description}
              </DialogPrimitive.Description>
            )}
            {children}
          </div>
          {footer && <div className='odc-overlay-foot'>{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Confirmation for a destructive or money action (C8) on Base UI AlertDialog
 * (`role="alertdialog"`). The title names the object ("Delete order #13729?"),
 * `children` say the consequence, and `confirmLabel` is verb + object or amount
 * ("Delete order", "Refund $35.23"). The initial focus is on Cancel, never on the
 * action. Escape, a click outside and the close button call `onCancel`, never
 * `onConfirm`. While `busy` nothing can cancel or close and the action cannot be
 * repeated.
 *
 * Base UI's AlertDialog is always modal and never dismisses on an outside press,
 * so the scrim click is handled here, and only while this is the topmost layer.
 *
 * redesign stores 2.A (decision 4): an OPT-IN middle action for a three-way question («Keep editing · Save ·
 * Discard»). With `extraLabel` a plain (secondary) button sits between Cancel and the confirm action and calls `onExtra`; while
 * `busy` it is disabled like Cancel, except when it is the busy one (`busyAction='extra'`: it keeps the spinner, `aria-busy` and
 * the focus, its click is already blocked, and the confirm action is just disabled). `busyAction='confirm'` (default) puts the
 * spinner on the confirm action, as always. Without `extraLabel` nothing changes and `busyAction` is ignored. Initial focus
 * stays on Cancel.
 */
export const ConfirmDialog = ({
  open = false,
  title,
  children,
  confirmLabel,
  cancelLabel,
  closeLabel,
  tone = 'danger',
  busy = false,
  confirmDisabled = false,
  extraLabel,
  onExtra,
  busyAction = 'confirm',
  onConfirm,
  onCancel,
  size = 'sm',
  className,
  ...props
}) => {
  for (const [name, value] of Object.entries({ title, confirmLabel, cancelLabel, closeLabel })) {
    if (value == null) throw new Error(`ConfirmDialog needs a ${name}`) // redesign W0-2 r2 (W0-Q1-01)
  }
  const dir = useProductDir()
  const cancelRef = useRef(null)
  const { layer, popupRef, lastFocusedRef, portalStyle, finalFocus, onOpenChangeComplete } = useOverlayLayer(open)

  const hasExtra = extraLabel != null
  const extraBusy = hasExtra && busy && busyAction === 'extra'
  const confirmBusy = busy && !extraBusy

  const cancel = () => {
    if (!busy) onCancel?.()
  }

  const handleOpenChange = (nextOpen, details) => {
    if (nextOpen || !open) return
    if (busy || !layer.isActive || details.reason !== 'escape-key') {
      details.cancel()
      return
    }
    onCancel?.()
  }

  if (!layer.ready) return null

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <AlertDialogPrimitive.Portal container={layer.host} className={portalClass} style={portalStyle} dir={dir}>
        <AlertDialogPrimitive.Backdrop
          className='odc-overlay-backdrop'
          onClick={() => {
            if (layer.isActive) cancel()
          }}
        />
        <AlertDialogPrimitive.Popup
          ref={popupRef}
          className={cx('odc-dialog', className)}
          data-size={size}
          dir={dir}
          initialFocus={layer.isActive ? cancelRef : false}
          finalFocus={finalFocus}
          onFocusCapture={event => { lastFocusedRef.current = event.target }}
          {...props}
        >
          <OverlayHeader title={title} closeLabel={closeLabel} onClose={cancel} closeDisabled={busy} />
          <div className='odc-overlay-body'>
            <AlertDialogPrimitive.Description render={<div />} className='odc-overlay-desc'>
              {children}
            </AlertDialogPrimitive.Description>
          </div>
          <div className='odc-overlay-foot'>
            <Button ref={cancelRef} disabled={busy} onClick={cancel}>{cancelLabel}</Button>
            {hasExtra && (
              <Button busy={extraBusy} disabled={busy && !extraBusy} onClick={() => onExtra?.()}>{extraLabel}</Button>
            )}
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              busy={confirmBusy}
              disabled={confirmDisabled || extraBusy}
              onClick={() => onConfirm?.()}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
