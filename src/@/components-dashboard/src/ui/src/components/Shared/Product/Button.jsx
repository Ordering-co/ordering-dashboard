import React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'

import { LoaderCircle } from '../Icon'
import { cx } from './classNames'
import './product.css'

/**
 * Product button (C4, C8). One primary per view; secondary is the default
 * outline, `ghost` is for toolbars, `danger` only confirms a destructive action,
 * `link` reads as text. Sizes: sm 28px, md 32px, lg 40px; 44px with a coarse
 * pointer (C3). `busy` keeps the label, shows a spinner and blocks repeats,
 * including the form submit of a `type='submit'` button (click or Enter).
 *
 * Governed wrapper on Base UI Button. The Shared/UI Button facade stays the
 * compatibility layer for legacy consumers; redesigned surfaces use this one.
 */
export const Button = React.forwardRef(function ProductButton ({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconEnd: IconEnd,
  busy = false,
  className,
  children,
  type = 'button',
  disabled,
  ...props
}, ref) {
  return (
    <ButtonPrimitive
      ref={ref}
      type={type}
      className={cx('odc-btn', className)}
      data-variant={variant}
      data-size={size}
      data-busy={busy ? 'true' : undefined}
      aria-busy={busy || undefined}
      // only when busy: an explicit undefined would drop the aria-disabled Base UI sets with focusableWhenDisabled
      {...(busy && { 'aria-disabled': true })}
      disabled={disabled}
      {...props}
      // Cancelling the click also cancels the submit, including the one Enter triggers.
      onClick={busy ? e => e.preventDefault() : props.onClick}
    >
      {busy
        ? <LoaderCircle className='odc-icon odc-spin' />
        : Icon && <Icon className='odc-icon' />}
      {children}
      {IconEnd && <IconEnd className='odc-icon' />}
    </ButtonPrimitive>
  )
})

/**
 * Icon-only button. `label` is required: it is the accessible name and the
 * tooltip text (`title`), so the action is never only a glyph.
 */
export const IconButton = React.forwardRef(function ProductIconButton ({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  flipInRtl = false,
  className,
  ...props
}, ref) {
  if (label == null) throw new Error('IconButton needs a label') // redesign W0-2 r2 (W0-Q1-01)
  return (
    <ButtonPrimitive
      ref={ref}
      type='button'
      className={cx('odc-btn', className)}
      data-variant={variant}
      data-size={size}
      data-icon-only=''
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon className={cx('odc-icon', flipInRtl && 'odc-icon-flip')} />
    </ButtonPrimitive>
  )
})
