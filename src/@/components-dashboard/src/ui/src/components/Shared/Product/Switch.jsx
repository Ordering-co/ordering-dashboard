import React from 'react'
import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cx } from './classNames'
import './product.css'
import './switch.css'

// redesign W0-7 (T0-22)
/**
 * On/off setting that applies at once (not a form choice): a native <button>
 * with role="switch" and aria-checked, on Base UI Switch. Fixes the unnamed
 * 25x14 driver switches (W4-A0-01).
 *
 * The state is shape and colour, never colour alone: the thumb moves to the
 * end of the track when on, and the off track keeps a 3:1 border.
 *
 * Name it with `label` (aria-label) when it sits alone, or with `children`
 * (visible text beside the track): then the whole row toggles. One of the two
 * is required; an empty string is a name that paints empty, not a missing one.
 * `busy` is for the time it takes to save: aria-busy, and further presses are
 * ignored while it lasts (the switch keeps focus, it is not disabled).
 *
 * The track is 32x18 and the button is at least 24px with a fine pointer;
 * 44px on a phone or with a coarse pointer, by a pseudo-element, so the
 * visible track does not grow.
 *
 * `tone='neutral'` (optional) paints the on track in ink instead of the action
 * blue, for a second switch in the same row that must not compete with the
 * primary one (Featured beside Enabled). Any other value keeps the default look.
 */
export const Switch = React.forwardRef(function ProductSwitch ({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  children,
  disabled = false,
  busy = false,
  tone,
  className,
  ...props
}, ref) {
  if (label == null && children == null) throw new Error('Switch needs a label')
  const labelled = children != null
  return (
    <SwitchPrimitive.Root
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      readOnly={busy}
      onCheckedChange={(next, details) => {
        if (busy) return
        onCheckedChange?.(next, details)
      }}
      nativeButton
      render={<button type='button' />}
      className={cx('odc-root', 'odc-switch', labelled && 'odc-switch-labelled', className)}
      aria-label={labelled ? undefined : label}
      aria-busy={busy || undefined}
      data-busy={busy ? '' : undefined}
      data-tone={tone === 'neutral' ? 'neutral' : undefined}
      {...props}
    >
      <span className='odc-switch-track' aria-hidden='true'>
        <SwitchPrimitive.Thumb className='odc-switch-thumb' />
      </span>
      {labelled && <span className='odc-switch-text'>{children}</span>}
    </SwitchPrimitive.Root>
  )
})
