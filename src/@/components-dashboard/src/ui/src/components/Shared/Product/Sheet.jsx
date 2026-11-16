import React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { OverlayHeader, useOverlayLayer } from './Dialog'
import { cx } from './classNames'
import { useProductDir } from './useProductDir'
import './product.css'
import './dialog.css'
import './sheet.css'

/**
 * Product sheet (C8, C15) on Base UI Dialog: a lateral panel (`end` by default,
 * `start`) or a `bottom` sheet. Header with the title and the close button, a body
 * that scrolls, and a footer that stays fixed. Below 768px the lateral sides take
 * the full width. It slides in from its own side (mirrored in RTL) and only fades
 * under reduced motion.
 *
 * This is the overlay sheet. The split view of the orders detail (C8, from
 * 1280px) is a layout, not a Sheet.
 *
 * `title` and `closeLabel` are required; the wrapper has no text of its own.
 * Focus starts on `initialFocus` or the first tabbable element, is trapped, and
 * returns to the opener. The page behind is inert. Escape, the close button and
 * a click on the scrim call `onOpenChange(false)` while it is the topmost layer.
 *
 * (drivers-dashboard P4): OPT-IN `returnFocus` (an element, a ref or a function), as in Dialog: where the focus
 * goes on close when the opener is gone or was the body (a sheet opened from the URL). Without it nothing changes.
 */
export const Sheet = ({
  open = false,
  onOpenChange,
  title,
  closeLabel,
  side = 'end',
  footer,
  initialFocus,
  className,
  children,
  returnFocus,
  ...props
}) => {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (title == null) throw new Error('Sheet needs a title')
  if (closeLabel == null) throw new Error('Sheet needs a closeLabel')
  const dir = useProductDir()
  const { layer, popupRef, lastFocusedRef, portalStyle, finalFocus, finalFocusWith, onOpenChangeComplete } = useOverlayLayer(open)

  const handleOpenChange = (nextOpen, details) => {
    if (nextOpen || !open) return
    if (!layer.isActive || details.reason !== 'escape-key') {
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
      <DialogPrimitive.Portal container={layer.host} className='odc-root odc-overlay-portal' style={portalStyle} dir={dir}>
        <DialogPrimitive.Backdrop
          className='odc-overlay-backdrop'
          onClick={() => {
            if (layer.isActive) onOpenChange?.(false)
          }}
        />
        <DialogPrimitive.Popup
          ref={popupRef}
          className={cx('odc-sheet', className)}
          data-side={side}
          dir={dir}
          initialFocus={layer.isActive ? (initialFocus ?? true) : false}
          finalFocus={returnFocus ? () => finalFocusWith(returnFocus) : finalFocus}
          onFocusCapture={event => { lastFocusedRef.current = event.target }}
          {...props}
        >
          <OverlayHeader title={title} closeLabel={closeLabel} onClose={() => onOpenChange?.(false)} />
          <div className='odc-overlay-body'>{children}</div>
          {footer && <div className='odc-overlay-foot'>{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
