// Adapted from shadcn/ui Base UI dialog, commit
// 7c9eaba1c0a6404c990c144a654792e3313c650d (MIT).
import React, { useCallback, useEffect, useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { LEGACY_DIALOG_LAYER, useDialogLayer } from './dialog-layer'
import { useOrderingUI } from './theme'
import { focusPageStart } from '../../../../../utils/focusPageStart'
import './dialog.css'

const getOpenPopupCount = host => host?.querySelectorAll(
  '.popup-component[data-od-dialog-owner][data-open]'
).length || 0

export const Dialog = React.forwardRef(function OrderingDialog ({
  open = false,
  onClose,
  closeOnBackdrop = true,
  isTopPosition,
  backdropClassName,
  title,
  role,
  initialFocus,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy
}, forwardedRef) {
  const { style, dir } = useOrderingUI()
  const popupRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const layer = useDialogLayer({ open, kind: LEGACY_DIALOG_LAYER, backdropClassName, popupRef, lastFocusedRef })
  const openerRef = useRef(null)
  const previousOpenRef = useRef(false)
  const openedWithoutOpenerRef = useRef(false)

  if (open && !previousOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement
    openedWithoutOpenerRef.current = !openerRef.current || openerRef.current === document.body
  }

  useEffect(() => {
    previousOpenRef.current = open
  }, [open])

  // (row 10): a dialog that opens by itself (the products start guide) records <body> as its opener. Handing <body> back
  // makes the browser fall to the first tabbable of the page («Skip to content»). With no real opener left, the focus goes to the
  // start of the page, the same place the sidebar menu and the Billing dialog use. A layer still open below keeps its own rule.
  // Only for a dialog that OPENED without an opener: a real opener that unmounted while the dialog was open (a deleted row) keeps
  // the earlier behavior, so the page does not jump to the top.
  const finalFocus = () => {
    const opener = openerRef.current
    const hasOpener = Boolean(opener) && opener !== document.body && opener.isConnected
    const target = layer.resolveFinalFocus(hasOpener ? opener : null)
    if (target || hasOpener || !openedWithoutOpenerRef.current) return target
    // Base UI reads `false` as "do not move the focus"; the page start is focused once the popup is gone.
    queueMicrotask(() => focusPageStart(null))
    return false
  }

  const handleOpenChange = (nextOpen, eventDetails) => {
    if (nextOpen || !open) return

    const isDismissal = eventDetails.reason === 'escape-key' || eventDetails.reason === 'outside-press'
    const blocksBackdrop = eventDetails.reason === 'outside-press' && !closeOnBackdrop
    const blocksTopPosition = isTopPosition && getOpenPopupCount(layer.host) >= 2
    if (!layer.isActive || !isDismissal || blocksBackdrop || blocksTopPosition || !onClose) {
      eventDetails.cancel()
      return
    }
    onClose()
  }

  const setPopupRef = useCallback(node => {
    popupRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  if (!layer.host || !layer.ready) return null

  const resolvedAriaLabel = ariaLabel ?? (
    !ariaLabelledBy && typeof title === 'string' ? title : undefined
  )
  const popupAccessibilityProps = Object.fromEntries(Object.entries({
    role,
    'aria-label': resolvedAriaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy
  }).filter(([, value]) => value !== undefined))

  return (
    <DialogPrimitive.Root
      open={open}
      modal={layer.isActive}
      disablePointerDismissal={!layer.isActive || !closeOnBackdrop}
      onOpenChange={handleOpenChange}
    >
      <DialogPrimitive.Portal
        container={layer.host}
        className='od-ui od-dialog-legacy-portal'
        style={{ ...style, '--od-dialog-layer': layer.order }}
      >
        <DialogPrimitive.Backdrop className='od-dialog-legacy-backdrop' />
        <DialogPrimitive.Popup
          ref={setPopupRef}
          className='popup-component od-ui od-dialog-legacy-popup'
          data-od-dialog-owner=''
          style={style}
          dir={dir}
          initialFocus={layer.isActive ? initialFocus : false}
          finalFocus={finalFocus}
          {...popupAccessibilityProps}
          onFocusCapture={event => {
            lastFocusedRef.current = event.target
          }}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
})

Dialog.displayName = 'OrderingDialog'
