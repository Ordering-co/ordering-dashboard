import React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'

const TabElement = React.forwardRef(({ literalAs, ...props }, ref) => (
  <div {...props} ref={ref} {...(literalAs ? { as: literalAs } : {})} />
))
TabElement.displayName = 'OrderingTabElement'

// Default tabs remain divs. Base UI supplies keyboard button behavior without
// introducing selection state, tablist semantics, roving focus or panels.
export const TabActionBridge = React.forwardRef((componentProps, ref) => {
  const props = { ...componentProps }
  const literalAs = props.as ?? props.forwardedAs
  const active = props.active
  const disabled = props.disabled
  for (const key of ['active', 'as', 'borderBottom', 'disabled', 'focusableWhenDisabled', 'forwardedAs', 'nativeButton', 'render', 'theme']) delete props[key]
  if (!Object.prototype.hasOwnProperty.call(props, 'aria-pressed')) props['aria-pressed'] = Boolean(active)

  return (
    <ButtonPrimitive
      {...props}
      ref={ref}
      disabled={false}
      nativeButton={false}
      render={<TabElement disabled={disabled} literalAs={literalAs} />}
    />
  )
})

TabActionBridge.displayName = 'OrderingTabActionBridge'
