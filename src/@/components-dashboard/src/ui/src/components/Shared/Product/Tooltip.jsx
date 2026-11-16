import React, { useCallback, useId, useState } from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

import { cx } from './classNames'
import { tokenOffset } from './positioning'
import { useProductDir } from './useProductDir'
import './product.css'
import './tooltip.css'

const sideOffset = tokenOffset('--od-space-1')
const NATIVE_FOCUSABLE = new Set(['a', 'button', 'input', 'select', 'summary', 'textarea'])

// Base UI 1.8 leaves the tooltip role and the description link to the wrapper: the popup gets `role="tooltip"` and
// the trigger points at it while it is open, next to any description the child already has.
const describedBy = (own, popupId) => [own, popupId].filter(Boolean).join(' ') || undefined

/**
 * Tooltip on Base UI (redesign bugs-d row 36c, W1-D-26): a short, read-only note for something that is already on
 * screen, such as the full date behind «5 min ago». It opens on hover and on keyboard focus, and Escape closes it.
 * The popup is a `tooltip` that the wrapper links to the trigger by `aria-describedby` while it is open; it never
 * holds a control or the only copy of an action, and it does not take the pointer.
 *
 * `children` is the trigger and must be one element. A native control (button, link, input…) stays as it is; any
 * other element (a span, a styled text) is made focusable with `tabIndex={0}` so the note is reachable by Tab; a
 * `tabIndex` the child already has is kept. `content` is already translated; without it (null, false or empty
 * text) the child renders alone, with no extra tab stop. `side` and `align` place the popup (it flips at the
 * window edge); `delay` is the hover wait in milliseconds. `className` goes on the popup.
 *
 * Inside a Product dialog or sheet the popup mounts in the same shared host, so it stays above the layer and is
 * not made inert with the page behind it.
 */
export const Tooltip = ({ content, children, side = 'top', align = 'center', delay, closeDelay, dir, className }) => {
  const direction = useProductDir(dir)
  const [host, setHost] = useState(null)
  const [open, setOpen] = useState(false)
  const popupId = useId()
  const triggerRef = useCallback(node => setHost(node?.closest?.('.od-dialog-shared-host') ?? null), [])
  const hasContent = content !== null && content !== undefined && content !== false && content !== ''
  if (!hasContent) return children ?? null
  const trigger = React.isValidElement(children) ? children : <span>{children}</span>
  const focusable = typeof trigger.type === 'string' && NATIVE_FOCUSABLE.has(trigger.type)
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
      <TooltipPrimitive.Trigger
        ref={triggerRef}
        render={trigger}
        delay={delay}
        closeDelay={closeDelay}
        tabIndex={focusable || trigger.props.tabIndex != null ? undefined : 0}
        aria-describedby={describedBy(trigger.props['aria-describedby'], open && popupId)}
      />
      <TooltipPrimitive.Portal container={host || undefined} className='odc-root' dir={direction}>
        <TooltipPrimitive.Positioner
          className='odc-tooltip-positioner'
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          <TooltipPrimitive.Popup id={popupId} role='tooltip' className={cx('odc-tooltip', className)} dir={direction}>
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
