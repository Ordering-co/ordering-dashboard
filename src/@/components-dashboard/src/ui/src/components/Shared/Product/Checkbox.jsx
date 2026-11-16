import React from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'

import { Check, Minus } from '../Icon'
import { cx } from './classNames'
import './product.css'
import './checkbox.css'

/**
 * Selection checkbox (C6, Part 1 ARIA convention): a native <button> with
 * role="checkbox" and aria-checked true / false / mixed. The button is the
 * 24px target and the 16px box is drawn inside; 44px with a coarse pointer.
 * The box border uses --od-x-control-border (≥ 3:1, WCAG 1.4.11).
 *
 * Name it with `label` (aria-label) when it sits alone in a cell, or with
 * `children` when the row text is the label (column manager): then the whole
 * row toggles. `checked` may be true, false or 'mixed'.
 */
export const Checkbox = React.forwardRef(function ProductCheckbox ({
  checked = false,
  onCheckedChange,
  label,
  children,
  disabled = false,
  className,
  ...props
}, ref) {
  const mixed = checked === 'mixed'
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked === true}
      indeterminate={mixed}
      disabled={disabled}
      onCheckedChange={next => onCheckedChange?.(next)}
      nativeButton
      render={<button type='button' />}
      className={cx('odc-checkbox', children && 'odc-checkbox-labelled', className)}
      aria-label={children ? undefined : label}
      {...props}
    >
      <span className='odc-checkbox-box' aria-hidden='true'>
        <CheckboxPrimitive.Indicator className='odc-checkbox-mark' keepMounted={false}>
          {mixed ? <Minus className='odc-icon' /> : <Check className='odc-icon' />}
        </CheckboxPrimitive.Indicator>
      </span>
      {children && <span className='odc-checkbox-text'>{children}</span>}
    </CheckboxPrimitive.Root>
  )
})
